import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';

export function createHttpApp() {
  const app = createMcpExpressApp({ host: '0.0.0.0' });

  app.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'logsentinel-mcp' });
  });

  return app;
}

export async function attachMcpRoutes(app, mcpServer) {
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });

  await mcpServer.connect(transport);

  app.all('/mcp', (req, res) => {
    transport.handleRequest(req, res, req.body);
  });

  return transport;
}
