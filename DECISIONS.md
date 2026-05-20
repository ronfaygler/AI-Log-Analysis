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

## Problems & solutions

_(No entries yet.)_
