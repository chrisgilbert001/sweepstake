# Implementation Plan: Sweepstake Enhancements

## Overview

This plan implements nine enhancements to the World Cup Sweepstake application: Live Match Day View, Points History Timeline, Activity Feed, My Teams Dashboard, Group Stage Table, Share/Export Standings, Dark Mode, Mobile PWA Support, and Knockout Bracket View. Each feature is additive and follows the existing service-layer architecture (backend) and page/component pattern (frontend).

## Tasks

- [ ] 1. Set up shared infrastructure and data
  - [x] 1.1 Create groups.json data file with 12 World Cup groups (A–L)
    - Create `server/data/groups.json` with group definitions mapping each group letter to its 4 team IDs
    - Use the static approach defined in the design for correctness
    - _Requirements: 5.1_

  - [x] 1.2 Create ThemeContext and CSS custom properties for dark mode
    - Create `client/src/context/ThemeContext.jsx` providing `{ theme, toggleTheme }` to all components
    - Read from `localStorage` on mount, fall back to `prefers-color-scheme`, then default to light
    - Add CSS custom properties in `client/src/styles/variables.css` for both light and dark themes
    - Apply theme class to document root before first render to prevent flash
    - Ensure minimum 4.5:1 contrast ratio for WCAG AA compliance
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

  - [-] 1.3 Add ThemeContext provider and theme toggle to App.jsx
    - Wrap the BrowserRouter in ThemeContext provider
    - Add a theme toggle button/switch accessible from all pages (e.g., in a shared header/nav)
    - _Requirements: 7.1, 7.2_

  - [x] 1.4 Set up PWA manifest and service worker
    - Create `client/public/manifest.json` with app name, icons (192x192, 512x512), theme colour, standalone display, start URL
    - Create `client/public/sw.js` with cache-first strategy for app shell and network-first for API data
    - Register service worker in `client/src/main.jsx` with graceful fallback on failure
    - Create `client/src/components/OfflineBanner.jsx` for offline notification
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7_

- [ ] 2. Implement Match Day View (backend + frontend)
  - [-] 2.1 Create matchDayService.js with date filtering logic
    - Create `server/services/matchDayService.js`
    - Implement `getFixturesForDate(date)` — returns fixtures for a single calendar day sorted by date ascending
    - Implement `getFixturesForWeek(date)` — returns fixtures for Monday–Sunday of the week containing the given date, sorted by date ascending
    - Cross-reference results to determine fixture status (scheduled, completed)
    - _Requirements: 1.1, 1.2, 1.7_

  - [ ]* 2.2 Write property test for date range fixture filter
    - **Property 1: Date range fixture filter**
    - **Validates: Requirements 1.1, 1.2**

  - [ ]* 2.3 Write property test for countdown time calculation
    - **Property 2: Countdown time calculation**
    - **Validates: Requirements 1.3, 1.4**

  - [~] 2.4 Create match day API routes
    - Add `GET /api/fixtures/today` route returning fixtures for the current day
    - Add `GET /api/fixtures/week` route returning fixtures for the current week
    - Register routes in `server/index.js`
    - _Requirements: 1.1, 1.2_

  - [~] 2.5 Create MatchDayView page and CountdownTimer component
    - Create `client/src/pages/MatchDayView.jsx` with daily/weekly toggle (daily selected by default)
    - Create `client/src/components/CountdownTimer.jsx` — live countdown (HH:MM:SS) updating every second, transitions to "LIVE" at kickoff
    - Create `client/src/api/matchDay.js` API module
    - Implement 60-second polling for live score updates
    - Display empty state message when no fixtures are scheduled
    - Display final scores for completed fixtures
    - Add route `/league/:slug/match-day` to App.jsx
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_

  - [ ]* 2.6 Write unit tests for matchDayService
    - Test single-day filtering with various fixture dates
    - Test weekly range calculation (Monday–Sunday boundaries)
    - Test empty fixture set
    - Test fixture status cross-referencing with results
    - _Requirements: 1.1, 1.2, 1.7_

