import { jest } from '@jest/globals';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { buildServer } from '../src/server.js';

async function connectTestClient(api) {
  const mcpServer = buildServer(api);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await mcpServer.connect(serverTransport);

  const client = new Client({ name: 'test-client', version: '0.0.0' });
  await client.connect(clientTransport);
  return { client, mcpServer };
}

describe('MCP tools', () => {
  it('registers list_logs, get_log, and search_logs', async () => {
    const api = {
      listLogs: jest.fn().mockResolvedValue({ logs: [] }),
      getLog: jest.fn(),
    };

    const { client, mcpServer } = await connectTestClient(api);
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name).sort();

    expect(names).toEqual(['get_log', 'list_logs', 'search_logs']);
    await mcpServer.close();
  });

  it('list_logs returns API data', async () => {
    const api = {
      listLogs: jest.fn().mockResolvedValue({ logs: [{ message: 'disk 90%' }] }),
      getLog: jest.fn(),
    };

    const { client, mcpServer } = await connectTestClient(api);
    const result = await client.callTool({
      name: 'list_logs',
      arguments: { limit: 5, level: 'warn' },
    });

    expect(api.listLogs).toHaveBeenCalledWith({ limit: 5, level: 'warn', status: undefined });
    expect(result.structuredContent).toEqual({ logs: [{ message: 'disk 90%' }] });
    await mcpServer.close();
  });

  it('get_log returns a single log entry', async () => {
    const api = {
      listLogs: jest.fn(),
      getLog: jest.fn().mockResolvedValue({ log: { id: 'abc', message: 'timeout' } }),
    };

    const { client, mcpServer } = await connectTestClient(api);
    const result = await client.callTool({
      name: 'get_log',
      arguments: { logId: 'abc' },
    });

    expect(api.getLog).toHaveBeenCalledWith('abc');
    expect(result.structuredContent).toEqual({ log: { id: 'abc', message: 'timeout' } });
    await mcpServer.close();
  });

  it('search_logs passes query to listLogs', async () => {
    const api = {
      listLogs: jest.fn().mockResolvedValue({ logs: [{ message: 'payment failed' }] }),
      getLog: jest.fn(),
    };

    const { client, mcpServer } = await connectTestClient(api);
    const result = await client.callTool({
      name: 'search_logs',
      arguments: { query: 'payment', source: 'checkout' },
    });

    expect(api.listLogs).toHaveBeenCalledWith({
      query: 'payment',
      limit: undefined,
      level: undefined,
      source: 'checkout',
    });
    expect(result.structuredContent.logs).toHaveLength(1);
    await mcpServer.close();
  });

  it('returns tool error when API call fails', async () => {
    const api = {
      listLogs: jest.fn().mockRejectedValue(new Error('Authentication required')),
      getLog: jest.fn(),
    };

    const { client, mcpServer } = await connectTestClient(api);
    const result = await client.callTool({
      name: 'list_logs',
      arguments: {},
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/Authentication required/);
    await mcpServer.close();
  });
});
