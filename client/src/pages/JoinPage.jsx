import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getLeagueByJoinCode, joinLeague } from '../api/leagues.js';
import './JoinPage.css';

const STORAGE_KEY = 'sweepstake_user_email';

function JoinPage() {
  const { joinCode } = useParams();
  const navigate = useNavigate();

  const [league, setLeague] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');

  const [participantName, setParticipantName] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [inlineEmail, setInlineEmail] = useState('');
  const [inlineEmailInput, setInlineEmailInput] = useState('');
  const [inlineEmailError, setInlineEmailError] = useState('');

  const storedEmail = localStorage.getItem(STORAGE_KEY) || '';
  const activeEmail = storedEmail || inlineEmail;

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

  // Poll for participant updates every 10 seconds
  useEffect(() => {
    if (fetchError) return;
    const interval = setInterval(async () => {
      try {
        const data = await getLeagueByJoinCode(joinCode);
        setLeague(data);
      } catch (err) {
        // Silently ignore polling errors
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [joinCode, fetchError]);

  function validateName(value) {
    if (!value || value.trim().length === 0) {
      return 'Name is required and must contain at least one non-whitespace character.';
    }
    if (value.length > 50) {
      return 'Name must be 50 characters or fewer.';
    }
    return '';
  }

  function handleEmailSubmit(e) {
    e.preventDefault();
    const trimmed = inlineEmailInput.trim().toLowerCase();
    if (!trimmed) {
      setInlineEmailError('Email address is required.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setInlineEmailError('Please enter a valid email address.');
      return;
    }
    setInlineEmailError('');
    localStorage.setItem(STORAGE_KEY, trimmed);
    setInlineEmail(trimmed);
  }

  async function handleSubmit(e) {
    e.preventDefault();

    const nameValidationError = validateName(participantName);
    if (nameValidationError) {
      setError(nameValidationError);
      return;
    }

    if (!activeEmail) {
      setError('No email found. Please go back and enter your email.');
      return;
    }

    setError('');
    setIsSubmitting(true);

    try {
      const result = await joinLeague(joinCode, participantName, activeEmail);
      localStorage.setItem(STORAGE_KEY, activeEmail);
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

  // Check if the current user has already joined this league
  const alreadyJoined = activeEmail && league.participants &&
    league.participants.some(p => p.email === activeEmail);

  if (alreadyJoined) {
    const myParticipant = league.participants.find(p => p.email === activeEmail);
    return (
      <div className="join-page">
        <div className="join-card">
          <div className="join-league-info">
            <h1>{league.name}</h1>
          </div>
          <div className="join-already-joined">
            <p className="notice-title">You've already joined</p>
            <p>You're in this league as <strong>{myParticipant.name}</strong>.</p>
            <Link to={`/league/${league.slug}`} className="btn-primary">
              Go to League
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // No email set — ask for it inline
  if (!storedEmail && !inlineEmail) {
    return (
      <div className="join-page">
        <div className="join-card">
          <div className="join-league-info">
            <h1>{league.name}</h1>
            <p>
              {league.participants ? league.participants.length : 0} / 6 participants
            </p>
          </div>
          <form className="join-form" onSubmit={handleEmailSubmit} noValidate>
            <div className="form-group">
              <label htmlFor="join-email">Your Email Address</label>
              <input
                id="join-email"
                type="email"
                className={`form-input${inlineEmailError ? ' input-error' : ''}`}
                placeholder="you@example.com"
                value={inlineEmailInput}
                onChange={(e) => { setInlineEmailInput(e.target.value); if (inlineEmailError) setInlineEmailError(''); }}
                autoComplete="email"
                aria-describedby={inlineEmailError ? 'join-email-error' : undefined}
                aria-invalid={inlineEmailError ? 'true' : 'false'}
              />
              {inlineEmailError && (
                <p id="join-email-error" className="error-message" role="alert">
                  {inlineEmailError}
                </p>
              )}
            </div>
            <button type="submit" className="btn-primary">
              Continue
            </button>
          </form>
        </div>
      </div>
    );
  }

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
            <p className="form-hint">Joining as {activeEmail}</p>
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
