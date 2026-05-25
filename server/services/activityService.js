import { readFile } from './storageService.js';
import { getLeague } from './leagueService.js';

const RESULTS_FILE = 'results.json';
const TEAMS_FILE = 'teams.json';

const KNOCKOUT_STAGES = [
  'Round of 32',
  'Round of 16',
  'Quarter-finals',
  'Semi-finals',
  'Final'
];

/**
 * Get all team IDs allocated to participants in a league.
 * Returns a map of teamId -> participant name.
 * @param {object} league - The league object
 * @returns {Map<string, string>} teamId -> participant name
 */
function buildTeamOwnerMap(league) {
  const teamOwnerMap = new Map();
  if (!league.draft || !league.draft.allocations) return teamOwnerMap;

  for (const participant of league.participants) {
    const allocations = league.draft.allocations[participant.id];
    if (!allocations) continue;
    const teamIds = Object.values(allocations).flat();
    for (const teamId of teamIds) {
      teamOwnerMap.set(teamId, participant.name);
    }
  }
  return teamOwnerMap;
}

/**
 * Build a map of team ID -> team name from teams data.
 * @param {object} teamsData - The teams.json data
 * @returns {Map<string, string>} teamId -> team name
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
 * Calculate points for a team in a single match result.
 * 3 per win, 1 per draw, 1 bonus for penalty shootout win.
 * @param {object} result - The match result
 * @param {string} teamId - The team to calculate points for
 * @returns {number} Points earned
 */
function calculateMatchPoints(result, teamId) {
  const isHome = result.homeTeam === teamId;
  const teamScore = isHome ? result.homeScore : result.awayScore;
  const opponentScore = isHome ? result.awayScore : result.homeScore;

  if (teamScore > opponentScore) {
    return 3;
  } else if (teamScore === opponentScore) {
    let points = 1;
    if (result.penaltyShootout && result.penaltyShootout.winner === teamId) {
      points += 1;
    }
    return points;
  }
  return 0;
}

/**
 * Determine if a team was eliminated in a knockout match.
 * A team is eliminated when they lose in a knockout stage.
 * The loser is the team with fewer goals, or the team that lost the penalty shootout.
 * @param {object} result - The match result
 * @param {string} teamId - The team to check
 * @returns {boolean} True if the team was eliminated
 */
function isTeamEliminated(result, teamId) {
  if (!KNOCKOUT_STAGES.includes(result.stage)) return false;

  const isHome = result.homeTeam === teamId;
  const teamScore = isHome ? result.homeScore : result.awayScore;
  const opponentScore = isHome ? result.awayScore : result.homeScore;

  if (teamScore < opponentScore) {
    // Team lost outright
    return true;
  } else if (teamScore === opponentScore) {
    // Draw in knockout - check penalty shootout
    if (result.penaltyShootout) {
      return result.penaltyShootout.winner !== teamId;
    }
    // No penalty shootout recorded yet - not eliminated
    return false;
  }
  return false;
}

/**
 * Generate activity events for a league from results and eliminations.
 * @param {string} leagueSlug - The league slug
 * @param {number} [page=1] - Page number (1-indexed)
 * @param {number} [limit=50] - Events per page
 * @returns {Promise<object>} ActivityPage: { events, page, totalPages, totalEvents }
 */
export async function getActivityFeed(leagueSlug, page = 1, limit = 50) {
  const league = await getLeague(leagueSlug);
  const resultsData = await readFile(RESULTS_FILE);
  const teamsData = await readFile(TEAMS_FILE);

  const results = resultsData.results || [];
  const teamOwnerMap = buildTeamOwnerMap(league);
  const teamNameMap = buildTeamNameMap(teamsData);

  const events = [];

  for (const result of results) {
    const homeOwner = teamOwnerMap.get(result.homeTeam) || null;
    const awayOwner = teamOwnerMap.get(result.awayTeam) || null;

    // Only generate events if at least one team is allocated in this league
    if (!homeOwner && !awayOwner) continue;

    // Generate match_result event
    const homePoints = homeOwner ? calculateMatchPoints(result, result.homeTeam) : 0;
    const awayPoints = awayOwner ? calculateMatchPoints(result, result.awayTeam) : 0;

    events.push({
      id: `mr-${result.id}`,
      type: 'match_result',
      timestamp: result.date,
      data: {
        fixtureId: result.fixtureId,
        homeTeam: teamNameMap.get(result.homeTeam) || result.homeTeam,
        awayTeam: teamNameMap.get(result.awayTeam) || result.awayTeam,
        homeScore: result.homeScore,
        awayScore: result.awayScore,
        stage: result.stage,
        homeOwner,
        awayOwner,
        homePoints,
        awayPoints
      }
    });

    // Generate team_eliminated events for knockout matches
    if (KNOCKOUT_STAGES.includes(result.stage)) {
      // Check home team elimination
      if (homeOwner && isTeamEliminated(result, result.homeTeam)) {
        events.push({
          id: `te-${result.id}-${result.homeTeam}`,
          type: 'team_eliminated',
          timestamp: result.date,
          data: {
            teamId: result.homeTeam,
            teamName: teamNameMap.get(result.homeTeam) || result.homeTeam,
            owner: homeOwner,
            stage: result.stage
          }
        });
      }

      // Check away team elimination
      if (awayOwner && isTeamEliminated(result, result.awayTeam)) {
        events.push({
          id: `te-${result.id}-${result.awayTeam}`,
          type: 'team_eliminated',
          timestamp: result.date,
          data: {
            teamId: result.awayTeam,
            teamName: teamNameMap.get(result.awayTeam) || result.awayTeam,
            owner: awayOwner,
            stage: result.stage
          }
        });
      }
    }
  }

  // Sort events by timestamp descending (most recent first)
  events.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  // Apply pagination
  const totalEvents = events.length;
  const totalPages = Math.max(1, Math.ceil(totalEvents / limit));
  const startIndex = (page - 1) * limit;
  const paginatedEvents = events.slice(startIndex, startIndex + limit);

  return {
    events: paginatedEvents,
    page,
    totalPages,
    totalEvents
  };
}
