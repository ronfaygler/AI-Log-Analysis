# LogSentinel — Architecture & Decision Log

## Architecture

_(To be filled as we build.)_

## Key decisions

### Split into API + Worker services
- **What:** Log ingestion and AI processing are separate services (`api/` and `worker/`).
- **Why:** The worker needs to scale independently; ingestion spikes should not require spinning up more API instances.
- **Alternatives considered:** Single Express server handling everything.
- **Date:** 2026-05-20

### Fly.io deployment: one machine running both api and worker
- **What:** Production `api` and `worker` are packaged into a single Docker image (`Dockerfile.fly`, repo root) and run as two Node processes inside one container (`deploy/start-combined.sh`), deployed as one Fly app (`logsentinel-api`) — not two separate Fly apps each with their own machine.
- **Why:** Fly.io moved to a paid-only model (no more free allowance) around the time this was deployed — each Fly app/machine is billed independently (~$1.94/mo for the smallest size), so two apps cost ~$3.88/mo vs. ~$1.94/mo for one. This project's real load doesn't need `api` and `worker` to scale or fail independently, so the cost saving outweighed that isolation.
- **Alternatives considered:** Keep two separate Fly apps (simpler, doubles the bill); Render (free web service, but Background Workers require a paid plan there too, and the free tier sleeps — worse for a public demo); Oracle Cloud "Always Free" Ampere A1 VM (genuinely $0/mo, but manual VM ops instead of `fly deploy`, and known to hit "out of host capacity" errors on signup in busy regions).
- **Trade-off accepted:** if the one machine crashes, both `api` and `worker` go down together instead of failing independently. `api/` and `worker/` remain fully separate codebases (no shared imports, no merged Express app) — this is packaging-only, not an architecture change to the "no monolith" rule below.
- **Date:** 2026-09-17

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

### Worker switched from BRPOP polling to event-driven pub/sub
- **What:** The worker no longer blocks on `BRPOP` in a loop. The API still `LPUSH`es jobs to `logsentinel:jobs` (durable), but now also `PUBLISH`es a lightweight wake-up signal on `logsentinel:jobs:notify`. The worker holds one idle connection `SUBSCRIBE`d to that channel and only issues Redis commands (a drain of non-blocking `RPOP`s) when notified, plus once on startup to catch up on anything queued while it was down.
- **Why:** `BRPOP` re-issues a command every time its timeout elapses even with zero traffic — at a 1s timeout that's ~2.6M billed Redis commands/month on Upstash for an idle worker. With real traffic at roughly 1 client/day, that's almost entirely wasted spend. Pub/sub-triggered draining costs near-zero while idle and still picks up jobs instantly.
- **Alternatives considered:** Just increasing/backing off the `BRPOP` timeout (cheaper than 1s, but still non-zero idle cost and doesn't scale to true zero); Redis keyspace notifications (`notify-keyspace-events`) to trigger the drain instead of an app-level `PUBLISH` (equivalent effect, but depends on Upstash allowing that server config, which wasn't worth the risk to depend on); plain pub/sub with no underlying list (simplest, but a job published while the worker is crashed/restarting would be silently lost — unacceptable since `api`/`worker` can go down independently, see the "one machine" decision above).
- **Trade-off accepted:** slightly more moving parts (a notify channel plus the list) than plain BRPOP or plain pub/sub alone, in exchange for keeping both durability and near-zero idle cost.
- **Date:** 2026-09-23

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

