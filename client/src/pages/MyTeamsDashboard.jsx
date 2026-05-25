import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { getMyTeams } from '../api/myTeams.js';
import './MyTeamsDashboard.css';

export default function MyTeamsDashboard({ participantId: propParticipantId }) {
  const { slug, participantId: routeParticipantId } = useParams();
  const participantId = propParticipantId || routeParticipantId;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const result = await getMyTeams(slug, participantId);
      setData(result);
      setError(null);
    } catch (err) {
      setError(err.message || 'Failed to load my teams');
    } finally {
      setLoading(false);
    }
  }, [slug, participantId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="container my-teams-loading">
        <p>Loading your teams...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container my-teams-error">
        <h2>Error</h2>
        <p>{error}</p>
      </div>
    );
  }

  if (!data) return null;

  const { totalPoints, teams } = data;

  // Group teams by pot
  const teamsByPot = teams.reduce((acc, team) => {
    const pot = team.pot;
    if (!acc[pot]) acc[pot] = [];
    acc[pot].push(team);
    return acc;
  }, {});

  const sortedPots = Object.keys(teamsByPot).sort((a, b) => Number(a) - Number(b));

  // Check if any team has upcoming fixtures
  const hasUpcomingFixtures = teams.some(
    (team) => team.upcomingFixtures && team.upcomingFixtures.length > 0
  );

  return (
    <div className="container my-teams-dashboard">
      <div className="my-teams-header">
        <h1>My Teams</h1>
      </div>

      <div className="total-points-summary">
        <span className="total-points-label">Total Points</span>
        <span className="total-points-value">{totalPoints}</span>
      </div>

      {sortedPots.map((pot) => (
        <div key={pot} className="pot-group">
          <h2 className="pot-label">Pot {pot}</h2>
          <div className="pot-teams">
            {teamsByPot[pot].map((team) => (
              <TeamCard key={team.teamId} team={team} />
            ))}
          </div>
        </div>
      ))}

      {!hasUpcomingFixtures && (
        <div className="no-fixtures-message">
          <p>No upcoming fixtures scheduled</p>
        </div>
      )}
    </div>
  );
}

function TeamCard({ team }) {
  return (
    <div className="team-card">
      <div className="team-card-header">
        <h3 className="team-name">{team.teamName}</h3>
        <span className="team-points">{team.points} pts</span>
      </div>

      <div className="team-stats">
        <div className="stat-row">
          <span className="stat-label">Record</span>
          <span className="stat-value">
            {team.wins}W / {team.draws}D / {team.losses}L
          </span>
        </div>
        <div className="stat-row">
          <span className="stat-label">Goals</span>
          <span className="stat-value">
            {team.goalsScored} scored / {team.goalsConceded} conceded
          </span>
        </div>
      </div>

      {team.form && team.form.length > 0 && (
        <div className="team-form">
          <span className="form-label">Form</span>
          <div className="form-badges">
            {team.form.map((result, idx) => (
              <span
                key={idx}
                className={`form-badge form-badge-${result.toLowerCase()}`}
                aria-label={result === 'W' ? 'Win' : result === 'D' ? 'Draw' : 'Loss'}
              >
                {result}
              </span>
            ))}
          </div>
        </div>
      )}

      {team.upcomingFixtures && team.upcomingFixtures.length > 0 && (
        <div className="team-upcoming">
          <span className="upcoming-label">Upcoming (next 7 days)</span>
          <ul className="upcoming-list">
            {team.upcomingFixtures.map((fixture, idx) => (
              <li key={idx} className="upcoming-fixture">
                <span className="fixture-opponent">vs {fixture.opponentName}</span>
                <span className="fixture-date">
                  {new Date(fixture.date).toLocaleDateString(undefined, {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
                <span className="fixture-stage">{fixture.stage}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
