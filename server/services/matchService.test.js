import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFile, readFile } from './storageService.js';
import { addResult, updateResult, getResults, getEliminatedTeams } from './matchService.js';

const RESULTS_FILE = 'results.json';
const FIXTURES_FILE = 'fixtures.json';
const TOURNAMENT_FILE = 'tournament.json';

let originalResults;
let originalFixtures;
let originalTournament;

/**
 * Reset results.json, fixtures.json, and tournament.json to clean state before each test.
 */
async function resetData() {
  await writeFile(RESULTS_FILE, { results: [] });
  await writeFile(FIXTURES_FILE, { fixtures: [] });
  await writeFile(TOURNAMENT_FILE, { status: 'in_progress', completedAt: null });
}

async function saveOriginalData() {
  try { originalResults = await readFile(RESULTS_FILE); } catch { originalResults = { results: [] }; }
  try { originalFixtures = await readFile(FIXTURES_FILE); } catch { originalFixtures = { fixtures: [] }; }
  try { originalTournament = await readFile(TOURNAMENT_FILE); } catch { originalTournament = { status: 'in_progress', completedAt: null }; }
}

async function restoreOriginalData() {
  await writeFile(RESULTS_FILE, originalResults);
  await writeFile(FIXTURES_FILE, originalFixtures);
  await writeFile(TOURNAMENT_FILE, originalTournament);
}

