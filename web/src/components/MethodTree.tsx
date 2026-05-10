import React from 'react';
import type { SchemaNode } from '../types';
import {
  Braces,
  CircleDot,
  Cuboid,
  FolderTree,
  FunctionSquare,
  ListOrdered,
  PanelRightClose,
  Table2,
} from 'lucide-react';

/** Default row icon size in Explorer / kind list */
export const KIND_ICON_SIZE = 16;
const EXPLORER_TITLE_ICON = 17;
/** Collapsed rail: one icon only — reads as Explorer without crowding the narrow column */
const EXPLORER_RAIL_ICON = 19;
const COLLAPSE_PANEL_ICON = 20;

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
          <FolderTree size={EXPLORER_RAIL_ICON} strokeWidth={2} aria-hidden />
        </button>
      </div>
    );
  }

  return (
    <div className="skema-explorer-top-cell skema-explorer-top-cell--expanded">
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
        <FolderTree size={EXPLORER_TITLE_ICON} color="var(--text-main)" strokeWidth={2} aria-hidden /> Explorer
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
        <PanelRightClose size={COLLAPSE_PANEL_ICON} strokeWidth={2.25} />
      </button>
    </div>
  );
};

interface ExplorerBodyProps {
  nodes: SchemaNode[];
  onNavigate: (nodeId: string) => void;
  collapsed: boolean;
}

const iconProps = (size: number, colorVar: string) => ({
  size,
  color: colorVar,
  strokeWidth: 2 as const,
  'aria-hidden': true as const,
});

export type KindIconColorSet = 'graph' | 'explorer';

function kindIconColorVar(kind: string, colorSet: KindIconColorSet): string {
  if (colorSet === 'explorer') {
    switch (kind) {
      case 'interface':
        return 'var(--explorer-accent-interface)';
      case 'class':
        return 'var(--explorer-accent-class)';
      case 'enum':
        return 'var(--explorer-accent-enum)';
      case 'table':
        return 'var(--explorer-accent-table)';
      case 'method':
        return 'var(--explorer-accent-method)';
      default:
        return 'var(--explorer-accent-scalar)';
    }
  }
  switch (kind) {
    case 'interface':
      return 'var(--kind-interface)';
    case 'class':
      return 'var(--kind-class)';
    case 'enum':
      return 'var(--kind-enum)';
    case 'table':
      return 'var(--kind-table)';
    case 'method':
      return 'var(--kind-method)';
    default:
      return 'var(--kind-scalar)';
  }
}

export const getIconForKind = (
  kind: string,
  size: number = KIND_ICON_SIZE,
  colorSet: KindIconColorSet = 'graph',
) => {
  const colorVar = kindIconColorVar(kind, colorSet);
  switch (kind) {
    case 'interface':
      return <Braces {...iconProps(size, colorVar)} />;
    case 'class':
      return <Cuboid {...iconProps(size, colorVar)} />;
    case 'enum':
      return <ListOrdered {...iconProps(size, colorVar)} />;
    case 'table':
      return <Table2 {...iconProps(size, colorVar)} />;
    case 'method':
      return <FunctionSquare {...iconProps(size, colorVar)} />;
    default:
      return <CircleDot {...iconProps(size, colorVar)} />;
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
                {getIconForKind(parent.kind, KIND_ICON_SIZE, 'explorer')}
                {parent.displayName}
              </div>

              <div style={{ paddingLeft: `${8 + KIND_ICON_SIZE + 6}px`, marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
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
                      <span style={{ color: 'var(--syntax-type)', fontSize: '10px' }}>{field.ty}</span>
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
