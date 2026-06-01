export function getOidcConfig() {
  const baseUrl = import.meta.env.VITE_KEYCLOAK_URL;
  const realm = import.meta.env.VITE_KEYCLOAK_REALM;
  const clientId = import.meta.env.VITE_KEYCLOAK_CLIENT_ID;
  if (!baseUrl || !realm || !clientId) return null;

  const issuer = `${baseUrl.replace(/\/+$/, '')}/realms/${realm}`;
  return {
    issuer,
    clientId,
    authorizationEndpoint: `${issuer}/protocol/openid-connect/auth`,
    tokenEndpoint: `${issuer}/protocol/openid-connect/token`,
    logoutEndpoint: `${issuer}/protocol/openid-connect/logout`,
  };
}

function base64UrlEncode(bytes) {
  const bin = String.fromCharCode(...bytes);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export async function sha256Base64Url(str) {
  const data = new TextEncoder().encode(str);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(new Uint8Array(hash));
}

export function randomString(len = 64) {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

export function parseJwt(token) {
  try {
    const [, payload] = token.split('.');
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function isExpired(tokenParsed, skewSec = 30) {
  const exp = tokenParsed?.exp;
  if (!exp) return true;
  const now = Math.floor(Date.now() / 1000);
  return exp <= now + skewSec;
}

