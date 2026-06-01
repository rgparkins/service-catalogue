import React from 'react';
import TenantLayout from './TenantLayout.jsx';

const API_BASE =
  (import.meta.env.VITE_SERVICE_METADATA_URL || '').replace(/\/+$/, '') || 'http://localhost:3000';

export default function TenantRulesets({ tenantId }) {
  const [tenantApiKey, setTenantApiKey] = React.useState(() => {
    try {
      return localStorage.getItem('SC_TENANT_API_KEY') || '';
    } catch {
      return '';
    }
  });
  const [error, setError] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [rulesets, setRulesets] = React.useState([]);
  const [showAdd, setShowAdd] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [newRule, setNewRule] = React.useState({
    name: '',
    field: 'service.name',
    pattern: '^[a-z0-9]+(\\.[a-z0-9]+)+$',
    enabled: true,
    description: '',
  });

  React.useEffect(() => {
    try {
      localStorage.setItem('SC_TENANT_API_KEY', tenantApiKey || '');
    } catch {
      // ignore
    }
  }, [tenantApiKey]);

  const load = async () => {
    setLoading(true);
    try {
      setError(null);
      const headers = {};
      if (tenantApiKey) headers['authorization'] = `Bearer ${tenantApiKey}`;
      else headers['x-tenant-id'] = tenantId; // dev-mode convenience

      const res = await fetch(`${API_BASE}/rulesets`, { headers });
      if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
      const json = await res.json();
      setRulesets(json.rulesets || []);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  const createRuleset = async () => {
    setCreating(true);
    try {
      setError(null);
      const headers = { 'content-type': 'application/json' };
      if (tenantApiKey) headers['authorization'] = `Bearer ${tenantApiKey}`;
      else headers['x-tenant-id'] = tenantId;

      const res = await fetch(`${API_BASE}/rulesets`, {
        method: 'POST',
        headers,
        body: JSON.stringify(newRule),
      });
      if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
      setNewRule((r) => ({ ...r, name: '', description: '' }));
      setShowAdd(false);
      await load();
    } catch (e) {
      setError(e);
    } finally {
      setCreating(false);
    }
  };

  const toggleEnabled = async (r) => {
    setLoading(true);
    try {
      setError(null);
      const headers = { 'content-type': 'application/json' };
      if (tenantApiKey) headers['authorization'] = `Bearer ${tenantApiKey}`;
      else headers['x-tenant-id'] = tenantId;

      const res = await fetch(`${API_BASE}/rulesets/${encodeURIComponent(r.id)}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ enabled: !r.enabled }),
      });
      if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
      await load();
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  };

  const remove = async (r) => {
    if (!confirm(`Delete ruleset "${r.name}"?`)) return;
    setLoading(true);
    try {
      setError(null);
      const headers = {};
      if (tenantApiKey) headers['authorization'] = `Bearer ${tenantApiKey}`;
      else headers['x-tenant-id'] = tenantId;

      const res = await fetch(`${API_BASE}/rulesets/${encodeURIComponent(r.id)}`, { method: 'DELETE', headers });
      if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
      await load();
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <TenantLayout tenantId={tenantId} active="rulesets">
      <div className="d-flex align-items-center justify-content-between gap-3 mb-3">
        <h1 className="h4 mb-0">Rulesets</h1>
        <div className="d-flex gap-2">
          <button className="btn btn-outline-secondary btn-sm" onClick={load} disabled={loading}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => setShowAdd((v) => !v)}>
            {showAdd ? 'Close' : 'Add ruleset'}
          </button>
        </div>
      </div>

      {error ? (
        <div className="alert alert-danger" role="alert">
          {String(error.message || error)}
        </div>
      ) : null}

      <div className="card mb-3">
        <div className="card-body">
          <label className="form-label">Tenant API key (optional in dev)</label>
          <input
            className="form-control font-monospace"
            value={tenantApiKey}
            onChange={(e) => setTenantApiKey(e.target.value)}
            placeholder="Bearer token for this tenant"
          />
          <div className="form-text mt-2">
            Rulesets are applied when you POST service metadata. Each enabled rule checks a field against a regex pattern.
          </div>
        </div>
      </div>

      {showAdd ? (
        <div className="card mb-3">
          <div className="card-body">
            <div className="row g-3">
              <div className="col-12 col-md-6">
                <label className="form-label">Name</label>
                <input
                  className="form-control"
                  value={newRule.name}
                  onChange={(e) => setNewRule((r) => ({ ...r, name: e.target.value }))}
                  placeholder="e.g. Service name format"
                />
              </div>
              <div className="col-12 col-md-6">
                <label className="form-label">Field</label>
                <input
                  className="form-control font-monospace"
                  value={newRule.field}
                  onChange={(e) => setNewRule((r) => ({ ...r, field: e.target.value }))}
                  placeholder="service.name or service.metadata.repo"
                />
              </div>
              <div className="col-12">
                <label className="form-label">Regex pattern</label>
                <input
                  className="form-control font-monospace"
                  value={newRule.pattern}
                  onChange={(e) => setNewRule((r) => ({ ...r, pattern: e.target.value }))}
                />
              </div>
              <div className="col-12">
                <label className="form-label">Description (optional)</label>
                <input
                  className="form-control"
                  value={newRule.description}
                  onChange={(e) => setNewRule((r) => ({ ...r, description: e.target.value }))}
                />
              </div>
              <div className="col-12 d-flex align-items-center gap-2">
                <input
                  className="form-check-input"
                  type="checkbox"
                  checked={newRule.enabled}
                  onChange={(e) => setNewRule((r) => ({ ...r, enabled: e.target.checked }))}
                  id="enabledCheck"
                />
                <label className="form-check-label" htmlFor="enabledCheck">
                  Enabled
                </label>
              </div>
            </div>
            <div className="d-flex justify-content-end gap-2 mt-3">
              <button className="btn btn-outline-secondary" onClick={() => setShowAdd(false)} disabled={creating}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={createRuleset} disabled={creating || !newRule.name}>
                {creating ? 'Creating…' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="card">
        <div className="card-body">
          {rulesets.length === 0 ? (
            <div className="text-muted">No rulesets yet.</div>
          ) : (
            <div className="table-responsive">
              <table className="table table-sm align-middle mb-0">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Field</th>
                    <th>Pattern</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {rulesets.map((r) => (
                    <tr key={r.id}>
                      <td>{r.name}</td>
                      <td className="font-monospace">{r.field}</td>
                      <td className="font-monospace small" style={{ maxWidth: 360, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {r.pattern}
                      </td>
                      <td>
                        <span className={`badge ${r.enabled ? 'text-bg-success' : 'text-bg-secondary'}`}>
                          {r.enabled ? 'enabled' : 'disabled'}
                        </span>
                      </td>
                      <td className="text-end">
                        <div className="btn-group btn-group-sm">
                          <button className="btn btn-outline-primary" onClick={() => toggleEnabled(r)} disabled={loading}>
                            {r.enabled ? 'Disable' : 'Enable'}
                          </button>
                          <button className="btn btn-outline-danger" onClick={() => remove(r)} disabled={loading}>
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </TenantLayout>
  );
}

