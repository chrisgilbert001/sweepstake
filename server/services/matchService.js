import { readFile, updateFile } from './storageService.js';
import { teamExists } from './teamService.js';
import { checkTournamentComplete } from './tournamentService.js';

const RESULTS_FILE = 'results.json';

// Stage names come from two sources that historically diverged: the API sync
// emits plural forms ("Quarter-finals", "Third Place") while manual admin entry
// uses the original singular forms ("Quarter-final", "Third-place playoff").
// Both are accepted so results from either source are recognised. "Round of 32"
// is part of the 48-team 2026 knockout stage and its losers are eliminated too.
const VALID_STAGES = [
  'Group Stage',
  'Round of 32',
  'Round of 16',
  'Quarter-finals', 'Quarter-final',
  'Semi-finals', 'Semi-final',
  'Third Place', 'Third-place playoff',
  'Final'
];

const KNOCKOUT_STAGES_THAT_ELIMINATE = [
  'Round of 32',
  'Round of 16',
  'Quarter-finals', 'Quarter-final',
  'Semi-finals', 'Semi-final',
  'Third Place', 'Third-place playoff'
];

/**
 * Validate that a score is a non-negative integer.
 * @param {*} score - The score value to validate
 * @returns {boolean}
 */
function isValidScore(score) {
  return Number.isInteger(score) && score >= 0;
}

/**
 * Validate result data fields common to add and update operations.
 * @param {Object} resultData - The result data to validate
 * @returns {Promise<void>}
 * @throws {Object} Error with statusCode and message if validation fails
 */
async function validateResultData(resultData) {
  const { homeTeam, awayTeam, homeScore, awayScore, stage, penaltyShootout } = resultData;

  // Validate teams exist
  if (!homeTeam || !awayTeam) {
    throw { statusCode: 400, message: 'Both homeTeam and awayTeam are required' };
  }

  const homeExists = await teamExists(homeTeam);
  if (!homeExists) {
    throw { statusCode: 400, message: 'Team not found in 48-team pool', details: `homeTeam "${homeTeam}" does not exist` };
  }

  const awayExists = await teamExists(awayTeam);
  if (!awayExists) {
    throw { statusCode: 400, message: 'Team not found in 48-team pool', details: `awayTeam "${awayTeam}" does not exist` };
  }

  if (homeTeam === awayTeam) {
    throw { statusCode: 400, message: 'A team cannot play against itself' };
  }

  // Validate scores are non-negative integers
  if (!isValidScore(homeScore)) {
    throw { statusCode: 400, message: 'Scores must be non-negative integers', details: 'homeScore is invalid' };
  }

  if (!isValidScore(awayScore)) {
    throw { statusCode: 400, message: 'Scores must be non-negative integers', details: 'awayScore is invalid' };
  }

  // Validate stage
  if (!stage || !VALID_STAGES.includes(stage)) {
    throw { statusCode: 400, message: 'Invalid stage', details: `Stage must be one of: ${VALID_STAGES.join(', ')}` };
  }

  // Validate penalty shootout
  if (penaltyShootout) {
    // Base scores must be equal for a penalty shootout
    if (homeScore !== awayScore) {
      throw { statusCode: 400, message: 'Penalty shootout requires equal base scores', details: 'homeScore and awayScore must be equal when penaltyShootout is present' };
    }

    // Winner must be one of the two teams
    if (penaltyShootout.winner !== homeTeam && penaltyShootout.winner !== awayTeam) {
      throw { statusCode: 400, message: 'Penalty shootout winner must be one of the two teams', details: `winner "${penaltyShootout.winner}" is not homeTeam or awayTeam` };
    }
  }
}

/**
 * Generate a unique result ID.
 * @param {Array} existingResults - Array of existing results
 * @returns {string} A new unique result ID
 */
