import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { createLeague, getMyLeagues, addParticipant } from '../api/leagues.js';
import './HomePage.css';

const STORAGE_KEY = 'sweepstake_user_email';

/**
 * HomePage — user-centric landing page.
 * If no email is stored, prompts the user to identify themselves.
 * Once identified, shows their leagues and actions to create/join new ones.
 */
function HomePage() {
  const [email, setEmail] = useState(() => localStorage.getItem(STORAGE_KEY) || '');
  const [emailInput, setEmailInput] = useState('');
  const [emailError, setEmailError] = useState('');

  const [leagues, setLeagues] = useState([]);
  const [leaguesLoading, setLeaguesLoading] = useState(false);
  const [leaguesError, setLeaguesError] = useState('');

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [leagueName, setLeagueName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [createError, setCreateError] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const navigate = useNavigate();

  const fetchLeagues = useCallback(async (userEmail) => {
    setLeaguesLoading(true);
    setLeaguesError('');
    try {
      const data = await getMyLeagues(userEmail);
      setLeagues(data);
    } catch (err) {
      setLeaguesError(err.message || 'Failed to load your leagues.');
    } finally {
      setLeaguesLoading(false);
    }
  }, []);

  // Fetch leagues when email is set
  useEffect(() => {
    if (email) {
      fetchLeagues(email);
    }
  }, [email, fetchLeagues]);

  function handleEmailSubmit(e) {
    e.preventDefault();
    const trimmed = emailInput.trim().toLowerCase();
    if (!trimmed) {
      setEmailError('Email address is required.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setEmailError('Please enter a valid email address.');
      return;
    }
    setEmailError('');
    localStorage.setItem(STORAGE_KEY, trimmed);
    setEmail(trimmed);
  }

  function handleChangeUser() {
    localStorage.removeItem(STORAGE_KEY);
    setEmail('');
    setEmailInput('');
    setLeagues([]);
  }

  async function handleCreateLeague(e) {
    e.preventDefault();
    const trimmedName = leagueName.trim();
    const trimmedDisplayName = displayName.trim();
    if (!trimmedName || trimmedName.length > 50) {
      setCreateError('League name must be between 1 and 50 characters.');
      return;
    }
    if (!trimmedDisplayName || trimmedDisplayName.length > 50) {
      setCreateError('Your name must be between 1 and 50 characters.');
      return;
    }
    setCreateError('');
    setIsCreating(true);
    try {
      const league = await createLeague(trimmedName, email);
      // Auto-add the creator as the first participant
      await addParticipant(league.slug, trimmedDisplayName, email);
      navigate(`/league/${league.slug}`);
    } catch (err) {
      if (err.status === 409) {
        setCreateError('A league with this name already exists.');
      } else {
        setCreateError(err.message || 'Something went wrong.');
      }
    } finally {
      setIsCreating(false);
    }
  }

  // No email set — show identification screen
  if (!email) {
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
          <h2>Who are you?</h2>
          <p className="home-section-desc">Enter your email to see your leagues and get started.</p>
          <form className="home-form" onSubmit={handleEmailSubmit} noValidate>
            <div className="form-group">
              <label htmlFor="user-email">Email Address</label>
              <input
                id="user-email"
                type="email"
                className={`form-input${emailError ? ' input-error' : ''}`}
                placeholder="you@example.com"
                value={emailInput}
                onChange={(e) => { setEmailInput(e.target.value); if (emailError) setEmailError(''); }}
                autoComplete="email"
                aria-describedby={emailError ? 'user-email-error' : undefined}
                aria-invalid={emailError ? 'true' : 'false'}
              />
              {emailError && (
                <p id="user-email-error" className="error-message" role="alert">
                  {emailError}
                </p>
              )}
            </div>
            <button type="submit" className="btn-primary">
              Continue
            </button>
          </form>
        </section>
      </div>
    );
  }

  // Email is set — show user's leagues
  return (
    <div className="home-page">
      <section className="home-hero home-hero--compact">
        <h1>My Leagues</h1>
        <p className="home-user-email">
          {email}
          <button className="home-change-user" onClick={handleChangeUser} type="button">
            Switch
          </button>
        </p>
      </section>

      {/* League list */}
      <section className="home-leagues-section">
        {leaguesLoading && <p className="home-leagues-loading">Loading your leagues...</p>}

        {leaguesError && (
          <p className="home-leagues-error">{leaguesError}</p>
        )}

        {!leaguesLoading && !leaguesError && leagues.length === 0 && (
          <div className="home-leagues-empty">
            <p>You haven't joined any leagues yet. Create one or join via a link from a friend.</p>
          </div>
        )}

        {!leaguesLoading && leagues.length > 0 && (
          <div className="home-leagues-list">
            {leagues.map((league) => (
              <Link
                key={league.slug}
                to={`/league/${league.slug}`}
                className="home-league-card"
              >
                <div className="home-league-card__info">
                  <h2 className="home-league-card__name">{league.name}</h2>
                  <p className="home-league-card__participant">
                    Playing as <strong>{league.participantName}</strong>
                  </p>
                </div>
                <span className="home-league-card__arrow" aria-hidden="true">→</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Create league action */}
      <section className="home-actions-section">
        {!showCreateForm ? (
          <button
            className="btn-primary home-create-btn"
            onClick={() => setShowCreateForm(true)}
            type="button"
          >
            + Create a New League
          </button>
        ) : (
          <div className="home-create-form-card">
            <h3>Create a League</h3>
            <form className="home-form" onSubmit={handleCreateLeague} noValidate>
              <div className="form-group">
                <label htmlFor="league-name">League Name</label>
                <input
                  id="league-name"
                  type="text"
                  className={`form-input${createError ? ' input-error' : ''}`}
                  placeholder="e.g. Office Legends"
                  value={leagueName}
                  onChange={(e) => { setLeagueName(e.target.value); if (createError) setCreateError(''); }}
                  maxLength={50}
                  autoComplete="off"
                  aria-describedby={createError ? 'league-name-error' : undefined}
                  aria-invalid={createError ? 'true' : 'false'}
                />
              </div>
              <div className="form-group">
                <label htmlFor="display-name">Your Name</label>
                <input
                  id="display-name"
                  type="text"
                  className="form-input"
                  placeholder="e.g. Chris"
                  value={displayName}
                  onChange={(e) => { setDisplayName(e.target.value); if (createError) setCreateError(''); }}
                  maxLength={50}
                  autoComplete="off"
                />
              </div>
              {createError && (
                <p id="league-name-error" className="error-message" role="alert">
                  {createError}
                </p>
              )}
              <div className="home-create-form-actions">
                <button type="submit" className="btn-primary" disabled={isCreating}>
                  {isCreating ? 'Creating...' : 'Create'}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => { setShowCreateForm(false); setCreateError(''); }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}
      </section>
    </div>
  );
}

export default HomePage;
