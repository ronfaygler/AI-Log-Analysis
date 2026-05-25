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

- **Day 1–2:** Scaffold + API service (auth, ingestion, Redis queue). See [api/README.md](./api/README.md).
- **Day 3:** Worker (Redis consumer, Claude, notifications). See [worker/README.md](./worker/README.md).
- **Day 4+:** MCP, frontend — not started.
