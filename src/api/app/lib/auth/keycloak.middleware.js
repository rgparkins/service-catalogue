import { createRemoteJWKSet, jwtVerify } from 'jose';

const issuer = process.env.KEYCLOAK_ISSUER;
const audience = process.env.KEYCLOAK_AUDIENCE;

let jwks = null;
const getJwks = () => {
  if (!jwks) {
    if (!issuer) throw new Error('KEYCLOAK_ISSUER is not set');
    jwks = createRemoteJWKSet(new URL(`${issuer}/protocol/openid-connect/certs`));
  }
  return jwks;
};

export const requireUser = async (req, res, next) => {
  try {
    if (!issuer) {
      // Keycloak not configured; treat as unauthenticated.
      return res.status(401).json({ error: 'User authentication not configured' });
    }

    const auth = req.headers['authorization'];
    if (!auth?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing bearer token' });
    }

    const token = auth.slice(7);
    const { payload } = await jwtVerify(token, getJwks(), {
      issuer,
      audience: audience || undefined,
    });

    req.user = payload;
    return next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

export function userHasRole(user, role) {
  const roles = user?.realm_access?.roles || [];
  return roles.includes(role);
}

export function userHasTenantAdmin(user, tenantId) {
  const groups = user?.groups || [];
  return groups.includes(`tenant:${tenantId}:admin`) || groups.includes(`/tenant:${tenantId}:admin`);
}

