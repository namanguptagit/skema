use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "PascalCase")]
pub enum FormatTag {
    TypeScript,
    GraphQL,
    Sql,
    Prisma,
    JsonSchema,
    OpenApi,
    Java,
    CSharp,
    Python,
    Protobuf,
    Unknown,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum NodeKind {
    Interface,
    Enum,
    Class,
    Table,
    Method,
    Scalar,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "kebab-case")]
pub enum RelationshipKind {
    Extends,
    Implements,
    References,
    Returns,
    #[serde(rename = "has-field")]
    HasField,
    #[serde(rename = "foreign-key")]
    ForeignKey,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum FieldModifier {
    Optional,
    Nullable,
    Array,
    Readonly,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SchemaField {
    pub name: String,
    pub ty: String, // 'type' is a reserved keyword in Rust
    #[serde(skip_serializing_if = "Option::is_none")]
    pub modifiers: Option<Vec<FieldModifier>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<serde_json::Value>,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SchemaNode {
    pub id: String,
    pub display_name: String,
    pub kind: NodeKind,
    pub fields: Vec<SchemaField>, // or values for enums
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<serde_json::Value>,
    pub format: FormatTag,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SchemaEdge {
    pub source_node_id: String,
    pub target_node_id: String,
    pub kind: RelationshipKind,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub label: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ParsedSchema {
    pub nodes: Vec<SchemaNode>,
    pub edges: Vec<SchemaEdge>,
}
