---
inclusion: fileMatch
fileMatchPattern: "server/**"
---

# Backend Architecture

## Tech Stack

- Node.js ≥18 (ES Modules)
- Express 4.21
- File-based JSON storage with `proper-lockfile`
- No database, no ORM

## Server Structure

```
server/
├── index.js              → App setup, middleware, route mounting, SPA fallback
├── data/                 → JSON data files (source of truth)
│   ├── leagues/          → Per-league JSON files ({slug}.json)
│   ├── teams.json        → Team definitions by pot
│   ├── groups.json       → Group stage composition
│   ├── fixtures.json     → Match schedule
│   ├── results.json      → Match results
│   ├── odds.json         → Betting odds
│   └── sync-status.json  → External API sync state
├── middleware/
│   └── adminAuth.js      → Bearer token auth for admin routes
├── routes/               → Express routers (thin controllers)
│   ├── leagueRoutes.js
│   ├── teamRoutes.js
│   ├── draftRoutes.js
│   ├── adminRoutes.js
│   ├── matchDayRoutes.js
│   ├── activityRoutes.js
│   ├── myTeamsRoutes.js
│   └── globalRoutes.js
└── services/             → Business logic
    ├── storageService.js → File I/O with locking
    ├── leagueService.js  → League CRUD + participants
    ├── draftService.js   → Draft wheel logic
    ├── pointsHistoryService.js
    ├── exportService.js
    └── sync/             → External API integration
        ├── syncScheduler.js
        ├── syncService.js
        ├── footballDataClient.js
        ├── rateLimiter.js
        └── teamMapper.js
```

## Route → Service → Storage Pattern

```
Route (controller)     → validates HTTP, calls service, maps errors to responses
Service (business)     → implements logic, throws { statusCode, message }
StorageService (data)  → reads/writes JSON files with locking
```

## Storage Service API

```js
import { readFile, writeFile, updateFile, atomicWriteFile } from './storageService.js';

// Read a JSON file
const data = await readFile('teams.json');

// Write (with lock)
await writeFile('results.json', updatedResults);

// Read-modify-write atomically
const updated = await updateFile('leagues/the-lads.json', (league) => {
  return { ...league, participants: [...league.participants, newParticipant] };
});

// Create new file atomically
await atomicWriteFile('leagues/new-league.json', leagueData);
```

## Error Handling Pattern

Services throw error objects:
```js
throw { statusCode: 404, message: 'League not found' };
throw { statusCode: 400, message: 'Invalid name' };
throw { statusCode: 409, message: 'Name already taken' };
throw { statusCode: 503, message: 'Service busy, please retry' };
```

Routes catch and respond:
```js
router.post('/leagues', async (req, res, next) => {
  try {
    const league = await createLeague(req.body.name);
    res.status(201).json(league);
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    next(err);
  }
});
```

## Admin Authentication

Protected routes use the `adminAuth` middleware:
```js
import { adminAuth } from '../middleware/adminAuth.js';
router.post('/admin/fixtures', adminAuth, async (req, res, next) => { ... });
```

Requires `Authorization: Bearer <ADMIN_TOKEN>` header.

## External API Sync

- Syncs live scores from Football-Data.org API
- Rate-limited (10 req/min on free tier)
- Runs on a scheduler (configurable interval)
- Maps external team IDs to internal 3-letter codes via `teamMapper.js`
- Only starts if `FOOTBALL_DATA_API_KEY` is set and team mapping validates
