import { useState, useEffect, useCallback, useRef, type PointerEvent } from 'react';
import type { CSSProperties } from 'react';
import init, { parse_schema_wasm } from './core_pkg/core';
import { Editor } from './components/Editor';
import { ExplorerTopChrome, ExplorerBody, COLLAPSED_WIDTH } from './components/MethodTree';
import { Canvas } from './components/Canvas';
import { NodeDetailDrawer } from './components/NodeDetailDrawer';
import { FolderOutput, Download, Image as ImageIcon, FileJson, Link2, X, RefreshCw } from 'lucide-react';
import { SiGithub } from 'react-icons/si';
import { autoLayout } from './utils/layout';
import { toPng, toSvg } from 'html-to-image';
import type { ParsedSchema, NodeKind, RelationshipKind, SchemaNode } from './types';

const HEADER_ICON = 16;
const TAB_CLOSE_ICON = 14;
/** Matches ~13px label cap height so Re-layout reads balanced */
const RELAYOUT_ICON_SIZE = 18;

const GITHUB_REPO_URL = 'https://github.com/namanguptagit/skema';
const GITHUB_HEADER_ICON = 20;

const DEFAULT_SCHEMA = `interface Profile {
  bio: string;
  avatarUrl?: string;
}

interface User {
  id: string;
  username: string;
  email: string;
  profile?: Profile;
  posts: Post[];
}

interface Post {
  id: string;
  title: string;
  author: User;
}

const enum Role {
  USER = "USER",
  ADMIN = "ADMIN",
}`;

const STORAGE_KEY = 'skema_state';
const EDITOR_PANE_WIDTH_KEY = 'skema_editor_pane_width';
const MIN_EDITOR_PANE = 280;
const MAX_EDITOR_PANE_ABS = 1200;

function maxEditorPaneWidth(): number {
  if (typeof window === 'undefined') return MAX_EDITOR_PANE_ABS;
  return Math.min(
    MAX_EDITOR_PANE_ABS,
    Math.max(MIN_EDITOR_PANE, window.innerWidth - 320),
  );
}

function readStoredEditorPaneWidth(): number {
  try {
    const v = localStorage.getItem(EDITOR_PANE_WIDTH_KEY);
    if (v) {
      const n = parseInt(v, 10);
      if (!Number.isNaN(n)) {
        const max = maxEditorPaneWidth();
        return Math.min(max, Math.max(MIN_EDITOR_PANE, n));
      }
    }
  } catch { /* ignore */ }
  return 420;
}

type SchemaFile = { id: string; name: string; content: string; };

