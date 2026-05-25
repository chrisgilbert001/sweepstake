# Implementation Plan: World Cup Sweepstake

## Overview

A full-stack JavaScript web application enabling groups of 6 people to form leagues, allocate FIFA World Cup teams via an animated snake draft, and track points throughout the tournament. Built with React/Vite frontend, Node.js/Express backend, JSON file storage, and plain CSS styling.

## Tasks

- [x] 1. Set up project structure and core infrastructure
  - [x] 1.1 Initialize monorepo with backend and frontend directories
    - Create root `package.json` with workspaces for `client/` and `server/`
    - Initialize `server/` with Express, `proper-lockfile`, and `crypto` dependencies
    - Initialize `client/` with Vite + React template
    - Add shared dev dependencies: Vitest, fast-check, supertest
    - Create directory structure: `server/services/`, `server/routes/`, `server/middleware/`, `server/data/`, `server/data/leagues/`
    - Create directory structure: `client/src/components/`, `client/src/pages/`, `client/src/api/`, `client/src/styles/`
    - _Requirements: 9.1_

  - [x] 1.2 Implement storage service with file locking
    - Create `server/services/storageService.js` with `readFile`, `writeFile`, and `updateFile` methods
    - Use `proper-lockfile` for file-level locking on writes
    - Implement retry logic (3 retries, exponential backoff: 100ms, 200ms, 400ms)
    - Return appropriate errors for read failures, lock contention, and corrupt JSON
    - _Requirements: 9.1, 9.2_

  - [x] 1.3 Create seed data files
    - Create `server/data/teams.json` with 48 teams across 4 pots (12 per pot, seed ranks 1–48)
    - Create `server/data/fixtures.json` with empty fixtures array
    - Create `server/data/results.json` with empty results array
    - Create `server/data/odds.json` with null tournament and empty matches object
    - Create `server/data/tournament.json` with `{ "status": "in_progress", "completedAt": null }`
    - Create `server/data/leagues/` directory
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 1.4 Set up Express server with middleware
    - Create `server/index.js` with Express app setup
    - Add CORS middleware for local development
    - Add JSON body parsing middleware
    - Add request validation middleware for malformed JSON
    - Add admin auth middleware that checks `ADMIN_TOKEN` environment variable
    - Add error handling middleware returning appropriate HTTP status codes
    - _Requirements: 17.1_

- [x] 2. Implement league management
  - [x] 2.1 Implement league service and validation
    - Create `server/services/leagueService.js` with league CRUD operations
    - Implement name validation: 1–50 chars, at least one non-whitespace character
    - Implement `slugify()` function for URL-friendly league identifiers
    - Implement unique join code generation (6-char alphanumeric)
    - Implement duplicate league name check (case-sensitive)
    - Implement participant name validation (same rules as league name)
    - Implement duplicate participant name check within a league
    - Implement max 6 participants constraint
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 12.1, 12.2_

  - [ ]* 2.2 Write property test for name validation
    - **Property 1: Name validation**
    - **Validates: Requirements 1.1, 1.4**

  - [ ]* 2.3 Write property test for duplicate league name rejection
    - **Property 2: Duplicate league name rejection**
    - **Validates: Requirements 1.2**

  - [ ]* 2.4 Write property test for duplicate participant name rejection
    - **Property 3: Duplicate participant name rejection**
    - **Validates: Requirements 1.5**

  - [ ]* 2.5 Write property test for maximum participants constraint
    - **Property 4: Maximum participants constraint**
    - **Validates: Requirements 1.6**

  - [ ]* 2.6 Write property test for league slug and join code uniqueness
    - **Property 29: League slug and join code uniqueness**
    - **Validates: Requirements 12.1, 12.2**

  - [x] 2.7 Implement league API routes
    - Create `server/routes/leagueRoutes.js`
    - `POST /api/leagues` — create league (validate name, check uniqueness, generate slug and join code)
    - `GET /api/leagues/:slug` — get league details (standings, teams, allocations)
    - `POST /api/leagues/:slug/participants` — add participant (validate name, check duplicates, check max)
    - `GET /api/leagues/join/:joinCode` — get league info via join link
    - `POST /api/leagues/join/:joinCode` — join league via join link
    - Return appropriate error responses (409, 404, 400) per design error handling table
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 12.1, 12.2, 12.3, 12.4, 12.6, 12.7_

