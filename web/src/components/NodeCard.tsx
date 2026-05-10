import React from 'react';
import type { SchemaNode } from '../types';

interface NodeCardProps {
  node: SchemaNode;
  isSelected: boolean;
  dimmed: boolean;
  onMouseDown: (e: React.MouseEvent, nodeId: string) => void;
}

/** Flat accent for the narrow left stripe — grays / warm grays only */
const KIND_ACCENT: Record<string, string> = {
  interface: 'var(--kind-interface)',
  enum:      'var(--kind-enum)',
  class:     'var(--kind-class)',
  table:     'var(--kind-table)',
  method:    'var(--kind-method)',
  scalar:    'var(--kind-scalar)',
};

const STRIPE_W = 4;

/** Shared with Canvas for edge anchors — keep in sync with rendered card */
export const NODE_GEOMETRY = {
  width: 260,
  headerHeight: 48,
  rowHeight: 26,
  paddingV: 10,
  borderRadius: 12,
} as const;

export const NodeCard: React.FC<NodeCardProps> = ({
  node, isSelected, dimmed, onMouseDown,
}) => {
  const accent = KIND_ACCENT[node.kind] ?? KIND_ACCENT.interface;
  const { width: cardW, headerHeight: headerH, rowHeight: rowH, paddingV, borderRadius } = NODE_GEOMETRY;
  const cardH = headerH + paddingV + node.fields.length * rowH + paddingV;

  const opacity = dimmed ? 0.3 : 1;
  const strokeWidth = isSelected ? 2 : 1;
  const borderColor = isSelected ? 'var(--color-primary)' : 'var(--section-divider)';

  return (
    <g
      transform={`translate(${node.x ?? 0}, ${node.y ?? 0})`}
      style={{
        cursor: 'grab',
        opacity,
        filter: isSelected
          ? 'drop-shadow(0 1px 2px rgba(0,0,0,0.32))'
          : 'drop-shadow(0 1px 1px rgba(0,0,0,0.2))',
        transition: 'all 0.2s cubic-bezier(0, 0, 0.2, 1)',
      }}
      onMouseDown={e => onMouseDown(e, node.id)}
      className="node-card-g"
    >
      <defs>
        <clipPath id={`clip-${node.id}`}>
          <rect width={cardW} height={cardH} rx={borderRadius} />
        </clipPath>
      </defs>

      <g clipPath={`url(#clip-${node.id})`}>
        <rect width={cardW} height={cardH} fill="var(--bg-obsidian)" />

        <rect width={cardW} height={headerH} fill="var(--bg-rail)" />
        <rect x={0} y={0} width={STRIPE_W} height={headerH} fill={accent} />

        <line x1={0} y1={headerH} x2={cardW} y2={headerH}
          stroke="var(--section-divider)" strokeWidth={1} />

        <text
          x={16 + STRIPE_W}
          y={headerH / 2 + 5}
          fill="var(--text-main)"
          fontSize={15}
          fontWeight={600}
          style={{ userSelect: 'none', fontFamily: 'var(--font-display)', letterSpacing: '-0.3px' }}
        >
          {node.displayName}
        </text>

        <text
          x={cardW - 14}
          y={headerH / 2 + 4}
          fill="var(--text-muted)"
          fontSize={9}
          fontWeight={600}
          textAnchor="end"
          style={{
            userSelect: 'none',
            fontFamily: 'var(--font-mono)',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
          }}
        >
          {node.kind}
        </text>

        {node.fields.map((field, i) => {
          const y = headerH + paddingV + i * rowH;
          const isOptional = field.modifiers?.includes('optional');
          const isArray = field.modifiers?.includes('array');
          const isReadonly = field.modifiers?.includes('readonly');
          const showTypeCol = node.kind !== 'enum' && field.ty.trim() !== '';

          return (
            <g key={`${field.name}-${i}`}>
              {i % 2 === 1 && (
                <rect x={0} y={y - 2} width={cardW} height={rowH}
                  fill="rgba(255,255,255,0.03)" />
              )}
              <text x={16} y={y + 16}
                fill={isOptional ? 'var(--text-muted)' : 'var(--text-main)'} fontSize={12}
                style={{ userSelect: 'none', fontFamily: 'var(--font-mono)', opacity: isOptional ? 0.7 : 1 }}>
                {isReadonly ? '⊘ ' : ''}{field.name}{isOptional ? '?' : ''}
              </text>
              {showTypeCol && (
                <text x={cardW - 16} y={y + 16}
                  fill="var(--text-muted)" fontSize={11} fontWeight={500} textAnchor="end"
                  style={{ userSelect: 'none', fontFamily: 'var(--font-mono)' }}>
                  {field.ty}{isArray ? '[]' : ''}
                </text>
              )}
            </g>
          );
        })}

        {node.fields.length === 0 && (
          <text x={cardW / 2} y={headerH + 24}
            fill="var(--text-muted)" fontSize={11} textAnchor="middle"
            style={{ userSelect: 'none', fontFamily: 'var(--font-display)', fontStyle: 'italic' }}>
            No fields
          </text>
        )}
      </g>

      <rect width={cardW} height={cardH} rx={borderRadius}
        fill="none" stroke={borderColor} strokeWidth={strokeWidth} style={{ pointerEvents: 'none' }} />
    </g>
  );
};
