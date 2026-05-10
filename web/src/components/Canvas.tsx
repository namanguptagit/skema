import React, { useState, useRef } from 'react';
import { Search } from 'lucide-react';
import type { SchemaNode, SchemaEdge, NodeKind, RelationshipKind } from '../types';
import { NodeCard, NODE_GEOMETRY } from './NodeCard';

interface CanvasProps {
  nodes: SchemaNode[];
  edges: SchemaEdge[];
  selectedNodeId: string | null;
  onNodeMove: (nodeId: string, x: number, y: number) => void;
  onNodeClick: (nodeId: string | null) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  activeKinds: Set<NodeKind>;
  setActiveKinds: React.Dispatch<React.SetStateAction<Set<NodeKind>>>;
  activeEdges: Set<RelationshipKind>;
  setActiveEdges: React.Dispatch<React.SetStateAction<Set<RelationshipKind>>>;
}

interface Tooltip {
  x: number;
  y: number;
  kind: string;
  label?: string;
  source: string;
  target: string;
}

function nodeCardHeight(node: SchemaNode): number {
  const { headerHeight, rowHeight, paddingV } = NODE_GEOMETRY;
  return headerHeight + paddingV + node.fields.length * rowHeight + paddingV;
}

function getNodeBounds(node: SchemaNode) {
  const x = node.x ?? 0;
  const y = node.y ?? 0;
  const w = NODE_GEOMETRY.width;
  const h = nodeCardHeight(node);
  return { x, y, w, h, cx: x + w / 2, cy: y + h / 2 };
}

type EdgeGeometry = { sx: number; sy: number; tx: number; ty: number; d: string };

function getEdgeGeometry(src: SchemaNode, tgt: SchemaNode): EdgeGeometry {
  const a = getNodeBounds(src);
  const b = getNodeBounds(tgt);
  const dx = b.cx - a.cx;
  const dy = b.cy - a.cy;
  const { width: cardW, headerHeight } = NODE_GEOMETRY;

  const headerMidY = (n: SchemaNode) => (n.y ?? 0) + headerHeight / 2;

  let sx: number;
  let sy: number;
  let tx: number;
  let ty: number;

  if (Math.abs(dx) >= Math.abs(dy)) {
    if (dx >= 0) {
      sx = a.x + cardW;
      sy = headerMidY(src);
      tx = b.x;
      ty = headerMidY(tgt);
    } else {
      sx = a.x;
      sy = headerMidY(src);
      tx = b.x + cardW;
      ty = headerMidY(tgt);
    }
  } else if (dy >= 0) {
    sx = a.cx;
    sy = a.y + a.h;
    tx = b.cx;
    ty = b.y;
  } else {
    sx = a.cx;
    sy = a.y;
    tx = b.cx;
    ty = b.y + b.h;
  }

  const dist = Math.hypot(tx - sx, ty - sy);
  const off = Math.min(80, dist / 2);

  let c1x: number;
  let c1y: number;
  let c2x: number;
  let c2y: number;

  if (Math.abs(dx) >= Math.abs(dy)) {
    if (dx >= 0) {
      c1x = sx + off;
      c1y = sy;
      c2x = tx - off;
      c2y = ty;
    } else {
      c1x = sx - off;
      c1y = sy;
      c2x = tx + off;
      c2y = ty;
    }
  } else if (dy >= 0) {
    c1x = sx;
    c1y = sy + off;
    c2x = tx;
    c2y = ty - off;
  } else {
    c1x = sx;
    c1y = sy - off;
    c2x = tx;
    c2y = ty + off;
  }

  const d = `M ${sx} ${sy} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${tx} ${ty}`;
  return { sx, sy, tx, ty, d };
}

type EdgeStyleDef = {
  strokeWidth: number;
  strokeDasharray?: string;
  markerEnd: string | null;
  markerStart: string | null;
};

