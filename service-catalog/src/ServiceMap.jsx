// ServiceMap.jsx
import React, { useMemo, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { buildGraphFromServices } from './buildGraphFromServices';
import services from './service-metadata.json';

export default function ServiceMap() {
  // Build initial graph from JSON
  const { nodes: initialNodes, edges: initialEdges } = useMemo(
    () => buildGraphFromServices(services),
    []
  );

  // ✅ Make nodes & edges stateful so dragging works
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const [selectedNode, setSelectedNode] = useState(null);

  const edgeOptions = {
    animated: false,
    style: { strokeWidth: 1.5, stroke: '#94a3b8' },
  };

  const connectionLineStyle = { stroke: '#94a3b8' };

  const onInit = (instance) => {
    instance.fitView({ padding: 0.2 });
  };

  const handleNodeClick = (_, node) => {
    setSelectedNode(node);
  };

  const handleCanvasClick = () => {
    setSelectedNode(null);
  };

  return (
    <div
      style={{
        display: 'flex',
        width: '100vw',
        height: '100vh',
        background: '#020617',
        color: '#e5e7eb',
        fontFamily:
          'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      {/* LEFT: Graph */}
      <div style={{ flex: '1 1 auto', position: 'relative' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}     
          onEdgesChange={onEdgesChange}
          defaultEdgeOptions={edgeOptions}
          connectionLineStyle={connectionLineStyle}
          fitView
          onInit={onInit}
          onNodeClick={handleNodeClick}
          onPaneClick={handleCanvasClick}
          nodesDraggable={true}             
          nodesConnectable={false}
          elementsSelectable={true}
          panOnScroll={true}
          zoomOnScroll={true}
        >
          <Background gap={16} size={1} />
          <MiniMap
            nodeColor={(node) => node.style?.background || '#64748b'}
            nodeBorderRadius={999}
          />
          <Controls />
        </ReactFlow>
      </div>

      {/* RIGHT: Side panel */}
      <div
        style={{
          width: selectedNode ? 340 : 0,
          transition: 'width 0.2s ease-out',
          overflow: 'hidden',
          borderLeft: selectedNode ? '1px solid #1f2937' : 'none',
          background: '#020617',
        }}
      >
        {selectedNode && (
          <SidePanel node={selectedNode} onClose={() => setSelectedNode(null)} />
        )}
      </div>
    </div>
  );
}

function SidePanel({ node, onClose }) {
  const data = node.data || {};
  const svc = data.raw || {};
  const deps = svc.dependencies || {};
  const criticalDeps = deps.critical || [];
  const nonCriticalDeps = deps['non-critical'] || [];

  const events = svc.events || {};
  const consuming = events.consuming || [];
  const producing = events.producing || [];

  return (
    <div
      style={{
        height: '100%',
        padding: '12px 14px',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div>
          <div style={{ fontSize: 12, color: '#9ca3af' }}>Service</div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>
            {svc.name || node.id}
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            border: 'none',
            borderRadius: 999,
            width: 24,
            height: 24,
            cursor: 'pointer',
            background: '#111827',
            color: '#9ca3af',
            fontSize: 14,
            lineHeight: '24px',
          }}
          title="Close"
        >
          ✕
        </button>
      </div>

      {/* Basic info */}
      {data.type && <InfoRow label="Type" value={data.type} />}
      {data.domain && <InfoRow label="Domain" value={data.domain} />}
      {data.team && <InfoRow label="Team" value={data.team} />}
      {data.owner && <InfoRow label="Owner" value={data.owner} />}
      {typeof data.depCount === 'number' && (
        <InfoRow label="Inbound deps" value={String(data.depCount)} />
      )}

      {/* Vision */}
      {data.vision && (
        <div style={{ marginTop: 4 }}>
          <div
            style={{
              fontSize: 11,
              textTransform: 'uppercase',
              letterSpacing: 0.06,
              color: '#6b7280',
            }}
          >
            Vision
          </div>
          <div
            style={{ fontSize: 12, marginTop: 2, color: '#d1d5db' }}
          >
            {data.vision}
          </div>
        </div>
      )}

      {/* Links */}
      {(data.repo || svc.runbook) && (
        <div style={{ marginTop: 4 }}>
          <div
            style={{
              fontSize: 11,
              textTransform: 'uppercase',
              letterSpacing: 0.06,
              color: '#6b7280',
            }}
          >
            Links
          </div>
          <ul
            style={{
              listStyle: 'none',
              padding: 0,
              margin: '4px 0 0',
              fontSize: 12,
            }}
          >
            {data.repo && (
              <li>
                <a
                  href={data.repo}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: '#60a5fa', textDecoration: 'none' }}
                >
                  Repo
                </a>
              </li>
            )}
            {svc.runbook && (
              <li>
                <a
                  href={svc.runbook}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: '#60a5fa', textDecoration: 'none' }}
                >
                  Runbook
                </a>
              </li>
            )}
          </ul>
        </div>
      )}

      {/* Contracts */}
      {svc.contracts && svc.contracts.length > 0 && (
        <Section title="Contracts">
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {svc.contracts.map((c, idx) => (
              <li key={idx} style={{ fontSize: 12, marginBottom: 2 }}>
                <strong>{c.role}</strong>{' '}
                <span style={{ color: '#9ca3af' }}>({c.protocol})</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Dependencies */}
      {(criticalDeps.length > 0 || nonCriticalDeps.length > 0) && (
        <Section title="Dependencies">
          {criticalDeps.length > 0 && (
            <div style={{ marginBottom: 4 }}>
              <div
                style={{
                  fontSize: 11,
                  color: '#fca5a5',
                  marginBottom: 2,
                }}
              >
                Critical
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {criticalDeps.map((d, idx) => (
                  <li key={`c-${idx}`} style={{ fontSize: 12 }}>
                    {d.name}{' '}
                    {d.role && (
                      <span style={{ color: '#9ca3af' }}>({d.role})</span>
                    )}{' '}
                    {d.protocol && (
                      <span style={{ color: '#6b7280' }}>{d.protocol}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {nonCriticalDeps.length > 0 && (
            <div>
              <div
                style={{
                  fontSize: 11,
                  color: '#9ca3af',
                  marginBottom: 2,
                }}
              >
                Non-critical
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {nonCriticalDeps.map((d, idx) => (
                  <li key={`n-${idx}`} style={{ fontSize: 12 }}>
                    {d.name}{' '}
                    {d.role && (
                      <span style={{ color: '#9ca3af' }}>({d.role})</span>
                    )}{' '}
                    {d.protocol && (
                      <span style={{ color: '#6b7280' }}>{d.protocol}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Section>
      )}

      {/* Events */}
      {(producing.length > 0 || consuming.length > 0) && (
        <Section title="Events">
          {producing.length > 0 && (
            <div style={{ marginBottom: 4 }}>
              <div
                style={{
                  fontSize: 11,
                  color: '#bbf7d0',
                  marginBottom: 2,
                }}
              >
                Produces
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {producing.map((e, idx) => (
                  <li key={`p-${idx}`} style={{ fontSize: 12 }}>
                    <strong>{e.name}</strong>{' '}
                    {e.description && (
                      <span style={{ color: '#9ca3af' }}>
                        – {e.description}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {consuming.length > 0 && (
            <div>
              <div
                style={{
                  fontSize: 11,
                  color: '#bfdbfe',
                  marginBottom: 2,
                }}
              >
                Consumes
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {consuming.map((e, idx) => (
                  <li key={`c-${idx}`} style={{ fontSize: 12 }}>
                    <strong>{e.name}</strong>{' '}
                    {e.description && (
                      <span style={{ color: '#9ca3af' }}>
                        – {e.description}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Section>
      )}

      <div style={{ flex: 1 }} />

      <div
        style={{
          fontSize: 10,
          color: '#4b5563',
          paddingTop: 4,
        }}
      >
        Click another node to inspect it, or click empty space to clear.
      </div>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: 12,
      }}
    >
      <span style={{ color: '#9ca3af' }}>{label}</span>
      <span
        style={{
          color: '#e5e7eb',
          marginLeft: 8,
          textAlign: 'right',
        }}
      >
        {value}
      </span>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginTop: 6 }}>
      <div
        style={{
          fontSize: 11,
          textTransform: 'uppercase',
          letterSpacing: 0.06,
          color: '#6b7280',
          marginBottom: 2,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}