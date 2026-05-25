import { readFile } from './storageService.js';
import { getLeague } from './leagueService.js';

const RESULTS_FILE = 'results.json';
const TEAMS_FILE = 'teams.json';

/**
 * Build a map of teamId → team name from the teams data.
 * @param {object} teamsData - The parsed teams.json content
 * @returns {Map<string, string>} Map of teamId to team name
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
 * Build a map of teamId → participantId for a given league.
 * @param {object} league - The league data
 * @returns {Map<string, string>} Map of teamId to participantId
 */
function buildTeamOwnerMap(league) {
  const map = new Map();
  const allocations = league.draft?.allocations || {};

  for (const [participantId, pots] of Object.entries(allocations)) {
    for (const teamIds of Object.values(pots)) {
      for (const teamId of teamIds) {
        map.set(teamId, participantId);
      }
    }
  }

  return map;
}

/**
 * Build a map of participantId → participant name.
 * @param {object} league - The league data
 * @returns {Map<string, string>} Map of participantId to participant name
 */
function buildParticipantNameMap(league) {
  const map = new Map();
  for (const participant of league.participants || []) {
    map.set(participant.id, participant.name);
  }
  return map;
}

/**
 * Calculate points earned by a team in a single result.
 * @param {string} teamId - The team to calculate points for
 * @param {object} result - The match result
 * @returns {number} Points earned (3 for win, 1 for draw, +1 bonus for penalty shootout win)
 */
function calculatePointsForTeam(teamId, result) {
  let points = 0;
  const isHome = result.homeTeam === teamId;
  const isAway = result.awayTeam === teamId;

  if (!isHome && !isAway) return 0;

  const teamScore = isHome ? result.homeScore : result.awayScore;
  const opponentScore = isHome ? result.awayScore : result.homeScore;

  if (teamScore > opponentScore) {
    points = 3;
  } else if (teamScore === opponentScore) {
    points = 1;
    if (result.penaltyShootout?.winner === teamId) {
      points += 1;
    }
  }

  return points;
}

/**
 * Extract the UTC calendar date (YYYY-MM-DD) from an ISO date string.
 * @param {string} dateStr - ISO 8601 date string
 * @returns {string} UTC date in YYYY-MM-DD format
 */
function getUTCDate(dateStr) {
  const d = new Date(dateStr);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Compute the points history for a league.
 * Returns cumulative points per participant per match day, with match result details.
 *
 * @param {string} leagueSlug - The league slug
 * @returns {Promise<Array>} Array of PointsHistoryEntry objects
 */
export async function getPointsHistory(leagueSlug) {
  const league = await getLeague(leagueSlug);
  const resultsData = await readFile(RESULTS_FILE);
  const teamsData = await readFile(TEAMS_FILE);

  const results = resultsData.results || [];
  const teamNameMap = buildTeamNameMap(teamsData);
  const teamOwnerMap = buildTeamOwnerMap(league);
  const participantNameMap = buildParticipantNameMap(league);

  if (!league.participants || league.participants.length === 0) {
    return [];
  }

  // Get all participant team IDs for filtering relevant results
  const allLeagueTeamIds = new Set(teamOwnerMap.keys());

  // Filter results to only those involving at least one league participant's team
  const relevantResults = results.filter(
    r => allLeagueTeamIds.has(r.homeTeam) || allLeagueTeamIds.has(r.awayTeam)
  );

  if (relevantResults.length === 0) {
    return [];
  }

  // Group relevant results by UTC calendar date
  const resultsByDate = new Map();
  for (const result of relevantResults) {
    const matchDay = getUTCDate(result.date);
    if (!resultsByDate.has(matchDay)) {
      resultsByDate.set(matchDay, []);
    }
    resultsByDate.get(matchDay).push(result);
  }

  // Sort match days chronologically
  const sortedMatchDays = [...resultsByDate.keys()].sort();

  // Build cumulative points history
  const cumulativePoints = new Map();
  for (const participant of league.participants) {
    cumulativePoints.set(participant.id, 0);
  }

  const history = [];

  for (const matchDay of sortedMatchDays) {
    const dayResults = resultsByDate.get(matchDay);
    const participantEntries = [];

    for (const participant of league.participants) {
      const matchResults = [];
      let dayPoints = 0;

      for (const result of dayResults) {
        // Check if any of this participant's teams are involved
        const participantTeams = getParticipantTeams(league, participant.id);

        for (const teamId of participantTeams) {
          if (result.homeTeam === teamId || result.awayTeam === teamId) {
            const pointsEarned = calculatePointsForTeam(teamId, result);
            dayPoints += pointsEarned;

            const isHome = result.homeTeam === teamId;
            const opponentId = isHome ? result.awayTeam : result.homeTeam;
            const score = `${result.homeScore}-${result.awayScore}`;

            matchResults.push({
              teamId,
              teamName: teamNameMap.get(teamId) || teamId,
              opponentId,
              opponentName: teamNameMap.get(opponentId) || opponentId,
              score,
              pointsEarned
            });
          }
        }
      }

      const prevCumulative = cumulativePoints.get(participant.id);
      const newCumulative = prevCumulative + dayPoints;
      cumulativePoints.set(participant.id, newCumulative);

      participantEntries.push({
        participantId: participant.id,
        participantName: participant.name,
        cumulativePoints: newCumulative,
        matchResults
      });
    }

    history.push({
      matchDay,
      participants: participantEntries
    });
  }

  return history;
}

/**
 * Get all team IDs allocated to a participant.
 * @param {object} league - The league data
 * @param {string} participantId - The participant ID
 * @returns {string[]} Array of team IDs
 */
function getParticipantTeams(league, participantId) {
  const allocations = league.draft?.allocations?.[participantId] || {};
  const teams = [];
  for (const teamIds of Object.values(allocations)) {
    teams.push(...teamIds);
  }
  return teams;
}
