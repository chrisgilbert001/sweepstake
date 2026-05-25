import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkTournamentComplete, getTournamentStatus } from './tournamentService.js';
import * as storageService from './storageService.js';

vi.mock('./storageService.js');

describe('tournamentService', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('checkTournamentComplete', () => {
    it('returns true and marks complete when all fixtures have results', async () => {
      storageService.readFile.mockImplementation((filename) => {
        if (filename === 'fixtures.json') {
          return Promise.resolve({
            fixtures: [
              { id: 'f001', homeTeam: 'usa', awayTeam: 'ger' },
              { id: 'f002', homeTeam: 'bra', awayTeam: 'arg' }
            ]
          });
        }
        if (filename === 'results.json') {
          return Promise.resolve({
            results: [
              { id: 'r001', fixtureId: 'f001', homeScore: 2, awayScore: 1 },
              { id: 'r002', fixtureId: 'f002', homeScore: 0, awayScore: 3 }
            ]
          });
        }
      });
      storageService.updateFile.mockResolvedValue({
        status: 'complete',
        completedAt: '2026-07-19T22:00:00.000Z'
      });

      const result = await checkTournamentComplete();

      expect(result).toBe(true);
      expect(storageService.updateFile).toHaveBeenCalledWith(
        'tournament.json',
        expect.any(Function)
      );

      // Verify the transform function produces correct output
      const transformFn = storageService.updateFile.mock.calls[0][1];
      const updated = transformFn({ status: 'in_progress', completedAt: null });
      expect(updated.status).toBe('complete');
      expect(updated.completedAt).toBeDefined();
      expect(typeof updated.completedAt).toBe('string');
    });

    it('returns false when not all fixtures have results', async () => {
      storageService.readFile.mockImplementation((filename) => {
        if (filename === 'fixtures.json') {
          return Promise.resolve({
            fixtures: [
              { id: 'f001', homeTeam: 'usa', awayTeam: 'ger' },
              { id: 'f002', homeTeam: 'bra', awayTeam: 'arg' },
              { id: 'f003', homeTeam: 'fra', awayTeam: 'eng' }
            ]
          });
        }
        if (filename === 'results.json') {
          return Promise.resolve({
            results: [
              { id: 'r001', fixtureId: 'f001', homeScore: 2, awayScore: 1 }
            ]
          });
        }
      });

      const result = await checkTournamentComplete();

      expect(result).toBe(false);
      expect(storageService.updateFile).not.toHaveBeenCalled();
    });

    it('returns false when there are no fixtures', async () => {
      storageService.readFile.mockImplementation((filename) => {
        if (filename === 'fixtures.json') {
          return Promise.resolve({ fixtures: [] });
        }
        if (filename === 'results.json') {
          return Promise.resolve({ results: [] });
        }
      });

      const result = await checkTournamentComplete();

      expect(result).toBe(false);
      expect(storageService.updateFile).not.toHaveBeenCalled();
    });

    it('returns false when fixtures exist but no results recorded', async () => {
      storageService.readFile.mockImplementation((filename) => {
        if (filename === 'fixtures.json') {
          return Promise.resolve({
            fixtures: [
              { id: 'f001', homeTeam: 'usa', awayTeam: 'ger' }
            ]
          });
        }
        if (filename === 'results.json') {
          return Promise.resolve({ results: [] });
        }
      });

      const result = await checkTournamentComplete();

      expect(result).toBe(false);
      expect(storageService.updateFile).not.toHaveBeenCalled();
    });

    it('handles extra results for non-existent fixtures gracefully', async () => {
      storageService.readFile.mockImplementation((filename) => {
        if (filename === 'fixtures.json') {
          return Promise.resolve({
            fixtures: [
              { id: 'f001', homeTeam: 'usa', awayTeam: 'ger' }
            ]
          });
        }
        if (filename === 'results.json') {
          return Promise.resolve({
            results: [
              { id: 'r001', fixtureId: 'f001', homeScore: 2, awayScore: 1 },
              { id: 'r099', fixtureId: 'f099', homeScore: 1, awayScore: 0 }
            ]
          });
        }
      });
      storageService.updateFile.mockResolvedValue({
        status: 'complete',
        completedAt: '2026-07-19T22:00:00.000Z'
      });

      const result = await checkTournamentComplete();

      expect(result).toBe(true);
      expect(storageService.updateFile).toHaveBeenCalled();
    });

    it('marks complete with a single fixture that has a result', async () => {
      storageService.readFile.mockImplementation((filename) => {
        if (filename === 'fixtures.json') {
          return Promise.resolve({
            fixtures: [{ id: 'f001', homeTeam: 'usa', awayTeam: 'ger' }]
          });
        }
        if (filename === 'results.json') {
          return Promise.resolve({
            results: [{ id: 'r001', fixtureId: 'f001', homeScore: 1, awayScore: 1 }]
          });
        }
      });
      storageService.updateFile.mockResolvedValue({
        status: 'complete',
        completedAt: '2026-07-19T22:00:00.000Z'
      });

      const result = await checkTournamentComplete();

      expect(result).toBe(true);
      expect(storageService.updateFile).toHaveBeenCalled();
    });
  });

  describe('getTournamentStatus', () => {
    it('returns the current tournament state', async () => {
      storageService.readFile.mockResolvedValue({
        status: 'in_progress',
        completedAt: null
      });

      const status = await getTournamentStatus();

      expect(status).toEqual({ status: 'in_progress', completedAt: null });
      expect(storageService.readFile).toHaveBeenCalledWith('tournament.json');
    });

    it('returns complete state when tournament is finished', async () => {
      storageService.readFile.mockResolvedValue({
        status: 'complete',
        completedAt: '2026-07-19T22:00:00.000Z'
      });

      const status = await getTournamentStatus();

      expect(status).toEqual({
        status: 'complete',
        completedAt: '2026-07-19T22:00:00.000Z'
      });
    });
  });
});
