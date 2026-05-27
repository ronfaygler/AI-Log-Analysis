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

### Dashboard (Day 5 — planned)

| Area | Content |
|------|---------|
| Auth | Register, login, logout (JWT HttpOnly cookie) |
| API keys | Create/list keys for app ingestion |
| Log list | Time, level, source, message snippet, status, severity badge |
| Filters | Level, status, source, text search (`GET /logs` query params) |
| Log detail | Full message, metadata, AI `analysis`, error if failed |

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
| Production host | AWS Lightsail |

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
4. **Frontend** reads state through the API (`GET /logs`, `GET /logs/:id`).

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
| 5 | React dashboard + Redis cache + MongoDB indexes | ⬜ |
| 6 | Tests (Jest + Supertest) + GitHub Actions CI | ⬜ |
| 7 | AWS deploy + README polish + demo GIF | ⬜ |

At the start of each session, set the active day's **Done?** to 🔄 when work begins. Mark ✅ when that day's scope is complete. Keep **Current status** in sync with the active day.

## Current status

<!-- Updated each working session -->

**Day 1–2:** Scaffold + API (`api/README.md`).  
**Day 3:** Worker — Redis `BRPOP`, Claude analysis, webhook notifications (`worker/README.md`).  
**Day 4:** Removed MCP service. Worker batch buffer (`BATCH_MAX_LOGS`, `BATCH_WINDOW_MS`). API: Bearer auth, `GET /logs/:id`, log filters (`level`, `status`, `source`, `q`).

**Tests (early, not Day 6):** Jest for `api/` (20) and `worker/` (11) — **31 total**; mocked Claude/Redis. GitHub Actions CI runs both. Day 6 stays open for frontend tests and any remaining coverage.

**Next:** Day 5 — React dashboard + Redis cache + MongoDB indexes.

_Last updated: 2026-05-27_

## Do not

- **No monolith** — do not merge api and worker into one Express app.
- **No shared runtime code** between services except shared **types** (e.g. a small `packages/types` or duplicated interfaces only when necessary).
- **No hardcoded secrets** — use `.env` locally and secrets in CI/production; never commit credentials.
- **No application logic in scaffold commits** — implement features in focused PRs/commits per service.
