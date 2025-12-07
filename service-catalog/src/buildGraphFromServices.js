import {
  forceSimulation,
  forceManyBody,
  forceCollide,
  forceCenter,
  forceLink
} from "d3-force";

// buildGraphFromServices.js

// Optional: simple grid layout so nodes aren’t on top of each other
// --- NEW: force-directed layout using D3 ---
function forceLayout(nodes, edges) {
  if (!nodes.length) return nodes;

  // Convert edges for D3 (dependencies + events)
  const d3links = edges.map(e => ({
    source: e.source,
    target: e.target
  }));

  // Copy nodes into D3-friendly structure
  const simNodes = nodes.map(n => ({ ...n }));

  const simulation = forceSimulation(simNodes)
    .force("charge", forceManyBody().strength(-350))   // how strongly nodes repel
    .force("collide", forceCollide().radius(70).strength(1))
    .force("center", forceCenter(800, 500))            // canvas center
    .force(
      "link",
      forceLink(d3links)
        .id(d => d.id)
        .distance(180)
        .strength(0.2)
    )
    .stop();

  // Run ~150 iterations synchronously for stable layout
  for (let i = 0; i < 150; i++) simulation.tick();

  // Apply final positions to real nodes
  simNodes.forEach((s, i) => {
    nodes[i].position = { x: s.x, y: s.y };
  });

  return nodes;
}


// Simple colour mapping by "type" / contract role
function colourForType(type) {
  const t = (type || '').toLowerCase();

  if (t.includes('edge')) return '#f97316';        // orange
  if (t.includes('learner')) return '#22c55e';     // green
  if (t.includes('analytics')) return '#a855f7';   // purple
  if (t.includes('notification')) return '#3b82f6';// blue
  if (t.includes('report')) return '#6366f1';      // indigo
  if (t.includes('audit')) return '#facc15';       // yellow
  if (t.includes('config') || t.includes('settings')) return '#ec4899';
  if (t.includes('api')) return '#38bdf8';         // generic API

  return '#6b7280'; // fallback grey
}

export function buildGraphFromServices(services) {
  const nodesById = new Map();
  const edges = [];

  // For event edges (dotted)
  const eventProducers = new Map(); // eventName -> Set(serviceId)
  const eventConsumers = new Map(); // eventName -> Set(serviceId)

  // 1) Create nodes & collect event producers/consumers
  services.forEach((svc) => {
    const id = svc.name;
    if (!id) return;

    const serviceType = svc.contracts?.[0]?.role || 'service';

    if (!nodesById.has(id)) {
      nodesById.set(id, {
        id,
        data: {
          label: id,
          type: serviceType,
          domain: svc.domain,
          team: svc.team,
          owner: svc.owner,
          repo: svc.repo,
          vision: svc.vision,
          raw: svc, // full metadata for side panel
        },
        // initial position; will be overwritten by layoutNodes later
        position: { x: 0, y: 0 },
      });
    }

    // Ensure dependency nodes exist (for external services etc.)
    const deps = [
      ...(svc.dependencies?.critical || []),
      ...(svc.dependencies?.['non-critical'] || []),
    ];

    deps.forEach((dep) => {
      if (!dep.name) return;

      if (!nodesById.has(dep.name)) {
        nodesById.set(dep.name, {
          id: dep.name,
          data: {
            label: dep.name,
            type: dep.role || 'dependency',
            domain: 'external',
            team: 'external',
            owner: null,
            repo: null,
            vision: null,
            raw: { name: dep.name, inferred: true },
          },
          position: { x: 0, y: 0 },
        });
      }
    });

    // Collect event producers / consumers
    const events = svc.events || {};
    const producing = events.producing || [];
    const consuming = events.consuming || [];

    producing.forEach((ev) => {
      const name = ev.name;
      if (!name) return;
      if (!eventProducers.has(name)) eventProducers.set(name, new Set());
      eventProducers.get(name).add(id);
    });

    consuming.forEach((ev) => {
      const name = ev.name;
      if (!name) return;
      if (!eventConsumers.has(name)) eventConsumers.set(name, new Set());
      eventConsumers.get(name).add(id);
    });
  });

  // 2) Dependency edges (solid)
  services.forEach((svc) => {
    const sourceId = svc.name;
    if (!sourceId) return;

    (svc.dependencies?.critical || []).forEach((dep) => {
      if (!dep.name) return;
      edges.push({
        id: `dep-${sourceId}-${dep.name}-critical`,
        source: sourceId,
        target: dep.name,
        label: dep.role || 'critical',
        data: {
          kind: 'dependency',
          critical: true,
          protocol: dep.protocol,
        },
        style: {
          strokeWidth: 1.5,
          stroke: '#e5e7eb', // light grey, solid
        },
      });
    });

    (svc.dependencies?.['non-critical'] || []).forEach((dep) => {
      if (!dep.name) return;
      edges.push({
        id: `dep-${sourceId}-${dep.name}-noncritical`,
        source: sourceId,
        target: dep.name,
        label: dep.role || 'non-critical',
        data: {
          kind: 'dependency',
          critical: false,
          protocol: dep.protocol,
        },
        style: {
          strokeWidth: 1.5,
          stroke: '#9ca3af', // darker grey, solid
        },
      });
    });
  });

  // 3) Event edges (dotted, producer -> consumer)
  const allEventNames = new Set([
    ...eventProducers.keys(),
    ...eventConsumers.keys(),
  ]);

  allEventNames.forEach((eventName) => {
    const producers = Array.from(eventProducers.get(eventName) || []);
    const consumers = Array.from(eventConsumers.get(eventName) || []);

    producers.forEach((p) => {
      consumers.forEach((c) => {
        if (!p || !c || p === c) return; // no self loops

        edges.push({
          id: `evt-${eventName}-${p}-${c}`,
          source: p,
          target: c,
          label: eventName,
          data: {
            kind: 'event',
            eventName,
          },
          style: {
            strokeWidth: 1.5,
            stroke: '#f97316',      // orange
            strokeDasharray: '4 4', // dotted
          },
        });
      });
    });
  });

  // 4) Compute inbound dependency count for bubble sizing
  const inboundCounts = new Map();
  edges.forEach((e) => {
    if (e.data?.kind === 'dependency') {
      inboundCounts.set(e.target, (inboundCounts.get(e.target) || 0) + 1);
    }
  });

  let nodes = Array.from(nodesById.values());

  const maxDep = nodes.length
    ? Math.max(...nodes.map((n) => inboundCounts.get(n.id) || 0))
    : 0;

  const sizeFor = (id) => {
    const count = inboundCounts.get(id) || 0;
    if (maxDep === 0) return 40;
    const min = 40;
    const max = 120;
    return min + (count / maxDep) * (max - min);
  };

  // 5) Style nodes (colour + size)
  nodes.forEach((n) => {
    const depCount = inboundCounts.get(n.id) || 0;
    const type = n.data.type;
    const colour = colourForType(type);
    const size = sizeFor(n.id);

    n.data.depCount = depCount;

    n.style = {
      width: size,
      height: size,
      borderRadius: '999px',
      border: '2px solid #0f172a',
      background: colour,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#f9fafb',
      fontSize: '10px',
      textAlign: 'center',
      padding: '4px',
      boxSizing: 'border-box',
    };
  });

  // 6) Apply grid layout for initial positioning
  nodes = forceLayout(nodes, edges);

  return { nodes, edges };
}