### `DEMO_MODE`: canned, cost-free public demo (off by default)
- **What:** An optional `demo.js` route (`POST /demo/login`, `POST /demo/seed`), mounted only when `DEMO_MODE=true` (and only rendered in the frontend when `VITE_DEMO_MODE=true`) — otherwise the routes don't exist (404) and no UI entry point appears. Any visitor can auto-login to one fixed, shared `demo@logsentinel.local` account (no registration, no password) and click "Regenerate demo logs" to populate it.
- **Why:** The real product's flow (register → create an API key → run a CLI tool locally) is correct for its intended use but is a real barrier for a portfolio/CV visitor who just wants to see the dashboard work. This is explicitly a side/optional mode, not a change to how the real system with real accounts, API keys, and Claude analysis is meant to work — hence gated off by default rather than replacing anything.
- **No Claude cost, ever:** `api/src/data/demoFixtures.js` is a hand-written set of ~29 logs with their `analysis {summary, severity, recommendation}` already attached (matching the shape `processBatch.js` produces). Seeding never enqueues a Redis job and the worker never sees it — `publishJob` is asserted to never be called in `tests/demo.test.js`. Because there's no per-click cost, only a light Redis-backed cooldown (~10s) guards against double-click races, not a hard usage cap.
- **Append-only, not replace:** clicking "regenerate" adds a fresh fixture pass on top of existing demo logs rather than wiping them — multiple visitors sharing the demo account within a short window all see the same growing, populated view.
- **10-minute idle auto-clear, checked lazily:** rather than a cron job (extra infra for a side feature), `POST /demo/login` checks a `demo:lastSeededAt` Redis timestamp and wipes the demo account's logs right there if it's been idle too long — so most visitors land on an empty dashboard with an obvious call-to-action instead of carrying over a stranger's stale click from hours ago.
- **Simulated `queued → processing → done`:** seeded entries insert as `queued` and flip to `processing`/`done` (with the canned analysis attached) in staggered chunks over ~15-25s, fire-and-forget after the HTTP response — this preserves the "watching AI analyze logs live" effect the real dashboard has, even though nothing is actually being analyzed. Chunk timing is injectable via `config.demoSimTiming` specifically so tests can run this near-instantly instead of waiting on real multi-second delays (see the "flaky/slow test" lesson below).
- **Alternatives considered:** requiring registration but pre-filling a demo account's credentials (still a needless click for a visitor); live-generating real Claude-analyzed demo traffic on each click (the original idea — rejected once the user pointed out canned data removes the cost problem entirely).
- **Date:** 2026-09-17

## Problems & solutions

### Demo-mode background simulation: real timers made tests slow/flaky
- **Problem:** The first version of the seed route fired its `queued → processing → done` background simulation with real, hardcoded `setTimeout` delays. Tests hitting `POST /demo/seed` either raced the background update (asserting "queued" right after the response, while the simulation might already have advanced) or, when using `jest.useFakeTimers()` + `advanceTimersByTimeAsync` to force the full ~20s simulation to complete, hung/timed out — and every test's un-awaited background call kept running with real timers well past that test's own assertions, still executing (and erroring on a disconnected Mongo client) after suite teardown.
- **Solution:** Made the simulation's delays an injectable `timing` parameter (`config.demoSimTiming`, defaulting to the real values) instead of hardcoded. Tests that only need the immediate post-seed state use a config with a multi-minute initial delay (so the background work never proceeds during the test run at all); the one test verifying the full progression uses a near-zero-delay config and polls for completion instead of manipulating fake timers.
- **Lesson:** Fire-and-forget background work with real timers is fundamentally hard to test deterministically — don't reach for `jest.useFakeTimers()` on code with real async I/O interleaved with timers; make the timing itself an injectable parameter instead.
- **Date:** 2026-09-17

### Auth cookie hardcoded `SameSite=Lax` breaks cross-domain production auth
- **Problem:** `setAuthCookie` always set `sameSite: 'lax'`. That's fine locally (frontend and API share `localhost`), but production splits them across domains (Vercel frontend, Fly.io API) — browsers don't send `Lax` cookies on cross-site `fetch`/XHR, so every authenticated request after login would silently come back as logged-out.
- **Solution:** `sameSite` now follows `config.cookieSecure` (`'none'` when true, `'lax'` when false); `SameSite=None` requires `Secure`, which `cookieSecure` already controls. `logout`'s `clearCookie` now uses the same attributes — mismatched attributes mean the browser won't recognize it as the same cookie to delete.
- **Lesson:** A cookie config that works in local same-origin dev can silently break the moment frontend and backend split across domains — worth checking `SameSite`/`Secure` explicitly before any cross-domain deploy, not just from `COOKIE_SECURE` being "on".
- **Date:** 2026-09-14

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
