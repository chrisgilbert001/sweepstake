import { useState, useEffect, useCallback, useRef } from 'react';
import { useLeague } from '../context/LeagueContext.jsx';
import { getFixturesToday, getFixturesWeek } from '../api/matchDay.js';
import CountdownTimer from '../components/CountdownTimer.jsx';
import './MatchDayView.css';

const POLL_INTERVAL = 60000; // 60 seconds

export default function MatchDayView() {
  const { league, teams, loading: leagueLoading } = useLeague();

  const [view, setView] = useState('daily'); // 'daily' | 'weekly'
  const [fixtures, setFixtures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const pollRef = useRef(null);

  const fetchFixtures = useCallback(async () => {
    try {
      const data = view === 'daily'
        ? await getFixturesToday()
        : await getFixturesWeek();
      setFixtures(Array.isArray(data) ? data : []);
      setError(null);
    } catch (err) {
      setError(err.message || 'Failed to load fixtures');
    }
  }, [view]);

  // Initial load
  useEffect(() => {
    async function init() {
      setLoading(true);
      await fetchFixtures();
      setLoading(false);
    }
    init();
  }, [fetchFixtures]);

  // Polling for live score updates every 60 seconds
  useEffect(() => {
    pollRef.current = setInterval(() => {
      fetchFixtures();
    }, POLL_INTERVAL);

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
      }
    };
  }, [fetchFixtures]);

  function getTeamName(teamId) {
    const team = teams.find((t) => t.id === teamId);
    return team ? team.name : teamId;
  }

  function getOwnerMap() {
    const ownerMap = {};
    if (!league || !league.draft?.allocations || !league.participants) {
      return ownerMap;
    }

    for (const participant of league.participants) {
      const allocations = league.draft.allocations[participant.id];
      if (!allocations) continue;
      const participantTeams = Object.values(allocations).flat();
      for (const teamId of participantTeams) {
        ownerMap[teamId] = participant.name;
      }
    }

    return ownerMap;
  }

  function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  }

  function formatTime(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  if (loading || leagueLoading) {
    return (
      <div className="container matchday-loading">
        <p>Loading match day...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container matchday-error">
        <h2>Error</h2>
        <p>{error}</p>
      </div>
    );
  }

  const ownerMap = getOwnerMap();

  return (
    <div className="container matchday-view">
      <div className="matchday-header">
        <h1>Match Day</h1>
      </div>

      <div className="matchday-toggle">
        <button
          className={`toggle-btn ${view === 'daily' ? 'toggle-active' : ''}`}
          onClick={() => setView('daily')}
          aria-pressed={view === 'daily'}
        >
          Today
        </button>
        <button
          className={`toggle-btn ${view === 'weekly' ? 'toggle-active' : ''}`}
          onClick={() => setView('weekly')}
          aria-pressed={view === 'weekly'}
        >
          This Week
        </button>
      </div>

      {fixtures.length === 0 ? (
        <div className="matchday-empty">
          <p>No matches scheduled{view === 'daily' ? ' for today' : ' this week'}.</p>
        </div>
      ) : (
        <div className="matchday-fixtures">
          {fixtures.map((fixture) => {
            const isCompleted = fixture.status === 'completed';
            const homeOwner = ownerMap[fixture.homeTeam];
            const awayOwner = ownerMap[fixture.awayTeam];
            const highlighted = !!(homeOwner || awayOwner);

            return (
              <div
                key={fixture.id}
                className={`fixture-card ${highlighted ? 'fixture-highlighted' : ''} ${isCompleted ? 'fixture-completed' : 'fixture-scheduled'}`}
              >
                <div className="fixture-meta">
                  <span className="fixture-stage">{fixture.stage}</span>
                  <CountdownTimer kickoffTime={fixture.date} status={fixture.status} />
                  <span className="fixture-datetime">
                    {formatDate(fixture.date)} · {formatTime(fixture.date)}
                  </span>
                </div>

                <div className="fixture-teams">
                  <div className="fixture-team fixture-team-home">
                    <span className="team-name">{getTeamName(fixture.homeTeam)}</span>
                    {homeOwner && (
                      <span className="team-owner">{homeOwner}</span>
                    )}
                  </div>

                  <div className="fixture-score">
                    {isCompleted ? (
                      <span className="score-display">
                        {fixture.homeScore} – {fixture.awayScore}
                        {fixture.penaltyShootout && (
                          <span className="penalty-indicator" title={`Penalties: ${fixture.penaltyShootout.homeGoals}–${fixture.penaltyShootout.awayGoals}`}>
                            (pen)
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="vs-label">vs</span>
                    )}
                  </div>

                  <div className="fixture-team fixture-team-away">
                    <span className="team-name">{getTeamName(fixture.awayTeam)}</span>
                    {awayOwner && (
                      <span className="team-owner">{awayOwner}</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
