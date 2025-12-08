// ServiceGraph.jsx
import React, { useMemo, useState } from 'react';
import CytoscapeComponent from 'react-cytoscapejs';
import services from './service-metadata.json';

// Build Cytoscape elements and filter metadata from your JSON
function buildElements(services) {
  const nodesById = new Map();
  const edges = [];
  const inbound = new Map(); // inbound dependency count
  const producers = new Map(); // eventName -> Set(serviceId)
  const consumers = new Map(); // eventName -> Set(serviceId)

  // 1) Build nodes and dependency edges
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

    // Dependencies
    const deps = [
      ...(svc.dependencies?.critical || []),
      ...(svc.dependencies?.['non-critical'] || []),
    ];

    deps.forEach((dep) => {
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
          id: `dep-${id}-${dep.name}`,
          source: id,
          target: dep.name,
          kind: 'dependency',
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

  // 2) Event edges (producer -> consumer), dotted orange
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

  // 3) Calculate weights for node sizing
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
  const [selectedService, setSelectedService] = useState(ALL_SERVICES);

  // Split elements into nodes/edges for filtering logic
  const nodes = useMemo(
    () => elements.filter((el) => !el.data.source && !el.data.target),
    [elements]
  );
  const edges = useMemo(
    () => elements.filter((el) => el.data.source && el.data.target),
    [elements]
  );

  // Build filtered elements based on dropdowns
  const filteredElements = useMemo(() => {
    let allowedNodeIds = new Set(nodes.map((n) => n.data.id));

    // Event filter: keep only services that produce/consume this event
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

    // Service filter: keep selected service and its direct neighbours
    if (selectedService !== ALL_SERVICES) {
      const serviceContext = new Set([selectedService]);

      edges.forEach((e) => {
        const { source, target } = e.data;
        if (source === selectedService) serviceContext.add(target);
        if (target === selectedService) serviceContext.add(source);
      });

      allowedNodeIds = new Set(
        [...allowedNodeIds].filter((id) => serviceContext.has(id))
      );
    }

    const visibleNodes = nodes.filter((n) => allowedNodeIds.has(n.data.id));

    const visibleNodeIds = new Set(visibleNodes.map((n) => n.data.id));

    const visibleEdges = edges.filter((e) => {
      const { source, target, kind, eventName } = e.data;
      if (!visibleNodeIds.has(source) || !visibleNodeIds.has(target)) {
        return false;
      }
      // If filtering by event, only show that event's event-edges
      if (selectedEvent !== ALL_EVENTS && kind === 'event') {
        return eventName === selectedEvent;
      }
      return true;
    });

    return [...visibleNodes, ...visibleEdges];
  }, [nodes, edges, selectedEvent, selectedService]);

  // Layout: concentric (busy services nearer centre)
  const layout = {
    name: 'concentric',
    padding: 50,
    minNodeSpacing: 60,
    startAngle: (3 / 2) * Math.PI,
    sweep: 2 * Math.PI,
    clockwise: true,
    concentric: (node) => node.data('weight') || 0,
    levelWidth: () => (maxWeight || 1) / 4,
  };

  // Cytoscape stylesheet
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
  ];

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
      {/* LEFT SIDE MENU */}
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
            value={selectedService}
            onChange={(e) => setSelectedService(e.target.value)}
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
          {selectedService === ALL_SERVICES ? (
            <span>• any service</span>
          ) : (
            <span>• neighbourhood of: {selectedService}</span>
          )}
        </div>
      </div>

      {/* RIGHT GRAPH AREA */}
      <div style={{ flex: '1 1 auto' }}>
        <CytoscapeComponent
          elements={filteredElements}
          layout={layout}
          stylesheet={stylesheet}
          style={{ width: '100%', height: '100%' }}
        />
      </div>
    </div>
  );
}
