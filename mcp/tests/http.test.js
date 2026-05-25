import request from 'supertest';
import { createHttpApp } from '../src/http.js';

describe('HTTP', () => {
  it('GET /health returns ok', async () => {
    const app = createHttpApp();
    const res = await request(app).get('/health').expect(200);

    expect(res.body).toEqual({ ok: true, service: 'logsentinel-mcp' });
  });
});
