import React from 'react';
import { getOidcConfig, isExpired, parseJwt, randomString, sha256Base64Url } from './oidc.js';

const STORAGE_KEY = 'SC_OIDC_TOKENS';
const PKCE_KEY = 'SC_OIDC_PKCE';

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

const AuthContext = React.createContext({
  ready: false,
  authenticated: false,
  token: null,
  tokenParsed: null,
  login: async () => {},
  logout: async () => {},
  refresh: async () => false,
});

export function useAuth() {
  return React.useContext(AuthContext);
}

export function hasGlobalAdmin(tokenParsed) {
  return (tokenParsed?.realm_access?.roles || []).includes('global-admin');
}

export function hasTenantAdmin(tokenParsed, tenantId) {
  const groups = tokenParsed?.groups || [];
  return groups.includes(`tenant:${tenantId}:admin`) || groups.includes(`/tenant:${tenantId}:admin`);
}

export function AuthProvider({ children }) {
  const [state, setState] = React.useState({
    ready: false,
    authenticated: false,
    token: null,
    tokenParsed: null,
    configured: false,
  });

  const config = React.useMemo(() => getOidcConfig(), []);

  const setFromTokens = React.useCallback((tokens) => {
    const token = tokens?.access_token || null;
    const tokenParsed = token ? parseJwt(token) : null;
    setState({
      ready: true,
      configured: !!config,
      authenticated: !!token && !!tokenParsed && !isExpired(tokenParsed),
      token,
      tokenParsed,
    });
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
    clearTokens();
    setState((s) => ({ ...s, authenticated: false, token: null, tokenParsed: null }));
    if (!config) return;
    const url = new URL(config.logoutEndpoint);
    url.searchParams.set('client_id', config.clientId);
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
      login,
      logout,
      refresh,
    }),
    [state, login, logout, refresh]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export async function handleAuthCallback() {
  const config = getOidcConfig();
  if (!config) throw new Error('OIDC not configured');

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
  if (!res.ok) throw new Error('Token exchange failed');

  const tokens = await res.json();
  writeTokens(tokens);
  return tokens;
}

