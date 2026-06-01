import React from 'react';
import { handleAuthCallback } from './auth/AuthProvider.jsx';

export default function AuthCallback() {
  const [error, setError] = React.useState(null);

  React.useEffect(() => {
    (async () => {
      try {
        await handleAuthCallback();
        window.location.assign('/tenants');
      } catch (e) {
        setError(e);
      }
    })();
  }, []);

  return (
    <div className="bg-light min-vh-100">
      <main className="container py-5" style={{ maxWidth: 720 }}>
        <div className="card shadow-sm">
          <div className="card-body">
            <h1 className="h4 mb-2">Signing in…</h1>
            {error ? (
              <div className="alert alert-danger" role="alert">
                {String(error.message || error)}
              </div>
            ) : (
              <p className="text-muted mb-0">Completing login.</p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

