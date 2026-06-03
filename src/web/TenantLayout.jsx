import React from 'react';
import { useAuth, hasGlobalAdmin, hasTenantAdmin } from './auth/AuthProvider.jsx';
import Header from './Header.jsx';

export default function TenantLayout({ tenantId, active, children }) {
  const auth = useAuth();

  React.useEffect(() => {
    try {
      if (tenantId) localStorage.setItem('SC_TENANT_ID', tenantId);
    } catch (e) {
      // ignore
    }
  }, [tenantId]);

  const NavItem = ({ id, href, label, icon }) => (
    <li className="nav-item">
      <a className={`nav-link d-flex align-items-center gap-2 ${active === id ? 'active' : ''}`} href={href}>
        <i className={`bi ${icon}`} style={{ fontSize: '1rem', width: 18, textAlign: 'center' }} />
        {label}
      </a>
    </li>
  );

  return (
    <div className="bg-light min-vh-100">
      <Header mode="tenant" tenantId={tenantId} />

      <div className="container-fluid">
        <div className="row">
          <aside className="col-12 col-md-3 col-lg-2 p-0 border-end bg-white">
            <div className="p-3">
              <div className="fw-semibold mb-2 text-muted small text-uppercase ps-2">Menu</div>
              <ul className="nav nav-pills flex-column gap-1">
                <NavItem id="schemas"  href={`/tenant/${encodeURIComponent(tenantId)}/schemas`}  label="Schemas"  icon="bi-file-earmark-code" />
                <NavItem id="graph"    href={`/tenant/${encodeURIComponent(tenantId)}/graph`}    label="Graph"    icon="bi-diagram-3" />
                <NavItem id="rulesets" href={`/tenant/${encodeURIComponent(tenantId)}/rulesets`} label="Rulesets" icon="bi-funnel" />
                <NavItem id="usage"    href={`/tenant/${encodeURIComponent(tenantId)}/usage`}    label="Usage"    icon="bi-bar-chart-line" />
                <NavItem id="settings" href={`/tenant/${encodeURIComponent(tenantId)}/settings`} label="Settings" icon="bi-gear" />
                {auth?.authenticated && (hasGlobalAdmin(auth.tokenParsed) || hasTenantAdmin(auth.tokenParsed, tenantId)) ? (
                  <NavItem id="users" href={`/tenant/${encodeURIComponent(tenantId)}/users`} label="Users" icon="bi-people" />
                ) : null}
              </ul>
            </div>
          </aside>

          <main className="col-12 col-md-9 col-lg-10 py-3 px-3 px-md-4">{children}</main>
        </div>
      </div>
    </div>
  );
}
