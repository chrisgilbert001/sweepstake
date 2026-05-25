import { useState, useEffect } from 'react';
import { getFixtures } from '../api/fixtures.js';
import { getResults } from '../api/results.js';
import { getTeams } from '../api/teams.js';
import MatchResultForm from '../components/admin/MatchResultForm.jsx';
import OddsEntryForm from '../components/admin/OddsEntryForm.jsx';
import FixtureForm from '../components/admin/FixtureForm.jsx';
import './AdminPanel.css';

const TABS = [
  { id: 'results', label: 'Match Results' },
  { id: 'fixtures', label: 'Fixtures' },
  { id: 'tournament-odds', label: 'Tournament Odds' },
  { id: 'match-odds', label: 'Match Odds' },
];

const TOKEN_KEY = 'admin_token';

function AdminPanel() {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || '');
  const [activeTab, setActiveTab] = useState('results');
  const [teams, setTeams] = useState([]);
  const [fixtures, setFixtures] = useState([]);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    localStorage.setItem(TOKEN_KEY, token);
  }, [token]);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [teamsData, fixturesData, resultsData] = await Promise.all([
          getTeams(),
          getFixtures(),
          getResults(),
        ]);
        const allTeams = teamsData.pots
          ? teamsData.pots.flatMap(pot => pot.teams)
          : [];
        setTeams(allTeams);
        setFixtures(Array.isArray(fixturesData) ? fixturesData : (fixturesData.fixtures || []));
        setResults(Array.isArray(resultsData) ? resultsData : (resultsData.results || []));
      } catch {
        // Silently handle load errors — admin can still enter data
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  function refreshData() {
    Promise.all([getFixtures(), getResults()])
      .then(([fixturesData, resultsData]) => {
        setFixtures(Array.isArray(fixturesData) ? fixturesData : (fixturesData.fixtures || []));
        setResults(Array.isArray(resultsData) ? resultsData : (resultsData.results || []));
      })
      .catch(() => {});
  }

  const fixturesWithoutResults = fixtures.filter(fixture => {
    return !results.some(r => r.fixtureId === fixture.id);
  });

  function renderTabContent() {
    switch (activeTab) {
      case 'results':
        return (
          <div>
            <MatchResultForm token={token} teams={teams} fixtures={fixtures} results={results} onSuccess={refreshData} />
            {fixturesWithoutResults.length > 0 && (
              <div className="admin-fixtures-list">
                <h3>Fixtures Without Results</h3>
                <ul className="fixtures-without-results">
                  {fixturesWithoutResults.map(fixture => {
                    const homeTeam = teams.find(t => t.id === fixture.homeTeam);
                    const awayTeam = teams.find(t => t.id === fixture.awayTeam);
                    return (
                      <li key={fixture.id} className="fixture-item">
                        <span className="fixture-item-teams">
                          {homeTeam?.name || fixture.homeTeam} vs {awayTeam?.name || fixture.awayTeam}
                        </span>
                        <span className="fixture-item-meta">
                          {fixture.stage} — {new Date(fixture.date).toLocaleDateString()}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            {!loading && fixturesWithoutResults.length === 0 && fixtures.length > 0 && (
              <p className="no-fixtures-message">All fixtures have results recorded.</p>
            )}
          </div>
        );
      case 'fixtures':
        return <FixtureForm token={token} teams={teams} fixtures={fixtures} onSuccess={refreshData} />;
      case 'tournament-odds':
        return <OddsEntryForm token={token} teams={teams} mode="tournament" fixtures={fixtures} />;
      case 'match-odds':
        return <OddsEntryForm token={token} teams={teams} mode="match" fixtures={fixtures} />;
      default:
        return null;
    }
  }

  return (
    <div className="admin-panel">
      <h1>Admin Panel</h1>

      <div className="admin-token-section">
        <label htmlFor="admin-token">Admin Token</label>
        <input
          id="admin-token"
          type="password"
          className="admin-token-input"
          placeholder="Enter admin token"
          value={token}
          onChange={e => setToken(e.target.value)}
          autoComplete="off"
        />
      </div>

      <nav className="admin-tabs" role="tablist" aria-label="Admin sections">
        {TABS.map(tab => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`admin-tab${activeTab === tab.id ? ' active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div className="admin-tab-content" role="tabpanel">
        {loading ? <p>Loading data...</p> : renderTabContent()}
      </div>
    </div>
  );
}

export default AdminPanel;
