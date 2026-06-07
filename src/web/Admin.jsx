import React from 'react';
import Breadcrumb from './Breadcrumb.jsx';

const API_BASE =
  (import.meta.env.VITE_SERVICE_METADATA_URL || '').replace(/\/+$/, '') || 'http://localhost:3000';

export default function Admin() {
  const [tenantCount, setTenantCount] = React.useState(null);
  const [error, setError] = React.useState(null);

  React.useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(`${API_BASE}/admin/tenants/count`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled) setTenantCount(data.tenantCount);
      } catch (e) {
        if (!cancelled) setError(e);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="bg-light min-vh-100">
      <main className="container py-4">
        <Breadcrumb crumbs={[{ label: 'Admin' }]} />
        <div className="p-4 p-md-5 mb-4 bg-white rounded-3 border">
          <div className="container-fluid py-2">
            <h1 className="display-6 mb-2">Admin</h1>
            <p className="text-muted mb-0">Tenant overview</p>
          </div>
        </div>

        <div className="row g-4">
          <div className="col-12 col-md-6">
            <div className="card shadow-sm">
              <div className="card-body">
                <div className="d-flex align-items-baseline justify-content-between">
                  <h2 className="h5 mb-0">Tenants</h2>
                  <span className="badge text-bg-primary">Active</span>
                </div>

                {error ? (
                  <div className="alert alert-danger mt-3 mb-0" role="alert">
                    Failed to load tenant count ({String(error.message || error)}).
                  </div>
                ) : (
                  <>
                    <div className="display-5 mt-2">{tenantCount ?? '…'}</div>
                    <div className="text-muted">Number of active tenant accounts</div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

