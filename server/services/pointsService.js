import { readFile } from './storageService.js';
import { getLeague } from './leagueService.js';

const RESULTS_FILE = 'results.json';

/**
 * Calculate points and stats for a single participant in a league.
 * @param {string} participantId - The participant's ID (e.g., "p1")
 * @param {string} leagueSlug - The league slug
 * @returns {Promise<Object>} Stats object with points, wins, draws, losses, goalsScored, goalsConceded, goalDifference
 */
export async function calculatePoints(participantId, leagueSlug) {
  const league = await getLeague(leagueSlug);
  const allocations = league.draft.allocations[participantId];

  if (!allocations) {
    return {
      points: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goalsScored: 0,
      goalsConceded: 0,
      goalDifference: 0
    };
  }

  const participantTeams = Object.values(allocations).flat();
  const data = await readFile(RESULTS_FILE);
  const results = data.results;

  let points = 0;
  let wins = 0;
  let draws = 0;
  let losses = 0;
  let goalsScored = 0;
  let goalsConceded = 0;

  for (const result of results) {
    for (const teamId of participantTeams) {
      if (result.homeTeam === teamId) {
        goalsScored += result.homeScore;
        goalsConceded += result.awayScore;
        if (result.homeScore > result.awayScore) {
          points += 3;
          wins++;
        } else if (result.homeScore === result.awayScore) {
          points += 1;
          draws++;
          if (result.penaltyShootout?.winner === teamId) {
            points += 1;
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
          draws++;
          if (result.penaltyShootout?.winner === teamId) {
            points += 1;
          }
        } else {
          losses++;
        }
      }
    }
  }

  return {
    points,
    wins,
    draws,
    losses,
    goalsScored,
    goalsConceded,
    goalDifference: goalsScored - goalsConceded
  };
}

/**
 * Rank participants by points, wins, and goal difference.
 * Tied participants share a rank; the next rank skips positions.
 * @param {Array<Object>} standings - Array of standing objects with points, wins, goalDifference
 * @returns {Array<Object>} Sorted standings with rank assigned
 */
export function rankParticipants(standings) {
  standings.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.wins !== a.wins) return b.wins - a.wins;
    return b.goalDifference - a.goalDifference;
  });

  for (let i = 0; i < standings.length; i++) {
    if (i === 0) {
      standings[i].rank = 1;
    } else {
      const prev = standings[i - 1];
      const curr = standings[i];
      if (
        curr.points === prev.points &&
        curr.wins === prev.wins &&
        curr.goalDifference === prev.goalDifference
      ) {
        curr.rank = prev.rank;
      } else {
        curr.rank = i + 1;
      }
    }
  }

  return standings;
}

/**
 * Get full league standings for all participants in a league.
 * @param {string} leagueSlug - The league slug
 * @returns {Promise<Array<Object>>} Ranked standings array
 */
export async function getLeagueStandings(leagueSlug) {
  const league = await getLeague(leagueSlug);

  if (!league.participants || league.participants.length === 0) {
    return [];
  }

  const standings = [];

  for (const participant of league.participants) {
    const stats = await calculatePoints(participant.id, leagueSlug);
    standings.push({
      participantId: participant.id,
      participantName: participant.name,
      ...stats
    });
  }

  return rankParticipants(standings);
}
