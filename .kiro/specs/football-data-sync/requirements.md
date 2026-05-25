# Requirements Document

## Introduction

This feature adds automated data synchronisation from the football-data.org v4 API to the World Cup sweepstake application. Instead of manually entering match results, fixtures, and standings through the admin panel, the system will poll the API once per hour and update local JSON data files with the latest match schedules, scores, group standings, and knockout bracket progression. Manual admin entry remains available as a fallback.

## Glossary

- **Sync_Service**: The server-side background service responsible for fetching data from the football-data.org API and writing updates to local data files.
- **API_Client**: The HTTP client module that communicates with the football-data.org v4 REST API, handling authentication and rate limiting.
- **Sync_Scheduler**: The timer mechanism that triggers the Sync_Service at a configured interval (default: once per hour).
- **Team_Mapper**: The module that maps football-data.org team identifiers to the application's internal team IDs (e.g., three-letter codes like "eng", "fra").
- **Sync_Log**: A record of each sync execution including timestamp, status, and any errors encountered.
- **Match_Status**: The state of a match as reported by football-data.org: SCHEDULED, LIVE, IN_PLAY, PAUSED, FINISHED, POSTPONED, SUSPENDED, or CANCELLED.
- **Rate_Limiter**: The mechanism that ensures API requests stay within the football-data.org free tier limit of 10 requests per minute.

## Requirements

### Requirement 1: API Authentication Configuration

**User Story:** As an administrator, I want to configure the football-data.org API key securely, so that the application can authenticate with the external API.

#### Acceptance Criteria

1. WHEN the application starts, THE Sync_Service SHALL read the API key from the `FOOTBALL_DATA_API_KEY` environment variable.
2. IF the `FOOTBALL_DATA_API_KEY` environment variable is not set or is an empty string, THEN THE Sync_Service SHALL log a warning message indicating that the API key is missing and disable automatic syncing.
3. THE API_Client SHALL include the API key in the `X-Auth-Token` header on every request to football-data.org.
4. IF the football-data.org API responds with a 403 status indicating an invalid or expired API key, THEN THE API_Client SHALL log an error message indicating authentication failure and return the failure to the caller without retrying the request.

### Requirement 2: Scheduled Hourly Sync

**User Story:** As an administrator, I want the system to automatically fetch updates every hour, so that match data stays current without manual intervention.

#### Acceptance Criteria

1. WHEN the server starts and a valid API key is configured, THE Sync_Scheduler SHALL schedule the first sync to execute within 10 seconds.
2. THE Sync_Scheduler SHALL trigger the Sync_Service once every 60 minutes after the initial sync.
3. WHERE the `SYNC_INTERVAL_MS` environment variable is set, THE Sync_Scheduler SHALL use that value (in milliseconds) as the interval between syncs, accepting only integer values between 60000 and 86400000 inclusive.
4. IF the `SYNC_INTERVAL_MS` environment variable is set to a non-integer or a value outside the range 60000–86400000, THEN THE Sync_Scheduler SHALL log a warning and fall back to the default 60-minute interval.
5. IF a sync is already in progress when the next scheduled sync is due, THEN THE Sync_Scheduler SHALL skip the overlapping execution and write a Sync_Log entry indicating the skip reason.
6. WHEN the server shuts down, THE Sync_Scheduler SHALL cancel any pending scheduled sync and allow an in-progress sync to complete before exiting.

### Requirement 3: Match Fixture Sync

**User Story:** As a user, I want match schedules to be automatically updated, so that I can see accurate kick-off times and new fixtures as they are announced.

#### Acceptance Criteria

1. WHEN a sync executes, THE Sync_Service SHALL fetch match data from the `/v4/competitions/WC/matches` endpoint with a request timeout of 30 seconds.
2. WHEN the API returns match data, THE Sync_Service SHALL match each API match to an existing fixture by the API's unique match identifier, update the fixture if it exists, or create a new entry in `fixtures.json` if no matching fixture is found.
3. THE Team_Mapper SHALL translate football-data.org team identifiers to the application's internal three-letter team codes.
4. IF the API returns a match with a team that has no mapping in the Team_Mapper, THEN THE Sync_Service SHALL log a warning and skip that match.
5. WHEN a fixture date or time changes in the API response, THE Sync_Service SHALL update the corresponding fixture's `date` field.
6. THE Sync_Service SHALL map API match statuses to the application's fixture status values: SCHEDULED maps to "scheduled", FINISHED maps to "completed", and LIVE/IN_PLAY/PAUSED map to "in_progress".
7. IF the API returns a match with a status not listed in the defined mapping, THEN THE Sync_Service SHALL log a warning and retain the fixture's current status value unchanged.
8. IF the API request fails due to a network error, timeout, or non-200 HTTP response, THEN THE Sync_Service SHALL log an error message indicating the failure reason and leave all existing fixture data unchanged.

