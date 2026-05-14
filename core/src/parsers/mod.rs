pub mod typescript;
pub mod sql;
pub mod prisma;
pub mod enums;
pub mod graphql;
pub mod json_schema;
pub mod mongodb;

use crate::schema::{FormatTag, ParsedSchema};
use regex::Regex;

/// Common trait for all schema parsers
pub trait Parser {
    fn parse(&self, input: &str) -> Result<ParsedSchema, String>;
}

/// Automatically detect the schema format based on heuristics
pub fn detect_format(input: &str) -> FormatTag {
    let ts_heuristics = Regex::new(r"\b(interface|type\s+\w+\s*=)\b|(?s)\bclass\s+\w+").unwrap();
    let sql_heuristics = Regex::new(r"(?i)\bCREATE\s+TABLE\b").unwrap();
    let graphql_heuristics = Regex::new(r"\btype\s+\w+\s*(implements\s+[\w\s&]+)?\{|\bschema\s*\{|\binput\s+\w+\s*\{").unwrap();
    let prisma_heuristics = Regex::new(r"\bmodel\s+\w+\s*\{").unwrap();
    let protobuf_heuristics = Regex::new(r"\bsyntax\s*=\s*.proto").unwrap();
    let json_heuristics = Regex::new(r#""\$schema"|"\$ref"|"definitions"|"components""#).unwrap();
    let mongodb_heuristics = Regex::new(r"new\s+(mongoose\.)?Schema|mongoose\.model").unwrap();

    // Check JSON first to avoid collisions if a JSON file contains string values matching other heuristics
    if input.trim_start().starts_with('{') && json_heuristics.is_match(input) {
        return FormatTag::JsonSchema;
    }

    if sql_heuristics.is_match(input) {
        return FormatTag::Sql;
    }
    if graphql_heuristics.is_match(input) {
        return FormatTag::GraphQL;
    }
    if prisma_heuristics.is_match(input) {
        return FormatTag::Prisma;
    }
    if protobuf_heuristics.is_match(input) {
        return FormatTag::Protobuf;
    }
    if mongodb_heuristics.is_match(input) {
        return FormatTag::Mongodb;
    }
    if ts_heuristics.is_match(input) {
        return FormatTag::TypeScript;
    }

    // Default or unknown fallback
    FormatTag::Unknown
}

/// Primary entry point for parsing any schema string
pub fn parse_schema(input: &str) -> Result<ParsedSchema, String> {
    let format = detect_format(input);

    let mut parsed = match format {
        FormatTag::TypeScript => typescript::TypeScriptParser.parse(input),
        FormatTag::Sql => sql::SqlParser.parse(input),
        FormatTag::Prisma => prisma::PrismaParser.parse(input),
        FormatTag::GraphQL => graphql::GraphQLParser.parse(input),
        FormatTag::JsonSchema => json_schema::JsonSchemaParser.parse(input),
        FormatTag::Mongodb => mongodb::MongodbParser.parse(input),
        _ => Err(format!("Unsupported format or unknown schema type: {:?}", format)),
    }?;

    // Enum extraction pass (since enums can exist in TS, GraphQL, Prisma, etc.)
    if let Ok(enum_parsed) = enums::EnumParser.parse(input) {
        // Create a quick lookup hashset for existing nodes to avoid duplication (e.g. Prisma and GraphQL parse enums natively)
        let existing_ids: std::collections::HashSet<String> = parsed.nodes.iter().map(|n| n.id.clone()).collect();
        
        for mut node in enum_parsed.nodes {
            if !existing_ids.contains(&node.id) {
                node.format = format.clone(); // Tag the enum with the detected root format
                parsed.nodes.push(node);
            }
        }
    }

    Ok(parsed)
}
