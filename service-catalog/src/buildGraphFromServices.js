// buildGraphFromServices.js
function layoutNodes(nodes) {
  const cols = Math.ceil(Math.sqrt(nodes.length));
  const spacing = 260; // increase or reduce spacing here

  return nodes.map((n, i) => {
    const row = Math.floor(i / cols);
    const col = i % cols;

    n.position = {
      x: col * spacing,
      y: row * spacing,
    };

    return n;
  });
}

export function buildGraphFromServices(services) {
  const nodesById = new Map();
  const edges = [];

  // 1) Create nodes
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
        position: { x: Math.random() * 800, y: Math.random() * 600 },
      });
    }

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
          position: { x: Math.random() * 800, y: Math.random() * 600 },
        });
      }
    });
  });

  // 2) Edges
  services.forEach((svc) => {
    const sourceId = svc.name;
    if (!sourceId) return;

    (svc.dependencies?.critical || []).forEach((dep) => {
      if (!dep.name) return;
      edges.push({
        id: `e-${sourceId}-${dep.name}-critical`,
        source: sourceId,
        target: dep.name,
        label: dep.role || 'critical',
        data: { kind: 'critical', protocol: dep.protocol },
      });
    });

    (svc.dependencies?.['non-critical'] || []).forEach((dep) => {
      if (!dep.name) return;
      edges.push({
        id: `e-${sourceId}-${dep.name}-noncritical`,
        source: sourceId,
        target: dep.name,
        label: dep.role || 'non-critical',
        data: { kind: 'non-critical', protocol: dep.protocol },
      });
    });
  });

  // 3) inbound dependency count for sizing
  const inboundCounts = new Map();
  edges.forEach((e) => {
    inboundCounts.set(e.target, (inboundCounts.get(e.target) || 0) + 1);
  });

  var nodes = Array.from(nodesById.values());
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

  //nodes = layoutNodes(nodes);

  return { nodes, edges };
}

function colourForType(type) {
  const t = (type || '').toLowerCase();

  if (t.includes('edge')) return '#f97316'; // edge / gateway
  if (t.includes('learner')) return '#22c55e';
  if (t.includes('analytics')) return '#a855f7';
  if (t.includes('notification')) return '#3b82f6';
  if (t.includes('report')) return '#6366f1';
  if (t.includes('audit')) return '#facc15';
  if (t.includes('config') || t.includes('settings')) return '#ec4899';
  if (t.includes('api')) return '#38bdf8'; // generic API

  return '#6b7280'; // fallback grey
}
