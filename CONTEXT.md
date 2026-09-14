# LogSentinel — Project Context

> Read this file at the start of every session before making changes.

## Project

**Name:** LogSentinel  
**Purpose:** AI-powered log analysis — ingest application logs, queue them for asynchronous batch analysis, and surface insights via REST API and a React dashboard.

## Product vision

LogSentinel is an **AI-assisted log observability layer** for small teams and side projects:

- **Apps** send structured log lines via API key (`POST /logs/ingest`).
- **Worker** batches logs and calls Claude once per batch; stores **summary, severity, and recommendation** on each `LogEntry`.
- **Humans** use the **React dashboard** (Day 5) to see what broke, how bad it is, and what to do next — without reading raw log dumps.

It is **not** a full log platform at Datadog scale. It is **ingest → queue → batch analyze → surface insights**.

### Example log (ingest)

```json
{
  "level": "error",
  "message": "Failed login for user@example.com",
  "source": "auth-service",
  "metadata": { "ip": "203.0.113.1", "reason": "bad_password" }
}
```

### Dashboard (Day 5 — implemented)

| Area | Content |
|------|---------|
| Auth | Register, login, logout (JWT HttpOnly cookie) |
| API keys | Create/list keys for app ingestion |
| Log list | Time, level, source, message snippet, status, severity badge; live SSE updates; paginated (50/page, 500 max) |
| Filters | Level, status, source, severity, text search, sort (`GET /logs` query params) |
| Log detail | Full message, metadata, AI `analysis`, error if failed |

### Local dev & demo tooling (`tools/`)

Standalone scripts, not part of the deployed stack, that talk to the public `/logs/ingest` API like any client:

- **`log-shipper.js`** (local dev only) — wraps a real command, mirrors its stdout/stderr to your terminal unchanged, and ships each line to the API in real time. Supports `--max-logs` to cap ingestion during a long dev session.
- **`demo-log-generator.js`** (local or a public demo deployment) — continuous synthetic traffic; each log independently rolls issue (`warn`/`error`/`fatal`, matching the patterns above) vs routine noise via `--issue-ratio` (default 0.5). Supports `--max-logs` to bound a run/demo's cost.

See [tools/README.md](./tools/README.md).

### Problems AI can highlight

| Pattern | Example | Typical insight |
|---------|---------|-----------------|
| Auth / brute force | Many `Failed login` from one IP | High severity; rate-limit / lockout |
| Outages | `Connection timeout`, `503` spikes | Check DB pool / upstream |
| Resource pressure | `disk 90%`, OOM | Scale or cleanup |
| Regression | New errors after deploy | Rollback or fix |

Batching: 100 similar failed logins → ~4 Claude calls (batch size 25) instead of 100, with cross-log pattern detection.

## Tech stack

| Layer | Technology |
|-------|------------|
| API | Node.js, Express |
| Worker | Node.js |
| Frontend | React |
| Database | MongoDB |
| Queue / cache | Redis |
| Containers | Docker, Docker Compose |
| CI/CD | GitHub Actions |
| Production host | Deciding — frontend on Vercel confirmed; api/worker + MongoDB/Redis hosting still TBD (was AWS Lightsail in the original plan) |

## Architecture

Two backend services plus a frontend. **No monolith** — each service has its own `package.json`, `Dockerfile`, and deployable artifact.

```
apps (X-API-Key) ──POST /logs/ingest──►  api/ ◄──read/write──► MongoDB
frontend/        ──HTTP (JWT cookie)──►  api/
                         │
                         │ LPUSH jobs
                         ▼
                      Redis queue
                         │
                         │ BRPOP + batch buffer
                         ▼
                      worker/  ──batched──► Claude
                           └──► MongoDB (analysis on each LogEntry)
```

| Service | Role |
|---------|------|
| `api/` | REST API, auth, log ingestion (API keys), enqueue jobs, read logs |
| `worker/` | Consumes Redis queue, batches logs, runs AI analysis, persists results |
| `frontend/` | React dashboard for users |

## Communication pattern

