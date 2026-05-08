pub mod schema;
pub mod parsers;

use wasm_bindgen::prelude::*;
use schema::ParsedSchema;
use parsers::parse_schema as internal_parse_schema;

// When the `wee_alloc` feature is enabled, use `wee_alloc` as the global
// allocator.
#[cfg(feature = "wee_alloc")]
#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

#[wasm_bindgen]
pub fn parse_schema_wasm(input: &str) -> Result<JsValue, JsValue> {
    match internal_parse_schema(input) {
        Ok(parsed) => serde_wasm_bindgen::to_value(&parsed).map_err(|err| err.into()),
        Err(e) => Err(JsValue::from_str(&e)),
    }
}

#[cfg(test)]
mod tests {
    use super::schema::*;
    use super::parsers::parse_schema;

    #[test]
    fn test_typescript_parsing() {
        let ts_code = r#"
            interface Profile {
                bio: string;
            }
            interface User extends BaseUser {
                id: string;
                profile?: Profile;
                tags: readonly string[];
            }
        "#;

        let parsed = parse_schema(ts_code).expect("Should parse");
        assert_eq!(parsed.nodes.len(), 2);
        
        let user_node = parsed.nodes.iter().find(|n| n.id == "User").unwrap();
        assert_eq!(user_node.kind, NodeKind::Interface);
        assert_eq!(user_node.format, FormatTag::TypeScript);
        assert_eq!(user_node.fields.len(), 3);
        
        // Extends edge
        assert!(parsed.edges.iter().any(|e| e.source_node_id == "User" && e.target_node_id == "BaseUser" && e.kind == RelationshipKind::Extends));
        
        // References edge (profile field -> Profile type)
        assert!(parsed.edges.iter().any(|e| e.source_node_id == "User" && e.target_node_id == "Profile" && e.kind == RelationshipKind::References));
    }
}
