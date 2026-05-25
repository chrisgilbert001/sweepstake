import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFile as fsWrite, rm } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  addFixture,
  updateFixture,
  getFixtures,
  getFixturesWithoutResults
} from './fixtureService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '..', 'data');
const FIXTURES_PATH = path.join(DATA_DIR, 'fixtures.json');
const RESULTS_PATH = path.join(DATA_DIR, 'results.json');

// Store original file contents to restore after tests
let originalFixtures;
let originalResults;

async function readJsonFile(filePath) {
  const { readFile } = await import('fs/promises');
  const content = await readFile(filePath, 'utf-8');
  return JSON.parse(content);
}

describe('fixtureService', () => {
  beforeEach(async () => {
    // Save original data
    try {
      originalFixtures = await readJsonFile(FIXTURES_PATH);
    } catch {
      originalFixtures = { fixtures: [] };
    }
    try {
      originalResults = await readJsonFile(RESULTS_PATH);
    } catch {
      originalResults = { results: [] };
    }

    // Reset to empty state for tests
    await fsWrite(FIXTURES_PATH, JSON.stringify({ fixtures: [] }, null, 2), 'utf-8');
    await fsWrite(RESULTS_PATH, JSON.stringify({ results: [] }, null, 2), 'utf-8');
  });

  afterEach(async () => {
    // Restore original data
    await fsWrite(FIXTURES_PATH, JSON.stringify(originalFixtures, null, 2), 'utf-8');
    await fsWrite(RESULTS_PATH, JSON.stringify(originalResults, null, 2), 'utf-8');
    // Clean up lock files
    try { await rm(FIXTURES_PATH + '.lock', { recursive: true }); } catch { /* ignore */ }
    try { await rm(RESULTS_PATH + '.lock', { recursive: true }); } catch { /* ignore */ }
  });

  describe('addFixture', () => {
    it('creates a fixture with correct structure', async () => {
      const fixture = await addFixture({
        homeTeam: 'usa',
        awayTeam: 'ger',
        date: '2026-06-11T18:00:00Z',
        stage: 'Group Stage'
      });

      expect(fixture.id).toBe('f001');
      expect(fixture.homeTeam).toBe('usa');
      expect(fixture.awayTeam).toBe('ger');
      expect(fixture.date).toBe('2026-06-11T18:00:00Z');
      expect(fixture.stage).toBe('Group Stage');
      expect(fixture.status).toBe('scheduled');
    });

    it('generates incrementing IDs for multiple fixtures', async () => {
      const f1 = await addFixture({
        homeTeam: 'usa',
        awayTeam: 'ger',
        date: '2026-06-11T18:00:00Z',
        stage: 'Group Stage'
      });
      const f2 = await addFixture({
        homeTeam: 'bra',
        awayTeam: 'arg',
        date: '2026-06-12T18:00:00Z',
        stage: 'Group Stage'
      });

      expect(f1.id).toBe('f001');
      expect(f2.id).toBe('f002');
    });

    it('accepts all valid stages', async () => {
      const stages = [
        'Group Stage',
        'Round of 16',
        'Quarter-final',
        'Semi-final',
        'Third-place playoff',
        'Final'
      ];

      for (let i = 0; i < stages.length; i++) {
        const fixture = await addFixture({
          homeTeam: 'usa',
          awayTeam: 'ger',
          date: '2026-06-11T18:00:00Z',
          stage: stages[i]
        });
        expect(fixture.stage).toBe(stages[i]);
      }
    });

    it('rejects when homeTeam is missing', async () => {
      await expect(addFixture({
        awayTeam: 'ger',
        date: '2026-06-11T18:00:00Z',
        stage: 'Group Stage'
      })).rejects.toMatchObject({
        statusCode: 400,
        message: 'Both homeTeam and awayTeam are required'
      });
    });

    it('rejects when awayTeam is missing', async () => {
      await expect(addFixture({
        homeTeam: 'usa',
        date: '2026-06-11T18:00:00Z',
        stage: 'Group Stage'
      })).rejects.toMatchObject({
        statusCode: 400,
        message: 'Both homeTeam and awayTeam are required'
      });
    });

    it('rejects when teams are the same', async () => {
      await expect(addFixture({
        homeTeam: 'usa',
        awayTeam: 'usa',
        date: '2026-06-11T18:00:00Z',
        stage: 'Group Stage'
      })).rejects.toMatchObject({
        statusCode: 400,
        message: 'Home team and away team must be different'
      });
    });

    it('rejects when homeTeam does not exist in 48-team pool', async () => {
      await expect(addFixture({
        homeTeam: 'xyz',
        awayTeam: 'ger',
        date: '2026-06-11T18:00:00Z',
        stage: 'Group Stage'
      })).rejects.toMatchObject({
        statusCode: 400,
        message: 'Home team not found in 48-team pool'
      });
    });

    it('rejects when awayTeam does not exist in 48-team pool', async () => {
      await expect(addFixture({
        homeTeam: 'usa',
        awayTeam: 'xyz',
        date: '2026-06-11T18:00:00Z',
        stage: 'Group Stage'
      })).rejects.toMatchObject({
        statusCode: 400,
        message: 'Away team not found in 48-team pool'
      });
    });

    it('rejects an invalid date', async () => {
      await expect(addFixture({
        homeTeam: 'usa',
        awayTeam: 'ger',
        date: 'not-a-date',
        stage: 'Group Stage'
      })).rejects.toMatchObject({
        statusCode: 400,
        message: 'Date must be a valid ISO date string'
      });
    });

    it('rejects a missing date', async () => {
      await expect(addFixture({
        homeTeam: 'usa',
        awayTeam: 'ger',
        stage: 'Group Stage'
      })).rejects.toMatchObject({
        statusCode: 400,
        message: 'Date must be a valid ISO date string'
      });
    });

    it('rejects an invalid stage', async () => {
      await expect(addFixture({
        homeTeam: 'usa',
        awayTeam: 'ger',
        date: '2026-06-11T18:00:00Z',
        stage: 'Invalid Stage'
      })).rejects.toMatchObject({
        statusCode: 400
      });
    });

    it('rejects a missing stage', async () => {
      await expect(addFixture({
        homeTeam: 'usa',
        awayTeam: 'ger',
        date: '2026-06-11T18:00:00Z'
      })).rejects.toMatchObject({
        statusCode: 400
      });
    });
  });

  describe('updateFixture', () => {
    it('updates an existing fixture', async () => {
      await addFixture({
        homeTeam: 'usa',
        awayTeam: 'ger',
        date: '2026-06-11T18:00:00Z',
        stage: 'Group Stage'
      });

      const updated = await updateFixture('f001', {
        homeTeam: 'bra',
        awayTeam: 'arg',
        date: '2026-06-12T20:00:00Z',
        stage: 'Round of 16'
      });

      expect(updated.id).toBe('f001');
      expect(updated.homeTeam).toBe('bra');
      expect(updated.awayTeam).toBe('arg');
      expect(updated.date).toBe('2026-06-12T20:00:00Z');
      expect(updated.stage).toBe('Round of 16');
    });

    it('preserves the fixture status on update', async () => {
      await addFixture({
        homeTeam: 'usa',
        awayTeam: 'ger',
        date: '2026-06-11T18:00:00Z',
        stage: 'Group Stage'
      });

      const updated = await updateFixture('f001', {
        homeTeam: 'usa',
        awayTeam: 'bra',
        date: '2026-06-11T18:00:00Z',
        stage: 'Group Stage'
      });

      expect(updated.status).toBe('scheduled');
    });

    it('throws 404 for non-existent fixture', async () => {
      await expect(updateFixture('f999', {
        homeTeam: 'usa',
        awayTeam: 'ger',
        date: '2026-06-11T18:00:00Z',
        stage: 'Group Stage'
      })).rejects.toMatchObject({
        statusCode: 404,
        message: 'Fixture not found'
      });
    });

    it('validates data before updating', async () => {
      await addFixture({
        homeTeam: 'usa',
        awayTeam: 'ger',
        date: '2026-06-11T18:00:00Z',
        stage: 'Group Stage'
      });

      await expect(updateFixture('f001', {
        homeTeam: 'usa',
        awayTeam: 'usa',
        date: '2026-06-11T18:00:00Z',
        stage: 'Group Stage'
      })).rejects.toMatchObject({
        statusCode: 400,
        message: 'Home team and away team must be different'
      });
    });
  });

  describe('getFixtures', () => {
    it('returns empty array when no fixtures exist', async () => {
      const fixtures = await getFixtures();
      expect(fixtures).toEqual([]);
    });

    it('returns fixtures sorted by date ascending', async () => {
      await addFixture({
        homeTeam: 'bra',
        awayTeam: 'arg',
        date: '2026-06-15T18:00:00Z',
        stage: 'Group Stage'
      });
      await addFixture({
        homeTeam: 'usa',
        awayTeam: 'ger',
        date: '2026-06-11T18:00:00Z',
        stage: 'Group Stage'
      });
      await addFixture({
        homeTeam: 'fra',
        awayTeam: 'esp',
        date: '2026-06-13T18:00:00Z',
        stage: 'Group Stage'
      });

      const fixtures = await getFixtures();
      expect(fixtures).toHaveLength(3);
      expect(fixtures[0].homeTeam).toBe('usa');
      expect(fixtures[1].homeTeam).toBe('fra');
      expect(fixtures[2].homeTeam).toBe('bra');
    });

    it('returns all fixtures with correct structure', async () => {
      await addFixture({
        homeTeam: 'usa',
        awayTeam: 'ger',
        date: '2026-06-11T18:00:00Z',
        stage: 'Group Stage'
      });

      const fixtures = await getFixtures();
      expect(fixtures[0]).toHaveProperty('id');
      expect(fixtures[0]).toHaveProperty('homeTeam');
      expect(fixtures[0]).toHaveProperty('awayTeam');
      expect(fixtures[0]).toHaveProperty('date');
      expect(fixtures[0]).toHaveProperty('stage');
      expect(fixtures[0]).toHaveProperty('status');
    });
  });

  describe('getFixturesWithoutResults', () => {
    it('returns all fixtures when no results exist', async () => {
      await addFixture({
        homeTeam: 'usa',
        awayTeam: 'ger',
        date: '2026-06-11T18:00:00Z',
        stage: 'Group Stage'
      });
      await addFixture({
        homeTeam: 'bra',
        awayTeam: 'arg',
        date: '2026-06-12T18:00:00Z',
        stage: 'Group Stage'
      });

      const fixtures = await getFixturesWithoutResults();
      expect(fixtures).toHaveLength(2);
    });

    it('excludes fixtures that have results', async () => {
      await addFixture({
        homeTeam: 'usa',
        awayTeam: 'ger',
        date: '2026-06-11T18:00:00Z',
        stage: 'Group Stage'
      });
      await addFixture({
        homeTeam: 'bra',
        awayTeam: 'arg',
        date: '2026-06-12T18:00:00Z',
        stage: 'Group Stage'
      });

      // Add a result for the first fixture
      const resultsData = {
        results: [
          {
            id: 'r001',
            fixtureId: 'f001',
            homeTeam: 'usa',
            awayTeam: 'ger',
            homeScore: 2,
            awayScore: 1,
            date: '2026-06-11T18:00:00Z',
            stage: 'Group Stage',
            penaltyShootout: null
          }
        ]
      };
      await fsWrite(RESULTS_PATH, JSON.stringify(resultsData, null, 2), 'utf-8');

      const fixtures = await getFixturesWithoutResults();
      expect(fixtures).toHaveLength(1);
      expect(fixtures[0].id).toBe('f002');
    });

    it('returns empty array when all fixtures have results', async () => {
      await addFixture({
        homeTeam: 'usa',
        awayTeam: 'ger',
        date: '2026-06-11T18:00:00Z',
        stage: 'Group Stage'
      });

      const resultsData = {
        results: [
          {
            id: 'r001',
            fixtureId: 'f001',
            homeTeam: 'usa',
            awayTeam: 'ger',
            homeScore: 2,
            awayScore: 1,
            date: '2026-06-11T18:00:00Z',
            stage: 'Group Stage',
            penaltyShootout: null
          }
        ]
      };
      await fsWrite(RESULTS_PATH, JSON.stringify(resultsData, null, 2), 'utf-8');

      const fixtures = await getFixturesWithoutResults();
      expect(fixtures).toEqual([]);
    });

    it('returns fixtures sorted by date ascending', async () => {
      await addFixture({
        homeTeam: 'bra',
        awayTeam: 'arg',
        date: '2026-06-15T18:00:00Z',
        stage: 'Group Stage'
      });
      await addFixture({
        homeTeam: 'usa',
        awayTeam: 'ger',
        date: '2026-06-11T18:00:00Z',
        stage: 'Group Stage'
      });

      const fixtures = await getFixturesWithoutResults();
      expect(fixtures[0].date).toBe('2026-06-11T18:00:00Z');
      expect(fixtures[1].date).toBe('2026-06-15T18:00:00Z');
    });

    it('returns empty array when no fixtures exist', async () => {
      const fixtures = await getFixturesWithoutResults();
      expect(fixtures).toEqual([]);
    });
  });
});