- [x] 3. Implement team pot structure and validation
  - [x] 3.1 Implement team service
    - Create `server/services/teamService.js`
    - Implement `getTeamsInPot(potNumber)` — returns teams for a given pot
    - Implement `getAllTeams()` — returns full pot structure
    - Implement `teamExists(teamId)` — validates team ID exists in 48-team pool
    - Implement seed rank to pot mapping: `ceil(rank/12)` assigns pot number
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [ ]* 3.2 Write property test for team-to-pot seed rank mapping
    - **Property 5: Team-to-pot seed rank mapping**
    - **Validates: Requirements 2.3**

  - [ ]* 3.3 Write property test for team uniqueness across pots
    - **Property 6: Team uniqueness across pots**
    - **Validates: Requirements 2.4, 2.5**

  - [x] 3.4 Implement teams API route
    - Create `server/routes/teamRoutes.js`
    - `GET /api/teams` — return all teams with pot assignments
    - _Requirements: 2.1, 2.2, 2.3_

- [x] 4. Implement snake draft logic
  - [x] 4.1 Implement draft service
    - Create `server/services/draftService.js`
    - Implement `startDraft(leagueSlug)` — validate 6 participants, randomize order using `crypto.randomInt()`, set status to `in_progress`
    - Implement `getDraftState(leagueSlug)` — return current draft state (order, progress, available teams)
    - Implement `spinWheel(leagueSlug)` — select random team from available pool in current pot, update allocations and advance state
    - Implement snake order logic: pots 4→3→2→1, round 1 forward (1→6), round 2 reverse (6→1)
    - Implement draft completion detection (48 spins = complete)
    - Prevent draft start if not exactly 6 participants
    - Prevent draft start if already completed
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10_

  - [ ]* 4.2 Write property test for draft order is valid permutation
    - **Property 7: Draft order is valid permutation**
    - **Validates: Requirements 3.2**

  - [ ]* 4.3 Write property test for snake draft sequence correctness
    - **Property 8: Snake draft sequence correctness**
    - **Validates: Requirements 3.3, 3.5, 3.6**

  - [ ]* 4.4 Write property test for draft allocates exactly 2 teams per pot per participant
    - **Property 9: Draft allocates exactly 2 teams per pot per participant**
    - **Validates: Requirements 3.4, 3.9**

  - [ ]* 4.5 Write property test for draft selection from available pool
    - **Property 10: Draft selection from available pool**
    - **Validates: Requirements 3.8**

  - [x] 4.6 Implement draft API routes
    - Create `server/routes/draftRoutes.js`
    - `POST /api/leagues/:slug/draft/start` — initiate draft
    - `GET /api/leagues/:slug/draft/state` — get current draft state
    - `POST /api/leagues/:slug/draft/spin` — trigger wheel spin (server selects team, returns result)
    - Return appropriate error responses (400 for invalid state, 404 for not found)
    - _Requirements: 3.1, 3.2, 3.7, 3.8, 3.10_