- [~] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Implement Points History Timeline (backend + frontend)
  - [-] 4.1 Create pointsHistoryService.js
    - Create `server/services/pointsHistoryService.js`
    - Implement `getPointsHistory(leagueSlug)` — computes cumulative points per participant per match day
    - A match day is a UTC calendar date with at least one result involving a league participant's team
    - Cumulative points must be monotonically non-decreasing
    - Include match result details (team names, scores, points earned) for each data point
    - _Requirements: 2.1, 2.2, 2.3_

  - [ ]* 4.2 Write property test for cumulative points history
    - **Property 3: Cumulative points history**
    - **Validates: Requirements 2.1, 2.2**

  - [~] 4.3 Create points history API route
    - Add `GET /api/leagues/:slug/points-history` route
    - Register route in league routes or a new route file
    - _Requirements: 2.1_

  - [~] 4.4 Create PointsTimeline page with chart component
    - Create `client/src/pages/PointsTimeline.jsx`
    - Install and use `react-chartjs-2` + `chart.js` for line chart rendering
    - Implement tooltip showing participant name, date, cumulative points, and match details on hover
    - Implement legend click to toggle participant line visibility
    - Assign distinct colours per participant (consistent across the app)
    - Display empty state message when no results are available
    - Add route `/league/:slug/points-history` to App.jsx
    - Create `client/src/api/pointsHistory.js` API module
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [ ]* 4.5 Write unit tests for pointsHistoryService
    - Test cumulative calculation with multiple match days
    - Test that only dates with relevant results produce data points
    - Test empty results scenario
    - _Requirements: 2.1, 2.2_

- [ ] 5. Implement Activity Feed (backend + frontend)
  - [-] 5.1 Create activityService.js
    - Create `server/services/activityService.js`
    - Implement `getActivityFeed(leagueSlug, page, limit)` — generates activity events from results and eliminations
    - Generate match_result events for leagues containing involved teams
    - Generate team_eliminated events for leagues where eliminated team is allocated
    - Sort events by timestamp descending (most recent first)
    - Implement pagination (50 events per page)
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [ ]* 5.2 Write property test for activity event generation targeting correct leagues
    - **Property 4: Activity event generation targets correct leagues**
    - **Validates: Requirements 3.1, 3.3**

  - [ ]* 5.3 Write property test for activity feed ordering
    - **Property 5: Activity feed ordering**
    - **Validates: Requirements 3.2**

  - [~] 5.4 Create activity feed API route
    - Add `GET /api/leagues/:slug/activity` route with page/limit query params
    - Validate page number (return 400 for invalid)
    - Register route
    - _Requirements: 3.1, 3.4_

  - [~] 5.5 Create ActivityFeed page component
    - Create `client/src/pages/ActivityFeed.jsx`
    - Display match result events with score, stage, team owners, and points awarded
    - Display team elimination events with team name, owner, and stage
    - Implement pagination controls (max 50 per page)
    - Implement new event notification indicator with count
    - Display empty state message when no activity exists
    - Add route `/league/:slug/activity` to App.jsx
    - Create `client/src/api/activity.js` API module
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [ ]* 5.6 Write unit tests for activityService
    - Test event generation for match results
    - Test event generation for team eliminations
    - Test pagination boundaries
    - Test league filtering (events only for relevant leagues)
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [~] 6. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Implement My Teams Dashboard (backend + frontend)
  - [-] 7.1 Create myTeamsService.js
    - Create `server/services/myTeamsService.js`
    - Implement `getMyTeamsData(leagueSlug, participantId)` — returns per-team stats grouped by pot
    - Calculate per-team: points (3×win + 1×draw + 1×penalty_bonus), wins, draws, losses, goals scored, goals conceded
    - Calculate form indicator: last 5 results as W/D/L sequence, most recent first
    - Fetch upcoming fixtures within next 7 days for each team
    - Calculate total points summary as sum of all team contributions
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_

  - [ ]* 7.2 Write property test for per-team stats calculation
    - **Property 6: Per-team stats calculation**
    - **Validates: Requirements 4.2**

  - [ ]* 7.3 Write property test for form indicator computation
    - **Property 7: Form indicator computation**
    - **Validates: Requirements 4.4, 4.5**

  - [ ]* 7.4 Write property test for total points invariant
    - **Property 8: Total points invariant**
    - **Validates: Requirements 4.6**

  - [~] 7.5 Create my teams API route
    - Add `GET /api/leagues/:slug/my-teams/:participantId` route
    - Return 404 if league or participant not found
    - Register route
    - _Requirements: 4.1_

  - [~] 7.6 Create MyTeamsDashboard page component
    - Create `client/src/pages/MyTeamsDashboard.jsx`
    - Display teams grouped by pot with pot labels
    - Show per-team stats: points, W/D/L, goals scored/conceded
    - Show form indicator (last 5 results as W/D/L badges)
    - Show upcoming fixtures (next 7 days) per team
    - Display total points summary at top
    - Display empty state for no upcoming fixtures
    - Add route `/league/:slug/my-teams/:participantId` to App.jsx
    - Create `client/src/api/myTeams.js` API module
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_

  - [ ]* 7.7 Write unit tests for myTeamsService
    - Test stats calculation with various result combinations
    - Test form indicator with fewer than 5 matches
    - Test upcoming fixtures filtering
    - Test total points aggregation
    - _Requirements: 4.2, 4.4, 4.5, 4.6_