describe('matchService', () => {
  beforeEach(async () => {
    await saveOriginalData();
    await resetData();
  });

  afterEach(async () => {
    await restoreOriginalData();
  });

  describe('addResult', () => {
    it('adds a valid group stage result', async () => {
      const result = await addResult({
        homeTeam: 'usa',
        awayTeam: 'ger',
        homeScore: 2,
        awayScore: 1,
        date: '2026-06-11T18:00:00Z',
        stage: 'Group Stage',
        fixtureId: 'f001'
      });

      expect(result.id).toBe('r001');
      expect(result.homeTeam).toBe('usa');
      expect(result.awayTeam).toBe('ger');
      expect(result.homeScore).toBe(2);
      expect(result.awayScore).toBe(1);
      expect(result.stage).toBe('Group Stage');
      expect(result.fixtureId).toBe('f001');
      expect(result.penaltyShootout).toBeNull();
    });

    it('adds a result with penalty shootout', async () => {
      const result = await addResult({
        homeTeam: 'bra',
        awayTeam: 'arg',
        homeScore: 1,
        awayScore: 1,
        date: '2026-07-10T20:00:00Z',
        stage: 'Semi-final',
        penaltyShootout: { winner: 'bra', homeGoals: 4, awayGoals: 2 }
      });

      expect(result.id).toBe('r001');
      expect(result.homeScore).toBe(1);
      expect(result.awayScore).toBe(1);
      expect(result.penaltyShootout).toEqual({ winner: 'bra', homeGoals: 4, awayGoals: 2 });
    });

    it('generates sequential IDs for multiple results', async () => {
      const r1 = await addResult({
        homeTeam: 'usa',
        awayTeam: 'ger',
        homeScore: 2,
        awayScore: 1,
        stage: 'Group Stage'
      });
      const r2 = await addResult({
        homeTeam: 'bra',
        awayTeam: 'arg',
        homeScore: 0,
        awayScore: 0,
        stage: 'Group Stage'
      });

      expect(r1.id).toBe('r001');
      expect(r2.id).toBe('r002');
    });

    it('defaults date to current time if not provided', async () => {
      const before = new Date().toISOString();
      const result = await addResult({
        homeTeam: 'usa',
        awayTeam: 'ger',
        homeScore: 1,
        awayScore: 0,
        stage: 'Group Stage'
      });
      const after = new Date().toISOString();

      expect(result.date >= before).toBe(true);
      expect(result.date <= after).toBe(true);
    });

    it('defaults fixtureId to null if not provided', async () => {
      const result = await addResult({
        homeTeam: 'usa',
        awayTeam: 'ger',
        homeScore: 1,
        awayScore: 0,
        stage: 'Group Stage'
      });

      expect(result.fixtureId).toBeNull();
    });

    it('rejects when homeTeam does not exist', async () => {
      await expect(addResult({
        homeTeam: 'xyz',
        awayTeam: 'ger',
        homeScore: 1,
        awayScore: 0,
        stage: 'Group Stage'
      })).rejects.toMatchObject({
        statusCode: 400,
        message: 'Team not found in 48-team pool'
      });
    });

    it('rejects when awayTeam does not exist', async () => {
      await expect(addResult({
        homeTeam: 'usa',
        awayTeam: 'nonexistent',
        homeScore: 1,
        awayScore: 0,
        stage: 'Group Stage'
      })).rejects.toMatchObject({
        statusCode: 400,
        message: 'Team not found in 48-team pool'
      });
    });

    it('rejects when homeTeam is missing', async () => {
      await expect(addResult({
        awayTeam: 'ger',
        homeScore: 1,
        awayScore: 0,
        stage: 'Group Stage'
      })).rejects.toMatchObject({
        statusCode: 400
      });
    });

    it('rejects when awayTeam is missing', async () => {
      await expect(addResult({
        homeTeam: 'usa',
        homeScore: 1,
        awayScore: 0,
        stage: 'Group Stage'
      })).rejects.toMatchObject({
        statusCode: 400
      });
    });

    it('rejects when a team plays against itself', async () => {
      await expect(addResult({
        homeTeam: 'usa',
        awayTeam: 'usa',
        homeScore: 1,
        awayScore: 0,
        stage: 'Group Stage'
      })).rejects.toMatchObject({
        statusCode: 400,
        message: 'A team cannot play against itself'
      });
    });

    it('rejects negative homeScore', async () => {
      await expect(addResult({
        homeTeam: 'usa',
        awayTeam: 'ger',
        homeScore: -1,
        awayScore: 0,
        stage: 'Group Stage'
      })).rejects.toMatchObject({
        statusCode: 400,
        message: 'Scores must be non-negative integers'
      });
    });

    it('rejects negative awayScore', async () => {
      await expect(addResult({
        homeTeam: 'usa',
        awayTeam: 'ger',
        homeScore: 0,
        awayScore: -2,
        stage: 'Group Stage'
      })).rejects.toMatchObject({
        statusCode: 400,
        message: 'Scores must be non-negative integers'
      });
    });

    it('rejects non-integer homeScore', async () => {
      await expect(addResult({
        homeTeam: 'usa',
        awayTeam: 'ger',
        homeScore: 1.5,
        awayScore: 0,
        stage: 'Group Stage'
      })).rejects.toMatchObject({
        statusCode: 400,
        message: 'Scores must be non-negative integers'
      });
    });

    it('rejects non-integer awayScore', async () => {
      await expect(addResult({
        homeTeam: 'usa',
        awayTeam: 'ger',
        homeScore: 0,
        awayScore: 2.7,
        stage: 'Group Stage'
      })).rejects.toMatchObject({
        statusCode: 400,
        message: 'Scores must be non-negative integers'
      });
    });

    it('rejects invalid stage', async () => {
      await expect(addResult({
        homeTeam: 'usa',
        awayTeam: 'ger',
        homeScore: 1,
        awayScore: 0,
        stage: 'Invalid Stage'
      })).rejects.toMatchObject({
        statusCode: 400,
        message: 'Invalid stage'
      });
    });

    it('rejects missing stage', async () => {
      await expect(addResult({
        homeTeam: 'usa',
        awayTeam: 'ger',
        homeScore: 1,
        awayScore: 0
      })).rejects.toMatchObject({
        statusCode: 400,
        message: 'Invalid stage'
      });
    });

    it('rejects penalty shootout with unequal base scores', async () => {
      await expect(addResult({
        homeTeam: 'usa',
        awayTeam: 'ger',
        homeScore: 2,
        awayScore: 1,
        stage: 'Quarter-final',
        penaltyShootout: { winner: 'usa', homeGoals: 4, awayGoals: 3 }
      })).rejects.toMatchObject({
        statusCode: 400,
        message: 'Penalty shootout requires equal base scores'
      });
    });

    it('rejects penalty shootout with winner not in match', async () => {
      await expect(addResult({
        homeTeam: 'usa',
        awayTeam: 'ger',
        homeScore: 1,
        awayScore: 1,
        stage: 'Quarter-final',
        penaltyShootout: { winner: 'bra', homeGoals: 4, awayGoals: 3 }
      })).rejects.toMatchObject({
        statusCode: 400,
        message: 'Penalty shootout winner must be one of the two teams'
      });
    });

    it('accepts all valid stages', async () => {
      const stages = ['Group Stage', 'Round of 16', 'Quarter-final', 'Semi-final', 'Third-place playoff', 'Final'];
      for (const stage of stages) {
        const result = await addResult({
          homeTeam: 'usa',
          awayTeam: 'ger',
          homeScore: 1,
          awayScore: 0,
          stage
        });
        expect(result.stage).toBe(stage);
      }
    });

    it('accepts a score of 0-0', async () => {
      const result = await addResult({
        homeTeam: 'usa',
        awayTeam: 'ger',
        homeScore: 0,
        awayScore: 0,
        stage: 'Group Stage'
      });
      expect(result.homeScore).toBe(0);
      expect(result.awayScore).toBe(0);
    });
  });

  describe('updateResult', () => {
    it('updates an existing result', async () => {
      await addResult({
        homeTeam: 'usa',
        awayTeam: 'ger',
        homeScore: 2,
        awayScore: 1,
        stage: 'Group Stage'
      });

      const updated = await updateResult('r001', {
        homeTeam: 'usa',
        awayTeam: 'ger',
        homeScore: 3,
        awayScore: 1,
        stage: 'Group Stage'
      });

      expect(updated.id).toBe('r001');
      expect(updated.homeScore).toBe(3);
      expect(updated.awayScore).toBe(1);
    });

    it('updates teams in a result', async () => {
      await addResult({
        homeTeam: 'usa',
        awayTeam: 'ger',
        homeScore: 2,
        awayScore: 1,
        stage: 'Group Stage'
      });

      const updated = await updateResult('r001', {
        homeTeam: 'bra',
        awayTeam: 'arg',
        homeScore: 1,
        awayScore: 0,
        stage: 'Quarter-final'
      });

      expect(updated.homeTeam).toBe('bra');
      expect(updated.awayTeam).toBe('arg');
      expect(updated.stage).toBe('Quarter-final');
    });

    it('preserves original date if not provided in update', async () => {
      await addResult({
        homeTeam: 'usa',
        awayTeam: 'ger',
        homeScore: 2,
        awayScore: 1,
        date: '2026-06-11T18:00:00Z',
        stage: 'Group Stage'
      });

      const updated = await updateResult('r001', {
        homeTeam: 'usa',
        awayTeam: 'ger',
        homeScore: 3,
        awayScore: 1,
        stage: 'Group Stage'
      });

      expect(updated.date).toBe('2026-06-11T18:00:00Z');
    });

    it('rejects update for non-existent result ID', async () => {
      await expect(updateResult('r999', {
        homeTeam: 'usa',
        awayTeam: 'ger',
        homeScore: 1,
        awayScore: 0,
        stage: 'Group Stage'
      })).rejects.toMatchObject({
        statusCode: 404,
        message: 'Result not found'
      });
    });

    it('rejects update with missing result ID', async () => {
      await expect(updateResult('', {
        homeTeam: 'usa',
        awayTeam: 'ger',
        homeScore: 1,
        awayScore: 0,
        stage: 'Group Stage'
      })).rejects.toMatchObject({
        statusCode: 400,
        message: 'Result ID is required'
      });
    });

    it('rejects update with invalid team', async () => {
      await addResult({
        homeTeam: 'usa',
        awayTeam: 'ger',
        homeScore: 2,
        awayScore: 1,
        stage: 'Group Stage'
      });

      await expect(updateResult('r001', {
        homeTeam: 'nonexistent',
        awayTeam: 'ger',
        homeScore: 1,
        awayScore: 0,
        stage: 'Group Stage'
      })).rejects.toMatchObject({
        statusCode: 400,
        message: 'Team not found in 48-team pool'
      });
    });

    it('rejects update with invalid scores', async () => {
      await addResult({
        homeTeam: 'usa',
        awayTeam: 'ger',
        homeScore: 2,
        awayScore: 1,
        stage: 'Group Stage'
      });

      await expect(updateResult('r001', {
        homeTeam: 'usa',
        awayTeam: 'ger',
        homeScore: -1,
        awayScore: 0,
        stage: 'Group Stage'
      })).rejects.toMatchObject({
        statusCode: 400,
        message: 'Scores must be non-negative integers'
      });
    });

    it('can add penalty shootout to an existing result', async () => {
      await addResult({
        homeTeam: 'usa',
        awayTeam: 'ger',
        homeScore: 1,
        awayScore: 1,
        stage: 'Quarter-final'
      });

      const updated = await updateResult('r001', {
        homeTeam: 'usa',
        awayTeam: 'ger',
        homeScore: 1,
        awayScore: 1,
        stage: 'Quarter-final',
        penaltyShootout: { winner: 'usa', homeGoals: 5, awayGoals: 3 }
      });

      expect(updated.penaltyShootout).toEqual({ winner: 'usa', homeGoals: 5, awayGoals: 3 });
    });

    it('can remove penalty shootout from an existing result', async () => {
      await addResult({
        homeTeam: 'usa',
        awayTeam: 'ger',
        homeScore: 1,
        awayScore: 1,
        stage: 'Quarter-final',
        penaltyShootout: { winner: 'usa', homeGoals: 5, awayGoals: 3 }
      });

      const updated = await updateResult('r001', {
        homeTeam: 'usa',
        awayTeam: 'ger',
        homeScore: 2,
        awayScore: 1,
        stage: 'Quarter-final'
      });

      expect(updated.penaltyShootout).toBeNull();
    });
  });

  describe('getResults', () => {
    it('returns empty array when no results exist', async () => {
      const results = await getResults();
      expect(results).toEqual([]);
    });

    it('returns all stored results', async () => {
      await addResult({
        homeTeam: 'usa',
        awayTeam: 'ger',
        homeScore: 2,
        awayScore: 1,
        stage: 'Group Stage'
      });
      await addResult({
        homeTeam: 'bra',
        awayTeam: 'arg',
        homeScore: 0,
        awayScore: 0,
        stage: 'Group Stage'
      });

      const results = await getResults();
      expect(results).toHaveLength(2);
      expect(results[0].homeTeam).toBe('usa');
      expect(results[1].homeTeam).toBe('bra');
    });
  });

  describe('getEliminatedTeams', () => {
    it('returns empty set when no results exist', async () => {
      const eliminated = await getEliminatedTeams();
      expect(eliminated.size).toBe(0);
    });

    it('does not eliminate teams from group stage losses', async () => {
      await addResult({
        homeTeam: 'usa',
        awayTeam: 'ger',
        homeScore: 0,
        awayScore: 3,
        stage: 'Group Stage'
      });

      const eliminated = await getEliminatedTeams();
      expect(eliminated.has('usa')).toBe(false);
      expect(eliminated.has('ger')).toBe(false);
    });

    it('eliminates the loser of a Round of 16 match', async () => {
      await addResult({
        homeTeam: 'usa',
        awayTeam: 'ger',
        homeScore: 1,
        awayScore: 2,
        stage: 'Round of 16'
      });

      const eliminated = await getEliminatedTeams();
      expect(eliminated.has('usa')).toBe(true);
      expect(eliminated.has('ger')).toBe(false);
    });

    it('eliminates the loser of a Quarter-final match', async () => {
      await addResult({
        homeTeam: 'bra',
        awayTeam: 'arg',
        homeScore: 3,
        awayScore: 1,
        stage: 'Quarter-final'
      });

      const eliminated = await getEliminatedTeams();
      expect(eliminated.has('arg')).toBe(true);
      expect(eliminated.has('bra')).toBe(false);
    });

    it('eliminates the loser of a Semi-final match', async () => {
      await addResult({
        homeTeam: 'fra',
        awayTeam: 'esp',
        homeScore: 0,
        awayScore: 1,
        stage: 'Semi-final'
      });

      const eliminated = await getEliminatedTeams();
      expect(eliminated.has('fra')).toBe(true);
      expect(eliminated.has('esp')).toBe(false);
    });

    it('eliminates the loser of a Third-place playoff', async () => {
      await addResult({
        homeTeam: 'eng',
        awayTeam: 'ned',
        homeScore: 0,
        awayScore: 2,
        stage: 'Third-place playoff'
      });

      const eliminated = await getEliminatedTeams();
      expect(eliminated.has('eng')).toBe(true);
      expect(eliminated.has('ned')).toBe(false);
    });

    it('does NOT eliminate the loser of the Final', async () => {
      await addResult({
        homeTeam: 'bra',
        awayTeam: 'arg',
        homeScore: 1,
        awayScore: 2,
        stage: 'Final'
      });

      const eliminated = await getEliminatedTeams();
      expect(eliminated.has('bra')).toBe(false);
      expect(eliminated.has('arg')).toBe(false);
    });

    it('eliminates the penalty shootout loser in knockout stage', async () => {
      await addResult({
        homeTeam: 'usa',
        awayTeam: 'ger',
        homeScore: 1,
        awayScore: 1,
        stage: 'Round of 16',
        penaltyShootout: { winner: 'usa', homeGoals: 4, awayGoals: 2 }
      });

      const eliminated = await getEliminatedTeams();
      expect(eliminated.has('ger')).toBe(true);
      expect(eliminated.has('usa')).toBe(false);
    });

    it('eliminates the away team when home team wins shootout', async () => {
      await addResult({
        homeTeam: 'bra',
        awayTeam: 'arg',
        homeScore: 2,
        awayScore: 2,
        stage: 'Semi-final',
        penaltyShootout: { winner: 'bra', homeGoals: 5, awayGoals: 4 }
      });

      const eliminated = await getEliminatedTeams();
      expect(eliminated.has('arg')).toBe(true);
      expect(eliminated.has('bra')).toBe(false);
    });

    it('eliminates the home team when away team wins shootout', async () => {
      await addResult({
        homeTeam: 'fra',
        awayTeam: 'esp',
        homeScore: 0,
        awayScore: 0,
        stage: 'Quarter-final',
        penaltyShootout: { winner: 'esp', homeGoals: 3, awayGoals: 4 }
      });

      const eliminated = await getEliminatedTeams();
      expect(eliminated.has('fra')).toBe(true);
      expect(eliminated.has('esp')).toBe(false);
    });

    it('tracks multiple eliminations across different stages', async () => {
      await addResult({
        homeTeam: 'usa',
        awayTeam: 'ger',
        homeScore: 2,
        awayScore: 0,
        stage: 'Round of 16'
      });
      await addResult({
        homeTeam: 'bra',
        awayTeam: 'arg',
        homeScore: 1,
        awayScore: 3,
        stage: 'Quarter-final'
      });
      await addResult({
        homeTeam: 'fra',
        awayTeam: 'esp',
        homeScore: 0,
        awayScore: 0,
        stage: 'Semi-final',
        penaltyShootout: { winner: 'esp', homeGoals: 3, awayGoals: 5 }
      });

      const eliminated = await getEliminatedTeams();
      expect(eliminated.has('ger')).toBe(true);
      expect(eliminated.has('bra')).toBe(true);
      expect(eliminated.has('fra')).toBe(true);
      expect(eliminated.has('usa')).toBe(false);
      expect(eliminated.has('arg')).toBe(false);
      expect(eliminated.has('esp')).toBe(false);
    });

    it('does not eliminate on a group stage draw', async () => {
      await addResult({
        homeTeam: 'usa',
        awayTeam: 'ger',
        homeScore: 1,
        awayScore: 1,
        stage: 'Group Stage'
      });

      const eliminated = await getEliminatedTeams();
      expect(eliminated.size).toBe(0);
    });
  });

  describe('tournament completion integration', () => {
    it('marks tournament complete when all fixtures have results', async () => {
      // Set up a single fixture
      await writeFile(FIXTURES_FILE, {
        fixtures: [
          { id: 'f001', homeTeam: 'usa', awayTeam: 'ger', date: '2026-06-11T18:00:00Z', stage: 'Group Stage', status: 'scheduled' }
        ]
      });

      await addResult({
        homeTeam: 'usa',
        awayTeam: 'ger',
        homeScore: 2,
        awayScore: 1,
        stage: 'Group Stage',
        fixtureId: 'f001'
      });

      const tournament = await readFile(TOURNAMENT_FILE);
      expect(tournament.status).toBe('complete');
      expect(tournament.completedAt).toBeDefined();
    });

    it('does not mark tournament complete when fixtures remain without results', async () => {
      await writeFile(FIXTURES_FILE, {
        fixtures: [
          { id: 'f001', homeTeam: 'usa', awayTeam: 'ger', date: '2026-06-11T18:00:00Z', stage: 'Group Stage', status: 'scheduled' },
          { id: 'f002', homeTeam: 'bra', awayTeam: 'arg', date: '2026-06-12T18:00:00Z', stage: 'Group Stage', status: 'scheduled' }
        ]
      });

      await addResult({
        homeTeam: 'usa',
        awayTeam: 'ger',
        homeScore: 2,
        awayScore: 1,
        stage: 'Group Stage',
        fixtureId: 'f001'
      });

      const tournament = await readFile(TOURNAMENT_FILE);
      expect(tournament.status).toBe('in_progress');
      expect(tournament.completedAt).toBeNull();
    });
  });
});
