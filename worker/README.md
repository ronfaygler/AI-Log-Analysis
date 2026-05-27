# LogSentinel Worker

Consumes log analysis jobs from Redis (`BRPOP`), batches them, calls Claude once per batch, updates MongoDB, and sends notifications.

## Environment

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGO_URI` | yes | Same database as API |
| `REDIS_URL` | yes | Same Redis as API |
| `REDIS_QUEUE_NAME` | no | Default `logsentinel:jobs` |
| `ANTHROPIC_API_KEY` | yes | Claude API key |
| `ANTHROPIC_MODEL` | no | Default `claude-sonnet-4-20250514`; use Haiku in dev (see `.env.example`) |
| `NOTIFY_WEBHOOK_URL` | no | POST JSON on analyze success/failure |
| `BATCH_MAX_LOGS` | no | Flush batch at this count (default `25`) |
| `BATCH_WINDOW_MS` | no | Flush if oldest job exceeds this age in ms (default `10000`) |

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

Mocks Claude (`analyzeLogBatch`), Redis (`popJob`), and optional webhook `fetch`. Tests `processBatch`, `batchBuffer`, `consumeOnce`, and `sendNotification`.

## Flow

1. API `LPUSH`es one job per log after `POST /logs/ingest`
2. Worker `BRPOP`es jobs (1s timeout) into an in-memory buffer
3. When buffer reaches `BATCH_MAX_LOGS` or `BATCH_WINDOW_MS`, one Claude call analyzes all logs in the batch
4. Each `LogEntry` gets `status: done` and `analysis`; optional webhook per log

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

## Batch analysis

100 similar logs (e.g. failed logins) become ~4 Claude calls instead of 100. The model sees all lines in one prompt and can detect patterns (brute force, outage, regression).
