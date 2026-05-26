import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { getDraftState, spinWheel, startDraft } from '../api/draft.js';
import { getLeague } from '../api/leagues.js';
import { getTeams } from '../api/teams.js';
import WheelSpinner from '../components/WheelSpinner.jsx';
import './DraftSession.css';

export default function DraftSession() {
  const { slug } = useParams();

  const [league, setLeague] = useState(null);
  const [draftState, setDraftState] = useState(null);
  const [teamsData, setTeamsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [starting, setStarting] = useState(false);
  const [showPotSummary, setShowPotSummary] = useState(null);
  const [spinComplete, setSpinComplete] = useState(false);

  // Load initial data
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [leagueData, teams] = await Promise.all([
          getLeague(slug),
          getTeams()
        ]);
        setLeague(leagueData);
        setTeamsData(teams);

        // Load draft state if draft has been started
        if (leagueData.draft && leagueData.draft.status !== 'not_started') {
          const state = await getDraftState(slug);
          setDraftState(state);
        }
      } catch (err) {
        setError(err.message || 'Failed to load draft data');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [slug]);

  // Get participant name by ID
  const getParticipantName = useCallback((participantId) => {
    if (!league) return participantId;
    const participant = league.participants.find(p => p.id === participantId);
    return participant ? participant.name : participantId;
  }, [league]);

  // Get team name by ID
  const getTeamName = useCallback((teamId) => {
    if (!teamsData) return teamId;
    for (const pot of teamsData.pots) {
      const team = pot.teams.find(t => t.id === teamId);
      if (team) return team.name;
    }
    return teamId;
  }, [teamsData]);

  // Handle starting the draft
  const handleStartDraft = useCallback(async () => {
    try {
      setStarting(true);
      await startDraft(slug);
      // Refresh league data to update draft status
      const updatedLeague = await getLeague(slug);
      setLeague(updatedLeague);
      const state = await getDraftState(slug);
      setDraftState(state);
    } catch (err) {
      setError(err.message || 'Failed to start draft');
    } finally {
      setStarting(false);
    }
  }, [slug]);

  // Handle spin
  const handleSpin = useCallback(async () => {
    setSpinComplete(false);
    const previousPot = draftState.currentPot;
    const result = await spinWheel(slug);

    // Update draft state from the spin result — keep current state until full refresh
    const newDraft = result.draft;

    // Check if pot just completed (pot changed or draft completed)
    if (newDraft.status === 'completed') {
      // Draft is complete - show final summary after animation
      setTimeout(() => {
        setDraftState(prev => ({ ...prev, ...newDraft }));
      }, 100);
    } else if (newDraft.currentPot !== previousPot) {
      // Pot changed - show pot summary after animation completes
      setTimeout(() => {
        setShowPotSummary(previousPot);
      }, 2500);
    }

    // Refresh full state after a short delay to get updated available teams
    setTimeout(async () => {
      try {
        const freshState = await getDraftState(slug);
        setDraftState(freshState);
        setSpinComplete(true);
      } catch (e) {
        // Non-critical, state was already updated from spin result
      }
    }, 2600);

    return result;
  }, [slug, draftState]);

  // Continue after pot summary
  const handleContinuePot = useCallback(() => {
    setShowPotSummary(null);
    setSpinComplete(false);
  }, []);

  if (loading) {
    return (
      <div className="container draft-session">
        <div className="draft-loading">Loading draft...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container draft-session">
        <div className="draft-error">
          <p>{error}</p>
        </div>
      </div>
    );
  }

  // Draft not started yet
  if (!draftState && (!league.draft || league.draft.status === 'not_started')) {
    return (
      <div className="container draft-session">
        <div className="draft-header">
          <h1>Draft - {league.name}</h1>
        </div>
        <div className="draft-not-started">
          <p>
            {league.participants.length === 6
              ? 'Ready to start the draft! The order will be randomized.'
              : `Waiting for ${6 - league.participants.length} more participant(s) to join.`}
          </p>
          <button
            className="draft-start-button"
            onClick={handleStartDraft}
            disabled={starting || league.participants.length !== 6}
          >
            {starting ? 'Starting...' : 'Start Draft'}
          </button>
        </div>
      </div>
    );
  }

  // Still loading draft state
  if (!draftState) {
    return (
      <div className="container draft-session">
        <div className="draft-loading">Loading draft...</div>
      </div>
    );
  }

  // Draft completed - show final summary
  if (draftState.status === 'completed' && !showPotSummary) {
    return (
      <div className="container draft-session">
        <div className="draft-header">
          <h1>Draft Complete!</h1>
        </div>
        <div className="draft-progress">
          <div className="draft-progress__bar">
            <div className="draft-progress__fill" style={{ width: '100%' }} />
          </div>
          <div className="draft-progress__text">48/48 spins completed</div>
        </div>
        <div className="final-summary">
          <h2>Team Allocations</h2>
          {draftState.order.map(participantId => (
            <div key={participantId} className="final-summary__participant">
              <div className="final-summary__name">
                {getParticipantName(participantId)}
              </div>
              <div className="final-summary__pots">
                {[1, 2, 3, 4].map(potNum => (
                  <div key={potNum} className="final-summary__pot">
                    <div className="final-summary__pot-label">Pot {potNum}</div>
                    <div className="final-summary__pot-teams">
                      {(draftState.allocations[participantId]?.[`pot${potNum}`] || [])
                        .map(teamId => getTeamName(teamId))
                        .join(', ')}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <div style={{ textAlign: 'center' }}>
            <p className="final-summary__link">View League Standings</p>
          </div>
        </div>
      </div>
    );
  }

  // Show pot summary overlay
  if (showPotSummary) {
    return (
      <div className="container draft-session">
        <div className="draft-header">
          <h1>Draft - {league.name}</h1>
        </div>
        <div className="draft-progress">
          <div className="draft-progress__bar">
            <div
              className="draft-progress__fill"
              style={{ width: `${(draftState.spinsCompleted / 48) * 100}%` }}
            />
          </div>
          <div className="draft-progress__text">
            {draftState.spinsCompleted}/48 spins completed
          </div>
        </div>
        <div className="pot-summary">
          <h3>Pot {showPotSummary} Complete!</h3>
          <div className="pot-summary__grid">
            {draftState.order.map(participantId => (
              <div key={participantId} className="pot-summary__participant">
                <div className="pot-summary__participant-name">
                  {getParticipantName(participantId)}
                </div>
                <div className="pot-summary__teams">
                  {(draftState.allocations[participantId]?.[`pot${showPotSummary}`] || [])
                    .map(teamId => getTeamName(teamId))
                    .join(', ')}
                </div>
              </div>
            ))}
          </div>
          <button className="pot-summary__continue" onClick={handleContinuePot}>
            Continue to Pot {showPotSummary - 1}
          </button>
        </div>
      </div>
    );
  }

  // Draft in progress
  const currentPickerName = draftState.currentPicker
    ? getParticipantName(draftState.currentPicker)
    : '';

  // Simple: after a spin completes, the server's currentPicker is who goes NEXT.
  // Before a spin (or while spinning), currentPicker is who's picking NOW.
  const bannerLabel = spinComplete ? 'Up next' : 'Now picking';
  const bannerName = currentPickerName;

  return (
    <div className="container draft-session">
      <div className="draft-header">
        <h1>Draft - {league.name}</h1>
      </div>

      {/* Draft info */}
      <div className="draft-info">
        <div className="draft-info__item">
          <div className="draft-info__label">Current Picker</div>
          <div className="draft-info__value">{currentPickerName}</div>
        </div>
        <div className="draft-info__item">
          <div className="draft-info__label">Pot</div>
          <div className="draft-info__value">{draftState.currentPot}</div>
        </div>
        <div className="draft-info__item">
          <div className="draft-info__label">Round</div>
          <div className="draft-info__value">{draftState.currentRound}</div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="draft-progress">
        <div className="draft-progress__bar">
          <div
            className="draft-progress__fill"
            style={{ width: `${(draftState.spinsCompleted / 48) * 100}%` }}
          />
        </div>
        <div className="draft-progress__text">
          {draftState.spinsCompleted}/48 spins completed
        </div>
      </div>

      {/* Current & Next picker banner */}
      <div className="draft-picker-banner">
        <div className="draft-picker-banner__current">
          <span className="draft-picker-banner__label">{bannerLabel}</span>
          <span className="draft-picker-banner__name">{bannerName}</span>
        </div>
      </div>

      {/* Draft order */}
      <div className="draft-order">
        <h3>Draft Order</h3>
        <div className="draft-order__list">
          {draftState.order.map((participantId, index) => (
            <div
              key={participantId}
              className={`draft-order__item${
                participantId === draftState.currentPicker ? ' draft-order__item--active' : ''
              }`}
            >
              {index + 1}. {getParticipantName(participantId)}
            </div>
          ))}
        </div>
      </div>

      {/* Wheel spinner */}
      <div className="draft-main">
        <WheelSpinner
          availableTeams={draftState.availableTeams || []}
          onSpin={handleSpin}
          disabled={!draftState.availableTeams || draftState.availableTeams.length === 0}
          currentParticipantName={currentPickerName}
        />
      </div>
    </div>
  );
}
