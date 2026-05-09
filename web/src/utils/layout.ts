import type { SchemaNode, SchemaEdge } from '../types';

// ─── Step 13: Smart Static Auto-Layout ───────────────────────────────────────
//
// Groups nodes by kind into vertical columns, then positions them with
// consistent spacing. Connected nodes in the same group are kept adjacent.

const KIND_COLUMN: Record<string, number> = {
  scalar:    0,
  table:     1,
  enum:      2,
  interface: 3,
  class:     4,
  method:    5,
};

const CARD_W   = 250;
const CARD_H   = 200; // approximate average card height
const COL_GAP  = 120;
const ROW_GAP  = 60;

export function computeInitialLayout(
  nodes: SchemaNode[],
  edges: SchemaEdge[],
): SchemaNode[] {
  // Group nodes by column index
  const columns: Map<number, SchemaNode[]> = new Map();
  for (const node of nodes) {
    const col = KIND_COLUMN[node.kind] ?? 3;
    if (!columns.has(col)) columns.set(col, []);
    columns.get(col)!.push(node);
  }

  // Sort method nodes: keep them close to their parent class
  const parentOf: Map<string, string> = new Map();
  for (const edge of edges) {
    if (edge.kind === 'has-field') {
      parentOf.set(edge.targetNodeId, edge.sourceNodeId);
    }
  }

  // Within each column, sort methods by parent class order
  const methodCol = columns.get(KIND_COLUMN.method);
  if (methodCol) {
    const classOrder: Map<string, number> = new Map();
    (columns.get(KIND_COLUMN.class) ?? []).forEach((n, i) => classOrder.set(n.id, i));
    methodCol.sort((a, b) => {
      const pa = classOrder.get(parentOf.get(a.id) ?? '') ?? 999;
      const pb = classOrder.get(parentOf.get(b.id) ?? '') ?? 999;
      return pa - pb;
    });
  }

  // Sort each other column by connectivity (most connected nodes first)
  const degree: Map<string, number> = new Map();
  for (const e of edges) {
    degree.set(e.sourceNodeId, (degree.get(e.sourceNodeId) ?? 0) + 1);
    degree.set(e.targetNodeId, (degree.get(e.targetNodeId) ?? 0) + 1);
  }
  for (const [col, group] of columns) {
    if (col === KIND_COLUMN.method) continue; // already sorted
    group.sort((a, b) => (degree.get(b.id) ?? 0) - (degree.get(a.id) ?? 0));
  }

  // Determine column X positions
  const sortedCols = Array.from(columns.keys()).sort((a, b) => a - b);
  const colX: Map<number, number> = new Map();
  let x = 40;
  for (const col of sortedCols) {
    colX.set(col, x);
    x += CARD_W + COL_GAP;
  }

  // Assign positions
  const positioned: SchemaNode[] = [];
  for (const col of sortedCols) {
    const group = columns.get(col)!;
    const cx = colX.get(col)!;
    // vertically center the column
    const totalH = group.length * CARD_H + (group.length - 1) * ROW_GAP;
    let y = Math.max(40, 400 - totalH / 2);
    for (const node of group) {
      positioned.push({ ...node, x: cx, y });
      y += CARD_H + ROW_GAP;
    }
  }

  return positioned;
}


// ─── Step 14: Force-Directed Layout ──────────────────────────────────────────
//
// A simple Verlet integration spring simulation.
// Connected nodes attract, all nodes repel each other.
// Pinned nodes are not moved by the simulation.

interface ForceNode {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  pinned: boolean;
}

interface SimConfig {
  repulsion: number;    // strength of node-node repulsion
  springLength: number; // natural length of an edge spring
  springK: number;      // spring stiffness
  damping: number;      // velocity damping per tick
  ticks: number;        // total ticks to simulate on settle
}

