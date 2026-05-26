import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getMyLeagues } from '../api/leagues.js';
import './MyLeagues.css';

/**
 * MyLeagues — shows all leagues a user belongs to, accessed via /me/:email.
 * Each league card shows the league name, the participant's display name,
 * and links through to the league dashboard.
 */
export default function MyLeagues() {
  const { email } = useParams();
  const [leagues, setLeagues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchLeagues() {
      try {
        const data = await getMyLeagues(email);
        setLeagues(data);
      } catch (err) {
        setError(err.message || 'Failed to load your leagues.');
      } finally {
        setLoading(false);
      }
    }

    fetchLeagues();
  }, [email]);

  if (loading) {
    return (
      <div className="my-leagues-page">
        <div className="my-leagues-loading">
          <p>Loading your leagues...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="my-leagues-page">
        <div className="my-leagues-error">
          <h1>Something went wrong</h1>
          <p>{error}</p>
          <Link to="/">Go to Home</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="my-leagues-page">
      <div className="my-leagues-header">
        <h1>My Leagues</h1>
        <p className="my-leagues-email">{decodeURIComponent(email)}</p>
      </div>

      {leagues.length === 0 ? (
        <div className="my-leagues-empty">
          <p>You haven't joined any leagues yet.</p>
          <Link to="/" className="btn-primary">Create or Join a League</Link>
        </div>
      ) : (
        <div className="my-leagues-list">
          {leagues.map((league) => (
            <Link
              key={league.slug}
              to={`/league/${league.slug}`}
              className="my-leagues-card"
            >
              <div className="my-leagues-card__info">
                <h2 className="my-leagues-card__name">{league.name}</h2>
                <p className="my-leagues-card__participant">
                  Playing as <strong>{league.participantName}</strong>
                </p>
              </div>
              <span className="my-leagues-card__arrow" aria-hidden="true">→</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
