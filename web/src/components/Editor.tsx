import React, { useMemo } from 'react';
import { AlertCircle } from 'lucide-react';
import CodeMirror from '@uiw/react-codemirror';
import { getLanguageExtensions } from '../editor/languageFromFileName';
import { skemaEditorChrome, skemaSyntaxHighlighting } from '../editor/skemaCodemirrorTheme';

interface EditorProps {
  fileName: string;
  value: string;
  onChange: (value: string) => void;
  parseError?: string | null;
}

const basicSetupOptions = {
  lineNumbers: false,
  foldGutter: false,
  highlightActiveLineGutter: false,
  highlightActiveLine: false,
  syntaxHighlighting: false,
} as const;

export const Editor: React.FC<EditorProps> = ({ fileName, value, onChange, parseError }) => {
  const extensions = useMemo(
    () => [
      ...getLanguageExtensions(fileName),
      skemaSyntaxHighlighting,
      skemaEditorChrome,
    ],
    [fileName],
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', flex: 1, minHeight: 0 }}>
      <div className="skema-code-inset" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <CodeMirror
          value={value}
          height="100%"
          theme="none"
          extensions={extensions}
          onChange={(v) => onChange(v)}
          basicSetup={basicSetupOptions}
          indentWithTab
          placeholder="Paste your TypeScript, SQL, GraphQL, or Prisma schema here…"
          style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}
          className="skema-codemirror-root"
          aria-label="Schema source"
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