### Requirement 4: Match Result Sync

**User Story:** As a user, I want match scores to appear automatically after a game finishes, so that points and standings update without waiting for manual entry.

#### Acceptance Criteria

1. WHEN the external API reports a match with status "FINISHED", THE Sync_Service SHALL create or update a corresponding entry in `results.json` by matching the API match to a fixture in `fixtures.json` using the combination of `homeTeam`, `awayTeam`, and `date`.
2. WHEN creating or updating a result entry, THE Sync_Service SHALL store the full-time score as `homeScore` and `awayScore` as non-negative integers (0 to 99).
3. WHEN a finished match includes penalty shootout data, THE Sync_Service SHALL populate the `penaltyShootout` field with `winner` (the winning team code), `homeGoals` (non-negative integer), and `awayGoals` (non-negative integer), where `homeScore` and `awayScore` are equal.
4. WHEN creating or updating a result entry, THE Sync_Service SHALL set the result's `fixtureId` to the `id` of the matched fixture from `fixtures.json` and update that fixture's `status` to "completed".
5. IF a result already exists for a given `fixtureId`, THEN THE Sync_Service SHALL update the existing result entry rather than creating a duplicate.
6. WHEN a new result is synced, THE Sync_Service SHALL trigger the tournament completion check (existing `checkTournamentComplete` logic).
7. IF the external API is unreachable or returns a non-success response, THEN THE Sync_Service SHALL retain all previously synced results unchanged and log an error message indicating the failure reason.
8. IF a finished match from the API cannot be matched to any fixture in `fixtures.json`, THEN THE Sync_Service SHALL skip that match without modifying `results.json` and log a warning indicating the unmatched match details.

### Requirement 5: Group Standings Sync

**User Story:** As a user, I want group stage tables to reflect the latest standings, so that I can track which teams are qualifying from each group.

#### Acceptance Criteria

1. WHEN a sync executes and at least one fixture with stage "Group Stage" has status "scheduled" or "in_progress", THE Sync_Service SHALL fetch standings from the `/v4/competitions/WC/standings` endpoint.
2. WHEN the API returns standings data, THE Sync_Service SHALL update the team ordering within each group in `groups.json` by reordering the team codes in each group's `teams` array to match the API's position order.
3. THE Sync_Service SHALL preserve the existing group structure (group names A through L) and only update team positions within groups.
4. IF the API standings response contains a group that does not match any existing group name in `groups.json`, THEN THE Sync_Service SHALL log a warning and skip that group without modifying other groups.
5. IF all fixtures with stage "Group Stage" have status "completed", THEN THE Sync_Service SHALL skip the standings fetch.

### Requirement 6: Rate Limiting

**User Story:** As an administrator, I want the system to respect API rate limits, so that the application does not get blocked by football-data.org.

#### Acceptance Criteria

1. THE Rate_Limiter SHALL enforce a maximum of 9 requests per rolling 60-second sliding window to the football-data.org API (leaving 1 request of headroom below the 10/minute limit).
2. WHEN the Rate_Limiter detects that the next request would exceed the 9-request limit within the current 60-second window, THE API_Client SHALL delay the request until the oldest request in the window is more than 60 seconds old, up to a maximum delay of 65 seconds.
3. IF the API responds with HTTP status 429 (Too Many Requests), THEN THE API_Client SHALL wait 60 seconds before retrying the request, up to a maximum of 3 retry attempts.
4. IF the API_Client has exhausted 3 retry attempts after receiving HTTP status 429, THEN THE API_Client SHALL abandon the request and log an error indicating the rate limit was persistently exceeded.

### Requirement 7: Error Handling and Resilience

**User Story:** As an administrator, I want the sync process to handle failures gracefully, so that temporary API outages do not corrupt local data or crash the server.

#### Acceptance Criteria