function generateResultId(existingResults) {
  const maxNum = existingResults.reduce((max, r) => {
    const num = parseInt(r.id.replace('r', ''), 10);
    return num > max ? num : max;
  }, 0);
  return `r${String(maxNum + 1).padStart(3, '0')}`;
}

/**
 * Add a new match result.
 * @param {Object} resultData - The result data to store
 * @returns {Promise<Object>} The stored result with generated ID
 * @throws {Object} Error with statusCode and message if validation fails
 */
export async function addResult(resultData) {
  await validateResultData(resultData);

  const { homeTeam, awayTeam, homeScore, awayScore, date, stage, fixtureId, penaltyShootout } = resultData;

  const updatedData = await updateFile(RESULTS_FILE, (data) => {
    const newId = generateResultId(data.results);
    const newResult = {
      id: newId,
      fixtureId: fixtureId || null,
      homeTeam,
      awayTeam,
      homeScore,
      awayScore,
      date: date || new Date().toISOString(),
      stage,
      penaltyShootout: penaltyShootout || null
    };
    data.results.push(newResult);
    return data;
  });

  // Check if tournament is complete after saving result
  await checkTournamentComplete();

  return updatedData.results[updatedData.results.length - 1];
}

/**
 * Update/correct an existing match result.
 * @param {string} resultId - The ID of the result to update
 * @param {Object} resultData - The updated result data
 * @returns {Promise<Object>} The updated result
 * @throws {Object} Error with statusCode and message if validation fails or result not found
 */
export async function updateResult(resultId, resultData) {
  if (!resultId) {
    throw { statusCode: 400, message: 'Result ID is required' };
  }

  await validateResultData(resultData);

  const { homeTeam, awayTeam, homeScore, awayScore, date, stage, fixtureId, penaltyShootout } = resultData;

  let updatedResult = null;

  await updateFile(RESULTS_FILE, (data) => {
    const index = data.results.findIndex(r => r.id === resultId);
    if (index === -1) {
      throw { statusCode: 404, message: 'Result not found', details: `No result with ID "${resultId}"` };
    }

    data.results[index] = {
      ...data.results[index],
      homeTeam,
      awayTeam,
      homeScore,
      awayScore,
      date: date || data.results[index].date,
      stage,
      fixtureId: fixtureId !== undefined ? fixtureId : data.results[index].fixtureId,
      penaltyShootout: penaltyShootout || null
    };

    updatedResult = data.results[index];
    return data;
  });

  // Check if tournament is complete after saving result
  await checkTournamentComplete();

  return updatedResult;
}

/**
 * Get all match results.
 * @returns {Promise<Array>} Array of all result objects
 */
export async function getResults() {
  const data = await readFile(RESULTS_FILE);
  return data.results;
}

/**
 * Derive eliminated teams from knockout results.
 * A team is eliminated if it lost a knockout-stage match (not Group Stage, not Final).
 * For penalty shootouts, the team that is NOT the winner is eliminated.
 * The Final does NOT eliminate the loser (they finish 2nd).
 * The Third-place playoff DOES eliminate the loser (they finish 4th).
 * @returns {Promise<Set<string>>} Set of eliminated team IDs
 */
export async function getEliminatedTeams() {
  const data = await readFile(RESULTS_FILE);
  const eliminated = new Set();

  for (const result of data.results) {
    // Live (in-progress) results are provisional and never eliminate a team
    if (result.status === 'live') continue;
    if (!KNOCKOUT_STAGES_THAT_ELIMINATE.includes(result.stage)) continue;

    if (result.penaltyShootout) {
      // Loser of shootout is eliminated
      const loser = result.penaltyShootout.winner === result.homeTeam
        ? result.awayTeam : result.homeTeam;
      eliminated.add(loser);
    } else if (result.homeScore > result.awayScore) {
      eliminated.add(result.awayTeam);
    } else if (result.awayScore > result.homeScore) {
      eliminated.add(result.homeTeam);
    }
  }

  return eliminated;
}