- [x] 5. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Implement match results and points calculation
  - [-] 6.1 Implement match service
    - Create `server/services/matchService.js`
    - Implement `addResult(resultData)` — validate teams exist, validate scores are non-negative integers, store result
    - Implement `updateResult(resultId, resultData)` — update/correct existing result
    - Implement `getResults()` — return all results
    - Implement `getEliminatedTeams()` — derive eliminated teams from knockout results
    - Validate penalty shootout: base scores must be equal, winner must be one of the two teams
    - Call `checkTournamentComplete()` after every result save
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 14.1, 14.2, 14.6_

  - [ ]* 6.2 Write property test for match outcome determination
    - **Property 15: Match outcome determination**
    - **Validates: Requirements 6.3, 6.4**

  - [ ]* 6.3 Write property test for penalty shootout invariant
    - **Property 16: Penalty shootout invariant**
    - **Validates: Requirements 6.5**

  - [ ]* 6.4 Write property test for team existence validation
    - **Property 17: Team existence validation**
    - **Validates: Requirements 6.6, 17.4**

  - [ ]* 6.5 Write property test for score validation
    - **Property 18: Score validation**
    - **Validates: Requirements 6.2**

  - [~] 6.6 Implement points service
    - Create `server/services/pointsService.js`
    - Implement `calculatePoints(participantId, leagueSlug)` — compute points, wins, draws, losses, goals scored, goals conceded, goal difference
    - Implement `rankParticipants(standings)` — sort by points desc, wins desc, goal difference desc; assign shared ranks with position skipping
    - Implement `getLeagueStandings(leagueSlug)` — calculate standings for all participants in a league
    - Points: win=3, draw=1, loss=0, penalty shootout winner=+1 additional
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 8.1, 8.2, 8.3, 8.4, 8.5, 8.8_

  - [ ]* 6.7 Write property test for points calculation correctness
    - **Property 19: Points calculation correctness**
    - **Validates: Requirements 7.1, 7.2, 7.3, 7.4**

  - [ ]* 6.8 Write property test for points additivity
    - **Property 20: Points additivity**
    - **Validates: Requirements 7.5**

  - [ ]* 6.9 Write property test for ranking algorithm correctness
    - **Property 21: Ranking algorithm correctness**
    - **Validates: Requirements 8.1, 8.2, 8.3, 8.4**

  - [ ]* 6.10 Write property test for knockout elimination
    - **Property 27: Knockout elimination**
    - **Validates: Requirements 14.1, 14.2**

  - [ ]* 6.11 Write property test for group stage never eliminates
    - **Property 28: Group stage never eliminates**
    - **Validates: Requirements 14.6**

  - [ ]* 6.12 Write property test for league isolation
    - **Property 22: League isolation**
    - **Validates: Requirements 9.2, 9.4**

- [ ] 7. Implement odds and fixtures services
  - [-] 7.1 Implement odds service
    - Create `server/services/oddsService.js`
    - Implement `setTournamentOdds(oddsData)` — validate all 48 teams present, all values > 1.0, store snapshot
    - Implement `getTournamentOdds()` — return stored tournament odds
    - Implement `setMatchOdds(fixtureId, oddsData)` — store match odds for a fixture
    - Implement `getMatchOdds(fixtureId)` — return match odds
    - Implement `getUnderdog(matchOdds)` — return team with higher odds value (or null if equal)
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 5.1, 5.2, 5.3, 5.4, 5.5_

  - [ ]* 7.2 Write property test for tournament odds validation
    - **Property 11: Tournament odds validation**
    - **Validates: Requirements 4.1**

  - [ ]* 7.3 Write property test for odds snapshot completeness
    - **Property 12: Odds snapshot completeness**
    - **Validates: Requirements 4.2, 4.6**

  - [ ]* 7.4 Write property test for odds immutability (round-trip)
    - **Property 13: Odds immutability (round-trip)**
    - **Validates: Requirements 4.4**

  - [ ]* 7.5 Write property test for underdog labeling
    - **Property 14: Underdog labeling**
    - **Validates: Requirements 5.3, 5.4**

  - [-] 7.6 Implement fixture service
    - Create `server/services/fixtureService.js`
    - Implement `addFixture(fixtureData)` — validate teams, store fixture
    - Implement `updateFixture(fixtureId, fixtureData)` — edit existing fixture
    - Implement `getFixtures()` — return all fixtures sorted by date ascending
    - Implement `getFixturesWithoutResults()` — return fixtures that have no corresponding result
    - _Requirements: 13.1, 13.2, 13.5, 13.6, 17.5, 17.7_

  - [ ]* 7.7 Write property test for fixtures sorted by date
    - **Property 24: Fixtures sorted by date**
    - **Validates: Requirements 13.1**

  - [-] 7.8 Implement tournament service
    - Create `server/services/tournamentService.js`
    - Implement `checkTournamentComplete()` — check if all fixtures have results, mark complete if so
    - Implement `getTournamentStatus()` — return current tournament state
    - Store state in `tournament.json`
    - _Requirements: 15.1_

  - [ ]* 7.9 Write property test for tournament completion auto-detection
    - **Property 30: Tournament completion auto-detection**
    - **Validates: Requirements 15.1**

