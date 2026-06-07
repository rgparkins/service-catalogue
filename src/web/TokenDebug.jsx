import React from 'react';
import Header from './Header.jsx';
import { useAuth } from './auth/AuthProvider.jsx';

export default function TokenDebug() {
  const auth = useAuth();
  const token = auth.token || '';
  const parsed = auth.tokenParsed || null;

  if (!auth.ready) return null;
  if (!auth.authenticated) {
    return (
      <div className="bg-light min-vh-100">
        <Header mode="public" />
        <main className="container py-4">
          <div className="alert alert-warning">Login required to view token details.</div>
        </main>
      </div>
    );
  }

  return (
    <div className="bg-light min-vh-100">
      <Header mode="app" />
      <main className="container py-4">
        <div className="card">
          <div className="card-body">
            <h1 className="card-title">JWT Debug</h1>
            <p className="text-muted mb-4">
              Raw access token and decoded payload for the currently authenticated user.
            </p>

            <div className="mb-4">
              <label className="form-label">Raw token</label>
              <textarea
                className="form-control font-monospace"
                rows={6}
                readOnly
                value={token}
              />
            </div>

            <div>
              <label className="form-label">Decoded payload</label>
              <pre className="p-3 bg-dark text-light rounded" style={{ overflowX: 'auto' }}>
                {JSON.stringify(parsed, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
