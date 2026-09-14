# Tools

Local dev/demo utilities. Not part of the deployed stack (not in `docker-compose.yml`) — run them from a terminal against a running API, whether that's your local stack (`http://localhost:4000`) or a deployed instance (`--url https://your-deployment`).

Both scripts need Node 18+ (built-in `fetch`) and an ingestion API key, created via the dashboard's **API Keys** page while logged in.

## `log-shipper.js` — local dev only

Wraps any command, streams its stdout/stderr to your terminal exactly as if you'd run it directly, and ships each line to `/logs/ingest` in real time as it's produced.

```bash
node tools/log-shipper.js --key <apiKey> [--url http://localhost:4000] [--source myapp] [--max-logs n] -- <command> [args...]

# example: cap ingestion at 100 logs while developing locally
node tools/log-shipper.js --key ls_xxx --source myapp --max-logs 100 -- node myapp.js
```

| Flag | Required | Default | Description |
|------|----------|---------|-------------|
| `--key` | yes | — | Ingestion API key, sent as `X-API-Key` |
| `--url` | no | `http://localhost:4000` | Base URL of the API |
| `--source` | no | (none) | `source` field on each log entry |
| `--max-logs` | no | unlimited | Stop shipping after this many lines (the wrapped app keeps running — pass-through never stops) |
| `-- <command>` | yes | — | The command to run; everything after `--` is passed through |

Log level is inferred from each line's text (case-insensitive, worst-case wins): `fatal` > `error/err/exception/failed/failure` > `warn(ing)` > `debug` > `info` > (stderr defaults to `error`, stdout to `info`).

Since this spawns a process on your machine, it only makes sense against a real local app — it has no meaning against a remote deployment.

A failed ingest POST (bad key, API down, etc.) is logged to the tool's own stderr (`[log-shipper] ingest failed ...`) and never crashes or blocks the wrapped app.

## `demo-log-generator.js` — local or production

Generates a continuous, realistic mix of synthetic logs and posts them to `/logs/ingest`, using the same auth as any real client (no backdoor). Useful for populating the dashboard when there's no real app connected — including keeping a public/CV demo deployment looking alive.

```bash
node tools/demo-log-generator.js --key <apiKey> [--url http://localhost:4000] [--source demo-generator] [--interval-ms 1500] [--burst-chance 0.03] [--max-logs n]

# example: cap a production demo at 100 logs total (then it stops on its own)
node tools/demo-log-generator.js --key ls_xxx --url https://your-deployment --max-logs 100
```

| Flag | Required | Default | Description |
|------|----------|---------|-------------|
| `--key` | yes | — | Ingestion API key |
| `--url` | no | `http://localhost:4000` | Base URL of the API (point this at a deployed instance for a live public demo) |
| `--source` | no | `demo-generator` | `source` field on each log entry |
| `--interval-ms` | no | `1500` | Base delay between logs (jittered ±40%) |
| `--burst-chance` | no | `0.03` | Probability per tick of starting an "incident" burst |
| `--max-logs` | no | unlimited | Stop and exit after shipping this many logs total |

Emits mostly routine info/debug noise (request timings, logins, cache hits, scheduled jobs), with occasional incident bursts matching the patterns in [CONTEXT.md](../CONTEXT.md):

- **Brute force** — repeated failed logins from one fake IP, escalating to an "account locked" error
- **Outage** — connection timeouts / 503s / pool exhaustion
- **Resource pressure** — rising disk usage, escalating to an OOM kill
- **Regression** — new error types tagged with a fake deploy version

Runs until Ctrl+C. A failed ingest POST is logged to the tool's own stderr and the loop keeps running.

**Visitors to a public demo never need an API key** — the key is only used by whoever runs this generator to feed the deployment. Viewing the dashboard still requires a logged-in account.
