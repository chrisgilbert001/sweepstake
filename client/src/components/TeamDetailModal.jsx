import { useEffect, useCallback } from 'react';
import './TeamDetailModal.css';

/**
 * TeamDetailModal displays all matches played by a selected team.
 *
 * Props:
 * - teamId: string - the selected team ID
 * - teamName: string - the display name of the team
 * - results: Array of match result objects
 * - matchOdds: Object mapping fixtureId -> { teamId: odds, ... }
 * - teams: Array of { id, name } for looking up team names
 * - onClose: function - called when modal should close
 */
export default function TeamDetailModal({
  teamId,
  teamName,
  results = [],
  matchOdds = {},
  teams = [],
  onClose,
}) {
  const teamNameMap = {};
  for (const team of teams) {
    teamNameMap[team.id] = team.name;
  }

  // Filter and sort matches for this team
  const teamMatches = results
    .filter((r) => r.homeTeam === teamId || r.awayTeam === teamId)
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  // Calculate total points for this team
  let totalPoints = 0;
  for (const match of teamMatches) {
    totalPoints += getMatchPoints(match, teamId);
  }

  function getMatchPoints(match, tid) {
    const isHome = match.homeTeam === tid;
    const teamScore = isHome ? match.homeScore : match.awayScore;
    const opponentScore = isHome ? match.awayScore : match.homeScore;

    if (teamScore > opponentScore) return 3;
    if (teamScore === opponentScore) {
      if (match.penaltyShootout?.winner === tid) return 2;
      return 1;
    }
    return 0;
  }

  function getOutcome(match, tid) {
    const isHome = match.homeTeam === tid;
    const teamScore = isHome ? match.homeScore : match.awayScore;
    const opponentScore = isHome ? match.awayScore : match.homeScore;

    if (teamScore > opponentScore) return 'win';
    if (teamScore < opponentScore) return 'loss';
    if (match.penaltyShootout) {
      return match.penaltyShootout.winner === tid ? 'penalty-win' : 'penalty-loss';
    }
    return 'draw';
  }

  const OUTCOME_LABELS = {
    win: 'Win',
    loss: 'Loss',
    draw: 'Draw',
    'penalty-win': 'Won on pens',
    'penalty-loss': 'Lost on pens',
  };

  function getOpponent(match, tid) {
    return match.homeTeam === tid ? match.awayTeam : match.homeTeam;
  }

  function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  // Close on Escape key
  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Escape') {
        onClose?.();
      }
    },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    // Prevent body scroll while modal is open
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [handleKeyDown]);

  // Close on backdrop click
  function handleOverlayClick(e) {
    if (e.target === e.currentTarget) {
      onClose?.();
    }
  }

  return (
    <div
      className="modal-overlay"
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="team-modal-title"
    >
      <div className="modal-content">
        <div className="modal-header">
          <h2 id="team-modal-title">{teamName}</h2>
          <button
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        <div className="modal-body">
          <div className="modal-total-points">
            <span className="modal-total-points-label">Total Points</span>
            <span className="modal-total-points-value">{totalPoints}</span>
          </div>

          {teamMatches.length === 0 ? (
            <p className="no-matches-message">No matches played</p>
          ) : (
            <div className="match-list">
              {teamMatches.map((match) => {
                const opponentId = getOpponent(match, teamId);
                const opponentName = teamNameMap[opponentId] || opponentId;
                const outcome = getOutcome(match, teamId);
                const points = getMatchPoints(match, teamId);
                const odds = matchOdds[match.fixtureId];

                return (
                  <div key={match.id} className="match-card">
                    <div className="match-card-header">
                      <span className="match-stage">{match.stage}</span>
                      <span className="match-date">{formatDate(match.date)}</span>
                    </div>

                    <div className="match-score-row">
                      <span className={`match-team-name home ${match.homeTeam === teamId ? '' : 'opponent'}`}>
                        {teamNameMap[match.homeTeam] || match.homeTeam}
                      </span>
                      <span className="match-score">
                        {match.homeScore} – {match.awayScore}
                      </span>
                      <span className={`match-team-name away ${match.awayTeam === teamId ? '' : 'opponent'}`}>
                        {teamNameMap[match.awayTeam] || match.awayTeam}
                      </span>
                    </div>

                    {match.penaltyShootout && (
                      <p className="penalty-info">
                        Penalties: {teamNameMap[match.penaltyShootout.winner] || match.penaltyShootout.winner} wins
                        ({match.penaltyShootout.homeGoals}–{match.penaltyShootout.awayGoals})
                      </p>
                    )}

                    <div className="match-footer">
                      <span className={`match-outcome ${outcome}`}>
                        {OUTCOME_LABELS[outcome]}
                      </span>
                      <span className="match-points">+{points} pts</span>
                    </div>

                    {odds && (
                      <p className="match-odds-info">
                        Odds: {teamName} {odds[teamId]?.toFixed(2) || '—'} | {opponentName} {odds[opponentId]?.toFixed(2) || '—'}
                        {odds.draw != null && ` | Draw ${odds.draw.toFixed(2)}`}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
