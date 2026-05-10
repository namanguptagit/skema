import React from 'react';
import { Code2, AlertCircle } from 'lucide-react';

interface EditorProps {
  value: string;
  onChange: (value: string) => void;
  parseError?: string | null;
}

export const Editor: React.FC<EditorProps> = ({ value, onChange, parseError }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        padding: '12px 20px',
        borderBottom: '1px solid var(--border-stark)',
        background: 'var(--bg-obsidian)',
        flexShrink: 0,
      }}>
        <Code2 size={16} color="var(--text-muted)" />
        <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1.5px' }}>
          Schema Input
        </span>
      </div>

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
          color: 'var(--text-main)',
          boxSizing: 'border-box',
        }}
        placeholder="Paste your TypeScript, SQL, GraphQL, or Prisma schema here…"
      />

      <div style={{
        padding: '8px 20px',
        borderTop: '1px solid var(--border-stark)',
        background: 'var(--bg-obsidian)',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        flexShrink: 0,
      }}>
        {parseError ? (
          <>
            <AlertCircle size={12} color="var(--ui-danger)" />
            <span style={{ fontSize: '11px', color: 'var(--ui-danger)', fontFamily: 'monospace' }}>
              {parseError.slice(0, 60)}…
            </span>
          </>
        ) : (
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            Supports TypeScript · GraphQL · SQL · Prisma · JSON Schema
          </span>
        )}
      </div>
    </div>
  );
};
