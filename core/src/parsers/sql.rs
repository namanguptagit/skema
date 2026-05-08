use crate::parsers::Parser;
use crate::schema::{
    FieldModifier, FormatTag, NodeKind, ParsedSchema, RelationshipKind, SchemaEdge, SchemaField, SchemaNode,
};
use sqlparser::ast::{Statement, TableConstraint, ColumnOption};
use sqlparser::dialect::GenericDialect;
use sqlparser::parser::Parser as SqlastParser;

pub struct SqlParser;

impl Parser for SqlParser {
    fn parse(&self, input: &str) -> Result<ParsedSchema, String> {
        let dialect = GenericDialect {};
        let ast = SqlastParser::parse_sql(&dialect, input)
            .map_err(|e| format!("Failed to parse SQL: {}", e))?;

        let mut nodes = Vec::new();
        let mut edges = Vec::new();

        for stmt in ast {
            if let Statement::CreateTable(create_table) = stmt {
                let table_name = create_table.name.to_string();
                let mut fields = Vec::new();
                let mut primary_keys = Vec::new();

                // 1. Process columns
                for col in create_table.columns {
                    let field_name = col.name.to_string();
                    let ty = col.data_type.to_string();
                    let mut modifiers = Vec::new();

                    for opt in &col.options {
                        match &opt.option {
                            ColumnOption::Null => {
                                modifiers.push(FieldModifier::Nullable);
                            }
                            ColumnOption::NotNull => {
                                // Default in our schema, but can be marked if needed
                            }
                            ColumnOption::Unique(_) => {
                                // 
                            }
                            ColumnOption::PrimaryKey(_) => {
                                primary_keys.push(field_name.clone());
                            }
                            ColumnOption::ForeignKey(fk) => {
                                edges.push(SchemaEdge {
                                    source_node_id: table_name.clone(),
                                    target_node_id: fk.foreign_table.to_string(),
                                    kind: RelationshipKind::ForeignKey,
                                    label: Some(field_name.clone()),
                                });
                            }
                            _ => {}
                        }
                    }

                    fields.push(SchemaField {
                        name: field_name,
                        ty,
                        modifiers: if modifiers.is_empty() { None } else { Some(modifiers) },
                        metadata: None,
                    });
                }

                // 2. Process table constraints (Foreign Keys and Primary Keys defined at table level)
                for constraint in create_table.constraints {
                    match constraint {
                        TableConstraint::ForeignKey(fk) => {
                            let label = fk.columns.first().map(|c| c.to_string());
                            edges.push(SchemaEdge {
                                source_node_id: table_name.clone(),
                                target_node_id: fk.foreign_table.to_string(),
                                kind: RelationshipKind::ForeignKey,
                                label,
                            });
                        }
                        TableConstraint::PrimaryKey(pk) => {
                            for col in pk.columns {
                                primary_keys.push(col.to_string());
                            }
                        }
                        _ => {}
                    }
                }

                let mut metadata = serde_json::Map::new();
                if !primary_keys.is_empty() {
                    metadata.insert("primaryKeys".into(), serde_json::json!(primary_keys));
                }

                nodes.push(SchemaNode {
                    id: table_name.clone(),
                    display_name: table_name,
                    kind: NodeKind::Table,
                    fields,
                    metadata: if metadata.is_empty() { None } else { Some(serde_json::Value::Object(metadata)) },
                    format: FormatTag::Sql,
                });
            }
        }

        Ok(ParsedSchema { nodes, edges })
    }
}
