import React from 'react';
import type { SchemaNode } from '../types';
import { Box, Hash, Type, Key, AlignLeft, Layers } from 'lucide-react';

interface MethodTreeProps {
  nodes: SchemaNode[];
  onNavigate: (nodeId: string) => void;
}

const getIconForKind = (kind: string) => {
  switch (kind) {
    case 'interface': return <Hash size={14} color="#818cf8" />;
    case 'class': return <Box size={14} color="#34d399" />;
    case 'enum': return <Type size={14} color="#fbbf24" />;
    case 'table': return <Key size={14} color="#f87171" />;
    default: return <AlignLeft size={14} color="#94a3b8" />;
  }
};

export const MethodTree: React.FC<MethodTreeProps> = ({ nodes, onNavigate }) => {
  // Only show structured parents
  const parents = nodes.filter(n => ['interface', 'class', 'enum', 'table'].includes(n.kind));

  return (
    <div style={{
      width: '240px',
      background: '#0f172a',
      borderRight: '1px solid #1e293b',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflow: 'hidden'
    }}>
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid #1e293b',
        fontSize: '11px',
        fontWeight: 600,
        color: '#94a3b8',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        display: 'flex',
        alignItems: 'center',
        gap: '6px'
      }}>
        <Layers size={14} /> Explorer
      </div>
      
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
        {parents.map(parent => (
          <div key={parent.id} style={{ marginBottom: '12px' }}>
            <div 
              onClick={() => onNavigate(parent.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '4px 8px', borderRadius: '6px',
                cursor: 'pointer', fontSize: '13px',
                color: '#e2e8f0', fontWeight: 500,
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#1e293b'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              {getIconForKind(parent.kind)}
              {parent.displayName}
            </div>
            
            <div style={{ paddingLeft: '22px', marginTop: '2px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {parent.fields.map(field => (
                <div 
                  key={field.name}
                  style={{
                    fontSize: '12px', color: '#94a3b8',
                    padding: '2px 4px', borderRadius: '4px',
                  }}
                >
                  <span style={{ color: '#cbd5e1' }}>{field.name}</span>
                  {parent.kind !== 'enum' && (
                    <span style={{ color: '#64748b', marginLeft: '4px' }}>: {field.ty}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
        {parents.length === 0 && (
          <div style={{ padding: '16px', color: '#64748b', fontSize: '12px', textAlign: 'center' }}>
            No structures parsed yet.
          </div>
        )}
      </div>
    </div>
  );
};
