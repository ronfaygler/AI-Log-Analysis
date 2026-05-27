# LogSentinel

AI-powered log analysis — ingest logs, batch-analyze with Claude, view insights in the dashboard.

## Services

Apps send logs with an **API key**; the **worker** batches them and calls Claude once per batch; the **dashboard** reads results from the **API**. MongoDB stores logs and analysis; Redis holds the job queue.

```
apps ──POST /logs/ingest──► api ◄──read/write──► MongoDB
dashboard ──JWT──► api
                    │
                    ▼ Redis queue ──► worker ──batched──► Claude
                                         └──► MongoDB
```

| Directory | Description |
|-----------|-------------|
| `api/` | REST API, auth, log ingestion, `GET /logs` |
| `worker/` | Redis consumer, batched Claude analysis, webhooks |
| `frontend/` | React dashboard (Day 5) |

See [CONTEXT.md](./CONTEXT.md) for product vision, example logs, and dashboard plan.

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
- **Day 4:** Batch AI analysis; MCP removed; API log read endpoints. See [worker/README.md](./worker/README.md).
- **Tests:** API + worker unit tests + CI (Day 6 plan not closed).
- **Next:** Day 5 — frontend.
