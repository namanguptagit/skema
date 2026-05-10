import React from 'react';
import type { SchemaNode } from '../types';
import { Box, Hash, Type, Key, AlignLeft, Layers, ChevronLeft, ChevronRight } from 'lucide-react';

const COLLAPSED_WIDTH = 44;

interface ExplorerChromeProps {
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

const expandBtnStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '30px',
  height: '30px',
  padding: 0,
  border: 'none',
  borderRadius: 'var(--radius-workspace)',
  background: 'transparent',
  color: 'var(--text-muted)',
  cursor: 'pointer',
  flexShrink: 0,
  transition: 'background 150ms ease, color 150ms ease',
};

const collapseBtnStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '32px',
  height: '32px',
  padding: 0,
  flexShrink: 0,
  border: 'none',
  borderRadius: 'var(--radius-workspace)',
  background: 'transparent',
  color: 'var(--text-muted)',
  cursor: 'pointer',
  transition: 'background 150ms ease, color 150ms ease',
};

/** Same horizontal line as SCHEMA.ts tabs: Explorer title + collapse, or narrow expand control. */
export const ExplorerTopChrome: React.FC<ExplorerChromeProps> = ({ collapsed, onToggleCollapsed }) => {
  if (collapsed) {
    return (
      <div className="skema-explorer-top-cell skema-explorer-top-cell--rail">
        <button
          type="button"
          aria-label="Expand Explorer"
          aria-expanded={false}
          onClick={onToggleCollapsed}
          style={expandBtnStyle}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
            e.currentTarget.style.color = 'var(--text-main)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = 'var(--text-muted)';
          }}
        >
          <ChevronRight size={18} strokeWidth={2} />
        </button>
      </div>
    );
  }

  return (
    <div className="skema-explorer-top-cell skema-explorer-top-cell--expanded">
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
        <Layers size={14} color="var(--text-main)" strokeWidth={2} /> Explorer
      </div>
      <button
        type="button"
        aria-label="Collapse Explorer"
        aria-expanded={true}
        onClick={onToggleCollapsed}
        style={collapseBtnStyle}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
          e.currentTarget.style.color = 'var(--text-main)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.color = 'var(--text-muted)';
        }}
      >
        <ChevronLeft size={18} strokeWidth={2} />
      </button>
    </div>
  );
};

interface ExplorerBodyProps {
  nodes: SchemaNode[];
  onNavigate: (nodeId: string) => void;
  collapsed: boolean;
}

export const getIconForKind = (kind: string) => {
  switch (kind) {
    case 'interface': return <Hash size={14} color="var(--kind-interface)" />;
    case 'class': return <Box size={14} color="var(--kind-class)" />;
    case 'enum': return <Type size={14} color="var(--kind-enum)" />;
    case 'table': return <Key size={14} color="var(--kind-table)" />;
    default: return <AlignLeft size={14} color="var(--kind-scalar)" />;
  }
};

/** Spacer aligned with Schema Input header, then tree or filler. */
export const ExplorerBody: React.FC<ExplorerBodyProps> = ({ nodes, onNavigate, collapsed }) => {
  const parents = nodes.filter(n => ['interface', 'class', 'enum', 'table'].includes(n.kind));

  return (
    <>
      {collapsed ? (
        <div style={{ flex: 1, minHeight: 0, background: 'var(--bg-editor-body)' }} aria-hidden />
      ) : (
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            overflowX: 'visible',
            padding: '10px var(--workspace-pad-x) 16px',
          }}
        >
          {parents.map((parent, idx) => (
            <div
              key={parent.id}
              style={{
                paddingBottom: '12px',
                marginBottom: '12px',
                borderBottom: idx < parents.length - 1 ? '1px solid var(--section-divider)' : 'none',
              }}
            >
              <div
                onClick={() => onNavigate(parent.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '6px 10px',
                  borderRadius: 'var(--radius-workspace)',
                  cursor: 'pointer',
                  fontSize: '13px',
                  color: 'var(--text-main)',
                  fontWeight: 600,
                  fontFamily: 'var(--font-display)',
                  transition: 'background 150ms ease',
                  whiteSpace: 'nowrap',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                {getIconForKind(parent.kind)}
                {parent.displayName}
              </div>

              <div style={{ paddingLeft: '26px', marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                {parent.fields.map(field => (
                  <div
                    key={field.name}
                    style={{
                      fontSize: '12px',
                      color: 'var(--text-muted)',
                      padding: '2px 0',
                      display: 'flex',
                      alignItems: 'center',
                      fontFamily: 'var(--font-mono)',
                      flexWrap: 'wrap',
                      gap: '4px',
                    }}
                  >
                    <span style={{ color: 'var(--text-main)', marginRight: '6px', opacity: 0.9 }}>{field.name}</span>
                    {parent.kind !== 'enum' && (
                      <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>{field.ty}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
          {parents.length === 0 && (
            <div style={{ padding: '16px', color: 'var(--text-muted)', fontSize: '12px', textAlign: 'center', fontWeight: 500, whiteSpace: 'nowrap' }}>
              No structured types found
            </div>
          )}
        </div>
      )}
    </>
  );
};

export { COLLAPSED_WIDTH };