- [ ] 8. Implement remaining API routes
  - [~] 8.1 Implement global data routes
    - Create `server/routes/globalRoutes.js`
    - `GET /api/fixtures` — return all fixtures
    - `GET /api/results` — return all match results
    - `GET /api/odds/tournament` — return tournament odds
    - `GET /api/odds/match/:fixtureId` — return match odds for a fixture
    - _Requirements: 4.3, 5.2, 13.1, 13.2_

  - [~] 8.2 Implement admin routes
    - Create `server/routes/adminRoutes.js`
    - Apply admin auth middleware to all routes
    - `POST /api/admin/results` — enter match result (validate teams, scores)
    - `PUT /api/admin/results/:id` — update/correct match result (trigger recalculation)
    - `POST /api/admin/odds/tournament` — enter tournament odds snapshot
    - `POST /api/admin/odds/match` — enter match odds for a fixture
    - `POST /api/admin/fixtures` — add a fixture
    - `PUT /api/admin/fixtures/:id` — edit a fixture
    - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5, 17.6, 17.7_

  - [~] 8.3 Wire all routes into Express app
    - Register all route modules in `server/index.js`
    - Ensure correct route ordering (specific routes before parameterized)
    - Add 404 handler for unmatched routes
    - _Requirements: 9.1_

- [~] 9. Checkpoint - Ensure all backend tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. Implement frontend foundation
  - [~] 10.1 Set up React app with routing and global styles
    - Configure React Router with routes: `/`, `/league/:slug`, `/league/:slug/draft`, `/league/:slug/schedule`, `/admin`
    - Create `client/src/styles/variables.css` with CSS custom properties (colors, spacing, typography, breakpoints)
    - Create `client/src/styles/global.css` with base styles, responsive typography (min 16px body), and reset
    - Create `client/src/App.jsx` with router setup
    - _Requirements: 16.1, 16.5_

  - [~] 10.2 Create API client layer
    - Create `client/src/api/client.js` with base fetch wrapper (error handling, JSON parsing)
    - Create `client/src/api/leagues.js` — league CRUD, join, participants
    - Create `client/src/api/draft.js` — draft start, state, spin
    - Create `client/src/api/teams.js` — get teams
    - Create `client/src/api/fixtures.js` — get fixtures
    - Create `client/src/api/results.js` — get results
    - Create `client/src/api/odds.js` — get tournament/match odds
    - Create `client/src/api/admin.js` — admin operations (results, odds, fixtures)
    - _Requirements: 9.1_

- [ ] 11. Implement home page and league creation
  - [~] 11.1 Create HomePage component
    - Create `client/src/pages/HomePage.jsx` and `HomePage.css`
    - Form to create a new league (name input with validation feedback)
    - Inline error messages for invalid names and duplicate names
    - On success, redirect to the new league page
    - Responsive layout (320px–1920px)
    - _Requirements: 1.1, 1.2, 16.1_

  - [~] 11.2 Create league join flow
    - Create `client/src/pages/JoinPage.jsx` and `JoinPage.css`
    - Route: `/join/:joinCode`
    - Display league info, allow entering participant name
    - Show error if league is full (display view-only mode)
    - Show error for duplicate participant names
    - On success, redirect to league view
    - _Requirements: 12.2, 12.4, 12.7_

