import React, { useMemo, useState, useEffect } from 'react';
import CytoscapeView from './CytoscapeView.jsx';
import services from './service-metadata.json';

// Build Cytoscape elements and metadata from your JSON
function buildElements(services) {
  const nodesById = new Map();
  const edges = [];
  const inbound = new Map(); // inbound dependency count
  const producers = new Map(); // eventName -> Set(serviceId)
  const consumers = new Map(); // eventName -> Set(serviceId)

  services.forEach((svc) => {
    const id = svc.name;
    if (!id) return;

    if (!nodesById.has(id)) {
      nodesById.set(id, {
        data: {
          id,
          label: id,
          type: svc.contracts?.[0]?.role || 'service',
          weight: 0,
          producedEvents: [],
          consumedEvents: [],
        },
      });
    }

    const nodeData = nodesById.get(id).data;

    // Dependencies with critical flag
    const criticalDeps = svc.dependencies?.critical || [];
    const nonCriticalDeps = svc.dependencies?.["non-critical"] || [];

    criticalDeps.forEach((dep) => {
      if (!dep.name) return;

      if (!nodesById.has(dep.name)) {
        nodesById.set(dep.name, {
          data: {
            id: dep.name,
            label: dep.name,
            type: dep.role || 'external',
            weight: 0,
            producedEvents: [],
            consumedEvents: [],
          },
        });
      }

      edges.push({
        data: {
          id: `dep-${id}-${dep.name}-critical`,
          source: id,
          target: dep.name,
          kind: 'dependency',
          critical: 'true',
        },
      });

      inbound.set(dep.name, (inbound.get(dep.name) || 0) + 1);
    });

    nonCriticalDeps.forEach((dep) => {
      if (!dep.name) return;

      if (!nodesById.has(dep.name)) {
        nodesById.set(dep.name, {
          data: {
            id: dep.name,
            label: dep.name,
            type: dep.role || 'external',
            weight: 0,
            producedEvents: [],
            consumedEvents: [],
          },
        });
      }

      edges.push({
        data: {
          id: `dep-${id}-${dep.name}-noncritical`,
          source: id,
          target: dep.name,
          kind: 'dependency',
          critical: 'false',
        },
      });

      inbound.set(dep.name, (inbound.get(dep.name) || 0) + 1);
    });

    // Events
    const ev = svc.events || {};
    const producing = ev.producing || [];
    const consuming = ev.consuming || [];

    producing.forEach((e) => {
      const name = e.name;
      if (!name) return;
      nodeData.producedEvents.push(name);
      if (!producers.has(name)) producers.set(name, new Set());
      producers.get(name).add(id);
    });

    consuming.forEach((e) => {
      const name = e.name;
      if (!name) return;
      nodeData.consumedEvents.push(name);
      if (!consumers.has(name)) consumers.set(name, new Set());
      consumers.get(name).add(id);
    });
  });

  // Event edges (producer -> consumer)
  const allEventNames = new Set([
    ...producers.keys(),
    ...consumers.keys(),
  ]);

  allEventNames.forEach((eventName) => {
    const P = [...(producers.get(eventName) || [])];
    const C = [...(consumers.get(eventName) || [])];

    P.forEach((p) => {
      C.forEach((c) => {
        if (p === c) return;
        edges.push({
          data: {
            id: `evt-${eventName}-${p}-${c}`,
            source: p,
            target: c,
            kind: 'event',
            eventName,
          },
        });
      });
    });
  });

  // Calculate weights for node sizing
  let maxWeight = 0;
  nodesById.forEach((n, id) => {
    const w = inbound.get(id) || 0;
    n.data.weight = w;
    if (w > maxWeight) maxWeight = w;
  });

  const elements = [...nodesById.values(), ...edges];
  const allServices = [...nodesById.keys()].sort();
  const allEventsSorted = [...allEventNames].sort();

  return { elements, maxWeight, allEvents: allEventsSorted, allServices };
}

const ALL_EVENTS = 'ALL_EVENTS';
const ALL_SERVICES = 'ALL_SERVICES';

