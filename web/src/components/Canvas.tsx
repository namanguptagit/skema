import React, { useState, useRef } from 'react';
import { Search } from 'lucide-react';
import type { SchemaNode, SchemaEdge, NodeKind, RelationshipKind } from '../types';
import { NodeCard } from './NodeCard';

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
          <marker id="arrow-ref" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill="var(--edge-reference)" fillOpacity="0.85" />
          </marker>
          <marker id="arrow-ext" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill="var(--edge-extends)" fillOpacity="0.85" />
          </marker>
          <marker id="arrow-fk" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill="var(--edge-fk)" fillOpacity="0.85" />
          </marker>
          <marker id="arrow-ref-dim" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill="var(--edge-reference)" fillOpacity="0.15" />
          </marker>
          <marker id="arrow-ext-dim" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill="var(--edge-extends)" fillOpacity="0.15" />
          </marker>
          <marker id="arrow-fk-dim" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill="var(--edge-fk)" fillOpacity="0.15" />
          </marker>
        </defs>

        {/* Background dot grid */}
        <rect
          x={viewBox.x - 5000} y={viewBox.y - 5000}
          width={viewBox.w + 10000} height={viewBox.h + 10000}
          fill="url(#dots)"
        />

        {/* Edges */}
        {edges.map((edge, i) => {
          if (!activeEdges.has(edge.kind)) return null;

          const src = nodes.find(n => n.id === edge.sourceNodeId);
          const tgt = nodes.find(n => n.id === edge.targetNodeId);
          if (!src || !tgt) return null;
          
          // Only draw the edge if BOTH connected nodes are currently visible
          if (!activeKinds.has(src.kind) || !activeKinds.has(tgt.kind)) return null;

          const nodeWidth = 240;
          const nodeHeaderH = 38;
          const sx = (src.x || 0) + nodeWidth;
          const sy = (src.y || 0) + nodeHeaderH / 2;
          const tx = (tgt.x || 0);
          const ty = (tgt.y || 0) + nodeHeaderH / 2;
          const cx = (sx + tx) / 2;

          const isConnectedToSelected = !selectedNodeId
            || edge.sourceNodeId === selectedNodeId
            || edge.targetNodeId === selectedNodeId;

          const dim = selectedNodeId !== null && !isConnectedToSelected;

          const strokeColor = edge.kind === 'extends' || edge.kind === 'implements'
            ? 'var(--edge-extends)' : edge.kind === 'foreign-key' ? 'var(--edge-fk)' : 'var(--edge-reference)';

          const markerSuffix = dim ? '-dim' : '';
          const markerBase = edge.kind === 'extends' || edge.kind === 'implements'
            ? 'arrow-ext' : edge.kind === 'foreign-key' ? 'arrow-fk' : 'arrow-ref';

          return (
            <g key={`edge-${i}`}>
              {/* Wider invisible path for easier hover */}
              <path
                d={`M ${sx} ${sy} C ${cx + 30} ${sy}, ${cx - 30} ${ty}, ${tx} ${ty}`}
                stroke="transparent"
                strokeWidth="12"
                fill="none"
                style={{ cursor: 'crosshair' }}
                onMouseEnter={e => handleEdgeMouseEnter(e, edge)}
                onMouseLeave={handleEdgeMouseLeave}
              />
              <path
                d={`M ${sx} ${sy} C ${cx + 30} ${sy}, ${cx - 30} ${ty}, ${tx} ${ty}`}
                stroke={strokeColor}
                strokeWidth={dim ? 1 : 1.5}
                strokeOpacity={dim ? 0.08 : 0.55}
                fill="none"
                markerEnd={`url(#${markerBase}${markerSuffix})`}
                strokeDasharray={edge.kind === 'references' ? '6 3' : undefined}
                style={{ pointerEvents: 'none' }}
              />
              {edge.label && !dim && (
                <text
                  x={(sx + tx) / 2}
                  y={(sy + ty) / 2 - 6}
                  fill={strokeColor}
                  fontSize="9"
                  textAnchor="middle"
                  opacity="0.7"
                  style={{ userSelect: 'none' }}
                >
                  {edge.label}
                </text>
              )}
            </g>
          );
        })}

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
        <div className="glass" style={{
          position: 'absolute',
          left: tooltip.x + 16,
          top: tooltip.y - 16,
          padding: '8px 16px',
          pointerEvents: 'none',
          zIndex: 200,
          minWidth: '140px',
          borderRadius: 'var(--radius-workspace-lg)',
          border: '1px solid var(--section-divider)',
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
      <div className="glass" style={{
        position: 'absolute', bottom: '24px', right: '24px',
        display: 'flex', flexDirection: 'column', gap: '8px',
        padding: '8px',
        borderRadius: 'var(--radius-workspace-lg)',
        border: '1px solid var(--section-divider)',
      }}>
        {[
          { label: '+', fn: () => setViewBox(p => ({ ...p, w: p.w * 0.8, h: p.h * 0.8 })) },
          { label: '⊙', fn: () => setViewBox({ x: -20, y: -20, w: 1400, h: 900 }) },
          { label: '−', fn: () => setViewBox(p => ({ ...p, w: p.w * 1.25, h: p.h * 1.25 })) },
        ].map(({ label, fn }) => (
          <button
            key={label}
            onClick={fn}
            style={{
              width: '36px', height: '36px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'transparent', border: 'none', borderRadius: '50%',
              color: 'var(--text-muted)', fontSize: '18px', cursor: 'pointer', fontWeight: 500,
              transition: 'all 0.2s'
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
          borderRadius: '999px',
          pointerEvents: 'auto',
          border: '1px solid var(--section-divider)',
        }}>
          <Search size={14} color="var(--text-muted)" />
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
          borderRadius: '999px',
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
                  padding: '6px 12px', borderRadius: '16px', border: 'none',
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
