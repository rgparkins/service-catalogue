import React, { useMemo, useState, useEffect } from 'react';
import ColorKeyRow from './components/ColorKeyRow.jsx';
import Field from './components/Field.jsx';
import SectionList from './components/SectionList.jsx';
import { buildElements, daysSince, normEvent, topByConsumersFromNodes, topByOldestUpdateFromNodes, orphanPublishedEventsFromNodes, topByDependencyConsumersFromGraph } from './serviceGraph.logic.js';
import { makeStylesheet } from './serviceGraph.styles.js';
import CytoscapeView from '../CytoscapeView.jsx';
import localServices from '../service-metadata.json';


const ALL_EVENTS = 'ALL_EVENTS';
const ALL_SERVICES = 'ALL_SERVICES';

export default function ServiceGraph() {
  // servicesData comes from either local file or remote URL (if provided by env).
  // Runtime override (localStorage / query / window prop) is supported so users
  // can point the running app at a different metadata URL without rebuilding.
  const getInitialRuntimeUrl = () => {
    if (typeof window === 'undefined') return null;
    try {
      const stored = localStorage.getItem('SERVICE_METADATA_URL');
      if (stored) return stored;
      if (window.__SERVICE_METADATA_URL) return window.__SERVICE_METADATA_URL;
      const qp = new URLSearchParams(window.location.search).get('metadata_url');
      if (qp) return qp;
    } catch (e) {
      // ignore
    }
    return null;
  };

  const [servicesData, setServicesData] = useState(localServices);
  const [dataSource, setDataSource] = useState('local'); // 'local' or 'remote'
  const [fetchError, setFetchError] = useState(null);
  const [runtimeUrl, setRuntimeUrl] = useState(getInitialRuntimeUrl);
  const [runtimeInput, setRuntimeInput] = useState(runtimeUrl || '');

  // Recompute graph elements when services data changes
  const { elements, maxWeight, allEvents, allServices } = useMemo(
    () => buildElements(servicesData),
    [servicesData]
  );

  // Fetch remote metadata if Vite env var is provided
  const fetchRemote = async (urlOverride) => {
    const url = urlOverride || runtimeUrl || import.meta.env.VITE_SERVICE_METADATA_URL;
    if (!url) return;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);

    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (!Array.isArray(json)) throw new Error('expected JSON array');
      setServicesData(json);
      setDataSource('remote');
      setFetchError(null);
    } catch (err) {
      if (err.name === 'AbortError') {
        setFetchError('Request timed out');
      } else {
        setFetchError(String(err.message || err));
      }
      // keep local services as fallback
      setDataSource('local');
    } finally {
      clearTimeout(timeout);
    }
  };

  const applyRuntimeUrl = (url) => {
    try {
      if (!url) return;
      localStorage.setItem('SERVICE_METADATA_URL', url);
      setRuntimeUrl(url);
      setRuntimeInput(url);
      fetchRemote(url);
    } catch (e) {
      console.warn('Unable to persist runtime URL', e);
    }
  };

  const clearRuntimeUrl = () => {
    try {
      localStorage.removeItem('SERVICE_METADATA_URL');
    } catch (e) {}
    setRuntimeUrl(null);
    setRuntimeInput('');
    // try fetching from env (or fallback to local)
    fetchRemote();
  };

  useEffect(() => {
    // try fetching once at mount
    fetchRemote();
  }, []);


  const [selectedEvent, setSelectedEvent] = useState(ALL_EVENTS);
  const [selectedServiceFilter, setSelectedServiceFilter] =
    useState(ALL_SERVICES);

  // Edge visibility
  const [showDependencies, setShowDependencies] = useState(true);
  const [showEvents, setShowEvents] = useState(true);

  // Node clicked
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [cyInstance, setCyInstance] = useState(null);

  // Node positions to keep layout stable
  const [positions, setPositions] = useState({});

  // Map id -> full service metadata
  const serviceById = useMemo(() => {
    const map = new Map();
    servicesData.forEach((svc) => {
      if (svc.name) map.set(svc.name, svc);
    });
    return map;
  }, [servicesData]);

  // Split elements into nodes/edges
  const nodes = useMemo(
    () => elements.filter((el) => !el.data.source && !el.data.target),
    [elements]
  );
  const edges = useMemo(
    () => elements.filter((el) => el.data.source && el.data.target),
    [elements]
  );

  // Click handler
  useEffect(() => {
    if (!cyInstance) return;

    const handler = (evt) => {
      const node = evt.target;
      const id = node.id();
      setSelectedNodeId(id);
    };

    cyInstance.on('tap', 'node', handler);
    return () => {
      cyInstance.removeListener('tap', 'node', handler);
    };
  }, [cyInstance]);

  // Initial layout + dragfree position tracking
  useEffect(() => {
    if (!cyInstance) return;

    const cy = cyInstance;

    const initialLayout = {
      name: 'concentric',
      padding: 50,
      minNodeSpacing: 60,
      concentric: (node) => node.data('weight') || 0,
      levelWidth: () => (maxWeight || 1) / 4,
    };

    // Run initial layout once
    cy.layout(initialLayout).run();

    // Capture initial positions
    const initialPos = {};
    cy.nodes().forEach((n) => {
      initialPos[n.id()] = {
        x: n.position('x'),
        y: n.position('y'),
      };
    });
    setPositions(initialPos);

    // Track dragfree events
    const dragHandler = (evt) => {
      const n = evt.target;
      setPositions((prev) => ({
        ...prev,
        [n.id()]: { x: n.position('x'), y: n.position('y') },
      }));
    };

    cy.on('dragfree', 'node', dragHandler);

    return () => {
      cy.removeListener('dragfree', 'node', dragHandler);
    };
  }, [cyInstance, maxWeight]);

  // Highlight / fade neighbourhood on selection
  useEffect(() => {
    if (!cyInstance) return;

    const cy = cyInstance;
    cy.elements().removeClass('faded highlight selected');

    if (!selectedNodeId) return;

    const selected = cy.getElementById(selectedNodeId);
    if (!selected || selected.empty()) return;

    const neighborhood = selected.closedNeighborhood();
    const notNeighborhood = cy.elements().difference(neighborhood);

    notNeighborhood.addClass('faded');
    selected.addClass('selected');
    neighborhood.addClass('highlight');
  }, [cyInstance, selectedNodeId, elements]);

  /* ---------- TOP 5 LISTS ---------- */

    const topByConsumers = useMemo(() => topByConsumersFromNodes(nodes), [nodes]);

  const topByOldestUpdate = useMemo(() => topByOldestUpdateFromNodes(nodes), [nodes]);

  const orphanPublishedEvents = useMemo(() => orphanPublishedEventsFromNodes(nodes), [nodes]);

  const topByDependencyConsumers = useMemo(() => topByDependencyConsumersFromGraph(nodes, edges), [nodes, edges]);

  // Filter elements
    const filteredElements = useMemo(() => {
    let allowedNodeIds = new Set(nodes.map((n) => n.data.id));

    if (selectedEvent !== ALL_EVENTS) {
      const eventNodeIds = new Set(
        nodes
          .filter((n) => {
            const d = n.data;
            const prod = d.producedEvents || [];
            const cons = d.consumedEvents || [];
            return (
              prod.includes(selectedEvent) || cons.includes(selectedEvent)
            );
          })
          .map((n) => n.data.id)
      );
      allowedNodeIds = new Set(
        [...allowedNodeIds].filter((id) => eventNodeIds.has(id))
      );
    }

    if (selectedServiceFilter !== ALL_SERVICES) {
      const serviceContext = new Set([selectedServiceFilter]);
      edges.forEach((e) => {
        const { source, target } = e.data;
        if (source === selectedServiceFilter) serviceContext.add(target);
        if (target === selectedServiceFilter) serviceContext.add(source);
      });
      allowedNodeIds = new Set(
        [...allowedNodeIds].filter((id) => serviceContext.has(id))
      );
    }

    const visibleNodes = nodes.filter((n) => allowedNodeIds.has(n.data.id));
    const visibleNodeIds = new Set(visibleNodes.map((n) => n.data.id));

    const visibleEdges = edges.filter((e) => {
      const { source, target, kind, eventName } = e.data;

      // Only keep edges whose endpoints are visible
      if (!visibleNodeIds.has(source) || !visibleNodeIds.has(target)) {
        return false;
      }

      // Toggle by edge kind
      if (kind === 'dependency' && !showDependencies) return false;
      if (kind === 'event' && !showEvents) return false;

      // If filtering by event, only show that event’s event-edges
      if (selectedEvent !== ALL_EVENTS && kind === 'event') {
        return eventName === selectedEvent;
      }

      return true;
    });

    const all = [...visibleNodes, ...visibleEdges];

    // Apply saved positions so layout doesn't reset
    all.forEach((el) => {
      if (el.data && positions[el.data.id]) {
        el.position = positions[el.data.id];
      }
    });

    return all;
  }, [
    nodes,
    edges,
    selectedEvent,
    selectedServiceFilter,
    positions,
    showDependencies,
    showEvents,
  ]);

  // We use a preset layout to respect node.position from elements
  const layout = { name: 'preset' };

  // Styles
  const stylesheet = useMemo(() => makeStylesheet(maxWeight), [maxWeight]);


  // Details panel data
  const selectedDetails = useMemo(() => {
    if (!selectedNodeId) return null;

    const baseService = serviceById.get(selectedNodeId) || null;
    const node = nodes.find((n) => n.data.id === selectedNodeId);
    if (!node) return null;
    const nodeData = node.data;

    const inboundDeps = edges
      .filter(
        (e) =>
          e.data.kind === 'dependency' && e.data.target === selectedNodeId
      )
      .map((e) => ({
        id: e.data.source,
        critical: e.data.critical === 'true',
      }))
      .sort((a, b) => a.id.localeCompare(b.id));

    const outboundDeps = edges
      .filter(
        (e) =>
          e.data.kind === 'dependency' && e.data.source === selectedNodeId
      )
      .map((e) => ({
        id: e.data.target,
        critical: e.data.critical === 'true',
      }))
      .sort((a, b) => a.id.localeCompare(b.id));

    const producedEvents = Array.from(
      new Set(nodeData.producedEvents || [])
    ).sort();
    const consumedEvents = Array.from(
      new Set(nodeData.consumedEvents || [])
    ).sort();

    return {
      id: selectedNodeId,
      nodeData,
      service: baseService,
      inboundDeps,
      outboundDeps,
      producedEvents,
      consumedEvents,
    };
  }, [selectedNodeId, nodes, edges, serviceById]);

  const handleResetSelection = () => {
    setSelectedNodeId(null);
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
      {/* LEFT FILTER PANEL */}
      <div
        style={{
          width: 260,
          borderRight: '1px solid #111827',
          padding: '10px 12px',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          background: '#020617',
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>
          Filters
        </div>

        <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 8 }}>
          Data: <strong style={{ color: dataSource === 'remote' ? '#34d399' : '#9ca3af' }}>{dataSource}</strong>

          <div style={{ marginTop: 6 }}>
            <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 6 }}>
              Runtime override (optional)
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <input
                placeholder="https://example.com/service-metadata.json"
                value={runtimeInput}
                onChange={(e) => setRuntimeInput(e.target.value)}
                style={{
                  flex: 1,
                  padding: '6px 8px',
                  borderRadius: 6,
                  border: '1px solid #374151',
                  background: '#020617',
                  color: '#e5e7eb',
                  fontSize: 12,
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') applyRuntimeUrl(runtimeInput);
                }}
              />

              <button
                onClick={() => applyRuntimeUrl(runtimeInput)}
                style={{
                  fontSize: 12,
                  padding: '6px 8px',
                  borderRadius: 6,
                  border: '1px solid #374151',
                  background: '#111827',
                  color: '#e5e7eb',
                }}
                disabled={!runtimeInput}
              >
                Use
              </button>

              <button
                onClick={() => clearRuntimeUrl()}
                style={{
                  fontSize: 12,
                  padding: '6px 8px',
                  borderRadius: 6,
                  border: '1px solid #374151',
                  background: '#111827',
                  color: '#e5e7eb',
                }}
                disabled={!runtimeUrl}
              >
                Clear
              </button>

              <button
                onClick={() => fetchRemote()}
                style={{
                  fontSize: 12,
                  padding: '6px 8px',
                  borderRadius: 6,
                  border: '1px solid #374151',
                  background: '#111827',
                  color: '#e5e7eb',
                }}
              >
                Refresh
              </button>
            </div>

            <div style={{ marginTop: 6, fontSize: 11, color: '#9ca3af' }}>
              {runtimeUrl ? (
                <div>
                  <strong style={{ color: '#34d399' }}>Runtime:</strong>{' '}
                  <span style={{ wordBreak: 'break-all' }}>{runtimeUrl}</span>
                </div>
              ) : import.meta.env.VITE_SERVICE_METADATA_URL ? (
                <div>
                  <strong>Env:</strong>{' '}
                  <span style={{ wordBreak: 'break-all' }}>{import.meta.env.VITE_SERVICE_METADATA_URL}</span>
                </div>
              ) : (
                <div>Using local bundled file</div>
              )}
            </div>

            {fetchError ? (
              <div style={{ marginTop: 6, color: '#f87171', fontSize: 11 }}>{fetchError}</div>
            ) : null}
          </div>
        </div>

        {/* Event filter */}
        <div style={{ fontSize: 13 }}>
          <div
            style={{
              fontSize: 12,
              color: '#9ca3af',
              marginBottom: 4,
            }}
          >
            Event
          </div>
          <select
            value={selectedEvent}
            onChange={(e) => setSelectedEvent(e.target.value)}
            style={{
              width: '100%',
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
        </div>

        {/* Service filter */}
        <div style={{ fontSize: 13 }}>
          <div
            style={{
              fontSize: 12,
              color: '#9ca3af',
              marginBottom: 4,
            }}
          >
            Service
          </div>
          <select
            value={selectedServiceFilter}
            onChange={(e) => setSelectedServiceFilter(e.target.value)}
            style={{
              width: '100%',
              padding: '4px 6px',
              borderRadius: 6,
              border: '1px solid #374151',
              background: '#020617',
              color: '#e5e7eb',
              fontSize: 12,
            }}
          >
            <option value={ALL_SERVICES}>All services</option>
            {allServices.map((svc) => (
              <option key={svc} value={svc}>
                {svc}
              </option>
            ))}
          </select>
        </div>

        {/* TOP 5 TABLES */}
<div
  style={{
    marginTop: 12,
    paddingTop: 8,
    borderTop: '1px solid #111827',
    fontSize: 11,
  }}
>
  {/* Top 5 by consumers */}
  <div style={{ marginBottom: 14 }}>
    <div
      style={{
        fontSize: 12,
        fontWeight: 600,
        marginBottom: 6,
      }}
    >
      Top 5 by event consumers
    </div>

    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr style={{ color: '#9ca3af', fontSize: 10 }}>
          <th style={{ textAlign: 'left', paddingBottom: 4 }}>Service</th>
          <th style={{ textAlign: 'right', paddingBottom: 4 }}>Consumers</th>
        </tr>
      </thead>
      <tbody>
        {topByConsumers.map((s) => (
          <tr
            key={s.id}
            onClick={() => setSelectedNodeId(s.id)}
            style={{
              cursor: 'pointer',
            }}
          >
            <td
              style={{
                padding: '3px 0',
                color: '#e5e7eb',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: 150,
              }}
              title={s.id}
            >
              {s.id}
            </td>
            <td
              style={{
                padding: '3px 0',
                textAlign: 'right',
                color: '#9ca3af',
              }}
            >
              {s.count}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>

  {/* Top 5 by consumers */}
  <div style={{ marginBottom: 14 }}>
    <div
      style={{
        fontSize: 12,
        fontWeight: 600,
        marginBottom: 6,
      }}
    >
      Top 5 by API consumers
    </div>

    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr style={{ color: '#9ca3af', fontSize: 10 }}>
          <th style={{ textAlign: 'left', paddingBottom: 4 }}>Service</th>
          <th style={{ textAlign: 'right', paddingBottom: 4 }}>Consumers</th>
        </tr>
      </thead>
      <tbody>
        {topByDependencyConsumers.map((s) => (
          <tr
            key={s.id}
            onClick={() => setSelectedNodeId(s.id)}
            style={{
              cursor: 'pointer',
            }}
          >
            <td
              style={{
                padding: '3px 0',
                color: '#e5e7eb',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: 150,
              }}
              title={s.id}
            >
              {s.id}
            </td>
            <td
              style={{
                padding: '3px 0',
                textAlign: 'right',
                color: '#9ca3af',
              }}
            >
              {s.count}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>

  {/* Top 5 by oldest updated */}
  <div>
    <div
      style={{
        fontSize: 12,
        fontWeight: 600,
        marginBottom: 6,
      }}
    >
      Oldest updated
    </div>

    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr style={{ color: '#9ca3af', fontSize: 10 }}>
          <th style={{ textAlign: 'left', paddingBottom: 4 }}>Service</th>
          <th style={{ textAlign: 'right', paddingBottom: 4 }}>Days</th>
        </tr>
      </thead>
      <tbody>
        {topByOldestUpdate.map((s) => (
          <tr
            key={s.id}
            onClick={() => setSelectedNodeId(s.id)}
            style={{
              cursor: 'pointer',
            }}
          >
            <td
              style={{
                padding: '3px 0',
                color: '#e5e7eb',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: 150,
              }}
              title={s.id}
            >
              {s.id}
            </td>
            <td
              style={{
                padding: '3px 0',
                textAlign: 'right',
                color: '#9ca3af',
              }}
            >
              {s.daysAgo}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
</div>
        
        {/* Orphan published events */}
          <div
            style={{
              marginTop: 14,
              paddingTop: 8,
              borderTop: '1px solid #111827',
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
              Unconsumed published events
            </div>

            {orphanPublishedEvents.length === 0 ? (
              <div style={{ fontSize: 11, color: '#9ca3af' }}>
                None 🎉
              </div>
            ) : (
              <ul
                style={{
                  listStyle: 'none',
                  padding: 0,
                  margin: 0,
                  fontSize: 11,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}
              >
                {orphanPublishedEvents.map((e) => (
                  <li
                    key={e.eventName}
                    style={{
                      border: '1px solid #1f2937',
                      borderRadius: 6,
                      padding: '6px 8px',
                      background: '#020617',
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 600,
                        color: '#e5e7eb',
                        marginBottom: 2,
                        wordBreak: 'break-word',
                      }}
                    >
                      {e.eventName}
                    </div>
                    <div style={{ color: '#9ca3af' }}>
                      Published by:{' '}
                      {e.producers.join(', ')}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>


        {/* Edge type toggles */}
        <div
          style={{
            fontSize: 13,
            marginTop: 4,
            paddingTop: 6,
            borderTop: '1px solid #111827',
          }}
        >
          <div
            style={{
              fontSize: 12,
              color: '#9ca3af',
              marginBottom: 4,
            }}
          >
            Edge types
          </div>

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 12,
              marginBottom: 4,
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={showDependencies}
              onChange={(e) => setShowDependencies(e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            <span>API / service dependencies</span>
          </label>

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={showEvents}
              onChange={(e) => setShowEvents(e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            <span>Event dependencies</span>
          </label>
        </div>
        <div
          style={{
            marginTop: 8,
            fontSize: 11,
            color: '#9ca3af',
          }}
        >
          Showing services that match:
          <br />
          {selectedEvent === ALL_EVENTS ? (
            <span>• any event</span>
          ) : (
            <span>• event: {selectedEvent}</span>
          )}
          <br />
          {selectedServiceFilter === ALL_SERVICES ? (
            <span>• any service</span>
          ) : (
            <span>• neighbourhood of: {selectedServiceFilter}</span>
          )}
        </div>
      </div>

      {/* MIDDLE GRAPH AREA */}
      <div style={{ flex: '1 1 auto' }}>
        <CytoscapeView
          elements={filteredElements}
          layout={layout}
          stylesheet={stylesheet}
          onReady={setCyInstance}
        />
      </div>

      {/* RIGHT DETAILS PANEL */}
      <div
        style={{
          width: 300,
          borderLeft: '1px solid #111827',
          padding: '10px 12px',
          boxSizing: 'border-box',
          background: '#020617',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 600 }}>Service details</div>
          <button
            onClick={handleResetSelection}
            style={{
              fontSize: 11,
              padding: '2px 8px',
              borderRadius: 999,
              border: '1px solid #374151',
              background: '#020617',
              color: '#e5e7eb',
              cursor: 'pointer',
            }}
          >
            Reset
          </button>
        </div>

        {!selectedDetails && (
          <div
            style={{
              fontSize: 12,
              color: '#9ca3af',
              marginTop: 4,
            }}
          >
            Click a bubble to see full metadata.
          </div>
        )}

        {selectedDetails && (
          <div
            style={{
              fontSize: 12,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              overflowY: 'auto',
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 11,
                  letterSpacing: 0.05,
                  textTransform: 'uppercase',
                  color: '#9ca3af',
                  marginBottom: 4,
                }}
              >
                Name
              </div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>
                {selectedDetails.id}
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr',
                gap: 6,
              }}
            >
              <Field label="Domain" value={selectedDetails.service?.domain} />
              <Field label="Team" value={selectedDetails.service?.team} />
              <Field label="Owner" value={selectedDetails.service?.owner} />
              <Field label="Repo" value={selectedDetails.service?.repo} />
              <Field label="Created" value={selectedDetails.service?.metadata?.createdAt} />
              <Field label="Updated" value={selectedDetails.service?.metadata?.updatedAt} />
            </div>

            {selectedDetails.service?.vision && (
              <div>
                <div
                  style={{
                    fontSize: 11,
                    letterSpacing: 0.05,
                    textTransform: 'uppercase',
                    color: '#9ca3af',
                    marginBottom: 4,
                  }}
                >
                  Vision
                </div>
                <div style={{ fontSize: 12, color: '#e5e7eb' }}>
                  {selectedDetails.service.vision}
                </div>
              </div>
            )}

            <SectionList
              title="Inbound dependencies"
              items={selectedDetails.inboundDeps}
            />
            <SectionList
              title="Outbound dependencies"
              items={selectedDetails.outboundDeps}
            />
            <SectionList
              title="Produces events"
              items={selectedDetails.producedEvents}
            />
            <SectionList
              title="Consumes events"
              items={selectedDetails.consumedEvents}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// Small helpers for nicer formatting


// Handles either strings or {id, critical}