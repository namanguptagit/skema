use crate::parsers::Parser;
use crate::schema::{
    FieldModifier, FormatTag, NodeKind, ParsedSchema, RelationshipKind, SchemaEdge, SchemaField, SchemaNode,
};
use serde_json::Value;

pub struct JsonSchemaParser;

impl Parser for JsonSchemaParser {
    fn parse(&self, input: &str) -> Result<ParsedSchema, String> {
        let doc: Value = serde_json::from_str(input)
            .map_err(|e| format!("Failed to parse JSON Schema: {}", e))?;

        let mut nodes = Vec::new();
        let mut edges = Vec::new();

        // Check common locations for definitions
        let mut defs_map = None;

        if let Some(defs) = doc.get("definitions") {
            defs_map = defs.as_object();
        } else if let Some(defs) = doc.get("$defs") {
            defs_map = defs.as_object();
        } else if let Some(components) = doc.get("components") {
            if let Some(schemas) = components.get("schemas") {
                defs_map = schemas.as_object();
            }
        }

        // If no explicit definitions block exists, treat the root as a single schema object
        // if it has properties. For simplicity, we assume root is named "RootSchema".
        let root_name = "RootSchema".to_string();
        let iter = if let Some(map) = defs_map {
            map.iter().collect::<Vec<_>>()
        } else if doc.get("properties").is_some() {
            vec![(&root_name, &doc)]
        } else {
            vec![]
        };

        for (name, schema_val) in iter {
            let mut fields = Vec::new();

            if let Some(props) = schema_val.get("properties").and_then(|p| p.as_object()) {
                let required = schema_val.get("required").and_then(|r| r.as_array());

                for (prop_name, prop_val) in props {
                    let mut modifiers = Vec::new();

                    // Check if optional
                    let is_required = required.map_or(false, |req| req.contains(&Value::String(prop_name.clone())));
                    if !is_required {
                        modifiers.push(FieldModifier::Optional);
                    }

                    let (ty_str, is_array) = extract_json_type(prop_val, name, prop_name, &mut edges);
                    if is_array {
                        modifiers.push(FieldModifier::Array);
                    }

                    fields.push(SchemaField {
                        name: prop_name.clone(),
                        ty: ty_str,
                        modifiers: if modifiers.is_empty() { None } else { Some(modifiers) },
                        metadata: None,
                    });
                }
            }

            nodes.push(SchemaNode {
                id: name.clone(),
                display_name: name.clone(),
                kind: NodeKind::Interface,
                fields,
                metadata: None,
                format: FormatTag::JsonSchema,
            });
        }

        Ok(ParsedSchema { nodes, edges })
    }
}

// Helper to extract type and references from JSON schema properties
fn extract_json_type(prop_val: &Value, parent_name: &str, field_name: &str, edges: &mut Vec<SchemaEdge>) -> (String, bool) {
    if let Some(ref_val) = prop_val.get("$ref").and_then(|v| v.as_str()) {
        let target = ref_val.split('/').last().unwrap_or(ref_val).to_string();
        edges.push(SchemaEdge {
            source_node_id: parent_name.to_string(),
            target_node_id: target.clone(),
            kind: RelationshipKind::References,
            label: Some(field_name.to_string()),
        });
        return (target, false);
    }

    if let Some(ty) = prop_val.get("type").and_then(|v| v.as_str()) {
        if ty == "array" {
            if let Some(items) = prop_val.get("items") {
                let (inner_ty, _) = extract_json_type(items, parent_name, field_name, edges);
                return (inner_ty, true); // It's an array
            }
            return ("Any".to_string(), true);
        }
        return (ty.to_string(), false);
    }

    // Default fallback
    ("Any".to_string(), false)
}
