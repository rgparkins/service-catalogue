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

const ALL_EVENTS = 'ALL_EVENTS';
const ALL_DEPS = 'ALL_DEPS';

export default function ServiceMap() {
  // Build initial graph from JSON
  const { nodes: initialNodes, edges: initialEdges } = useMemo(
    () => buildGraphFromServices(services),
    []
  );

  // React Flow node & edge state (so dragging works)
  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  const [selectedNode, setSelectedNode] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(ALL_EVENTS);
  const [selectedDepService, setSelectedDepService] = useState(ALL_DEPS);

  // Build:
  // - eventMeta: eventName -> { producers:Set, consumers:Set }
  // - depMeta: serviceId -> { dependsOn:Set, dependedBy:Set }
  // - allEvents, allDepServices: lists for dropdowns
  const graphIndex = useMemo(() => {
    const eventMeta = new Map();
    const depMeta = new Map();
    const serviceNames = new Set();

    services.forEach((svc) => {
      const id = svc.name;
      if (!id) return;
      serviceNames.add(id);

      if (!depMeta.has(id)) {
        depMeta.set(id, {
          dependsOn: new Set(),
          dependedBy: new Set(),
        });
      }

      // Events
      const events = svc.events || {};
      const producing = events.producing || [];
      const consuming = events.consuming || [];

      producing.forEach((ev) => {
        const name = ev.name;
        if (!name) return;
        if (!eventMeta.has(name)) {
          eventMeta.set(name, {
            producers: new Set(),
            consumers: new Set(),
          });
        }
        eventMeta.get(name).producers.add(id);
      });

      consuming.forEach((ev) => {
        const name = ev.name;
        if (!name) return;
        if (!eventMeta.has(name)) {
          eventMeta.set(name, {
            producers: new Set(),
            consumers: new Set(),
          });
        }
        eventMeta.get(name).consumers.add(id);
      });

      // Dependencies (outgoing)
      const depsCrit = svc.dependencies?.critical || [];
      const depsNon = svc.dependencies?.['non-critical'] || [];
      [...depsCrit, ...depsNon].forEach((dep) => {
        if (!dep.name) return;

        // id depends on dep.name
        depMeta.get(id).dependsOn.add(dep.name);

        if (!depMeta.has(dep.name)) {
          depMeta.set(dep.name, {
            dependsOn: new Set(),
            dependedBy: new Set(),
          });
        }
        depMeta.get(dep.name).dependedBy.add(id);
      });
    });

    const allEvents = Array.from(eventMeta.keys()).sort((a, b) =>
      a.localeCompare(b)
    );
    const allDepServices = Array.from(serviceNames).sort((a, b) =>
      a.localeCompare(b)
    );

    return { eventMeta, depMeta, allEvents, allDepServices };
  }, []);

  const { eventMeta, depMeta, allEvents, allDepServices } = graphIndex;

  // Compute visible nodes based on BOTH filters (intersection)
  const visibleNodes = useMemo(() => {
    // Start from all node ids
    let allowedIds = new Set(nodes.map((n) => n.id));

    // Filter by event (if not ALL)
    if (selectedEvent !== ALL_EVENTS) {
      const meta = eventMeta.get(selectedEvent);
      if (!meta) {
        return []; // no services for this event
      }
      const idsFromEvent = new Set([
        ...Array.from(meta.producers),
        ...Array.from(meta.consumers),
      ]);
      allowedIds = new Set([...allowedIds].filter((id) => idsFromEvent.has(id)));
    }

    // Filter by dependency service (if not ALL)
    if (selectedDepService !== ALL_DEPS) {
      const dmeta = depMeta.get(selectedDepService);
      if (!dmeta) {
        return [];
      }
      const idsFromDep = new Set([
        selectedDepService,
        ...Array.from(dmeta.dependsOn),
        ...Array.from(dmeta.dependedBy),
      ]);
      allowedIds = new Set([...allowedIds].filter((id) => idsFromDep.has(id)));
    }

    return nodes.filter((n) => allowedIds.has(n.id));
  }, [nodes, selectedEvent, selectedDepService, eventMeta, depMeta]);

  // Edges whose endpoints are both visible
  const visibleEdges = useMemo(() => {
    const visibleIds = new Set(visibleNodes.map((n) => n.id));
    return edges.filter(
      (e) => visibleIds.has(e.source) && visibleIds.has(e.target)
    );
  }, [edges, visibleNodes]);

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

  const handleEventChange = (e) => {
    const value = e.target.value;
    setSelectedEvent(value);
    setSelectedNode(null);
  };

  const handleDepChange = (e) => {
    const value = e.target.value;
    setSelectedDepService(value);
    setSelectedNode(null);
  };

  // For left panel display of event publishers/consumers
  const currentEventMeta =
    selectedEvent === ALL_EVENTS ? null : eventMeta.get(selectedEvent) || null;
  const currentProducers = currentEventMeta
    ? Array.from(currentEventMeta.producers).sort()
    : [];
  const currentConsumers = currentEventMeta
    ? Array.from(currentEventMeta.consumers).sort()
    : [];

  // For left panel display of dependency relationships
  const currentDepMeta =
    selectedDepService === ALL_DEPS
      ? null
      : depMeta.get(selectedDepService) || null;
  const dependsOnList = currentDepMeta
    ? Array.from(currentDepMeta.dependsOn).sort()
    : [];
  const dependedByList = currentDepMeta
    ? Array.from(currentDepMeta.dependedBy).sort()
    : [];

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
      {/* LEFT: Filters + metadata */}
      <div
        style={{
          width: 320,
          borderRight: '1px solid #111827',
          padding: '10px 12px',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          background: '#020617',
        }}
      >
        {/* Event filter */}
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>
            Event filter
          </div>
          <label
            style={{
              display: 'flex',
              flexDirection: 'column',
              fontSize: 12,
              gap: 4,
            }}
          >
            <span style={{ color: '#9ca3af' }}>Show services for event</span>
            <select
              value={selectedEvent}
              onChange={handleEventChange}
              style={{
                padding: '4px 6px',
                borderRadius: 6,
                border: '1px solid #374151',
                background: '#020617',
                color: '#e5e7eb',
                fontSize: 12,
              }}
            >
              <option value={ALL_EVENTS}>All events</option>
              {allEvents.map((ev) => (
                <option key={ev} value={ev}>
                  {ev}
                </option>
              ))}
            </select>
          </label>

          {/* Publishers / Consumers for selected event */}
          {selectedEvent !== ALL_EVENTS && (
            <div
              style={{
                marginTop: 8,
                paddingTop: 8,
                borderTop: '1px solid #111827',
                display: 'flex',
                gap: 12,
                fontSize: 11,
              }}
            >
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    textTransform: 'uppercase',
                    letterSpacing: 0.06,
                    color: '#6ee7b7',
                    marginBottom: 4,
                  }}
                >
                  Publishers
                </div>
                {currentProducers.length === 0 ? (
                  <div style={{ color: '#6b7280' }}>None</div>
                ) : (
                  <ul
                    style={{
                      listStyle: 'none',
                      padding: 0,
                      margin: 0,
                      maxHeight: 120,
                      overflowY: 'auto',
                    }}
                  >
                    {currentProducers.map((id) => (
                      <li
                        key={id}
                        style={{ color: '#e5e7eb', marginBottom: 2 }}
                      >
                        {id}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    textTransform: 'uppercase',
                    letterSpacing: 0.06,
                    color: '#bfdbfe',
                    marginBottom: 4,
                  }}
                >
                  Consumers
                </div>
                {currentConsumers.length === 0 ? (
                  <div style={{ color: '#6b7280' }}>None</div>
                ) : (
                  <ul
                    style={{
                      listStyle: 'none',
                      padding: 0,
                      margin: 0,
                      maxHeight: 120,
                      overflowY: 'auto',
                    }}
                  >
                    {currentConsumers.map((id) => (
                      <li
                        key={id}
                        style={{ color: '#e5e7eb', marginBottom: 2 }}
                      >
                        {id}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Dependency filter */}
        <div
          style={{
            marginTop: 6,
            paddingTop: 8,
            borderTop: '1px solid #111827',
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>
            Dependency filter
          </div>
          <label
            style={{
              display: 'flex',
              flexDirection: 'column',
              fontSize: 12,
              gap: 4,
            }}
          >
            <span style={{ color: '#9ca3af' }}>
              Show dependencies for service
            </span>
            <select
              value={selectedDepService}
              onChange={handleDepChange}
              style={{
                padding: '4px 6px',
                borderRadius: 6,
                border: '1px solid #374151',
                background: '#020617',
                color: '#e5e7eb',
                fontSize: 12,
              }}
            >
              <option value={ALL_DEPS}>All services</option>
              {allDepServices.map((svcName) => (
                <option key={svcName} value={svcName}>
                  {svcName}
                </option>
              ))}
            </select>
          </label>

          {/* Depends on / Depended by */}
          {selectedDepService !== ALL_DEPS && (
            <div
              style={{
                marginTop: 8,
                display: 'flex',
                gap: 12,
                fontSize: 11,
              }}
            >
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    textTransform: 'uppercase',
                    letterSpacing: 0.06,
                    color: '#f97316',
                    marginBottom: 4,
                  }}
                >
                  Depends on
                </div>
                {dependsOnList.length === 0 ? (
                  <div style={{ color: '#6b7280' }}>None</div>
                ) : (
                  <ul
                    style={{
                      listStyle: 'none',
                      padding: 0,
                      margin: 0,
                      maxHeight: 120,
                      overflowY: 'auto',
                    }}
                  >
                    {dependsOnList.map((id) => (
                      <li
                        key={id}
                        style={{ color: '#e5e7eb', marginBottom: 2 }}
                      >
                        {id}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    textTransform: 'uppercase',
                    letterSpacing: 0.06,
                    color: '#facc15',
                    marginBottom: 4,
                  }}
                >
                  Depended on by
                </div>
                {dependedByList.length === 0 ? (
                  <div style={{ color: '#6b7280' }}>None</div>
                ) : (
                  <ul
                    style={{
                      listStyle: 'none',
                      padding: 0,
                      margin: 0,
                      maxHeight: 120,
                      overflowY: 'auto',
                    }}
                  >
                    {dependedByList.map((id) => (
                      <li
                        key={id}
                        style={{ color: '#e5e7eb', marginBottom: 2 }}
                      >
                        {id}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Counts + Legend */}
        <div
          style={{
            marginTop: 10,
            fontSize: 11,
            color: '#9ca3af',
          }}
        >
          Showing <strong>{visibleNodes.length}</strong> services
          {selectedEvent !== ALL_EVENTS && (
            <>
              {' '}
              for event <strong>{selectedEvent}</strong>
            </>
          )}
          {selectedDepService !== ALL_DEPS && (
            <>
              {' '}
              and dependencies of <strong>{selectedDepService}</strong>
            </>
          )}
        </div>

        <div
          style={{
            marginTop: 8,
            fontSize: 11,
            color: '#6b7280',
            borderTop: '1px solid #111827',
            paddingTop: 8,
          }}
        >
          <div style={{ marginBottom: 4 }}>Legend</div>
          <div>• Bubble size = inbound dependencies</div>
          <div>— Solid line = service dependency</div>
          <div style={{ whiteSpace: 'nowrap' }}>
            ⋯⋯ Dotted orange = event link
          </div>
        </div>
      </div>

      {/* MIDDLE: Graph */}
      <div style={{ flex: '1 1 auto', position: 'relative' }}>
        <ReactFlow
          nodes={visibleNodes}
          edges={visibleEdges}
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

      {data.type && <InfoRow label="Type" value={data.type} />}
      {data.domain && <InfoRow label="Domain" value={data.domain} />}
      {data.team && <InfoRow label="Team" value={data.team} />}
      {data.owner && <InfoRow label="Owner" value={data.owner} />}
      {typeof data.depCount === 'number' && (
        <InfoRow label="Inbound deps" value={String(data.depCount)} />
      )}

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
