use crate::parsers::Parser;
use crate::schema::{
    FieldModifier, FormatTag, NodeKind, ParsedSchema, RelationshipKind, SchemaEdge, SchemaField, SchemaNode,
};
use graphql_parser::schema::{parse_schema, Definition, TypeDefinition, Type};

pub struct GraphQLParser;

impl Parser for GraphQLParser {
    fn parse(&self, input: &str) -> Result<ParsedSchema, String> {
        let doc = parse_schema::<String>(input)
            .map_err(|e| format!("Failed to parse GraphQL: {}", e))?;

        let mut nodes = Vec::new();
        let mut edges = Vec::new();

        for def in doc.definitions {
            if let Definition::TypeDefinition(type_def) = def {
                let (name, kind, fields_ast, implements_interfaces) = match type_def {
                    TypeDefinition::Object(obj) => {
                        (obj.name, NodeKind::Interface, obj.fields, obj.implements_interfaces)
                    }
                    TypeDefinition::InputObject(input_obj) => {
                        let mut input_fields = Vec::new();
                        for f in input_obj.fields {
                            input_fields.push(graphql_parser::schema::Field {
                                position: f.position,
                                description: f.description,
                                name: f.name,
                                arguments: vec![],
                                field_type: f.value_type,
                                directives: f.directives,
                            });
                        }
                        (input_obj.name, NodeKind::Interface, input_fields, vec![])
                    }
                    TypeDefinition::Interface(iface) => {
                        (iface.name, NodeKind::Interface, iface.fields, vec![])
                    }
                    TypeDefinition::Enum(enum_def) => {
                        // Enums are usually picked up by the multi-format EnumParser,
                        // but if we want to extract them accurately here:
                        let mut enum_fields = Vec::new();
                        for val in enum_def.values {
                            enum_fields.push(SchemaField {
                                name: val.name,
                                ty: "EnumValue".to_string(),
                                modifiers: None,
                                metadata: None,
                            });
                        }
                        nodes.push(SchemaNode {
                            id: enum_def.name.clone(),
                            display_name: enum_def.name,
                            kind: NodeKind::Enum,
                            fields: enum_fields,
                            metadata: None,
                            format: FormatTag::GraphQL,
                        });
                        continue;
                    }
                    TypeDefinition::Union(union_def) => {
                        for t in union_def.types {
                            edges.push(SchemaEdge {
                                source_node_id: union_def.name.clone(),
                                target_node_id: t.clone(),
                                kind: RelationshipKind::References,
                                label: None,
                            });
                        }
                        nodes.push(SchemaNode {
                            id: union_def.name.clone(),
                            display_name: union_def.name,
                            kind: NodeKind::Interface, // Union is like an interface/type
                            fields: vec![],
                            metadata: None,
                            format: FormatTag::GraphQL,
                        });
                        continue;
                    }
                    TypeDefinition::Scalar(scalar) => {
                        nodes.push(SchemaNode {
                            id: scalar.name.clone(),
                            display_name: scalar.name,
                            kind: NodeKind::Scalar,
                            fields: vec![],
                            metadata: None,
                            format: FormatTag::GraphQL,
                        });
                        continue;
                    }
                };

                let mut schema_fields = Vec::new();

                for field in fields_ast {
                    let mut modifiers = Vec::new();
                    let mut base_type_name = String::new();

                    // Resolve field_type (Type)
                    let mut current_type = field.field_type;
                    let mut is_non_null = false;

                    // Unroll the Type wrapper
                    loop {
                        match current_type {
                            Type::NamedType(name) => {
                                base_type_name = name;
                                if !is_non_null {
                                    modifiers.push(FieldModifier::Optional);
                                }
                                break;
                            }
                            Type::ListType(inner) => {
                                modifiers.push(FieldModifier::Array);
                                current_type = *inner;
                                is_non_null = false; // inner type defaults to nullable unless wrapped in NonNull
                            }
                            Type::NonNullType(inner) => {
                                is_non_null = true;
                                current_type = *inner;
                            }
                        }
                    }

                    // Edges for custom references (excluding built-in scalars)
                    if base_type_name != "String" && base_type_name != "Int" && base_type_name != "Float" && base_type_name != "Boolean" && base_type_name != "ID" {
                        edges.push(SchemaEdge {
                            source_node_id: name.clone(),
                            target_node_id: base_type_name.clone(),
                            kind: RelationshipKind::References,
                            label: Some(field.name.clone()),
                        });
                    }

                    schema_fields.push(SchemaField {
                        name: field.name,
                        ty: base_type_name,
                        modifiers: if modifiers.is_empty() { None } else { Some(modifiers) },
                        metadata: None,
                    });
                }

                for implements in implements_interfaces {
                    edges.push(SchemaEdge {
                        source_node_id: name.clone(),
                        target_node_id: implements,
                        kind: RelationshipKind::Implements,
                        label: None,
                    });
                }

                nodes.push(SchemaNode {
                    id: name.clone(),
                    display_name: name,
                    kind,
                    fields: schema_fields,
                    metadata: None,
                    format: FormatTag::GraphQL,
                });
            }
        }

        Ok(ParsedSchema { nodes, edges })
    }
}
