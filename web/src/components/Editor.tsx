import React from 'react';
import type { SchemaNode } from '../types';
import { Code2, AlertCircle } from 'lucide-react';

interface EditorProps {
  value: string;
  onChange: (value: string) => void;
  parseError?: string | null;
}

export const Editor: React.FC<EditorProps> = ({ value, onChange, parseError }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        padding: '12px 20px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(255,255,255,0.02)',
        flexShrink: 0,
      }}>
        <Code2 size={16} color="#60a5fa" />
        <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '1.5px' }}>
          Schema Input
        </span>
      </div>

      {/* Textarea */}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        style={{
          flex: 1,
          width: '100%',
          padding: '20px',
          background: 'transparent',
          outline: 'none',
          border: 'none',
          resize: 'none',
          fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
          fontSize: '13px',
          lineHeight: '1.7',
          color: '#a5f3fc',
          boxSizing: 'border-box',
        }}
        placeholder="Paste your TypeScript, SQL, GraphQL, or Prisma schema here…"
      />

      {/* Footer */}
      <div style={{
        padding: '8px 20px',
        borderTop: '1px solid rgba(255,255,255,0.04)',
        background: 'rgba(0,0,0,0.2)',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        flexShrink: 0,
      }}>
        {parseError ? (
          <>
            <AlertCircle size={12} color="#f87171" />
            <span style={{ fontSize: '11px', color: '#f87171', fontFamily: 'monospace' }}>
              {parseError.slice(0, 60)}…
            </span>
          </>
        ) : (
          <span style={{ fontSize: '11px', color: '#334155' }}>
            Supports TypeScript · GraphQL · SQL · Prisma · JSON Schema
          </span>
        )}
      </div>
    </div>
  );
};
