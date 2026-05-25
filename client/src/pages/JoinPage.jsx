import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getLeagueByJoinCode, joinLeague } from '../api/leagues.js';
import './JoinPage.css';

function JoinPage() {
  const { joinCode } = useParams();
  const navigate = useNavigate();

  const [league, setLeague] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');

  const [participantName, setParticipantName] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function fetchLeague() {
      try {
        const data = await getLeagueByJoinCode(joinCode);
        setLeague(data);
      } catch (err) {
        if (err.status === 404) {
          setFetchError('League not found. This join link may be invalid.');
        } else {
          setFetchError(err.message || 'Failed to load league information.');
        }
      } finally {
        setLoading(false);
      }
    }

    fetchLeague();
  }, [joinCode]);

  function validateName(value) {
    if (!value || value.trim().length === 0) {
      return 'Name is required and must contain at least one non-whitespace character.';
    }
    if (value.length > 50) {
      return 'Name must be 50 characters or fewer.';
    }
    return '';
  }

  async function handleSubmit(e) {
    e.preventDefault();

    const validationError = validateName(participantName);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError('');
    setIsSubmitting(true);

    try {
      const result = await joinLeague(joinCode, participantName);
      navigate(`/league/${result.slug}`);
    } catch (err) {
      if (err.status === 409) {
        setError('This name is already taken in this league. Please choose a different name.');
      } else if (err.status === 400) {
        setError(err.message || 'Unable to join. The league may be full.');
      } else {
        setError(err.message || 'Something went wrong. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleNameChange(e) {
    setParticipantName(e.target.value);
    if (error) {
      setError('');
    }
  }

  if (loading) {
    return (
      <div className="join-page">
        <div className="join-loading">
          <p>Loading league info...</p>
        </div>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="join-page">
        <div className="join-error-page">
          <h1>Oops</h1>
          <p>{fetchError}</p>
          <Link to="/">Go to Home</Link>
        </div>
      </div>
    );
  }

  const isFull = league.participants && league.participants.length >= 6;

  return (
    <div className="join-page">
      <div className="join-card">
        <div className="join-league-info">
          <h1>{league.name}</h1>
          <p>
            {league.participants ? league.participants.length : 0} / 6 participants
          </p>
        </div>

        {isFull ? (
          <div className="join-full-notice">
            <p className="notice-title">League is Full</p>
            <p>This league already has 6 participants and cannot accept new members.</p>
            <Link to={`/league/${league.slug}`}>View League Standings</Link>
          </div>
        ) : (
          <form className="join-form" onSubmit={handleSubmit} noValidate>
            <div className="form-group">
              <label htmlFor="participant-name">Your Name</label>
              <input
                id="participant-name"
                type="text"
                className={`form-input${error ? ' input-error' : ''}`}
                placeholder="Enter your name"
                value={participantName}
                onChange={handleNameChange}
                maxLength={50}
                autoComplete="off"
                aria-describedby={error ? 'participant-name-error' : undefined}
                aria-invalid={error ? 'true' : 'false'}
              />
              {error && (
                <p id="participant-name-error" className="error-message" role="alert">
                  {error}
                </p>
              )}
            </div>
            <button
              type="submit"
              className="btn-primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Joining...' : 'Join League'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default JoinPage;
