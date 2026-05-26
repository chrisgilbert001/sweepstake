---
inclusion: fileMatch
fileMatchPattern: "client/src/**"
---

# Frontend Architecture

## Tech Stack

- React 19.1 with Vite 6.3
- React Router DOM 7.6 (nested routes)
- Chart.js + react-chartjs-2 for charts
- html2canvas for image export
- PWA with service worker

## Routing Structure

```
/                       → HomePage (create/join league)
/admin                  → AdminPanel (fixture/result management)
/join/:joinCode         → JoinPage (join via link)
/league/:slug           → AppShell (layout with nav tabs)
  /league/:slug         → LeagueDashboard (standings, add participants)
  /league/:slug/tournament → TournamentPanel (groups + knockout bracket)
  /league/:slug/live    → LivePanel (match day view)
  /league/:slug/stats   → StatsPanel (points timeline, activity)
  /league/:slug/my-teams → MyTeamsView (participant's team details)
  /league/:slug/draft   → DraftSession (wheel spinner draft)
```

## State Management

Two React Contexts:

### LeagueContext
- Wraps all `/league/:slug/*` routes inside `AppShell`
- Provides: `league`, `participants`, `draftStatus`, `teams`, `results`, `loading`, `error`, `refetch`
- Polls every 30 seconds for fresh data
- Access via `useLeague()` hook

### ThemeContext
- Wraps entire app
- Manages light/dark theme toggle
- Persists preference to localStorage
- Access via `useTheme()` hook

## Component Organization

```
components/
├── shell/          → AppShell layout, NavigationBar, TabPanel
├── admin/          → Admin-only forms (FixtureForm, MatchResultForm, OddsEntryForm)
├── ui/             → Reusable primitives (Card)
├── StandingsTable  → League standings with sorting and detail popup
├── KnockoutBracket → Tournament bracket visualization
├── WheelSpinner    → Draft wheel animation
├── CountdownTimer  → Match countdown
├── ThemeToggle     → Dark/light switch
├── ShareExportButtons → Share/export standings
├── TeamDetailModal → Team match history popup
└── OfflineBanner   → PWA offline indicator
```

## API Layer

All API calls use the shared client (`api/client.js`):

```js
import { get, post } from './client.js';

export function getLeague(slug) {
  return get(`/leagues/${slug}`);
}

export function addParticipant(slug, name) {
  return post(`/leagues/${slug}/participants`, { name });
}
```

## Design System

Use CSS custom properties from `styles/variables.css`:
- Colors: `--color-primary`, `--color-bg`, `--color-text`, etc.
- Spacing: `--space-sm` through `--space-3xl` (or 8px grid: `--space-1` through `--space-6`)
- Typography: `--font-size-xs` through `--font-size-4xl`
- Elevation: `--elevation-flat`, `--elevation-raised`, `--elevation-prominent`
- Border radius: `--radius-sm`, `--radius-md`, `--radius-lg`, `--radius-full`
- Transitions: `--transition-fast`, `--transition-normal`, `--transition-slow`

Always use these variables rather than hardcoded values. All color combinations must meet WCAG AA contrast (4.5:1 minimum).
