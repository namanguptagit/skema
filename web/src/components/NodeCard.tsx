import React from 'react';
import type { SchemaNode } from '../types';

interface NodeCardProps {
  node: SchemaNode;
  isSelected: boolean;
  dimmed: boolean;
  onMouseDown: (e: React.MouseEvent, nodeId: string) => void;
}

const KIND_COLORS: Record<string, { header: string; border: string; badge: string; badgeBg: string }> = {
  interface: { header: '#1e3a5f', border: '#3b82f6', badge: '#93c5fd', badgeBg: 'rgba(59,130,246,0.15)' },
  enum:      { header: '#3b1f5f', border: '#a855f7', badge: '#d8b4fe', badgeBg: 'rgba(168,85,247,0.15)' },
  class:     { header: '#064e3b', border: '#10b981', badge: '#6ee7b7', badgeBg: 'rgba(16,185,129,0.15)' },
  table:     { header: '#1e3a2f', border: '#34d399', badge: '#6ee7b7', badgeBg: 'rgba(52,211,153,0.15)' },
  method:    { header: '#1e1e40', border: '#818cf8', badge: '#c7d2fe', badgeBg: 'rgba(129,140,248,0.15)' },
  scalar:    { header: '#292524', border: '#78716c', badge: '#d4d4d4', badgeBg: 'rgba(120,113,108,0.15)' },
};

export const NodeCard: React.FC<NodeCardProps> = ({
  node, isSelected, dimmed, onMouseDown,
}) => {
  const colors = KIND_COLORS[node.kind] ?? KIND_COLORS.interface;
  const cardW = 240;
  const headerH = 38;
  const rowH = 26;
  const paddingV = 10;
  const cardH = headerH + paddingV + node.fields.length * rowH + paddingV;

  const opacity = dimmed ? 0.15 : 1;
  const strokeWidth = isSelected ? 2.5 : 1.5;
  const borderColor = isSelected ? colors.badge : colors.border;
  const glow = isSelected
    ? `drop-shadow(0 0 10px ${colors.border}80) drop-shadow(0 0 24px ${colors.border}40)`
    : undefined;

  return (
    <g
      transform={`translate(${node.x ?? 0}, ${node.y ?? 0})`}
      style={{ cursor: 'grab', opacity, filter: glow }}
      onMouseDown={e => onMouseDown(e, node.id)}
    >
      {/* Selection ring */}
      {isSelected && (
        <rect
          x={-3} y={-3}
          width={cardW + 6} height={cardH + 6}
          rx={13}
          fill="none"
          stroke={colors.badge}
          strokeWidth={1.5}
          strokeOpacity={0.4}
          strokeDasharray="5 3"
        />
      )}

      {/* Drop shadow */}
      <rect x={3} y={5} width={cardW} height={cardH} rx={10}
        fill="rgba(0,0,0,0.5)" style={{ filter: 'blur(4px)' }} />

      {/* Card background */}
      <rect width={cardW} height={cardH} rx={10}
        fill="#0f172a" stroke={borderColor} strokeWidth={strokeWidth} />

      {/* Header */}
      <rect width={cardW} height={headerH} rx={10} fill={colors.header} />
      <rect y={headerH - 10} width={cardW} height={10} fill={colors.header} />
      <line x1={0} y1={headerH} x2={cardW} y2={headerH}
        stroke={colors.border} strokeWidth={1} strokeOpacity={0.4} />

      {/* Node name */}
      <text x={14} y={headerH / 2 + 5}
        fill="white" fontSize={13} fontWeight={700}
        style={{ userSelect: 'none', fontFamily: 'system-ui, sans-serif' }}>
        {node.displayName}
      </text>

      {/* Kind badge */}
      <rect x={cardW - 58} y={10} width={46} height={18} rx={9} fill={colors.badgeBg} />
      <text x={cardW - 35} y={23}
        fill={colors.badge} fontSize={9} fontWeight={700}
        textAnchor="middle"
        style={{ userSelect: 'none', fontFamily: 'system-ui, sans-serif', letterSpacing: '0.5px' }}>
        {node.kind.toUpperCase()}
      </text>

      {/* Fields */}
      {node.fields.map((field, i) => {
        const y = headerH + paddingV + i * rowH;
        const isOptional = field.modifiers?.includes('optional');
        const isArray = field.modifiers?.includes('array');
        const isReadonly = field.modifiers?.includes('readonly');

        return (
          <g key={field.name}>
            {i % 2 === 1 && (
              <rect x={0} y={y - 2} width={cardW} height={rowH}
                fill="rgba(255,255,255,0.02)" />
            )}
            <text x={14} y={y + 16}
              fill={isOptional ? '#94a3b8' : '#cbd5e1'} fontSize={12}
              style={{ userSelect: 'none', fontFamily: "'JetBrains Mono', monospace" }}>
              {isReadonly ? '⊘ ' : ''}{field.name}{isOptional ? '?' : ''}
            </text>
            {node.kind !== 'enum' && (
              <text x={cardW - 12} y={y + 16}
                fill={colors.badge} fontSize={11} textAnchor="end"
                style={{ userSelect: 'none', fontFamily: "'JetBrains Mono', monospace" }}>
                {field.ty}{isArray ? '[]' : ''}
              </text>
            )}
          </g>
        );
      })}

      {node.fields.length === 0 && (
        <text x={cardW / 2} y={headerH + 24}
          fill="#334155" fontSize={11} textAnchor="middle"
          style={{ userSelect: 'none', fontStyle: 'italic' }}>
          (no fields)
        </text>
      )}
    </g>
  );
};
