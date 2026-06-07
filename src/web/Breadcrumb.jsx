import React from 'react';

// crumbs: [{ label, href? }]  — last item is the current page (no href needed)
export default function Breadcrumb({ crumbs = [] }) {
  if (crumbs.length === 0) return null;
  return (
    <nav aria-label="breadcrumb" className="mb-3">
      <ol className="breadcrumb mb-0">
        {crumbs.map((crumb, i) => {
          const isLast = i === crumbs.length - 1;
          return isLast ? (
            <li key={i} className="breadcrumb-item active" aria-current="page">
              {crumb.label}
            </li>
          ) : (
            <li key={i} className="breadcrumb-item">
              <a href={crumb.href}>{crumb.label}</a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
