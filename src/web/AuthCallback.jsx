import React from 'react';
import { handleAuthCallback, resetAuthStorage } from './auth/AuthProvider.jsx';

export default function AuthCallback() {
  const [error, setError] = React.useState(null);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    // Keycloak returned an error (e.g. invalid_scope) or redirected here after
    // logout without a code — bail out cleanly rather than attempting an exchange.
    if (params.get('error') || !params.get('code')) {
      resetAuthStorage();
      window.location.replace('/');
      return;
    }

    (async () => {
      try {
        await handleAuthCallback();
        window.location.assign('/tenants');
      } catch (e) {
        const msg = String(e?.message || e || '');
        if (msg.includes('Missing PKCE state') || msg.includes('Invalid auth callback')) {
          resetAuthStorage();
          window.location.replace('/');
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
