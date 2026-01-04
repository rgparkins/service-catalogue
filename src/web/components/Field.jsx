import React from 'react';

export default function Field({ label, value }) {
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
