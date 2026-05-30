import { useState } from 'react';
import { useLeague } from '../context/LeagueContext.jsx';
import MyTeamsDashboard from './MyTeamsDashboard.jsx';
import './MyTeamsView.css';

/**
 * MyTeamsView — participant selector + MyTeamsDashboard rendering.
 * Rendered at /league/:slug/my-teams
 */
export default function MyTeamsView() {
  const { participants, loading } = useLeague();
  const [selectedParticipantId, setSelectedParticipantId] = useState(null);

  if (loading) {
    return (
      <div className="container">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="container my-teams-view">
      <h2>My Teams</h2>

      <div className="my-teams-view__selector">
        <label htmlFor="participant-select">Select participant:</label>
        <select
          id="participant-select"
          value={selectedParticipantId || ''}
          onChange={(e) => setSelectedParticipantId(e.target.value || null)}
        >
          <option value="">-- Choose a participant --</option>
          {participants.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {selectedParticipantId && (
        <MyTeamsDashboard participantId={selectedParticipantId} />
      )}
    </div>
  );
}
