import { useState } from 'react';
import { setTournamentOdds, setMatchOdds } from '../../api/admin.js';
import './OddsEntryForm.css';

function OddsEntryForm({ token, teams, mode, fixtures }) {
  // Tournament odds state
  const [tournamentOdds, setTournamentOddsState] = useState(() => {
    const initial = {};
    teams.forEach(team => { initial[team.id] = ''; });
    return initial;
  });
  const [tournamentErrors, setTournamentErrors] = useState({});

  // Match odds state
  const [selectedFixture, setSelectedFixture] = useState('');
  const [homeOdds, setHomeOdds] = useState('');
  const [awayOdds, setAwayOdds] = useState('');
  const [drawOdds, setDrawOdds] = useState('');
  const [matchErrors, setMatchErrors] = useState({});

  const [feedback, setFeedback] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function validateTournamentOdds() {
    const errors = {};
    let hasError = false;

    teams.forEach(team => {
      const value = parseFloat(tournamentOdds[team.id]);
      if (!tournamentOdds[team.id] || isNaN(value) || value <= 1.0) {
        errors[team.id] = true;
        hasError = true;
      }
    });

    setTournamentErrors(errors);
    return !hasError;
  }

  function validateMatchOdds() {
    const errors = {};

    if (!selectedFixture) errors.fixture = 'Please select a fixture.';

    const home = parseFloat(homeOdds);
    const away = parseFloat(awayOdds);
    const draw = parseFloat(drawOdds);

    if (!homeOdds || isNaN(home) || home <= 1.0) {
      errors.homeOdds = 'Odds must be greater than 1.0';
    }
    if (!awayOdds || isNaN(away) || away <= 1.0) {
      errors.awayOdds = 'Odds must be greater than 1.0';
    }
    if (!drawOdds || isNaN(draw) || draw <= 1.0) {
      errors.drawOdds = 'Odds must be greater than 1.0';
    }

    setMatchErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleTournamentSubmit(e) {
    e.preventDefault();
    setFeedback(null);

    if (!validateTournamentOdds()) {
      setFeedback({ type: 'error', message: 'All teams must have odds greater than 1.0.' });
      return;
    }

    const oddsData = {};
    teams.forEach(team => {
      oddsData[team.id] = parseFloat(tournamentOdds[team.id]);
    });

    setIsSubmitting(true);
    try {
      await setTournamentOdds(token, { odds: oddsData });
      setFeedback({ type: 'success', message: 'Tournament odds saved successfully.' });
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Failed to save tournament odds.' });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleMatchSubmit(e) {
    e.preventDefault();
    setFeedback(null);

    if (!validateMatchOdds()) return;

    const fixture = fixtures.find(f => f.id === selectedFixture);
    if (!fixture) return;

    const oddsData = {
      fixtureId: selectedFixture,
      odds: {
        [fixture.homeTeam]: parseFloat(homeOdds),
        [fixture.awayTeam]: parseFloat(awayOdds),
        draw: parseFloat(drawOdds),
      },
    };

    setIsSubmitting(true);
    try {
      await setMatchOdds(token, oddsData);
      setFeedback({ type: 'success', message: 'Match odds saved successfully.' });
      setSelectedFixture('');
      setHomeOdds('');
      setAwayOdds('');
      setDrawOdds('');
      setMatchErrors({});
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Failed to save match odds.' });
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleOddsChange(teamId, value) {
    setTournamentOddsState(prev => ({ ...prev, [teamId]: value }));
    if (tournamentErrors[teamId]) {
      setTournamentErrors(prev => {
        const next = { ...prev };
        delete next[teamId];
        return next;
      });
    }
  }

  const selectedFixtureData = fixtures.find(f => f.id === selectedFixture);
  const invalidCount = Object.keys(tournamentErrors).length;

  if (mode === 'tournament') {
    return (
      <form className="odds-entry-form" onSubmit={handleTournamentSubmit} noValidate>
        <h3>Tournament Odds</h3>
        <p style={{ color: 'var(--color-text-light)', marginBottom: 'var(--space-md)', fontSize: 'var(--font-size-sm)' }}>
          Enter decimal odds for each team to win the tournament. All values must be greater than 1.0.
        </p>

        {invalidCount > 0 && (
          <p className="odds-validation-summary">
            {invalidCount} team{invalidCount !== 1 ? 's' : ''} missing valid odds.
          </p>
        )}

        <div className="odds-grid">
          {teams.map(team => (
            <div key={team.id} className="odds-grid-item">
              <label htmlFor={`odds-${team.id}`}>{team.name}</label>
              <input
                id={`odds-${team.id}`}
                type="number"
                step="0.01"
                min="1.01"
                className={tournamentErrors[team.id] ? 'input-error' : ''}
                value={tournamentOdds[team.id] || ''}
                onChange={e => handleOddsChange(team.id, e.target.value)}
                placeholder="e.g. 5.50"
              />
            </div>
          ))}
        </div>

        <div className="form-actions">
          <button type="submit" className="btn-primary" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Save Tournament Odds'}
          </button>
        </div>

        {feedback && (
          <div className={`feedback-message feedback-${feedback.type}`} role="alert">
            {feedback.message}
          </div>
        )}
      </form>
    );
  }

  // Match odds mode
  return (
    <form className="odds-entry-form" onSubmit={handleMatchSubmit} noValidate>
      <h3>Match Odds</h3>

      <div className="form-group">
        <label htmlFor="match-odds-fixture">Select Fixture</label>
        <select
          id="match-odds-fixture"
          className={`form-select${matchErrors.fixture ? ' input-error' : ''}`}
          value={selectedFixture}
          onChange={e => setSelectedFixture(e.target.value)}
        >
          <option value="">Select fixture...</option>
          {fixtures.map(fixture => {
            const home = teams.find(t => t.id === fixture.homeTeam);
            const away = teams.find(t => t.id === fixture.awayTeam);
            return (
              <option key={fixture.id} value={fixture.id}>
                {home?.name || fixture.homeTeam} vs {away?.name || fixture.awayTeam} ({fixture.stage})
              </option>
            );
          })}
        </select>
        {matchErrors.fixture && <p className="error-message">{matchErrors.fixture}</p>}
      </div>

      {selectedFixtureData && (
        <div className="match-odds-section">
          <div className="match-odds-fields">
            <div className="form-group">
              <label htmlFor="match-odds-home">
                {teams.find(t => t.id === selectedFixtureData.homeTeam)?.name || selectedFixtureData.homeTeam}
              </label>
              <input
                id="match-odds-home"
                type="number"
                step="0.01"
                min="1.01"
                className={`form-input${matchErrors.homeOdds ? ' input-error' : ''}`}
                value={homeOdds}
                onChange={e => setHomeOdds(e.target.value)}
                placeholder="e.g. 1.85"
              />
              {matchErrors.homeOdds && <p className="error-message">{matchErrors.homeOdds}</p>}
            </div>

            <div className="form-group">
              <label htmlFor="match-odds-draw">Draw</label>
              <input
                id="match-odds-draw"
                type="number"
                step="0.01"
                min="1.01"
                className={`form-input${matchErrors.drawOdds ? ' input-error' : ''}`}
                value={drawOdds}
                onChange={e => setDrawOdds(e.target.value)}
                placeholder="e.g. 3.60"
              />
              {matchErrors.drawOdds && <p className="error-message">{matchErrors.drawOdds}</p>}
            </div>

            <div className="form-group">
              <label htmlFor="match-odds-away">
                {teams.find(t => t.id === selectedFixtureData.awayTeam)?.name || selectedFixtureData.awayTeam}
              </label>
              <input
                id="match-odds-away"
                type="number"
                step="0.01"
                min="1.01"
                className={`form-input${matchErrors.awayOdds ? ' input-error' : ''}`}
                value={awayOdds}
                onChange={e => setAwayOdds(e.target.value)}
                placeholder="e.g. 3.40"
              />
              {matchErrors.awayOdds && <p className="error-message">{matchErrors.awayOdds}</p>}
            </div>
          </div>
        </div>
      )}

      <div className="form-actions">
        <button type="submit" className="btn-primary" disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : 'Save Match Odds'}
        </button>
      </div>

      {feedback && (
        <div className={`feedback-message feedback-${feedback.type}`} role="alert">
          {feedback.message}
        </div>
      )}
    </form>
  );
}

export default OddsEntryForm;
