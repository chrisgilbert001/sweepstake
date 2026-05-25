# Implementation Plan: Football Data Sync

## Overview

Implement an automated data synchronisation layer between the football-data.org v4 REST API and the application's local JSON data files. The system polls the external API on a configurable schedule, transforms responses to match internal formats, and writes updates to `fixtures.json`, `results.json`, and `groups.json` atomically. The implementation is structured as a set of modules under `server/services/sync/` with admin endpoints for status visibility and manual triggering.

## Tasks

- [x] 1. Set up sync module structure and core utilities
  - [x] 1.1 Create rate limiter module
    - Create `server/services/sync/rateLimiter.js` with `acquireSlot()`, `recordRequest()`, and `reset()` exports
    - Implement sliding window algorithm: maintain array of timestamps, remove entries older than 60s, check count < 9
    - `acquireSlot()` returns a Promise that resolves when a slot is available, delays up to 65s max
    - `recordRequest()` pushes current timestamp to the array
    - `reset()` clears the array (for testing)
    - _Requirements: 6.1, 6.2_

  - [x]* 1.2 Write property test for rate limiter
    - **Property 9: Rate limiter window enforcement**
    - **Validates: Requirements 6.1, 6.2**
    - Generate sequences of request timestamps and verify at most 9 requests occur within any rolling 60-second window
    - Use `fc.array(fc.nat({max: 120000}))` for delay sequences

  - [x] 1.3 Create team mapper module
    - Create `server/services/sync/teamMapper.js` with `mapTeamId()`, `validateMapping()`, and `TEAM_ID_MAP` exports
    - Define `TEAM_ID_MAP` as a `Map<number, string>` with all 48 tournament team mappings (football-data.org numeric ID → internal 3-letter code)
    - `mapTeamId(apiTeamId)` returns the 3-letter code or null if unmapped
    - `validateMapping(internalTeamIds)` checks all internal team codes have a corresponding map entry, returns `{ valid, unmapped }`
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

  - [x]* 1.4 Write property test for team mapper
    - **Property 4: Team mapper bijectivity**
    - **Validates: Requirements 3.3, 9.1**
    - Verify every entry in TEAM_ID_MAP maps to a unique 3-letter code
    - Verify no two API team IDs map to the same internal code

  - [x] 1.5 Create status mapper module
    - Create `server/services/sync/statusMapper.js` with `mapMatchStatus()` export
    - Implement mapping: SCHEDULED/TIMED → "scheduled", FINISHED → "completed", LIVE/IN_PLAY/PAUSED → "in_progress", POSTPONED/SUSPENDED/CANCELLED → "postponed"
    - Return `{ status, known }` where `known` is false for unrecognised statuses and `status` is null
    - _Requirements: 3.6, 3.7, 10.1_

  - [x]* 1.6 Write property test for status mapper
    - **Property 5: Status mapping totality over known statuses**
    - **Validates: Requirements 3.6, 10.1**
    - Generate from the known status set and verify non-null output from the defined app status set

- [x] 2. Implement API client with authentication and retry logic
  - [x] 2.1 Create API client module
    - Create `server/services/sync/apiClient.js` with `fetchFromApi(endpoint, params)` export
    - Read API key from `process.env.FOOTBALL_DATA_API_KEY`
    - Set base URL to `https://api.football-data.org`
    - Include `X-Auth-Token` header on every request
    - Implement 30-second request timeout
    - Retry on timeout: up to 2 additional attempts with 5-second delay
    - Retry on 429: up to 3 attempts with 60-second delay
    - No retry on 403 (auth failure)
    - Integrate with rate limiter: call `acquireSlot()` before each request, `recordRequest()` after
    - Return parsed JSON on success, throw `ApiError` with `{ status, message, retryable }` on failure
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 6.3, 6.4, 7.1, 7.2, 7.3, 7.5_

  - [x]* 2.2 Write property test for API key header inclusion
    - **Property 1: API key header inclusion**
    - **Validates: Requirements 1.3**
    - Generate random endpoint strings and params, verify X-Auth-Token header is always present with the configured key value

  - [x]* 2.3 Write unit tests for API client
    - Test missing/empty API key returns error
    - Test 403 response triggers no retry
    - Test timeout triggers up to 2 retries with 5s delay
    - Test 429 triggers up to 3 retries with 60s delay
    - Test malformed JSON response throws appropriate error
    - Test successful response returns parsed JSON
    - _Requirements: 1.2, 1.4, 6.3, 6.4, 7.2, 7.5_

