import React from 'react';
import { useAuth } from './auth/AuthProvider.jsx';
import Header from './Header.jsx';

export default function Login() {
  const auth = useAuth();
  const [attempted, setAttempted] = React.useState(false);

  React.useEffect(() => {
    if (!auth.ready) return;
    if (auth.authenticated) {
      window.location.assign('/tenants');
      return;
    }
    if (!auth.configured) return;
    setAttempted(true);
    auth.login();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.ready, auth.authenticated]);

  return (
    <div className="bg-light min-vh-100">
      <Header mode="public" />

      <main className="container py-5" style={{ maxWidth: 720 }}>
        <div className="card shadow-sm">
          <div className="card-body">
            <h1 className="h4 mb-2">Login</h1>
            {!auth.ready ? (
              <p className="text-muted mb-0">Preparing login…</p>
            ) : !auth.configured ? (
              <div className="alert alert-warning mb-0" role="alert">
                <div>Login is not configured.</div>
                <div className="font-monospace small mt-1">
                  VITE_KEYCLOAK_URL: {import.meta.env.VITE_KEYCLOAK_URL || '(not set)'}<br />
                  VITE_KEYCLOAK_REALM: {import.meta.env.VITE_KEYCLOAK_REALM || '(not set)'}<br />
                  VITE_KEYCLOAK_CLIENT_ID: {import.meta.env.VITE_KEYCLOAK_CLIENT_ID || '(not set)'}
                </div>
              </div>
            ) : (
              <>
                <p className="text-muted mb-3">{attempted ? 'Redirecting to Keycloak…' : 'Starting login…'}</p>
                <button className="btn btn-primary" onClick={() => auth.login()} disabled={!auth.ready}>
                  Continue to Keycloak
                </button>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
