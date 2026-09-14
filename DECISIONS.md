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

### Removed MCP service
- **What:** Deleted `mcp/`; insights surfaced via API + dashboard only.
- **Why:** MCP duplicated read-only API access; not core to ingest/analyze loop; added deploy complexity.
- **Alternatives considered:** Keep MCP for Cursor integration.
- **Date:** 2026-05-25

### Worker batch buffer for Claude
- **What:** Worker accumulates Redis jobs until `BATCH_MAX_LOGS` or `BATCH_WINDOW_MS`, then one `analyzeLogBatch` call; results applied to each `LogEntry`.
- **Why:** Per-log Claude calls are expensive and miss cross-log patterns (e.g. 100 failed logins).
- **Alternatives considered:** Per-log analysis, incident collection model, rule-based dedupe.
- **Date:** 2026-05-25

### Log-shipper and demo-log-generator as standalone tools/ scripts
- **What:** Two dependency-free Node CLI scripts under `tools/`, not part of the deployed stack or `docker-compose.yml`. `log-shipper.js` wraps a real local process and ships its output live (local dev only). `demo-log-generator.js` posts continuous synthetic traffic and can target a deployed `--url` (local or production demo use).
- **Why:** The project's real-time pipeline (ingest → queue → batch → SSE) had no way to actually populate it besides hand-written `curl`; needed both a way to pipe a real app's logs through in dev, and a way to make a public/CV demo deployment look alive without a real backing app.
- **Alternatives considered:** A backend "seed" endpoint or admin script instead of a client-side tool; rejected because these should exercise the exact same public ingest path as any real client, with no special access.
- **Date:** 2026-09-14

### demo-log-generator: `--issue-ratio` instead of random incident bursts
- **What:** Each generated log independently rolls issue (`warn`/`error`/`fatal`) vs. routine noise with probability `--issue-ratio` (default 0.5), rather than the initial design of rare, multi-log "incident bursts" (~3% chance per tick, 6–20 logs long).
- **Why:** The burst model made short runs unpredictable — a request for "roughly half of a 10-log run should be issues" had no reliable way to hit that target. A flat per-log ratio is simple and predictable at any run length.
- **Alternatives considered:** Keeping bursts but tuning trigger probability against average burst length to approximate a target ratio; rejected as fragile (depends on per-scenario burst-length ranges) for a demo tool.
- **Date:** 2026-09-14

### `GET /logs` pagination capped at 500 total
- **What:** Added `page` param, fixed 50/page limit, response includes `total`/`totalPages`; the underlying matching-log count is capped at 500 (`MAX_LISTABLE_LOGS`) even if more exist — pages beyond the cap return empty.
- **Why:** Requested to keep the dashboard/API bounded during long-running local sessions or an unattended demo generator, rather than letting a list grow unbounded.
- **Alternatives considered:** Uncapped pagination (just page through everything); cursor-based pagination. Rejected both as unnecessary complexity for this project's scale — a hard cap plus offset pagination is simplest and meets the actual need.
- **Date:** 2026-09-14

## Problems & solutions

### Claude `max_tokens` truncated batch JSON for larger batches
- **Problem:** `analyzeLogBatch` hardcoded `max_tokens: 1024`. Batches of ~20+ logs need a JSON array with one summary object per log, which exceeded that budget — Claude's response got cut off mid-array, and `JSON.parse` failed with `Expected ',' or ']' after array element...` on every large batch, marking all those logs `status: failed`.
- **Solution:** Scale `max_tokens` with batch size: `Math.min(4096, 300 + capped.length * 120)`.
- **Lesson:** A fixed token budget for a per-item response array will silently break once item count grows — size it to the batch, not to whatever the smallest batch needed.
- **Date:** 2026-09-14

### Squash-merged PRs orphan the source branch's later commits
- **Problem:** After a PR from `day-5/react-dashboard` was squash-merged into `main`, further commits pushed to the same branch diverged from `main`'s history (the branch still had the original unsquashed commit as an ancestor, which `main` no longer recognized). The next PR from that branch showed as `CONFLICTING` even though there was no real content conflict — this happened three times in one session as merges kept landing shortly after each push.
- **Solution:** `git rebase --onto origin/main <last-commit-already-merged> <branch>` before opening the next PR — this drops the now-duplicate commit(s) and replays only the genuinely new ones on top of the current `main`, then force-push.
- **Lesson:** Reusing one long-lived branch across multiple squash-merged PRs requires a rebase onto `main` after every merge before continuing work on it; a fresh branch per PR avoids the problem entirely.
- **Date:** 2026-09-14

### `router.use(requireAuth)` blocked log ingest
- **Problem:** `POST /logs/ingest` returned 401 `"Authentication required"` — JWT middleware on the keys router ran for every request through that mount.
- **Solution:** Apply `requireAuth` per route on `POST/GET /keys` only, not `router.use(requireAuth)`.
- **Lesson:** Express `router.use(mw)` applies to all requests entering that router; order of `app.use()` matters.
- **Date:** 2026-05-25
