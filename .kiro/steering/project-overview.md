# Project Overview

World Cup Sweepstake — a full-stack web app for running World Cup sweepstake leagues among friends. Participants join a league, draft teams via a spinning wheel, and track points as the tournament progresses.

## Architecture

Monorepo using npm workspaces with two packages:
- `client/` — React 19 SPA built with Vite
- `server/` — Express 4 REST API with file-based JSON storage

## Key Commands

| Task | Command |
|------|---------|
| Install all deps | `npm install` (from root) |
| Run server (dev) | `npm run dev:server` |
| Run client (dev) | `npm run dev:client` |
| Build client | `npm run build` |
| Run tests | `npm test` |
| Run tests (watch) | `npm run test:watch` |
| Start production | `npm start` |

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `PORT` | Server port (default: 8080) |
| `DATA_DIR` | Persistent data directory (Azure: `/home/data`, local: `server/data/`) |
| `ADMIN_TOKEN` | Token for admin API endpoints |
| `FOOTBALL_DATA_API_KEY` | External API key for live score sync |

## Deployment

- Hosted on Azure Web App (`sweepstake-zoqetfibkjpzk`)
- GitHub Actions deploys on push to `main`
- Client is built to `client/dist/` and served statically by Express
- SPA fallback: all non-API routes serve `index.html`

## Data Layer

No database. All state is stored as JSON files in `server/data/`:
- Global data: `teams.json`, `groups.json`, `fixtures.json`, `results.json`, `odds.json`
- Per-league: `leagues/{slug}.json`
- Concurrency handled via `proper-lockfile` with atomic writes

See `data-schemas.md` for full schema reference.
