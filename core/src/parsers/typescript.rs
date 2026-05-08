use crate::parsers::Parser;
use crate::schema::{
    FieldModifier, FormatTag, NodeKind, ParsedSchema, RelationshipKind, SchemaEdge, SchemaField, SchemaNode,
};
use swc_common::{sync::Lrc, FileName, SourceMap};
use swc_ecma_ast::{Decl, ModuleItem, Stmt, TsType, TsTypeElement};
use swc_ecma_parser::{lexer::Lexer, Parser as SwcParser, StringInput, Syntax, TsSyntax};

pub struct TypeScriptParser;

impl Parser for TypeScriptParser {
    fn parse(&self, input: &str) -> Result<ParsedSchema, String> {
        let cm: Lrc<SourceMap> = Default::default();
        let fm = cm.new_source_file(Lrc::new(FileName::Custom("schema.ts".into())), input.to_string());

        let lexer = Lexer::new(
            Syntax::Typescript(TsSyntax {
                dts: true,
                ..Default::default()
            }),
            Default::default(),
            StringInput::from(&*fm),
            None,
        );

        let mut parser = SwcParser::new_from(lexer);
        let module = parser
            .parse_module()
            .map_err(|e| format!("Failed to parse TypeScript: {:?}", e))?;

        let mut nodes = Vec::new();
        let mut edges = Vec::new();

        for item in module.body {
            if let ModuleItem::Stmt(Stmt::Decl(decl)) = item {
                match decl {
                    Decl::TsInterface(iface) => {
                        let id = iface.id.sym.to_string();
                        let display_name = id.clone();
                        let mut fields = Vec::new();

                        // Parse extends relationships
                        for ext in &iface.extends {
                            if let Some(ident) = ext.expr.as_ident() {
                                edges.push(SchemaEdge {
                                    source_node_id: id.clone(),
                                    target_node_id: ident.sym.to_string(),
                                    kind: RelationshipKind::Extends,
                                    label: None,
                                });
                            }
                        }

                        // Parse fields
                        for member in &iface.body.body {
                            if let TsTypeElement::TsPropertySignature(prop) = member {
                                let field_name = match &*prop.key {
                                    swc_ecma_ast::Expr::Ident(ident) => ident.sym.to_string(),
                                    _ => "unknown".to_string(),
                                };

                                let mut modifiers = Vec::new();
                                if prop.optional {
                                    modifiers.push(FieldModifier::Optional);
                                }
                                if prop.readonly {
                                    modifiers.push(FieldModifier::Readonly);
                                }

                                let ty_string = extract_type_string(&prop.type_ann);
                                
                                // Basic edge inference: if type is capitalized, assume it's a reference to another node
                                if is_custom_type(&ty_string) {
                                    edges.push(SchemaEdge {
                                        source_node_id: id.clone(),
                                        target_node_id: ty_string.clone(),
                                        kind: RelationshipKind::References,
                                        label: Some(field_name.clone()),
                                    });
                                }

                                fields.push(SchemaField {
                                    name: field_name,
                                    ty: ty_string,
                                    modifiers: if modifiers.is_empty() { None } else { Some(modifiers) },
                                    metadata: None,
                                });
                            }
                        }

                        nodes.push(SchemaNode {
                            id,
                            display_name,
                            kind: NodeKind::Interface,
                            fields,
                            metadata: None,
                            format: FormatTag::TypeScript,
                        });
                    }
                    Decl::TsTypeAlias(alias) => {
                        let id = alias.id.sym.to_string();
                        // For simplicity in Phase 2, we treat TypeAliases mapping to type literals as interfaces.
                        // A full parser would handle Unions and primitive aliases properly.
                        nodes.push(SchemaNode {
                            id: id.clone(),
                            display_name: id,
                            kind: NodeKind::Interface,
                            fields: vec![],
                            metadata: None,
                            format: FormatTag::TypeScript,
                        });
                    }
                    Decl::Class(class_decl) => {
                        let id = class_decl.ident.sym.to_string();
                        let display_name = id.clone();
                        let mut fields = Vec::new();

                        // Parse extends
                        if let Some(super_class) = &class_decl.class.super_class {
                            if let swc_ecma_ast::Expr::Ident(ident) = &**super_class {
                                edges.push(SchemaEdge {
                                    source_node_id: id.clone(),
                                    target_node_id: ident.sym.to_string(),
                                    kind: RelationshipKind::Extends,
                                    label: None,
                                });
                            }
                        }

                        // Parse implements
                        for implements in &class_decl.class.implements {
                            if let swc_ecma_ast::Expr::Ident(ident) = &*implements.expr {
                                edges.push(SchemaEdge {
                                    source_node_id: id.clone(),
                                    target_node_id: ident.sym.to_string(),
                                    kind: RelationshipKind::Implements,
                                    label: None,
                                });
                            }
                        }

                        // Parse properties and methods
                        for member in &class_decl.class.body {
                            match member {
                                swc_ecma_ast::ClassMember::ClassProp(prop) => {
                                    let field_name = match &prop.key {
                                        swc_ecma_ast::PropName::Ident(ident) => ident.sym.to_string(),
                                        _ => "unknown".to_string(),
                                    };

                                    let mut modifiers = Vec::new();
                                    if prop.is_optional {
                                        modifiers.push(FieldModifier::Optional);
                                    }
                                    if prop.readonly {
                                        modifiers.push(FieldModifier::Readonly);
                                    }

                                    let ty_string = extract_type_string(&prop.type_ann);
                                    
                                    if is_custom_type(&ty_string) {
                                        edges.push(SchemaEdge {
                                            source_node_id: id.clone(),
                                            target_node_id: ty_string.clone(),
                                            kind: RelationshipKind::References,
                                            label: Some(field_name.clone()),
                                        });
                                    }

                                    fields.push(SchemaField {
                                        name: field_name,
                                        ty: ty_string,
                                        modifiers: if modifiers.is_empty() { None } else { Some(modifiers) },
                                        metadata: None,
                                    });
                                }
                                swc_ecma_ast::ClassMember::Method(method) => {
                                    let method_name = match &method.key {
                                        swc_ecma_ast::PropName::Ident(ident) => ident.sym.to_string(),
                                        _ => "unknown".to_string(),
                                    };

                                    let return_type = extract_type_string(&method.function.return_type);
                                    
                                    let method_id = format!("{}.{}", id, method_name);
                                    
                                    // Map Method as a Node
                                    nodes.push(SchemaNode {
                                        id: method_id.clone(),
                                        display_name: method_name.clone(),
                                        kind: NodeKind::Method,
                                        fields: vec![], // parameters could be fields, simplified for now
                                        metadata: None,
                                        format: FormatTag::TypeScript,
                                    });

                                    // Edge from Class to Method
                                    edges.push(SchemaEdge {
                                        source_node_id: id.clone(),
                                        target_node_id: method_id,
                                        kind: RelationshipKind::HasField,
                                        label: None,
                                    });

                                    // If returning a custom type, add Returns edge
                                    if is_custom_type(&return_type) {
                                        edges.push(SchemaEdge {
                                            source_node_id: method_name,
                                            target_node_id: return_type.clone(),
                                            kind: RelationshipKind::Returns,
                                            label: None,
                                        });
                                    }
                                }
                                _ => {}
                            }
                        }

                        nodes.push(SchemaNode {
                            id,
                            display_name,
                            kind: NodeKind::Class,
                            fields,
                            metadata: None,
                            format: FormatTag::TypeScript,
                        });
                    }
                    _ => {}
                }
            }
        }

        Ok(ParsedSchema { nodes, edges })
    }
}

