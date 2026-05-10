import React from 'react';
import type { SchemaNode, SchemaEdge } from '../types';
import { X, ArrowRight, ArrowLeft } from 'lucide-react';
import { getIconForKind, KIND_ICON_SIZE } from './MethodTree';

const DETAIL_CHROME_ICON = Math.round(KIND_ICON_SIZE * 1.06);
const EDGE_ARROW_SIZE = 16;
const CLOSE_ICON_SIZE = 20;

interface NodeDetailDrawerProps {
  node: SchemaNode;
  edges: SchemaEdge[];
  allNodes: SchemaNode[];
  onClose: () => void;
  onNavigate: (nodeId: string) => void;
}

const KIND_COLOR: Record<string, string> = {
  interface: 'var(--kind-interface)',
  enum:      'var(--kind-enum)',
  class:     'var(--kind-class)',
  table:     'var(--kind-table)',
  method:    'var(--kind-method)',
  scalar:    'var(--kind-scalar)',
};

const MODIFIER_BADGE: Record<string, { label: string; color: string }> = {
  optional: { label: '?',        color: '#8f8c85' },
  array:    { label: '[ ]',      color: '#6b6e74' },
  nullable: { label: 'nullable', color: '#7a7268' },
  readonly: { label: 'readonly', color: '#756f68' },
};

export const NodeDetailDrawer: React.FC<NodeDetailDrawerProps> = ({
  node, edges, allNodes, onClose, onNavigate,
}) => {
  const outgoing = edges.filter(e => e.sourceNodeId === node.id);
  const incoming = edges.filter(e => e.targetNodeId === node.id);

  const nodeById = (id: string) => allNodes.find(n => n.id === id);

  return (
    <div className="skema-detail-drawer">
      {/* Top chrome — same language as Explorer strip */}
      <div className="skema-explorer-top-cell skema-explorer-top-cell--expanded">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
          {getIconForKind(node.kind, DETAIL_CHROME_ICON)}
          <span style={{
            fontFamily: 'var(--font-display)',
            fontSize: '13px',
            fontWeight: 600,
            color: 'var(--text-main)',
            whiteSpace: 'nowrap',
          }}>
            Details
          </span>
        </div>
        <button
          type="button"
          className="skema-detail-drawer-close-btn"
          aria-label="Close details"
          onClick={onClose}
        >
          <X size={CLOSE_ICON_SIZE} strokeWidth={2.25} aria-hidden />
        </button>
      </div>

      <div className="skema-detail-drawer-title-block">
        <h2 style={{
          margin: 0,
          fontSize: '18px',
          fontWeight: 600,
          color: 'var(--text-main)',
          letterSpacing: '-0.02em',
          fontFamily: 'var(--font-display)',
          lineHeight: 1.25,
          wordBreak: 'break-word',
        }}>
          {node.displayName}
        </h2>
        <div style={{
          fontSize: '11px',
          color: 'var(--text-muted)',
          marginTop: '6px',
          fontWeight: 500,
          fontFamily: 'var(--font-mono)',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '6px',
          alignItems: 'center',
        }}>
          <span style={{ textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: '10px' }}>
            {node.kind}
          </span>
          <span aria-hidden>·</span>
          <span>
            {node.format} • {node.fields.length} field{node.fields.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      <div
        className="skema-drawer-scroll"
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          padding: '10px var(--workspace-pad-x) 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          minHeight: 0,
          background: 'var(--bg-obsidian)',
        }}
      >

        {node.fields.length > 0 && (
          <section>
            <h3 className="skema-detail-drawer-section-title">Fields</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {node.fields.map((field, fieldIdx) => {
                const hasTypeCol = node.kind !== 'enum' && field.ty.trim() !== '';
                return (
                  <div
                    key={`field-${fieldIdx}-${field.name}`}
                    className="skema-detail-drawer-field-row"
                    style={{
                      gridTemplateColumns: hasTypeCol ? 'minmax(0, 1fr) auto' : 'minmax(0, 1fr)',
                      gap: '10px 14px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '6px',
                        minWidth: 0,
                        overflowWrap: 'anywhere',
                      }}
                    >
                      <span style={{
                        fontSize: '12px',
                        fontWeight: 500,
                        color: field.modifiers?.includes('optional') ? 'var(--text-muted)' : 'var(--text-main)',
                      }}>
                        {field.name}{field.modifiers?.includes('optional') ? '?' : ''}
                      </span>
                      {field.modifiers?.filter(m => m !== 'optional').map(mod => (
                        <span key={mod} style={{
                          fontSize: '9px',
                          fontWeight: 600,
                          padding: '2px 6px',
                          borderRadius: '10px',
                          background: 'rgba(255,255,255,0.06)',
                          color: 'var(--text-muted)',
                          textTransform: 'uppercase',
                          border: '1px solid var(--section-divider)',
                        }}>
                          {MODIFIER_BADGE[mod]?.label ?? mod}
                        </span>
                      ))}
                    </div>
                    {hasTypeCol && (
                      <span style={{
                        fontSize: '11px',
                        color: 'var(--text-muted)',
                        fontWeight: 500,
                        textAlign: 'right',
                        whiteSpace: 'nowrap',
                        alignSelf: 'center',
                      }}>
                        {field.ty}{field.modifiers?.includes('array') ? '[]' : ''}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {outgoing.length > 0 && (
          <section>
            <h3 className="skema-detail-drawer-section-title">References</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {outgoing.map((edge, i) => {
                const target = nodeById(edge.targetNodeId);
                if (!target) return null;
                const tc = KIND_COLOR[target.kind] ?? 'var(--kind-interface)';
                return (
                  <button
                    key={i}
                    type="button"
                    className="skema-detail-drawer-edge-btn"
                    onClick={() => onNavigate(target.id)}
                  >
                    <ArrowRight size={EDGE_ARROW_SIZE} strokeWidth={2} color="var(--text-muted)" style={{ flexShrink: 0 }} aria-hidden />
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', flexShrink: 0, fontWeight: 500, textTransform: 'uppercase' }}>
                      {edge.kind}
                    </span>
                    <span style={{
                      fontWeight: 600,
                      fontSize: '13px',
                      color: tc,
                      flex: 1,
                      minWidth: 0,
                      marginLeft: 'auto',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      textAlign: 'right',
                    }}>
                      {target.displayName}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {incoming.length > 0 && (
          <section>
            <h3 className="skema-detail-drawer-section-title">Referenced By</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {incoming.map((edge, i) => {
                const src = nodeById(edge.sourceNodeId);
                if (!src) return null;
                const sc = KIND_COLOR[src.kind] ?? 'var(--kind-interface)';
                return (
                  <button
                    key={i}
                    type="button"
                    className="skema-detail-drawer-edge-btn"
                    onClick={() => onNavigate(src.id)}
                  >
                    <ArrowLeft size={EDGE_ARROW_SIZE} strokeWidth={2} color="var(--text-muted)" style={{ flexShrink: 0 }} aria-hidden />
                    <span style={{
                      fontWeight: 600,
                      fontSize: '13px',
                      color: sc,
                      minWidth: 0,
                      flex: 1,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {src.displayName}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', flexShrink: 0, fontWeight: 500, textTransform: 'uppercase' }}>
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
