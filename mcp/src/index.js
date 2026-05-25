import { loadEnv } from './config/env.js';
import { ApiClient } from './api/client.js';
import { buildServer } from './server.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createHttpApp, attachMcpRoutes } from './http.js';

async function startHttpServer(config, mcpServer) {
  const app = createHttpApp();
  await attachMcpRoutes(app, mcpServer);

  app.listen(config.port, '0.0.0.0', () => {
    console.log(`LogSentinel MCP listening on port ${config.port} (Streamable HTTP at /mcp)`);
  });
}

async function startStdioServer(mcpServer) {
  const transport = new StdioServerTransport();
  await mcpServer.connect(transport);
  console.error('LogSentinel MCP running on stdio');
}

async function main() {
  const config = loadEnv();
  const api = new ApiClient(config);
  await api.init();

  const mcpServer = buildServer(api);

  if (config.transport === 'stdio') {
    await startStdioServer(mcpServer);
  } else {
    await startHttpServer(config, mcpServer);
  }
}

main().catch((err) => {
  console.error('Failed to start MCP server:', err);
  process.exit(1);
});
