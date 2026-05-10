import React from 'react';
import type { SchemaNode } from '../types';
import { Box, Hash, Type, Key, AlignLeft, Layers } from 'lucide-react';

interface MethodTreeProps {
  nodes: SchemaNode[];
  onNavigate: (nodeId: string) => void;
}

const getIconForKind = (kind: string) => {
  switch (kind) {
    case 'interface': return <Hash size={14} color="var(--accent-gold)" />;
    case 'class': return <Box size={14} color="var(--accent-copper)" />;
    case 'enum': return <Type size={14} color="var(--accent-amber)" />;
    case 'table': return <Key size={14} color="var(--accent-rust)" />;
    default: return <AlignLeft size={14} color="var(--accent-sand)" />;
  }
};

export const MethodTree: React.FC<MethodTreeProps> = ({ nodes, onNavigate }) => {
  // Only show structured parents
  const parents = nodes.filter(n => ['interface', 'class', 'enum', 'table'].includes(n.kind));

  return (
    <div style={{
      width: '260px',
      background: 'rgba(10, 10, 10, 0.5)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      borderRight: '1px solid var(--border-stark)',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '16px',
        borderBottom: '1px solid var(--border-stark)',
        background: 'transparent',
        fontSize: '11px',
        fontWeight: 600,
        color: 'var(--text-muted)',
        textTransform: 'uppercase',
        letterSpacing: '1px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        fontFamily: 'var(--font-display)'
      }}>
        <Layers size={14} color="var(--text-main)" /> Explorer
      </div>
      
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
        {parents.map(parent => (
          <div key={parent.id} style={{ marginBottom: '16px' }}>
            <div 
              onClick={() => onNavigate(parent.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '6px 10px', borderRadius: '6px',
                cursor: 'pointer', fontSize: '13px',
                color: 'var(--text-main)', fontWeight: 600,
                fontFamily: 'var(--font-display)',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              {getIconForKind(parent.kind)}
              {parent.displayName}
            </div>
            
            <div style={{ paddingLeft: '26px', marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {parent.fields.map(field => (
                <div 
                  key={field.name}
                  style={{
                    fontSize: '12px', color: 'var(--text-muted)',
                    padding: '2px 0px', display: 'flex', alignItems: 'center',
                    fontFamily: 'var(--font-mono)'
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
          <div style={{ padding: '16px', color: 'var(--text-muted)', fontSize: '12px', textAlign: 'center', fontWeight: 500 }}>
            No structured types found
          </div>
        )}
      </div>
    </div>
  );
};