const EDGE_STYLE: Record<RelationshipKind, EdgeStyleDef> = {
  extends: { strokeWidth: 1.5, markerEnd: 'url(#marker-triangle-open)', markerStart: null },
  implements: { strokeWidth: 1.5, markerEnd: 'url(#marker-triangle-open)', markerStart: null },
  'foreign-key': {
    strokeWidth: 1.75,
    markerEnd: 'url(#marker-arrow)',
    markerStart: 'url(#marker-diamond-open)',
  },
  references: {
    strokeWidth: 1.35,
    strokeDasharray: '5 4',
    markerEnd: 'url(#marker-arrow)',
    markerStart: null,
  },
  'has-field': { strokeWidth: 1.25, markerEnd: 'url(#marker-arrow)', markerStart: null },
  returns: {
    strokeWidth: 1.25,
    strokeDasharray: '1 4',
    markerEnd: 'url(#marker-arrow)',
    markerStart: null,
  },
};

function edgeStrokeColor(kind: RelationshipKind): string {
  if (kind === 'extends' || kind === 'implements') return 'var(--edge-extends)';
  if (kind === 'foreign-key') return 'var(--edge-fk)';
  return 'var(--edge-reference)';
}

type PreparedEdge = {
  key: string;
  edge: SchemaEdge;
  geom: EdgeGeometry;
  strokeColor: string;
  style: EdgeStyleDef;
  dim: boolean;
  highlighted: boolean;
};

