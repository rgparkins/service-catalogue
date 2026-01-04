import React from 'react';

export default function ColorKeyRow() {
  return (
    <table
      style={{
        width: '100%',
        borderCollapse: 'collapse',
        fontSize: 12,
      }}
    >
      <tbody>
        <tr>
          <KeyCell color="#22c55e" border="#0f172a" label="Fresh" rule="≤ 31 days" />
          <KeyCell color="#f59e0b" border="#0f172a" label="Aging" rule="31–183 days" />
          <KeyCell color="#ef4444" border="#0f172a" label="Stale" rule="> 183 days" />
          <KeyCell color="#FFD966" border="#C9A300" label="Missing metadata" rule="Dependency not in list" />
        </tr>
      </tbody>
    </table>
  );
}

function KeyCell({ color, border, label, rule }) {
  return (
    <td
      style={{
        padding: '6px 10px',
        borderRight: '1px solid rgba(148,163,184,0.25)',
        whiteSpace: 'nowrap',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div
          style={{
            width: 14,
            height: 14,
            borderRadius: 7,
            background: color,
            border: `2px solid ${border}`,
            flexShrink: 0,
          }}
        />
        <div style={{ lineHeight: 1.2 }}>
          <div style={{ color: '#e5e7eb', fontWeight: 600 }}>{label}</div>
          <div style={{ fontSize: 10, color: '#9ca3af' }}>{rule}</div>
        </div>
      </div>
    </td>
  );
}
