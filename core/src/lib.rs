pub mod schema;

use wasm_bindgen::prelude::*;
use schema::ParsedSchema;

// When the `wee_alloc` feature is enabled, use `wee_alloc` as the global
// allocator.
#[cfg(feature = "wee_alloc")]
#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

#[wasm_bindgen]
pub fn parse_dummy() -> Result<JsValue, JsValue> {
    let dummy_schema = ParsedSchema {
        nodes: vec![],
        edges: vec![],
    };
    
    // Serialize Rust struct to a JsValue using serde-wasm-bindgen
    serde_wasm_bindgen::to_value(&dummy_schema).map_err(|err| err.into())
}

#[cfg(test)]
mod tests {
    use super::schema::*;

    #[test]
    fn test_schema_serialization() {
        let node = SchemaNode {
            id: "1".into(),
            display_name: "User".into(),
            kind: NodeKind::Table,
            fields: vec![
                SchemaField {
                    name: "id".into(),
                    ty: "Int".into(),
                    modifiers: Some(vec![FieldModifier::Readonly]),
                    metadata: None,
                }
            ],
            metadata: None,
            format: FormatTag::Sql,
        };

        let json = serde_json::to_string(&node).unwrap();
        assert!(json.contains("User"));
        assert!(json.contains("table"));
        
        let deserialized: SchemaNode = serde_json::from_str(&json).unwrap();
        assert_eq!(node, deserialized);
    }
}