export const Canvas: React.FC<CanvasProps> = ({
  nodes, edges, selectedNodeId, onNodeMove, onNodeClick,
  searchQuery, setSearchQuery, activeKinds, setActiveKinds, activeEdges
}) => {
  const [viewBox, setViewBox] = useState({ x: -20, y: -20, w: 1400, h: 900 });
  const [isPanning, setIsPanning] = useState(false);
  const [dragNode, setDragNode] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const lastMousePos = useRef({ x: 0, y: 0 });
  const mouseDownPos = useRef({ x: 0, y: 0 });
  const didMove = useRef(false);
  // Remember which node mouseDown started on (for click detection in mouseUp)
  const mouseDownNodeId = useRef<string | null>(null);

  const svgScale = () => viewBox.w / (svgRef.current?.clientWidth || 1400);

  // Precompute which nodes are connected to selected
  const connectedIds = new Set<string>();
  if (selectedNodeId) {
    for (const e of edges) {
      if (e.sourceNodeId === selectedNodeId) connectedIds.add(e.targetNodeId);
      if (e.targetNodeId === selectedNodeId) connectedIds.add(e.sourceNodeId);
    }
  }

  const handleBgMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0 || e.button === 1) {
      setIsPanning(true);
      didMove.current = false;
      mouseDownPos.current = { x: e.clientX, y: e.clientY };
      lastMousePos.current = { x: e.clientX, y: e.clientY };
    }
  };

  const handleNodeMouseDown = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    setDragNode(nodeId);
    mouseDownNodeId.current = nodeId;
    didMove.current = false;
    mouseDownPos.current = { x: e.clientX, y: e.clientY };
    lastMousePos.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning && !dragNode) return;

    const totalDx = Math.abs(e.clientX - mouseDownPos.current.x);
    const totalDy = Math.abs(e.clientY - mouseDownPos.current.y);
    if (totalDx > 3 || totalDy > 3) {
      didMove.current = true;
    }

    const dx = e.clientX - lastMousePos.current.x;
    const dy = e.clientY - lastMousePos.current.y;
    lastMousePos.current = { x: e.clientX, y: e.clientY };

    if (dragNode) {
      const scale = svgScale();
      const node = nodes.find(n => n.id === dragNode);
      if (node) {
        onNodeMove(dragNode, (node.x || 0) + dx * scale, (node.y || 0) + dy * scale);
      }
    } else if (isPanning) {
      const scale = svgScale();
      setViewBox(prev => ({
        ...prev,
        x: prev.x - dx * scale,
        y: prev.y - dy * scale,
      }));
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    const wasDraggingNode = mouseDownNodeId.current;
    
    // Only process "clicks" if it's an actual mouseup, not a mouseleave
    if (e.type === 'mouseup' && !didMove.current) {
      if (wasDraggingNode) {
        // Click on a node → toggle selection
        onNodeClick(wasDraggingNode === selectedNodeId ? null : wasDraggingNode);
      } else {
        // Click on background → deselect
        onNodeClick(null);
      }
    }
    
    mouseDownNodeId.current = null;
    setIsPanning(false);
    setDragNode(null);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 1.12 : 0.88;
    setViewBox(prev => {
      const newW = Math.min(Math.max(prev.w * factor, 300), 6000);
      const newH = Math.min(Math.max(prev.h * factor, 200), 4000);
      return {
        x: prev.x - (newW - prev.w) / 2,
        y: prev.y - (newH - prev.h) / 2,
        w: newW,
        h: newH,
      };
    });
  };

  const handleEdgeMouseEnter = (e: React.MouseEvent, edge: SchemaEdge) => {
    const src = nodes.find(n => n.id === edge.sourceNodeId);
    const tgt = nodes.find(n => n.id === edge.targetNodeId);
    if (!src || !tgt) return;
    const rect = svgRef.current?.getBoundingClientRect();
    setTooltip({
      x: e.clientX - (rect?.left ?? 0),
      y: e.clientY - (rect?.top ?? 0),
      kind: edge.kind,
      label: edge.label,
      source: src.displayName,
      target: tgt.displayName,
    });
  };

  const handleEdgeMouseLeave = () => setTooltip(null);

  const preparedEdges: PreparedEdge[] = [];
  edges.forEach((edge, i) => {
    if (!activeEdges.has(edge.kind)) return;
    const src = nodes.find(n => n.id === edge.sourceNodeId);
    const tgt = nodes.find(n => n.id === edge.targetNodeId);
    if (!src || !tgt) return;
    if (!activeKinds.has(src.kind) || !activeKinds.has(tgt.kind)) return;

    const touchesSelection =
      selectedNodeId !== null &&
      (edge.sourceNodeId === selectedNodeId || edge.targetNodeId === selectedNodeId);
    const isConnectedToSelected =
      !selectedNodeId ||
      edge.sourceNodeId === selectedNodeId ||
      edge.targetNodeId === selectedNodeId;
    const dim = selectedNodeId !== null && !isConnectedToSelected;

    preparedEdges.push({
      key: `edge-${edge.sourceNodeId}-${edge.targetNodeId}-${edge.kind}-${i}`,
      edge,
      geom: getEdgeGeometry(src, tgt),
      strokeColor: edgeStrokeColor(edge.kind),
      style: EDGE_STYLE[edge.kind],
      dim,
      highlighted: touchesSelection,
    });
  });

  const backEdges = preparedEdges.filter(e => !e.highlighted);
  const frontEdges = preparedEdges.filter(e => e.highlighted);

  const renderPreparedEdge = (pe: PreparedEdge) => {
    const { edge, geom, strokeColor, style, dim, highlighted } = pe;
    const { sx, sy, tx, ty, d } = geom;
    const baseW = style.strokeWidth;
    const strokeW = highlighted ? baseW + 0.5 : baseW;
    const strokeOpacity = dim ? 0.14 : highlighted ? 0.95 : 0.55;
    const dotR = dim ? 2.5 : highlighted ? 4 : 3;
    const showLabel = Boolean(edge.label) && !dim && viewBox.w < 2800;
    const label = edge.label ?? '';
    const pillW = label.length * 5.5 + 10;
    const pillH = 16;
    const mx = (sx + tx) / 2;
    const my = (sy + ty) / 2 - 8;

    return (
      <g key={pe.key}>
        <path
          d={d}
          stroke="transparent"
          strokeWidth={14}
          fill="none"
          style={{ cursor: 'crosshair' }}
          onMouseEnter={e => handleEdgeMouseEnter(e, edge)}
          onMouseLeave={handleEdgeMouseLeave}
        />
        <path
          d={d}
          stroke={strokeColor}
          strokeWidth={strokeW}
          strokeOpacity={strokeOpacity}
          strokeDasharray={style.strokeDasharray}
          strokeLinecap="round"
          fill="none"
          markerEnd={style.markerEnd ?? undefined}
          markerStart={style.markerStart ?? undefined}
          filter={highlighted ? 'url(#edge-glow)' : undefined}
          style={{
            pointerEvents: 'none',
            transition: 'stroke-opacity 150ms ease, stroke-width 150ms ease',
          }}
        />
        <circle
          cx={sx}
          cy={sy}
          r={dotR}
          fill={strokeColor}
          fillOpacity={strokeOpacity}
          style={{ pointerEvents: 'none', transition: 'r 150ms ease, fill-opacity 150ms ease' }}
        />
        <circle
          cx={tx}
          cy={ty}
          r={dotR}
          fill={strokeColor}
          fillOpacity={strokeOpacity}
          style={{ pointerEvents: 'none', transition: 'r 150ms ease, fill-opacity 150ms ease' }}
        />
        {showLabel && (
          <g style={{ pointerEvents: 'none' }}>
            <rect
              x={mx - pillW / 2}
              y={my - pillH / 2}
              width={pillW}
              height={pillH}
              rx={4}
              fill="var(--bg-panel)"
              stroke="var(--section-divider)"
              strokeWidth={1}
            />
            <text
              x={mx}
              y={my + 4}
              fill={strokeColor}
              fontSize={9}
              textAnchor="middle"
              fontWeight={600}
              style={{ userSelect: 'none', fontFamily: 'var(--font-mono)' }}
            >
              {label}
            </text>
          </g>
        )}
      </g>
    );
  };

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
      <svg
        ref={svgRef}
        style={{ width: '100%', height: '100%', cursor: dragNode ? 'grabbing' : 'default' }}
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
        onMouseDown={handleBgMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        <defs>
          <pattern id="dots" width="30" height="30" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="1" fill="rgba(255,255,255,0.04)" />
          </pattern>
          <filter id="edge-glow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="1.25" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <marker
            id="marker-arrow"
            markerUnits="userSpaceOnUse"
            markerWidth="10"
            markerHeight="7"
            refX="9"
            refY="3.5"
            orient="auto"
            overflow="visible"
          >
            <path d="M 0 0 L 10 3.5 L 0 7 Z" fill="context-stroke" />
          </marker>
          <marker
            id="marker-triangle-open"
            markerUnits="userSpaceOnUse"
            markerWidth="11"
            markerHeight="8"
            refX="9.5"
            refY="4"
            orient="auto"
            overflow="visible"
          >
            <path
              d="M 0 0 L 9.5 4 L 0 8"
              fill="none"
              stroke="context-stroke"
              strokeWidth={1.35}
              strokeLinejoin="miter"
            />
          </marker>
          <marker
            id="marker-diamond-open"
            markerUnits="userSpaceOnUse"
            markerWidth="12"
            markerHeight="12"
            refX="12"
            refY="6"
            orient="auto"
            overflow="visible"
          >
            <path
              d="M 6 0 L 12 6 L 6 12 L 0 6 Z"
              fill="none"
              stroke="context-stroke"
              strokeWidth={1.2}
              strokeLinejoin="miter"
            />
          </marker>
        </defs>

        {/* Background dot grid */}
        <rect
          x={viewBox.x - 5000} y={viewBox.y - 5000}
          width={viewBox.w + 10000} height={viewBox.h + 10000}
          fill="url(#dots)"
        />

        {/* Edges: dim + normal first, then highlighted on top */}
        <g className="skema-edges-back">{backEdges.map(renderPreparedEdge)}</g>
        <g className="skema-edges-front">{frontEdges.map(renderPreparedEdge)}</g>

        {/* Nodes */}
        {nodes.map(node => {
          if (!activeKinds.has(node.kind)) return null;

          const isSelected = node.id === selectedNodeId;
          
          let matchesSearch = true;
          if (searchQuery) {
            const q = searchQuery.toLowerCase();
            matchesSearch = node.displayName.toLowerCase().includes(q) || 
                            node.fields.some(f => f.name.toLowerCase().includes(q) || f.ty.toLowerCase().includes(q));
          }

          const dimmed = !matchesSearch || (selectedNodeId !== null && !isSelected && !connectedIds.has(node.id));
          return (
            <NodeCard
              key={node.id}
              node={node}
              isSelected={isSelected}
              dimmed={dimmed}
              onMouseDown={handleNodeMouseDown}
            />
          );
        })}
      </svg>

      {/* Edge Tooltip */}
      {tooltip && (
        <div style={{
          position: 'absolute',
          left: tooltip.x + 16,
          top: tooltip.y - 16,
          padding: '8px 16px',
          pointerEvents: 'none',
          zIndex: 200,
          minWidth: '140px',
          borderRadius: 'var(--radius-workspace)',
          border: '1px solid var(--section-divider)',
          background: 'var(--bg-panel)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
        }}>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>
            {tooltip.kind}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-main)', fontWeight: 600 }}>
            {tooltip.source} → {tooltip.target}
          </div>
          {tooltip.label && (
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
              via {tooltip.label}
            </div>
          )}
        </div>
      )}

      {/* Zoom Controls */}
      <div style={{
        position: 'absolute', bottom: '24px', right: '24px',
        display: 'flex', flexDirection: 'column', gap: '4px',
        padding: '6px',
        borderRadius: 'var(--radius-workspace)',
        border: '1px solid var(--section-divider)',
        background: 'var(--bg-panel)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
        zIndex: 50,
      }}>
        {[
          { label: '+', fn: () => setViewBox(p => ({ ...p, w: p.w * 0.8, h: p.h * 0.8 })) },
          { label: '⊙', fn: () => setViewBox({ x: -20, y: -20, w: 1400, h: 900 }) },
          { label: '−', fn: () => setViewBox(p => ({ ...p, w: p.w * 1.25, h: p.h * 1.25 })) },
        ].map(({ label, fn }) => (
          <button
            key={label}
            type="button"
            onClick={fn}
            style={{
              width: '36px', height: '36px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'transparent', border: 'none', borderRadius: 'var(--radius-workspace)',
              color: 'var(--text-muted)', fontSize: '18px', cursor: 'pointer', fontWeight: 500,
              transition: 'background 150ms ease, color 150ms ease'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
              e.currentTarget.style.color = 'var(--text-main)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'var(--text-muted)';
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Top Toolbar */}
      <div style={{
        position: 'absolute', top: '20px', left: '50%', transform: 'translateX(-50%)',
        display: 'flex', gap: '8px', zIndex: 50, pointerEvents: 'none'
      }}>
        {/* Search */}
        <div className="glass" style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '8px 16px',
          borderRadius: 'var(--radius-workspace)',
          pointerEvents: 'auto',
          border: '1px solid var(--section-divider)',
        }}>
          <Search size={16} strokeWidth={2} color="var(--text-muted)" aria-hidden />
          <input 
            type="text" 
            placeholder="Search nodes, fields, types..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              background: 'transparent', border: 'none', outline: 'none',
              color: 'var(--text-main)', fontSize: '13px', width: '220px',
              fontWeight: 500
            }}
          />
        </div>

        {/* Kinds Filter Toggle */}
        <div className="glass" style={{
          display: 'flex', alignItems: 'center', gap: '4px',
          padding: '6px 8px',
          borderRadius: 'var(--radius-workspace)',
          pointerEvents: 'auto',
          border: '1px solid var(--section-divider)',
        }}>
          {['interface', 'enum', 'class', 'table'].map(kind => {
            const isActive = activeKinds.has(kind as NodeKind);
            return (
              <button
                key={kind}
                onClick={() => {
                  const next = new Set(activeKinds);
                  if (isActive) next.delete(kind as NodeKind);
                  else next.add(kind as NodeKind);
                  setActiveKinds(next);
                }}
                style={{
                  padding: '6px 12px', borderRadius: 'var(--radius-workspace)', border: 'none',
                  background: isActive ? 'rgba(255,255,255,0.1)' : 'transparent',
                  color: isActive ? 'var(--text-main)' : 'var(--text-muted)',
                  fontSize: '11px', fontWeight: 600, cursor: 'pointer',
                  textTransform: 'uppercase', letterSpacing: '0.5px',
                  transition: 'all 0.2s'
                }}
              >
                {kind}
              </button>
            )
          })}
        </div>
      </div>

      {/* Empty State */}
      {nodes.length === 0 && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none',
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.2 }}>⬡</div>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', fontWeight: 600, margin: 0 }}>
            Paste a schema in the editor to visualize it
          </p>
        </div>
      )}
    </div>
  );
};