// Helper to extract a readable string from a SWC Type Annotation
fn extract_type_string(type_ann: &Option<Box<swc_ecma_ast::TsTypeAnn>>) -> String {
    match type_ann {
        Some(ann) => match &*ann.type_ann {
            TsType::TsKeywordType(kw) => {
                use swc_ecma_ast::TsKeywordTypeKind::*;
                match kw.kind {
                    TsStringKeyword    => "string".to_string(),
                    TsNumberKeyword    => "number".to_string(),
                    TsBooleanKeyword   => "boolean".to_string(),
                    TsBigIntKeyword    => "bigint".to_string(),
                    TsSymbolKeyword    => "symbol".to_string(),
                    TsUndefinedKeyword => "undefined".to_string(),
                    TsNullKeyword      => "null".to_string(),
                    TsNeverKeyword     => "never".to_string(),
                    TsVoidKeyword      => "void".to_string(),
                    TsObjectKeyword    => "object".to_string(),
                    TsAnyKeyword       => "any".to_string(),
                    TsUnknownKeyword   => "unknown".to_string(),
                    TsIntrinsicKeyword => "intrinsic".to_string(),
                }
            }
            TsType::TsTypeRef(tr) => match &tr.type_name {
                swc_ecma_ast::TsEntityName::Ident(ident) => ident.sym.to_string(),
                _ => "ComplexType".to_string(),
            },
            TsType::TsArrayType(arr) => {
                let inner = extract_type_string(&Some(Box::new(swc_ecma_ast::TsTypeAnn {
                    span: arr.span,
                    type_ann: arr.elem_type.clone(),
                })));
                format!("{}[]", inner)
            }
            _ => "Any".to_string(),
        },
        None => "Any".to_string(),
    }
}

// Simple heuristic: Custom types start with uppercase (e.g. User, Profile)
fn is_custom_type(ty: &str) -> bool {
    if ty.is_empty() { return false; }
    let first_char = ty.chars().next().unwrap();
    first_char.is_uppercase() && ty != "Any"
}
