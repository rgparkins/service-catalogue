import { createRemoteJWKSet, jwtVerify } from 'jose';

// Keycloak tokens often use an external issuer (e.g. http://localhost:8080/realms/...)
// while the API container reaches Keycloak at an internal hostname (e.g. http://keycloak:8080).
// To support this, allow distinct issuer strings (token validation) vs JWKS fetch URL.
const issuer = process.env.KEYCLOAK_ISSUER; // trusted token issuer (or one of them)
const tokenIssuer = process.env.KEYCLOAK_TOKEN_ISSUER; // optional additional trusted issuer
const jwksIssuer = process.env.KEYCLOAK_JWKS_ISSUER || process.env.KEYCLOAK_ISSUER; // used only for certs URL
const audience = process.env.KEYCLOAK_AUDIENCE;
const expectedClientId = process.env.KEYCLOAK_WEB_CLIENT_ID || process.env.KEYCLOAK_CLIENT_ID;

let jwks = null;
const getJwks = () => {
  if (!jwks) {
    if (!jwksIssuer) throw new Error('KEYCLOAK_JWKS_ISSUER/KEYCLOAK_ISSUER is not set');
    jwks = createRemoteJWKSet(new URL(`${jwksIssuer}/protocol/openid-connect/certs`));
  }
  return jwks;
};

export const requireUser = async (req, res, next) => {
  try {
    if (!issuer && !tokenIssuer) {
      // Keycloak not configured; treat as unauthenticated.
      return res.status(401).json({ error: 'User authentication not configured' });
    }

    const auth = req.headers['authorization'];
    if (!auth?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing bearer token' });
    }

    const token = auth.slice(7);
    // Keycloak access tokens often have `aud` like "account" (and/or an array),
    // while the client id is present in `azp`.
    // We verify signature + issuer (supporting multiple issuers), then optionally
    // enforce audience OR client id.
    const issuers = [issuer, tokenIssuer].filter(Boolean);
    const verifyOpts = { issuer: issuers.length === 1 ? issuers[0] : issuers };
    if (audience) verifyOpts.audience = audience;

    const { payload } = await jwtVerify(token, getJwks(), verifyOpts);

    if (!audience && expectedClientId && payload?.azp && payload.azp !== expectedClientId) {
      return res.status(401).json({ error: 'Invalid token client' });
    }

    req.user = payload;
    return next();
  } catch (e) {
    // Include a minimal reason to make local debugging easier.
    // (Do not include the full token or stack trace.)
    const code = e?.code || null;
    const msg = e?.message ? String(e.message) : null;
    return res.status(401).json({
      error: 'Invalid token',
      ...(code ? { code } : {}),
      ...(msg ? { reason: msg } : {}),
    });
  }
};

export function userHasRole(user, role) {
  const roles = user?.realm_access?.roles || [];
  return roles.includes(role);
}

export function userHasTenantAdmin(user, tenantId) {
  const roles = user?.realm_access?.roles || [];
  if (roles.includes('tenant-admin')) return true;
  const groups = user?.groups || [];
  return groups.includes(`tenant:${tenantId}:admin`) || groups.includes(`/tenant:${tenantId}:admin`);
}
