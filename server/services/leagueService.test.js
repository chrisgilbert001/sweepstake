import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFile as fsWrite, rm, mkdir, readdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  validateName,
  slugify,
  generateJoinCode,
  createLeague,
  getLeague,
  getLeagueByJoinCode,
  addParticipant,
  listLeagues
} from './leagueService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LEAGUES_DIR = path.join(__dirname, '..', 'data', 'leagues');

// Helper to clean up test league files (preserves non-test data)
const PROTECTED_FILES = new Set(['.gitkeep', 'the-lads.json']);

async function cleanLeagues() {
  try {
    const files = await readdir(LEAGUES_DIR);
    for (const file of files) {
      if (PROTECTED_FILES.has(file)) continue;
      await rm(path.join(LEAGUES_DIR, file), { recursive: true });
    }
  } catch (e) { /* ignore */ }
}

describe('leagueService', () => {
  beforeEach(async () => {
    if (!existsSync(LEAGUES_DIR)) {
      await mkdir(LEAGUES_DIR, { recursive: true });
    }
    await cleanLeagues();
  });

  afterEach(async () => {
    await cleanLeagues();
  });

  describe('validateName', () => {
    it('accepts a valid name', () => {
      expect(validateName('Office Legends')).toBe(true);
    });

    it('accepts a single character name', () => {
      expect(validateName('A')).toBe(true);
    });

    it('accepts a 50-character name', () => {
      expect(validateName('a'.repeat(50))).toBe(true);
    });

    it('rejects an empty string', () => {
      expect(validateName('')).toBe(false);
    });

    it('rejects a name longer than 50 characters', () => {
      expect(validateName('a'.repeat(51))).toBe(false);
    });

    it('rejects a name with only whitespace', () => {
      expect(validateName('   ')).toBe(false);
      expect(validateName('\t\n')).toBe(false);
    });

    it('accepts a name with leading/trailing whitespace if it has non-whitespace', () => {
      expect(validateName('  hello  ')).toBe(true);
    });

    it('rejects non-string values', () => {
      expect(validateName(null)).toBe(false);
      expect(validateName(undefined)).toBe(false);
      expect(validateName(123)).toBe(false);
    });
  });

  describe('slugify', () => {
    it('converts to lowercase', () => {
      expect(slugify('Office Legends')).toBe('office-legends');
    });

    it('replaces spaces with hyphens', () => {
      expect(slugify('my cool league')).toBe('my-cool-league');
    });

    it('removes special characters', () => {
      expect(slugify("Bob's League!")).toBe('bobs-league');
    });

    it('collapses multiple hyphens', () => {
      expect(slugify('a--b---c')).toBe('a-b-c');
    });

    it('trims leading and trailing hyphens', () => {
      expect(slugify('-hello-')).toBe('hello');
    });

    it('handles multiple spaces', () => {
      expect(slugify('a   b')).toBe('a-b');
    });

    it('handles names with numbers', () => {
      expect(slugify('League 2026')).toBe('league-2026');
    });

    it('trims whitespace from input', () => {
      expect(slugify('  hello world  ')).toBe('hello-world');
    });
  });

  describe('generateJoinCode', () => {
    it('generates a 6-character string', () => {
      const code = generateJoinCode();
      expect(code).toHaveLength(6);
    });

    it('generates only lowercase alphanumeric characters', () => {
      const code = generateJoinCode();
      expect(code).toMatch(/^[a-z0-9]{6}$/);
    });

    it('generates different codes on successive calls', () => {
      const codes = new Set();
      for (let i = 0; i < 20; i++) {
        codes.add(generateJoinCode());
      }
      // With 36^6 possibilities, 20 codes should all be unique
      expect(codes.size).toBe(20);
    });
  });

  describe('createLeague', () => {
    it('creates a league with correct structure', async () => {
      const league = await createLeague('Office Legends');
      expect(league.slug).toBe('office-legends');
      expect(league.name).toBe('Office Legends');
      expect(league.joinCode).toMatch(/^[a-z0-9]{6}$/);
      expect(league.createdAt).toBeDefined();
      expect(league.participants).toEqual([]);
      expect(league.draft.status).toBe('not_started');
      expect(league.draft.order).toEqual([]);
      expect(league.draft.currentPot).toBe(4);
      expect(league.draft.currentRound).toBe(1);
      expect(league.draft.currentPickIndex).toBe(0);
      expect(league.draft.spinsCompleted).toBe(0);
      expect(league.draft.allocations).toEqual({});
    });

    it('rejects invalid league names', async () => {
      await expect(createLeague('')).rejects.toMatchObject({ statusCode: 400 });
      await expect(createLeague('   ')).rejects.toMatchObject({ statusCode: 400 });
      await expect(createLeague('a'.repeat(51))).rejects.toMatchObject({ statusCode: 400 });
    });

    it('rejects duplicate league names (case-sensitive)', async () => {
      await createLeague('Office Legends');
      await expect(createLeague('Office Legends')).rejects.toMatchObject({
        statusCode: 409,
        message: 'League name already taken'
      });
    });

    it('allows leagues with different casing', async () => {
      await createLeague('Office Legends');
      const league2 = await createLeague('office legends');
      expect(league2.name).toBe('office legends');
    });
  });

  describe('getLeague', () => {
    it('retrieves an existing league', async () => {
      await createLeague('Test League');
      const league = await getLeague('test-league');
      expect(league.name).toBe('Test League');
    });

    it('throws 404 for non-existent league', async () => {
      await expect(getLeague('nonexistent')).rejects.toMatchObject({
        statusCode: 404,
        message: 'League not found'
      });
    });
  });

  describe('getLeagueByJoinCode', () => {
    it('finds a league by join code', async () => {
      const created = await createLeague('Join Test');
      const found = await getLeagueByJoinCode(created.joinCode);
      expect(found.name).toBe('Join Test');
    });

    it('throws 404 for invalid join code', async () => {
      await expect(getLeagueByJoinCode('zzzzzz')).rejects.toMatchObject({
        statusCode: 404,
        message: 'League not found'
      });
    });
  });

  describe('addParticipant', () => {
    let league;

    beforeEach(async () => {
      league = await createLeague('Participant Test');
    });

    it('adds a participant to the league', async () => {
      const updated = await addParticipant('participant-test', 'Alice');
      expect(updated.participants).toHaveLength(1);
      expect(updated.participants[0]).toEqual({ id: 'p1', name: 'Alice' });
    });

    it('adds multiple participants with sequential IDs', async () => {
      await addParticipant('participant-test', 'Alice');
      const updated = await addParticipant('participant-test', 'Bob');
      expect(updated.participants).toHaveLength(2);
      expect(updated.participants[1]).toEqual({ id: 'p2', name: 'Bob' });
    });

    it('rejects invalid participant names', async () => {
      await expect(addParticipant('participant-test', '')).rejects.toMatchObject({ statusCode: 400 });
      await expect(addParticipant('participant-test', '   ')).rejects.toMatchObject({ statusCode: 400 });
      await expect(addParticipant('participant-test', 'a'.repeat(51))).rejects.toMatchObject({ statusCode: 400 });
    });

    it('rejects duplicate participant names', async () => {
      await addParticipant('participant-test', 'Alice');
      await expect(addParticipant('participant-test', 'Alice')).rejects.toMatchObject({
        statusCode: 409,
        message: 'Participant name already used in this league'
      });
    });

    it('rejects more than 6 participants', async () => {
      await addParticipant('participant-test', 'P1');
      await addParticipant('participant-test', 'P2');
      await addParticipant('participant-test', 'P3');
      await addParticipant('participant-test', 'P4');
      await addParticipant('participant-test', 'P5');
      await addParticipant('participant-test', 'P6');
      await expect(addParticipant('participant-test', 'P7')).rejects.toMatchObject({
        statusCode: 400,
        message: 'League already has maximum 6 participants'
      });
    });
  });

  describe('listLeagues', () => {
    it('returns empty array when no leagues exist', async () => {
      const slugs = await listLeagues();
      expect(slugs).toEqual([]);
    });

    it('returns slugs of created leagues', async () => {
      await createLeague('Alpha');
      await createLeague('Beta');
      const slugs = await listLeagues();
      expect(slugs.sort()).toEqual(['alpha', 'beta']);
    });
  });
});
