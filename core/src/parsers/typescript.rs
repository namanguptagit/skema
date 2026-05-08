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
            TsType::TsKeywordType(kw) => format!("{:?}", kw.kind).to_lowercase().replace("tsKeyword", ""),
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
