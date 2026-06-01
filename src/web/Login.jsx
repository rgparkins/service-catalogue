import React from 'react';
import { useAuth } from './auth/AuthProvider.jsx';

export default function Login() {
  const auth = useAuth();

  React.useEffect(() => {
    if (auth.ready && !auth.authenticated) auth.login();
    if (auth.ready && auth.authenticated) window.location.assign('/tenants');
  }, [auth]);

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
          </div>
        </div>
      </nav>

      <main className="container py-5" style={{ maxWidth: 720 }}>
        <div className="card shadow-sm">
          <div className="card-body">
            <h1 className="h4 mb-2">Login</h1>
            <p className="text-muted mb-0">
              Redirecting to Keycloak…
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
