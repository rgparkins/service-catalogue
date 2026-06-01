import React from 'react';
import TenantLayout from './TenantLayout.jsx';

const API_BASE =
  (import.meta.env.VITE_SERVICE_METADATA_URL || '').replace(/\/+$/, '') || 'http://localhost:3000';

export default function TenantSettings({ tenantId }) {
  const [adminKey, setAdminKey] = React.useState(() => {
    try {
      return localStorage.getItem('SC_ADMIN_KEY') || '';
    } catch (e) {
      return '';
    }
  });
  const [error, setError] = React.useState(null);
  const [rotating, setRotating] = React.useState(false);
  const [newApiKey, setNewApiKey] = React.useState(null);
  const [account, setAccount] = React.useState(null);

  React.useEffect(() => {
    try {
      localStorage.setItem('SC_ADMIN_KEY', adminKey || '');
    } catch (e) {
      // ignore
    }
  }, [adminKey]);

  const rotateKey = async () => {
    setRotating(true);
    try {
      setError(null);
      setNewApiKey(null);
      const headers = {};
      if (adminKey) headers['authorization'] = `Bearer ${adminKey}`;

      const res = await fetch(`${API_BASE}/accounts/${encodeURIComponent(tenantId)}/rotate`, {
        method: 'POST',
        headers,
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setNewApiKey(data.apiKey);
      await loadAccount(headers);
    } catch (e) {
      setError(e);
    } finally {
      setRotating(false);
    }
  };

  const loadAccount = async (headersOverride) => {
    const headers = headersOverride || (adminKey ? { authorization: `Bearer ${adminKey}` } : {});
    const res = await fetch(`${API_BASE}/accounts/${encodeURIComponent(tenantId)}`, { headers });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(txt || `HTTP ${res.status}`);
    }
    const data = await res.json();
    setAccount(data);
  };

  React.useEffect(() => {
    (async () => {
      try {
        setError(null);
        await loadAccount();
      } catch (e) {
        setError(e);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  return (
    <TenantLayout tenantId={tenantId} active="settings">
      <h1 className="h4 mb-3">Settings</h1>

      {error ? (
        <div className="alert alert-danger" role="alert">
          {String(error.message || error)}
        </div>
      ) : null}

      <div className="card">
        <div className="card-body">
          <div className="fw-semibold mb-2">API key rotation</div>
          <div className="text-muted small mb-3">
            This calls <span className="font-monospace">POST /accounts/{tenantId}/rotate</span>. The new key is shown
            once and replaces the old key immediately.
          </div>

          <label className="form-label">Admin key</label>
          <input
            className="form-control font-monospace mb-3"
            value={adminKey}
            onChange={(e) => setAdminKey(e.target.value)}
            placeholder="Bearer token (required if ADMIN_API_KEY is set on the API)"
          />

          <div className="mb-3">
            <div className="text-muted small">Last rotated</div>
            <div className="font-monospace">
              {account?.apiKeyRotatedAt ? new Date(account.apiKeyRotatedAt).toLocaleString() : 'Unknown'}
            </div>
          </div>

          <div className="d-flex flex-column flex-sm-row gap-2 align-items-sm-center">
            <button className="btn btn-danger" onClick={rotateKey} disabled={rotating}>
              {rotating ? 'Rotating…' : 'Rotate API key'}
            </button>
            {newApiKey ? (
              <div className="alert alert-success mb-0 py-2 px-3 flex-grow-1" role="alert">
                New API key:{' '}
                <span className="font-monospace" style={{ wordBreak: 'break-all' }}>
                  {newApiKey}
                </span>
              </div>
            ) : (
              <div className="text-muted small">Keep this key somewhere safe.</div>
            )}
          </div>
        </div>
      </div>
    </TenantLayout>
  );
}
