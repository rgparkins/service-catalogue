const DEFAULT_CLIENT_ID = 'admin-cli';

function baseUrlFromIssuer(issuer) {
  if (!issuer) return null;
  // issuer: http://host/realms/<realm>
  return String(issuer).replace(/\/realms\/[^/]+\/?$/, '');
}

function realmFromIssuer(issuer) {
  if (!issuer) return null;
  const m = String(issuer).match(/\/realms\/([^/]+)\/?$/);
  return m ? m[1] : null;
}

export class KeycloakAdminClient {
  constructor({
    baseUrl = process.env.KEYCLOAK_ADMIN_URL || baseUrlFromIssuer(process.env.KEYCLOAK_ISSUER),
    realm = process.env.KEYCLOAK_REALM || realmFromIssuer(process.env.KEYCLOAK_ISSUER) || 'service-catalogue',
    username = process.env.KEYCLOAK_ADMIN_USER || process.env.KEYCLOAK_ADMIN || 'admin',
    password = process.env.KEYCLOAK_ADMIN_PASSWORD || 'admin',
    clientId = process.env.KEYCLOAK_ADMIN_CLIENT_ID || DEFAULT_CLIENT_ID,
  } = {}) {
    if (!baseUrl) throw new Error('Keycloak admin base URL not configured (KEYCLOAK_ADMIN_URL or KEYCLOAK_ISSUER)');
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.realm = realm;
    this.username = username;
    this.password = password;
    this.clientId = clientId;
    this._token = null;
    this._tokenExpMs = 0;
  }

  async _getAccessToken() {
    const now = Date.now();
    if (this._token && now < this._tokenExpMs - 10_000) return this._token;

    const url = `${this.baseUrl}/realms/master/protocol/openid-connect/token`;
    const body = new URLSearchParams({
      grant_type: 'password',
      client_id: this.clientId,
      username: this.username,
      password: this.password,
    });

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!res.ok) throw new Error(`Keycloak token failed (HTTP ${res.status})`);
    const json = await res.json();
    const accessToken = json.access_token;
    const expiresIn = typeof json.expires_in === 'number' ? json.expires_in : 30;
    if (!accessToken) throw new Error('Keycloak token missing access_token');
    this._token = accessToken;
    this._tokenExpMs = now + expiresIn * 1000;
    return accessToken;
  }

  async _kcFetch(path, init = {}) {
    const token = await this._getAccessToken();
    const url = `${this.baseUrl}${path.startsWith('/') ? '' : '/'}${path}`;
    const headers = new Headers(init.headers || {});
    headers.set('authorization', `Bearer ${token}`);
    return fetch(url, { ...init, headers });
  }

  async createUser({ email, name = null, username = null, requiredActions = ['UPDATE_PASSWORD'] }) {
    const payload = {
      enabled: true,
      email,
      username: username || email,
      emailVerified: false,
      ...(name ? { firstName: name } : {}),
      ...(Array.isArray(requiredActions) ? { requiredActions } : {}),
    };

    const res = await this._kcFetch(`/admin/realms/${encodeURIComponent(this.realm)}/users`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (res.status === 409) {
      // User already exists. Find them.
      const found = await this.findUsers({ email });
      const u = found.find((x) => String(x.email || '').toLowerCase() === String(email).toLowerCase());
      if (!u?.id) throw new Error('User already exists but could not be resolved');
      return { id: u.id, existing: true };
    }

    if (!res.ok) {
      const txt = await res.text();
      throw new Error(txt || `Keycloak create user failed (HTTP ${res.status})`);
    }

    const loc = res.headers.get('location') || '';
    const id = loc.split('/').pop();
    if (!id) throw new Error('Keycloak create user missing id');
    return { id, existing: false };
  }

  async findUsers({ email }) {
    const qp = new URLSearchParams();
    if (email) qp.set('email', email);
    const res = await this._kcFetch(`/admin/realms/${encodeURIComponent(this.realm)}/users?${qp.toString()}`);
    if (!res.ok) throw new Error(`Keycloak users query failed (HTTP ${res.status})`);
    return res.json();
  }

  async findOrCreateGroup(name) {
    const qp = new URLSearchParams({ search: name });
    const res = await this._kcFetch(`/admin/realms/${encodeURIComponent(this.realm)}/groups?${qp.toString()}`);
    if (!res.ok) throw new Error(`Keycloak group search failed (HTTP ${res.status})`);
    const groups = await res.json();
    const existing = (groups || []).find((g) => g?.name === name);
    if (existing?.id) return { id: existing.id, existing: true };

    const create = await this._kcFetch(`/admin/realms/${encodeURIComponent(this.realm)}/groups`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (!create.ok) {
      const txt = await create.text();
      throw new Error(txt || `Keycloak group create failed (HTTP ${create.status})`);
    }
    const loc = create.headers.get('location') || '';
    const id = loc.split('/').pop();
    if (!id) throw new Error('Keycloak group create missing id');
    return { id, existing: false };
  }

  async addUserToGroup(userId, groupId) {
    const res = await this._kcFetch(
      `/admin/realms/${encodeURIComponent(this.realm)}/users/${encodeURIComponent(userId)}/groups/${encodeURIComponent(groupId)}`,
      { method: 'PUT' }
    );
    if (!res.ok) throw new Error(`Keycloak add-to-group failed (HTTP ${res.status})`);
  }

  async executeActionsEmail(userId, { clientId, redirectUri, lifespanSeconds = 60 * 60 } = {}) {
    const qp = new URLSearchParams();
    if (clientId) qp.set('clientId', clientId);
    if (redirectUri) qp.set('redirectUri', redirectUri);
    if (lifespanSeconds) qp.set('lifespan', String(lifespanSeconds));

    const res = await this._kcFetch(
      `/admin/realms/${encodeURIComponent(this.realm)}/users/${encodeURIComponent(userId)}/execute-actions-email?${qp.toString()}`,
      {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(['UPDATE_PASSWORD']),
      }
    );
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(txt || `Keycloak execute-actions-email failed (HTTP ${res.status})`);
    }
  }
}

