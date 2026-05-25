import { useState } from 'react';
import { addResult, updateResult } from '../../api/admin.js';
import './MatchResultForm.css';

const STAGES = [
  'Group Stage',
  'Round of 16',
  'Quarter-final',
  'Semi-final',
  'Third-place playoff',
  'Final',
];

function MatchResultForm({ token, teams, fixtures, results, onSuccess }) {
  const [homeTeam, setHomeTeam] = useState('');
  const [awayTeam, setAwayTeam] = useState('');
  const [homeScore, setHomeScore] = useState('');
  const [awayScore, setAwayScore] = useState('');
  const [date, setDate] = useState('');
  const [stage, setStage] = useState('');
  const [penaltyWinner, setPenaltyWinner] = useState('');
  const [errors, setErrors] = useState({});
  const [feedback, setFeedback] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const scoresAreEqual =
    homeScore !== '' &&
    awayScore !== '' &&
    parseInt(homeScore, 10) === parseInt(awayScore, 10);

  function validate() {
    const newErrors = {};

    if (!homeTeam) newErrors.homeTeam = 'Home team is required.';
    if (!awayTeam) newErrors.awayTeam = 'Away team is required.';
    if (homeTeam && awayTeam && homeTeam === awayTeam) {
      newErrors.awayTeam = 'Teams must be different.';
    }

    const homeScoreNum = parseInt(homeScore, 10);
    const awayScoreNum = parseInt(awayScore, 10);

    if (homeScore === '' || isNaN(homeScoreNum) || homeScoreNum < 0 || !Number.isInteger(homeScoreNum)) {
      newErrors.homeScore = 'Score must be a non-negative integer.';
    }
    if (awayScore === '' || isNaN(awayScoreNum) || awayScoreNum < 0 || !Number.isInteger(awayScoreNum)) {
      newErrors.awayScore = 'Score must be a non-negative integer.';
    }

    if (!date) newErrors.date = 'Date is required.';
    if (!stage) newErrors.stage = 'Stage is required.';

    if (scoresAreEqual && stage && stage !== 'Group Stage' && !penaltyWinner) {
      newErrors.penaltyWinner = 'Penalty shootout winner is required for drawn knockout matches.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFeedback(null);

    if (!validate()) return;

    const resultData = {
      homeTeam,
      awayTeam,
      homeScore: parseInt(homeScore, 10),
      awayScore: parseInt(awayScore, 10),
      date: new Date(date).toISOString(),
      stage,
    };

    if (scoresAreEqual && stage !== 'Group Stage' && penaltyWinner) {
      resultData.penaltyShootout = { winner: penaltyWinner };
    }

    // Check if a result already exists for this fixture
    const existingResult = results.find(
      r => r.homeTeam === homeTeam && r.awayTeam === awayTeam && r.stage === stage
    );

    if (existingResult) {
      const confirmed = window.confirm(
        'A result already exists for this match. Do you want to overwrite it?'
      );
      if (!confirmed) return;
    }

    setIsSubmitting(true);

    try {
      if (existingResult) {
        await updateResult(token, existingResult.id, resultData);
        setFeedback({ type: 'success', message: 'Result updated successfully.' });
      } else {
        await addResult(token, resultData);
        setFeedback({ type: 'success', message: 'Result added successfully.' });
      }
      resetForm();
      if (onSuccess) onSuccess();
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Failed to save result.' });
    } finally {
      setIsSubmitting(false);
    }
  }

  function resetForm() {
    setHomeTeam('');
    setAwayTeam('');
    setHomeScore('');
    setAwayScore('');
    setDate('');
    setStage('');
    setPenaltyWinner('');
    setErrors({});
  }

  return (
    <form className="match-result-form" onSubmit={handleSubmit} noValidate>
      <h3>Enter Match Result</h3>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="result-home-team">Home Team</label>
          <select
            id="result-home-team"
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
          <label htmlFor="result-away-team">Away Team</label>
          <select
            id="result-away-team"
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
          <label htmlFor="result-home-score">Home Score</label>
          <input
            id="result-home-score"
            type="number"
            min="0"
            step="1"
            className={`form-input${errors.homeScore ? ' input-error' : ''}`}
            value={homeScore}
            onChange={e => setHomeScore(e.target.value)}
          />
          {errors.homeScore && <p className="error-message">{errors.homeScore}</p>}
        </div>

        <div className="form-group">
          <label htmlFor="result-away-score">Away Score</label>
          <input
            id="result-away-score"
            type="number"
            min="0"
            step="1"
            className={`form-input${errors.awayScore ? ' input-error' : ''}`}
            value={awayScore}
            onChange={e => setAwayScore(e.target.value)}
          />
          {errors.awayScore && <p className="error-message">{errors.awayScore}</p>}
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="result-date">Date</label>
          <input
            id="result-date"
            type="datetime-local"
            className={`form-input${errors.date ? ' input-error' : ''}`}
            value={date}
            onChange={e => setDate(e.target.value)}
          />
          {errors.date && <p className="error-message">{errors.date}</p>}
        </div>

        <div className="form-group">
          <label htmlFor="result-stage">Stage</label>
          <select
            id="result-stage"
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

      {scoresAreEqual && stage && stage !== 'Group Stage' && (
        <div className="penalty-section">
          <p>Scores are level in a knockout match. Select the penalty shootout winner:</p>
          <div className="form-group">
            <label htmlFor="result-penalty-winner">Penalty Shootout Winner</label>
            <select
              id="result-penalty-winner"
              className={`form-select${errors.penaltyWinner ? ' input-error' : ''}`}
              value={penaltyWinner}
              onChange={e => setPenaltyWinner(e.target.value)}
            >
              <option value="">Select winner...</option>
              {homeTeam && (
                <option value={homeTeam}>
                  {teams.find(t => t.id === homeTeam)?.name || homeTeam}
                </option>
              )}
              {awayTeam && (
                <option value={awayTeam}>
                  {teams.find(t => t.id === awayTeam)?.name || awayTeam}
                </option>
              )}
            </select>
            {errors.penaltyWinner && <p className="error-message">{errors.penaltyWinner}</p>}
          </div>
        </div>
      )}

      <div className="form-actions">
        <button type="submit" className="btn-primary" disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : 'Save Result'}
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

export default MatchResultForm;
