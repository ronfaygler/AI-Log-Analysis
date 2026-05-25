import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerTools } from './tools/registerTools.js';

export function buildServer(api) {
  const server = new McpServer(
    { name: 'logsentinel', version: '0.1.0' },
    {
      instructions:
        'LogSentinel MCP tools read live logs from the LogSentinel API. Use list_logs for recent entries, get_log for full detail and AI analysis, and search_logs to find messages by text.',
    }
  );

  registerTools(server, api);
  return server;
}
