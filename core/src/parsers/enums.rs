use crate::parsers::Parser;
use crate::schema::{
    FormatTag, NodeKind, ParsedSchema, SchemaField, SchemaNode,
};
use regex::Regex;

pub struct EnumParser;

impl Parser for EnumParser {
    fn parse(&self, input: &str) -> Result<ParsedSchema, String> {
        let mut nodes = Vec::new();
        
        // Matches `enum Name { VAL1, VAL2 }` regardless of commas or newlines
        let enum_re = Regex::new(r"(?s)enum\s+(\w+)\s*\{([^}]+)\}").unwrap();
        
        for cap in enum_re.captures_iter(input) {
            let enum_name = cap[1].to_string();
            let body = &cap[2];
            
            let mut fields = Vec::new();

            // Simple split by comma or newline for values
            let tokens = body.split(|c| c == ',' || c == '\n');
            for token in tokens {
                let trimmed = token.trim();
                if trimmed.is_empty() || trimmed.starts_with("//") {
                    continue;
                }
                
                // Some enums might have `VAL = 1`, just take the identifier
                let val_name = trimmed.split_whitespace().next().unwrap_or("").to_string();
                if !val_name.is_empty() {
                    fields.push(SchemaField {
                        name: val_name,
                        ty: "EnumValue".to_string(),
                        modifiers: None,
                        metadata: None,
                    });
                }
            }

            nodes.push(SchemaNode {
                id: enum_name.clone(),
                display_name: enum_name,
                kind: NodeKind::Enum,
                fields,
                metadata: None,
                // Since this acts as a multi-format extractor, FormatTag is Unknown or we just inherit.
                // We'll set Unknown here, and the main parser can patch it if needed.
                format: FormatTag::Unknown,
            });
        }

        Ok(ParsedSchema { nodes, edges: vec![] })
    }
}
