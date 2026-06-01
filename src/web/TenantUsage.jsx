import React from 'react';
import TenantLayout from './TenantLayout.jsx';

const API_BASE =
  (import.meta.env.VITE_SERVICE_METADATA_URL || '').replace(/\/+$/, '') || 'http://localhost:3000';

export default function TenantUsage({ tenantId }) {
  const [adminKey, setAdminKey] = React.useState(() => {
    try {
      return localStorage.getItem('SC_ADMIN_KEY') || '';
    } catch (e) {
      return '';
    }
  });
  const [tenantApiKey, setTenantApiKey] = React.useState(() => {
    try {
      return localStorage.getItem('SC_TENANT_API_KEY') || '';
    } catch (e) {
      return '';
    }
  });
  const [error, setError] = React.useState(null);
  const [usage, setUsage] = React.useState(null);
  const [series, setSeries] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [filters, setFilters] = React.useState({
    endpointPrefix: '',
    bucket: 'hour',
    span: '3h',
  });

  React.useEffect(() => {
    try {
      localStorage.setItem('SC_ADMIN_KEY', adminKey || '');
    } catch (e) {
      // ignore
    }
  }, [adminKey]);

  React.useEffect(() => {
    try {
      localStorage.setItem('SC_TENANT_API_KEY', tenantApiKey || '');
    } catch (e) {
      // ignore
    }
  }, [tenantApiKey]);

  const load = async () => {
    setLoading(true);
    try {
      setError(null);
      const headers = {};
      // Prefer tenant API key for tenant-scoped usage endpoints.
      if (tenantApiKey) headers['authorization'] = `Bearer ${tenantApiKey}`;
      else if (adminKey) headers['authorization'] = `Bearer ${adminKey}`;
      const to = new Date();
      const spanToMs = (span) => {
        switch (span) {
          case '15m':
            return 15 * 60 * 1000;
          case '1h':
            return 60 * 60 * 1000;
          case '3h':
            return 3 * 60 * 60 * 1000;
          case '6h':
            return 6 * 60 * 60 * 1000;
          case '12h':
            return 12 * 60 * 60 * 1000;
          case '1d':
            return 24 * 60 * 60 * 1000;
          case '7d':
            return 7 * 24 * 60 * 60 * 1000;
          case '14d':
            return 14 * 24 * 60 * 60 * 1000;
          case '30d':
            return 30 * 24 * 60 * 60 * 1000;
          default:
            return 3 * 60 * 60 * 1000;
        }
      };
      const from = new Date(to.getTime() - spanToMs(filters.span));
      const qp = new URLSearchParams({
        from: from.toISOString(),
        to: to.toISOString(),
        bucket: filters.bucket,
      });
      if (filters.endpointPrefix) qp.set('endpointPrefix', filters.endpointPrefix);

      const [resUsage, resSeries] = await Promise.all([
        fetch(`${API_BASE}/admin/usage?${qp.toString()}`, { headers }),
        fetch(`${API_BASE}/admin/usage/timeseries?${qp.toString()}`, { headers }),
      ]);

      if (!resUsage.ok) {
        const txt = await resUsage.text();
        throw new Error(txt || `HTTP ${resUsage.status}`);
      }
      if (!resSeries.ok) {
        const txt = await resSeries.text();
        throw new Error(txt || `HTTP ${resSeries.status}`);
      }

      const data = await resUsage.json();
      const ts = await resSeries.json();
      setUsage(data);
      setSeries(ts.series || []);
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

  React.useEffect(() => {
    if (!tenantId) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.span, filters.bucket]);

  const renderKV = (obj) => {
    const entries = Object.entries(obj || {});
    if (entries.length === 0) return <div className="text-muted">None</div>;
    return (
      <ul className="list-group">
        {entries.map(([k, v]) => (
          <li className="list-group-item d-flex justify-content-between" key={k}>
            <span className="font-monospace">{k}</span>
            <span className="badge text-bg-secondary">{v}</span>
          </li>
        ))}
      </ul>
    );
  };

  const LineChart = ({ points }) => {
    const width = 900;
    const height = 220;
    const pad = 30;
    const yLabelWidth = 26;
    const data = (points || [])
      .filter((p) => typeof p.count === 'number' && p.t)
      .map((p) => ({ ...p, ts: Date.parse(p.t) }))
      .filter((p) => Number.isFinite(p.ts))
      .sort((a, b) => a.ts - b.ts);
    if (data.length === 0) return <div className="text-muted">No data</div>;

    const maxY = Math.max(...data.map((p) => p.count), 1);
    const minTs = Math.min(...data.map((p) => p.ts));
    const maxTs = Math.max(...data.map((p) => p.ts));

    const xLeft = pad + yLabelWidth;
    const xRight = width - pad;
    const x = (ts) => xLeft + ((xRight - xLeft) * (ts - minTs)) / (maxTs - minTs || 1);
    const y = (v) => height - pad - ((height - pad * 2) * v) / maxY;

    const d = data
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(p.ts).toFixed(2)} ${y(p.count).toFixed(2)}`)
      .join(' ');

    const formatTick = (ts) => {
      const dt = new Date(ts);
      const spanMs = maxTs - minTs;
      const hhmm = dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      if (spanMs > 24 * 60 * 60 * 1000) {
        const md = dt.toLocaleDateString([], { month: '2-digit', day: '2-digit' });
        return `${md} ${hhmm}`;
      }
      return hhmm;
    };

    const tickTs = [minTs, Math.round((minTs + maxTs) / 2), maxTs];
    const tickY = [0, Math.round(maxY / 2), maxY];

    return (
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="220" role="img">
        <rect x="0" y="0" width={width} height={height} fill="white" />
        <line x1={xLeft} y1={height - pad} x2={xRight} y2={height - pad} stroke="#e5e7eb" />
        <line x1={xLeft} y1={pad} x2={xLeft} y2={height - pad} stroke="#e5e7eb" />
        <path d={d} fill="none" stroke="#0d6efd" strokeWidth="2" />
        <text x={pad} y={pad - 10} fontSize="12" fill="#6b7280">
          Requests
        </text>
        {tickY.map((v, idx) => (
          <g key={idx}>
            <line x1={xLeft - 4} y1={y(v)} x2={xLeft} y2={y(v)} stroke="#d1d5db" />
            <text x={xLeft - 6} y={y(v) + 3} fontSize="10" fill="#9ca3af" textAnchor="end">
              {v}
            </text>
          </g>
        ))}
        {tickTs.map((ts, idx) => (
          <g key={idx}>
            <line x1={x(ts)} y1={height - pad} x2={x(ts)} y2={height - pad + 4} stroke="#d1d5db" />
            <text x={x(ts)} y={height - 8} fontSize="10" fill="#9ca3af" textAnchor="middle">
              {formatTick(ts)}
            </text>
          </g>
        ))}
        <text x={width - pad} y={height - 10} fontSize="10" fill="#9ca3af" textAnchor="end">
          {data.length} points
        </text>
      </svg>
    );
  };

  return (
    <TenantLayout tenantId={tenantId} active="usage">
      <div className="d-flex align-items-center justify-content-between gap-3 mb-3">
        <h1 className="h4 mb-0">Usage</h1>
        <button className="btn btn-outline-secondary btn-sm" onClick={load} disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      <div className="card mb-3">
        <div className="card-body">
          <div className="row g-2">
            <div className="col-12 col-md-6">
              <label className="form-label">Tenant API key</label>
              <input
                className="form-control font-monospace"
                value={tenantApiKey}
                onChange={(e) => setTenantApiKey(e.target.value)}
                placeholder="Bearer token for this tenant"
              />
            </div>
            <div className="col-12 col-md-6">
              <label className="form-label">Admin key (optional)</label>
              <input
                className="form-control font-monospace"
                value={adminKey}
                onChange={(e) => setAdminKey(e.target.value)}
                placeholder="Bearer admin token"
              />
            </div>
          </div>
          <div className="row g-2 mt-2">
            <div className="col-12 col-md-6">
              <label className="form-label">Path prefix filter</label>
              <input
                className="form-control font-monospace"
                value={filters.endpointPrefix}
                onChange={(e) => setFilters((f) => ({ ...f, endpointPrefix: e.target.value }))}
                placeholder="/services or /metadata/validate"
              />
            </div>
            <div className="col-6 col-md-3">
              <label className="form-label">Timespan</label>
              <select
                className="form-select"
                value={filters.span}
                onChange={(e) => setFilters((f) => ({ ...f, span: e.target.value }))}
              >
                <option value="15m">Last 15m</option>
                <option value="1h">Last 1h</option>
                <option value="3h">Last 3h</option>
                <option value="6h">Last 6h</option>
                <option value="12h">Last 12h</option>
                <option value="1d">Last 1d</option>
                <option value="7d">Last 7d</option>
                <option value="14d">Last 14d</option>
                <option value="30d">Last 30d</option>
              </select>
            </div>
            <div className="col-6 col-md-3">
              <label className="form-label">Bucket</label>
              <select
                className="form-select"
                value={filters.bucket}
                onChange={(e) => setFilters((f) => ({ ...f, bucket: e.target.value }))}
              >
                <option value="minute1">1 min</option>
                <option value="minute5">5 min</option>
                <option value="minute15">15 min</option>
                <option value="minute30">30 min</option>
                <option value="hour">hour</option>
                <option value="day">day</option>
              </select>
            </div>
          </div>
          <div className="text-muted small mt-2">
            Reads from <span className="font-monospace">/admin/usage</span> and{' '}
            <span className="font-monospace">/admin/usage/timeseries</span>.
          </div>
        </div>
      </div>

      {error ? (
        <div className="alert alert-danger" role="alert">
          {String(error.message || error)}
        </div>
      ) : !usage ? (
        <div className="text-muted">Loading…</div>
      ) : (
        <div className="row g-3">
          <div className="col-12 col-md-4">
            <div className="card h-100">
              <div className="card-body">
                <div className="text-muted small">Total events</div>
                <div className="display-6">{usage.total}</div>
                <div className="text-muted small mt-2">Latency (ms)</div>
                <div className="small">
                  p50: <span className="font-monospace">{usage.duration?.p50Ms ?? '-'}</span> · p95:{' '}
                  <span className="font-monospace">{usage.duration?.p95Ms ?? '-'}</span> · avg:{' '}
                  <span className="font-monospace">{usage.duration?.avgMs ?? '-'}</span>
                </div>
              </div>
            </div>
          </div>
          <div className="col-12">
            <div className="card">
              <div className="card-body">
                <div className="fw-semibold mb-2">Requests over time</div>
                <LineChart points={series || []} />
              </div>
            </div>
          </div>
          <div className="col-12 col-lg-4">
            <div className="card h-100">
              <div className="card-body">
                <div className="fw-semibold mb-2">By method</div>
                {renderKV(usage.byMethod)}
              </div>
            </div>
          </div>
          <div className="col-12 col-lg-4">
            <div className="card h-100">
              <div className="card-body">
                <div className="fw-semibold mb-2">By endpoint</div>
                {renderKV(usage.byEndpoint)}
              </div>
            </div>
          </div>
        </div>
      )}
    </TenantLayout>
  );
}
