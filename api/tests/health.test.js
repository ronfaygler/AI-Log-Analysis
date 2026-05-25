const request = require('supertest');
const { createApp } = require('../src/app');
const { testConfig } = require('./helpers');

const app = createApp(testConfig);

describe('health', () => {
  it('returns ok', async () => {
    const res = await request(app).get('/health').expect(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('logsentinel-api');
  });
});
