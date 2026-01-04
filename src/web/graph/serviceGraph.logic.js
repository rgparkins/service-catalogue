export const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function daysSince(dateStr) {
  if (!dateStr) return Number.POSITIVE_INFINITY;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return Number.POSITIVE_INFINITY;
  return Math.floor((Date.now() - d.getTime()) / MS_PER_DAY);
}

export function ragColorFromUpdatedAt(updatedAt) {
  const days = daysSince(updatedAt);

  const GREEN_DAYS = 31;  // <= 1 month
  const RED_DAYS = 183;   // > 6 months

  if (days <= GREEN_DAYS) return '#22c55e';
  if (days > RED_DAYS) return '#ef4444';
  return '#f59e0b';
}

export function normEvent(name) {
  return String(name || '').trim().toLowerCase();
}

// Build Cytoscape elements and metadata from your JSON
// NOTE: expects items shaped like { service: { name, updated, metadata: {...} } }
// (same shape you currently use in ServiceGraph.jsx)
export function buildElements(services) {
  const nodesById = new Map();
  const edges = [];
  const inbound = new Map(); // inbound dependency count
  const producers = new Map(); // eventName -> Set(serviceId)
  const consumers = new Map(); // eventName -> Set(serviceId)

  const serviceIdSet = new Set(
    services.map((s) => s?.service?.name).filter(Boolean)
  );

  services.forEach((svc) => {
    const id = svc?.service?.name;
    if (!id) return;

    if (!nodesById.has(id)) {
      nodesById.set(id, { data: { id, label: id, missing: 0 } });
    }

    const node = nodesById.get(id);
    const updatedAt = svc?.service?.updated ?? null;

    node.data = {
      ...node.data,
      id,
      label: id,
      type: svc?.service?.metadata?.contracts?.[0]?.role || 'service',
      weight: 0,
      producedEvents: [],
      consumedEvents: [],
      ragColor: ragColorFromUpdatedAt(updatedAt),
      updatedAt,
      missing: 0,
    };

    const nodeData = nodesById.get(id).data;

    const criticalDeps = svc?.service?.metadata?.dependencies?.critical || [];
    const nonCriticalDeps = svc?.service?.metadata?.dependencies?.['non-critical'] || [];

    criticalDeps.forEach((dep) => {
      if (!dep?.name) return;

      if (!nodesById.has(dep.name)) {
        nodesById.set(dep.name, {
          data: {
            id: dep.name,
            label: dep.name,
            type: dep.role || 'external',
            weight: 0,
            producedEvents: [],
            consumedEvents: [],
            missing: serviceIdSet.has(dep.name) ? 0 : 1,
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
      if (!dep?.name) return;

      if (!nodesById.has(dep.name)) {
        nodesById.set(dep.name, {
          data: {
            id: dep.name,
            label: dep.name,
            type: dep.role || 'external',
            weight: 0,
            producedEvents: [],
            consumedEvents: [],
            missing: serviceIdSet.has(dep.name) ? 0 : 1,
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
    const ev = svc?.service?.metadata?.events || {};
    const producing = ev.producing || [];
    const consuming = ev.consuming || [];

    producing.forEach((e) => {
      const name = e?.name;
      if (!name) return;
      nodeData.producedEvents.push(name);
      if (!producers.has(name)) producers.set(name, new Set());
      producers.get(name).add(id);
    });

    consuming.forEach((e) => {
      const name = e?.name;
      if (!name) return;
      nodeData.consumedEvents.push(name);
      if (!consumers.has(name)) consumers.set(name, new Set());
      consumers.get(name).add(id);
    });
  });

  // Event edges (producer -> consumer)
  const allEventNames = new Set([...producers.keys(), ...consumers.keys()]);

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

/* ---------- TOP LISTS (pure helpers) ---------- */

export function topByConsumersFromNodes(nodes, limit = 5) {
  const consumersByEvent = new Map();

  nodes.forEach((n) => {
    (n.data.consumedEvents || []).forEach((ev) => {
      const k = normEvent(ev);
      if (!k) return;
      if (!consumersByEvent.has(k)) consumersByEvent.set(k, new Set());
      consumersByEvent.get(k).add(n.data.id);
    });
  });

  const ranked = nodes.map((n) => {
    const id = n.data.id;
    const produced = n.data.producedEvents || [];
    let totalConsumers = 0;

    produced.forEach((ev) => {
      const k = normEvent(ev);
      const consumers = consumersByEvent.get(k);
      if (!consumers) return;

      const count = consumers.has(id) ? consumers.size - 1 : consumers.size;
      totalConsumers += Math.max(0, count);
    });

    return { id, count: totalConsumers };
  });

  return ranked
    .filter((r) => r.count > 0)
    .sort((a, b) => b.count - a.count || a.id.localeCompare(b.id))
    .slice(0, limit);
}

export function topByOldestUpdateFromNodes(nodes, limit = 5) {
  return nodes
    .map((n) => ({ id: n.data.id, daysAgo: daysSince(n.data.updatedAt) }))
    .filter((n) => Number.isFinite(n.daysAgo))
    .sort((a, b) => b.daysAgo - a.daysAgo)
    .slice(0, limit);
}

export function orphanPublishedEventsFromNodes(nodes) {
  const producersByEvent = new Map();
  const consumersByEvent = new Map();

  nodes.forEach((n) => {
    (n.data.producedEvents || []).forEach((ev) => {
      if (!producersByEvent.has(ev)) producersByEvent.set(ev, new Set());
      producersByEvent.get(ev).add(n.data.id);
    });

    (n.data.consumedEvents || []).forEach((ev) => {
      if (!consumersByEvent.has(ev)) consumersByEvent.set(ev, new Set());
      consumersByEvent.get(ev).add(n.data.id);
    });
  });

  return Array.from(producersByEvent.entries())
    .filter(([eventName]) => !consumersByEvent.has(eventName))
    .map(([eventName, producers]) => ({
      eventName,
      producers: Array.from(producers).sort(),
    }))
    .sort((a, b) => a.eventName.localeCompare(b.eventName));
}

export function topByDependencyConsumersFromGraph(nodes, edges, limit = 5) {
  const inboundCounts = new Map();
  nodes.forEach((n) => inboundCounts.set(n.data.id, 0));

  edges.forEach((e) => {
    if (e.data.kind !== 'dependency') return;
    const target = e.data.target;
    inboundCounts.set(target, (inboundCounts.get(target) || 0) + 1);
  });

  return Array.from(inboundCounts.entries())
    .map(([id, count]) => ({ id, count }))
    .filter((x) => x.count > 0)
    .sort((a, b) => b.count - a.count || a.id.localeCompare(b.id))
    .slice(0, limit);
}
