import React from 'react';
import ServiceGraph from './graph/serviceGraph.jsx';
import Admin from './Admin.jsx';
import Landing from './Landing.jsx';
import TenantSchemas from './TenantSchemas.jsx';
import TenantGraph from './TenantGraph.jsx';
import TenantSettings from './TenantSettings.jsx';
import TenantUsage from './TenantUsage.jsx';
import Plans from './Plans.jsx';

export default function App() {
  const path = typeof window !== 'undefined' ? window.location.pathname : '/';
  if (path === '/') return <Landing />;
  if (path === '/plans') return <Plans />;
  if (path === '/admin') return <Admin />;
  if (path === '/graph') return <ServiceGraph />;
  if (path.startsWith('/tenant/')) {
    const parts = path.split('/').filter(Boolean); // ['tenant', ':id', 'schemas|graph?']
    const tenantId = decodeURIComponent(parts[1] || '');
    const section = parts[2] || 'schemas';
    if (!tenantId) return <Landing />;
    if (section === 'graph') return <TenantGraph tenantId={tenantId} />;
    if (section === 'settings') return <TenantSettings tenantId={tenantId} />;
    if (section === 'usage') return <TenantUsage tenantId={tenantId} />;
    return <TenantSchemas tenantId={tenantId} />;
  }
  // Convenience: treat "/<tenantId>" as "/tenant/<tenantId>/schemas"
  if (path.split('/').filter(Boolean).length === 1) {
    const tenantId = decodeURIComponent(path.replace(/^\/+/, ''));
    if (tenantId) return <TenantSchemas tenantId={tenantId} />;
  }
  return <Landing />;
}
