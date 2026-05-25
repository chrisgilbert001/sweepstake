import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useLeague } from '../context/LeagueContext.jsx';
import { getActivity } from '../api/activity.js';
import './ActivityFeed.css';

const POLL_INTERVAL = 30000; // 30 seconds

export default function ActivityFeed() {
  const { slug } = useParams();
  const { loading: leagueLoading } = useLeague();

  const [events, setEvents] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalEvents, setTotalEvents] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // New event notification state
  const [newEventCount, setNewEventCount] = useState(0);
  const knownTotalRef = useRef(0);

  const fetchActivity = useCallback(async (pageNum) => {
    try {
      const data = await getActivity(slug, pageNum, 50);
      setEvents(data.events);
      setPage(data.page);
      setTotalPages(data.totalPages);
      setTotalEvents(data.totalEvents);
      knownTotalRef.current = data.totalEvents;
      setNewEventCount(0);
      setError(null);
    } catch (err) {
      setError(err.message || 'Failed to load activity feed');
    }
  }, [slug]);

  // Initial load
  useEffect(() => {
    async function init() {
      setLoading(true);
      await fetchActivity(1);
      setLoading(false);
    }
    init();
  }, [fetchActivity]);

  // Poll for new events
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const data = await getActivity(slug, 1, 50);
        if (data.totalEvents > knownTotalRef.current) {
          setNewEventCount(data.totalEvents - knownTotalRef.current);
        }
      } catch {
        // Silently ignore polling errors
      }
    }, POLL_INTERVAL);

    return () => clearInterval(interval);
  }, [slug]);

  function handleShowNewEvents() {
    fetchActivity(1);
    setPage(1);
  }

  function handlePrevPage() {
    if (page > 1) {
      fetchActivity(page - 1);
    }
  }

  function handleNextPage() {
    if (page < totalPages) {
      fetchActivity(page + 1);
    }
  }

  function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function renderMatchResultEvent(event) {
    const { data } = event;
    return (
      <div className="activity-event-card event-match-result">
        <div className="event-meta">
          <span className="event-type-badge badge-match-result">Match Result</span>
          <span className="event-stage">{data.stage}</span>
          <span className="event-timestamp">{formatTimestamp(event.timestamp)}</span>
        </div>
        <div className="event-match-teams">
          <div className="event-team event-team-home">
            <span className="event-team-name">{data.homeTeam}</span>
            {data.homeOwner && (
              <span className="event-team-owner">{data.homeOwner}</span>
            )}
            <span className="event-team-points">+{data.homePoints} pts</span>
          </div>
          <div className="event-score">
            <span className="event-score-display">
              {data.homeScore} – {data.awayScore}
            </span>
          </div>
          <div className="event-team event-team-away">
            <span className="event-team-name">{data.awayTeam}</span>
            {data.awayOwner && (
              <span className="event-team-owner">{data.awayOwner}</span>
            )}
            <span className="event-team-points">+{data.awayPoints} pts</span>
          </div>
        </div>
      </div>
    );
  }

  function renderTeamEliminatedEvent(event) {
    const { data } = event;
    return (
      <div className="activity-event-card event-team-eliminated">
        <div className="event-meta">
          <span className="event-type-badge badge-team-eliminated">Eliminated</span>
          <span className="event-stage">{data.stage}</span>
          <span className="event-timestamp">{formatTimestamp(event.timestamp)}</span>
        </div>
        <div className="event-elimination">
          <span className="elimination-icon">❌</span>
          <div className="elimination-details">
            <span className="elimination-team-name">{data.teamName}</span>
            <span className="elimination-owner">Owner: {data.owner}</span>
            <span className="elimination-stage">Eliminated in {data.stage}</span>
          </div>
        </div>
      </div>
    );
  }

  function renderEvent(event) {
    if (event.type === 'match_result') {
      return renderMatchResultEvent(event);
    }
    if (event.type === 'team_eliminated') {
      return renderTeamEliminatedEvent(event);
    }
    return null;
  }

  if (loading || leagueLoading) {
    return (
      <div className="container activity-loading">
        <p>Loading activity feed...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container activity-error">
        <h2>Error</h2>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="container activity-feed">
      <div className="activity-header">
        <h1>Activity Feed</h1>
      </div>

      {newEventCount > 0 && (
        <button
          className="new-events-banner"
          onClick={handleShowNewEvents}
          aria-label={`Show ${newEventCount} new events`}
        >
          <span className="new-events-badge">{newEventCount}</span>
          <span>{newEventCount} new {newEventCount === 1 ? 'event' : 'events'} available</span>
        </button>
      )}

      {events.length === 0 ? (
        <div className="activity-empty">
          <p>No activity has occurred yet.</p>
        </div>
      ) : (
        <>
          <div className="activity-events">
            {events.map((event) => (
              <div key={event.id}>
                {renderEvent(event)}
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="activity-pagination">
              <button
                className="pagination-btn"
                onClick={handlePrevPage}
                disabled={page <= 1}
                aria-label="Previous page"
              >
                ← Previous
              </button>
              <span className="pagination-info">
                Page {page} of {totalPages} ({totalEvents} events)
              </span>
              <button
                className="pagination-btn"
                onClick={handleNextPage}
                disabled={page >= totalPages}
                aria-label="Next page"
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
