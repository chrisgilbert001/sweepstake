# Implementation Plan

## Overview

Modernize the UI/UX of the World Cup Sweepstake app by introducing a persistent App Shell layout with responsive navigation, tabbed content panels, updated design tokens (Inter font, 8px grid, refreshed palette), Card component with elevation variants, and CSS-only animations with prefers-reduced-motion support. Existing page components are preserved but rendered within TabPanels inside the shell rather than as standalone routes.

## Tasks

- [x] 1. Update Design Tokens and Typography
  - [x] 1.1 Add Inter font import (Google Fonts link) to `client/index.html`
  - [x] 1.2 Update `variables.css` with new font-family stack using Inter as primary
  - [x] 1.3 Add 8px grid spacing tokens (`--space-1` through `--space-6`) to `variables.css`
  - [x] 1.4 Add elevation tokens (`--elevation-flat`, `--elevation-raised`, `--elevation-prominent`) to `variables.css`
  - [x] 1.5 Add card styling tokens (`--card-radius`, `--card-padding`, `--card-padding-compact`, `--card-backdrop-blur`)
  - [x] 1.6 Add animation duration tokens (`--duration-instant`, `--duration-fast`, `--duration-normal`, `--duration-slow`)
  - [x] 1.7 Add navigation layout tokens (`--nav-height-desktop`, `--nav-height-mobile`, `--nav-item-min-size`)
  - [x] 1.8 Add content layout tokens (`--content-max-width`, `--content-padding-desktop`, `--content-padding-tablet`, `--content-padding-mobile`)
  - [x] 1.9 Verify all text/background color combinations meet WCAG AA contrast ratios (4.5:1 normal, 3:1 large)
  - [x] 1.10 Add `prefers-reduced-motion` media query that sets all duration tokens to 0ms
- [x] 2. Create Card Component
  - [x] 2.1 Create `src/components/ui/Card.jsx` with `elevation`, `hoverable`, `padding`, `className` props
  - [x] 2.2 Create `src/components/ui/Card.css` with flat, raised, and prominent elevation styles
  - [x] 2.3 Implement hover effect (translateY -2px + elevation bump) with 200ms ease transition
  - [x] 2.4 Implement responsive padding (24px desktop, 16px mobile at 768px breakpoint)
  - [x] 2.5 Add `prefers-reduced-motion` support (disable transform animation, keep shadow change)
- [x] 3. Create TabPanel Component
  - [x] 3.1 Create `src/components/shell/TabPanel.jsx` with `tabs`, `defaultTab`, `preserveScroll`, `animationDirection` props
  - [x] 3.2 Create `src/components/shell/TabPanel.css` with tab control styles and active state indicator
  - [x] 3.3 Implement tab switching logic (client-side state, no route change)
  - [x] 3.4 Implement horizontal slide animation (150ms) with direction based on tab index comparison
  - [x] 3.5 Implement scroll position preservation per tab using refs
  - [x] 3.6 Implement error boundary per tab content with fallback UI (error message + interactive tab controls)
  - [x] 3.7 Add `prefers-reduced-motion` support (instant content swap, no slide)
- [x] 4. Create NavigationBar Component
  - [x] 4.1 Create `src/config/navigation.js` with navigation items configuration
  - [x] 4.2 Create `src/components/shell/NavigationBar.jsx` with `leagueSlug` and `participants` props
  - [x] 4.3 Create `src/components/shell/NavigationBar.css` with desktop (top bar) and mobile (bottom tabs) layouts
  - [x] 4.4 Implement overflow logic: show first 4 items as primary, remaining in "More" menu
  - [x] 4.5 Implement overflow popover (desktop) and slide-up panel (mobile) with dismiss on outside click
  - [x] 4.6 Implement active item highlighting based on current route (using `useLocation`)
  - [x] 4.7 Ensure 44px minimum touch targets on mobile
  - [x] 4.8 Add press feedback (scale 0.96 on mousedown/touchstart, revert on release)
  - [x] 4.9 Add hover/focus background change within 100ms
  - [x] 4.10 Add `prefers-reduced-motion` support for overflow panel animation
- [x] 5. Create AppShell Layout and LeagueContext
  - [x] 5.1 Create `src/context/LeagueContext.jsx` with league, participants, draftStatus, teams, results, loading, error, refetch
  - [x] 5.2 Create `src/components/shell/AppShell.jsx` that fetches league data and provides LeagueContext
  - [x] 5.3 Create `src/components/shell/AppShell.css` with shell layout (header + nav + content area)
  - [x] 5.4 Render league name and current section title in header region
  - [x] 5.5 Move ThemeToggle into the AppShell header region (remove floating placement)
  - [x] 5.6 Implement fade-in transition (200ms opacity) on content area route changes
  - [x] 5.7 Add `prefers-reduced-motion` support (instant content swap)
