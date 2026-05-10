<div align="center">

<img src="../assets/logo.svg" width="48" alt="Skema logo"/>

# `web`

**React frontend for Skema**

[![React](https://img.shields.io/badge/React-19-61dafb?style=flat&logo=react)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8-646cff?style=flat&logo=vite)](https://vitejs.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6-3178c6?style=flat&logo=typescript)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/license-MIT-green?style=flat)](../LICENSE)

</div>

---

This package contains the entire Skema UI - the code editor, the interactive SVG canvas, the layout engine, and all user-facing interactions. It loads the WASM core (`core_pkg/`) built from `../core`, calls `parse_schema_wasm()` on every keystroke, and renders the result as a draggable entity-relationship diagram.

---

## Structure

```
web/
├── index.html
├── vite.config.ts
├── package.json
└── src/
    ├── main.tsx                  # React app bootstrap
    ├── App.tsx                   # Root: state, WASM init, tabs, export, share
    ├── types.ts                  # TypeScript types mirroring Rust schema
    ├── index.css                 # CSS custom properties, dark theme tokens
    ├── App.css                   # Top-level layout styles
    ├── components/
    │   ├── Canvas.tsx            # SVG canvas - pan, zoom, edge routing, drag
    │   ├── NodeCard.tsx          # Visual node card rendered inside the canvas
    │   ├── Editor.tsx            # CodeMirror v6 wrapper
    │   ├── MethodTree.tsx        # Collapsible explorer sidebar
    │   └── NodeDetailDrawer.tsx  # Right-side detail panel
    ├── editor/
    │   ├── languageFromFileName.ts    # Maps file extension to CodeMirror language
    │   └── skemaCodemirrorTheme.ts   # Custom dark editor theme
    ├── utils/
    │   └── layout.ts             # Force-directed physics layout engine
    └── core_pkg/                 # Generated WASM bindings (not committed)
```

---

## Components

### `App.tsx` - Root

Owns all application state and orchestrates every subsystem.

| Responsibility | Detail |
|---|---|
| WASM init | Calls `init()` from `core_pkg` on mount; blocks rendering until ready |
| File tabs | Multi-tab state with per-tab schema text and node positions |
| Parsing | Calls `parse_schema_wasm()` debounced on every editor change |
| Layout | Runs `autoLayout()` when new nodes appear; respects manually pinned positions |
| Persistence | Saves editor pane width, last schema, and node positions to `localStorage` |
| URL sharing | Encodes the current schema as base64 in the URL hash |
| Export menu | SVG, PNG (via `html-to-image`), and raw JSON downloads; shareable URL copy |
| Pane resizing | Drag-to-resize divider between editor and canvas, clamped to min/max |

### `Canvas.tsx` - SVG Renderer

Custom SVG-based interactive graph. No third-party graph library.

| Responsibility | Detail |
|---|---|
| Node rendering | Delegates to `NodeCard` for each `SchemaNode` |
| Edge routing | Computes anchor points on node boundaries; draws curved SVG paths |
| Pan / zoom | Pointer capture on background drag; wheel zoom around cursor point |
| Node drag | Pointer capture on card drag; pins node position on release |
| Selection | Click to select; focus mode dims unrelated nodes and edges |
| Search highlight | Matched nodes glow; non-matched nodes dim |
| Kind / rel filter | Hides nodes or edges not matching active filter chips |
| Edge tooltips | Hover label showing relationship kind |

### `NodeCard.tsx` - Node Card

Renders a single schema node as an SVG foreignObject card.

- Fixed 260px width, height scales with field count
- 4px colored left stripe per `NodeKind`
- Header with `displayName` and kind badge
- Field rows: name on the left, type on the right
- Alternating row backgrounds
- Selected / dimmed visual states with drop-shadow

### `Editor.tsx` - Code Editor

Thin wrapper around `@uiw/react-codemirror`.

- Syntax highlighting via CodeMirror language packs (JS/TS, SQL, JSON)
- Language auto-selected by `languageFromFileName` based on the active tab's filename
- Custom `skemaCodemirrorTheme` matching the app's dark palette
- Controlled component: value in, onChange out

### `MethodTree.tsx` - Explorer Sidebar

Collapsible sidebar listing all parsed nodes.

- Collapses to a 44px icon rail
- Icon per `NodeKind` (table, interface, class, enum, method, scalar)
- Methods nested under their parent class
- Click navigates canvas to that node
- Integrates with search and kind filter

### `NodeDetailDrawer.tsx` - Detail Panel

Slides in from the right when a node is selected.

- Full field list with name, type, and modifier badges (optional, array, readonly, nullable)
- Incoming edges section: what points to this node
- Outgoing edges section: what this node points to
- Clicking a linked node name navigates canvas to it

---

## Layout Engine (`utils/layout.ts`)

`autoLayout(nodes, edges)` runs in two phases:

**Phase 1 - Static placement**

Nodes are grouped into columns by `NodeKind` in this order: `table`, `interface`, `class`, `enum`, `scalar`, `method`. Within each column, nodes with more edges are placed higher. Methods are kept close to their parent class node.

**Phase 2 - Force simulation**

A spring-physics pass iterates over all node pairs:
- Repulsion: all nodes push each other apart (inverse-square)
- Attraction: connected nodes pull toward each other (spring)

The simulation runs for a fixed number of ticks on first load to settle the graph into a readable layout. Nodes the user has dragged are "pinned" and skipped during simulation.

---

## State Persistence

| Key | Storage | Contents |
|---|---|---|
| `skema_state` | `localStorage` | Per-tab schema text and node XY positions |
| `skema_editor_pane_width` | `localStorage` | Editor pane pixel width |
| `#` (URL hash) | URL | Base64-encoded schema for the share feature |

---

## Tech Stack

| | Package | Version | Purpose |
|---|---|---|---|
| <img src="https://api.iconify.design/simple-icons:react.svg?color=%2361dafb" width="14"/> | `react` | 19.2.5 | UI framework |
| <img src="https://api.iconify.design/simple-icons:vite.svg?color=%23646cff" width="14"/> | `vite` | 8.0.10 | Dev server and production bundler |
| <img src="https://api.iconify.design/simple-icons:typescript.svg?color=%233178c6" width="14"/> | `typescript` | 6.0.2 | Static typing |
| <img src="https://api.iconify.design/simple-icons:codemirror.svg?color=%235488C4" width="14"/> | `@uiw/react-codemirror` | 4.25.9 | Code editor |
| <img src="https://api.iconify.design/lucide:image.svg?color=%235488C4" width="14"/> | `html-to-image` | 1.11.13 | PNG / SVG canvas export |
| <img src="https://api.iconify.design/lucide:box.svg?color=%235488C4" width="14"/> | `lucide-react` | 1.14.0 | UI icons |
| <img src="https://api.iconify.design/lucide:cpu.svg?color=%235488C4" width="14"/> | `vite-plugin-wasm` | 3.6.0 | WASM module loading in Vite |

---

## Scripts

```bash
npm run dev       # Start Vite dev server at http://localhost:5173
npm run build     # Type-check + production bundle -> dist/
npm run preview   # Serve the production build locally
npm run lint      # Run ESLint
```

---

## Development

### Prerequisites

- **Node.js** v18+
- The WASM core must be built before the frontend can run. See [`../core/README.md`](../core/README.md).

### First run

```bash
# From the repo root - build core then start web
cd core && wasm-pack build --target web --out-dir ../web/src/core_pkg && cd ../web && npm install && npm run dev
```

### Iterating on the frontend only

If `core_pkg/` is already built, you only need:

```bash
cd web
npm run dev
```

### Rebuilding after core changes

```bash
cd core
wasm-pack build --target web --out-dir ../web/src/core_pkg
```

Vite's HMR will pick up the updated `core_pkg/` automatically on the next page load.

---

## Adding a new parser

1. Add the parser in `../core/src/parsers/` and wire it into `parsers/mod.rs`
2. Rebuild the WASM core
3. Add the new `FormatTag` value to `src/types.ts`
4. Add a language mapping in `src/editor/languageFromFileName.ts` if relevant
5. Add a heuristic to `detect_format()` in `../core/src/parsers/mod.rs`
