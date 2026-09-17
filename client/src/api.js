const API_BASE = '';

function getToken() { return localStorage.getItem('token') || ''; }

async function request(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  const token = getToken();
  if (token) opts.headers.Authorization = `Bearer ${token}`;
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${API_BASE}${path}`, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export const api = {
  auth: {
    login: (u, p) => request('POST', '/api/auth/login', { username: u, password: p }),
    register: (body) => request('POST', '/api/auth/register', body),
    me: () => request('GET', '/api/auth/me'),
  },
  dashboard: () => request('GET', '/api/dashboard'),
  listings: {
    list: (q = '') => request('GET', `/api/listings?${q}`),
    nearby: (lat, lng, radius = 5000) => request('GET', `/api/listings/nearby?lat=${lat}&lng=${lng}&radius=${radius}`),
    get: (id) => request('GET', `/api/listings/${id}`),
    create: (body) => request('POST', '/api/listings', body),
    update: (id, body) => request('PUT', `/api/listings/${id}`, body),
    delete: (id) => request('DELETE', `/api/listings/${id}`),
  },
  properties: {
    list: () => request('GET', '/api/properties'),
    create: (body) => request('POST', '/api/properties', body),
    update: (id, body) => request('PUT', `/api/properties/${id}`, body),
    delete: (id) => request('DELETE', `/api/properties/${id}`),
  },
  applications: {
    list: () => request('GET', '/api/applications'),
    create: (body) => request('POST', '/api/applications', body),
    update: (id, body) => request('PUT', `/api/applications/${id}`, body),
  },
  appointments: {
    list: () => request('GET', '/api/appointments'),
    create: (body) => request('POST', '/api/appointments', body),
    update: (id, body) => request('PUT', `/api/appointments/${id}`, body),
  },
  messages: {
    list: () => request('GET', '/api/messages'),
    unreadCount: () => request('GET', '/api/messages/unread-count'),
    read: (id) => request('PUT', `/api/messages/${id}/read`),
    readAll: () => request('PUT', '/api/messages/read-all'),
  },
  leases: {
    list: () => request('GET', '/api/leases'),
    create: (body) => request('POST', '/api/leases', body),
    update: (id, body) => request('PUT', `/api/leases/${id}`, body),
  },
  bills: {
    list: (leaseId, period) => request('GET', `/api/leases/${leaseId}/bills${period ? '?period=' + period : ''}`),
    generate: (period) => request('POST', '/api/bills/generate', { period }),
    create: (leaseId, body) => request('POST', `/api/leases/${leaseId}/bills`, body),
    update: (id, body) => request('PUT', `/api/bills/${id}`, body),
    delete: (id) => request('DELETE', `/api/bills/${id}`),
  },
  users: {
    list: (role) => request('GET', `/api/users?${role ? 'role=' + role : ''}`),
  },
  upload: async (file) => {
    const form = new FormData();
    form.append('file', file);
    const token = getToken();
    const res = await fetch('/api/upload', {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  },
};
