import { useState, useEffect, useCallback, useRef } from 'react';
import init, { parse_schema_wasm } from './core_pkg/core';
import { Editor } from './components/Editor';
import { Canvas } from './components/Canvas';
import { NodeDetailDrawer } from './components/NodeDetailDrawer';
import type { ParsedSchema, SchemaNode } from './types';
import { LayoutDashboard, Share2, ExternalLink } from 'lucide-react';
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

function App() {
  const [input, setInput] = useState(DEFAULT_SCHEMA);
  const [schema, setSchema] = useState<ParsedSchema>({ nodes: [], edges: [] });
  const [wasmReady, setWasmReady] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  // Track which nodes the user has manually dragged — they stay pinned during re-layout
  const pinnedIds = useRef<Set<string>>(new Set());
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    init().then(() => setWasmReady(true));
  }, []);

  const runParse = useCallback((text: string) => {
    if (!wasmReady) return;
    try {
      const result = parse_schema_wasm(text);
      setParseError(null);
      setSchema(prev => {
        const incomingNodes = result.nodes as SchemaNode[];
        // Preserve positions of existing nodes (especially pinned ones)
        const withPositions = incomingNodes.map(node => {
          const existing = prev.nodes.find(n => n.id === node.id);
          if (existing && (existing.x !== undefined)) {
            // Keep the old position — layout won't touch pinned nodes
            return { ...node, x: existing.x, y: existing.y };
          }
          return node; // new node — let layout place it
        });
        // Nodes with no position yet need to be laid out
        const needsLayout = withPositions.some(n => n.x === undefined);
        const laid = needsLayout
          ? autoLayout(withPositions, result.edges, pinnedIds.current)
          : withPositions;
        return { nodes: laid, edges: result.edges };
      });
    } catch (e) {
      setParseError(String(e));
    }
  }, [wasmReady]);

  // Debounced parse: fires 600ms after the user stops typing
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      runParse(input);
    }, 600);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [input, runParse]);

  // Parse immediately once WASM becomes ready
  useEffect(() => {
    if (wasmReady) runParse(input);
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
          <button style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '8px 16px', borderRadius: '8px',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: '#e2e8f0', fontSize: '13px', fontWeight: 500, cursor: 'pointer',
          }}>
            <Share2 size={14} /> Export
          </button>
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
          <Editor value={input} onChange={setInput} parseError={parseError} />
        </aside>

        {/* Canvas Area */}
        <section style={{ flex: 1, position: 'relative' }}>
          <Canvas
            nodes={schema.nodes}
            edges={schema.edges}
            selectedNodeId={selectedNodeId}
            onNodeMove={handleNodeMove}
            onNodeClick={setSelectedNodeId}
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
