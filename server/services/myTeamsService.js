import { readFile } from './storageService.js';
import { getLeague } from './leagueService.js';

const RESULTS_FILE = 'results.json';
const FIXTURES_FILE = 'fixtures.json';
const TEAMS_FILE = 'teams.json';

/**
 * Get the "My Teams" dashboard data for a specific participant in a league.
 * Returns per-team stats grouped by pot, with form indicators and upcoming fixtures.
 *
 * @param {string} leagueSlug - The league slug
 * @param {string} participantId - The participant's ID (e.g., "p1")
 * @returns {Promise<{totalPoints: number, teams: Array}>} MyTeamsData
 * @throws {object} 404 if league or participant not found
 */
export async function getMyTeamsData(leagueSlug, participantId) {
  const league = await getLeague(leagueSlug);

  // Verify participant exists in the league
  const participant = league.participants.find(p => p.id === participantId);
  if (!participant) {
    throw { statusCode: 404, message: 'Participant not found' };
  }

  const allocations = league.draft.allocations[participantId];
  if (!allocations) {
    return { totalPoints: 0, teams: [] };
  }

  const [resultsData, fixturesData, teamsData] = await Promise.all([
    readFile(RESULTS_FILE),
    readFile(FIXTURES_FILE),
    readFile(TEAMS_FILE)
  ]);

  const results = resultsData.results;
  const fixtures = fixturesData.fixtures;
  const teamLookup = buildTeamLookup(teamsData);

  const now = new Date();
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const teamEntries = [];

  // Iterate over each pot in the allocations
  for (const [potKey, teamIds] of Object.entries(allocations)) {
    const potNumber = parseInt(potKey.replace('pot', ''), 10);

    for (const teamId of teamIds) {
      const teamName = teamLookup[teamId] || teamId;
      const stats = calculateTeamStats(teamId, results);
      const form = calculateForm(teamId, results);
      const upcoming = getUpcomingFixtures(teamId, fixtures, teamLookup, now, sevenDaysFromNow);

      teamEntries.push({
        teamId,
        teamName,
        pot: potNumber,
        points: stats.points,
        wins: stats.wins,
        draws: stats.draws,
        penaltyWins: stats.penaltyWins,
        losses: stats.losses,
        goalsScored: stats.goalsScored,
        goalsConceded: stats.goalsConceded,
        form,
        upcomingFixtures: upcoming
      });
    }
  }

  const totalPoints = teamEntries.reduce((sum, entry) => sum + entry.points, 0);

  return { totalPoints, teams: teamEntries };
}

/**
 * Build a lookup map from team ID to team name.
 * @param {object} teamsData - The teams.json data with pots array
 * @returns {Record<string, string>} Map of teamId -> teamName
 */
function buildTeamLookup(teamsData) {
  const lookup = {};
  for (const pot of teamsData.pots) {
    for (const team of pot.teams) {
      lookup[team.id] = team.name;
    }
  }
  return lookup;
}

/**
 * Calculate stats for a single team from all results.
 * Points: 3 per win, 1 per draw, +1 bonus for a penalty shootout win.
 * A shootout win is counted under penaltyWins (not draws); the shootout loser
 * still counts as a draw (1 point, no bonus).
 *
 * @param {string} teamId
 * @param {Array} results
 * @returns {{points: number, wins: number, draws: number, penaltyWins: number, losses: number, goalsScored: number, goalsConceded: number}}
 */
export function calculateTeamStats(teamId, results) {
  let points = 0;
  let wins = 0;
  let draws = 0;
  let penaltyWins = 0;
  let losses = 0;
  let goalsScored = 0;
  let goalsConceded = 0;

  for (const result of results) {
    // The third-place playoff does not count toward sweepstake scoring.
    // Accept both the API-sync name and the manual-entry name.
    if (result.stage === 'Third Place' || result.stage === 'Third-place playoff') continue;
    if (result.homeTeam === teamId) {
      goalsScored += result.homeScore;
      goalsConceded += result.awayScore;
      if (result.homeScore > result.awayScore) {
        points += 3;
        wins++;
      } else if (result.homeScore === result.awayScore) {
        points += 1;
        if (result.penaltyShootout?.winner === teamId) {
          points += 1;
          penaltyWins++;
        } else {
          draws++;
        }
      } else {
        losses++;
      }
    } else if (result.awayTeam === teamId) {
      goalsScored += result.awayScore;
      goalsConceded += result.homeScore;
      if (result.awayScore > result.homeScore) {
        points += 3;
        wins++;
      } else if (result.homeScore === result.awayScore) {
        points += 1;
        if (result.penaltyShootout?.winner === teamId) {
          points += 1;
          penaltyWins++;
        } else {
          draws++;
        }
      } else {
        losses++;
      }
    }
  }

  return { points, wins, draws, penaltyWins, losses, goalsScored, goalsConceded };
}

/**
 * Calculate form indicator: last 5 results as W/D/L/P sequence, most recent
 * first. "P" marks a win on a penalty shootout (a level match won on pens);
 * the shootout loser is still recorded as "D".
 *
 * @param {string} teamId
 * @param {Array} results
 * @returns {Array<"W"|"D"|"L"|"P">}
 */
export function calculateForm(teamId, results) {
  // Filter results involving this team
  const teamResults = results.filter(
    r => r.homeTeam === teamId || r.awayTeam === teamId
  );

  // Sort by date descending (most recent first)
  teamResults.sort((a, b) => new Date(b.date) - new Date(a.date));

  // Take last 5 (most recent)
  const recent = teamResults.slice(0, 5);

  return recent.map(result => {
    const isHome = result.homeTeam === teamId;
    const teamScore = isHome ? result.homeScore : result.awayScore;
    const opponentScore = isHome ? result.awayScore : result.homeScore;

    if (teamScore > opponentScore) return 'W';
    if (teamScore === opponentScore) {
      return result.penaltyShootout?.winner === teamId ? 'P' : 'D';
    }
    return 'L';
  });
}

/**
 * Get upcoming fixtures for a team within the next 7 days.
 *
 * @param {string} teamId
 * @param {Array} fixtures
 * @param {Record<string, string>} teamLookup
 * @param {Date} now - Current date/time
 * @param {Date} sevenDaysFromNow - Date 7 days from now
 * @returns {Array<{opponentId: string, opponentName: string, date: string, stage: string}>}
 */
export function getUpcomingFixtures(teamId, fixtures, teamLookup, now, sevenDaysFromNow) {
  const upcoming = [];

  for (const fixture of fixtures) {
    if (fixture.status !== 'scheduled') continue;

    const fixtureDate = new Date(fixture.date);
    if (fixtureDate < now || fixtureDate > sevenDaysFromNow) continue;

    let opponentId = null;
    if (fixture.homeTeam === teamId) {
      opponentId = fixture.awayTeam;
    } else if (fixture.awayTeam === teamId) {
      opponentId = fixture.homeTeam;
    }

    if (opponentId !== null) {
      upcoming.push({
        opponentId,
        opponentName: teamLookup[opponentId] || opponentId,
        date: fixture.date,
        stage: fixture.stage
      });
    }
  }

  // Sort by date ascending
  upcoming.sort((a, b) => new Date(a.date) - new Date(b.date));

  return upcoming;
}
