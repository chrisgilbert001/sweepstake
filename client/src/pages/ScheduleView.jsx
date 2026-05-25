import { useState, useEffect, useCallback } from 'react';
import { useLeague } from '../context/LeagueContext.jsx';
import { getFixtures } from '../api/fixtures.js';
import './ScheduleView.css';

export default function ScheduleView() {
  const { league, results, teams, loading: leagueLoading } = useLeague();

  const [fixtures, setFixtures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const fixturesData = await getFixtures();
      setFixtures(Array.isArray(fixturesData) ? fixturesData : (fixturesData.fixtures || []));
      setError(null);
    } catch (err) {
      setError(err.message || 'Failed to load schedule');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Build a map of teamId -> team name
  function getTeamName(teamId) {
    const team = teams.find((t) => t.id === teamId);
    return team ? team.name : teamId;
  }

  // Build a map of teamId -> participant name (for this league)
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

  // Build a map of fixtureId -> result
  function getResultsMap() {
    const map = {};
    for (const result of results) {
      map[result.fixtureId] = result;
    }
    return map;
  }

  // Merge fixtures with results and sort by date ascending
  function getMergedFixtures() {
    const resultsMap = getResultsMap();

    const merged = fixtures.map((fixture) => {
      const result = resultsMap[fixture.id];
      return {
        ...fixture,
        result: result || null,
      };
    });

    // Sort by date ascending
    merged.sort((a, b) => new Date(a.date) - new Date(b.date));

    return merged;
  }

  // Check if a fixture involves any of the league's participants' teams
  function isHighlighted(fixture, ownerMap) {
    return !!(ownerMap[fixture.homeTeam] || ownerMap[fixture.awayTeam]);
  }

  // Check if all fixtures have results
  function allMatchesCompleted() {
    if (fixtures.length === 0) return false;
    const resultsMap = getResultsMap();
    return fixtures.every((f) => resultsMap[f.id]);
  }

  function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
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
      <div className="container schedule-loading">
        <p>Loading schedule...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container schedule-error">
        <h2>Error</h2>
        <p>{error}</p>
      </div>
    );
  }

  const ownerMap = getOwnerMap();
  const mergedFixtures = getMergedFixtures();
  const completed = allMatchesCompleted();

  return (
    <div className="container schedule-view">
      <div className="schedule-header">
        <h1>Match Schedule</h1>
      </div>

      {completed && fixtures.length > 0 && (
        <div className="all-completed-banner">
          <span className="completed-icon">🏆</span>
          <span>All matches completed</span>
        </div>
      )}

      {fixtures.length === 0 && (
        <div className="no-fixtures">
          <p>No fixtures have been scheduled yet.</p>
        </div>
      )}

      <div className="fixtures-list">
        {mergedFixtures.map((fixture) => {
          const highlighted = isHighlighted(fixture, ownerMap);
          const hasResult = !!fixture.result;

          return (
            <div
              key={fixture.id}
              className={`fixture-card ${highlighted ? 'fixture-highlighted' : ''} ${hasResult ? 'fixture-completed' : 'fixture-scheduled'}`}
            >
              <div className="fixture-meta">
                <span className="fixture-stage">{fixture.stage}</span>
                <span className={`fixture-status-badge ${hasResult ? 'status-completed' : 'status-scheduled'}`}>
                  {hasResult ? 'FT' : 'Upcoming'}
                </span>
                <span className="fixture-datetime">
                  {formatDate(fixture.date)} · {formatTime(fixture.date)}
                </span>
              </div>

              <div className="fixture-teams">
                <div className="fixture-team fixture-team-home">
                  <span className="team-name">{getTeamName(fixture.homeTeam)}</span>
                  {ownerMap[fixture.homeTeam] && (
                    <span className="team-owner">{ownerMap[fixture.homeTeam]}</span>
                  )}
                </div>

                <div className="fixture-score">
                  {hasResult ? (
                    <span className="score-display">
                      {fixture.result.homeScore} – {fixture.result.awayScore}
                      {fixture.result.penaltyShootout && (
                        <span className="penalty-indicator" title={`Penalties: ${fixture.result.penaltyShootout.homeGoals}–${fixture.result.penaltyShootout.awayGoals}`}>
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
                  {ownerMap[fixture.awayTeam] && (
                    <span className="team-owner">{ownerMap[fixture.awayTeam]}</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
