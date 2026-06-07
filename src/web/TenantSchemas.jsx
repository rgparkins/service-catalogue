import React from 'react';
import TenantLayout from './TenantLayout.jsx';

const API_BASE =
  (import.meta.env.VITE_SERVICE_METADATA_URL || '').replace(/\/+$/, '') || 'http://localhost:3000';

export default function TenantSchemas({ tenantId }) {
  const [schemas, setSchemas] = React.useState(null);
  const [error, setError] = React.useState(null);
  const [showAdd, setShowAdd] = React.useState(false);
  const [newSchemaJson, setNewSchemaJson] = React.useState('{\n  "version": "3.0.0"\n}\n');
  const [saving, setSaving] = React.useState(false);
  const [editingVersion, setEditingVersion] = React.useState(null);
  const [editSchemaJson, setEditSchemaJson] = React.useState('');

  const schemaBase = `${API_BASE}/metadata/tenants/${encodeURIComponent(tenantId)}/schemas`;

  const loadSchemas = React.useCallback(async () => {
    const res = await fetch(schemaBase);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    setSchemas(Array.isArray(data) ? data : []);
  }, [tenantId]);

  React.useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setError(null);
        await loadSchemas();
      } catch (e) {
        if (!cancelled) setError(e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loadSchemas]);

  const onCreateSchema = async () => {
    setSaving(true);
    try {
      const parsed = JSON.parse(newSchemaJson);
      const res = await fetch(schemaBase, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(parsed),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `HTTP ${res.status}`);
      }
      await loadSchemas();
      setShowAdd(false);
    } catch (e) {
      setError(e);
    } finally {
      setSaving(false);
    }
  };

  const startEdit = async (version, status) => {
    if (status === 'live' || status === 'superseded') return;
    try {
      const res = await fetch(`${API_BASE}/metadata/schema/${encodeURIComponent(version)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setEditingVersion(version);
      setEditSchemaJson(JSON.stringify(data, null, 2));
    } catch (e) {
      setError(e);
    }
  };

  const onSaveEdit = async () => {
    if (!editingVersion) return;
    setSaving(true);
    try {
      const parsed = JSON.parse(editSchemaJson);
      const res = await fetch(`${schemaBase}/${encodeURIComponent(editingVersion)}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(parsed),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `HTTP ${res.status}`);
      }
      await loadSchemas();
      setEditingVersion(null);
      setEditSchemaJson('');
    } catch (e) {
      setError(e);
    } finally {
      setSaving(false);
    }
  };

  const onDeleteSchema = async (version, status) => {
    if (status === 'live' || status === 'superseded') return;
    if (!confirm(`Delete schema ${version}?`)) return;
    setSaving(true);
    try {
      const res = await fetch(`${schemaBase}/${encodeURIComponent(version)}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `HTTP ${res.status}`);
      }
      await loadSchemas();
    } catch (e) {
      setError(e);
    } finally {
      setSaving(false);
    }
  };

  const onMakeLive = async (version) => {
    if (!confirm(`Set schema ${version} live? This will supersede the current live schema.`)) return;
    setSaving(true);
    try {
      const res = await fetch(`${schemaBase}/${encodeURIComponent(version)}/live`, {
        method: 'POST',
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `HTTP ${res.status}`);
      }
      await loadSchemas();
    } catch (e) {
      setError(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <TenantLayout tenantId={tenantId} active="schemas">
      <div className="d-flex align-items-center justify-content-between gap-3 mb-3">
        <h1 className="h4 mb-0">Schemas</h1>
        <button className="btn btn-sm btn-primary" onClick={() => setShowAdd((v) => !v)}>
          {showAdd ? 'Close' : 'Add schema'}
        </button>
      </div>

      {showAdd ? (
        <div className="card mb-3">
          <div className="card-body">
            <div className="mb-2 fw-semibold">New schema (JSON)</div>
            <textarea
              className="form-control font-monospace"
              rows={10}
              value={newSchemaJson}
              onChange={(e) => setNewSchemaJson(e.target.value)}
            />
            <div className="d-flex justify-content-end gap-2 mt-3">
              <button className="btn btn-outline-secondary" onClick={() => setShowAdd(false)} disabled={saving}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={onCreateSchema} disabled={saving}>
                {saving ? 'Saving…' : 'Save schema'}
              </button>
            </div>
            <div className="text-muted small mt-2">
              Must include a top-level <span className="font-monospace">version</span> field.
            </div>
          </div>
        </div>
      ) : null}

      {editingVersion ? (
        <div className="card mb-3">
          <div className="card-body">
            <div className="d-flex align-items-center justify-content-between gap-2 mb-2">
              <div className="fw-semibold">Edit schema {editingVersion}</div>
              <button
                className="btn btn-sm btn-outline-secondary"
                onClick={() => {
                  setEditingVersion(null);
                  setEditSchemaJson('');
                }}
                disabled={saving}
              >
                Close
              </button>
            </div>
            <textarea
              className="form-control font-monospace"
              rows={14}
              value={editSchemaJson}
              onChange={(e) => setEditSchemaJson(e.target.value)}
            />
            <div className="d-flex justify-content-end gap-2 mt-3">
              <button className="btn btn-primary" onClick={onSaveEdit} disabled={saving}>
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="alert alert-danger" role="alert">
          Failed to load schemas ({String(error.message || error)}).
        </div>
      ) : schemas === null ? (
        <div className="text-muted">Loading…</div>
      ) : schemas.length === 0 ? (
        <div className="alert alert-secondary" role="alert">
          No schemas found.
        </div>
      ) : (
        <ul className="list-group">
          {schemas.map((s) => (
            <li
              className="list-group-item d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-2"
              key={s.version}
            >
              <div>
                <div className="fw-semibold">
                  {s.version}
                  {s.latest ? <span className="badge text-bg-primary ms-2">Latest</span> : null}
                </div>
                <div className="text-muted small">
                  Created {s.createdAt ? new Date(s.createdAt).toLocaleString() : 'unknown'}
                </div>
              </div>
              <div className="d-flex align-items-center gap-2 flex-wrap justify-content-md-end">
                <span
                  className={
                    s.status === 'live'
                      ? 'badge text-bg-success'
                      : s.status === 'superseded'
                        ? 'badge text-bg-secondary'
                        : 'badge text-bg-warning'
                  }
                >
                  {s.status || 'draft'}
                </span>
                <a
                  className="btn btn-sm btn-outline-primary"
                  href={`${API_BASE}/metadata/schema/${encodeURIComponent(s.version)}`}
                >
                  View JSON
                </a>
                <button
                  className="btn btn-sm btn-outline-secondary"
                  onClick={() => startEdit(s.version, s.status)}
                  disabled={saving || s.status === 'live' || s.status === 'superseded'}
                >
                  Edit
                </button>
                <button
                  className="btn btn-sm btn-outline-danger"
                  onClick={() => onDeleteSchema(s.version, s.status)}
                  disabled={saving || s.status === 'live' || s.status === 'superseded'}
                >
                  Delete
                </button>
                {s.status === 'live' ? (
                  <button className="btn btn-sm btn-success" disabled>
                    Live
                  </button>
                ) : (
                  <button
                    className="btn btn-sm btn-success"
                    onClick={() => onMakeLive(s.version)}
                    disabled={saving || s.status === 'superseded'}
                  >
                    Make live
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </TenantLayout>
  );
}
