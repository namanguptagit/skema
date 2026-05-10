import React from 'react';
import { AlertCircle } from 'lucide-react';

interface EditorProps {
  value: string;
  onChange: (value: string) => void;
  parseError?: string | null;
}

export const Editor: React.FC<EditorProps> = ({ value, onChange, parseError }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', flex: 1, minHeight: 0 }}>
      <div className="skema-code-inset">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
          style={{
            flex: 1,
            width: '100%',
            minHeight: 0,
            padding: '14px var(--workspace-pad-x)',
            background: 'transparent',
            outline: 'none',
            border: 'none',
            resize: 'none',
            fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
            fontSize: '13px',
            lineHeight: 1.7,
            color: 'var(--text-main)',
            boxSizing: 'border-box',
          }}
          placeholder="Paste your TypeScript, SQL, GraphQL, or Prisma schema here…"
        />
      </div>

      <div className="skema-section-footer">
        {parseError ? (
          <>
            <AlertCircle size={15} color="var(--ui-danger)" strokeWidth={2.25} aria-hidden />
            <span style={{ color: 'var(--ui-danger)', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
              {parseError.slice(0, 72)}{parseError.length > 72 ? '…' : ''}
            </span>
          </>
        ) : (
          <span style={{ opacity: 0.88 }}>
            Supports TypeScript · GraphQL · SQL · Prisma · JSON Schema
          </span>
        )}
      </div>
    </div>
  );
};
