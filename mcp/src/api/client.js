export class ApiClient {
  constructor(config) {
    this.baseUrl = config.apiUrl;
    this.token = config.authToken || null;
    this.email = config.email;
    this.password = config.password;
  }

  async init() {
    if (!this.token) {
      this.token = await this.login(this.email, this.password);
    }
  }

  async login(email, password) {
    const res = await fetch(`${this.baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(body.error || `Login failed (${res.status})`);
    }

    const setCookie = res.headers.get('set-cookie');
    const match = setCookie?.match(/logsentinel_token=([^;]+)/);
    if (!match) {
      throw new Error('No session token in login response');
    }
    return match[1];
  }

  async request(path, options = {}) {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: 'application/json',
        ...options.headers,
      },
    });

    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(body.error || `API request failed (${res.status})`);
    }
    return body;
  }

  listLogs(params = {}) {
    const search = new URLSearchParams();
    if (params.limit != null) search.set('limit', String(params.limit));
    if (params.level) search.set('level', params.level);
    if (params.status) search.set('status', params.status);
    if (params.source) search.set('source', params.source);
    if (params.query) search.set('q', params.query);
    const qs = search.toString();
    return this.request(qs ? `/logs?${qs}` : '/logs');
  }

  getLog(logId) {
    return this.request(`/logs/${encodeURIComponent(logId)}`);
  }
}