- [ ] 8. Implement Group Stage Table (backend + frontend)
  - [-] 8.1 Create groupService.js
    - Create `server/services/groupService.js`
    - Implement `getGroupStandings()` — reads groups.json and computes standings from group-stage results
    - Calculate per-team: played, won, drawn, lost, goals for, goals against, goal difference, points
    - Sort teams within each group by: points desc → goal difference desc → goals scored desc
    - Return all 12 groups with 4 teams each, defaulting to 0 values when no results exist
    - _Requirements: 5.1, 5.2, 5.3, 5.6_

  - [ ]* 8.2 Write property test for group standings computation and sorting
    - **Property 9: Group standings computation and sorting**
    - **Validates: Requirements 5.2, 5.3**

  - [~] 8.3 Create groups API route
    - Add `GET /api/groups` route
    - Register route in globalRoutes or a new route file
    - _Requirements: 5.1_

  - [~] 8.4 Create GroupStageTable page component
    - Create `client/src/pages/GroupStageTable.jsx`
    - Display all 12 groups (A–L) with team name and country code
    - Show columns: P, W, D, L, GF, GA, GD, Pts
    - Highlight teams owned by participants in the current league with owner name
    - Display qualification line between positions 2 and 3
    - Show 0 values when no results exist
    - Add route `/league/:slug/groups` to App.jsx
    - Create `client/src/api/groups.js` API module
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

  - [ ]* 8.5 Write unit tests for groupService
    - Test standings calculation with sample results
    - Test sorting tiebreakers (goal difference, goals scored)
    - Test empty results (all zeros)
    - _Requirements: 5.2, 5.3, 5.6_

- [~] 9. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. Implement Share/Export Standings (backend + frontend)
  - [-] 10.1 Create exportService.js
    - Create `server/services/exportService.js`
    - Implement `generateStandingsText(leagueSlug)` — generates plain-text standings summary
    - Format: league name header, date in DD/MM/YYYY format, one line per participant in rank order with rank number, name, and total points
    - _Requirements: 6.1, 6.6_

  - [ ]* 10.2 Write property test for standings text export format
    - **Property 10: Standings text export format**
    - **Validates: Requirements 6.1, 6.6**

  - [~] 10.3 Create standings export API route
    - Add `GET /api/leagues/:slug/standings/export` route returning plain text
    - Register route
    - _Requirements: 6.1_

  - [~] 10.4 Create ShareExportButtons component on standings view
    - Create `client/src/components/ShareExportButtons.jsx`
    - Implement copy-to-clipboard with 3-second confirmation message
    - Implement fallback to selectable read-only textarea if clipboard API unavailable
    - Implement PNG export using `html2canvas` with max width 800px
    - Trigger file download with filename format `standings-{league-slug}-{YYYY-MM-DD}.png`
    - Include league name and date in both text and image headers
    - Integrate buttons into the existing LeagueView standings section
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

  - [ ]* 10.5 Write unit tests for exportService
    - Test text format output structure
    - Test date formatting (DD/MM/YYYY)
    - Test rank ordering in output
    - _Requirements: 6.1, 6.6_