- [x] 3. Checkpoint - Core utilities verified
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Implement sync service with fixture, result, and standings sync
  - [x] 4.1 Implement fixture sync logic in sync service
    - Create `server/services/sync/syncService.js` with `executeSyncCycle()` export
    - Fetch matches from `/v4/competitions/WC/matches` via API client
    - For each match: map teams via teamMapper, map status via statusMapper
    - Match API matches to existing fixtures by `apiMatchId` field
    - Update existing fixtures (date, status) or create new entries for unmatched matches with valid team mappings
    - Skip matches with unmapped teams (log warning)
    - Skip matches with unknown status (retain current fixture status, log warning)
    - Never remove or modify fixtures that have no corresponding API match
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

  - [x]* 4.2 Write property test for fixture sync merge correctness
    - **Property 3: Fixture sync merge correctness**
    - **Validates: Requirements 3.2, 3.5, 4.1**
    - Generate API match arrays and existing fixture arrays
    - Verify: updates by apiMatchId, creates new entries for unmatched, never removes unmatched fixtures

  - [x] 4.3 Implement result sync logic
    - Extend `syncService.js` to handle FINISHED matches
    - Create/update result entries in `results.json` matched by fixtureId
    - Store `homeScore` and `awayScore` as non-negative integers (0–99)
    - Handle penalty shootout data: populate `penaltyShootout` field when scores are equal
    - Set fixture status to "completed" only when result entry exists
    - Prevent duplicate results for same fixtureId (update existing)
    - Skip finished matches that cannot be matched to a fixture (log warning)
    - Trigger `checkTournamentComplete()` when new results are added
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 10.2, 10.3, 10.4_

  - [x]* 4.4 Write property test for result data integrity
    - **Property 6: Result data integrity**
    - **Validates: Requirements 4.2, 4.3, 4.4**
    - Generate finished matches with scores and penalty data
    - Verify: scores in [0,99], fixtureId references existing fixture, penalty constraints hold

  - [x]* 4.5 Write property test for result sync idempotence
    - **Property 7: Result sync idempotence**
    - **Validates: Requirements 4.5**
    - Generate a finished match, sync it twice, verify exactly one result entry exists

  - [x]* 4.6 Write property test for completed fixture requires result
    - **Property 11: Completed fixture requires result**
    - **Validates: Requirements 10.2, 10.3, 10.4**
    - Generate fixture transitions with and without corresponding results
    - Verify status change to "completed" is rejected when no result exists

  - [x] 4.7 Implement group standings sync logic
    - Extend `syncService.js` to fetch standings from `/v4/competitions/WC/standings` when group stage is active
    - Skip standings fetch if all Group Stage fixtures are "completed"
    - Reorder team codes within each group's `teams` array to match API position order
    - Preserve group structure (names A–L), only update ordering
    - Skip unrecognised group names (log warning)
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [x]* 4.8 Write property test for group standings reordering
    - **Property 8: Standings reordering preserves membership**
    - **Validates: Requirements 5.2, 5.3**
    - Generate standings with shuffled positions
    - Verify: group names unchanged, team membership unchanged, ordering matches API positions

- [x] 5. Implement atomic file writes and data persistence
  - [x] 5.1 Extend storage service with atomic write support
    - Extend `server/services/storageService.js` with an atomic write function
    - Write to a `.tmp` file first, then rename to target path
    - Ensure the sync service uses atomic writes for `fixtures.json`, `results.json`, `groups.json`, and `sync-status.json`
    - Follow "fetch all, then write all" pattern: all transforms complete before any file writes
    - _Requirements: 7.4_

  - [x]* 5.2 Write property test for atomic file writes
    - **Property 10: Atomic file writes preserve consistency**
    - **Validates: Requirements 7.4**
    - Simulate write operations and verify target file always contains complete data (old or new), never partial

  - [x] 5.3 Implement sync status persistence
    - Create `server/data/sync-status.json` initial file with null timestamp and "not_run" outcome
    - Write sync status after every sync cycle (success or failure)
    - Include: timestamp (ISO 8601 UTC), outcome, error details (on failure), stats (fixturesUpdated, resultsCreated, standingsUpdated)
    - _Requirements: 8.1, 8.3_

