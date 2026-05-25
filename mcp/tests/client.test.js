import { jest } from '@jest/globals';
import { ApiClient } from '../src/api/client.js';

describe('ApiClient', () => {
  let fetchMock;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock;
  });

  function jsonResponse(status, body, headers = {}) {
    return {
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(body),
      headers: {
        get: (name) => headers[name.toLowerCase()] ?? null,
      },
    };
  }

  it('init skips login when authToken is set', async () => {
    const client = new ApiClient({
      apiUrl: 'http://localhost:4000',
      authToken: 'existing-token',
    });

    await client.init();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(client.token).toBe('existing-token');
  });

  it('login extracts token from Set-Cookie', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, { user: { id: '1' } }, {
        'set-cookie': 'logsentinel_token=abc123; Path=/; HttpOnly',
      })
    );

    const client = new ApiClient({
      apiUrl: 'http://localhost:4000',
      authToken: null,
      email: 'user@test.com',
      password: 'password123',
    });

    const token = await client.login('user@test.com', 'password123');
    expect(token).toBe('abc123');
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:4000/auth/login',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('listLogs builds query string', async () => {
    const client = new ApiClient({
      apiUrl: 'http://localhost:4000',
      authToken: 'token',
    });

    fetchMock.mockResolvedValue(jsonResponse(200, { logs: [] }));

    await client.listLogs({ limit: 10, level: 'error', query: 'timeout', source: 'api' });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:4000/logs?limit=10&level=error&source=api&q=timeout',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer token' }),
      })
    );
  });

  it('getLog encodes log id in path', async () => {
    const client = new ApiClient({
      apiUrl: 'http://localhost:4000',
      authToken: 'token',
    });

    fetchMock.mockResolvedValue(jsonResponse(200, { log: { message: 'hi' } }));

    await client.getLog('507f1f77bcf86cd799439011');

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:4000/logs/507f1f77bcf86cd799439011',
      expect.any(Object)
    );
  });

  it('request throws API error message', async () => {
    const client = new ApiClient({
      apiUrl: 'http://localhost:4000',
      authToken: 'token',
    });

    fetchMock.mockResolvedValue(jsonResponse(404, { error: 'Log not found' }));

    await expect(client.getLog('missing')).rejects.toThrow('Log not found');
  });
});
