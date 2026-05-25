import { useState, useEffect, useCallback } from 'react';
import { useLeague } from '../context/LeagueContext.jsx';
import { get } from '../api/client.js';
import KnockoutBracket from '../components/KnockoutBracket.jsx';
import './KnockoutBracketView.css';

export default function KnockoutBracketView() {
  const { league, teams, loading: leagueLoading } = useLeague();

  const [rounds, setRounds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const bracketData = await get('/bracket');
      setRounds(bracketData.rounds || []);
      setError(null);
    } catch (err) {
      setError(err.message || 'Failed to load bracket');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Build a map of teamId -> participant name for ownership highlighting
  function getOwnerMap() {
    const ownerMap = {};
    if (!league || !league.draft?.allocations || !league.participants) {
      return ownerMap;
    }

    for (const participant of league.participants) {
      const allocations = league.draft.allocations[participant.id];
      if (!allocations) continue;
      const participantTeams = Object.values(allocations).flat();
      for (const teamId of participantTeams) {
        ownerMap[teamId] = participant.name;
      }
    }

    return ownerMap;
  }

  // Build a map of teamId -> display name
  function getTeamNameMap() {
    const map = {};
    for (const team of teams) {
      map[team.id] = team.name;
    }
    return map;
  }

  // Check if the bracket is empty (no fixtures in any round)
  function isBracketEmpty() {
    return rounds.every((round) => round.fixtures.length === 0);
  }

  if (loading || leagueLoading) {
    return (
      <div className="container bracket-loading">
        <p>Loading bracket...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container bracket-error">
        <h2>Error</h2>
        <p>{error}</p>
      </div>
    );
  }

  const ownerMap = getOwnerMap();
  const teamNameMap = getTeamNameMap();
  const empty = isBracketEmpty();

  return (
    <div className="container bracket-view">
      <div className="bracket-header">
        <h1>Knockout Bracket</h1>
      </div>

      {empty ? (
        <div className="bracket-empty">
          <p>The knockout stage has not yet started.</p>
        </div>
      ) : (
        <div className="bracket-scroll-container">
          <KnockoutBracket
            rounds={rounds}
            ownerMap={ownerMap}
            teamNameMap={teamNameMap}
          />
        </div>
      )}
    </div>
  );
}
