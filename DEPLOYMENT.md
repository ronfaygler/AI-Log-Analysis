# Deployment

Frontend on **Vercel**, `api` + `worker` on **one Fly.io machine** (a single container runs both Node processes via `deploy/start-combined.sh` — see "Why one machine" below), **MongoDB Atlas** and **Upstash Redis** for data.

### Why one machine

`api` and `worker` need to run continuously — the worker holds a blocking Redis loop, which free-tier "web service" hosts like Render don't support without a paid background-worker plan. Fly.io does support it, but each Fly app you deploy gets its own billed machine (~$1.94/mo for the smallest `shared-cpu-1x-256mb` size) — two separate apps means two bills. Since this project's actual load is tiny, `Dockerfile.fly` (repo root) builds one image containing both `api/` and `worker/` source, and `deploy/start-combined.sh` launches both Node processes in the same container, so it's one Fly app (`logsentinel-api`) and one billed machine (~$1.94/mo total instead of ~$3.88/mo for two). The trade-off: if that one machine crashes, both processes go down together instead of failing independently — an acceptable trade for a low-traffic portfolio project. The `api/` and `worker/` codebases themselves are still fully separate (no code merged, no shared imports) — this is a deployment-level packaging choice, not an architecture change.

## 1. MongoDB Atlas

1. In your existing Atlas account, create a free **M0** cluster (any region).
2. Database Access → add a database user (username + password).
3. Network Access → allow access from anywhere (`0.0.0.0/0`) — Fly's outbound IPs aren't static.
4. Get the connection string (Connect → Drivers): looks like
   `mongodb+srv://<user>:<password>@<cluster>.mongodb.net/logsentinel?retryWrites=true&w=majority`

## 2. Upstash Redis

1. Sign up at upstash.com (free tier).
2. Create a Redis database — pick a region close to `iad` (e.g. `us-east-1`) to match the Fly apps below.
3. Copy the **TLS** connection string (starts with `rediss://`) — `ioredis` (used by both services) enables TLS automatically from that scheme, no code changes needed.

## 3. Fly.io — api + worker (one app, one machine)

Install the CLI and log in (opens a browser):

```powershell
irm https://fly.io/install.ps1 | iex
fly auth login
```

Deploy from the **repo root** (not `api/` or `worker/`) — `fly.toml` there points at `Dockerfile.fly`, which builds both `api/` and `worker/` into one image:

```bash
fly apps create logsentinel-api   # app name from fly.toml; pick another if taken
fly secrets set --app logsentinel-api `
  MONGO_URI="mongodb+srv://..." `
  REDIS_URL="rediss://..." `
  JWT_SECRET="$(openssl rand -hex 32)" `
  API_KEY_SALT="$(openssl rand -hex 16)" `
  CORS_ORIGIN="https://your-app.vercel.app" `
  COOKIE_SECURE="true" `
  REDIS_QUEUE_NAME="logsentinel:jobs" `
  LOGS_CACHE_TTL_SECONDS="30" `
  ANTHROPIC_API_KEY="sk-ant-..." `
  ANTHROPIC_MODEL="claude-haiku-4-5" `
  BATCH_MAX_LOGS="10" `
  BATCH_WINDOW_MS="30000"
fly deploy
```

(`CORS_ORIGIN` is a placeholder for now — come back and update it with `fly secrets set --app logsentinel-api CORS_ORIGIN="https://<real-vercel-url>"` once step 4 gives you the real Vercel URL; that restarts the app automatically.)

Your API's public URL will be `https://logsentinel-api.fly.dev`. Both the api server and the worker's Redis consumer run inside this one machine (check `fly logs --app logsentinel-api` for both "LogSentinel API listening..." and "Consuming queue..." lines to confirm).

## 4. Vercel — frontend

1. Import the GitHub repo in the Vercel dashboard; set **root directory** to `frontend/`. Vercel auto-detects Vite (build: `npm run build`, output: `dist`); `frontend/vercel.json` adds the SPA rewrite so client-side routes don't 404 on refresh.
2. Project Settings → Environment Variables: `VITE_API_URL = https://logsentinel-api.fly.dev`.
3. Deploy. Note the assigned URL (e.g. `https://ai-log-analysis.vercel.app`).
4. Go back to step 3 and set the real `CORS_ORIGIN` on the `api` Fly app to that URL.

## 5. Verify

1. Open the Vercel URL, register an account, create an API key on the **API Keys** page.
2. `node tools/demo-log-generator.js --key <apiKey> --url https://logsentinel-api.fly.dev --max-logs 100` — populates the live demo, capped so it can't run away with your Anthropic usage.
3. Confirm login/session works (the cross-domain cookie fix — `SameSite=None; Secure` when `COOKIE_SECURE=true` — is what makes this work; see `api/src/routes/auth.js`).
4. Confirm the SSE live-update stream works on `/logs` across the two domains.

## 6. Optional: turn on the public demo

Off by default. To enable a no-registration "View live demo" flow on the deployed instance (see `CONTEXT.md`/`DECISIONS.md` for what it does):

```bash
fly secrets set --app logsentinel-api DEMO_MODE="true"
```

Then, in Vercel's Environment Variables, set `VITE_DEMO_MODE=true` and redeploy the frontend (Vercel doesn't auto-restart on env var changes — trigger a redeploy from the dashboard or push a commit). This does not touch the real registration/login/API-key flow at all — it only adds the demo entry point.

## Notes

- The worker is event-driven, not polling: it holds one idle Redis connection subscribed to a notify channel and only issues commands (a drain of `RPOP`s) when the API publishes a wake-up signal after `LPUSH`ing a job, plus once on startup to catch up. This keeps Upstash usage close to zero for a low-traffic deployment while still picking up new jobs instantly. Jobs themselves stay durable in the Redis list even if the worker is briefly down (see `worker/README.md` for the full flow).
- `COOKIE_SECURE=true` in production is required for cross-domain auth to work at all (see `DECISIONS.md`) — don't deploy without it.
- Re-deploy after a code change with `fly deploy --app logsentinel-api` from the **repo root**.
- `fly secrets set` triggers an automatic restart — no separate redeploy needed for env-only changes.
- If `worker`'s process crashes independently (check logs for a stack trace after "Consuming queue..."), the api half is still fine — the two are separate processes in the same container, not one process that fails together on every error, only on the whole machine dying.
