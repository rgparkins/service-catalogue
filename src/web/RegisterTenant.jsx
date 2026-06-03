import React from 'react';
import { useAuth } from './auth/AuthProvider.jsx';
import Header from './Header.jsx';

const API_BASE =
  (import.meta.env.VITE_SERVICE_METADATA_URL || '').replace(/\/+$/, '') || 'http://localhost:3000';

export default function RegisterTenant() {
  // Registration is public, but users might land here while authenticated.
  const auth = useAuth();
  const [form, setForm] = React.useState({ tenantId: '', adminName: '', adminEmail: '', billingEmail: '' });
  const [status, setStatus] = React.useState(null);
  const [error, setError] = React.useState(null);
  const [loading, setLoading] = React.useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      setError(null);
      setStatus(null);
      const res = await fetch(`${API_BASE}/public/signup`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
      const json = await res.json();
      setStatus(json.message || 'Request submitted.');
      setForm({ tenantId: '', adminName: '', adminEmail: '', billingEmail: '' });
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-light min-vh-100">
      <Header mode="public" />

      <main className="container py-5" style={{ maxWidth: 920 }}>
        <div className="row g-4">
          <div className="col-12">
            <h1 className="display-6 mb-2">Create tenant</h1>
            <p className="text-muted mb-0">
              Enter your tenant ID and admin user email. We’ll create the tenant and email you a link to set your
              password.
            </p>
          </div>

          <div className="col-12 col-lg-7">
            {error ? (
              <div className="alert alert-danger" role="alert">
                {String(error.message || error)}
              </div>
            ) : null}
            {status ? (
              <div className="alert alert-success" role="alert">
                {status}
              </div>
            ) : null}

            <div className="card shadow-sm">
              <div className="card-body">
                <form onSubmit={submit} className="row g-3">
                  <div className="col-12 col-md-6">
                    <label className="form-label">Tenant ID</label>
                    <input
                      className="form-control"
                      value={form.tenantId}
                      onChange={(e) => setForm((s) => ({ ...s, tenantId: e.target.value }))}
                      placeholder="e.g. TalentConsultingSandBox"
                      required
                      disabled={loading}
                    />
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="form-label">Admin email</label>
                    <input
                      className="form-control"
                      type="email"
                      value={form.adminEmail}
                      onChange={(e) => setForm((s) => ({ ...s, adminEmail: e.target.value }))}
                      placeholder="you@company.com"
                      required
                      disabled={loading}
                    />
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="form-label">Admin name (optional)</label>
                    <input
                      className="form-control"
                      value={form.adminName}
                      onChange={(e) => setForm((s) => ({ ...s, adminName: e.target.value }))}
                      placeholder="Your name"
                      disabled={loading}
                    />
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="form-label">Billing email (optional)</label>
                    <input
                      className="form-control"
                      type="email"
                      value={form.billingEmail}
                      onChange={(e) => setForm((s) => ({ ...s, billingEmail: e.target.value }))}
                      placeholder="billing@company.com"
                      disabled={loading}
                    />
                  </div>
                  <div className="col-12">
                    <button className="btn btn-primary" type="submit" disabled={loading}>
                      {loading ? 'Submitting…' : 'Create tenant'}
                    </button>
                    <div className="form-text mt-2">
                      Email delivery uses Keycloak’s SMTP settings. If SMTP isn’t configured yet, the API will still
                      create the tenant/user but you won’t receive the email.
                    </div>
                  </div>
                </form>
              </div>
            </div>
          </div>

          <div className="col-12 col-lg-5">
            <div className="card border-0 shadow-sm">
              <div className="card-body">
                <div className="fw-semibold mb-2">What happens next</div>
                <ol className="mb-0">
                  <li>We create your tenant.</li>
                  <li>We create your admin user in Keycloak.</li>
                  <li>You get an email to set your password.</li>
                  <li>Log in and manage your tenant.</li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
