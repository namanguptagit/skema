import React from 'react';
import type { SchemaNode, SchemaEdge } from '../types';
import { X, ArrowRight, ArrowLeft } from 'lucide-react';

interface NodeDetailDrawerProps {
  node: SchemaNode;
  edges: SchemaEdge[];
  allNodes: SchemaNode[];
  onClose: () => void;
  onNavigate: (nodeId: string) => void;
}

const KIND_COLOR: Record<string, string> = {
  interface: '#3b82f6',
  enum:      '#a855f7',
  class:     '#10b981',
  table:     '#34d399',
  method:    '#818cf8',
  scalar:    '#78716c',
};

const MODIFIER_BADGE: Record<string, { label: string; color: string }> = {
  optional: { label: '?',        color: '#94a3b8' },
  array:    { label: '[ ]',      color: '#60a5fa' },
  nullable: { label: 'nullable', color: '#fbbf24' },
  readonly: { label: 'readonly', color: '#a78bfa' },
};

export const NodeDetailDrawer: React.FC<NodeDetailDrawerProps> = ({
  node, edges, allNodes, onClose, onNavigate,
}) => {
  const color = KIND_COLOR[node.kind] ?? '#3b82f6';

  const outgoing = edges.filter(e => e.sourceNodeId === node.id);
  const incoming = edges.filter(e => e.targetNodeId === node.id);

  const nodeById = (id: string) => allNodes.find(n => n.id === id);

  return (
    <div
      style={{
        position: 'absolute',
        top: 0, right: 0, bottom: 0,
        width: '320px',
        background: 'rgba(10, 16, 30, 0.97)',
        borderLeft: `1px solid ${color}40`,
        display: 'flex',
        flexDirection: 'column',
        zIndex: 100,
        backdropFilter: 'blur(16px)',
        animation: 'slideIn 0.18s ease-out',
      }}
    >
      <style>{`
        @keyframes slideIn {
          from { transform: translateX(40px); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>

      {/* Header */}
      <div style={{
        padding: '20px 20px 16px',
        borderBottom: `1px solid ${color}30`,
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px',
      }}>
        <div>
          <div style={{
            display: 'inline-block',
            padding: '2px 10px', borderRadius: '20px',
            background: `${color}20`, border: `1px solid ${color}40`,
            fontSize: '10px', fontWeight: 700, color, letterSpacing: '1px',
            textTransform: 'uppercase', marginBottom: '8px',
          }}>
            {node.kind}
          </div>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: 'white', letterSpacing: '-0.3px' }}>
            {node.displayName}
          </h2>
          <div style={{ fontSize: '11px', color: '#475569', marginTop: '4px' }}>
            {node.format} · {node.fields.length} field{node.fields.length !== 1 ? 's' : ''}
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            padding: '6px', borderRadius: '6px', border: 'none',
            background: 'rgba(255,255,255,0.05)', cursor: 'pointer', color: '#64748b',
            flexShrink: 0,
          }}
        >
          <X size={16} />
        </button>
      </div>

      {/* Scrollable body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '24px' }}>

        {/* Fields */}
        {node.fields.length > 0 && (
          <section>
            <h3 style={{ margin: '0 0 10px', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '1.5px' }}>
              Fields
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {node.fields.map(field => (
                <div key={field.name} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 12px', borderRadius: '8px',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.04)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{
                      fontFamily: 'JetBrains Mono, Fira Code, monospace',
                      fontSize: '13px',
                      color: field.modifiers?.includes('optional') ? '#94a3b8' : '#cbd5e1',
                    }}>
                      {field.name}{field.modifiers?.includes('optional') ? '?' : ''}
                    </span>
                    {field.modifiers?.filter(m => m !== 'optional').map(mod => (
                      <span key={mod} style={{
                        fontSize: '9px', fontWeight: 700, padding: '1px 5px', borderRadius: '4px',
                        background: `${MODIFIER_BADGE[mod]?.color ?? '#64748b'}20`,
                        color: MODIFIER_BADGE[mod]?.color ?? '#64748b',
                        border: `1px solid ${MODIFIER_BADGE[mod]?.color ?? '#64748b'}30`,
                      }}>
                        {MODIFIER_BADGE[mod]?.label ?? mod}
                      </span>
                    ))}
                  </div>
                  {node.kind !== 'enum' && (
                    <span style={{
                      fontFamily: 'JetBrains Mono, Fira Code, monospace',
                      fontSize: '12px', color,
                    }}>
                      {field.ty}{field.modifiers?.includes('array') ? '[]' : ''}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Outgoing edges */}
        {outgoing.length > 0 && (
          <section>
            <h3 style={{ margin: '0 0 10px', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '1.5px' }}>
              References
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {outgoing.map((edge, i) => {
                const target = nodeById(edge.targetNodeId);
                if (!target) return null;
                const tc = KIND_COLOR[target.kind] ?? '#3b82f6';
                return (
                  <button key={i} onClick={() => onNavigate(target.id)} style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '8px 12px', borderRadius: '8px',
                    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
                    cursor: 'pointer', textAlign: 'left', width: '100%',
                  }}>
                    <ArrowRight size={12} color="#475569" style={{ flexShrink: 0 }} />
                    <span style={{ fontSize: '11px', color: '#64748b', flexShrink: 0 }}>
                      {edge.kind}{edge.label ? ` · ${edge.label}` : ''}
                    </span>
                    <span style={{ fontWeight: 700, fontSize: '13px', color: tc, marginLeft: 'auto' }}>
                      {target.displayName}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* Incoming edges */}
        {incoming.length > 0 && (
          <section>
            <h3 style={{ margin: '0 0 10px', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '1.5px' }}>
              Referenced by
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {incoming.map((edge, i) => {
                const src = nodeById(edge.sourceNodeId);
                if (!src) return null;
                const sc = KIND_COLOR[src.kind] ?? '#3b82f6';
                return (
                  <button key={i} onClick={() => onNavigate(src.id)} style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '8px 12px', borderRadius: '8px',
                    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
                    cursor: 'pointer', textAlign: 'left', width: '100%',
                  }}>
                    <ArrowLeft size={12} color="#475569" style={{ flexShrink: 0 }} />
                    <span style={{ fontWeight: 700, fontSize: '13px', color: sc }}>
                      {src.displayName}
                    </span>
                    <span style={{ fontSize: '11px', color: '#64748b', marginLeft: 'auto' }}>
                      {edge.kind}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

      </div>
    </div>
  );
};