- [x] 6. Checkpoint - Sync service core verified
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Implement sync scheduler
  - [x] 7.1 Create sync scheduler module
    - Create `server/services/sync/syncScheduler.js` with `startScheduler()`, `stopScheduler()`, `isSyncInProgress()`, `triggerManualSync()` exports
    - `startScheduler(options)`: schedule first sync within initial delay (default 5s), then repeat at interval (default 3600000ms)
    - Read `SYNC_INTERVAL_MS` from environment, validate range 60000–86400000, fallback to default on invalid
    - Prevent overlapping syncs: skip execution if sync already in progress, log skip reason
    - `stopScheduler()`: cancel pending timer, wait for in-progress sync to complete
    - `triggerManualSync()`: execute immediate sync, throw if already in progress
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [x]* 7.2 Write property test for sync interval validation
    - **Property 2: Sync interval validation**
    - **Validates: Requirements 2.3, 2.4**
    - Generate random integers, non-integers, and out-of-range values
    - Verify: valid range accepted, invalid values cause fallback to 3600000ms

  - [x]* 7.3 Write unit tests for sync scheduler
    - Test first sync executes within 10s of start
    - Test overlapping sync prevention
    - Test graceful shutdown waits for in-progress sync
    - Test invalid SYNC_INTERVAL_MS falls back to default
    - _Requirements: 2.1, 2.5, 2.6_

- [x] 8. Implement admin sync endpoints
  - [x] 8.1 Add admin sync routes
    - Extend `server/routes/adminRoutes.js` with two new endpoints
    - `GET /api/admin/sync/status`: return latest sync-status.json entry; if no sync has run, return `{ outcome: "not_run", timestamp: null }`
    - `POST /api/admin/sync/trigger`: trigger immediate sync via `triggerManualSync()`; reject with 429 if called within 60s of previous manual trigger; reject with 409 if sync already in progress
    - Both endpoints protected by existing `adminAuth` middleware
    - _Requirements: 8.2, 8.3, 8.4, 8.5, 8.6_

  - [x]* 8.2 Write unit tests for admin sync routes
    - Test GET status returns latest sync log
    - Test GET status when no sync has run
    - Test POST trigger initiates sync
    - Test POST trigger returns 429 within 60s cooldown
    - Test POST trigger returns 409 when sync in progress
    - Test both endpoints require admin auth
    - _Requirements: 8.2, 8.3, 8.4, 8.5, 8.6_

- [x] 9. Wire everything together and integrate with server startup
  - [x] 9.1 Integrate sync scheduler with server lifecycle
    - In `server/index.js`: import sync scheduler, start on server boot if API key is present
    - Validate team mapping at startup; if validation fails, log error and disable sync
    - If API key is missing/empty, log warning and skip scheduler start
    - Register graceful shutdown handler to call `stopScheduler()` on SIGTERM/SIGINT
    - Add `apiMatchId` field support to fixture schema (optional field on existing fixtures)
    - _Requirements: 1.1, 1.2, 9.3, 9.4, 2.1, 2.6_

  - [x]* 9.2 Write integration tests for full sync cycle
    - Test end-to-end sync cycle with mocked HTTP responses
    - Test scheduler start/stop lifecycle
    - Test file system atomic write verification
    - Verify fixtures.json, results.json, groups.json updated correctly after sync
    - _Requirements: 3.1, 4.1, 5.1, 7.4_

- [x] 10. Final checkpoint - All tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document using `fast-check`
- Unit tests validate specific examples and edge cases using `vitest`
- The project uses ES modules (`"type": "module"`) — all imports/exports use ESM syntax
- Test files should follow existing convention: co-located `.test.js` files or `__tests__/` directory for the sync module
- The existing `storageService.js` with `proper-lockfile` is extended, not replaced

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.3", "1.5"] },
    { "id": 1, "tasks": ["1.2", "1.4", "1.6", "2.1"] },
    { "id": 2, "tasks": ["2.2", "2.3"] },
    { "id": 3, "tasks": ["4.1", "5.1"] },
    { "id": 4, "tasks": ["4.2", "4.3", "4.7", "5.3"] },
    { "id": 5, "tasks": ["4.4", "4.5", "4.6", "4.8", "5.2"] },
    { "id": 6, "tasks": ["7.1"] },
    { "id": 7, "tasks": ["7.2", "7.3", "8.1"] },
    { "id": 8, "tasks": ["8.2", "9.1"] },
    { "id": 9, "tasks": ["9.2"] }
  ]
}
```
