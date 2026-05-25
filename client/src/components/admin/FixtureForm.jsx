import { useState } from 'react';
import { addFixture, updateFixture } from '../../api/admin.js';
import './FixtureForm.css';

const STAGES = [
  'Group Stage',
  'Round of 16',
  'Quarter-final',
  'Semi-final',
  'Third-place playoff',
  'Final',
];

function FixtureForm({ token, teams, fixtures, onSuccess }) {
  const [editingFixture, setEditingFixture] = useState(null);
  const [homeTeam, setHomeTeam] = useState('');
  const [awayTeam, setAwayTeam] = useState('');
  const [date, setDate] = useState('');
  const [stage, setStage] = useState('');
  const [errors, setErrors] = useState({});
  const [feedback, setFeedback] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function validate() {
    const newErrors = {};

    if (!homeTeam) newErrors.homeTeam = 'Home team is required.';
    if (!awayTeam) newErrors.awayTeam = 'Away team is required.';
    if (homeTeam && awayTeam && homeTeam === awayTeam) {
      newErrors.awayTeam = 'Teams must be different.';
    }
    if (!date) newErrors.date = 'Date/time is required.';
    if (!stage) newErrors.stage = 'Stage is required.';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFeedback(null);

    if (!validate()) return;

    const fixtureData = {
      homeTeam,
      awayTeam,
      date: new Date(date).toISOString(),
      stage,
    };

    setIsSubmitting(true);

    try {
      if (editingFixture) {
        await updateFixture(token, editingFixture.id, fixtureData);
        setFeedback({ type: 'success', message: 'Fixture updated successfully.' });
      } else {
        await addFixture(token, fixtureData);
        setFeedback({ type: 'success', message: 'Fixture added successfully.' });
      }
      resetForm();
      if (onSuccess) onSuccess();
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Failed to save fixture.' });
    } finally {
      setIsSubmitting(false);
    }
  }

  function resetForm() {
    setEditingFixture(null);
    setHomeTeam('');
    setAwayTeam('');
    setDate('');
    setStage('');
    setErrors({});
  }

  function handleEdit(fixture) {
    setEditingFixture(fixture);
    setHomeTeam(fixture.homeTeam);
    setAwayTeam(fixture.awayTeam);
    setStage(fixture.stage);
    // Convert ISO date to datetime-local format
    const d = new Date(fixture.date);
    const localDate = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    setDate(localDate);
    setErrors({});
    setFeedback(null);
  }

  function handleCancel() {
    resetForm();
    setFeedback(null);
  }

  return (
    <div className="fixture-form">
      <form onSubmit={handleSubmit} noValidate>
        <h3>{editingFixture ? 'Edit Fixture' : 'Add Fixture'}</h3>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="fixture-home-team">Home Team</label>
            <select
              id="fixture-home-team"
              className={`form-select${errors.homeTeam ? ' input-error' : ''}`}
              value={homeTeam}
              onChange={e => setHomeTeam(e.target.value)}
            >
              <option value="">Select team...</option>
              {teams.map(team => (
                <option key={team.id} value={team.id}>{team.name}</option>
              ))}
            </select>
            {errors.homeTeam && <p className="error-message">{errors.homeTeam}</p>}
          </div>

          <div className="form-group">
            <label htmlFor="fixture-away-team">Away Team</label>
            <select
              id="fixture-away-team"
              className={`form-select${errors.awayTeam ? ' input-error' : ''}`}
              value={awayTeam}
              onChange={e => setAwayTeam(e.target.value)}
            >
              <option value="">Select team...</option>
              {teams.map(team => (
                <option key={team.id} value={team.id}>{team.name}</option>
              ))}
            </select>
            {errors.awayTeam && <p className="error-message">{errors.awayTeam}</p>}
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="fixture-date">Date / Time</label>
            <input
              id="fixture-date"
              type="datetime-local"
              className={`form-input${errors.date ? ' input-error' : ''}`}
              value={date}
              onChange={e => setDate(e.target.value)}
            />
            {errors.date && <p className="error-message">{errors.date}</p>}
          </div>

          <div className="form-group">
            <label htmlFor="fixture-stage">Stage</label>
            <select
              id="fixture-stage"
              className={`form-select${errors.stage ? ' input-error' : ''}`}
              value={stage}
              onChange={e => setStage(e.target.value)}
            >
              <option value="">Select stage...</option>
              {STAGES.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            {errors.stage && <p className="error-message">{errors.stage}</p>}
          </div>
        </div>

        <div className="form-actions">
          <button type="submit" className="btn-primary" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : editingFixture ? 'Update Fixture' : 'Add Fixture'}
          </button>
          {editingFixture && (
            <button type="button" className="btn-secondary" onClick={handleCancel}>
              Cancel
            </button>
          )}
        </div>

        {feedback && (
          <div className={`feedback-message feedback-${feedback.type}`} role="alert">
            {feedback.message}
          </div>
        )}
      </form>

      {fixtures.length > 0 && (
        <div className="fixture-list-section">
          <h4>Existing Fixtures</h4>
          <ul className="fixture-edit-list">
            {fixtures.map(fixture => {
              const home = teams.find(t => t.id === fixture.homeTeam);
              const away = teams.find(t => t.id === fixture.awayTeam);
              return (
                <li key={fixture.id} className="fixture-edit-item">
                  <span className="fixture-edit-item-info">
                    {home?.name || fixture.homeTeam} vs {away?.name || fixture.awayTeam} — {fixture.stage} — {new Date(fixture.date).toLocaleDateString()}
                  </span>
                  <button
                    type="button"
                    className="fixture-edit-btn"
                    onClick={() => handleEdit(fixture)}
                  >
                    Edit
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

export default FixtureForm;
