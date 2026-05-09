import { useState, useEffect, useCallback, useRef } from 'react';
import init, { parse_schema_wasm } from './core_pkg/core';
import { Editor } from './components/Editor';
import { MethodTree } from './components/MethodTree';
import { Canvas } from './components/Canvas';
import { NodeDetailDrawer } from './components/NodeDetailDrawer';
import { LayoutDashboard, Share2, ExternalLink, Download, Image as ImageIcon, FileJson, Link } from 'lucide-react';
import { autoLayout } from './utils/layout';

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
        } catch(e) {}
        return [{ id: '1', name: 'shared.ts', content: decoded }];
      } catch(e) {}
    }
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.files) return parsed.files;
        if (parsed.input) return [{ id: '1', name: 'schema.ts', content: parsed.input }];
      }
    } catch (e) {}
    return [{ id: '1', name: 'schema.ts', content: DEFAULT_SCHEMA }];
  });
  const [activeFileId, setActiveFileId] = useState<string>('1');

  const [schema, setSchema] = useState<ParsedSchema>({ nodes: [], edges: [] });
  const [wasmReady, setWasmReady] = useState(false);
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
    const svgEl = document.querySelector('svg');
    if (!svgEl) return;
    const svgData = new XMLSerializer().serializeToString(svgEl);
    const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = 'skema.svg'; link.click();
    setShowExportMenu(false);
  };

  const exportPng = () => {
    const svgEl = document.querySelector('svg');
    if (!svgEl) return;
    const svgData = new XMLSerializer().serializeToString(svgEl);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width; canvas.height = img.height;
      if (ctx) ctx.drawImage(img, 0, 0);
      const link = document.createElement('a');
      link.href = canvas.toDataURL('image/png'); link.download = 'skema.png'; link.click();
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
    setShowExportMenu(false);
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
    } catch (e) {}
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

  const runParse = useCallback((currentFiles: SchemaFile[]) => {
    if (!wasmReady) return;
    try {
      let allNodes: SchemaNode[] = [];
      let allEdges: any[] = [];
      
      currentFiles.forEach(f => {
        if (!f.content.trim()) return;
        const result = parse_schema_wasm(f.content);
        allNodes = allNodes.concat(result.nodes);
        allEdges = allEdges.concat(result.edges);
      });
      
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
    debounceTimer.current = setTimeout(() => {
      runParse(files);
    }, 600);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [files, runParse]);

  // Parse immediately once WASM becomes ready
  useEffect(() => {
    if (wasmReady) runParse(files);
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
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100vh', background: '#020617', color: '#e2e8f0' }}>
      {/* Header */}
      <header style={{
        height: '64px',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        background: 'rgba(15, 23, 42, 0.8)',
        backdropFilter: 'blur(12px)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '40px', height: '40px',
            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
            borderRadius: '10px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 20px rgba(59, 130, 246, 0.3)',
          }}>
            <LayoutDashboard size={22} color="white" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 800, letterSpacing: '-0.5px', color: 'white' }}>SKEMA</h1>
            <p style={{ margin: 0, fontSize: '10px', color: '#64748b', fontWeight: 600, letterSpacing: '2px', textTransform: 'uppercase' }}>Schema Visualizer</p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ fontSize: '12px', color: '#64748b' }}>
            {schema.nodes.length} nodes · {schema.edges.length} edges
          </div>
          <button
            onClick={handleRelayout}
            title="Re-run auto-layout (clears manual positions)"
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '8px 16px', borderRadius: '8px',
              background: 'rgba(99,102,241,0.12)',
              border: '1px solid rgba(99,102,241,0.3)',
              color: '#a5b4fc', fontSize: '13px', fontWeight: 500, cursor: 'pointer',
            }}
          >
            ⟳ Re-layout
          </button>
          <div style={{ position: 'relative' }}>
            <button 
              onClick={() => setShowExportMenu(!showExportMenu)}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '8px 16px', borderRadius: '8px',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#e2e8f0', fontSize: '13px', fontWeight: 500, cursor: 'pointer',
              }}>
              <Share2 size={14} /> Export
            </button>
            {showExportMenu && (
              <div style={{
                position: 'absolute', top: '100%', right: 0, marginTop: '8px',
                background: 'rgba(15,23,42,0.95)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px', padding: '4px', display: 'flex', flexDirection: 'column',
                minWidth: '160px', zIndex: 100, backdropFilter: 'blur(12px)'
              }}>
                {(() => {
                  const menuBtnStyle = {
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '8px 12px', background: 'transparent', border: 'none',
                    color: '#e2e8f0', fontSize: '13px', cursor: 'pointer',
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
            style={{ padding: '8px', borderRadius: '8px', color: '#64748b', textDecoration: 'none', display: 'flex' }}
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
          borderRight: '1px solid rgba(255,255,255,0.05)',
          background: 'rgba(15, 23, 42, 0.4)',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
        }}>
          {/* File Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid #1e293b', background: '#0f172a', overflowX: 'auto' }}>
            {files.map(f => (
              <div 
                key={f.id}
                onClick={() => setActiveFileId(f.id)}
                style={{
                  padding: '8px 16px', fontSize: '12px', cursor: 'pointer',
                  borderRight: '1px solid #1e293b',
                  color: activeFileId === f.id ? '#e2e8f0' : '#64748b',
                  background: activeFileId === f.id ? 'transparent' : 'rgba(0,0,0,0.2)',
                  borderBottom: activeFileId === f.id ? '2px solid #3b82f6' : '2px solid transparent'
                }}>
                {f.name}
              </div>
            ))}
            <div 
              onClick={() => {
                const newId = Date.now().toString();
                setFiles([...files, { id: newId, name: `schema_${files.length + 1}.txt`, content: '' }]);
                setActiveFileId(newId);
              }}
              style={{
                padding: '8px 16px', fontSize: '16px', cursor: 'pointer', color: '#64748b',
                display: 'flex', alignItems: 'center'
              }}>
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
        <section style={{ flex: 1, position: 'relative' }}>
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

          {/* Status badges */}
          <div style={{
            position: 'absolute', top: '20px', left: '20px',
            display: 'flex', gap: '10px',
          }}>
            <div className="glass" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: '8px', height: '8px', borderRadius: '50%',
                background: wasmReady ? '#10b981' : '#f59e0b',
                boxShadow: wasmReady ? '0 0 6px #10b981' : '0 0 6px #f59e0b',
              }} />
              <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: '#94a3b8' }}>
                {wasmReady ? 'WASM Active' : 'Initializing…'}
              </span>
            </div>
            {parseError && (
              <div className="glass" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px', borderColor: 'rgba(239,68,68,0.3)' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#f87171', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  Parse error
                </span>
              </div>
            )}
          </div>

          {/* Node Detail Drawer (Step 19) */}
          {(() => {
            if (!selectedNodeId) return null;
            const node = schema.nodes.find(n => n.id === selectedNodeId);
            if (!node) return null;
            return (
              <NodeDetailDrawer
                node={node}
                edges={schema.edges}
                allNodes={schema.nodes}
                onClose={() => setSelectedNodeId(null)}
                onNavigate={id => setSelectedNodeId(id)}
              />
            );
          })()}
        </section>
      </main>
    </div>
  );
}

export default App;
