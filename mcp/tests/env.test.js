import { loadEnv } from '../src/config/env.js';

describe('loadEnv', () => {
  const env = { ...process.env };

  afterEach(() => {
    process.env = { ...env };
  });

  it('requires API_URL', () => {
    delete process.env.API_URL;
    expect(() => loadEnv()).toThrow(/API_URL/);
  });

  it('requires MCP_AUTH_TOKEN or email and password', () => {
    process.env.API_URL = 'http://localhost:4000';
    delete process.env.MCP_AUTH_TOKEN;
    delete process.env.MCP_EMAIL;
    delete process.env.MCP_PASSWORD;
    expect(() => loadEnv()).toThrow(/MCP_AUTH_TOKEN|MCP_EMAIL/);
  });

  it('accepts MCP_AUTH_TOKEN alone', () => {
    process.env.API_URL = 'http://localhost:4000/';
    process.env.MCP_AUTH_TOKEN = 'jwt-token';
    delete process.env.MCP_EMAIL;
    delete process.env.MCP_PASSWORD;

    const config = loadEnv();
    expect(config.apiUrl).toBe('http://localhost:4000');
    expect(config.authToken).toBe('jwt-token');
  });

  it('accepts email and password', () => {
    process.env.API_URL = 'http://api:4000';
    delete process.env.MCP_AUTH_TOKEN;
    process.env.MCP_EMAIL = 'user@test.com';
    process.env.MCP_PASSWORD = 'secret';

    const config = loadEnv();
    expect(config.email).toBe('user@test.com');
    expect(config.password).toBe('secret');
    expect(config.transport).toBe('http');
  });
});
