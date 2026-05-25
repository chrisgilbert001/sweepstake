import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createLeague } from '../api/leagues.js';
import './HomePage.css';

function HomePage() {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  function validateName(value) {
    if (!value || value.trim().length === 0) {
      return 'League name is required and must contain at least one non-whitespace character.';
    }
    if (value.length > 50) {
      return 'League name must be 50 characters or fewer.';
    }
    return '';
  }

  async function handleSubmit(e) {
    e.preventDefault();

    const validationError = validateName(name);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError('');
    setIsSubmitting(true);

    try {
      const league = await createLeague(name);
      navigate(`/league/${league.slug}`);
    } catch (err) {
      if (err.status === 409) {
        setError('A league with this name already exists. Please choose a different name.');
      } else {
        setError(err.message || 'Something went wrong. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleNameChange(e) {
    setName(e.target.value);
    if (error) {
      setError('');
    }
  }

  return (
    <div className="home-page">
      <section className="home-hero">
        <span className="home-hero-emoji" aria-hidden="true">⚽🏆</span>
        <h1>World Cup Sweepstake</h1>
        <p>
          Create a league with friends, draft teams from the FIFA World Cup via an
          exciting snake draft, and compete to see whose teams earn the most points
          throughout the tournament.
        </p>
      </section>

      <section className="home-create-section">
        <h2>Create a League</h2>
        <form className="home-form" onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label htmlFor="league-name">League Name</label>
            <input
              id="league-name"
              type="text"
              className={`form-input${error ? ' input-error' : ''}`}
              placeholder="e.g. Office Legends"
              value={name}
              onChange={handleNameChange}
              maxLength={50}
              autoComplete="off"
              aria-describedby={error ? 'league-name-error' : undefined}
              aria-invalid={error ? 'true' : 'false'}
            />
            {error && (
              <p id="league-name-error" className="error-message" role="alert">
                {error}
              </p>
            )}
          </div>
          <button
            type="submit"
            className="btn-primary"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Creating...' : 'Create League'}
          </button>
        </form>
      </section>
    </div>
  );
}

export default HomePage;
