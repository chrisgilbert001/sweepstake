import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { writeFile, readFile } from './storageService.js';
import { generateStandingsText } from './exportService.js';
import { rm, readdir, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LEAGUES_DIR = path.join(__dirname, '..', 'data', 'leagues');

const RESULTS_FILE = 'results.json';

/**
 * Helper to create a test league with participants and draft allocations.
 */
async function createTestLeague(slug, name, participants, allocations) {
  const league = {
    slug,
    name,
    joinCode: 'abc123',
    createdAt: '2025-01-01T00:00:00Z',
    participants,
    draft: {
      status: 'completed',
      order: participants.map(p => p.id),
      currentPot: 1,
      currentRound: 2,
      currentPickIndex: 5,
      spinsCompleted: 48,
      allocations
    }
  };
  await writeFile(`leagues/${slug}.json`, league);
}

const PROTECTED_LEAGUE_FILES = new Set(['.gitkeep', 'the-lads.json']);

async function cleanLeagues() {
  try {
    const files = await readdir(LEAGUES_DIR);
    for (const file of files) {
      if (PROTECTED_LEAGUE_FILES.has(file)) continue;
      await rm(path.join(LEAGUES_DIR, file), { recursive: true });
    }
  } catch (e) { /* ignore */ }
}

let originalResults;

async function resetResults() {
  await writeFile(RESULTS_FILE, { results: [] });
}

describe('exportService', () => {
  beforeEach(async () => {
    if (!existsSync(LEAGUES_DIR)) {
      await mkdir(LEAGUES_DIR, { recursive: true });
    }
    try { originalResults = await readFile(RESULTS_FILE); } catch { originalResults = { results: [] }; }
    await cleanLeagues();
    await resetResults();
  });

  afterEach(async () => {
    await cleanLeagues();
    await writeFile(RESULTS_FILE, originalResults);
  });

  describe('generateStandingsText', () => {
    it('generates text with league name, date, and participants in rank order', async () => {
      await createTestLeague('test-league', 'My Test League',
        [
          { id: 'p1', name: 'Alice' },
          { id: 'p2', name: 'Bob' }
        ],
        {
          p1: { pot1: ['usa'], pot2: [], pot3: [], pot4: [] },
          p2: { pot1: ['bra'], pot2: [], pot3: [], pot4: [] }
        }
      );
      await writeFile(RESULTS_FILE, {
        results: [{
          id: 'r001', fixtureId: 'f001', homeTeam: 'usa', awayTeam: 'bra',
          homeScore: 2, awayScore: 1, date: '2026-06-11T18:00:00Z', stage: 'Group Stage', penaltyShootout: null
        }]
      });

      const text = await generateStandingsText('test-league');
      const lines = text.split('\n');

      // Header should contain league name and date in DD/MM/YYYY format
      expect(lines[0]).toMatch(/^My Test League - Standings \(\d{2}\/\d{2}\/\d{4}\)$/);
      // Empty line after header
      expect(lines[1]).toBe('');
      // Alice (3 pts) should be first
      expect(lines[2]).toBe('1. Alice - 3 pts');
      // Bob (0 pts) should be second
      expect(lines[3]).toBe('2. Bob - 0 pts');
    });

    it('uses DD/MM/YYYY date format with UTC date', async () => {
      // Mock the date to a known value
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-07-15T10:00:00Z'));

      await createTestLeague('test-league', 'League One',
        [{ id: 'p1', name: 'Alice' }],
        { p1: { pot1: ['usa'], pot2: [], pot3: [], pot4: [] } }
      );

      const text = await generateStandingsText('test-league');
      const lines = text.split('\n');

      expect(lines[0]).toBe('League One - Standings (15/07/2026)');

      vi.useRealTimers();
    });

    it('handles empty standings (no participants)', async () => {
      await createTestLeague('empty-league', 'Empty League', [], {});

      const text = await generateStandingsText('empty-league');
      const lines = text.split('\n');

      // Header should still be present
      expect(lines[0]).toMatch(/^Empty League - Standings \(\d{2}\/\d{2}\/\d{4}\)$/);
      // Empty line after header
      expect(lines[1]).toBe('');
      // No participant lines
      expect(lines.length).toBe(2);
    });

    it('shows shared ranks for tied participants', async () => {
      await createTestLeague('test-league', 'Tied League',
        [
          { id: 'p1', name: 'Alice' },
          { id: 'p2', name: 'Bob' },
          { id: 'p3', name: 'Charlie' }
        ],
        {
          p1: { pot1: ['usa'], pot2: [], pot3: [], pot4: [] },
          p2: { pot1: ['bra'], pot2: [], pot3: [], pot4: [] },
          p3: { pot1: ['ger'], pot2: [], pot3: [], pot4: [] }
        }
      );
      // No results means all tied at 0 points

      const text = await generateStandingsText('test-league');
      const lines = text.split('\n');

      // All participants should share rank 1
      expect(lines[2]).toBe('1. Alice - 0 pts');
      expect(lines[3]).toBe('1. Bob - 0 pts');
      expect(lines[4]).toBe('1. Charlie - 0 pts');
    });

    it('throws 404 for non-existent league', async () => {
      await expect(generateStandingsText('nonexistent'))
        .rejects.toMatchObject({ statusCode: 404 });
    });
  });
});