- [ ] 12. Implement league view and standings
  - [~] 12.1 Create LeagueView page
    - Create `client/src/pages/LeagueView.jsx` and `LeagueView.css`
    - Display league name, join link (copyable), and participant count
    - Show "Add Participant" form when league has fewer than 6 participants
    - Show "Start Draft" button when league has 6 participants and draft not started
    - Link to draft session when draft is in progress
    - Display standings table when draft is complete
    - Responsive layout with mobile-friendly standings (no horizontal scroll for rank, name, points)
    - _Requirements: 1.3, 1.4, 8.5, 8.6, 12.3, 12.5, 16.3_

  - [~] 12.2 Create StandingsTable component
    - Create `client/src/components/StandingsTable.jsx` and `StandingsTable.css`
    - Display rank, participant name, points, wins, draws, losses, goals scored, goals conceded, goal difference
    - Show allocated teams per participant with eliminated teams greyed out/strikethrough
    - Show tournament odds alongside each team
    - Display trophy/celebration indicators for 1st, 2nd, 3rd when tournament is complete
    - Show "Tournament Complete" banner when finalized
    - Minimum 44x44px touch targets on mobile
    - _Requirements: 8.1, 8.5, 8.6, 8.7, 8.8, 14.3, 14.4, 14.5, 15.2, 15.3, 15.4, 15.5, 15.6, 16.2_

  - [~] 12.3 Create TeamDetailModal component
    - Create `client/src/components/TeamDetailModal.jsx` and `TeamDetailModal.css`
    - Display all matches played by selected team ordered by date
    - Show opponent, date, stage, score, outcome, match odds, points earned per match
    - Show "No matches played" message if team has no results
    - Show total points for the team
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

- [ ] 13. Implement draft session UI
  - [~] 13.1 Create DraftSession page
    - Create `client/src/pages/DraftSession.jsx` and `DraftSession.css`
    - Display current participant name, current pot number, round number
    - Display draft progress indicator (X/48 spins completed)
    - Display draft order
    - Show "Spin" button (disabled during animation)
    - Show pot allocation summary after each pot completes
    - Show final summary with all participants and their 8 teams grouped by pot after draft completes
    - Responsive layout functional on mobile viewports
    - _Requirements: 3.7, 11.1, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8, 16.4_

  - [~] 13.2 Create WheelSpinner component
    - Create `client/src/components/WheelSpinner.jsx` and `WheelSpinner.css`
    - Display wheel with names of available teams in current pot
    - Animate spinning and deceleration on spin trigger
    - Land on server-selected team (animation is cosmetic, result from server)
    - Display selected team prominently after animation completes
    - Indicate which participant received the team
    - Disable spin button during animation
    - Functional and visible on mobile viewports
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 16.4_

- [ ] 14. Implement schedule and fixtures view
  - [~] 14.1 Create ScheduleView page
    - Create `client/src/pages/ScheduleView.jsx` and `ScheduleView.css`
    - Display all fixtures ordered by date ascending
    - Show team names, date/time, tournament stage for each fixture
    - Highlight fixtures involving the league's participants' teams
    - Annotate each team with owning participant name
    - Replace scheduled fixtures with completed results when available
    - Show "All matches completed" message when no upcoming fixtures remain
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6_

  - [ ]* 14.2 Write property test for fixture ownership annotation
    - **Property 25: Fixture ownership annotation**
    - **Validates: Requirements 13.3, 13.4**

  - [ ]* 14.3 Write property test for completed fixture shows result
    - **Property 26: Completed fixture shows result**
    - **Validates: Requirements 13.5**

