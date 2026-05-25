import { readFile } from './storageService.js';

const GROUPS_FILE = 'groups.json';
const RESULTS_FILE = 'results.json';
const TEAMS_FILE = 'teams.json';

/**
 * Build a lookup map from team ID to team name.
 * @param {Object} teamsData - The teams data with pots structure
 * @returns {Map<string, string>} Map of teamId → teamName
 */
function buildTeamNameMap(teamsData) {
  const map = new Map();
  for (const pot of teamsData.pots) {
    for (const team of pot.teams) {
      map.set(team.id, team.name);
    }
  }
  return map;
}

/**
 * Create a default stats object for a team with all values at zero.
 * @param {string} teamId - The team ID
 * @param {string} teamName - The team display name
 * @returns {Object} Default GroupTeamEntry
 */
function createDefaultStats(teamId, teamName) {
  return {
    teamId,
    teamName,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
    points: 0
  };
}

/**
 * Sort teams within a group by: points desc, goal difference desc, goals scored desc.
 * @param {Object[]} teams - Array of GroupTeamEntry objects
 * @returns {Object[]} Sorted array
 */
function sortGroupTeams(teams) {
  return teams.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
    return b.goalsFor - a.goalsFor;
  });
}

/**
 * Compute group standings from groups.json and group-stage results.
 * Returns all 12 groups with 4 teams each, sorted by points/GD/GF.
 * Defaults to 0 values when no results exist.
 *
 * @returns {Promise<Object[]>} Array of GroupStanding objects
 */
export async function getGroupStandings() {
  const [groupsData, resultsData, teamsData] = await Promise.all([
    readFile(GROUPS_FILE),
    readFile(RESULTS_FILE),
    readFile(TEAMS_FILE)
  ]);

  const teamNameMap = buildTeamNameMap(teamsData);

  // Filter results to only "Group Stage" stage
  const groupStageResults = resultsData.results.filter(r => r.stage === 'Group Stage');

  // Build a set of team IDs per group for quick lookup
  const groupTeamSets = new Map();
  for (const group of groupsData.groups) {
    groupTeamSets.set(group.name, new Set(group.teams));
  }

  // Compute standings for each group
  const standings = groupsData.groups.map(group => {
    const teamSet = groupTeamSets.get(group.name);

    // Initialize stats for each team in the group
    const statsMap = new Map();
    for (const teamId of group.teams) {
      const teamName = teamNameMap.get(teamId) || teamId;
      statsMap.set(teamId, createDefaultStats(teamId, teamName));
    }

    // Process group-stage results where both teams are in this group
    for (const result of groupStageResults) {
      if (!teamSet.has(result.homeTeam) || !teamSet.has(result.awayTeam)) {
        continue;
      }

      const homeStats = statsMap.get(result.homeTeam);
      const awayStats = statsMap.get(result.awayTeam);

      if (!homeStats || !awayStats) continue;

      // Update played
      homeStats.played += 1;
      awayStats.played += 1;

      // Update goals
      homeStats.goalsFor += result.homeScore;
      homeStats.goalsAgainst += result.awayScore;
      awayStats.goalsFor += result.awayScore;
      awayStats.goalsAgainst += result.homeScore;

      // Determine outcome
      if (result.homeScore > result.awayScore) {
        homeStats.won += 1;
        awayStats.lost += 1;
      } else if (result.homeScore < result.awayScore) {
        homeStats.lost += 1;
        awayStats.won += 1;
      } else {
        homeStats.drawn += 1;
        awayStats.drawn += 1;
      }
    }

    // Calculate derived fields and collect teams
    const teams = [];
    for (const stats of statsMap.values()) {
      stats.goalDifference = stats.goalsFor - stats.goalsAgainst;
      stats.points = (stats.won * 3) + stats.drawn;
      teams.push(stats);
    }

    return {
      group: group.name,
      teams: sortGroupTeams(teams)
    };
  });

  return standings;
}
