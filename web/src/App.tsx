import { useState, useEffect, useCallback, useRef } from 'react';
import init, { parse_schema_wasm } from './core_pkg/core';
import { Editor } from './components/Editor';
import { MethodTree } from './components/MethodTree';
import { Canvas } from './components/Canvas';
import { NodeDetailDrawer } from './components/NodeDetailDrawer';
import { LayoutDashboard, Share2, ExternalLink, Download, Image as ImageIcon, FileJson, Link, X } from 'lucide-react';
import { autoLayout } from './utils/layout';
import { toPng, toSvg } from 'html-to-image';
import type { ParsedSchema, NodeKind, RelationshipKind, SchemaNode } from './types';

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
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100vh', background: 'var(--bg-obsidian)', color: 'var(--text-main)', fontFamily: 'var(--font-mono)' }}>
      {/* Header */}
      <header style={{
        height: '64px',
        borderBottom: '1px solid var(--border-stark)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        background: 'var(--bg-panel)',
        flexShrink: 0,
        zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '36px', height: '36px',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-stark)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: '6px',
          }}>
            <LayoutDashboard size={18} color="var(--text-main)" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 700, fontFamily: 'var(--font-display)', letterSpacing: '-0.5px', color: 'var(--text-main)' }}>Skema</h1>
            <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500, letterSpacing: '1px' }}>SCHEMA VISUALIZER</p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            {schema.nodes.length} nodes · {schema.edges.length} edges
          </div>
          <button
            onClick={handleRelayout}
            title="Re-run auto-layout (clears manual positions)"
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '8px 16px', borderRadius: '6px',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-stark)',
              color: 'var(--text-main)', fontSize: '13px', fontWeight: 500, cursor: 'pointer',
            }}
          >
            ⟳ Re-layout
          </button>
          <div style={{ position: 'relative' }}>
            <button 
              onClick={() => setShowExportMenu(!showExportMenu)}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '8px 16px', borderRadius: '0px',
                background: 'var(--bg-obsidian)',
                border: '1px solid var(--border-stark)',
                color: 'var(--text-main)', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                fontFamily: 'var(--font-mono)',
                textTransform: 'uppercase'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = 'var(--border-strong)';
                e.currentTarget.style.color = 'var(--text-muted)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'var(--border-stark)';
                e.currentTarget.style.color = 'var(--text-main)';
              }}
            >
              <Share2 size={14} /> EXPORT
            </button>
            {showExportMenu && (
              <div style={{
                position: 'absolute', top: '100%', right: 0, marginTop: '8px',
                background: 'var(--bg-elevated)', border: '1px solid var(--border-stark)',
                borderRadius: '6px', padding: '4px', display: 'flex', flexDirection: 'column',
                minWidth: '160px', zIndex: 100,
              }}>
                {(() => {
                  const menuBtnStyle = {
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '8px 12px', background: 'transparent', border: 'none',
                    color: 'var(--text-main)', fontSize: '13px', cursor: 'pointer',
                    textAlign: 'left' as const, borderRadius: '4px'
                  };
                  return (
                    <>
                      <button onClick={exportSvg} style={menuBtnStyle}><Download size={14} /> Export SVG</button>
                      <button onClick={exportPng} style={menuBtnStyle}><ImageIcon size={14} /> Export PNG</button>
                      <button onClick={exportJson} style={menuBtnStyle}><FileJson size={14} /> Export JSON</button>
                      <button onClick={shareLink} style={menuBtnStyle}><Link size={14} /> Copy Share Link</button>
                    </>
                  );
                })()}
              </div>
            )}
          </div>
          <a
            href="https://github.com"
            target="_blank"
            rel="noreferrer"
            style={{ padding: '8px', borderRadius: '8px', color: 'var(--text-muted)', textDecoration: 'none', display: 'flex' }}
          >
            <ExternalLink size={20} />
          </a>
        </div>
      </header>

      {/* Main Content */}
      <main style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Sidebar Editor */}
        <aside style={{
          width: '420px',
          borderRight: '2px solid var(--border-stark)',
          background: 'var(--bg-panel)',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
        }}>
          {/* File Tabs */}
          <div style={{ display: 'flex', borderBottom: '2px solid var(--border-stark)', background: 'var(--bg-obsidian)', overflowX: 'auto' }}>
            {files.map(f => (
              <div 
                key={f.id}
                onClick={() => setActiveFileId(f.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '10px 16px', fontSize: '12px', cursor: 'pointer',
                  borderRight: '2px solid var(--border-stark)',
                  color: activeFileId === f.id ? 'var(--text-main)' : 'var(--text-muted)',
                  background: activeFileId === f.id ? 'var(--bg-elevated)' : 'transparent',
                  fontWeight: activeFileId === f.id ? 700 : 400,
                  textTransform: 'uppercase',
                  whiteSpace: 'nowrap'
                }}>
                <span>{f.name}</span>
                {files.length > 1 && (
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      const newFiles = files.filter(file => file.id !== f.id);
                      setFiles(newFiles);
                      if (activeFileId === f.id) {
                        setActiveFileId(newFiles[0].id);
                      }
                    }}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      borderRadius: '50%', padding: '2px',
                      background: activeFileId === f.id ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.04)',
                      color: activeFileId === f.id ? 'var(--text-main)' : 'var(--text-muted)',
                      transition: 'background 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = activeFileId === f.id ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.08)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = activeFileId === f.id ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.04)';
                    }}
                  >
                    <X size={12} />
                  </div>
                )}
              </div>
            ))}
            <div 
              onClick={() => {
                const newId = Date.now().toString();
                setFiles([...files, { id: newId, name: `schema_${files.length + 1}.txt`, content: '' }]);
                setActiveFileId(newId);
              }}
              style={{
                padding: '10px 16px', fontSize: '16px', cursor: 'pointer', color: 'var(--text-muted)',
                display: 'flex', alignItems: 'center', background: 'transparent'
              }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--text-main)'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
            >
              +
            </div>
          </div>

          <Editor 
            value={files.find(f => f.id === activeFileId)?.content || ''} 
            onChange={(val) => {
              setFiles(files.map(f => f.id === activeFileId ? { ...f, content: val } : f));
            }} 
            parseError={parseError} 
          />
        </aside>

        <MethodTree 
          nodes={schema.nodes} 
          onNavigate={(id) => setSelectedNodeId(id)} 
        />

        {/* Canvas Area */}
        <section style={{ flex: 1, display: 'flex', position: 'relative' }}>
          
          {/* Main Canvas Container */}
          <div className="skema-canvas-container" style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
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
              <div className="glass" style={{ 
                padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '8px',
                borderRadius: '20px',
              }}>
                <div style={{
                  width: '6px', height: '6px', borderRadius: '50%',
                  background: isParsing ? 'var(--text-muted)' : (wasmReady ? 'var(--kind-interface)' : 'var(--accent-rust)'),
                }} />
                <span style={{ fontSize: '11px', color: 'var(--text-main)', fontWeight: 500, letterSpacing: '0.5px' }}>
                  WASM {isParsing ? 'Parsing...' : (wasmReady ? 'Active' : 'Init')}
                </span>
              </div>
              
              <div className="glass" style={{ 
                padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '8px',
                borderRadius: '20px',
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
