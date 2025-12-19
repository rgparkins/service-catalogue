// CytoscapeView.jsx
import React, { useEffect, useRef } from 'react';
import cytoscape from 'cytoscape';

export default function CytoscapeView({ elements, layout, stylesheet, onReady }) {
  const containerRef = useRef(null);
  const cyRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;

    if (!cyRef.current) {
      cyRef.current = cytoscape({
        container: containerRef.current,
        elements,
        style: stylesheet,
        layout
      });

      if (onReady) onReady(cyRef.current);
    } else {
      const cy = cyRef.current;

      cy.json({ elements });

      cy.nodes().positions((node) => {
        const pos = node.data('position');
        return pos ? pos : node.position();
      });

      cy.layout(layout).run();
    }

  }, [elements, layout, stylesheet]);

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', position: 'relative' }}
    />
  );
}