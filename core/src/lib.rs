pub mod schema;
pub mod parsers;

use wasm_bindgen::prelude::*;
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
            class AuthService {
                private config: AuthConfig;
                constructor(config: AuthConfig) {}
                login(user: User): AuthResult {}
            }
        "#;

        let parsed = parse_schema(ts_code).expect("Should parse");
        // Profile, User, AuthService, AuthService.login
        assert_eq!(parsed.nodes.len(), 4);
        
        let class_node = parsed.nodes.iter().find(|n| n.id == "AuthService").unwrap();
        assert_eq!(class_node.kind, NodeKind::Class);
        assert_eq!(class_node.fields.len(), 1); // config

        let method_node = parsed.nodes.iter().find(|n| n.id == "AuthService.login").unwrap();
        assert_eq!(method_node.kind, NodeKind::Method);
    }

    #[test]
    fn test_sql_parsing() {
        let sql_code = r#"
            CREATE TABLE users (
                id INT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                profile_id INT,
                FOREIGN KEY (profile_id) REFERENCES profiles(id)
            );
        "#;

        let parsed = parse_schema(sql_code).expect("Should parse");
        assert_eq!(parsed.nodes.len(), 1);
        
        let node = &parsed.nodes[0];
        assert_eq!(node.id, "users");
        assert_eq!(node.kind, NodeKind::Table);
        assert_eq!(node.format, FormatTag::Sql);
        assert_eq!(node.fields.len(), 3);
        
        assert_eq!(parsed.edges.len(), 1);
        let edge = &parsed.edges[0];
        assert_eq!(edge.source_node_id, "users");
        assert_eq!(edge.target_node_id, "profiles");
        assert_eq!(edge.kind, RelationshipKind::ForeignKey);
    }

    #[test]
    fn test_prisma_parsing() {
        let prisma_code = r#"
            model User {
                id      Int      @id @default(autoincrement())
                email   String   @unique
                posts   Post[]
                profile Profile?
            }

            enum Role {
                USER
                ADMIN
            }
        "#;

        let parsed = parse_schema(prisma_code).expect("Should parse");
        
        // Should parse 1 model (User) and 1 enum (Role)
        assert_eq!(parsed.nodes.len(), 2);

        let user_node = parsed.nodes.iter().find(|n| n.id == "User").unwrap();
        assert_eq!(user_node.kind, NodeKind::Table);
        assert_eq!(user_node.format, FormatTag::Prisma);
        
        let role_enum = parsed.nodes.iter().find(|n| n.id == "Role").unwrap();
        assert_eq!(role_enum.kind, NodeKind::Enum);
        assert_eq!(role_enum.format, FormatTag::Prisma);
        
        // edges (Post, Profile references)
        assert_eq!(parsed.edges.len(), 2);
        assert!(parsed.edges.iter().any(|e| e.target_node_id == "Post"));
        assert!(parsed.edges.iter().any(|e| e.target_node_id == "Profile"));
    }

    #[test]
    fn test_graphql_parsing() {
        let gql_code = r#"
            type User implements Node {
                id: ID!
                name: String!
                friends: [User!]!
                role: Role
            }
            enum Role {
                ADMIN
                GUEST
            }
        "#;

        let parsed = parse_schema(gql_code).expect("Should parse");
        assert_eq!(parsed.nodes.len(), 2);

        let user = parsed.nodes.iter().find(|n| n.id == "User").unwrap();
        assert_eq!(user.kind, NodeKind::Interface);
        assert_eq!(user.fields.len(), 4);

        let friends_field = user.fields.iter().find(|f| f.name == "friends").unwrap();
        assert_eq!(friends_field.ty, "User");
        let modifiers = friends_field.modifiers.as_ref().unwrap();
        assert!(modifiers.contains(&FieldModifier::Array));

        // Edges: Implements Node, References User (friends), References Role
        assert_eq!(parsed.edges.len(), 3);
    }

    #[test]
    fn test_json_schema_parsing() {
        let json_code = r##"
        {
            "$schema": "http://json-schema.org/draft-07/schema#",
            "definitions": {
                "Person": {
                    "type": "object",
                    "properties": {
                        "name": { "type": "string" },
                        "age": { "type": "integer" },
                        "address": { "$ref": "#/definitions/Address" }
                    },
                    "required": ["name"]
                },
                "Address": {
                    "type": "object",
                    "properties": {
                        "street": { "type": "string" }
                    }
                }
            }
        }
        "##;

        let parsed = parse_schema(json_code).expect("Should parse");
        assert_eq!(parsed.nodes.len(), 2);

        let person = parsed.nodes.iter().find(|n| n.id == "Person").unwrap();
        assert_eq!(person.kind, NodeKind::Interface);
        assert_eq!(person.fields.len(), 3);

        let address_field = person.fields.iter().find(|f| f.name == "address").unwrap();
        assert_eq!(address_field.ty, "Address");

        // Edge: References Address
        assert_eq!(parsed.edges.len(), 1);
        let edge = &parsed.edges[0];
        assert_eq!(edge.source_node_id, "Person");
        assert_eq!(edge.target_node_id, "Address");
        assert_eq!(edge.kind, RelationshipKind::References);
    }
}
