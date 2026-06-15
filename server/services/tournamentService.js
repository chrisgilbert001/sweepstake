import { readFile, updateFile } from './storageService.js';

/**
 * Check if the tournament is complete by verifying all fixtures have results.
 * If all fixtures have corresponding results (and there are fixtures), marks the tournament as complete.
 * @returns {Promise<boolean>} Whether the tournament is now complete
 */
export async function checkTournamentComplete() {
  const fixturesData = await readFile('fixtures.json');
  const resultsData = await readFile('results.json');

  const fixtures = fixturesData.fixtures || [];
  const results = resultsData.results || [];

  // Build a set of fixture IDs that have a FINAL result.
  // Live (provisional, in-progress) results don't count toward completion.
  const completedFixtureIds = new Set(
    results.filter(r => r.status !== 'live').map(r => r.fixtureId)
  );

  // Tournament is complete when every fixture has a result and there are fixtures
  const allComplete = fixtures.length > 0 && fixtures.every(f => completedFixtureIds.has(f.id));

  if (allComplete) {
    await updateFile('tournament.json', (data) => ({
      ...data,
      status: 'complete',
      completedAt: new Date().toISOString()
    }));
  }

  return allComplete;
}

/**
 * Get the current tournament status.
 * @returns {Promise<{status: string, completedAt: string|null}>} Tournament state
 */
export async function getTournamentStatus() {
  return await readFile('tournament.json');
}
