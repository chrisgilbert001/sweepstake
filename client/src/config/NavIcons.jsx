/*
 * Crisp inline line-icons for the navigation bar.
 * Each scales with the surrounding font-size (width/height: 1em) and inherits
 * the nav item's colour via `currentColor`, so they pick up hover/active states.
 */

const base = {
  width: '1em',
  height: '1em',
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.85,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  focusable: false,
};

export function DashboardIcon() {
  return (
    <svg {...base}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5" />
      <path d="M9.5 21v-6h5v6" />
    </svg>
  );
}

export function TournamentIcon() {
  return (
    <svg {...base}>
      <path d="M7 4h10v4a5 5 0 0 1-10 0V4Z" />
      <path d="M7 5H4v2a3 3 0 0 0 3 3" />
      <path d="M17 5h3v2a3 3 0 0 1-3 3" />
      <path d="M12 13v4" />
      <path d="M8.5 21h7l-.8-3a1 1 0 0 0-1-.8h-3.4a1 1 0 0 0-1 .8l-.8 3Z" />
    </svg>
  );
}

export function LiveIcon() {
  return (
    <svg {...base}>
      <circle cx="12" cy="12" r="2.4" />
      <path d="M6.5 7.5a7 7 0 0 0 0 9" />
      <path d="M17.5 7.5a7 7 0 0 1 0 9" />
      <path d="M3.8 4.8a11 11 0 0 0 0 14.4" />
      <path d="M20.2 4.8a11 11 0 0 1 0 14.4" />
    </svg>
  );
}

export function StatsIcon() {
  return (
    <svg {...base}>
      <path d="M4 19V5" />
      <path d="M4 19h16" />
      <path d="m7 14 3.5-3.8L14 13l4-5" />
    </svg>
  );
}

export function MyTeamsIcon() {
  return (
    <svg {...base}>
      <circle cx="12" cy="8" r="3.6" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </svg>
  );
}

export function DraftIcon() {
  return (
    <svg {...base}>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  );
}
