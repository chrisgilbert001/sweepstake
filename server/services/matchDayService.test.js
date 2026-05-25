import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getFixturesForDate, getFixturesForWeek } from './matchDayService.js';

// Mock storageService
vi.mock('./storageService.js', () => ({
  readFile: vi.fn()
}));

import { readFile } from './storageService.js';

describe('matchDayService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getFixturesForDate', () => {
    it('returns fixtures for a specific day sorted by date ascending', async () => {
      readFile.mockImplementation((filename) => {
        if (filename === 'fixtures.json') {
          return Promise.resolve({
            fixtures: [
              { id: 'f001', homeTeam: 'eng', awayTeam: 'fra', date: '2026-06-11T20:00:00Z', stage: 'Group Stage' },
              { id: 'f002', homeTeam: 'ger', awayTeam: 'bra', date: '2026-06-11T14:00:00Z', stage: 'Group Stage' },
              { id: 'f003', homeTeam: 'arg', awayTeam: 'mex', date: '2026-06-12T18:00:00Z', stage: 'Group Stage' }
            ]
          });
        }
        if (filename === 'results.json') {
          return Promise.resolve({ results: [] });
        }
      });

      const result = await getFixturesForDate('2026-06-11T10:00:00Z');

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('f002'); // 14:00 comes before 20:00
      expect(result[1].id).toBe('f001');
    });

    it('returns empty array when no fixtures match the date', async () => {
      readFile.mockImplementation((filename) => {
        if (filename === 'fixtures.json') {
          return Promise.resolve({
            fixtures: [
              { id: 'f001', homeTeam: 'eng', awayTeam: 'fra', date: '2026-06-11T20:00:00Z', stage: 'Group Stage' }
            ]
          });
        }
        if (filename === 'results.json') {
          return Promise.resolve({ results: [] });
        }
      });

      const result = await getFixturesForDate('2026-06-12T10:00:00Z');

      expect(result).toHaveLength(0);
    });

    it('marks fixtures as completed when a result exists', async () => {
      readFile.mockImplementation((filename) => {
        if (filename === 'fixtures.json') {
          return Promise.resolve({
            fixtures: [
              { id: 'f001', homeTeam: 'eng', awayTeam: 'fra', date: '2026-06-11T20:00:00Z', stage: 'Group Stage' },
              { id: 'f002', homeTeam: 'ger', awayTeam: 'bra', date: '2026-06-11T14:00:00Z', stage: 'Group Stage' }
            ]
          });
        }
        if (filename === 'results.json') {
          return Promise.resolve({
            results: [
              { id: 'r001', fixtureId: 'f002', homeTeam: 'ger', awayTeam: 'bra', homeScore: 2, awayScore: 1, date: '2026-06-11T14:00:00Z', stage: 'Group Stage', penaltyShootout: null }
            ]
          });
        }
      });

      const result = await getFixturesForDate('2026-06-11T10:00:00Z');

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('f002');
      expect(result[0].status).toBe('completed');
      expect(result[0].homeScore).toBe(2);
      expect(result[0].awayScore).toBe(1);
      expect(result[1].id).toBe('f001');
      expect(result[1].status).toBe('scheduled');
    });

    it('includes penalty shootout info for completed fixtures', async () => {
      readFile.mockImplementation((filename) => {
        if (filename === 'fixtures.json') {
          return Promise.resolve({
            fixtures: [
              { id: 'f001', homeTeam: 'eng', awayTeam: 'fra', date: '2026-06-11T20:00:00Z', stage: 'Round of 16' }
            ]
          });
        }
        if (filename === 'results.json') {
          return Promise.resolve({
            results: [
              { id: 'r001', fixtureId: 'f001', homeTeam: 'eng', awayTeam: 'fra', homeScore: 1, awayScore: 1, date: '2026-06-11T20:00:00Z', stage: 'Round of 16', penaltyShootout: { winner: 'eng', homeGoals: 4, awayGoals: 2 } }
            ]
          });
        }
      });

      const result = await getFixturesForDate('2026-06-11T10:00:00Z');

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('completed');
      expect(result[0].homeScore).toBe(1);
      expect(result[0].awayScore).toBe(1);
      expect(result[0].penaltyShootout).toEqual({ winner: 'eng', homeGoals: 4, awayGoals: 2 });
    });
  });

  describe('getFixturesForWeek', () => {
    it('returns fixtures for Monday–Sunday of the week containing the given date', async () => {
      // 2026-06-11 is a Thursday. Monday = June 8, Sunday = June 14
      readFile.mockImplementation((filename) => {
        if (filename === 'fixtures.json') {
          return Promise.resolve({
            fixtures: [
              { id: 'f001', homeTeam: 'eng', awayTeam: 'fra', date: '2026-06-08T14:00:00Z', stage: 'Group Stage' }, // Monday
              { id: 'f002', homeTeam: 'ger', awayTeam: 'bra', date: '2026-06-11T20:00:00Z', stage: 'Group Stage' }, // Thursday
              { id: 'f003', homeTeam: 'arg', awayTeam: 'mex', date: '2026-06-14T18:00:00Z', stage: 'Group Stage' }, // Sunday
              { id: 'f004', homeTeam: 'jpn', awayTeam: 'kor', date: '2026-06-15T14:00:00Z', stage: 'Group Stage' }  // Next Monday (outside)
            ]
          });
        }
        if (filename === 'results.json') {
          return Promise.resolve({ results: [] });
        }
      });

      const result = await getFixturesForWeek('2026-06-11T10:00:00Z');

      expect(result).toHaveLength(3);
      expect(result[0].id).toBe('f001'); // Monday
      expect(result[1].id).toBe('f002'); // Thursday
      expect(result[2].id).toBe('f003'); // Sunday
    });

    it('handles Sunday as part of the current week (not next week)', async () => {
      // 2026-06-14 is a Sunday. The week should be Mon June 8 – Sun June 14
      readFile.mockImplementation((filename) => {
        if (filename === 'fixtures.json') {
          return Promise.resolve({
            fixtures: [
              { id: 'f001', homeTeam: 'eng', awayTeam: 'fra', date: '2026-06-08T14:00:00Z', stage: 'Group Stage' }, // Monday
              { id: 'f002', homeTeam: 'ger', awayTeam: 'bra', date: '2026-06-14T20:00:00Z', stage: 'Group Stage' }, // Sunday
              { id: 'f003', homeTeam: 'arg', awayTeam: 'mex', date: '2026-06-15T18:00:00Z', stage: 'Group Stage' }  // Next Monday
            ]
          });
        }
        if (filename === 'results.json') {
          return Promise.resolve({ results: [] });
        }
      });

      const result = await getFixturesForWeek('2026-06-14T10:00:00Z');

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('f001');
      expect(result[1].id).toBe('f002');
    });

    it('handles Monday as the start of the week', async () => {
      // 2026-06-08 is a Monday. The week should be Mon June 8 – Sun June 14
      readFile.mockImplementation((filename) => {
        if (filename === 'fixtures.json') {
          return Promise.resolve({
            fixtures: [
              { id: 'f001', homeTeam: 'eng', awayTeam: 'fra', date: '2026-06-07T23:00:00Z', stage: 'Group Stage' }, // Previous Sunday
              { id: 'f002', homeTeam: 'ger', awayTeam: 'bra', date: '2026-06-08T14:00:00Z', stage: 'Group Stage' }, // Monday
              { id: 'f003', homeTeam: 'arg', awayTeam: 'mex', date: '2026-06-14T23:59:00Z', stage: 'Group Stage' }  // Sunday
            ]
          });
        }
        if (filename === 'results.json') {
          return Promise.resolve({ results: [] });
        }
      });

      const result = await getFixturesForWeek('2026-06-08T10:00:00Z');

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('f002');
      expect(result[1].id).toBe('f003');
    });

    it('returns empty array when no fixtures in the week', async () => {
      readFile.mockImplementation((filename) => {
        if (filename === 'fixtures.json') {
          return Promise.resolve({
            fixtures: [
              { id: 'f001', homeTeam: 'eng', awayTeam: 'fra', date: '2026-06-20T14:00:00Z', stage: 'Group Stage' }
            ]
          });
        }
        if (filename === 'results.json') {
          return Promise.resolve({ results: [] });
        }
      });

      const result = await getFixturesForWeek('2026-06-11T10:00:00Z');

      expect(result).toHaveLength(0);
    });

    it('enriches fixtures with result status within the week', async () => {
      readFile.mockImplementation((filename) => {
        if (filename === 'fixtures.json') {
          return Promise.resolve({
            fixtures: [
              { id: 'f001', homeTeam: 'eng', awayTeam: 'fra', date: '2026-06-11T14:00:00Z', stage: 'Group Stage' },
              { id: 'f002', homeTeam: 'ger', awayTeam: 'bra', date: '2026-06-12T20:00:00Z', stage: 'Group Stage' }
            ]
          });
        }
        if (filename === 'results.json') {
          return Promise.resolve({
            results: [
              { id: 'r001', fixtureId: 'f001', homeTeam: 'eng', awayTeam: 'fra', homeScore: 3, awayScore: 0, date: '2026-06-11T14:00:00Z', stage: 'Group Stage', penaltyShootout: null }
            ]
          });
        }
      });

      const result = await getFixturesForWeek('2026-06-11T10:00:00Z');

      expect(result).toHaveLength(2);
      expect(result[0].status).toBe('completed');
      expect(result[0].homeScore).toBe(3);
      expect(result[0].awayScore).toBe(0);
      expect(result[1].status).toBe('scheduled');
    });
  });
});
