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

## Tests

No Docker or API keys required for unit tests (in-memory MongoDB; Redis and Claude mocked).

```bash
cd api && npm install && npm test
cd ../worker && npm install && npm test
```

CI runs the same via `.github/workflows/ci.yml` on push/PR to `main`.

## Status

- **Day 1–2:** Scaffold + API service. See [api/README.md](./api/README.md).
- **Day 3:** Worker (Redis consumer, Claude, notifications). See [worker/README.md](./worker/README.md).
- **Tests:** API + worker unit tests + CI on `feat/tests` (added before Day 4; Day 6 plan not closed).
- **Next:** Day 4 — MCP; Day 5 — frontend.
