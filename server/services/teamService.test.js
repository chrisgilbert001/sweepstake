import { describe, it, expect } from 'vitest';
import {
  getAllTeams,
  getTeamsInPot,
  teamExists,
  getTeamById,
  getAllTeamIds,
  getPotForSeedRank
} from './teamService.js';

describe('teamService', () => {
  describe('getAllTeams', () => {
    it('returns the full pot structure with 4 pots', async () => {
      const result = await getAllTeams();
      expect(result).toHaveProperty('pots');
      expect(result.pots).toHaveLength(4);
    });

    it('each pot has a potNumber and teams array', async () => {
      const result = await getAllTeams();
      for (const pot of result.pots) {
        expect(pot).toHaveProperty('potNumber');
        expect(pot).toHaveProperty('teams');
        expect(Array.isArray(pot.teams)).toBe(true);
      }
    });

    it('contains exactly 48 teams total', async () => {
      const result = await getAllTeams();
      const totalTeams = result.pots.reduce((sum, pot) => sum + pot.teams.length, 0);
      expect(totalTeams).toBe(48);
    });

    it('each pot contains exactly 12 teams', async () => {
      const result = await getAllTeams();
      for (const pot of result.pots) {
        expect(pot.teams).toHaveLength(12);
      }
    });
  });

  describe('getTeamsInPot', () => {
    it('returns 12 teams for pot 1', async () => {
      const teams = await getTeamsInPot(1);
      expect(teams).toHaveLength(12);
    });

    it('returns 12 teams for pot 4', async () => {
      const teams = await getTeamsInPot(4);
      expect(teams).toHaveLength(12);
    });

    it('pot 1 contains seed ranks 1-12', async () => {
      const teams = await getTeamsInPot(1);
      const ranks = teams.map(t => t.seedRank).sort((a, b) => a - b);
      expect(ranks).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    });

    it('pot 2 contains seed ranks 13-24', async () => {
      const teams = await getTeamsInPot(2);
      const ranks = teams.map(t => t.seedRank).sort((a, b) => a - b);
      expect(ranks).toEqual([13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24]);
    });

    it('pot 3 contains seed ranks 25-36', async () => {
      const teams = await getTeamsInPot(3);
      const ranks = teams.map(t => t.seedRank).sort((a, b) => a - b);
      expect(ranks).toEqual([25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36]);
    });

    it('pot 4 contains seed ranks 37-48', async () => {
      const teams = await getTeamsInPot(4);
      const ranks = teams.map(t => t.seedRank).sort((a, b) => a - b);
      expect(ranks).toEqual([37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48]);
    });

    it('throws for invalid pot number 0', async () => {
      await expect(getTeamsInPot(0)).rejects.toMatchObject({
        statusCode: 400,
        message: 'Invalid pot number'
      });
    });

    it('throws for invalid pot number 5', async () => {
      await expect(getTeamsInPot(5)).rejects.toMatchObject({
        statusCode: 400,
        message: 'Invalid pot number'
      });
    });

    it('throws for non-integer pot number', async () => {
      await expect(getTeamsInPot(1.5)).rejects.toMatchObject({
        statusCode: 400,
        message: 'Invalid pot number'
      });
    });
  });

  describe('teamExists', () => {
    it('returns true for a valid team ID in pot 1', async () => {
      expect(await teamExists('usa')).toBe(true);
    });

    it('returns true for a valid team ID in pot 4', async () => {
      expect(await teamExists('tto')).toBe(true);
    });

    it('returns false for a non-existent team ID', async () => {
      expect(await teamExists('xyz')).toBe(false);
    });

    it('returns false for an empty string', async () => {
      expect(await teamExists('')).toBe(false);
    });
  });

  describe('getTeamById', () => {
    it('returns the team object for a valid ID', async () => {
      const team = await getTeamById('arg');
      expect(team).toEqual({ id: 'arg', name: 'Argentina', seedRank: 4 });
    });

    it('returns a team from pot 4', async () => {
      const team = await getTeamById('cmr');
      expect(team).toEqual({ id: 'cmr', name: 'Cameroon', seedRank: 37 });
    });

    it('returns null for a non-existent team ID', async () => {
      const team = await getTeamById('nonexistent');
      expect(team).toBeNull();
    });
  });

  describe('getAllTeamIds', () => {
    it('returns exactly 48 team IDs', async () => {
      const ids = await getAllTeamIds();
      expect(ids).toHaveLength(48);
    });

    it('returns all unique IDs', async () => {
      const ids = await getAllTeamIds();
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(48);
    });

    it('includes known team IDs', async () => {
      const ids = await getAllTeamIds();
      expect(ids).toContain('usa');
      expect(ids).toContain('arg');
      expect(ids).toContain('tto');
    });
  });

  describe('getPotForSeedRank', () => {
    it('maps rank 1 to pot 1', () => {
      expect(getPotForSeedRank(1)).toBe(1);
    });

    it('maps rank 12 to pot 1', () => {
      expect(getPotForSeedRank(12)).toBe(1);
    });

    it('maps rank 13 to pot 2', () => {
      expect(getPotForSeedRank(13)).toBe(2);
    });

    it('maps rank 24 to pot 2', () => {
      expect(getPotForSeedRank(24)).toBe(2);
    });

    it('maps rank 25 to pot 3', () => {
      expect(getPotForSeedRank(25)).toBe(3);
    });

    it('maps rank 36 to pot 3', () => {
      expect(getPotForSeedRank(36)).toBe(3);
    });

    it('maps rank 37 to pot 4', () => {
      expect(getPotForSeedRank(37)).toBe(4);
    });

    it('maps rank 48 to pot 4', () => {
      expect(getPotForSeedRank(48)).toBe(4);
    });

    it('throws for rank 0', () => {
      expect(() => getPotForSeedRank(0)).toThrow();
    });

    it('throws for rank 49', () => {
      expect(() => getPotForSeedRank(49)).toThrow();
    });

    it('throws for non-integer rank', () => {
      expect(() => getPotForSeedRank(2.5)).toThrow();
    });
  });
});
