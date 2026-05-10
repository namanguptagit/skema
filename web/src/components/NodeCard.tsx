import React from 'react';
import type { SchemaNode } from '../types';

interface NodeCardProps {
  node: SchemaNode;
  isSelected: boolean;
  dimmed: boolean;
  onMouseDown: (e: React.MouseEvent, nodeId: string) => void;
}

const KIND_COLORS: Record<string, { header: string; border: string; text: string }> = {
  interface: { header: 'var(--accent-gold)', border: 'var(--accent-gold)', text: '#ffffff' },
  enum:      { header: 'var(--accent-amber)', border: 'var(--accent-amber)', text: '#ffffff' },
  class:     { header: 'var(--accent-copper)', border: 'var(--accent-copper)', text: '#ffffff' },
  table:     { header: 'var(--accent-rust)', border: 'var(--accent-rust)', text: '#ffffff' },
  method:    { header: 'var(--accent-earth)', border: 'var(--accent-earth)', text: '#ffffff' },
  scalar:    { header: 'var(--accent-sand)', border: 'var(--accent-sand)', text: '#000000' },
};

export const NodeCard: React.FC<NodeCardProps> = ({
  node, isSelected, dimmed, onMouseDown,
}) => {
  const colors = KIND_COLORS[node.kind] ?? KIND_COLORS.interface;
  const cardW = 260;
  const headerH = 48;
  const rowH = 26;
  const paddingV = 10;
  const cardH = headerH + paddingV + node.fields.length * rowH + paddingV;

  const opacity = dimmed ? 0.3 : 1;
  const strokeWidth = isSelected ? 2 : 1;
  const borderColor = isSelected ? 'rgba(255, 255, 255, 0.4)' : 'var(--border-stark)';

  return (
    <g
      transform={`translate(${node.x ?? 0}, ${node.y ?? 0})`}
      style={{ 
        cursor: 'grab', 
        opacity,
        filter: isSelected ? 'drop-shadow(0 12px 32px rgba(245, 158, 11, 0.4))' : 'drop-shadow(0 8px 24px rgba(0,0,0,0.4))',
        transition: 'all 0.2s cubic-bezier(0, 0, 0.2, 1)'
      }}
      onMouseDown={e => onMouseDown(e, node.id)}
      className="node-card-g"
    >
      <defs>
        <clipPath id={`clip-${node.id}`}>
          <rect width={cardW} height={cardH} rx={12} />
        </clipPath>
        <linearGradient id={`grad-${node.id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={colors.header} stopOpacity="0.8" />
          <stop offset="100%" stopColor={colors.header} stopOpacity="0.4" />
        </linearGradient>
      </defs>

      <g clipPath={`url(#clip-${node.id})`}>
        {/* Card background */}
        <rect width={cardW} height={cardH}
          fill="rgba(20, 20, 20, 0.85)" />

        {/* Header */}
        <rect width={cardW} height={headerH} fill={`url(#grad-${node.id})`} />
        
        {/* Subtle header separator */}
        <line x1={0} y1={headerH} x2={cardW} y2={headerH}
          stroke="rgba(255, 255, 255, 0.1)" strokeWidth={1} />

        {/* Node name */}
        <text x={16} y={headerH / 2 + 5}
          fill="#ffffff" fontSize={15} fontWeight={600}
          style={{ userSelect: 'none', fontFamily: 'var(--font-display)', letterSpacing: '-0.3px' }}>
          {node.displayName}
        </text>

        {/* Kind badge */}
        <rect x={cardW - 68} y={12} width={56} height={24} rx={12} fill="rgba(0,0,0,0.2)" />
        <text x={cardW - 40} y={27}
          fill="#ffffff" fontSize={10} fontWeight={600}
          textAnchor="middle"
          style={{ userSelect: 'none', fontFamily: 'var(--font-display)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
          {node.kind}
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
              <text x={16} y={y + 16}
                fill={isOptional ? 'var(--text-muted)' : 'var(--text-main)'} fontSize={12}
                style={{ userSelect: 'none', fontFamily: 'var(--font-mono)', opacity: isOptional ? 0.7 : 1 }}>
                {isReadonly ? '⊘ ' : ''}{field.name}{isOptional ? '?' : ''}
              </text>
              {node.kind !== 'enum' && (
                <text x={cardW - 16} y={y + 16}
                  fill={colors.header} fontSize={11} fontWeight={500} textAnchor="end"
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
      
      {/* Border overlay (drawn outside clipPath so borders aren't clipped) */}
      <rect width={cardW} height={cardH} rx={12}
        fill="none" stroke={borderColor} strokeWidth={strokeWidth} style={{ pointerEvents: 'none' }} />
    </g>
  );
};
