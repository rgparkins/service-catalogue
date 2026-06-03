import React from 'react';
import { handleAuthCallback, resetAuthStorage } from './auth/AuthProvider.jsx';

export default function AuthCallback() {
  const [error, setError] = React.useState(null);

  React.useEffect(() => {
    (async () => {
      try {
        await handleAuthCallback();
        window.location.assign('/tenants');
      } catch (e) {
        const msg = String(e?.message || e || '');
        // If someone lands here without starting a login (or after a logout redirect),
        // don't strand them on a broken callback page.
        if (msg.includes('Missing PKCE state') || msg.includes('Invalid auth callback')) {
          resetAuthStorage();
          window.location.replace('/login');
          return;
        }
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
