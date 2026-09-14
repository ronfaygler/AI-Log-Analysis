const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

async function request(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || res.statusText || 'Request failed');
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  register: (email, password) =>
    request('/auth/register', { method: 'POST', body: JSON.stringify({ email, password }) }),
  login: (email, password) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  me: () => request('/auth/me'),
  listKeys: () => request('/keys'),
  createKey: (name) => request('/keys', { method: 'POST', body: JSON.stringify({ name }) }),
  listLogs: (params) => {
    const qs = new URLSearchParams();
    if (params?.level) qs.set('level', params.level);
    if (params?.status) qs.set('status', params.status);
    if (params?.source) qs.set('source', params.source);
    if (params?.q) qs.set('q', params.q);
    if (params?.limit) qs.set('limit', String(params.limit));
    if (params?.issues) qs.set('issues', 'true');
    if (params?.severity) qs.set('severity', params.severity);
    if (params?.sort) qs.set('sort', params.sort);
    if (params?.fresh) qs.set('fresh', '1');
    const query = qs.toString();
    return request(`/logs${query ? `?${query}` : ''}`);
  },
  getLog: (id) => request(`/logs/${id}`),
  deleteLog: (id) => request(`/logs/${id}`, { method: 'DELETE' }),
};
