<div align="center">

<img src="../assets/logo.svg" width="48" alt="Skema logo"/>

# `core`

**Rust + WebAssembly parsing engine for Skema**

[![Rust](https://img.shields.io/badge/Rust-2024_edition-orange?style=flat&logo=rust)](https://www.rust-lang.org/)
[![wasm-bindgen](https://img.shields.io/badge/wasm--bindgen-0.2-blue?style=flat)](https://github.com/rustwasm/wasm-bindgen)
[![License: MIT](https://img.shields.io/badge/license-MIT-green?style=flat)](../LICENSE)

</div>

---

This crate is the brain of Skema. It takes raw schema text in any supported format, auto-detects the language, runs the appropriate parser, and returns a normalized graph of nodes and edges. It is compiled to WebAssembly and runs entirely in the browser - no server, no network.

---

## Structure

```
core/
├── Cargo.toml
└── src/
    ├── lib.rs           # WASM entry point
    ├── schema.rs        # All shared types
    └── parsers/
        ├── mod.rs       # Format detection + parse router
        ├── typescript.rs
        ├── sql.rs
        ├── prisma.rs
        ├── graphql.rs
        ├── json_schema.rs
        └── enums.rs
```

---

## Public API

The crate exposes a single function to JavaScript via `wasm-bindgen`:

```rust
#[wasm_bindgen]
pub fn parse_schema_wasm(input: &str) -> Result<JsValue, JsValue>
```

Pass any schema string. Get back a `ParsedSchema` serialized as a JS value (via `serde-wasm-bindgen`), or an error string.

**In JavaScript / TypeScript:**

```ts
import init, { parse_schema_wasm } from './core_pkg/core';

await init();

const result = parse_schema_wasm(`
  interface User {
    id: string;
    email: string;
  }
`);
// result.nodes -> [{ id: "User", kind: "interface", fields: [...], ... }]
// result.edges -> []
```

---

## Data Model

Defined in `src/schema.rs`. All types serialize to camelCase JSON.

### `ParsedSchema`

```rust
pub struct ParsedSchema {
    pub nodes: Vec<SchemaNode>,
    pub edges: Vec<SchemaEdge>,
}
```

### `SchemaNode`

```rust
pub struct SchemaNode {
    pub id: String,           // unique identifier (e.g. "User", "AuthService.login")
    pub display_name: String, // label shown on the canvas card
    pub kind: NodeKind,
    pub fields: Vec<SchemaField>,
    pub format: FormatTag,
    pub metadata: Option<serde_json::Value>,
}
```

### `SchemaEdge`

```rust
pub struct SchemaEdge {
    pub source_node_id: String,
    pub target_node_id: String,
    pub kind: RelationshipKind,
    pub label: Option<String>,
}
```

### `SchemaField`

```rust
pub struct SchemaField {
    pub name: String,
    pub ty: String,  // serialized as "ty" (type is reserved in Rust)
    pub modifiers: Option<Vec<FieldModifier>>,
    pub metadata: Option<serde_json::Value>,
}
```

### Enums

| Type | Variants |
|---|---|
| `NodeKind` | `interface`, `enum`, `class`, `table`, `method`, `scalar` |
| `RelationshipKind` | `extends`, `implements`, `references`, `returns`, `has-field`, `foreign-key` |
| `FieldModifier` | `optional`, `nullable`, `array`, `readonly` |
| `FormatTag` | `TypeScript`, `GraphQL`, `Sql`, `Prisma`, `JsonSchema`, `OpenApi`, `Java`, `CSharp`, `Python`, `Protobuf`, `Unknown` |

---

## Format Detection

`parsers/mod.rs` auto-detects the format using regex heuristics before routing to the correct parser. Detection order matters - JSON is checked first to prevent false matches on embedded strings.

| Format | Heuristic |
|---|---|
| JSON Schema | Starts with `{` and contains `"$schema"`, `"$ref"`, `"definitions"`, or `"components"` |
| SQL | Case-insensitive `CREATE TABLE` |
| GraphQL | `type X {`, `schema {`, or `input X {` |
| Prisma | `model X {` |
| TypeScript | `interface`, `type X =`, or `class X` |

---

## Parsers

### <img src="https://api.iconify.design/simple-icons:typescript.svg?color=%235488C4" width="14"/> TypeScript (`typescript.rs`)

Uses the **SWC** AST parser (`swc_ecma_parser`) - the same parser that powers many production bundlers.

Extracts:
- `interface` declarations - fields, optional (`?`), readonly, array types
- `type` aliases - including union types
- `class` declarations - properties and methods (methods become their own `Method` nodes)
- `extends` and `implements` relationships
- Generic type references (e.g. `Array<User>`, `Promise<Result>`)
- `const enum` blocks

### <img src="https://api.iconify.design/simple-icons:postgresql.svg?color=%235488C4" width="14"/> SQL (`sql.rs`)

Uses the **`sqlparser`** crate.

Extracts:
- `CREATE TABLE` statements
- Column names and SQL types
- `PRIMARY KEY` constraints (marked in metadata)
- `FOREIGN KEY ... REFERENCES` constraints (become `foreign-key` edges)

### <img src="https://api.iconify.design/simple-icons:prisma.svg?color=%235488C4" width="14"/> Prisma (`prisma.rs`)

Regex-based parser (Prisma SDL is simple enough not to need a full AST).

Extracts:
- `model` blocks - fields with optional (`?`) and list (`[]`) modifiers
- `enum` blocks
- Cross-model references become `references` edges

### <img src="https://api.iconify.design/simple-icons:graphql.svg?color=%235488C4" width="14"/> GraphQL (`graphql.rs`)

Uses the **`graphql-parser`** crate.

Extracts:
- `type`, `input`, `interface`, `enum`, `union`, `scalar` definitions
- `implements` relationships
- Field type references become `references` edges
- List types produce `array` modifier

### <img src="https://api.iconify.design/vscode-icons:file-type-json.svg" width="14"/> JSON Schema (`json_schema.rs`)

Custom recursive parser.

Extracts:
- Objects from `definitions` / `$defs` / top-level `properties`
- `$ref` pointers resolved to `references` edges
- `required` array drives `optional` modifiers
- Nested inline objects extracted as named nodes

### Enums (`enums.rs`)

A supplemental pass that runs after the primary parser. It catches `enum` / `const enum` declarations in formats that don't have native enum support, and de-duplicates against nodes already extracted by the primary parser (so GraphQL and Prisma enums are not double-counted).

---

## Dependencies

| Crate | Version | Purpose |
|---|---|---|
| `wasm-bindgen` | 0.2.121 | JS/WASM bridge |
| `serde` + `serde_json` | 1.0 | Serialization |
| `serde-wasm-bindgen` | 0.6.5 | Efficient Rust-to-JS value conversion |
| `swc_ecma_parser` | 39.0.2 | TypeScript / JS AST parsing |
| `swc_ecma_ast` | 23.0.0 | SWC AST node types |
| `swc_common` | 21.0.1 | SWC source map / span utilities |
| `sqlparser` | 0.62.0 | SQL DDL parsing |
| `graphql-parser` | 0.4.1 | GraphQL SDL parsing |
| `regex` | 1.12.3 | Format detection heuristics |

---

## Build

Requires [wasm-pack](https://rustwasm.github.io/wasm-pack/).

```bash
cargo install wasm-pack

wasm-pack build --target web --out-dir ../web/src/core_pkg
```

Output lands in `web/src/core_pkg/` as:
- `core_bg.wasm` - the compiled WebAssembly binary
- `core.js` - JS glue generated by wasm-bindgen
- `core.d.ts` - TypeScript type declarations

### Dev note

`wasm-opt` is disabled in `Cargo.toml` (`wasm-opt = false`) to avoid toolchain compatibility issues during development. Re-enable it for production builds if binary size matters.

---

## Tests

Unit tests live in `src/lib.rs` and cover all five parsers with real schema snippets.

```bash
cargo test
```

Tests verify node counts, edge counts, field extraction, and kind/format tagging for TypeScript, SQL, Prisma, GraphQL, and JSON Schema inputs.
