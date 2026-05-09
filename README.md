# Skema

Skema is a blazing-fast, language-agnostic schema visualizer built with Rust, WebAssembly, and React. It takes raw code (TypeScript, SQL, Prisma, GraphQL, etc.) and instantly renders it as an interactive, draggable entity-relationship diagram.

## Features

- **Live Parsing**: Write code on the left, see the diagram update on the right instantly.
- **WASM-Powered Core**: The parsing engine is built in Rust using industry-standard crates (`swc`, `sqlparser`) and compiled to WebAssembly for native browser speeds.
- **Interactive Canvas**: Pan, zoom, and drag nodes. Positions are saved automatically to `localStorage` so you never lose your layout.
- **Smart Auto-Layout**: Combines deterministic kind-based grouping with a force-directed spring physics simulation.
- **Multi-Language Support**:
  - **TypeScript**: Full AST parsing via SWC. Supports interfaces, classes, enums, optional fields, arrays, and complex references.
  - **SQL**: DDL parsing for tables and foreign keys.
  - **Prisma**: Extracts models and enums.
  - **GraphQL**: Parses SDL types, interfaces, and enums.
  - **JSON Schema / OpenAPI**: Extracts objects and `$ref` relations.

## Tech Stack

- **Core**: Rust + WebAssembly (`wasm-bindgen`, `wasm-pack`)
- **Frontend**: React + Vite + TypeScript
- **Styling**: Vanilla CSS with modern glassmorphism UI

## Getting Started

### Prerequisites
- Node.js (v18+)
- Rust (stable)
- `wasm-pack` (`cargo install wasm-pack`)

### Installation & Running

1. **Build the WASM Core**
   ```bash
   cd core
   wasm-pack build --target web --out-dir ../web/src/core_pkg
   ```

2. **Run the Frontend**
   ```bash
   cd web
   npm install
   npm run dev
   ```

3. Open `http://localhost:5173` in your browser.

## Architecture

- `core/`: The Rust library containing the `ParsedSchema` types, the language-specific parser implementations, and the `wasm-bindgen` bridge.
- `web/`: The Vite/React frontend.
  - `App.tsx`: Manages state and WASM initialization.
  - `components/Canvas.tsx`: The custom SVG-based interactive renderer.
  - `utils/layout.ts`: The force-directed graph physics engine.

## License
MIT