function App() {
  const savedPositions = useRef<Record<string, {x: number, y: number}>>({});
  const [files, setFiles] = useState<SchemaFile[]>(() => {
    if (window.location.hash.length > 1) {
      try {
        const decoded = decodeURIComponent(escape(atob(window.location.hash.slice(1))));
        try {
          const parsed = JSON.parse(decoded);
          if (Array.isArray(parsed)) return parsed;
        } catch { /* ignore */ }
        return [{ id: '1', name: 'shared.ts', content: decoded }];
      } catch { /* ignore */ }
    }
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.files) return parsed.files;
        if (parsed.input) return [{ id: '1', name: 'schema.ts', content: parsed.input }];
      }
    } catch { /* ignore */ }
    return [{ id: '1', name: 'schema.ts', content: DEFAULT_SCHEMA }];
  });
  const [activeFileId, setActiveFileId] = useState<string>('1');

  const [schema, setSchema] = useState<ParsedSchema>({ nodes: [], edges: [] });
  const [wasmReady, setWasmReady] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  // Track which nodes the user has manually dragged — they stay pinned during re-layout
  const pinnedIds = useRef<Set<string>>(new Set());
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [activeKinds, setActiveKinds] = useState<Set<NodeKind>>(
    new Set(['interface', 'enum', 'class', 'table', 'method', 'scalar'])
  );
  const [activeEdges, setActiveEdges] = useState<Set<RelationshipKind>>(
    new Set(['extends', 'implements', 'references', 'returns', 'has-field', 'foreign-key'])
  );
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [explorerCollapsed, setExplorerCollapsed] = useState(false);
  const [editorPaneWidth, setEditorPaneWidth] = useState(readStoredEditorPaneWidth);
  const editorPaneWidthRef = useRef(editorPaneWidth);
  editorPaneWidthRef.current = editorPaneWidth;
  const paneDragRef = useRef<{ startX: number; startW: number } | null>(null);

  const onPaneResizePointerDown = useCallback((e: PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    paneDragRef.current = { startX: e.clientX, startW: editorPaneWidthRef.current };
    document.body.classList.add('skema-pane-resizing');
  }, []);

  const onPaneResizePointerMove = useCallback((e: PointerEvent<HTMLButtonElement>) => {
    if (!paneDragRef.current) return;
    const dx = e.clientX - paneDragRef.current.startX;
    const max = maxEditorPaneWidth();
    const w = Math.round(
      Math.min(max, Math.max(MIN_EDITOR_PANE, paneDragRef.current.startW + dx)),
    );
    setEditorPaneWidth(w);
  }, []);

  const endPaneResize = useCallback((e: PointerEvent<HTMLButtonElement>) => {
    if (!paneDragRef.current) return;
    paneDragRef.current = null;
    document.body.classList.remove('skema-pane-resizing');
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch { /* ignore */ }
    setEditorPaneWidth((current) => {
      try {
        localStorage.setItem(EDITOR_PANE_WIDTH_KEY, String(current));
      } catch { /* ignore */ }
      return current;
    });
  }, []);

  const exportSvg = () => {
    const el = document.querySelector('.skema-canvas-container') as HTMLElement;
    if (!el) return;
    toSvg(el, { backgroundColor: '#1a1a18' })
      .then((dataUrl) => {
        const link = document.createElement('a');
        link.download = 'skema.svg';
        link.href = dataUrl;
        link.click();
        setShowExportMenu(false);
      });
  };

  const exportPng = () => {
    const el = document.querySelector('.skema-canvas-container') as HTMLElement;
    if (!el) return;
    toPng(el, { backgroundColor: '#1a1a18' })
      .then((dataUrl) => {
        const link = document.createElement('a');
        link.download = 'skema.png';
        link.href = dataUrl;
        link.click();
        setShowExportMenu(false);
      });
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(schema, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = 'skema.json'; link.click();
    setShowExportMenu(false);
  };

  const shareLink = () => {
    const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(files))));
    const url = `${window.location.origin}${window.location.pathname}#${encoded}`;
    navigator.clipboard.writeText(url).then(() => alert("Shareable link copied to clipboard!"));
    setShowExportMenu(false);
  };

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.positions) {
          savedPositions.current = parsed.positions;
          Object.keys(parsed.positions).forEach(id => pinnedIds.current.add(id));
        }
      }
    } catch { /* ignore */ }
    init().then(() => setWasmReady(true));
  }, []);

  useEffect(() => {
    const onResize = () => {
      setEditorPaneWidth((w) => {
        const max = maxEditorPaneWidth();
        return Math.min(max, Math.max(MIN_EDITOR_PANE, w));
      });
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Save to localStorage whenever files or positions change
  useEffect(() => {
    if (schema.nodes.length === 0) return;
    const positions: Record<string, {x: number, y: number}> = {};
    schema.nodes.forEach(n => {
      if (n.x !== undefined && n.y !== undefined) {
        positions[n.id] = { x: n.x, y: n.y };
      }
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ files, positions }));
  }, [files, schema.nodes]);

  const runParse = useCallback((currentFiles: SchemaFile[], activeId: string) => {
    if (!wasmReady) return;
    try {
      const activeFile = currentFiles.find(f => f.id === activeId);
      if (!activeFile || !activeFile.content.trim()) {
        setSchema({ nodes: [], edges: [] });
        return;
      }
      const result = parse_schema_wasm(activeFile.content);
      let allNodes: SchemaNode[] = result.nodes;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let allEdges: any[] = result.edges;
      
      setParseError(null);
      setSchema(prev => {
        const withPositions = allNodes.map(node => {
          const existing = prev.nodes.find(n => n.id === node.id);
          if (existing && (existing.x !== undefined)) {
            // Keep the old position — layout won't touch pinned nodes
            return { ...node, x: existing.x, y: existing.y };
          }
          if (savedPositions.current[node.id]) {
            return { ...node, x: savedPositions.current[node.id].x, y: savedPositions.current[node.id].y };
          }
          return node; // new node — let layout place it
        });
        // Nodes with no position yet need to be laid out
        const needsLayout = withPositions.some(n => n.x === undefined);
        const laid = needsLayout
          ? autoLayout(withPositions, allEdges, pinnedIds.current)
          : withPositions;
        return { nodes: laid, edges: allEdges };
      });
    } catch (e) {
      setParseError(String(e));
    }
  }, [wasmReady]);

  // Debounced parse
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    setIsParsing(true);
    debounceTimer.current = setTimeout(() => {
      runParse(files, activeFileId);
      setIsParsing(false);
    }, 600);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [files, activeFileId, runParse]);

  // Parse immediately once WASM becomes ready
  useEffect(() => {
    if (wasmReady) runParse(files, activeFileId); // eslint-disable-line react-hooks/set-state-in-effect
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wasmReady]);

  const handleNodeMove = (nodeId: string, x: number, y: number) => {
    // Mark as pinned so force-layout won't touch it on re-parse
    pinnedIds.current.add(nodeId);
    setSchema(prev => ({
      ...prev,
      nodes: prev.nodes.map(n => n.id === nodeId ? { ...n, x, y } : n)
    }));
  };

  // "Re-layout" button: clear all pins and run layout fresh
  const handleRelayout = () => {
    pinnedIds.current.clear();
    setSchema(prev => {
      const unpositioned = prev.nodes.map(n => ({ ...n, x: undefined, y: undefined }));
      return { ...prev, nodes: autoLayout(unpositioned, prev.edges) };
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100vh', background: 'var(--bg-workspace)', color: 'var(--text-main)', fontFamily: 'var(--font-mono)' }}>
      {/* Header */}
      <header style={{
        height: '56px',
        borderBottom: '1px solid var(--section-divider)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 var(--workspace-pad-x)',
        background: 'var(--bg-rail)',
        flexShrink: 0,
        zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '36px', height: '36px',
            background: 'var(--bg-panel)',
            border: '1px solid var(--section-divider)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: 'var(--radius-workspace)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
            flexShrink: 0,
          }}>
            <img src="/logo.svg" width={22} height={22} alt="" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, lineHeight: 1 }}>
            <h1
              style={{
                margin: 0,
                fontFamily: 'var(--font-logo)',
                fontSize: '20px',
                fontWeight: 800,
                letterSpacing: '-0.02em',
                color: 'var(--text-main)',
                lineHeight: 1,
              }}
            >
              Skema
            </h1>
            <span
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '10px',
                fontWeight: 600,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: 'var(--text-muted)',
                lineHeight: 1,
              }}
            >
              Schema visualizer
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            {schema.nodes.length} nodes · {schema.edges.length} edges
          </div>
          <button
            type="button"
            className="skema-btn skema-btn--secondary skema-btn--display skema-btn--gap-tight"
            onClick={handleRelayout}
            title="Re-run auto-layout (clears manual positions)"
          >
            <RefreshCw size={RELAYOUT_ICON_SIZE} strokeWidth={2.25} aria-hidden className="skema-btn-lead-icon" />
            Re-layout
          </button>
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              className="skema-btn skema-btn--primary skema-btn--mono skema-btn--uppercase"
              onClick={() => setShowExportMenu(!showExportMenu)}
            >
              <FolderOutput size={HEADER_ICON} strokeWidth={2} aria-hidden /> EXPORT
            </button>
            {showExportMenu && (
              <div style={{
                position: 'absolute', top: '100%', right: 0, marginTop: '8px',
                background: 'var(--bg-panel)',
                border: '1px solid var(--section-divider)',
                borderRadius: 'var(--radius-workspace)',
                padding: '4px',
                display: 'flex',
                flexDirection: 'column',
                minWidth: '160px',
                zIndex: 100,
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
              }}>
                {(() => {
                  const menuBtnStyle: CSSProperties = {
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 12px',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-main)',
                    fontSize: '13px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    borderRadius: 'var(--radius-workspace)',
                    transition: 'background 150ms ease',
                  };
                  return (
                    <>
                      <button type="button" onClick={exportSvg} style={menuBtnStyle} onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }} onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}><Download size={HEADER_ICON} strokeWidth={2} aria-hidden /> Export SVG</button>
                      <button type="button" onClick={exportPng} style={menuBtnStyle} onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }} onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}><ImageIcon size={HEADER_ICON} strokeWidth={2} aria-hidden /> Export PNG</button>
                      <button type="button" onClick={exportJson} style={menuBtnStyle} onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }} onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}><FileJson size={HEADER_ICON} strokeWidth={2} aria-hidden /> Export JSON</button>
                      <button type="button" onClick={shareLink} style={menuBtnStyle} onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }} onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}><Link2 size={HEADER_ICON} strokeWidth={2} aria-hidden /> Copy Share Link</button>
                    </>
                  );
                })()}
              </div>
            )}
          </div>
          <a
            href={GITHUB_REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="skema-btn skema-btn--secondary"
            aria-label="View Skema on GitHub"
            title="View Skema on GitHub"
            style={{
              padding: '8px',
              textDecoration: 'none',
            }}
          >
            <SiGithub className="skema-btn-icon-fill" size={GITHUB_HEADER_ICON} aria-hidden />
          </a>
        </div>
      </header>

      {/* Main Content */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'row', overflow: 'hidden', minHeight: 0, background: 'var(--bg-workspace)' }}>
        {/* Editor + Explorer: grid — tabs|Explorer header, editor|Explorer body */}
        <div
          className="skema-workspace-split"
          style={{
            gridTemplateColumns: explorerCollapsed
              ? `${editorPaneWidth}px var(--pane-resize-width) ${COLLAPSED_WIDTH}px`
              : `${editorPaneWidth}px var(--pane-resize-width) max-content`,
          }}
        >
          <div className="skema-file-tabs-row skema-workspace-split-tabs">
            {files.map(f => {
              const isActive = activeFileId === f.id;
              return (
                <div
                  key={f.id}
                  onClick={() => setActiveFileId(f.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '0 10px',
                    height: 'calc(var(--file-tabs-row-height) - 1px)',
                    fontSize: '11px',
                    cursor: 'pointer',
                    letterSpacing: 'normal',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: isActive ? 500 : 400,
                    color: isActive ? 'var(--text-main)' : 'var(--text-muted)',
                    background: isActive ? 'var(--bg-editor-body)' : 'transparent',
                    borderRadius: '8px 8px 0 0',
                    border: '1px solid transparent',
                    borderBottom: 'none',
                    boxSizing: 'border-box',
                    boxShadow: isActive ? 'inset 0 -2px 0 0 var(--accent-line)' : 'none',
                    transition: 'color 0.15s ease, background 0.15s ease, box-shadow 0.15s ease',
                    flexShrink: 0,
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.color = 'var(--text-main)';
                      e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.color = 'var(--text-muted)';
                      e.currentTarget.style.background = 'transparent';
                    }
                  }}
                >
                  <span
                    title={f.name}
                    style={{
                      maxWidth: 110,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      minWidth: 0,
                    }}
                  >
                    {f.name}
                  </span>
                  {files.length > 1 && (
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        const newFiles = files.filter(file => file.id !== f.id);
                        setFiles(newFiles);
                        if (activeFileId === f.id) {
                          setActiveFileId(newFiles[0].id);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          e.stopPropagation();
                          const newFiles = files.filter(file => file.id !== f.id);
                          setFiles(newFiles);
                          if (activeFileId === f.id) {
                            setActiveFileId(newFiles[0].id);
                          }
                        }
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '6px',
                        padding: '2px',
                        background: isActive ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)',
                        color: isActive ? 'var(--text-main)' : 'var(--text-muted)',
                        transition: 'background 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(255,255,255,0.12)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = isActive ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)';
                      }}
                    >
                      <X size={TAB_CLOSE_ICON} strokeWidth={2.25} aria-hidden />
                    </div>
                  )}
                </div>
              );
            })}
            <button
              type="button"
              aria-label="New file"
              onClick={() => {
                const newId = Date.now().toString();
                setFiles([...files, { id: newId, name: `schema_${files.length + 1}.txt`, content: '' }]);
                setActiveFileId(newId);
              }}
              style={{
                marginLeft: '4px',
                width: '28px',
                height: '28px',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '16px',
                lineHeight: 1,
                cursor: 'pointer',
                color: 'var(--text-muted)',
                background: 'transparent',
                border: '1px dashed var(--section-divider)',
                borderRadius: 'var(--radius-workspace)',
                transition: 'color 0.15s ease, border-color 0.15s ease, background 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--text-main)';
                e.currentTarget.style.borderColor = 'var(--border-strong)';
                e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--text-muted)';
                e.currentTarget.style.borderColor = 'var(--section-divider)';
                e.currentTarget.style.background = 'transparent';
              }}
            >
              +
            </button>
          </div>

          <div
            className="skema-workspace-column skema-workspace-split-editor"
            style={{
              width: '100%',
              minWidth: 0,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              background: 'var(--bg-editor-body)',
            }}
          >
            <Editor
              key={activeFileId}
              fileName={files.find(f => f.id === activeFileId)?.name ?? 'schema.ts'}
              value={files.find(f => f.id === activeFileId)?.content || ''}
              onChange={(val) => {
                setFiles(files.map(f => f.id === activeFileId ? { ...f, content: val } : f));
              }}
              parseError={parseError}
            />
          </div>

          <button
            type="button"
            className="skema-pane-resize-handle"
            aria-label="Resize schema editor width"
            aria-orientation="vertical"
            aria-valuenow={editorPaneWidth}
            aria-valuemin={MIN_EDITOR_PANE}
            aria-valuemax={maxEditorPaneWidth()}
            onPointerDown={onPaneResizePointerDown}
            onPointerMove={onPaneResizePointerMove}
            onPointerUp={endPaneResize}
            onPointerCancel={endPaneResize}
          />

          <div
            className="skema-explorer-column skema-workspace-split-explorer"
            style={{
              display: 'flex',
              flexDirection: 'column',
              flexShrink: 0,
              width: explorerCollapsed ? COLLAPSED_WIDTH : 'max-content',
              maxWidth: explorerCollapsed ? COLLAPSED_WIDTH : 'min(480px, 45vw)',
              minWidth: explorerCollapsed ? COLLAPSED_WIDTH : 'var(--explorer-column-min-width)',
            }}
          >
            <ExplorerTopChrome
              collapsed={explorerCollapsed}
              onToggleCollapsed={() => setExplorerCollapsed((c) => !c)}
            />
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, minWidth: 0, overflowX: 'visible' }}>
              <ExplorerBody
                nodes={schema.nodes}
                onNavigate={(id) => setSelectedNodeId(id)}
                collapsed={explorerCollapsed}
              />
            </div>
          </div>
        </div>

        {/* Canvas Area */}
        <section style={{ flex: 1, display: 'flex', position: 'relative', minHeight: 0, minWidth: 0, background: 'var(--bg-workspace)' }}>
          {/* Main Canvas Container */}
          <div
            className="skema-canvas-container"
            style={{
              flex: 1,
              position: 'relative',
              overflow: 'hidden',
              minWidth: 0,
              margin: '10px 12px 10px 6px',
              borderRadius: 'var(--radius-workspace-lg)',
              border: '1px solid var(--section-divider)',
              background: 'var(--bg-obsidian)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
            }}
          >
            <Canvas
              nodes={schema.nodes}
              edges={schema.edges}
              selectedNodeId={selectedNodeId}
              onNodeMove={handleNodeMove}
              onNodeClick={setSelectedNodeId}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              activeKinds={activeKinds}
              setActiveKinds={setActiveKinds}
              activeEdges={activeEdges}
              setActiveEdges={setActiveEdges}
            />

            {/* Status badges / Telemetry strip */}
            <div style={{
              position: 'absolute', bottom: '24px', left: '24px',
              display: 'flex', gap: '8px',
              zIndex: 10,
              pointerEvents: 'none'
            }}>
              <div style={{ 
                padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '8px',
                borderRadius: 'var(--radius-workspace)',
                border: '1px solid var(--section-divider)',
                background: 'var(--bg-panel)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
                fontFamily: 'var(--font-mono)',
              }}>
                <div style={{
                  width: '6px', height: '6px', borderRadius: '50%',
                  background: isParsing ? 'var(--text-muted)' : (wasmReady ? 'var(--kind-interface)' : 'var(--accent-rust)'),
                }} />
                <span style={{ fontSize: '11px', color: 'var(--text-main)', fontWeight: 500, letterSpacing: '0.5px' }}>
                  WASM {isParsing ? 'Parsing...' : (wasmReady ? 'Active' : 'Init')}
                </span>
              </div>
              
              <div style={{ 
                padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '8px',
                borderRadius: 'var(--radius-workspace)',
                border: '1px solid var(--section-divider)',
                background: 'var(--bg-panel)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
                fontFamily: 'var(--font-mono)',
              }}>
                <div style={{
                  width: '6px', height: '6px', borderRadius: '50%',
                  background: parseError ? 'var(--ui-danger)' : 'var(--kind-enum)',
                }} />
                <span style={{ fontSize: '11px', color: 'var(--text-main)', fontWeight: 500, letterSpacing: '0.5px' }}>
                  AST {parseError ? 'Error' : 'Synced'}
                </span>
              </div>
            </div>
          </div>

          {/* Node Detail Drawer (Step 19) */}
          {(() => {
            if (!selectedNodeId) return null;
            const node = schema.nodes.find(n => n.id === selectedNodeId);
            if (!node) return null;
            return (
              <div style={{ width: '336px', flexShrink: 0, position: 'relative', zIndex: 100 }}>
                <NodeDetailDrawer
                  node={node}
                  edges={schema.edges}
                  allNodes={schema.nodes}
                  onClose={() => setSelectedNodeId(null)}
                  onNavigate={id => setSelectedNodeId(id)}
                />
              </div>
            );
          })()}
        </section>
      </main>
    </div>
  );
}

export default App;