- [ ] 11. Implement Knockout Bracket View (backend + frontend)
  - [-] 11.1 Create bracketService.js
    - Create `server/services/bracketService.js`
    - Implement logic to build bracket structure from knockout-stage results
    - Place winners into next round's corresponding positions
    - Handle penalty shootout winners
    - Mark undetermined positions as "TBD"
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

  - [ ]* 11.2 Write property test for knockout bracket progression
    - **Property 11: Knockout bracket progression**
    - **Validates: Requirements 9.2, 9.3**

  - [~] 11.3 Create bracket API route (or compute client-side from existing data)
    - Expose bracket data via existing fixtures/results endpoints or a dedicated route
    - Ensure knockout fixtures and results are available to the frontend
    - _Requirements: 9.1_

  - [~] 11.4 Create KnockoutBracketView page component
    - Create `client/src/pages/KnockoutBracketView.jsx`
    - Create `client/src/components/KnockoutBracket.jsx` — SVG-based bracket renderer
    - Display all knockout rounds (Round of 32, Round of 16, Quarter-finals, Semi-finals, Final) in columns left to right
    - Draw connector lines between rounds
    - Show team names or "TBD" placeholders
    - Display scores with winning team in bold
    - Display penalty scores in parentheses when applicable
    - Highlight teams owned by league participants with distinct background colour and owner name
    - Make bracket horizontally scrollable on narrow viewports
    - Display empty state when no knockout fixtures exist
    - Add route `/league/:slug/bracket` to App.jsx
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7_

  - [ ]* 11.5 Write unit tests for bracketService
    - Test winner placement into next round
    - Test penalty shootout winner handling
    - Test TBD placeholders for incomplete brackets
    - _Requirements: 9.2, 9.3, 9.4_

- [ ] 12. Wire navigation and final integration
  - [~] 12.1 Add navigation links to all new pages from LeagueView
    - Add links/buttons in LeagueView for: Match Day, Points History, Activity, My Teams, Groups, Bracket
    - Ensure navigation is accessible and consistent with existing UI patterns
    - _Requirements: 1.1, 2.1, 3.1, 4.1, 5.1, 9.1_

  - [x] 12.2 Install frontend dependencies (chart.js, react-chartjs-2, html2canvas)
    - Add `chart.js`, `react-chartjs-2`, and `html2canvas` to client package.json
    - Run install to update lock file
    - _Requirements: 2.1, 6.2_

  - [ ]* 12.3 Write integration tests for new API routes
    - Test all new endpoints with supertest (fixtures/today, fixtures/week, points-history, activity, my-teams, groups, standings/export)
    - Test error responses (404, 400)
    - _Requirements: 1.1, 1.2, 2.1, 3.1, 4.1, 5.1, 6.1_

- [~] 13. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document using `fast-check` (already installed)
- Unit tests validate specific examples and edge cases
- The project uses Vitest for testing (`npm test` runs `vitest --run`)
- Frontend uses React 19 + Vite + React Router; backend uses Express.js with JSON file storage
- Dark mode (task 1.2/1.3) and PWA (task 1.4) are infrastructure tasks that benefit all subsequent features

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.4", "12.2"] },
    { "id": 1, "tasks": ["1.3", "2.1", "4.1", "5.1", "7.1", "8.1", "10.1", "11.1"] },
    { "id": 2, "tasks": ["2.2", "2.3", "2.4", "4.2", "4.3", "5.2", "5.3", "5.4", "7.2", "7.3", "7.4", "7.5", "8.2", "8.3", "10.2", "10.3", "11.2", "11.3"] },
    { "id": 3, "tasks": ["2.5", "2.6", "4.4", "4.5", "5.5", "5.6", "7.6", "7.7", "8.4", "8.5", "10.4", "10.5", "11.4", "11.5"] },
    { "id": 4, "tasks": ["12.1", "12.3"] }
  ]
}
```
