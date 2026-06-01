import React from 'react';
import { useAuth } from './auth/AuthProvider.jsx';
import Login from './Login.jsx';
import { apiFetch } from './api.js';

export default function Invites() {
  const auth = useAuth();
  const [invites, setInvites] = React.useState([]);
  const [error, setError] = React.useState(null);
  const [loading, setLoading] = React.useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setError(null);
      const res = await apiFetch(auth, '/ui/invites');
      if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
      const json = await res.json();
      setInvites(json.invites || []);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    if (!auth.ready) return;
    if (!auth.authenticated) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.ready, auth.authenticated]);

  const accept = async (token) => {
    setLoading(true);
    try {
      setError(null);
      const res = await apiFetch(auth, `/ui/invites/${encodeURIComponent(token)}/accept`, { method: 'POST' });
      if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
      await load();
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  };

  if (!auth.ready) return null;
  if (!auth.authenticated) return <Login />;

  return (
    <div className="bg-light min-vh-100">
      <main className="container py-4">
        <div className="d-flex align-items-center justify-content-between gap-3 mb-3">
          <h1 className="h4 mb-0">Invites</h1>
          <button className="btn btn-outline-secondary btn-sm" onClick={load} disabled={loading}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>

        {error ? (
          <div className="alert alert-danger" role="alert">
            {String(error.message || error)}
          </div>
        ) : null}

        {invites.length === 0 ? (
          <div className="text-muted">No pending invites.</div>
        ) : (
          <div className="table-responsive bg-white border rounded">
            <table className="table table-sm align-middle mb-0">
              <thead>
                <tr>
                  <th>Tenant</th>
                  <th>Role</th>
                  <th>Created</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {invites.map((inv) => (
                  <tr key={inv.token}>
                    <td className="font-monospace">{inv.tenantId}</td>
                    <td>
                      <span className="badge text-bg-info">{inv.role}</span>
                    </td>
                    <td>{inv.createdAt ? new Date(inv.createdAt).toLocaleString() : '—'}</td>
                    <td className="text-end">
                      <button className="btn btn-sm btn-primary" onClick={() => accept(inv.token)} disabled={loading}>
                        Accept
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}

