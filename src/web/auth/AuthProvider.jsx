import React from 'react';
import { getOidcConfig, isExpired, parseJwt, randomString, sha256Base64Url } from './oidc.js';

const STORAGE_KEY = 'SC_OIDC_TOKENS';
const PKCE_KEY = 'SC_OIDC_PKCE';
const LOGIN_FLAG_KEY = 'SC_OIDC_LOGIN_IN_PROGRESS';

function readTokens() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeTokens(tokens) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
}

function clearTokens() {
  localStorage.removeItem(STORAGE_KEY);
}

function readPkce() {
  try {
    const raw = sessionStorage.getItem(PKCE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writePkce(pkce) {
  sessionStorage.setItem(PKCE_KEY, JSON.stringify(pkce));
}

function clearPkce() {
  sessionStorage.removeItem(PKCE_KEY);
}

export function resetAuthStorage() {
  try {
    clearTokens();
    clearPkce();
    sessionStorage.removeItem(LOGIN_FLAG_KEY);
  } catch {
    // ignore
  }
}

const API_BASE = (import.meta.env?.VITE_SERVICE_METADATA_URL || '').replace(/\/+$/, '') || 'http://localhost:3000';

async function fetchUserTenants(token) {
  try {
    const res = await fetch(`${API_BASE}/admin/ui/me/tenants`, {
      headers: { authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      console.warn('[auth] /admin/ui/me/tenants returned', res.status);
      return [];
    }
    return await res.json();
  } catch (e) {
    console.warn('[auth] fetchUserTenants failed:', e);
    return [];
  }
}

const AuthContext = React.createContext({
  ready: false,
  authenticated: false,
  token: null,
  tokenParsed: null,
  tenants: null,
  login: async () => {},
  logout: async () => {},
  refresh: async () => false,
});

export function useAuth() {
  return React.useContext(AuthContext);
}

export function hasGlobalAdmin(tokenParsed) {
  const roles = tokenParsed?.realm_access?.roles || [];
  return roles.includes('admin') || roles.includes('global-admin');
}

export function hasTenantAdmin(tokenParsed, tenantId) {
  const roles = tokenParsed?.realm_access?.roles || [];
  if (roles.includes('tenant-admin')) return true;
  const groups = tokenParsed?.groups || [];
  return groups.includes(`tenant:${tenantId}:admin`) || groups.includes(`/tenant:${tenantId}:admin`);
}

// True if the user has any membership in the given tenant (member, admin, or global admin).
export function hasTenantAccess(tokenParsed, tenantId) {
  if (hasGlobalAdmin(tokenParsed)) return true;
  const roles = tokenParsed?.realm_access?.roles || [];
  if (roles.includes('tenant-admin')) return true;
  const groups = tokenParsed?.groups || [];
  return groups.some(
    (g) => g.startsWith(`tenant:${tenantId}:`) || g.startsWith(`/tenant:${tenantId}:`)
  );
}

export function AuthProvider({ children }) {
  const [state, setState] = React.useState({
    ready: false,
    authenticated: false,
    token: null,
    tokenParsed: null,
    configured: false,
    tenants: null, // null = not yet fetched; [] = fetched (possibly empty)
  });

  const config = React.useMemo(() => getOidcConfig(), []);

  const setFromTokens = React.useCallback((tokens) => {
    const token = tokens?.access_token || null;
    const tokenParsed = token ? parseJwt(token) : null;
    const authenticated = !!token && !!tokenParsed && !isExpired(tokenParsed);
    setState((s) => ({
      ...s,
      ready: true,
      configured: !!config,
      authenticated,
      token,
      tokenParsed,
      tenants: authenticated ? s.tenants : [], // clear on sign-out
    }));
    if (authenticated && token) {
      fetchUserTenants(token).then((tenants) => {
        setState((s) => (s.token === token ? { ...s, tenants } : s));
      });
    }
  }, [config]);

  const refresh = React.useCallback(async () => {
    if (!config) return false;
    const tokens = readTokens();
    if (!tokens?.refresh_token) return false;

    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: config.clientId,
      refresh_token: tokens.refresh_token,
    });

    const res = await fetch(config.tokenEndpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!res.ok) return false;
    const next = await res.json();
    writeTokens(next);
    setFromTokens(next);
    return true;
  }, [config, setFromTokens]);

  React.useEffect(() => {
    if (!config) {
      setState((s) => ({ ...s, ready: true, configured: false }));
      return;
    }

    const tokens = readTokens();
    if (!tokens?.access_token) {
      setState((s) => ({ ...s, ready: true, configured: true }));
      return;
    }

    const parsed = parseJwt(tokens.access_token);
    if (parsed && !isExpired(parsed)) {
      setFromTokens(tokens);
      return;
    }

    refresh().finally(() => {
      setState((s) => ({ ...s, ready: true, configured: true }));
    });
  }, [config, refresh, setFromTokens]);

  const login = React.useCallback(async () => {
    if (!config) return;

    // Prevent multiple redirects in React StrictMode/dev double-invoke.
    try {
      const raw = sessionStorage.getItem(LOGIN_FLAG_KEY);
      const last = raw ? parseInt(raw, 10) : 0;
      // If we attempted login very recently, don't spam redirects.
      if (last && Date.now() - last < 3000) return;
      sessionStorage.setItem(LOGIN_FLAG_KEY, String(Date.now()));
    } catch {
      // ignore
    }

    const redirectUri = `${window.location.origin}/auth/callback`;
    const state = randomString(24);
    const verifier = randomString(64);
    const challenge = await sha256Base64Url(verifier);

    writePkce({ state, verifier, redirectUri });

    const url = new URL(config.authorizationEndpoint);
    url.searchParams.set('client_id', config.clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'openid profile email');
    url.searchParams.set('state', state);
    url.searchParams.set('code_challenge', challenge);
    url.searchParams.set('code_challenge_method', 'S256');

    window.location.assign(url.toString());
  }, [config]);

  const logout = React.useCallback(async () => {
    const existing = readTokens();
    const idTokenHint = existing?.id_token || null;
    clearTokens();
    clearPkce();
    try {
      sessionStorage.removeItem(LOGIN_FLAG_KEY);
    } catch {
      // ignore
    }
    setState((s) => ({ ...s, authenticated: false, token: null, tokenParsed: null }));
    if (!config) return;
    const url = new URL(config.logoutEndpoint);
    url.searchParams.set('client_id', config.clientId);
    if (idTokenHint) url.searchParams.set('id_token_hint', idTokenHint);
    url.searchParams.set('post_logout_redirect_uri', window.location.origin + '/');
    window.location.assign(url.toString());
  }, [config]);

  const value = React.useMemo(
    () => ({
      ready: state.ready,
      configured: state.configured,
      authenticated: state.authenticated,
      token: state.token,
      tokenParsed: state.tokenParsed,
      tenants: state.tenants,
      login,
      logout,
      refresh,
    }),
    [state, login, logout, refresh]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Module-level promise ensures React StrictMode's double-invoke doesn't run
// two parallel token exchanges. The second call waits on the first.
let _callbackPromise = null;

export async function handleAuthCallback() {
  if (_callbackPromise) return _callbackPromise;
  _callbackPromise = _doHandleAuthCallback().finally(() => {
    _callbackPromise = null;
  });
  return _callbackPromise;
}

async function _doHandleAuthCallback() {
  const config = getOidcConfig();
  if (!config) throw new Error('OIDC not configured');

  const existing = readTokens();
  if (existing?.access_token) return existing;

  const pkce = readPkce();
  clearPkce();
  if (!pkce?.state || !pkce?.verifier || !pkce?.redirectUri) throw new Error('Missing PKCE state');

  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const state = params.get('state');
  if (!code || !state || state !== pkce.state) throw new Error('Invalid auth callback');

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: config.clientId,
    code,
    redirect_uri: pkce.redirectUri,
    code_verifier: pkce.verifier,
  });

  const res = await fetch(config.tokenEndpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    // Code already used (StrictMode double-invoke or back-button replay).
    // If the first exchange already wrote tokens, use those instead of failing.
    if (res.status === 400 && detail.includes('invalid_grant')) {
      const already = readTokens();
      if (already?.access_token) return already;
    }
    throw new Error(`Token exchange failed (${res.status}): ${detail}`);
  }

  const tokens = await res.json();
  writeTokens(tokens);
  try {
    sessionStorage.removeItem(LOGIN_FLAG_KEY);
  } catch {
    // ignore
  }
  return tokens;
}
