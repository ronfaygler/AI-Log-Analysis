# LogSentinel — Architecture & Decision Log

## Architecture

_(To be filled as we build.)_

## Key decisions

### Split into API + Worker services
- **What:** Log ingestion and AI processing are separate services (`api/` and `worker/`).
- **Why:** The worker needs to scale independently; ingestion spikes should not require spinning up more API instances.
- **Alternatives considered:** Single Express server handling everything.
- **Date:** 2026-05-20

### JWT in HttpOnly cookies
- **What:** Dashboard auth uses `logsentinel_token` cookie; no JWT in `localStorage`.
- **Why:** Reduces XSS token theft risk; aligns with CONTEXT auth requirements.
- **Alternatives considered:** Bearer token in `Authorization` header only.
- **Date:** 2026-05-20

### Redis list for job queue
- **What:** API `LPUSH`es JSON jobs to `logsentinel:jobs`; worker will `BRPOP` (Day 3).
- **Why:** Simple, no extra broker dependency for MVP; same Redis instance as cache later.
- **Alternatives considered:** BullMQ, Redis Streams.
- **Date:** 2026-05-20

### Webhook notifications (optional)
- **What:** Worker POSTs JSON to `NOTIFY_WEBHOOK_URL` on success/failure; always logs to stdout if unset.
- **Why:** Simple integration point (Slack, PagerDuty, custom) without email/SMS complexity for MVP.
- **Alternatives considered:** Email (SendGrid), Redis pub/sub only.
- **Date:** 2026-05-20

### Claude for log analysis
- **What:** Worker calls Anthropic Messages API; expects JSON with summary, severity, recommendation.
- **Why:** LLM fits messy log text; Anthropic Messages API + JSON map to `LogEntry.analysis`. Default **Haiku** via `ANTHROPIC_MODEL` for cheaper dev.
- **Alternatives considered:** OpenAI, rule-based-only analysis.
- **Date:** 2026-05-20

### Jest + mongodb-memory-server for API tests
- **What:** API tests use Supertest against `createApp()`, in-memory MongoDB, mocked Redis `publishJob`.
- **Why:** Fast CI, no Docker; covers auth, keys, ingest, logs without real infra.
- **Alternatives considered:** Testcontainers, hitting docker-compose in CI only.
- **Date:** 2026-05-25

### Mock Claude in worker tests
- **What:** `jest.mock` on `analyzeLog`; `processJob` and `consumeOnce` tested without `ANTHROPIC_API_KEY`.
- **Why:** Deterministic, free CI; real Claude reserved for manual/E2E.
- **Alternatives considered:** VCR fixtures, optional integration test job.
- **Date:** 2026-05-25

## Problems & solutions

### `router.use(requireAuth)` blocked log ingest
- **Problem:** `POST /logs/ingest` returned 401 `"Authentication required"` — JWT middleware on the keys router ran for every request through that mount.
- **Solution:** Apply `requireAuth` per route on `POST/GET /keys` only, not `router.use(requireAuth)`.
- **Lesson:** Express `router.use(mw)` applies to all requests entering that router; order of `app.use()` matters.
- **Date:** 2026-05-25
