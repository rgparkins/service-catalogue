const API_BASE =
  (import.meta.env.VITE_SERVICE_METADATA_URL || '').replace(/\/+$/, '') || 'http://localhost:3000';

export async function apiFetch(auth, path, init = {}) {
  const url = path.startsWith('http') ? path : `${API_BASE}${path.startsWith('/') ? '' : '/'}${path}`;

  const doFetch = async () => {
    const headers = new Headers(init.headers || {});
    if (auth?.token) headers.set('authorization', `Bearer ${auth.token}`);
    return fetch(url, { ...init, headers });
  };

  let res = await doFetch();
  if (res.status !== 401) return res;

  const refreshed = await auth?.refresh?.();
  if (!refreshed) return res;

  res = await doFetch();
  return res;
}

