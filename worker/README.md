# LogSentinel Worker

Consumes log analysis jobs from Redis (`BRPOP`), calls Claude, updates MongoDB, and sends notifications.

## Environment

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGO_URI` | yes | Same database as API |
| `REDIS_URL` | yes | Same Redis as API |
| `REDIS_QUEUE_NAME` | no | Default `logsentinel:jobs` |
| `ANTHROPIC_API_KEY` | yes | Claude API key |
| `ANTHROPIC_MODEL` | no | Default `claude-sonnet-4-20250514`; use Haiku in dev (see `.env.example`) |
| `NOTIFY_WEBHOOK_URL` | no | POST JSON on analyze success/failure |

## Run

```bash
docker compose up -d mongo redis api
docker compose up --build worker
```

Or locally (with mongo/redis running):

```bash
cd worker
npm install
# set env vars from repo root .env
npm run dev
```

## Tests

```bash
npm test
```

Mocks Claude (`analyzeLog`), Redis (`popJob`), and optional webhook `fetch`. Tests `processJob`, `consumeOnce`, and `sendNotification`.

## Flow

1. API `LPUSH`es job to Redis after `POST /logs/ingest`
2. Worker `BRPOP`es job (blocks until available)
3. Sets log `status: processing` → Claude analysis → `status: done` + `analysis` object
4. Optional webhook notification; always logs to stdout

## Job payload (from API)

```json
{
  "type": "analyze_log",
  "logEntryId": "...",
  "userId": "...",
  "level": "error",
  "message": "...",
  "source": "...",
  "metadata": {},
  "loggedAt": "ISO-8601"
}
```
