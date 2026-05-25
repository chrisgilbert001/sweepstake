import { Outlet, useParams, useLocation } from 'react-router-dom';
import { LeagueProvider, useLeague } from '../../context/LeagueContext.jsx';
import NavigationBar from './NavigationBar.jsx';
import ThemeToggle from '../ThemeToggle.jsx';
import './AppShell.css';

/**
 * Maps route path segments to section titles.
 */
const SECTION_TITLES = {
  '': 'Dashboard',
  tournament: 'Tournament',
  live: 'Live',
  stats: 'Stats',
  'my-teams': 'My Teams',
  draft: 'Draft',
};

/**
 * Determines the current section title from the location pathname.
 */
function getSectionTitle(pathname, slug) {
  const basePath = `/league/${slug}`;
  const relativePath = pathname.startsWith(basePath)
    ? pathname.slice(basePath.length).replace(/^\//, '')
    : '';

  // Match the first segment of the relative path
  const firstSegment = relativePath.split('/')[0] || '';
  return SECTION_TITLES[firstSegment] || 'Dashboard';
}

/**
 * Inner shell content that consumes LeagueContext.
 * Separated so it can be rendered inside the LeagueProvider.
 */
function AppShellContent() {
  const { slug } = useParams();
  const location = useLocation();
  const { league, participants, loading } = useLeague();

  const sectionTitle = getSectionTitle(location.pathname, slug);
  const leagueName = league?.name || '';

  return (
    <div className="app-shell">
      <header className="app-shell__header">
        <div className="app-shell__header-info">
          {loading ? (
            <h1 className="app-shell__league-name">Loading...</h1>
          ) : (
            <>
              <h1 className="app-shell__league-name">{leagueName}</h1>
              <p className="app-shell__section-title">{sectionTitle}</p>
            </>
          )}
        </div>
        <div className="app-shell__header-actions">
          <ThemeToggle />
        </div>
      </header>

      <NavigationBar leagueSlug={slug} participants={participants} />

      <main className="app-shell__content" key={location.pathname}>
        <Outlet />
      </main>
    </div>
  );
}

/**
 * AppShell — persistent layout wrapper for all league routes.
 * Wraps content in LeagueProvider for shared data access.
 */
export default function AppShell() {
  return (
    <LeagueProvider>
      <AppShellContent />
    </LeagueProvider>
  );
}
