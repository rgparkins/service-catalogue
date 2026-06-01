import React from 'react';

export default function Plans() {
  return (
    <div className="bg-light min-vh-100">
      <nav className="navbar navbar-expand-lg bg-white border-bottom">
        <div className="container">
          <a className="navbar-brand" href="/">
            Service Catalogue
          </a>
          <div className="navbar-nav ms-auto">
            <a className="nav-link" href="/">
              Home
            </a>
            <a className="nav-link" href="/graph">
              Graph
            </a>
          </div>
        </div>
      </nav>

      <main className="container py-4">
        <div className="p-4 p-md-5 mb-4 bg-white rounded-3 border">
          <div className="container-fluid py-2">
            <h1 className="display-6 mb-2">Plans</h1>
            <p className="text-muted mb-0">Choose the right plan for your company</p>
          </div>
        </div>

        <div className="row g-3">
          <div className="col-12 col-lg-4">
            <div className="card h-100 shadow-sm">
              <div className="card-body d-flex flex-column">
                <div className="d-flex align-items-center justify-content-between">
                  <h2 className="h5 mb-0">Free</h2>
                  <span className="badge text-bg-secondary">Monthly</span>
                </div>
                <div className="display-6 mt-2">£0</div>
                <div className="text-muted">Best for evaluation</div>

                <ul className="mt-3 mb-4">
                  <li>Limited API calls per month</li>
                  <li>Basic tenant usage stats</li>
                  <li>Community support</li>
                </ul>

                <a className="btn btn-outline-primary mt-auto" href="/">
                  Get started
                </a>
              </div>
            </div>
          </div>

          <div className="col-12 col-lg-4">
            <div className="card h-100 shadow-sm border-primary">
              <div className="card-body d-flex flex-column">
                <div className="d-flex align-items-center justify-content-between">
                  <h2 className="h5 mb-0">Company</h2>
                  <span className="badge text-bg-primary">Monthly</span>
                </div>
                <div className="display-6 mt-2">£—</div>
                <div className="text-muted">For teams using this daily</div>

                <ul className="mt-3 mb-4">
                  <li>Higher API call limits</li>
                  <li>Tenant management & key rotation</li>
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
                  <h2 className="h5 mb-0">Enterprise</h2>
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
      </main>
    </div>
  );
}
