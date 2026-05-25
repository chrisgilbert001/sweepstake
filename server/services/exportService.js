import { getLeague } from './leagueService.js';
import { getLeagueStandings } from './pointsService.js';

/**
 * Generate a plain-text standings summary for a league.
 * Format:
 *   {League Name} - Standings ({DD/MM/YYYY})
 *
 *   1. {Participant Name} - {Points} pts
 *   2. {Participant Name} - {Points} pts
 *   ...
 *
 * @param {string} leagueSlug - The league slug
 * @returns {Promise<string>} Plain-text standings summary
 */
export async function generateStandingsText(leagueSlug) {
  const league = await getLeague(leagueSlug);
  const standings = await getLeagueStandings(leagueSlug);

  const now = new Date();
  const day = String(now.getUTCDate()).padStart(2, '0');
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const year = now.getUTCFullYear();
  const dateStr = `${day}/${month}/${year}`;

  const header = `${league.name} - Standings (${dateStr})`;

  const lines = standings.map(
    (entry) => `${entry.rank}. ${entry.participantName} - ${entry.points} pts`
  );

  return [header, '', ...lines].join('\n');
}
