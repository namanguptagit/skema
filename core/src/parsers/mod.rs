pub mod typescript;

use crate::schema::{FormatTag, ParsedSchema};
use regex::Regex;

/// Common trait for all schema parsers
pub trait Parser {
    fn parse(&self, input: &str) -> Result<ParsedSchema, String>;
}

/// Automatically detect the schema format based on heuristics
pub fn detect_format(input: &str) -> FormatTag {
    let ts_heuristics = Regex::new(r"\b(interface|type\s+\w+\s*=)\b").unwrap();
    let sql_heuristics = Regex::new(r"(?i)\bCREATE\s+TABLE\b").unwrap();
    let graphql_heuristics = Regex::new(r"\btype\s+\w+\s*\{|\bschema\s*\{").unwrap();
    let prisma_heuristics = Regex::new(r"\bmodel\s+\w+\s*\{.*@@").unwrap();
    let protobuf_heuristics = Regex::new(r"\bsyntax\s*=\s*.proto").unwrap();

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
    if ts_heuristics.is_match(input) {
        return FormatTag::TypeScript;
    }

    // Default or unknown fallback
    FormatTag::Unknown
}

/// Primary entry point for parsing any schema string
pub fn parse_schema(input: &str) -> Result<ParsedSchema, String> {
    let format = detect_format(input);

    match format {
        FormatTag::TypeScript => {
            let parser = typescript::TypeScriptParser;
            parser.parse(input)
        }
        _ => Err(format!("Unsupported format or unknown schema type: {:?}", format)),
    }
}
