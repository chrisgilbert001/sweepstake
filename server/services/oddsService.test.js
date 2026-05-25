import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFile as fsWrite, rm } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  setTournamentOdds,
  getTournamentOdds,
  setMatchOdds,
  getMatchOdds,
  getUnderdog
} from './oddsService.js';
import { getAllTeamIds } from './teamService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '..', 'data');
const ODDS_FILE_PATH = path.join(DATA_DIR, 'odds.json');

/**
 * Helper: build a valid odds object for all 48 teams.
 */
async function buildValidTournamentOdds(baseOdds = 5.0) {
  const teamIds = await getAllTeamIds();
  const odds = {};
  teamIds.forEach((id, index) => {
    odds[id] = baseOdds + index * 0.5;
  });
  return odds;
}

/**
 * Helper: reset odds.json to initial empty state.
 */
async function resetOddsFile() {
  await fsWrite(ODDS_FILE_PATH, JSON.stringify({
    tournament: null,
    matches: {}
  }, null, 2), 'utf-8');
}

describe('oddsService', () => {
  beforeEach(async () => {
    await resetOddsFile();
  });

  afterEach(async () => {
    await resetOddsFile();
    // Clean up any lock files
    try { await rm(ODDS_FILE_PATH + '.lock', { recursive: true }); } catch (e) { /* ignore */ }
  });

  describe('setTournamentOdds', () => {
    it('stores a valid tournament odds snapshot with all 48 teams', async () => {
      const oddsData = await buildValidTournamentOdds();
      const result = await setTournamentOdds(oddsData);

      expect(result).toHaveProperty('capturedAt');
      expect(result).toHaveProperty('odds');
      expect(Object.keys(result.odds)).toHaveLength(48);
    });

    it('preserves all odds values exactly as provided', async () => {
      const oddsData = await buildValidTournamentOdds(3.0);
      const result = await setTournamentOdds(oddsData);

      for (const [teamId, value] of Object.entries(oddsData)) {
        expect(result.odds[teamId]).toBe(value);
      }
    });

    it('sets a capturedAt timestamp in ISO format', async () => {
      const oddsData = await buildValidTournamentOdds();
      const result = await setTournamentOdds(oddsData);

      const parsed = new Date(result.capturedAt);
      expect(parsed.toISOString()).toBe(result.capturedAt);
    });

    it('rejects when tournament odds are already set (immutability)', async () => {
      const oddsData = await buildValidTournamentOdds();
      await setTournamentOdds(oddsData);

      await expect(setTournamentOdds(oddsData)).rejects.toMatchObject({
        statusCode: 400,
        message: 'Tournament odds already set'
      });
    });

    it('rejects when fewer than 48 teams are provided', async () => {
      const oddsData = { usa: 5.5, ger: 7.0 };

      await expect(setTournamentOdds(oddsData)).rejects.toMatchObject({
        statusCode: 400,
        message: 'Odds must be provided for all 48 teams'
      });
    });

    it('rejects when a required team is missing from the snapshot', async () => {
      const teamIds = await getAllTeamIds();
      const oddsData = {};
      // Provide 48 entries but with one wrong key
      teamIds.forEach((id, index) => {
        oddsData[id] = 5.0 + index * 0.1;
      });
      // Remove one valid team and add a fake one
      const removedTeam = teamIds[0];
      delete oddsData[removedTeam];
      oddsData['fake_team'] = 10.0;

      await expect(setTournamentOdds(oddsData)).rejects.toMatchObject({
        statusCode: 400,
        message: 'Odds must be provided for all 48 teams'
      });
    });

    it('rejects when any odds value is not a number', async () => {
      const oddsData = await buildValidTournamentOdds();
      const firstTeam = Object.keys(oddsData)[0];
      oddsData[firstTeam] = 'not a number';

      await expect(setTournamentOdds(oddsData)).rejects.toMatchObject({
        statusCode: 400,
        message: 'Odds must be greater than 1.0'
      });
    });

    it('rejects when any odds value is exactly 1.0', async () => {
      const oddsData = await buildValidTournamentOdds();
      const firstTeam = Object.keys(oddsData)[0];
      oddsData[firstTeam] = 1.0;

      await expect(setTournamentOdds(oddsData)).rejects.toMatchObject({
        statusCode: 400,
        message: 'Odds must be greater than 1.0'
      });
    });

    it('rejects when any odds value is less than 1.0', async () => {
      const oddsData = await buildValidTournamentOdds();
      const firstTeam = Object.keys(oddsData)[0];
      oddsData[firstTeam] = 0.5;

      await expect(setTournamentOdds(oddsData)).rejects.toMatchObject({
        statusCode: 400,
        message: 'Odds must be greater than 1.0'
      });
    });

    it('rejects when any odds value is zero', async () => {
      const oddsData = await buildValidTournamentOdds();
      const firstTeam = Object.keys(oddsData)[0];
      oddsData[firstTeam] = 0;

      await expect(setTournamentOdds(oddsData)).rejects.toMatchObject({
        statusCode: 400,
        message: 'Odds must be greater than 1.0'
      });
    });

    it('rejects when any odds value is negative', async () => {
      const oddsData = await buildValidTournamentOdds();
      const firstTeam = Object.keys(oddsData)[0];
      oddsData[firstTeam] = -2.5;

      await expect(setTournamentOdds(oddsData)).rejects.toMatchObject({
        statusCode: 400,
        message: 'Odds must be greater than 1.0'
      });
    });

    it('accepts odds value of 1.01 (just above minimum)', async () => {
      const teamIds = await getAllTeamIds();
      const oddsData = {};
      teamIds.forEach(id => { oddsData[id] = 1.01; });

      const result = await setTournamentOdds(oddsData);
      expect(Object.keys(result.odds)).toHaveLength(48);
    });
  });

  describe('getTournamentOdds', () => {
    it('returns null when no tournament odds have been set', async () => {
      const result = await getTournamentOdds();
      expect(result).toBeNull();
    });

    it('returns the stored tournament odds after they are set', async () => {
      const oddsData = await buildValidTournamentOdds();
      await setTournamentOdds(oddsData);

      const result = await getTournamentOdds();
      expect(result).toHaveProperty('capturedAt');
      expect(result).toHaveProperty('odds');
      expect(Object.keys(result.odds)).toHaveLength(48);
    });

    it('returns identical values to what was stored (round-trip)', async () => {
      const oddsData = await buildValidTournamentOdds(2.5);
      await setTournamentOdds(oddsData);

      const result = await getTournamentOdds();
      for (const [teamId, value] of Object.entries(oddsData)) {
        expect(result.odds[teamId]).toBe(value);
      }
    });
  });

  describe('setMatchOdds', () => {
    it('stores match odds for a fixture', async () => {
      const matchOdds = { usa: 1.85, ger: 3.40, draw: 3.60 };
      const result = await setMatchOdds('f001', matchOdds);

      expect(result).toEqual(matchOdds);
    });

    it('persists match odds that can be retrieved', async () => {
      const matchOdds = { bra: 2.10, arg: 2.80, draw: 3.20 };
      await setMatchOdds('f002', matchOdds);

      const result = await getMatchOdds('f002');
      expect(result).toEqual(matchOdds);
    });

    it('allows multiple fixtures to have odds stored', async () => {
      await setMatchOdds('f001', { usa: 1.85, ger: 3.40, draw: 3.60 });
      await setMatchOdds('f002', { bra: 2.10, arg: 2.80, draw: 3.20 });

      const odds1 = await getMatchOdds('f001');
      const odds2 = await getMatchOdds('f002');
      expect(odds1).toEqual({ usa: 1.85, ger: 3.40, draw: 3.60 });
      expect(odds2).toEqual({ bra: 2.10, arg: 2.80, draw: 3.20 });
    });

    it('overwrites existing match odds for the same fixture', async () => {
      await setMatchOdds('f001', { usa: 1.85, ger: 3.40, draw: 3.60 });
      await setMatchOdds('f001', { usa: 2.00, ger: 3.00, draw: 3.50 });

      const result = await getMatchOdds('f001');
      expect(result).toEqual({ usa: 2.00, ger: 3.00, draw: 3.50 });
    });

    it('rejects empty fixture ID', async () => {
      await expect(setMatchOdds('', { usa: 1.85 })).rejects.toMatchObject({
        statusCode: 400,
        message: 'Invalid fixture ID'
      });
    });

    it('rejects null fixture ID', async () => {
      await expect(setMatchOdds(null, { usa: 1.85 })).rejects.toMatchObject({
        statusCode: 400,
        message: 'Invalid fixture ID'
      });
    });

    it('rejects empty odds data object', async () => {
      await expect(setMatchOdds('f001', {})).rejects.toMatchObject({
        statusCode: 400,
        message: 'Invalid odds data'
      });
    });

    it('rejects null odds data', async () => {
      await expect(setMatchOdds('f001', null)).rejects.toMatchObject({
        statusCode: 400,
        message: 'Invalid odds data'
      });
    });

    it('rejects odds values that are not greater than 1.0', async () => {
      await expect(setMatchOdds('f001', { usa: 0.5, ger: 3.40 })).rejects.toMatchObject({
        statusCode: 400,
        message: 'Odds must be greater than 1.0'
      });
    });

    it('rejects odds values that are exactly 1.0', async () => {
      await expect(setMatchOdds('f001', { usa: 1.0, ger: 3.40, draw: 3.60 })).rejects.toMatchObject({
        statusCode: 400,
        message: 'Odds must be greater than 1.0'
      });
    });

    it('rejects non-numeric odds values', async () => {
      await expect(setMatchOdds('f001', { usa: 'high', ger: 3.40 })).rejects.toMatchObject({
        statusCode: 400,
        message: 'Odds must be greater than 1.0'
      });
    });
  });

  describe('getMatchOdds', () => {
    it('returns null for a fixture with no odds set', async () => {
      const result = await getMatchOdds('f999');
      expect(result).toBeNull();
    });

    it('returns the stored match odds for a fixture', async () => {
      const matchOdds = { usa: 1.85, ger: 3.40, draw: 3.60 };
      await setMatchOdds('f001', matchOdds);

      const result = await getMatchOdds('f001');
      expect(result).toEqual(matchOdds);
    });

    it('does not return odds from a different fixture', async () => {
      await setMatchOdds('f001', { usa: 1.85, ger: 3.40, draw: 3.60 });

      const result = await getMatchOdds('f002');
      expect(result).toBeNull();
    });
  });

  describe('getUnderdog', () => {
    it('returns the team with higher odds as the underdog', () => {
      const matchOdds = { usa: 1.85, ger: 3.40, draw: 3.60 };
      const result = getUnderdog(matchOdds);
      expect(result).toBe('ger');
    });

    it('returns the other team when first team has higher odds', () => {
      const matchOdds = { bra: 4.50, arg: 2.10, draw: 3.20 };
      const result = getUnderdog(matchOdds);
      expect(result).toBe('bra');
    });

    it('returns null when both teams have equal odds', () => {
      const matchOdds = { usa: 2.50, ger: 2.50, draw: 3.00 };
      const result = getUnderdog(matchOdds);
      expect(result).toBeNull();
    });

    it('ignores the draw key when determining underdog', () => {
      const matchOdds = { usa: 1.85, ger: 3.40, draw: 50.0 };
      const result = getUnderdog(matchOdds);
      expect(result).toBe('ger');
    });

    it('returns null for null input', () => {
      const result = getUnderdog(null);
      expect(result).toBeNull();
    });

    it('returns null for undefined input', () => {
      const result = getUnderdog(undefined);
      expect(result).toBeNull();
    });

    it('returns null when there are not exactly 2 teams (excluding draw)', () => {
      const matchOdds = { usa: 1.85, draw: 3.60 };
      const result = getUnderdog(matchOdds);
      expect(result).toBeNull();
    });

    it('returns null for an empty object', () => {
      const result = getUnderdog({});
      expect(result).toBeNull();
    });

    it('works without a draw key present', () => {
      const matchOdds = { usa: 1.85, ger: 3.40 };
      const result = getUnderdog(matchOdds);
      expect(result).toBe('ger');
    });
  });
});
