import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock storageService
vi.mock('./storageService.js', () => ({
  readFile: vi.fn(),
}));

import { readFile } from './storageService.js';
import { getBracketData, determineWinner } from './bracketService.js';

/**
 * Helper: mock readFile with the given fixtures and results.
 * The bracket template is returned for 'bracket-template.json'.
 */
function mockData({ fixtures = [], results = [], template = null } = {}) {
  readFile.mockImplementation((filename) => {
    if (filename === 'fixtures.json') return Promise.resolve({ fixtures });
    if (filename === 'results.json') return Promise.resolve({ results });
    if (filename === 'bracket-template.json') {
      if (template) return Promise.resolve(template);
      return Promise.reject(new Error('no template'));
    }
    return Promise.resolve({});
  });
}

/** Build the 16 Round of 32 fixtures with apiMatchId ascending in official order. */
function buildRoundOf32Fixtures() {
  const fixtures = [];
  for (let k = 0; k < 16; k++) {
    const official = 73 + k; // official FIFA match number
    fixtures.push({
      id: `f${official}`,
      apiMatchId: official, // ascending apiMatchId == official match order
      homeTeam: `h${official}`,
      awayTeam: `a${official}`,
      date: `2026-06-28T${String(k % 24).padStart(2, '0')}:00:00Z`,
      stage: 'Round of 32',
      status: 'scheduled',
    });
  }
  return fixtures;
}

describe('bracketService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('determineWinner', () => {
    it('returns the higher-scoring team', () => {
      expect(determineWinner({ homeTeam: 'a', awayTeam: 'b', homeScore: 2, awayScore: 1 })).toBe('a');
      expect(determineWinner({ homeTeam: 'a', awayTeam: 'b', homeScore: 0, awayScore: 3 })).toBe('b');
    });

    it('uses the shootout winner on a draw', () => {
      expect(determineWinner({
        homeTeam: 'a', awayTeam: 'b', homeScore: 1, awayScore: 1,
        penaltyShootout: { winner: 'b' },
      })).toBe('b');
    });
  });

  describe('round ordering (bracket depth-first slots)', () => {
    it('places a full Round of 32 into official bracket order, not apiMatchId order', async () => {
      mockData({ fixtures: buildRoundOf32Fixtures() });

      const { rounds } = await getBracketData();
      const r32 = rounds.find((r) => r.name === 'Round of 32');

      // Expected official match number at each rendered slot (depth-first order).
      const expectedOrder = [74, 77, 73, 75, 83, 84, 81, 82, 76, 78, 79, 80, 86, 88, 85, 87];
      const actualOrder = r32.fixtures.map((f) => Number(f.homeTeam.slice(1)));

      expect(actualOrder).toEqual(expectedOrder);
    });

    it('falls back to chronological order when fixtures lack an apiMatchId', async () => {
      // Two manually-entered Round of 16 fixtures, no apiMatchId, out of date order.
      const fixtures = [
        { id: 'fb', homeTeam: 'hb', awayTeam: 'ab', date: '2026-07-05T18:00:00Z', stage: 'Round of 16', status: 'scheduled' },
        { id: 'fa', homeTeam: 'ha', awayTeam: 'aa', date: '2026-07-04T18:00:00Z', stage: 'Round of 16', status: 'scheduled' },
      ];
      mockData({ fixtures });

      const { rounds } = await getBracketData();
      const r16 = rounds.find((r) => r.name === 'Round of 16');

      // Earlier date first (chronological fallback)
      expect(r16.fixtures[0].fixtureId).toBe('fa');
      expect(r16.fixtures[1].fixtureId).toBe('fb');
    });
  });

  describe('live results', () => {
    it('does not mark a winner or advance a team for an in-progress match', async () => {
      const fixtures = buildRoundOf32Fixtures();
      // A live result for the first official match (apiMatchId 73 -> rendered slot index 2)
      const results = [
        { id: 'r1', fixtureId: 'f73', homeTeam: 'h73', awayTeam: 'a73', homeScore: 1, awayScore: 0, stage: 'Round of 32', status: 'live' },
      ];
      mockData({ fixtures, results });

      const { rounds } = await getBracketData();
      const r32 = rounds.find((r) => r.name === 'Round of 32');
      const liveFixture = r32.fixtures.find((f) => f.fixtureId === 'f73');

      // Live result is ignored: no score, no winner.
      expect(liveFixture.homeScore).toBeUndefined();
      expect(liveFixture.winner).toBeUndefined();

      // And no team has been propagated into the Round of 16.
      const r16 = rounds.find((r) => r.name === 'Round of 16');
      const advanced = r16.fixtures.some((f) => f.homeTeam === 'h73' || f.awayTeam === 'h73');
      expect(advanced).toBe(false);
    });

    it('marks a winner and advances the team for a completed match', async () => {
      const fixtures = buildRoundOf32Fixtures();
      const results = [
        { id: 'r1', fixtureId: 'f73', homeTeam: 'h73', awayTeam: 'a73', homeScore: 2, awayScore: 0, stage: 'Round of 32', status: 'completed' },
      ];
      mockData({ fixtures, results });

      const { rounds } = await getBracketData();
      const r32 = rounds.find((r) => r.name === 'Round of 32');
      const fixture = r32.fixtures.find((f) => f.fixtureId === 'f73');

      expect(fixture.winner).toBe('h73');

      // Match 73 is at depth-first slot index 2, so its winner feeds R16 slot 1.
      const r16 = rounds.find((r) => r.name === 'Round of 16');
      const advanced = r16.fixtures.some((f) => f.homeTeam === 'h73' || f.awayTeam === 'h73');
      expect(advanced).toBe(true);
    });
  });
});
