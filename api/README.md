# LogSentinel API

Express service: JWT session auth (HttpOnly cookies) and API-key log ingestion with Redis job queue.

## Run locally

```bash
cd api
npm install
```

From repo root, ensure `.env` exists and MongoDB/Redis are reachable. For Docker infra only:

```bash
docker compose up -d mongo redis
```

Run the API with env from the repo root:

```bash
# PowerShell
$env:MONGO_URI="mongodb://logsentinel:changeme@localhost:27017/logsentinel?authSource=admin"
$env:REDIS_URL="redis://:changeme@localhost:6379"
$env:JWT_SECRET="your-secret"
$env:API_KEY_SALT="your-salt"
npm run dev
```

Or: `docker compose up --build api`

## Tests

```bash
npm test
```

Uses `mongodb-memory-server` and mocks Redis. No `.env` required for tests.

## Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | — | Health check |
| POST | `/auth/register` | — | `{ email, password }` — sets session cookie |
| POST | `/auth/login` | — | `{ email, password }` — sets session cookie |
| POST | `/auth/logout` | — | Clears session cookie |
| GET | `/auth/me` | Cookie | Current user |
| POST | `/keys` | Cookie | `{ name }` — create ingestion API key (shown once) |
| GET | `/keys` | Cookie | List API keys (prefix only) |
| POST | `/logs/ingest` | `X-API-Key` | `{ level, message, source?, metadata?, timestamp? }` |
| GET | `/logs` | Cookie or Bearer | List logs (`limit`, `level`, `status`, `source`, `q`, `issues`, `severity`, `sort`, `fresh`) — Redis-cached unless `fresh=1` |
| GET | `/logs/stream` | Cookie or Bearer | SSE stream of `log.updated` / `log.deleted` for the current user |
| GET | `/logs/:id` | Cookie or Bearer | Get one log entry by ID — Redis-cached |
| DELETE | `/logs/:id` | Cookie or Bearer | Delete a log (invalidates cache, publishes `log.deleted`) |

`LOGS_CACHE_TTL_SECONDS` (default 30) controls cache TTL for read endpoints.

### Log ingest example

```bash
curl -X POST http://localhost:4000/logs/ingest \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ls_your_key_here" \
  -d '{"level":"error","message":"Connection timeout","source":"api-gateway"}'
```

Queue jobs are pushed to Redis list `logsentinel:jobs` (configurable via `REDIS_QUEUE_NAME`).
