# LogSentinel — Project Context

> Read this file at the start of every session before making changes.

## Project

**Name:** LogSentinel  
**Purpose:** AI-powered log analysis system — ingest application logs, queue them for asynchronous processing, and surface insights via API, worker pipelines, and MCP tooling for AI assistants.

## Tech stack

| Layer | Technology |
|-------|------------|
| API | Node.js, Express |
| Worker | Node.js |
| MCP server | Node.js |
| Frontend | React |
| Database | MongoDB |
| Queue / cache | Redis |
| Containers | Docker, Docker Compose |
| CI/CD | GitHub Actions |
| Production host | AWS Lightsail |

## Architecture

Three backend services plus a frontend. **No monolith** — each service has its own `package.json`, `Dockerfile`, and deployable artifact.

```
frontend/  ──HTTP──►  api/
                         │
                         │ publish jobs
                         ▼
                      Redis queue
                         │
                         │ consume
                         ▼
                      worker/  ──►  MongoDB, AI providers

mcp/  ──►  api/ (read-only tooling for AI clients)
```

| Service | Role |
|---------|------|
| `api/` | REST API, auth, log ingestion (API keys), enqueue analysis jobs |
| `worker/` | Consumes Redis queue, runs AI analysis, persists results |
| `mcp/` | Model Context Protocol server exposing LogSentinel capabilities to AI tools |
| `frontend/` | React dashboard for users |

## Communication pattern

1. Client sends logs to **API** (authenticated via API key).
2. **API** validates, stores metadata if needed, and **publishes a job to a Redis queue**.
3. **Worker** subscribes/consumes from the queue, processes logs with AI, writes results to MongoDB.
4. **Frontend** and **MCP** read state through the API (MCP does not bypass the API for mutations unless explicitly designed later).

## Auth

- **Users (dashboard):** JWT issued by API, stored in **HttpOnly, Secure cookies** (not localStorage).
- **Log ingestion:** **API keys** per tenant/source, sent via header (e.g. `X-API-Key`).

## Development plan

| Day | Focus | Done? |
|-----|-------|-------|
| 1 | Scaffold + Docker Compose + git init | ✅ |
| 2 | API service: JWT auth + log ingestion endpoint | ✅ |
| 3 | Worker service: Redis consumer + Claude API + notifications | ⬜ |
| 4 | MCP server: 3 tools connecting to live logs | ⬜ |
| 5 | React dashboard + Redis cache + MongoDB indexes | ⬜ |
| 6 | Tests (Jest + Supertest) + GitHub Actions CI | ⬜ |
| 7 | AWS deploy + README polish + demo GIF | ⬜ |

At the start of each session, set the active day's **Done?** to 🔄 when work begins. Mark ✅ when that day's scope is complete. Keep **Current status** in sync with the active day.

## Current status

<!-- Updated each working session -->

**Day 2 (complete):** `api/` — Express app with JWT auth (`logsentinel_token` HttpOnly cookie), API key CRUD (`/keys`), log ingest (`POST /logs/ingest` → MongoDB + Redis `LPUSH`), `GET /logs` for dashboard. See `api/README.md`.

**Next:** Day 3 — Worker Redis consumer + Claude API.

_Last updated: 2026-05-20_

## Do not

- **No monolith** — do not merge api, worker, and mcp into one Express app.
- **No shared runtime code** between services except shared **types** (e.g. a small `packages/types` or duplicated interfaces only when necessary).
- **No hardcoded secrets** — use `.env` locally and secrets in CI/production; never commit credentials.
- **No application logic in scaffold commits** — implement features in focused PRs/commits per service.
