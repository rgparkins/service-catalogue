import React from 'react';

export default function TenantLayout({ tenantId, active, children }) {
  React.useEffect(() => {
    try {
      if (tenantId) localStorage.setItem('SC_TENANT_ID', tenantId);
    } catch (e) {
      // ignore
    }
  }, [tenantId]);

  const NavItem = ({ id, href, label }) => (
    <li className="nav-item">
      <a className={`nav-link ${active === id ? 'active' : ''}`} href={href}>
        {label}
      </a>
    </li>
  );

  return (
    <div className="bg-light min-vh-100">
      <nav className="navbar bg-white border-bottom">
        <div className="container-fluid px-3">
          <a className="navbar-brand" href="/">
            Service Catalogue
          </a>
          <div className="text-muted small">Tenant: {tenantId}</div>
        </div>
      </nav>

      <div className="container-fluid">
        <div className="row">
          <aside className="col-12 col-md-3 col-lg-2 p-0 border-end bg-white">
            <div className="p-3">
              <div className="fw-semibold mb-2">Menu</div>
              <ul className="nav nav-pills flex-column gap-1">
                <NavItem id="schemas" href={`/tenant/${encodeURIComponent(tenantId)}/schemas`} label="Schemas" />
                <NavItem id="graph" href={`/tenant/${encodeURIComponent(tenantId)}/graph`} label="Graph" />
                <NavItem id="settings" href={`/tenant/${encodeURIComponent(tenantId)}/settings`} label="Settings" />
                <NavItem id="usage" href={`/tenant/${encodeURIComponent(tenantId)}/usage`} label="Usage" />
              </ul>
            </div>
          </aside>

          <main className="col-12 col-md-9 col-lg-10 py-3 px-3 px-md-4">{children}</main>
        </div>
      </div>
    </div>
  );
}
