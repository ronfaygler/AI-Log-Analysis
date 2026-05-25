import * as z from 'zod/v4';

function toolResult(data) {
  const text = JSON.stringify(data, null, 2);
  return {
    content: [{ type: 'text', text }],
    structuredContent: data,
  };
}

function toolError(message) {
  return {
    isError: true,
    content: [{ type: 'text', text: message }],
  };
}

export function registerTools(server, api) {
  server.registerTool(
    'list_logs',
    {
      title: 'List logs',
      description:
        'List recent log entries for the authenticated user. Optionally filter by level or processing status.',
      inputSchema: z.object({
        limit: z.number().int().min(1).max(100).optional().describe('Max entries (default 50)'),
        level: z
          .enum(['debug', 'info', 'warn', 'error', 'fatal'])
          .optional()
          .describe('Filter by log level'),
        status: z
          .enum(['queued', 'processing', 'done', 'failed'])
          .optional()
          .describe('Filter by analysis status'),
      }),
    },
    async ({ limit, level, status }) => {
      try {
        const data = await api.listLogs({ limit, level, status });
        return toolResult(data);
      } catch (err) {
        return toolError(err.message);
      }
    }
  );

  server.registerTool(
    'get_log',
    {
      title: 'Get log',
      description:
        'Fetch a single log entry by ID, including AI analysis when processing is complete.',
      inputSchema: z.object({
        logId: z.string().min(1).describe('MongoDB log entry ID'),
      }),
    },
    async ({ logId }) => {
      try {
        const data = await api.getLog(logId);
        return toolResult(data);
      } catch (err) {
        return toolError(err.message);
      }
    }
  );

  server.registerTool(
    'search_logs',
    {
      title: 'Search logs',
      description:
        'Search log messages (case-insensitive substring match). Optionally filter by level or source.',
      inputSchema: z.object({
        query: z.string().min(1).describe('Text to search for in log messages'),
        limit: z.number().int().min(1).max(100).optional().describe('Max entries (default 50)'),
        level: z
          .enum(['debug', 'info', 'warn', 'error', 'fatal'])
          .optional()
          .describe('Filter by log level'),
        source: z.string().optional().describe('Exact source name match'),
      }),
    },
    async ({ query, limit, level, source }) => {
      try {
        const data = await api.listLogs({ query, limit, level, source });
        return toolResult(data);
      } catch (err) {
        return toolError(err.message);
      }
    }
  );
}