1. IF the API returns an HTTP error status (4xx or 5xx), THEN THE Sync_Service SHALL log the error including the HTTP status code and response body (up to 1024 characters), discard any partial data from the current sync cycle, and continue with the next scheduled sync.
2. IF a network timeout occurs (no response received within 30 seconds) during an API request, THEN THE API_Client SHALL retry the request up to 2 additional times with a 5-second delay between attempts.
3. IF all retry attempts are exhausted without a successful response, THEN THE API_Client SHALL log the failure and the Sync_Service SHALL skip the current sync cycle, preserving the existing local data files unchanged.
4. THE Sync_Service SHALL write data files atomically (writing to a temporary file then renaming to the target path) so that a failure mid-write does not leave files in a corrupted state.
5. IF the API response fails JSON parsing, THEN THE Sync_Service SHALL log the error including the first 512 characters of the malformed response body and skip the current sync cycle, preserving existing local data files unchanged.

### Requirement 8: Sync Status Visibility

**User Story:** As an administrator, I want to see when the last sync ran and whether it succeeded, so that I can diagnose issues.

#### Acceptance Criteria

1. WHEN a sync completes, THE Sync_Service SHALL write a Sync_Log entry to `sync-status.json` containing the timestamp in ISO 8601 UTC format, outcome ("success" or "failure"), and an error details field that is populated when the outcome is "failure" and omitted or null when the outcome is "success".
2. THE Server SHALL expose a `GET /api/admin/sync/status` endpoint that returns the latest Sync_Log entry.
3. IF the `GET /api/admin/sync/status` endpoint is called and no sync has ever been executed, THEN THE Server SHALL respond with a Sync_Log entry where the outcome indicates that no sync has run yet and the timestamp is null.
4. THE Server SHALL expose a `POST /api/admin/sync/trigger` endpoint that triggers an immediate sync execution, subject to the football-data.org Rate_Limiter, and responds with the initiated Sync_Log entry upon acceptance.
5. IF the `POST /api/admin/sync/trigger` endpoint is called within 60 seconds of a previous manual trigger, THEN THE Server SHALL reject the request with HTTP status 429 and a message indicating the minimum interval between manual triggers.
6. WHEN the manual trigger endpoint is called while a sync is already in progress, THE Server SHALL respond with HTTP status 409 and a message indicating a sync is already running.

### Requirement 9: Team ID Mapping

**User Story:** As a developer, I want a reliable mapping between football-data.org team identifiers and the app's internal team codes, so that synced data integrates correctly with existing features.

#### Acceptance Criteria

1. THE Team_Mapper SHALL maintain a mapping from football-data.org numeric team IDs to the application's three-letter team codes for all 48 tournament teams.
2. THE Team_Mapper SHALL be defined as a static configuration file or constant (not fetched at runtime).
3. WHEN the Team_Mapper is loaded, THE Sync_Service SHALL validate that all 48 teams in `teams.json` have a corresponding mapping entry.
4. IF a mapping validation fails at startup, THEN THE Sync_Service SHALL log an error listing the unmapped team codes and disable automatic syncing until the mapping is corrected.
5. WHEN the Sync_Service receives a football-data.org team ID, THE Team_Mapper SHALL return the corresponding three-letter team code within 1 ms.

### Requirement 10: Fixture Status Lifecycle

**User Story:** As a user, I want fixture statuses to accurately reflect whether a match is upcoming, in progress, or finished, so that the UI displays the correct state.

#### Acceptance Criteria

1. WHEN the API reports a match status of POSTPONED, SUSPENDED, or CANCELLED, THE Sync_Service SHALL set the fixture status to "postponed".
2. IF a fixture currently has "completed" status AND the API reports a non-FINISHED status for that match, THEN THE Sync_Service SHALL update the fixture status according to the standard status mapping defined in Requirement 3 and log a warning indicating the status correction.
3. WHEN a fixture transitions to "completed" status, THE Sync_Service SHALL verify that a corresponding result entry with a matching `fixtureId` exists in `results.json`.
4. IF a fixture transitions to "completed" status and no corresponding result entry exists in `results.json`, THEN THE Sync_Service SHALL log an error identifying the fixture and SHALL NOT persist the status change to "completed" until the result entry is present.
5. WHEN the API reports a SCHEDULED status for a fixture that currently has "postponed" status, THE Sync_Service SHALL update the fixture status to "scheduled" and update the fixture's `date` field to the new date from the API response.
