# LogSentinel — Architecture & Decision Log

## Architecture

_(To be filled as we build.)_

## Key decisions

### Split into API + Worker services
- **What:** Log ingestion and AI processing are separate services (`api/` and `worker/`).
- **Why:** The worker needs to scale independently; ingestion spikes should not require spinning up more API instances.
- **Alternatives considered:** Single Express server handling everything.
- **Date:** 2026-05-20

## Problems & solutions

_(No entries yet.)_