- [ ] 15. Implement admin panel
  - [~] 15.1 Create AdminPanel page
    - Create `client/src/pages/AdminPanel.jsx` and `AdminPanel.css`
    - Admin token input field (stored in session/local storage)
    - Tabbed interface: Match Results, Fixtures, Tournament Odds, Match Odds
    - Display list of fixtures without results for easy identification
    - _Requirements: 17.1, 17.7_

  - [~] 15.2 Create MatchResultForm component
    - Create `client/src/components/admin/MatchResultForm.jsx` and `MatchResultForm.css`
    - Form fields: home team (dropdown), away team (dropdown), home score, away score, date, stage (dropdown), penalty shootout winner (conditional)
    - Client-side validation: scores non-negative integers, teams must be different
    - Confirmation prompt when overwriting existing result
    - Display success/error feedback
    - _Requirements: 17.1, 17.4, 17.6_

  - [~] 15.3 Create OddsEntryForm component
    - Create `client/src/components/admin/OddsEntryForm.jsx` and `OddsEntryForm.css`
    - Tournament odds: form with all 48 teams, each requiring odds > 1.0
    - Match odds: select fixture, enter odds for each team and draw
    - Validation feedback for incomplete or invalid entries
    - _Requirements: 17.2, 17.3_

  - [~] 15.4 Create FixtureForm component
    - Create `client/src/components/admin/FixtureForm.jsx` and `FixtureForm.css`
    - Form fields: home team, away team, date/time, stage
    - Support both add and edit modes
    - _Requirements: 17.5_

- [~] 16. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 17. Integration wiring and final features
  - [~] 17.1 Wire frontend to backend with proxy configuration
    - Configure Vite dev server proxy to forward `/api` requests to Express backend
    - Ensure CORS is properly configured for local development
    - Test end-to-end request flow from React to Express to JSON files
    - _Requirements: 9.1_

  - [~] 17.2 Implement real-time standings update
    - Add polling mechanism in LeagueView to refresh standings periodically (every 30 seconds)
    - Ensure standings recalculate on the server after each result entry
    - Verify points update propagates to all leagues containing affected teams
    - _Requirements: 7.6, 8.7, 9.3_

  - [ ]* 17.3 Write property test for shared results propagation
    - **Property 23: Shared results propagation**
    - **Validates: Requirements 9.3**

  - [~] 17.4 Implement error handling and edge cases
    - Add toast notification component for network errors with retry option
    - Add "League not found" page for invalid URLs
    - Add loading states for all async operations
    - Preserve form state on network failures
    - _Requirements: 12.6_

  - [~] 17.5 Implement tournament completion UI
    - Display celebration/trophy indicators for top 3 when tournament is complete
    - Lock standings display with "Tournament Complete" label
    - Show final 1st, 2nd, 3rd place declarations
    - _Requirements: 15.2, 15.3, 15.4, 15.5, 15.6, 15.7_

- [~] 18. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The backend is fully functional before frontend work begins, enabling API-first development
- All CSS uses plain stylesheets with CSS custom properties — no Tailwind or component libraries
- Testing uses Vitest as the runner and fast-check for property-based tests

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "1.4"] },
    { "id": 2, "tasks": ["2.1", "3.1"] },
    { "id": 3, "tasks": ["2.2", "2.3", "2.4", "2.5", "2.6", "2.7", "3.2", "3.3", "3.4"] },
    { "id": 4, "tasks": ["4.1"] },
    { "id": 5, "tasks": ["4.2", "4.3", "4.4", "4.5", "4.6"] },
    { "id": 6, "tasks": ["6.1", "7.1", "7.6", "7.8"] },
    { "id": 7, "tasks": ["6.2", "6.3", "6.4", "6.5", "6.6", "7.2", "7.3", "7.4", "7.5", "7.7", "7.9"] },
    { "id": 8, "tasks": ["6.7", "6.8", "6.9", "6.10", "6.11", "6.12"] },
    { "id": 9, "tasks": ["8.1", "8.2"] },
    { "id": 10, "tasks": ["8.3"] },
    { "id": 11, "tasks": ["10.1", "10.2"] },
    { "id": 12, "tasks": ["11.1", "11.2"] },
    { "id": 13, "tasks": ["12.1", "12.2", "12.3"] },
    { "id": 14, "tasks": ["13.1", "13.2"] },
    { "id": 15, "tasks": ["14.1", "14.2", "14.3"] },
    { "id": 16, "tasks": ["15.1", "15.2", "15.3", "15.4"] },
    { "id": 17, "tasks": ["17.1", "17.2", "17.3", "17.4", "17.5"] }
  ]
}
```