- [x] 6. Refactor Routing to Nested Structure
  - [x] 6.1 Update `App.jsx` to use nested routes under `/league/:slug` with AppShell as layout element
  - [x] 6.2 Create `src/pages/LeagueDashboard.jsx` as the index route (refactored from LeagueView)
  - [x] 6.3 Create `src/pages/TournamentPanel.jsx` wrapping ScheduleView, GroupStageTable, KnockoutBracketView in TabPanel
  - [x] 6.4 Create `src/pages/LivePanel.jsx` wrapping MatchDayView and ActivityFeed in TabPanel
  - [x] 6.5 Create `src/pages/StatsPanel.jsx` wrapping PointsTimeline and StandingsTable in TabPanel
  - [x] 6.6 Create `src/pages/MyTeamsView.jsx` with participant selector and MyTeamsDashboard rendering
  - [x] 6.7 Remove standalone navigation links and back-links from existing page components (ScheduleView, MatchDayView, ActivityFeed, etc.)
  - [x] 6.8 Update existing page components to consume LeagueContext instead of fetching league data independently
  - [x] 6.9 Ensure DraftSession renders within the shell
- [x] 7. Refactor LeagueDashboard
  - [x] 7.1 Extract standings computation, participant management, and draft actions from LeagueView into LeagueDashboard
  - [x] 7.2 Use LeagueContext for league data instead of local fetch
  - [x] 7.3 Wrap standings table in Card with prominent elevation
  - [x] 7.4 Wrap add-participant section in Card with flat elevation
  - [x] 7.5 Add points summary widget (rank + total points) in dashboard header when draft is completed
  - [x] 7.6 Implement 30s polling for points summary updates
  - [x] 7.7 Hide points summary widget when draft status is not "completed"
  - [x] 7.8 Apply 24px spacing between Card sections
- [x] 8. Update Global Styles and Responsive Layout
  - [x] 8.1 Update `global.css` to use new spacing tokens and font-family
  - [x] 8.2 Implement responsive content area: max-width 1200px centered with 32px padding above 1024px
  - [x] 8.3 Implement tablet layout: single column with 16px padding between 768px-1024px
  - [x] 8.4 Implement mobile layout: stacked vertical with 16px padding at/below 768px
  - [x] 8.5 Ensure CSS Grid/Flexbox for all layout (no fixed pixel widths on content containers)
  - [x] 8.6 Verify no horizontal scrollbar on viewport resize
  - [x] 8.7 Ensure 44px minimum interactive element size on mobile
  - [x] 8.8 Add theme transition (background-color, color) between 200-350ms with ease timing
- [x] 9. Property-Based Tests
  - [x] 9.1 Install `fast-check` as a dev dependency
  - [x] 9.2 Write property test for navigation item overflow partitioning (Property 1)
  - [x] 9.3 Write property test for tab switching content/active state correctness (Property 2)
  - [x] 9.4 Write property test for tab scroll position round-trip (Property 3)
  - [x] 9.5 Write property test for theme color contrast WCAG AA compliance (Property 4)
  - [x] 9.6 Write property test for tab slide animation direction (Property 5)
  - [x] 9.7 Write property test for reduced-motion disabling all timed transitions (Property 6)
  - [x] 9.8 Write property test for animation duration ceiling of 300ms (Property 7)
- [x] 10. Integration Tests and Cleanup
  - [x] 10.1 Write integration test: full navigation flow through shell (navigate all sections, verify shell persistence)
  - [x] 10.2 Write integration test: tab panel interaction (switch tabs, verify content, verify scroll)
  - [x] 10.3 Write integration test: theme toggle persists and applies without flash
  - [x] 10.4 Write integration test: responsive layout transitions at breakpoints
  - [x] 10.5 Remove old `LeagueView.jsx` and its CSS (replaced by LeagueDashboard + AppShell)
  - [x] 10.6 Remove standalone route definitions for schedule, groups, bracket, activity, match-day, points-history, my-teams from App.jsx
  - [x] 10.7 Update any remaining imports or references to old route structure
  - [x] 10.8 Verify build completes without errors

## Task Dependency Graph

```json
{
  "waves": [
    {
      "wave": 1,
      "tasks": [1],
      "description": "Foundation: design tokens and typography"
    },
    {
      "wave": 2,
      "tasks": [2, 3, 4, 8],
      "description": "Core UI components (Card, TabPanel, NavigationBar) and global styles - all depend on design tokens"
    },
    {
      "wave": 3,
      "tasks": [5],
      "description": "AppShell layout and LeagueContext - depends on NavigationBar and global styles"
    },
    {
      "wave": 4,
      "tasks": [6],
      "description": "Routing refactor - depends on AppShell, TabPanel, and all UI components"
    },
    {
      "wave": 5,
      "tasks": [7],
      "description": "LeagueDashboard refactor - depends on routing structure and Card component"
    },
    {
      "wave": 6,
      "tasks": [9],
      "description": "Property-based tests - depends on all components being implemented"
    },
    {
      "wave": 7,
      "tasks": [10],
      "description": "Integration tests and cleanup - final verification and removal of old code"
    }
  ]
}
```

## Notes

- Existing page components (ScheduleView, GroupStageTable, KnockoutBracketView, MatchDayView, ActivityFeed, MyTeamsDashboard, PointsTimeline) are preserved as components but rendered within TabPanels inside the shell rather than as standalone routes.
- The Inter font is loaded via Google Fonts CDN link in index.html for simplicity (no build-time font bundling needed).
- All animations use CSS-only transitions (no JS animation libraries) to keep the bundle lean.
- The `fast-check` library is used for property-based testing, compatible with the existing Vite test setup.
- The old `LeagueView.jsx` is replaced by `LeagueDashboard.jsx` + `AppShell.jsx` — the cleanup task (10.5) removes it after the new structure is verified working.
