# LogSentinel MCP Server

Model Context Protocol server exposing read-only access to live logs via the LogSentinel API.

## Tools

| Tool | Description |
|------|-------------|
| `list_logs` | Recent logs; optional `limit`, `level`, `status` filters |
| `get_log` | Single log by ID, including AI `analysis` when done |
| `search_logs` | Case-insensitive message search; optional `level`, `source` |

## Environment

| Variable | Required | Description |
|----------|----------|-------------|
| `API_URL` | yes | LogSentinel API base URL (e.g. `http://api:4000` in Docker) |
| `MCP_EMAIL` | * | Dashboard user email (with `MCP_PASSWORD`) |
| `MCP_PASSWORD` | * | Dashboard user password |
| `MCP_AUTH_TOKEN` | * | JWT bearer token — skips login if set |
| `PORT` | no | HTTP port (default `4001`) |
| `MCP_TRANSPORT` | no | `http` (default) or `stdio` |

\* Provide either `MCP_AUTH_TOKEN` or both `MCP_EMAIL` and `MCP_PASSWORD`.

## Run

### Docker (HTTP)

Register a dashboard user via the API first, then set `MCP_EMAIL` / `MCP_PASSWORD` in `.env`:

```bash
docker compose up --build mcp
```

MCP endpoint: `http://localhost:4001/mcp` (Streamable HTTP, stateless).

Health: `GET http://localhost:4001/health`

### Local stdio (Cursor / Claude Desktop)

```bash
cd mcp
npm install
$env:API_URL="http://localhost:4000"
$env:MCP_EMAIL="you@example.com"
$env:MCP_PASSWORD="your-password"
$env:MCP_TRANSPORT="stdio"
npm start
```

Example Cursor MCP config:

```json
{
  "mcpServers": {
    "logsentinel": {
      "command": "node",
      "args": ["C:/path/to/AI-Log-Analysis/mcp/src/index.js"],
      "env": {
        "API_URL": "http://localhost:4000",
        "MCP_EMAIL": "you@example.com",
        "MCP_PASSWORD": "your-password",
        "MCP_TRANSPORT": "stdio"
      }
    }
  }
}
```

## Auth

The MCP server authenticates to the API using the same JWT as the dashboard (`Authorization: Bearer` or session cookie from login). Logs are scoped to the configured user's account.

## Tests

```bash
cd mcp
npm install
npm test
```

Mocks the LogSentinel API (`fetch`) and uses in-memory MCP transport for tool tests. No Docker or live API required.
