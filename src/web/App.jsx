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
import { useAuth } from './auth/AuthProvider.jsx';
import AuthCallback from './AuthCallback.jsx';
import TenantUsers from './TenantUsers.jsx';
import UsersAdmin from './UsersAdmin.jsx';
import Invites from './Invites.jsx';
import RegisterTenant from './RegisterTenant.jsx';
import TenantRulesets from './TenantRulesets.jsx';

export default function App() {
  const auth = useAuth();
  const path = typeof window !== 'undefined' ? window.location.pathname : '/';
  if (path === '/') return <Landing />;
  if (path === '/plans') return <Plans />;
  if (path === '/register') return <RegisterTenant />;
  if (path === '/login') return <Login />;
  if (path === '/auth/callback') return <AuthCallback />;
  if (path === '/invites') {
    if (!auth.ready) return null;
    if (!auth.authenticated) return <Login />;
    return <Invites />;
  }
  if (path === '/tenants') {
    if (!auth.ready) return null;
    if (!auth.authenticated) return <Login />;
    return <TenantList />;
  }
  if (path === '/admin') return <Admin />;
  if (path === '/admin/users') {
    if (!auth.ready) return null;
    if (!auth.authenticated) return <Login />;
    return <UsersAdmin />;
  }
  if (path === '/graph') return <ServiceGraph />;
  if (path.startsWith('/tenant/')) {
    const parts = path.split('/').filter(Boolean); // ['tenant', ':id', 'schemas|graph?']
    const tenantId = decodeURIComponent(parts[1] || '');
    const section = parts[2] || 'schemas';
    if (!tenantId) return <Landing />;
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
    if (tenantId) return <TenantSchemas tenantId={tenantId} />;
  }
  return <Landing />;
}
