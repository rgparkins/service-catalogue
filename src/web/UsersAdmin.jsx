import React from 'react';
import { useAuth, hasGlobalAdmin } from './auth/AuthProvider.jsx';
import Login from './Login.jsx';
import { apiFetch } from './api.js';

export default function UsersAdmin() {
  const auth = useAuth();
  const [users, setUsers] = React.useState([]);
  const [error, setError] = React.useState(null);
  const [loading, setLoading] = React.useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setError(null);
      const res = await apiFetch(auth, '/ui/users');
      if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
      const json = await res.json();
      setUsers(json.users || []);
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

  if (!auth.ready) return null;
  if (!auth.authenticated) return <Login />;
  if (!hasGlobalAdmin(auth.tokenParsed)) {
    return (
      <div className="bg-light min-vh-100">
        <main className="container py-4">
          <div className="alert alert-warning" role="alert">
            Forbidden: global-admin role required.
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="bg-light min-vh-100">
      <main className="container py-4">
        <div className="d-flex align-items-center justify-content-between gap-3 mb-3">
          <h1 className="h4 mb-0">User management</h1>
          <button className="btn btn-outline-secondary btn-sm" onClick={load} disabled={loading}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>

        {error ? (
          <div className="alert alert-danger" role="alert">
            {String(error.message || error)}
          </div>
        ) : null}

        <div className="card">
          <div className="card-body">
            {users.length === 0 ? (
              <div className="text-muted">No users recorded yet. Visit any protected page to create your user record.</div>
            ) : (
              <div className="table-responsive">
                <table className="table table-sm align-middle mb-0">
                  <thead>
                    <tr>
                      <th>Email</th>
                      <th>Name</th>
                      <th>Sub</th>
                      <th>Created</th>
                      <th>Last seen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.sub}>
                        <td className="font-monospace">{u.email || '—'}</td>
                        <td>{u.name || '—'}</td>
                        <td className="font-monospace small">{u.sub}</td>
                        <td>{u.createdAt ? new Date(u.createdAt).toLocaleString() : '—'}</td>
                        <td>{u.lastSeenAt ? new Date(u.lastSeenAt).toLocaleString() : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

