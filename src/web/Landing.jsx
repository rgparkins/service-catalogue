import React from 'react';
import { useAuth } from './auth/AuthProvider.jsx';

export default function Landing() {
  const auth = useAuth();

  const scrollTo = (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="bg-light min-vh-100">
      <nav className="navbar navbar-expand-lg bg-white border-bottom">
        <div className="container">
          <a className="navbar-brand" href="/">
            Service Catalogue
          </a>
          <div className="navbar-nav ms-auto">
            <a className="nav-link" href="/register">
              Create tenant
            </a>
            <button className="nav-link btn btn-link" onClick={() => scrollTo('about')}>
              About us
            </button>
            <button className="nav-link btn btn-link" onClick={() => scrollTo('pricing')}>
              Pricing
            </button>
            {auth.authenticated ? (
              <button className="nav-link btn btn-link" onClick={() => auth.logout()} disabled={!auth.ready}>
                Logout
              </button>
            ) : (
              <button className="nav-link btn btn-link" onClick={() => auth.login()} disabled={!auth.ready}>
                Login
              </button>
            )}
          </div>
        </div>
      </nav>

      <main className="container py-5">
        <div className="row align-items-center g-4">
          <div className="col-12 col-lg-7">
            <h1 className="display-5 fw-semibold mb-3">Service Catalogue</h1>
            <p className="lead text-muted mb-4">
              A single place to manage service metadata, validate schemas, and visualise dependencies across your
              platform.
            </p>

            <div className="d-flex flex-wrap gap-2">
              {auth.authenticated ? (
                <a className="btn btn-primary btn-lg" href="/tenants">
                  Go to tenant list
                </a>
              ) : (
                <button className="btn btn-primary btn-lg" onClick={() => auth.login()} disabled={!auth.ready}>
                  Login
                </button>
              )}
              <button className="btn btn-outline-secondary btn-lg" onClick={() => scrollTo('pricing')}>
                View pricing
              </button>
            </div>

            <div className="mt-4">
              <div className="text-muted small mb-2">Previously built for</div>
              <div className="d-flex flex-wrap gap-2">
                <span className="badge text-bg-dark">BOD Manager</span>
                <span className="badge text-bg-secondary">Tenant metadata</span>
                <span className="badge text-bg-secondary">Usage dashboards</span>
                <span className="badge text-bg-secondary">Schema governance</span>
              </div>
            </div>
          </div>

          <div className="col-12 col-lg-5">
            <div className="card shadow-sm">
              <div className="card-body">
                <div className="fw-semibold mb-2">What you can do</div>
                <ul className="mb-0">
                  <li>Create tenants and rotate API keys</li>
                  <li>Validate and publish service metadata</li>
                  <li>Explore a dependency graph per tenant</li>
                  <li>Track request volumes and response times</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <section id="about" className="mt-5 pt-4">
          <div className="row g-3">
            <div className="col-12">
              <h2 className="h3 mb-2">About us</h2>
              <p className="text-muted mb-0">
                We help teams keep service metadata accurate and discoverable — with schema governance, tenant controls,
                and clear visualisation of dependencies and events.
              </p>
            </div>
          </div>
        </section>

        <section id="pricing" className="mt-5 pt-4">
          <div className="row g-3">
            <div className="col-12">
              <h2 className="h3 mb-2">Pricing</h2>
              <p className="text-muted mb-4">Simple plans that scale with your organisation.</p>
            </div>

            <div className="col-12 col-lg-4">
              <div className="card h-100 shadow-sm">
                <div className="card-body d-flex flex-column">
                  <div className="d-flex align-items-center justify-content-between">
                    <h3 className="h5 mb-0">Free</h3>
                    <span className="badge text-bg-secondary">Monthly</span>
                  </div>
                  <div className="display-6 mt-2">£0</div>
                  <div className="text-muted">Best for evaluation</div>

                  <ul className="mt-3 mb-4">
                    <li>Limited API calls per month</li>
                    <li>Basic usage stats</li>
                    <li>Community support</li>
                  </ul>

                  <button className="btn btn-outline-primary mt-auto" onClick={() => auth.login()} disabled={!auth.ready}>
                    Get started
                  </button>
                </div>
              </div>
            </div>

            <div className="col-12 col-lg-4">
              <div className="card h-100 shadow-sm border-primary">
                <div className="card-body d-flex flex-column">
                  <div className="d-flex align-items-center justify-content-between">
                    <h3 className="h5 mb-0">Company</h3>
                    <span className="badge text-bg-primary">Monthly</span>
                  </div>
                  <div className="display-6 mt-2">£—</div>
                  <div className="text-muted">For teams using this daily</div>

                  <ul className="mt-3 mb-4">
                    <li>Higher API call limits</li>
                    <li>Tenant management</li>
                    <li>Usage dashboards</li>
                  </ul>

                  <a className="btn btn-primary mt-auto" href="mailto:sales@example.com?subject=Service%20Catalogue%20Company%20Plan">
                    Contact sales
                  </a>
                </div>
              </div>
            </div>

            <div className="col-12 col-lg-4">
              <div className="card h-100 shadow-sm">
                <div className="card-body d-flex flex-column">
                  <div className="d-flex align-items-center justify-content-between">
                    <h3 className="h5 mb-0">Enterprise</h3>
                    <span className="badge text-bg-dark">Custom</span>
                  </div>
                  <div className="display-6 mt-2">£££</div>
                  <div className="text-muted">For regulated and large orgs</div>

                  <ul className="mt-3 mb-4">
                    <li>Custom limits & SLAs</li>
                    <li>SSO / RBAC (optional)</li>
                    <li>Seeded tenant: TalentConsultingSandBox</li>
                    <li>Dedicated support</li>
                  </ul>

                  <a className="btn btn-outline-dark mt-auto" href="mailto:sales@example.com?subject=Service%20Catalogue%20Enterprise%20Plan">
                    Talk to us
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
