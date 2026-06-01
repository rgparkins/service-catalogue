import React from 'react';
import TenantLayout from './TenantLayout.jsx';
import { apiFetch } from './api.js';
import { useAuth, hasGlobalAdmin, hasTenantAdmin } from './auth/AuthProvider.jsx';
import Login from './Login.jsx';

export default function TenantUsers({ tenantId }) {
  const auth = useAuth();
  const [members, setMembers] = React.useState([]);
  const [invites, setInvites] = React.useState([]);
  const [error, setError] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [inviteEmail, setInviteEmail] = React.useState('');
  const [inviteRole, setInviteRole] = React.useState('member');
  const [createdInvite, setCreatedInvite] = React.useState(null);

  const canManage = hasGlobalAdmin(auth.tokenParsed) || hasTenantAdmin(auth.tokenParsed, tenantId);

  const load = async () => {
    setLoading(true);
    try {
      setError(null);
      setCreatedInvite(null);
      const [resUsers, resInv] = await Promise.all([
        apiFetch(auth, `/ui/tenants/${encodeURIComponent(tenantId)}/users`),
        apiFetch(auth, `/ui/tenants/${encodeURIComponent(tenantId)}/invites`),
      ]);

      if (!resUsers.ok) throw new Error((await resUsers.text()) || `HTTP ${resUsers.status}`);
      if (!resInv.ok) throw new Error((await resInv.text()) || `HTTP ${resInv.status}`);

      const usersJson = await resUsers.json();
      const invJson = await resInv.json();
      setMembers(usersJson.users || []);
      setInvites(invJson.invites || []);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    if (!auth.ready) return;
    if (!auth.authenticated) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.ready, auth.authenticated, tenantId]);

  const createInvite = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      setError(null);
      setCreatedInvite(null);
      const res = await apiFetch(auth, `/ui/tenants/${encodeURIComponent(tenantId)}/invites`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
      const json = await res.json();
      setCreatedInvite(json.invite || null);
      setInviteEmail('');
      await load();
    } catch (e2) {
      setError(e2);
    } finally {
      setLoading(false);
    }
  };

  if (!auth.ready) return null;
  if (!auth.authenticated) return <Login />;

  return (
    <TenantLayout tenantId={tenantId} active="users">
      <div className="d-flex align-items-center justify-content-between gap-3 mb-3">
        <h1 className="h4 mb-0">Users</h1>
        <button className="btn btn-outline-secondary btn-sm" onClick={load} disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {!canManage ? (
        <div className="alert alert-warning" role="alert">
          You don’t have permission to manage users for this tenant.
        </div>
      ) : null}

      {error ? (
        <div className="alert alert-danger" role="alert">
          {String(error.message || error)}
        </div>
      ) : null}

      {createdInvite ? (
        <div className="alert alert-success" role="alert">
          Invite created for <span className="fw-semibold">{createdInvite.email}</span>. Token:{' '}
          <span className="font-monospace">{createdInvite.token}</span>
        </div>
      ) : null}

      <div className="row g-3">
        <div className="col-12 col-lg-6">
          <div className="card">
            <div className="card-header">Members</div>
            <div className="card-body">
              {members.length === 0 ? (
                <div className="text-muted">No members assigned yet.</div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-sm align-middle mb-0">
                    <thead>
                      <tr>
                        <th>Email</th>
                        <th>Name</th>
                        <th>Role</th>
                      </tr>
                    </thead>
                    <tbody>
                      {members.map((m) => (
                        <tr key={`${m.tenantId}:${m.sub}`}>
                          <td className="font-monospace">{m.user?.email || '—'}</td>
                          <td>{m.user?.name || '—'}</td>
                          <td>
                            <span className="badge text-bg-secondary">{m.role}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="col-12 col-lg-6">
          <div className="card">
            <div className="card-header">Pending invites</div>
            <div className="card-body">
              {invites.length === 0 ? (
                <div className="text-muted">No pending invites.</div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-sm align-middle mb-0">
                    <thead>
                      <tr>
                        <th>Email</th>
                        <th>Role</th>
                        <th>Created</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invites.map((inv) => (
                        <tr key={inv.token}>
                          <td className="font-monospace">{inv.email}</td>
                          <td>
                            <span className="badge text-bg-info">{inv.role}</span>
                          </td>
                          <td>{inv.createdAt ? new Date(inv.createdAt).toLocaleString() : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <div className="card mt-3">
            <div className="card-header">Invite a user</div>
            <div className="card-body">
              <form onSubmit={createInvite} className="row g-2 align-items-end">
                <div className="col-12">
                  <label className="form-label">Email</label>
                  <input
                    className="form-control"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="name@company.com"
                    disabled={!canManage || loading}
                    required
                  />
                </div>
                <div className="col-12 col-md-6">
                  <label className="form-label">Role</label>
                  <select
                    className="form-select"
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                    disabled={!canManage || loading}
                  >
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div className="col-12 col-md-6">
                  <button className="btn btn-primary w-100" type="submit" disabled={!canManage || loading}>
                    {loading ? 'Creating…' : 'Create invite'}
                  </button>
                </div>
              </form>
              <div className="form-text mt-2">
                Invites are stored in MongoDB for now. Email delivery can be added later.
              </div>
            </div>
          </div>
        </div>
      </div>
    </TenantLayout>
  );
}

