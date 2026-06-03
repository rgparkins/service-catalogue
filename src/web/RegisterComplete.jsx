import React from 'react';
import Header from './Header.jsx';

const API_BASE =
  (import.meta.env.VITE_SERVICE_METADATA_URL || '').replace(/\/+$/, '') || 'http://localhost:3000';

export default function RegisterComplete() {
  const token = new URLSearchParams(window.location.search).get('token') || '';
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [info, setInfo] = React.useState(null); // {tenantId,email,name}
  const [password, setPassword] = React.useState('');
  const [done, setDone] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setError(null);
        if (!token) return;
        const res = await fetch(`${API_BASE}/public/registration/${encodeURIComponent(token)}`);
        if (!res.ok) {
          const txt = await res.text();
          if (res.status === 404) {
            throw new Error('Registration link is invalid or has expired. Please request a new registration.');
          }
          throw new Error(txt || `HTTP ${res.status}`);
        }
        const json = await res.json();
        if (!cancelled) setInfo(json);
      } catch (e) {
        if (!cancelled) setError(e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      setError(null);
      const res = await fetch(`${API_BASE}/public/registration/${encodeURIComponent(token)}/complete`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
      setDone(true);
    } catch (e2) {
      setError(e2);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-light min-vh-100">
      <Header mode="public" />

      <main className="container py-5" style={{ maxWidth: 720 }}>
        <div className="card shadow-sm">
          <div className="card-body">
            <h1 className="h4 mb-2">Complete registration</h1>
            {!token ? <div className="alert alert-warning mb-0">Missing registration token.</div> : null}

            {error ? (
              <div className="alert alert-danger mt-3" role="alert">
                {String(error.message || error)}
                <div className="mt-2">
                  <a href="/register">Go to registration</a>
                </div>
              </div>
            ) : null}

            {done ? (
              <div className="mt-3">
                <div className="alert alert-success" role="alert">
                  Registration complete. You can now log in.
                </div>
                <a className="btn btn-primary" href="/login">
                  Go to login
                </a>
              </div>
            ) : (
              <form onSubmit={submit} className="mt-3">
                {info ? (
                  <div className="mb-3 text-muted small">
                    Tenant: <span className="font-monospace">{info.tenantId}</span>
                    <br />
                    Email: <span className="font-monospace">{info.email}</span>
                  </div>
                ) : null}

                <label className="form-label">Choose a password</label>
                <input
                  className="form-control"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={8}
                  required
                  disabled={loading}
                />
                <div className="form-text">Minimum 8 characters.</div>

                <button className="btn btn-primary mt-3" type="submit" disabled={loading || !token}>
                  {loading ? 'Submitting…' : 'Complete registration'}
                </button>
              </form>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
