import { useState } from 'react';
import { markDraftSeen } from '../api/leagues.js';
import './DraftRevealDialog.css';

/**
 * DraftRevealDialog — shows the user their drafted teams pot by pot (4→1)
 * on their first visit after the draft completes.
 * Tracked server-side via `draftSeen` flag on the participant.
 *
 * @param {string} props.slug - League slug
 * @param {object} props.allocations - Draft allocations keyed by participant ID
 * @param {string} props.participantId - Current user's participant ID
 * @param {string} props.email - Current user's email (for marking as seen)
 * @param {Array} props.teams - All teams (flat array with id, name)
 * @param {Function} props.onClose - Called when the user dismisses the dialog
 */
export default function DraftRevealDialog({ slug, allocations, participantId, email, teams, onClose }) {
  const [currentPot, setCurrentPot] = useState(4);
  const [revealed, setRevealed] = useState(false);

  function handleClose() {
    // Mark as seen on the server (fire and forget)
    markDraftSeen(slug, email).catch(() => {});
    onClose();
  }

  function getTeamName(teamId) {
    const team = teams.find(t => t.id === teamId);
    return team ? team.name : teamId;
  }

  const myAllocations = allocations[participantId] || {};
  const potTeams = myAllocations[`pot${currentPot}`] || [];

  function handleNext() {
    if (currentPot > 1) {
      setCurrentPot(currentPot - 1);
      setRevealed(false);
    } else {
      handleClose();
    }
  }

  function handleReveal() {
    setRevealed(true);
  }

  return (
    <div className="draft-reveal-overlay" role="dialog" aria-modal="true" aria-label="Your draft results">
      <div className="draft-reveal-card">
        <h2 className="draft-reveal-title">Your Teams</h2>
        <p className="draft-reveal-subtitle">Pot {currentPot}</p>

        <div className="draft-reveal-teams">
          {!revealed ? (
            <button className="draft-reveal-btn" onClick={handleReveal}>
              🎉 Reveal Pot {currentPot}
            </button>
          ) : (
            <div className="draft-reveal-team-list">
              {potTeams.map((teamId) => (
                <div key={teamId} className="draft-reveal-team">
                  {getTeamName(teamId)}
                </div>
              ))}
            </div>
          )}
        </div>

        {revealed && (
          <button className="draft-reveal-next" onClick={handleNext}>
            {currentPot > 1 ? `Next: Pot ${currentPot - 1} →` : 'Done'}
          </button>
        )}

        <button className="draft-reveal-skip" onClick={handleClose} type="button">
          Skip
        </button>
      </div>
    </div>
  );
}