const DEFAULT_CONFIG: SimConfig = {
  repulsion:    28000,
  springLength: 360,
  springK:      0.04,
  damping:      0.82,
  ticks:        200,
};

export function runForceLayout(
  nodes: SchemaNode[],
  edges: SchemaEdge[],
  pinnedIds: Set<string> = new Set(),
  config: Partial<SimConfig> = {},
): SchemaNode[] {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  // Build mutable force-node array
  const fNodes: ForceNode[] = nodes.map(n => ({
    id: n.id,
    x: n.x ?? 0,
    y: n.y ?? 0,
    vx: 0,
    vy: 0,
    pinned: pinnedIds.has(n.id),
  }));

  const idx: Map<string, number> = new Map(fNodes.map((n, i) => [n.id, i]));

  // Run simulation ticks
  for (let t = 0; t < cfg.ticks; t++) {
    // Cooling factor: simulation gradually settles
    const alpha = 1 - t / cfg.ticks;

    // Reset forces
    const fx = new Float64Array(fNodes.length);
    const fy = new Float64Array(fNodes.length);

    // ── Repulsion: every pair of nodes pushes away ──
    for (let i = 0; i < fNodes.length; i++) {
      for (let j = i + 1; j < fNodes.length; j++) {
        const dx = fNodes[j].x - fNodes[i].x || 0.01;
        const dy = fNodes[j].y - fNodes[i].y || 0.01;
        const dist2 = dx * dx + dy * dy;
        const dist  = Math.sqrt(dist2);
        const force = (cfg.repulsion / dist2) * alpha;
        const fdx   = (dx / dist) * force;
        const fdy   = (dy / dist) * force;
        fx[i] -= fdx;  fy[i] -= fdy;
        fx[j] += fdx;  fy[j] += fdy;
      }
    }

    // ── Attraction: edges act as springs ──
    for (const edge of edges) {
      const si = idx.get(edge.sourceNodeId);
      const ti = idx.get(edge.targetNodeId);
      if (si === undefined || ti === undefined) continue;

      const dx    = fNodes[ti].x - fNodes[si].x;
      const dy    = fNodes[ti].y - fNodes[si].y;
      const dist  = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
      const force = cfg.springK * (dist - cfg.springLength) * alpha;
      const fdx   = (dx / dist) * force;
      const fdy   = (dy / dist) * force;
      fx[si] += fdx;  fy[si] += fdy;
      fx[ti] -= fdx;  fy[ti] -= fdy;
    }

    // ── Integrate ──
    for (let i = 0; i < fNodes.length; i++) {
      if (fNodes[i].pinned) continue;
      fNodes[i].vx = (fNodes[i].vx + fx[i]) * cfg.damping;
      fNodes[i].vy = (fNodes[i].vy + fy[i]) * cfg.damping;
      fNodes[i].x += fNodes[i].vx;
      fNodes[i].y += fNodes[i].vy;
    }
  }

  // Map back to SchemaNodes
  return nodes.map(n => {
    const fn = fNodes[idx.get(n.id)!];
    return { ...n, x: fn.x, y: fn.y };
  });
}


// ─── Combined: static layout → force settle ──────────────────────────────────

export function autoLayout(
  nodes: SchemaNode[],
  edges: SchemaEdge[],
  pinnedIds: Set<string> = new Set(),
): SchemaNode[] {
  if (nodes.length === 0) return nodes;

  // Step 13: place nodes in kind-grouped columns
  const placed = computeInitialLayout(nodes, edges);

  // Step 14: run force physics to pull connected nodes closer
  const settled = runForceLayout(placed, edges, pinnedIds);

  // Normalize to top-left so graph always starts near (40, 40)
  const minX = Math.min(...settled.map(n => n.x ?? 0));
  const minY = Math.min(...settled.map(n => n.y ?? 0));
  return settled.map(n => ({ ...n, x: (n.x ?? 0) - minX + 40, y: (n.y ?? 0) - minY + 40 }));
}
