import { readFile } from './storageService.js';

const FIXTURES_FILE = 'fixtures.json';
const RESULTS_FILE = 'results.json';

/**
 * Get the start of a UTC day (midnight) for a given date string.
 * @param {string} dateStr - ISO date string
 * @returns {Date} Date object set to start of UTC day
 */
function getStartOfDayUTC(dateStr) {
  const date = new Date(dateStr);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/**
 * Get the Monday of the week containing the given date (UTC).
 * @param {string} dateStr - ISO date string
 * @returns {Date} Date object set to Monday 00:00:00 UTC
 */
function getMondayOfWeekUTC(dateStr) {
  const date = new Date(dateStr);
  const dayOfWeek = date.getUTCDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  // Calculate offset to Monday: if Sunday (0), go back 6 days; otherwise go back (dayOfWeek - 1) days
  const offsetToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const monday = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - offsetToMonday));
  return monday;
}

/**
 * Get the Sunday end-of-day of the week containing the given date (UTC).
 * @param {string} dateStr - ISO date string
 * @returns {Date} Date object set to Sunday 23:59:59.999 UTC
 */
function getSundayEndOfWeekUTC(dateStr) {
  const monday = getMondayOfWeekUTC(dateStr);
  const sunday = new Date(monday.getTime());
  sunday.setUTCDate(sunday.getUTCDate() + 6);
  sunday.setUTCHours(23, 59, 59, 999);
  return sunday;
}

/**
 * Enrich fixtures with status information based on results.
 * If a result exists for a fixture, mark it as completed and include the score.
 * @param {Array} fixtures - Array of fixture objects
 * @param {Array} results - Array of result objects
 * @returns {Array} Enriched fixture objects with status info
 */
function enrichFixturesWithStatus(fixtures, results) {
  const resultsByFixtureId = new Map();
  for (const result of results) {
    if (result.fixtureId) {
      resultsByFixtureId.set(result.fixtureId, result);
    }
  }

  return fixtures.map(fixture => {
    const result = resultsByFixtureId.get(fixture.id);
    if (result) {
      return {
        ...fixture,
        status: 'completed',
        homeScore: result.homeScore,
        awayScore: result.awayScore,
        penaltyShootout: result.penaltyShootout || null
      };
    }
    return {
      ...fixture,
      status: 'scheduled'
    };
  });
}

/**
 * Get fixtures for a single calendar day (UTC), sorted by date ascending.
 * Cross-references results to determine fixture status.
 * @param {string} date - ISO date string representing the target day
 * @returns {Promise<Array>} Array of fixture objects for that day, enriched with status
 */
export async function getFixturesForDate(date) {
  const fixturesData = await readFile(FIXTURES_FILE);
  const resultsData = await readFile(RESULTS_FILE);

  const dayStart = getStartOfDayUTC(date);
  const dayEnd = new Date(dayStart.getTime());
  dayEnd.setUTCHours(23, 59, 59, 999);

  const filteredFixtures = fixturesData.fixtures.filter(fixture => {
    const fixtureDate = new Date(fixture.date);
    return fixtureDate >= dayStart && fixtureDate <= dayEnd;
  });

  const enriched = enrichFixturesWithStatus(filteredFixtures, resultsData.results);

  return enriched.sort((a, b) => new Date(a.date) - new Date(b.date));
}

/**
 * Get fixtures for the Monday–Sunday week containing the given date (UTC), sorted by date ascending.
 * Cross-references results to determine fixture status.
 * @param {string} date - ISO date string representing any day within the target week
 * @returns {Promise<Array>} Array of fixture objects for that week, enriched with status
 */
export async function getFixturesForWeek(date) {
  const fixturesData = await readFile(FIXTURES_FILE);
  const resultsData = await readFile(RESULTS_FILE);

  const weekStart = getMondayOfWeekUTC(date);
  const weekEnd = getSundayEndOfWeekUTC(date);

  const filteredFixtures = fixturesData.fixtures.filter(fixture => {
    const fixtureDate = new Date(fixture.date);
    return fixtureDate >= weekStart && fixtureDate <= weekEnd;
  });

  const enriched = enrichFixturesWithStatus(filteredFixtures, resultsData.results);

  return enriched.sort((a, b) => new Date(a.date) - new Date(b.date));
}
