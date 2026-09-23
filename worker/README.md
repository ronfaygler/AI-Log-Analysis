# LogSentinel Worker

Consumes log analysis jobs from Redis (event-driven pub/sub, not polling), batches them, calls Claude once per batch, updates MongoDB, and sends notifications.

## Environment

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGO_URI` | yes | Same database as API |
| `REDIS_URL` | yes | Same Redis as API |
| `REDIS_QUEUE_NAME` | no | Default `logsentinel:jobs` |
| `ANTHROPIC_API_KEY` | yes | Claude API key |
| `ANTHROPIC_MODEL` | no | Default `claude-haiku-4-5` (see `.env.example`) |
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

Mocks Claude (`analyzeLogBatch`), Redis (`popJob`), and optional webhook `fetch`. Tests `processBatch`, `batchBuffer`, `drainQueue`, and `sendNotification`.

## Flow

1. API `LPUSH`es one job per log after `POST /logs/ingest`, then `PUBLISH`es a lightweight wake-up signal on `<queue>:notify`
2. Worker holds one idle Redis connection `SUBSCRIBE`d to that channel — zero Redis commands while there's nothing to do. On each notify (and once on startup, to catch up on anything queued while it was down) it drains the list with non-blocking `RPOP`s into an in-memory buffer
3. When buffer reaches `BATCH_MAX_LOGS` or `BATCH_WINDOW_MS`, one Claude call analyzes all logs in the batch
4. Each `LogEntry` gets `status: done` and `analysis`; optional webhook per log

Jobs stay durable in the Redis list (not just the pub/sub signal) — if the worker is down or restarting when a job is pushed, it's still there to drain on the next startup or notify, it's just not picked up instantly.

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

`max_tokens` for the batch response scales with batch size (`300 + batchSize * 120`, capped at 4096) so larger batches don't get their JSON response truncated mid-array.
