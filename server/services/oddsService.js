import { readFile, writeFile, updateFile } from './storageService.js';
import { getAllTeamIds } from './teamService.js';

const ODDS_FILE = 'odds.json';

/**
 * Set tournament odds for all 48 teams.
 * Validates that all 48 teams are present and all values are > 1.0.
 * Tournament odds are immutable once set.
 * @param {Object} oddsData - Map of teamId to decimal odds value
 * @returns {Promise<Object>} The stored tournament odds snapshot
 * @throws {Object} Error if validation fails or odds already exist
 */
export async function setTournamentOdds(oddsData) {
  const currentData = await readFile(ODDS_FILE);

  if (currentData.tournament !== null) {
    throw { statusCode: 400, message: 'Tournament odds already set', details: 'Tournament odds are immutable once recorded' };
  }

  const allTeamIds = await getAllTeamIds();

  // Validate all 48 teams are present
  const providedTeamIds = Object.keys(oddsData);
  if (providedTeamIds.length !== 48) {
    throw { statusCode: 400, message: 'Odds must be provided for all 48 teams', details: `Expected 48 teams, received ${providedTeamIds.length}` };
  }

  for (const teamId of allTeamIds) {
    if (!(teamId in oddsData)) {
      throw { statusCode: 400, message: 'Odds must be provided for all 48 teams', details: `Missing odds for team: ${teamId}` };
    }
  }

  // Validate all values are numbers > 1.0
  for (const [teamId, value] of Object.entries(oddsData)) {
    if (typeof value !== 'number' || value <= 1.0) {
      throw { statusCode: 400, message: 'Odds must be greater than 1.0', details: `Invalid odds value for team ${teamId}: ${value}` };
    }
  }

  const snapshot = {
    capturedAt: new Date().toISOString(),
    odds: { ...oddsData }
  };

  await updateFile(ODDS_FILE, (data) => ({
    ...data,
    tournament: snapshot
  }));

  return snapshot;
}

/**
 * Get the stored tournament odds.
 * @returns {Promise<Object|null>} The tournament odds snapshot, or null if not yet set
 */
export async function getTournamentOdds() {
  const data = await readFile(ODDS_FILE);
  return data.tournament;
}

/**
 * Set match odds for a specific fixture.
 * @param {string} fixtureId - The fixture ID
 * @param {Object} oddsData - Odds object with team keys and optionally "draw"
 * @returns {Promise<Object>} The stored match odds
 */
export async function setMatchOdds(fixtureId, oddsData) {
  if (!fixtureId || typeof fixtureId !== 'string') {
    throw { statusCode: 400, message: 'Invalid fixture ID', details: 'Fixture ID must be a non-empty string' };
  }

  if (!oddsData || typeof oddsData !== 'object' || Object.keys(oddsData).length === 0) {
    throw { statusCode: 400, message: 'Invalid odds data', details: 'Odds data must be a non-empty object' };
  }

  // Validate all odds values are numbers > 1.0
  for (const [key, value] of Object.entries(oddsData)) {
    if (typeof value !== 'number' || value <= 1.0) {
      throw { statusCode: 400, message: 'Odds must be greater than 1.0', details: `Invalid odds value for ${key}: ${value}` };
    }
  }

  await updateFile(ODDS_FILE, (data) => ({
    ...data,
    matches: {
      ...data.matches,
      [fixtureId]: { ...oddsData }
    }
  }));

  return oddsData;
}

/**
 * Get match odds for a specific fixture.
 * @param {string} fixtureId - The fixture ID
 * @returns {Promise<Object|null>} The match odds, or null if not set
 */
export async function getMatchOdds(fixtureId) {
  const data = await readFile(ODDS_FILE);
  return data.matches[fixtureId] || null;
}

/**
 * Determine the underdog from match odds.
 * The underdog is the team with the higher odds value (less likely to win).
 * @param {Object} matchOdds - Odds object with team keys (excludes "draw")
 * @returns {string|null} The team ID of the underdog, or null if odds are equal
 */
export function getUnderdog(matchOdds) {
  if (!matchOdds || typeof matchOdds !== 'object') {
    return null;
  }

  // Filter out the "draw" key to get only team odds
  const teamEntries = Object.entries(matchOdds).filter(([key]) => key !== 'draw');

  if (teamEntries.length !== 2) {
    return null;
  }

  const [team1, odds1] = teamEntries[0];
  const [team2, odds2] = teamEntries[1];

  if (odds1 === odds2) {
    return null;
  }

  return odds1 > odds2 ? team1 : team2;
}
