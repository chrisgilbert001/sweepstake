import { readFile } from './storageService.js';

const TEAMS_FILE = 'teams.json';

/**
 * Get the full pot structure with all teams.
 * @returns {Promise<{pots: Array}>} The complete teams data
 */
export async function getAllTeams() {
  return await readFile(TEAMS_FILE);
}

/**
 * Get teams in a specific pot.
 * @param {number} potNumber - The pot number (1-4)
 * @returns {Promise<Array>} Array of team objects in the specified pot
 * @throws {Object} Error if pot number is invalid
 */
export async function getTeamsInPot(potNumber) {
  if (!Number.isInteger(potNumber) || potNumber < 1 || potNumber > 4) {
    throw { statusCode: 400, message: 'Invalid pot number', details: 'Pot number must be 1, 2, 3, or 4' };
  }

  const data = await readFile(TEAMS_FILE);
  const pot = data.pots.find(p => p.potNumber === potNumber);

  if (!pot) {
    throw { statusCode: 500, message: 'Pot not found', details: `Pot ${potNumber} not found in teams data` };
  }

  return pot.teams;
}

/**
 * Check if a team ID exists in the 48-team pool.
 * @param {string} teamId - The team ID to check
 * @returns {Promise<boolean>} True if the team exists
 */
export async function teamExists(teamId) {
  const data = await readFile(TEAMS_FILE);
  return data.pots.some(pot => pot.teams.some(team => team.id === teamId));
}

/**
 * Get a team object by its ID.
 * @param {string} teamId - The team ID to find
 * @returns {Promise<Object|null>} The team object if found, null otherwise
 */
export async function getTeamById(teamId) {
  const data = await readFile(TEAMS_FILE);
  for (const pot of data.pots) {
    const team = pot.teams.find(t => t.id === teamId);
    if (team) {
      return team;
    }
  }
  return null;
}

/**
 * Get a flat array of all 48 team IDs.
 * @returns {Promise<string[]>} Array of all team IDs
 */
export async function getAllTeamIds() {
  const data = await readFile(TEAMS_FILE);
  return data.pots.flatMap(pot => pot.teams.map(team => team.id));
}

/**
 * Get the pot number for a given seed rank.
 * Uses ceil(rank/12) to determine pot assignment.
 * @param {number} seedRank - The seed rank (1-48)
 * @returns {number} The pot number (1-4)
 */
export function getPotForSeedRank(seedRank) {
  if (!Number.isInteger(seedRank) || seedRank < 1 || seedRank > 48) {
    throw { statusCode: 400, message: 'Invalid seed rank', details: 'Seed rank must be between 1 and 48' };
  }
  return Math.ceil(seedRank / 12);
}
