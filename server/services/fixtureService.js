import { readFile, updateFile } from './storageService.js';
import { teamExists } from './teamService.js';

const FIXTURES_FILE = 'fixtures.json';
const RESULTS_FILE = 'results.json';

const VALID_STAGES = [
  'Group Stage',
  'Round of 16',
  'Quarter-final',
  'Semi-final',
  'Third-place playoff',
  'Final'
];

/**
 * Validate fixture data fields.
 * @param {Object} fixtureData - The fixture data to validate
 * @returns {Promise<void>}
 * @throws {Object} Error with statusCode 400 if validation fails
 */
async function validateFixtureData(fixtureData) {
  const { homeTeam, awayTeam, date, stage } = fixtureData;

  if (!homeTeam || !awayTeam) {
    throw { statusCode: 400, message: 'Both homeTeam and awayTeam are required' };
  }

  if (homeTeam === awayTeam) {
    throw { statusCode: 400, message: 'Home team and away team must be different' };
  }

  const homeExists = await teamExists(homeTeam);
  if (!homeExists) {
    throw { statusCode: 400, message: 'Home team not found in 48-team pool' };
  }

  const awayExists = await teamExists(awayTeam);
  if (!awayExists) {
    throw { statusCode: 400, message: 'Away team not found in 48-team pool' };
  }

  if (!date || isNaN(Date.parse(date))) {
    throw { statusCode: 400, message: 'Date must be a valid ISO date string' };
  }

  if (!stage || !VALID_STAGES.includes(stage)) {
    throw { statusCode: 400, message: `Stage must be one of: ${VALID_STAGES.join(', ')}` };
  }
}

/**
 * Generate the next fixture ID based on existing fixtures.
 * @param {Array} fixtures - Current fixtures array
 * @returns {string} Next fixture ID (e.g., "f001", "f002")
 */
function generateFixtureId(fixtures) {
  if (fixtures.length === 0) {
    return 'f001';
  }

  const maxNum = fixtures.reduce((max, f) => {
    const num = parseInt(f.id.replace('f', ''), 10);
    return num > max ? num : max;
  }, 0);

  return `f${String(maxNum + 1).padStart(3, '0')}`;
}

/**
 * Add a new fixture.
 * @param {Object} fixtureData - { homeTeam, awayTeam, date, stage }
 * @returns {Promise<Object>} The created fixture
 * @throws {Object} Error with statusCode and message
 */
export async function addFixture(fixtureData) {
  await validateFixtureData(fixtureData);

  const { homeTeam, awayTeam, date, stage } = fixtureData;

  const updatedData = await updateFile(FIXTURES_FILE, (data) => {
    const id = generateFixtureId(data.fixtures);
    const fixture = {
      id,
      homeTeam,
      awayTeam,
      date,
      stage,
      status: 'scheduled'
    };
    data.fixtures.push(fixture);
    return data;
  });

  return updatedData.fixtures[updatedData.fixtures.length - 1];
}

/**
 * Update an existing fixture.
 * @param {string} fixtureId - The ID of the fixture to update
 * @param {Object} fixtureData - { homeTeam, awayTeam, date, stage }
 * @returns {Promise<Object>} The updated fixture
 * @throws {Object} Error with statusCode and message
 */
export async function updateFixture(fixtureId, fixtureData) {
  await validateFixtureData(fixtureData);

  const { homeTeam, awayTeam, date, stage } = fixtureData;

  let updatedFixture = null;

  await updateFile(FIXTURES_FILE, (data) => {
    const index = data.fixtures.findIndex(f => f.id === fixtureId);
    if (index === -1) {
      throw { statusCode: 404, message: 'Fixture not found' };
    }

    data.fixtures[index] = {
      ...data.fixtures[index],
      homeTeam,
      awayTeam,
      date,
      stage
    };
    updatedFixture = data.fixtures[index];
    return data;
  });

  return updatedFixture;
}

/**
 * Get all fixtures sorted by date ascending.
 * @returns {Promise<Array>} Array of fixture objects sorted by date
 */
export async function getFixtures() {
  const data = await readFile(FIXTURES_FILE);
  return data.fixtures.sort((a, b) => new Date(a.date) - new Date(b.date));
}

/**
 * Get fixtures that have no corresponding result.
 * @returns {Promise<Array>} Array of fixtures without results, sorted by date ascending
 */
export async function getFixturesWithoutResults() {
  const fixturesData = await readFile(FIXTURES_FILE);
  const resultsData = await readFile(RESULTS_FILE);

  const completedFixtureIds = new Set(resultsData.results.map(r => r.fixtureId));

  const fixturesWithoutResults = fixturesData.fixtures.filter(
    f => !completedFixtureIds.has(f.id)
  );

  return fixturesWithoutResults.sort((a, b) => new Date(a.date) - new Date(b.date));
}
