import React from 'react';

// Handles either strings or {id, critical}
export default function SectionList({ title, items }) {
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
