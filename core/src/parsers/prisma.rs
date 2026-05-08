use crate::parsers::Parser;
use crate::schema::{
    FieldModifier, FormatTag, NodeKind, ParsedSchema, RelationshipKind, SchemaEdge, SchemaField, SchemaNode,
};
use regex::Regex;

pub struct PrismaParser;

impl Parser for PrismaParser {
    fn parse(&self, input: &str) -> Result<ParsedSchema, String> {
        let mut nodes = Vec::new();
        let mut edges = Vec::new();

        // Regex to find model blocks
        let model_re = Regex::new(r"(?s)model\s+(\w+)\s*\{([^}]+)\}").unwrap();
        
        for cap in model_re.captures_iter(input) {
            let model_name = cap[1].to_string();
            let body = &cap[2];
            
            let mut fields = Vec::new();

            for line in body.lines() {
                let trimmed = line.trim();
                if trimmed.is_empty() || trimmed.starts_with("//") {
                    continue;
                }

                // A basic prisma field looks like: name Type @modifiers
                let parts: Vec<&str> = trimmed.split_whitespace().collect();
                if parts.len() < 2 { continue; }

                let field_name = parts[0].to_string();
                let mut ty = parts[1].to_string();
                let mut modifiers = Vec::new();

                if ty.ends_with('?') {
                    ty.pop();
                    modifiers.push(FieldModifier::Optional);
                } else if ty.ends_with("[]") {
                    ty.truncate(ty.len() - 2);
                    modifiers.push(FieldModifier::Array);
                }

                // Check for relations. Prisma implicitly relates if the Type is another model.
                // We'll infer custom types (capitalized) as references.
                let first_char = ty.chars().next().unwrap_or(' ');
                if first_char.is_uppercase() && ty != "String" && ty != "Int" && ty != "Boolean" && ty != "DateTime" && ty != "Float" && ty != "Json" {
                    edges.push(SchemaEdge {
                        source_node_id: model_name.clone(),
                        target_node_id: ty.clone(),
                        kind: RelationshipKind::References,
                        label: Some(field_name.clone()),
                    });
                }

                fields.push(SchemaField {
                    name: field_name,
                    ty,
                    modifiers: if modifiers.is_empty() { None } else { Some(modifiers) },
                    metadata: None,
                });
            }

            nodes.push(SchemaNode {
                id: model_name.clone(),
                display_name: model_name,
                kind: NodeKind::Table,
                fields,
                metadata: None,
                format: FormatTag::Prisma,
            });
        }

        Ok(ParsedSchema { nodes, edges })
    }
}
