import React from 'react';

const API_BASE =
  (import.meta.env.VITE_SERVICE_METADATA_URL || '').replace(/\/+$/, '') || 'http://localhost:3000';

export default function TenantList() {
  const [tenants, setTenants] = React.useState(null);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(24);
  const [total, setTotal] = React.useState(null);
  const [error, setError] = React.useState(null);
  const [showAddTenant, setShowAddTenant] = React.useState(false);
  const [adminKey, setAdminKey] = React.useState(() => {
    try {
      return localStorage.getItem('SC_ADMIN_KEY') || '';
    } catch (e) {
      return '';
    }
  });
  const [newTenant, setNewTenant] = React.useState({
    tenantId: '',
    companyName: '',
    billingEmail: '',
    plan: 'pro',
  });
  const [creating, setCreating] = React.useState(false);
  const [createdTenant, setCreatedTenant] = React.useState(null); // {tenantId, apiKey}

  React.useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setError(null);
        const res = await fetch(`${API_BASE}/admin/tenants?page=${page}&pageSize=${pageSize}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled) {
          setTenants(data.tenants || []);
          setTotal(typeof data.total === 'number' ? data.total : null);
        }
      } catch (e) {
        if (!cancelled) setError(e);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [page, pageSize]);

  const refreshTenants = async () => {
    const res = await fetch(`${API_BASE}/admin/tenants?page=${page}&pageSize=${pageSize}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    setTenants(data.tenants || []);
    setTotal(typeof data.total === 'number' ? data.total : null);
  };

  const createTenant = async () => {
    setCreating(true);
    try {
      setError(null);
      setCreatedTenant(null);
      const headers = { 'content-type': 'application/json' };
      if (adminKey) headers['authorization'] = `Bearer ${adminKey}`;

      const res = await fetch(`${API_BASE}/accounts`, {
        method: 'POST',
        headers,
        body: JSON.stringify(newTenant),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setCreatedTenant({ tenantId: data.tenantId, apiKey: data.apiKey });
      setNewTenant({ tenantId: '', companyName: '', billingEmail: '', plan: 'pro' });
      setShowAddTenant(false);

      if (page !== 1) setPage(1);
      await refreshTenants();
    } catch (e) {
      setError(e);
    } finally {
      setCreating(false);
    }
  };

  React.useEffect(() => {
    try {
      localStorage.setItem('SC_ADMIN_KEY', adminKey || '');
    } catch (e) {
      // ignore
    }
  }, [adminKey]);

  const totalPages =
    typeof total === 'number' ? Math.max(1, Math.ceil(total / Math.max(1, pageSize))) : null;

  const Pagination = () => {
    if (totalPages === null || totalPages <= 1) return null;

    const windowSize = 2;
    const start = Math.max(1, page - windowSize);
    const end = Math.min(totalPages, page + windowSize);
    const pages = [];

    if (start > 1) pages.push(1);
    if (start > 2) pages.push('…');
    for (let p = start; p <= end; p++) pages.push(p);
    if (end < totalPages - 1) pages.push('…');
    if (end < totalPages) pages.push(totalPages);

    return (
      <nav aria-label="Tenant list pages">
        <ul className="pagination mb-0">
          <li className={`page-item ${page <= 1 ? 'disabled' : ''}`}>
            <button className="page-link" onClick={() => setPage((p) => Math.max(1, p - 1))}>
              Prev
            </button>
          </li>
          {pages.map((p, idx) =>
            p === '…' ? (
              <li className="page-item disabled" key={`ellipsis-${idx}`}>
                <span className="page-link">…</span>
              </li>
            ) : (
              <li className={`page-item ${p === page ? 'active' : ''}`} key={`page-${p}`}>
                <button className="page-link" onClick={() => setPage(p)}>
                  {p}
                </button>
              </li>
            )
          )}
          <li className={`page-item ${page >= totalPages ? 'disabled' : ''}`}>
            <button
              className="page-link"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </button>
          </li>
        </ul>
      </nav>
    );
  };

  return (
    <div className="bg-light min-vh-100">
      <nav className="navbar navbar-expand-lg bg-white border-bottom">
        <div className="container">
          <a className="navbar-brand" href="/">
            Service Catalogue
          </a>
          <div className="navbar-nav ms-auto">
            <a className="nav-link" href="/plans">
              Plans
            </a>
            <a className="nav-link" href="/admin">
              Admin
            </a>
          </div>
        </div>
      </nav>

      <main className="container py-4">
        <div className="p-4 p-md-5 mb-4 bg-white rounded-3 border">
          <div className="container-fluid py-2">
            <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3">
              <div>
                <h1 className="display-6 mb-2">Tenants</h1>
                <p className="text-muted mb-0">Choose a tenant</p>
              </div>
              <div className="d-flex align-items-center gap-2">
                <button className="btn btn-outline-secondary" onClick={() => refreshTenants()}>
                  Refresh
                </button>
                <button className="btn btn-primary" onClick={() => setShowAddTenant((v) => !v)}>
                  {showAddTenant ? 'Close' : 'Add tenant'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {createdTenant ? (
          <div className="alert alert-success" role="alert">
            Created tenant <span className="fw-semibold">{createdTenant.tenantId}</span>. API key (shown once):{' '}
            <span className="font-monospace">{createdTenant.apiKey}</span>
          </div>
        ) : null}

        {showAddTenant ? (
          <div className="card mb-3">
            <div className="card-body">
              <div className="row g-3">
                <div className="col-12">
                  <label className="form-label">Admin key (optional)</label>
                  <input
                    className="form-control font-monospace"
                    value={adminKey}
                    onChange={(e) => setAdminKey(e.target.value)}
                    placeholder="Bearer token (only needed if ADMIN_API_KEY is set on the API)"
                  />
                </div>
                <div className="col-12 col-md-6">
                  <label className="form-label">Tenant ID</label>
                  <input
                    className="form-control"
                    value={newTenant.tenantId}
                    onChange={(e) => setNewTenant((t) => ({ ...t, tenantId: e.target.value }))}
                    placeholder="e.g. TalentConsultingSandBox"
                  />
                </div>
                <div className="col-12 col-md-6">
                  <label className="form-label">Company name</label>
                  <input
                    className="form-control"
                    value={newTenant.companyName}
                    onChange={(e) => setNewTenant((t) => ({ ...t, companyName: e.target.value }))}
                    placeholder="e.g. Talent Consulting Sandbox"
                  />
                </div>
                <div className="col-12 col-md-6">
                  <label className="form-label">Billing email</label>
                  <input
                    className="form-control"
                    value={newTenant.billingEmail}
                    onChange={(e) => setNewTenant((t) => ({ ...t, billingEmail: e.target.value }))}
                    placeholder="e.g. sandbox@example.com"
                  />
                </div>
                <div className="col-12 col-md-3">
                  <label className="form-label">Plan</label>
                  <select
                    className="form-select"
                    value={newTenant.plan}
                    onChange={(e) => setNewTenant((t) => ({ ...t, plan: e.target.value }))}
                  >
                    <option value="pro">pro</option>
                    <option value="free">free</option>
                    <option value="enterprise">enterprise</option>
                  </select>
                </div>
                <div className="col-12 col-md-3 d-flex align-items-end">
                  <button
                    className="btn btn-success w-100"
                    onClick={createTenant}
                    disabled={
                      creating ||
                      !newTenant.tenantId.trim() ||
                      !newTenant.companyName.trim() ||
                      !newTenant.billingEmail.trim()
                    }
                  >
                    {creating ? 'Creating…' : 'Create tenant'}
                  </button>
                </div>
              </div>
              <div className="text-muted small mt-2">
                This calls <span className="font-monospace">POST /accounts</span> and will display the raw API key once.
              </div>
            </div>
          </div>
        ) : null}

        {error ? (
          <div className="alert alert-danger" role="alert">
            Failed to load tenants ({String(error.message || error)}).
          </div>
        ) : tenants === null ? (
          <div className="text-muted">Loading…</div>
        ) : tenants.length === 0 ? (
          <div className="alert alert-secondary" role="alert">
            No active tenants found.
          </div>
        ) : (
          <>
            <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3 mb-3">
              <div className="text-muted">
                Showing {(page - 1) * pageSize + 1}–{(page - 1) * pageSize + tenants.length}
                {typeof total === 'number' ? ` of ${total}` : ''}
              </div>
              <div className="d-flex align-items-center gap-2">
                <label className="form-label mb-0 text-muted" htmlFor="pageSize">
                  Per page
                </label>
                <select
                  id="pageSize"
                  className="form-select form-select-sm"
                  style={{ width: 110 }}
                  value={pageSize}
                  onChange={(e) => {
                    const next = parseInt(e.target.value, 10);
                    setPage(1);
                    setPageSize(next);
                  }}
                >
                  {[12, 24, 48, 96].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="row g-3">
              {tenants.map((t) => (
                <div className="col-12 col-md-6 col-lg-4" key={t.tenantId}>
                  <a
                    className="text-decoration-none"
                    href={`/tenant/${encodeURIComponent(t.tenantId)}/schemas`}
                  >
                    <div className="card h-100 shadow-sm">
                      <div className="card-body">
                        <div className="d-flex align-items-start justify-content-between gap-3">
                          <div>
                            <div className="fw-semibold">{t.companyName || t.tenantId}</div>
                            <div className="text-muted small">{t.tenantId}</div>
                          </div>
                          <span className="badge text-bg-success">Active</span>
                        </div>
                      </div>
                    </div>
                  </a>
                </div>
              ))}
            </div>

            <div className="d-flex justify-content-center mt-4">
              <Pagination />
            </div>
          </>
        )}
      </main>
    </div>
  );
}