1. Client sends logs to **API** (authenticated via API key).
2. **API** validates, stores `LogEntry` in MongoDB, and **publishes a job to Redis** (`logsentinel:jobs`).
3. **Worker** buffers jobs; when `BATCH_MAX_LOGS` or `BATCH_WINDOW_MS` is reached, calls **Claude once** for the batch and writes `analysis` on each log in MongoDB.
4. **Frontend** reads state through the API (`GET /logs` — paginated, `GET /logs/:id`).

## Auth

- **Users (dashboard):** JWT issued by API, stored in **HttpOnly, Secure cookies** (not localStorage). `Authorization: Bearer` also supported for API clients.
- **Log ingestion:** **API keys** per tenant/source, sent via header (e.g. `X-API-Key`).

## Development plan

| Day | Focus | Done? |
|-----|-------|-------|
| 1 | Scaffold + Docker Compose + git init | ✅ |
| 2 | API service: JWT auth + log ingestion endpoint | ✅ |
| 3 | Worker service: Redis consumer + Claude API + notifications | ✅ |
| 4 | Batch AI analysis + API log read improvements (MCP removed) | ✅ |
| 5 | React dashboard + Redis cache + MongoDB indexes | ✅ |
| 6 | Tests (Jest + Supertest) + GitHub Actions CI | 🔄 |
| 7 | Deploy (frontend: Vercel; api/worker/db: TBD) + README polish + demo GIF | 🔄 |

At the start of each session, set the active day's **Done?** to 🔄 when work begins. Mark ✅ when that day's scope is complete. Keep **Current status** in sync with the active day.

## Current status

<!-- Updated each working session -->

**Day 1–2:** Scaffold + API (`api/README.md`).  
**Day 3:** Worker — Redis `BRPOP`, Claude analysis, webhook notifications (`worker/README.md`).  
**Day 4:** Removed MCP service. Worker batch buffer (`BATCH_MAX_LOGS`, `BATCH_WINDOW_MS`). API: Bearer auth, `GET /logs/:id`, log filters (`level`, `status`, `source`, `q`).

**Tests (early, not Day 6):** Jest for `api/` (20) and `worker/` (11) — **31 total**; mocked Claude/Redis. GitHub Actions CI runs both. Day 6 stays open for frontend tests and any remaining coverage.

**Day 5:** React dashboard (`frontend/`) — auth, log list/detail with filters, API keys. API: Redis cache on `GET /logs` and `GET /logs/:id`; compound MongoDB indexes on `LogEntry`.

**Day 5 follow-ups:**
- Added `tools/log-shipper.js` and `tools/demo-log-generator.js` (see above), both with a `--max-logs` cap to bound cost/rate-limit exposure on long runs.
- Fixed a worker bug: `analyzeLogBatch`'s `max_tokens` was a hardcoded `1024`, which truncated Claude's JSON response for batches of ~20+ logs (`Expected ',' or ']' ...` parse failures on every large batch). Now scales with batch size (`300 + batchSize * 120`, capped at 4096).
- `GET /logs` is now paginated: fixed 50/page, `page` param, response includes `total`/`totalPages`, and the underlying result set is capped at 500 matching logs regardless of how many actually exist. Frontend has Previous/Next controls above and below the table.
- CI (`.github/workflows/ci.yml`) expanded beyond api/worker tests: added `build-frontend` (`vite build`) and `check-tools` (`node --check` on the tools/ scripts) jobs, since neither had any automated coverage before.
- Fixed several stale doc details (worker's actual default `ANTHROPIC_MODEL`, pagination undocumented in api/frontend READMEs, tools description referencing an earlier random-burst design that was simplified to `--issue-ratio`).

**Next:** Day 6 — frontend still has no test suite (CI only builds it); Day 7 — decide and stand up api/worker/db hosting to pair with the Vercel frontend.

_Last updated: 2026-09-14_

## Do not

- **No monolith** — do not merge api and worker into one Express app.
- **No shared runtime code** between services except shared **types** (e.g. a small `packages/types` or duplicated interfaces only when necessary).
- **No hardcoded secrets** — use `.env` locally and secrets in CI/production; never commit credentials.
- **No application logic in scaffold commits** — implement features in focused PRs/commits per service.
