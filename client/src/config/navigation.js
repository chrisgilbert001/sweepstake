import {
  DashboardIcon,
  TournamentIcon,
  LiveIcon,
  StatsIcon,
  MyTeamsIcon,
  DraftIcon,
} from './NavIcons.jsx';

export const NAVIGATION_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: DashboardIcon, path: '', isPrimary: true },
  { id: 'tournament', label: 'Tournament', icon: TournamentIcon, path: 'tournament', isPrimary: true },
  { id: 'live', label: 'Live', icon: LiveIcon, path: 'live', isPrimary: true },
  { id: 'stats', label: 'Stats', icon: StatsIcon, path: 'stats', isPrimary: true },
  { id: 'my-teams', label: 'My Teams', icon: MyTeamsIcon, path: 'my-teams', isPrimary: false },
  { id: 'draft', label: 'Draft', icon: DraftIcon, path: 'draft', isPrimary: false },
];
