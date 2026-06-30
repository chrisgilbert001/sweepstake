import { useState, useEffect, useCallback } from 'react';
import './StandingsTable.css';

/**
 * StandingsTable displays the league standings with participant stats and teams.
 *
 * Props:
 * - standings: Array of { rank, participantId, participantName, points, wins, draws, losses, goalsScored, goalsConceded, goalDifference }
 * - allocations: Object mapping participantId -> { pot1: [...], pot2: [...], pot3: [...], pot4: [...] }
 * - eliminatedTeams: Set of eliminated team IDs
 * - tournamentOdds: Object mapping teamId -> odds value (or null)
 * - teams: Array of all team objects { id, name } for display
 * - isTournamentComplete: boolean
 * - hasLiveResults: boolean - true when one or more matches are in progress
 * - liveTeamIds: Set of team IDs currently in a match in progress
 * - onTeamClick: function(teamId) - called when a team badge is clicked
 */
export default function StandingsTable({
  standings = [],
  allocations = {},
  eliminatedTeams = new Set(),
  tournamentOdds = null,
  teams = [],
  isTournamentComplete = false,
  hasLiveResults = false,
  liveTeamIds = new Set(),
  onTeamClick,
}) {
  const [selectedParticipant, setSelectedParticipant] = useState(null);
  const [sortKey, setSortKey] = useState('rank');
  const [sortDir, setSortDir] = useState('asc');

  const teamNameMap = {};
  const teamSeedMap = {};
  for (const team of teams) {
    teamNameMap[team.id] = team.name;
    teamSeedMap[team.id] = team.seedRank;
  }

  // Compute combined seed rank for each participant
  function getCombinedSeed(participantId) {
    const teamIds = getParticipantTeams(participantId);
    return teamIds.reduce((sum, id) => sum + (teamSeedMap[id] || 99), 0);
  }

  function handleSort(key) {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      // Default direction: descending for points/wins/GD, ascending for rank/seed/losses
      setSortDir(['points', 'wins', 'draws', 'penaltyWins', 'goalDifference'].includes(key) ? 'desc' : 'asc');
    }
  }

  function getSortedStandings() {
    const sorted = [...standings].map(entry => ({
      ...entry,
      combinedSeed: getCombinedSeed(entry.participantId),
    }));

    sorted.sort((a, b) => {
      let aVal, bVal;
      switch (sortKey) {
        case 'rank': aVal = a.rank; bVal = b.rank; break;
        case 'name': aVal = a.participantName.toLowerCase(); bVal = b.participantName.toLowerCase(); break;
        case 'points': aVal = a.points; bVal = b.points; break;
        case 'wins': aVal = a.wins; bVal = b.wins; break;
        case 'draws': aVal = a.draws; bVal = b.draws; break;
        case 'penaltyWins': aVal = a.penaltyWins || 0; bVal = b.penaltyWins || 0; break;
        case 'losses': aVal = a.losses; bVal = b.losses; break;
        case 'goalDifference': aVal = a.goalDifference; bVal = b.goalDifference; break;
        case 'seed': aVal = a.combinedSeed; bVal = b.combinedSeed; break;
        default: aVal = a.rank; bVal = b.rank;
      }
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return sorted;
  }

  function SortHeader({ label, columnKey, className, title }) {
    const isActive = sortKey === columnKey;
    const arrow = isActive ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '';
    return (
      <th
        className={`${className || ''} sortable-header${isActive ? ' sorted' : ''}`}
        onClick={() => handleSort(columnKey)}
        role="columnheader"
        title={title}
        aria-sort={isActive ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSort(columnKey); } }}
      >
        {label}{arrow}
      </th>
    );
  }

  function getTrophyIcon(rank) {
    if (!isTournamentComplete) return null;
    if (rank === 1) return '🏆';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return null;
  }

  function getParticipantTeams(participantId) {
    const alloc = allocations[participantId];
    if (!alloc) return [];
    return Object.values(alloc).flat();
  }

  function getSortedTeams(participantId) {
    const teamIds = getParticipantTeams(participantId);
    return [...teamIds].sort((a, b) => (teamSeedMap[a] || 99) - (teamSeedMap[b] || 99));
  }

  // Teams owned by this participant that are currently in a match in progress.
  function getParticipantLiveTeams(participantId) {
    if (liveTeamIds.size === 0) return [];
    return getParticipantTeams(participantId).filter((id) => liveTeamIds.has(id));
  }

  // Close popup on Escape
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') {
      setSelectedParticipant(null);
    }
  }, []);

  useEffect(() => {
    if (selectedParticipant) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [selectedParticipant, handleKeyDown]);

  function handleRowClick(entry) {
    setSelectedParticipant(entry);
  }

  function handleOverlayClick(e) {
    if (e.target === e.currentTarget) {
      setSelectedParticipant(null);
    }
  }

  return (
    <div className="standings-container">
      {isTournamentComplete && (
        <div className="standings-complete-banner">
          🏆 Tournament Complete — Final Standings
        </div>
      )}

      {!isTournamentComplete && hasLiveResults && (
        <div className="standings-live-banner">
          🔴 LIVE — points update in real time as matches play
        </div>
      )}

      <table className="standings-table" role="table">
        <thead>
          <tr>
            <SortHeader label="#" columnKey="rank" className="rank-cell" />
            <SortHeader label="Name" columnKey="name" />
            <SortHeader label="Pts" columnKey="points" />
            <SortHeader label="W" columnKey="wins" className="col-desktop stat-cell" />
            <SortHeader label="D" columnKey="draws" className="col-desktop stat-cell" />
            <SortHeader label="L" columnKey="losses" className="col-desktop stat-cell" />
            <SortHeader label="PW" columnKey="penaltyWins" className="col-desktop stat-cell" title="Penalty shootout wins" />
            <SortHeader label="GD" columnKey="goalDifference" className="col-desktop stat-cell" />
            <SortHeader label="Seed" columnKey="seed" className="col-desktop stat-cell" />
          </tr>
        </thead>
        <tbody>
          {getSortedStandings().map((entry) => {
            const trophy = getTrophyIcon(entry.rank);
            const liveTeams = getParticipantLiveTeams(entry.participantId);
            const liveTitle = liveTeams.length > 0
              ? `Live now: ${liveTeams.map((id) => teamNameMap[id] || id).join(', ')}`
              : '';

            return (
              <tr
                key={entry.participantId}
                className="standings-row"
                onClick={() => handleRowClick(entry)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter') handleRowClick(entry); }}
              >
                <td className="rank-cell">
                  {trophy ? (
                    <span className="rank-trophy">
                      <span className="trophy-icon">{trophy}</span>
                      {entry.rank}
                    </span>
                  ) : (
                    entry.rank
                  )}
                </td>
                <td className="name-cell">
                  {entry.participantName}
                  {liveTeams.length > 0 && (
                    <span className="name-live-badge" title={liveTitle} aria-label={liveTitle}>
                      ● LIVE
                    </span>
                  )}
                </td>
                <td className="points-cell">{entry.points}</td>
                <td className="col-desktop stat-cell">{entry.wins}</td>
                <td className="col-desktop stat-cell">{entry.draws}</td>
                <td className="col-desktop stat-cell">{entry.losses}</td>
                <td className="col-desktop stat-cell">{entry.penaltyWins || 0}</td>
                <td className="col-desktop stat-cell">{entry.goalDifference > 0 ? `+${entry.goalDifference}` : entry.goalDifference}</td>
                <td className="col-desktop stat-cell seed-cell">{entry.combinedSeed}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Participant Detail Popup */}
      {selectedParticipant && (
        <div className="participant-popup-overlay" onClick={handleOverlayClick}>
          <div className="participant-popup" role="dialog" aria-modal="true">
            <div className="participant-popup__header">
              <h2>{selectedParticipant.participantName}</h2>
              <button
                className="participant-popup__close"
                onClick={() => setSelectedParticipant(null)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="participant-popup__stats">
              <div className="popup-stat">
                <div className="popup-stat__value">{selectedParticipant.points}</div>
                <div className="popup-stat__label">Points</div>
              </div>
              <div className="popup-stat">
                <div className="popup-stat__value">{selectedParticipant.wins}</div>
                <div className="popup-stat__label">Wins</div>
              </div>
              <div className="popup-stat">
                <div className="popup-stat__value">{selectedParticipant.draws}</div>
                <div className="popup-stat__label">Draws</div>
              </div>
              <div className="popup-stat">
                <div className="popup-stat__value">{selectedParticipant.penaltyWins || 0}</div>
                <div className="popup-stat__label">Pen Wins</div>
              </div>
              <div className="popup-stat">
                <div className="popup-stat__value">{selectedParticipant.losses}</div>
                <div className="popup-stat__label">Losses</div>
              </div>
              <div className="popup-stat">
                <div className="popup-stat__value">{selectedParticipant.goalsScored}</div>
                <div className="popup-stat__label">GF</div>
              </div>
              <div className="popup-stat">
                <div className="popup-stat__value">{selectedParticipant.goalsConceded}</div>
                <div className="popup-stat__label">GA</div>
              </div>
              <div className="popup-stat">
                <div className="popup-stat__value">
                  {selectedParticipant.goalDifference > 0 ? `+${selectedParticipant.goalDifference}` : selectedParticipant.goalDifference}
                </div>
                <div className="popup-stat__label">GD</div>
              </div>
            </div>

            <div className="participant-popup__teams">
              <h3>Teams</h3>
              <div className="popup-teams-list">
                {getSortedTeams(selectedParticipant.participantId).map((teamId) => {
                  const isEliminated = eliminatedTeams.has(teamId);
                  const odds = tournamentOdds?.[teamId];
                  const seed = teamSeedMap[teamId];
                  return (
                    <button
                      key={teamId}
                      className={`popup-team-item ${isEliminated ? 'eliminated' : ''}`}
                      onClick={(e) => { e.stopPropagation(); onTeamClick?.(teamId); }}
                    >
                      <span className="popup-team-seed">#{seed}</span>
                      <span className="popup-team-name">{teamNameMap[teamId] || teamId}</span>
                      {odds && <span className="popup-team-odds">{odds.toFixed(1)}</span>}
                      {isEliminated && <span className="popup-team-eliminated">OUT</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
