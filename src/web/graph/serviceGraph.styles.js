export function makeStylesheet(maxWeight) {
  return [
    {
      selector: 'node',
      style: {
        'background-color': 'data(ragColor)',
        label: 'data(label)',
        'font-size': 10,
        color: '#e5e7eb',
        'text-wrap': 'wrap',
        'text-max-width': 80,
        'text-valign': 'center',
        'text-halign': 'center',
        'border-width': 2,
        'border-style': 'solid',
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
      selector: 'node[missing = 1]',
      style: {
        'background-color': '#FFD966',
        'border-color': '#C9A300',
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
}
