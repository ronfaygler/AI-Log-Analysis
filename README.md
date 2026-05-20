# LogSentinel

AI-powered log analysis system.

## Services

| Directory | Description |
|-----------|-------------|
| `api/` | REST API, auth, log ingestion |
| `worker/` | Redis queue consumer, AI processing |
| `mcp/` | MCP server for AI tool integration |
| `frontend/` | React dashboard |

## Local development

1. Copy `.env.example` to `.env` and fill in values.
2. Start the stack: `docker compose up --build`
3. See [CONTEXT.md](./CONTEXT.md) for architecture and session context.
4. See [DECISIONS.md](./DECISIONS.md) for architecture decisions and problem log.

## Status

Scaffold only — no application logic yet.
