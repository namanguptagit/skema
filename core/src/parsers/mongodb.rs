use crate::parsers::Parser;
use crate::schema::{
    FieldModifier, FormatTag, NodeKind, ParsedSchema, RelationshipKind, SchemaEdge, SchemaField, SchemaNode,
};
use regex::Regex;

pub struct MongodbParser;

impl Parser for MongodbParser {
    fn parse(&self, input: &str) -> Result<ParsedSchema, String> {
        let mut nodes = Vec::new();
        let mut edges = Vec::new();

        // 1. Match Mongoose Schema definitions: const name = new Schema({ ... })
        let schema_re = Regex::new(r"(?s)(?:const|let|var)\s+(\w+)\s*=\s*new\s+(?:mongoose\.)?Schema").unwrap();

        for cap in schema_re.captures_iter(input) {
            println!("Found schema: {}", &cap[1]);
            let var_name = cap[1].to_string();
            let display_name = var_name.strip_suffix("Schema").unwrap_or(&var_name).to_string();
            
            // Find the start of the next schema to delimit the body
            let start = cap.get(0).unwrap().end();
            let next_match = Regex::new(r"(?s)(?:const|let|var)\s+\w+\s*=\s*new\s+(?:mongoose\.)?Schema").unwrap().find_at(input, start);
            let body = match next_match {
                Some(m) => &input[start..m.start()],
                None => &input[start..],
            };

            let mut fields = Vec::new();

            // 2. Match fields: name: Type, or name: { type: Type, ... }, or name: [Type], or name: [{ type: Type }]
            // This regex tries to capture the field name and something that looks like a type.
            let field_re = Regex::new(r#"(?m)^\s*(\w+)\s*:\s*(?:\[\s*(?:\{\s*type\s*:\s*([^,}\s]+).*?\}|([^,\]\s]+))\s*\]|\{\s*type\s*:\s*([^,}\s]+).*?\}|([^,}\s]+))"#).unwrap();

            for f_cap in field_re.captures_iter(body) {
                let field_name = f_cap[1].to_string();
                
                // Try to find the type in one of the capture groups (2: array-object-type, 3: array-type, 4: object-type, 5: simple-type)
                let ty_raw = f_cap.get(2).or(f_cap.get(3)).or(f_cap.get(4)).or(f_cap.get(5))
                    .map(|m| m.as_str())
                    .unwrap_or("Mixed");
                
                let mut ty = ty_raw.trim_matches(|c| c == '\'' || c == '"' || c == '[' || c == ']').to_string();
                let mut modifiers = Vec::new();

                if f_cap.get(2).is_some() || f_cap.get(3).is_some() {
                    modifiers.push(FieldModifier::Array);
                }

                if ty.contains("ObjectId") {
                    ty = "ObjectId".to_string();
                }

                // Look for refs strictly inside the object definition for this field
                let ref_re = Regex::new(&format!(r#"(?s){}\s*:\s*(?:\[\s*)?\{{\s*[^}}]*?ref\s*:\s*['"]([^'"]+)['"]"#, field_name)).unwrap();
                if let Some(ref_cap) = ref_re.captures(body) {
                    let target = ref_cap[1].to_string();
                    edges.push(SchemaEdge {
                        source_node_id: display_name.clone(),
                        target_node_id: target,
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
                id: display_name.clone(),
                display_name,
                kind: NodeKind::Table, // MongoDB collections are table-like
                fields,
                metadata: None,
                format: FormatTag::Mongodb,
            });
        }

        // 3. Fallback: If no Mongoose schemas found, maybe it's a raw JSON document?
        if nodes.is_empty() {
             // Basic JSON object detection could go here, but we already have JsonSchemaParser.
             // For now, let's stick to Mongoose as the primary "MongoDB" code format.
        }

        Ok(ParsedSchema { nodes, edges })
    }
}
