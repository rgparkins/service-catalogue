import React from 'react';
import TenantLayout from './TenantLayout.jsx';
import ServiceGraph from './graph/serviceGraph.jsx';

const API_BASE =
  (import.meta.env.VITE_SERVICE_METADATA_URL || '').replace(/\/+$/, '') || 'http://localhost:3000';

export default function TenantGraph({ tenantId }) {
  return (
    <TenantLayout tenantId={tenantId} active="graph">
      <ServiceGraph metadataUrl={`${API_BASE}/services/metadata`} tenantId={tenantId} />
    </TenantLayout>
  );
}

