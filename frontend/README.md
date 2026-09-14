# LogSentinel Frontend

React dashboard (Vite) for viewing logs, AI analysis, and managing API keys.

## Run locally

```bash
cd frontend
npm install
```

Set the API URL (defaults to `http://localhost:4000`):

```bash
# PowerShell
$env:VITE_API_URL="http://localhost:4000"
npm run dev
```

Open http://localhost:3000. Ensure the API is running with `CORS_ORIGIN=http://localhost:3000`.

Or from repo root: `docker compose up --build frontend api mongo redis`

## Pages

| Path | Description |
|------|-------------|
| `/login`, `/register` | Session auth (HttpOnly cookie) |
| `/logs` | Issues-first log list (live SSE updates, severity filter/sort, delete) |
| `/logs/:id` | Full message, metadata, AI analysis, delete |
| `/keys` | Create and list ingestion API keys |