export default function ServiceGraph() {
  const { elements, maxWeight, allEvents, allServices } = useMemo(
    () => buildElements(services),
    []
  );

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
    services.forEach((svc) => {
      if (svc.name) map.set(svc.name, svc);
    });
    return map;
  }, []);

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
  const stylesheet = [
    {
      selector: 'node',
      style: {
        'background-color': '#3b82f6',
        label: 'data(label)',
        'font-size': 10,
        color: '#e5e7eb',
        'text-wrap': 'wrap',
        'text-max-width': 80,
        'text-valign': 'center',
        'text-halign': 'center',
        'border-width': 2,
        'border-color': '#0f172a',
        width: (ele) => {
          const w = ele.data('weight') || 0;
          if (!maxWeight) return 40;
          const min = 40;
          const max = 110;
          return min + (w / maxWeight) * (max - min);
        },
        height: (ele) => {
          const w = ele.data('weight') || 0;
          if (!maxWeight) return 40;
          const min = 40;
          const max = 110;
          return min + (w / maxWeight) * (max - min);
        },
        'transition-property': 'background-color, border-color, opacity',
        'transition-duration': '150ms',
      },
    },
    {
      selector: 'edge[kind = "dependency"]',
      style: {
        width: 1.5,
        'line-color': '#9ca3af',
        'target-arrow-color': '#9ca3af',
        'target-arrow-shape': 'triangle',
        'curve-style': 'bezier',
      },
    },
    {
      selector: 'edge[kind = "dependency"][critical = "true"]',
      style: {
        width: 2.5,
        'line-color': '#fecaca',
        'target-arrow-color': '#fecaca',
      },
    },
    {
      selector: 'edge[kind = "event"]',
      style: {
        width: 1.5,
        'line-style': 'dotted',
        'line-color': '#f97316',
        'target-arrow-color': '#f97316',
        'target-arrow-shape': 'triangle',
        'curve-style': 'bezier',
      },
    },
    {
      selector: '.faded',
      style: {
        opacity: 0.15,
      },
    },
    {
      selector: 'node.selected',
      style: {
        'border-color': '#facc15',
        'border-width': 3,
        'background-color': '#4f46e5',
      },
    },
    {
      selector: 'edge.highlight',
      style: {
        'line-color': '#e5e7eb',
        'target-arrow-color': '#e5e7eb',
      },
    },
  ];

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
function Field({ label, value }) {
  if (!value) return null;
  return (
    <div>
      <div
        style={{
          fontSize: 11,
          letterSpacing: 0.05,
          textTransform: 'uppercase',
          color: '#9ca3af',
          marginBottom: 2,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 12 }}>{value}</div>
    </div>
  );
}

// Handles either strings or {id, critical}
function SectionList({ title, items }) {
  if (!items || items.length === 0) return null;

  const isDepObjects = typeof items[0] === 'object' && items[0] !== null;

  return (
    <div>
      <div
        style={{
          fontSize: 11,
          letterSpacing: 0.05,
          textTransform: 'uppercase',
          color: '#9ca3af',
          marginBottom: 4,
          marginTop: 4,
        }}
      >
        {title}
      </div>
      <ul
        style={{
          listStyle: 'none',
          padding: 0,
          margin: 0,
          fontSize: 12,
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
        }}
      >
        {items.map((it) => {
          const key = isDepObjects ? it.id : it;
          const label = isDepObjects ? it.id : it;
          const isCritical = isDepObjects && it.critical;

          const bg = isCritical ? '#451a1a' : '#020617';
          const border = isCritical ? '#f97373' : '#1f2937';
          const color = isCritical ? '#fecaca' : '#e5e7eb';

          return (
            <li
              key={key}
              style={{
                padding: '4px 6px',
                borderRadius: 4,
                background: bg,
                border: `1px solid ${border}`,
                color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 6,
              }}
            >
              <span>{label}</span>
              {isCritical && (
                <span
                  style={{
                    fontSize: 9,
                    textTransform: 'uppercase',
                    letterSpacing: 0.08,
                    padding: '1px 4px',
                    borderRadius: 999,
                    border: '1px solid #f97373',
                  }}
                >
                  Critical
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
