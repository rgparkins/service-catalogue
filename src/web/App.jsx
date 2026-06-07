import React from 'react';
import ServiceGraph from './graph/serviceGraph.jsx';
import Admin from './Admin.jsx';
import Landing from './Landing.jsx';
import TenantSchemas from './TenantSchemas.jsx';
import TenantGraph from './TenantGraph.jsx';
import TenantSettings from './TenantSettings.jsx';
import TenantUsage from './TenantUsage.jsx';
import Plans from './Plans.jsx';
import Login from './Login.jsx';
import TenantList from './TenantList.jsx';
import { useAuth, hasGlobalAdmin } from './auth/AuthProvider.jsx';
import AuthCallback from './AuthCallback.jsx';
import TenantUsers from './TenantUsers.jsx';
import UsersAdmin from './UsersAdmin.jsx';
import Invites from './Invites.jsx';
import RegisterTenant from './RegisterTenant.jsx';
import TenantRulesets from './TenantRulesets.jsx';
import RegisterComplete from './RegisterComplete.jsx';
import InviteComplete from './InviteComplete.jsx';
import TokenDebug from './TokenDebug.jsx';

function AccessDenied({ tenantId }) {
  const auth = useAuth();
  const [open, setOpen] = React.useState(false);
  const debug = {
    tenants: auth.tenants,
    email: auth.tokenParsed?.email,
    groups: auth.tokenParsed?.groups,
    roles: auth.tokenParsed?.realm_access?.roles,
    requestedTenant: tenantId,
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: 16, color: '#ccc' }}>
      <div style={{ fontSize: 48 }}>🔒</div>
      <div style={{ fontSize: 20, fontWeight: 600, color: '#fff' }}>Access denied</div>
      <div style={{ fontSize: 14, color: '#aaa' }}>You don't have permission to view this page.</div>
      <a href="/tenants" style={{ marginTop: 8, color: '#60a5fa', fontSize: 14 }}>Go to your tenants</a>
      <button onClick={() => setOpen((v) => !v)} style={{ marginTop: 8, background: 'none', border: '1px solid #555', color: '#888', borderRadius: 4, padding: '4px 10px', cursor: 'pointer', fontSize: 12 }}>
        {open ? 'Hide' : 'Show'} debug info
      </button>
      {open && (
        <pre style={{ fontSize: 11, color: '#aaa', background: '#1a1a1a', padding: 12, borderRadius: 6, maxWidth: 480, overflow: 'auto', textAlign: 'left' }}>
          {JSON.stringify(debug, null, 2)}
        </pre>
      )}
    </div>
  );
}

export default function App() {
  const auth = useAuth();
  const path = typeof window !== 'undefined' ? window.location.pathname : '/';
  if (path === '/') return <Landing />;
  if (path === '/plans') return <Plans />;
  if (path === '/register') return <RegisterTenant />;
  if (path === '/register/complete') return <RegisterComplete />;
  if (path === '/invite/complete') return <InviteComplete />;
  if (path === '/login') return <Login />;
  if (path === '/auth/callback') return <AuthCallback />;
  if (path === '/token') {
    if (!auth.ready) return null;
    return <TokenDebug />;
  }
  if (path === '/invites') {
    if (!auth.ready) return null;
    if (!auth.authenticated) {
      const token = new URLSearchParams(window.location.search).get('token') || '';
      if (token) return <InviteComplete />;
      return <Login />;
    }
    return <Invites />;
  }
  if (path === '/tenants') {
    if (!auth.ready) return null;
    if (!auth.authenticated) return <Login />;
    return <TenantList />;
  }
  if (path === '/admin' || path === '/admin/users') {
    if (!auth.ready) return null;
    if (!auth.authenticated) return <Login />;
    if (!hasGlobalAdmin(auth.tokenParsed)) return <AccessDenied />;
    if (path === '/admin/users') return <UsersAdmin />;
    return <Admin />;
  }
  if (path === '/graph') return <ServiceGraph />;
  if (path.startsWith('/tenant/')) {
    const parts = path.split('/').filter(Boolean); // ['tenant', ':id', 'schemas|graph?']
    const tenantId = decodeURIComponent(parts[1] || '');
    const section = parts[2] || 'schemas';
    if (!tenantId) return <Landing />;
    if (!auth.ready) return null;
    if (!auth.authenticated) return <Login />;
    // Wait for tenant list to load before making access decision
    if (auth.tenants === null) return null;
    const canAccess = hasGlobalAdmin(auth.tokenParsed) ||
      auth.tenants.some((t) => t.tenantId === tenantId);
    if (!canAccess) return <AccessDenied tenantId={tenantId} />;
    if (section === 'graph') return <TenantGraph tenantId={tenantId} />;
    if (section === 'rulesets') return <TenantRulesets tenantId={tenantId} />;
    if (section === 'settings') return <TenantSettings tenantId={tenantId} />;
    if (section === 'usage') return <TenantUsage tenantId={tenantId} />;
    if (section === 'users') return <TenantUsers tenantId={tenantId} />;
    return <TenantSchemas tenantId={tenantId} />;
  }
  // Convenience: treat "/<tenantId>" as "/tenant/<tenantId>/schemas"
  if (path.split('/').filter(Boolean).length === 1) {
    const tenantId = decodeURIComponent(path.replace(/^\/+/, ''));
    if (tenantId) {
      if (!auth.ready) return null;
      if (!auth.authenticated) return <Login />;
      if (auth.tenants === null) return null;
      const canAccess = hasGlobalAdmin(auth.tokenParsed) ||
        auth.tenants.some((t) => t.tenantId === tenantId);
      if (!canAccess) return <AccessDenied tenantId={tenantId} />;
      return <TenantSchemas tenantId={tenantId} />;
    }
  }
  return <Landing />;
}
