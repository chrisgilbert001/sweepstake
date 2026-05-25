import { useState, useEffect, useCallback } from 'react';
import { useLeague } from '../context/LeagueContext.jsx';
import { getGroupStandings } from '../api/groups.js';
import './GroupStageTable.css';

export default function GroupStageTable() {
  const { league, loading: leagueLoading } = useLeague();

  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const groupsData = await getGroupStandings();
      setGroups(Array.isArray(groupsData) ? groupsData : []);
      setError(null);
    } catch (err) {
      setError(err.message || 'Failed to load group standings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Build a map of teamId -> participant name for this league
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

  if (loading || leagueLoading) {
    return (
      <div className="container groups-loading">
        <p>Loading group standings...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container groups-error">
        <h2>Error</h2>
        <p>{error}</p>
      </div>
    );
  }

  const ownerMap = getOwnerMap();

  return (
    <div className="container groups-view">
      <div className="groups-header">
        <h1>Group Stage Tables</h1>
      </div>

      <div className="groups-grid">
        {groups.map((group) => (
          <div key={group.group} className="group-card">
            <h2 className="group-title">Group {group.group}</h2>
            <div className="group-table-wrapper">
              <table className="group-table">
                <thead>
                  <tr>
                    <th className="col-pos">#</th>
                    <th className="col-team">Team</th>
                    <th className="col-stat">P</th>
                    <th className="col-stat">W</th>
                    <th className="col-stat">D</th>
                    <th className="col-stat">L</th>
                    <th className="col-stat">GF</th>
                    <th className="col-stat">GA</th>
                    <th className="col-stat">GD</th>
                    <th className="col-stat col-pts">Pts</th>
                  </tr>
                </thead>
                <tbody>
                  {group.teams.map((team, index) => {
                    const owner = ownerMap[team.teamId];
                    const isOwned = !!owner;
                    const isQualificationLine = index === 1;

                    return (
                      <tr
                        key={team.teamId}
                        className={`group-row ${isOwned ? 'group-row-owned' : ''} ${isQualificationLine ? 'group-row-qualification-border' : ''}`}
                      >
                        <td className="col-pos">{index + 1}</td>
                        <td className="col-team">
                          <span className="team-name">{team.teamName}</span>
                          <span className="team-code">{team.teamId.toUpperCase()}</span>
                          {isOwned && <span className="team-owner">{owner}</span>}
                        </td>
                        <td className="col-stat">{team.played}</td>
                        <td className="col-stat">{team.won}</td>
                        <td className="col-stat">{team.drawn}</td>
                        <td className="col-stat">{team.lost}</td>
                        <td className="col-stat">{team.goalsFor}</td>
                        <td className="col-stat">{team.goalsAgainst}</td>
                        <td className="col-stat">{team.goalDifference}</td>
                        <td className="col-stat col-pts">{team.points}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
