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
  interface: 'var(--accent-gold)',
  enum:      'var(--accent-amber)',
  class:     'var(--accent-copper)',
  table:     'var(--accent-rust)',
  method:    'var(--accent-earth)',
  scalar:    'var(--accent-sand)',
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
        position: 'relative',
        height: '100%',
        margin: '16px 16px 16px 0',
        background: 'rgba(5, 5, 5, 0.5)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid var(--border-stark)',
        borderRadius: '16px',
        boxShadow: '0 12px 48px rgba(0,0,0,0.5)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 100,
        animation: 'slideIn 0.18s ease-out',
        fontFamily: 'var(--font-mono)'
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
        padding: '24px 20px 16px',
        borderBottom: `1px solid var(--border-stark)`,
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px',
      }}>
        <div>
          <div style={{
            display: 'inline-block',
            padding: '4px 10px', borderRadius: '12px',
            background: `${color}20`, border: `1px solid ${color}40`,
            fontSize: '10px', fontWeight: 600, color: color, letterSpacing: '0.5px',
            textTransform: 'uppercase', marginBottom: '8px',
          }}>
            {node.kind}
          </div>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 600, color: 'var(--text-main)', letterSpacing: '-0.5px', fontFamily: 'var(--font-display)' }}>
            {node.displayName}
          </h2>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px', fontWeight: 500 }}>
            {node.format} • {node.fields.length} field{node.fields.length !== 1 ? 's' : ''}
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            padding: '6px', borderRadius: '50%', border: 'none',
            background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)',
            flexShrink: 0, transition: 'all 0.2s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = 'var(--text-main)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
        >
          <X size={18} />
        </button>
      </div>

      {/* Scrollable body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '24px' }}>

        {/* Fields */}
        {node.fields.length > 0 && (
          <section>
            <h3 style={{ margin: '0 0 12px', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>
              Fields
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {node.fields.map(field => (
                <div key={field.name} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 12px', borderRadius: '8px',
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.05)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{
                      fontSize: '13px', fontWeight: 500,
                      color: field.modifiers?.includes('optional') ? 'var(--text-muted)' : 'var(--text-main)',
                    }}>
                      {field.name}{field.modifiers?.includes('optional') ? '?' : ''}
                    </span>
                    {field.modifiers?.filter(m => m !== 'optional').map(mod => (
                      <span key={mod} style={{
                        fontSize: '9px', fontWeight: 600, padding: '2px 6px', borderRadius: '12px',
                        background: `${MODIFIER_BADGE[mod]?.color ?? '#64748b'}20`,
                        color: MODIFIER_BADGE[mod]?.color ?? '#64748b', textTransform: 'uppercase',
                        border: `1px solid ${MODIFIER_BADGE[mod]?.color ?? '#64748b'}40`,
                      }}>
                        {MODIFIER_BADGE[mod]?.label ?? mod}
                      </span>
                    ))}
                  </div>
                  {node.kind !== 'enum' && (
                    <span style={{
                      fontSize: '12px', color, fontWeight: 500
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
            <h3 style={{ margin: '0 0 12px', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>
              References
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {outgoing.map((edge, i) => {
                const target = nodeById(edge.targetNodeId);
                if (!target) return null;
                const tc = KIND_COLOR[target.kind] ?? 'var(--accent-gold)';
                return (
                  <button key={i} onClick={() => onNavigate(target.id)} style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '8px 12px', borderRadius: '8px',
                    background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)',
                    cursor: 'pointer', textAlign: 'left', width: '100%',
                    fontFamily: 'var(--font-mono)', transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.borderColor = tc; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)'; }}
                  >
                    <ArrowRight size={14} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', flexShrink: 0, fontWeight: 500, textTransform: 'uppercase' }}>
                      {edge.kind}
                    </span>
                    <span style={{ fontWeight: 600, fontSize: '13px', color: tc, marginLeft: 'auto' }}>
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
            <h3 style={{ margin: '0 0 12px', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>
              Referenced By
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {incoming.map((edge, i) => {
                const src = nodeById(edge.sourceNodeId);
                if (!src) return null;
                const sc = KIND_COLOR[src.kind] ?? 'var(--accent-gold)';
                return (
                  <button key={i} onClick={() => onNavigate(src.id)} style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '8px 12px', borderRadius: '8px',
                    background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)',
                    cursor: 'pointer', textAlign: 'left', width: '100%',
                    fontFamily: 'var(--font-mono)', transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.borderColor = sc; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)'; }}
                  >
                    <ArrowLeft size={14} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                    <span style={{ fontWeight: 600, fontSize: '13px', color: sc }}>
                      {src.displayName}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: 'auto', fontWeight: 500, textTransform: 'uppercase' }}>
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
