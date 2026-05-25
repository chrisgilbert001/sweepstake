import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFile, readFile } from './storageService.js';
import { calculatePoints, rankParticipants, getLeagueStandings } from './pointsService.js';
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
async function createTestLeague(slug, participants, allocations) {
  const league = {
    slug,
    name: slug,
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

describe('pointsService', () => {
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

  describe('calculatePoints', () => {
    it('returns zero stats when participant has no allocations', async () => {
      await createTestLeague('test-league', [{ id: 'p1', name: 'Alice' }], {});

      const stats = await calculatePoints('p1', 'test-league');

      expect(stats).toEqual({
        points: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goalsScored: 0,
        goalsConceded: 0,
        goalDifference: 0
      });
    });

    it('returns zero stats when no results exist', async () => {
      await createTestLeague('test-league',
        [{ id: 'p1', name: 'Alice' }],
        { p1: { pot1: ['usa', 'ger'], pot2: ['mex', 'jpn'], pot3: ['crc', 'nzl'], pot4: ['ind', 'chn'] } }
      );

      const stats = await calculatePoints('p1', 'test-league');

      expect(stats).toEqual({
        points: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goalsScored: 0,
        goalsConceded: 0,
        goalDifference: 0
      });
    });

    it('awards 3 points for a win when participant team is home', async () => {
      await createTestLeague('test-league',
        [{ id: 'p1', name: 'Alice' }],
        { p1: { pot1: ['usa', 'ger'], pot2: [], pot3: [], pot4: [] } }
      );
      await writeFile(RESULTS_FILE, {
        results: [{
          id: 'r001', fixtureId: 'f001', homeTeam: 'usa', awayTeam: 'bra',
          homeScore: 2, awayScore: 1, date: '2026-06-11T18:00:00Z', stage: 'Group Stage', penaltyShootout: null
        }]
      });

      const stats = await calculatePoints('p1', 'test-league');

      expect(stats.points).toBe(3);
      expect(stats.wins).toBe(1);
      expect(stats.draws).toBe(0);
      expect(stats.losses).toBe(0);
      expect(stats.goalsScored).toBe(2);
      expect(stats.goalsConceded).toBe(1);
      expect(stats.goalDifference).toBe(1);
    });

    it('awards 3 points for a win when participant team is away', async () => {
      await createTestLeague('test-league',
        [{ id: 'p1', name: 'Alice' }],
        { p1: { pot1: ['usa', 'ger'], pot2: [], pot3: [], pot4: [] } }
      );
      await writeFile(RESULTS_FILE, {
        results: [{
          id: 'r001', fixtureId: 'f001', homeTeam: 'bra', awayTeam: 'usa',
          homeScore: 0, awayScore: 3, date: '2026-06-11T18:00:00Z', stage: 'Group Stage', penaltyShootout: null
        }]
      });

      const stats = await calculatePoints('p1', 'test-league');

      expect(stats.points).toBe(3);
      expect(stats.wins).toBe(1);
      expect(stats.goalsScored).toBe(3);
      expect(stats.goalsConceded).toBe(0);
      expect(stats.goalDifference).toBe(3);
    });

    it('awards 1 point for a draw', async () => {
      await createTestLeague('test-league',
        [{ id: 'p1', name: 'Alice' }],
        { p1: { pot1: ['usa'], pot2: [], pot3: [], pot4: [] } }
      );
      await writeFile(RESULTS_FILE, {
        results: [{
          id: 'r001', fixtureId: 'f001', homeTeam: 'usa', awayTeam: 'bra',
          homeScore: 1, awayScore: 1, date: '2026-06-11T18:00:00Z', stage: 'Group Stage', penaltyShootout: null
        }]
      });

      const stats = await calculatePoints('p1', 'test-league');

      expect(stats.points).toBe(1);
      expect(stats.draws).toBe(1);
      expect(stats.wins).toBe(0);
      expect(stats.losses).toBe(0);
    });

    it('awards 0 points for a loss', async () => {
      await createTestLeague('test-league',
        [{ id: 'p1', name: 'Alice' }],
        { p1: { pot1: ['usa'], pot2: [], pot3: [], pot4: [] } }
      );
      await writeFile(RESULTS_FILE, {
        results: [{
          id: 'r001', fixtureId: 'f001', homeTeam: 'usa', awayTeam: 'bra',
          homeScore: 0, awayScore: 2, date: '2026-06-11T18:00:00Z', stage: 'Group Stage', penaltyShootout: null
        }]
      });

      const stats = await calculatePoints('p1', 'test-league');

      expect(stats.points).toBe(0);
      expect(stats.losses).toBe(1);
      expect(stats.goalsScored).toBe(0);
      expect(stats.goalsConceded).toBe(2);
      expect(stats.goalDifference).toBe(-2);
    });

    it('awards +1 additional point for penalty shootout winner (2 total)', async () => {
      await createTestLeague('test-league',
        [{ id: 'p1', name: 'Alice' }],
        { p1: { pot1: ['usa'], pot2: [], pot3: [], pot4: [] } }
      );
      await writeFile(RESULTS_FILE, {
        results: [{
          id: 'r001', fixtureId: 'f001', homeTeam: 'usa', awayTeam: 'bra',
          homeScore: 1, awayScore: 1, date: '2026-07-10T20:00:00Z', stage: 'Round of 16',
          penaltyShootout: { winner: 'usa', homeGoals: 4, awayGoals: 2 }
        }]
      });

      const stats = await calculatePoints('p1', 'test-league');

      // Draw = 1pt + shootout winner = 1pt = 2 total
      expect(stats.points).toBe(2);
      expect(stats.draws).toBe(1);
      expect(stats.wins).toBe(0);
    });

    it('does not award shootout bonus to the loser', async () => {
      await createTestLeague('test-league',
        [{ id: 'p1', name: 'Alice' }],
        { p1: { pot1: ['bra'], pot2: [], pot3: [], pot4: [] } }
      );
      await writeFile(RESULTS_FILE, {
        results: [{
          id: 'r001', fixtureId: 'f001', homeTeam: 'usa', awayTeam: 'bra',
          homeScore: 1, awayScore: 1, date: '2026-07-10T20:00:00Z', stage: 'Round of 16',
          penaltyShootout: { winner: 'usa', homeGoals: 4, awayGoals: 2 }
        }]
      });

      const stats = await calculatePoints('p1', 'test-league');

      // Draw = 1pt, no shootout bonus for loser
      expect(stats.points).toBe(1);
      expect(stats.draws).toBe(1);
    });

    it('accumulates points across multiple matches for multiple teams', async () => {
      await createTestLeague('test-league',
        [{ id: 'p1', name: 'Alice' }],
        { p1: { pot1: ['usa', 'ger'], pot2: [], pot3: [], pot4: [] } }
      );
      await writeFile(RESULTS_FILE, {
        results: [
          {
            id: 'r001', fixtureId: 'f001', homeTeam: 'usa', awayTeam: 'bra',
            homeScore: 2, awayScore: 0, date: '2026-06-11T18:00:00Z', stage: 'Group Stage', penaltyShootout: null
          },
          {
            id: 'r002', fixtureId: 'f002', homeTeam: 'ger', awayTeam: 'arg',
            homeScore: 1, awayScore: 1, date: '2026-06-12T18:00:00Z', stage: 'Group Stage', penaltyShootout: null
          },
          {
            id: 'r003', fixtureId: 'f003', homeTeam: 'fra', awayTeam: 'usa',
            homeScore: 3, awayScore: 1, date: '2026-06-13T18:00:00Z', stage: 'Group Stage', penaltyShootout: null
          }
        ]
      });

      const stats = await calculatePoints('p1', 'test-league');

      // usa win (3) + ger draw (1) + usa loss (0) = 4
      expect(stats.points).toBe(4);
      expect(stats.wins).toBe(1);
      expect(stats.draws).toBe(1);
      expect(stats.losses).toBe(1);
      // usa scored 2+1=3, conceded 0+3=3; ger scored 1, conceded 1
      expect(stats.goalsScored).toBe(4);
      expect(stats.goalsConceded).toBe(4);
      expect(stats.goalDifference).toBe(0);
    });

    it('ignores results for teams not owned by the participant', async () => {
      await createTestLeague('test-league',
        [{ id: 'p1', name: 'Alice' }],
        { p1: { pot1: ['usa'], pot2: [], pot3: [], pot4: [] } }
      );
      await writeFile(RESULTS_FILE, {
        results: [{
          id: 'r001', fixtureId: 'f001', homeTeam: 'bra', awayTeam: 'arg',
          homeScore: 2, awayScore: 1, date: '2026-06-11T18:00:00Z', stage: 'Group Stage', penaltyShootout: null
        }]
      });

      const stats = await calculatePoints('p1', 'test-league');

      expect(stats.points).toBe(0);
      expect(stats.wins).toBe(0);
      expect(stats.goalsScored).toBe(0);
    });

    it('handles penalty shootout bonus for away team winner', async () => {
      await createTestLeague('test-league',
        [{ id: 'p1', name: 'Alice' }],
        { p1: { pot1: ['bra'], pot2: [], pot3: [], pot4: [] } }
      );
      await writeFile(RESULTS_FILE, {
        results: [{
          id: 'r001', fixtureId: 'f001', homeTeam: 'usa', awayTeam: 'bra',
          homeScore: 2, awayScore: 2, date: '2026-07-10T20:00:00Z', stage: 'Semi-final',
          penaltyShootout: { winner: 'bra', homeGoals: 3, awayGoals: 5 }
        }]
      });

      const stats = await calculatePoints('p1', 'test-league');

      // Draw (1) + shootout winner bonus (1) = 2
      expect(stats.points).toBe(2);
      expect(stats.draws).toBe(1);
      expect(stats.goalsScored).toBe(2);
      expect(stats.goalsConceded).toBe(2);
    });
  });

  describe('rankParticipants', () => {
    it('ranks by points descending', () => {
      const standings = [
        { participantId: 'p1', participantName: 'Alice', points: 5, wins: 1, goalDifference: 2 },
        { participantId: 'p2', participantName: 'Bob', points: 10, wins: 3, goalDifference: 5 },
        { participantId: 'p3', participantName: 'Charlie', points: 7, wins: 2, goalDifference: 3 }
      ];

      const ranked = rankParticipants(standings);

      expect(ranked[0].participantName).toBe('Bob');
      expect(ranked[0].rank).toBe(1);
      expect(ranked[1].participantName).toBe('Charlie');
      expect(ranked[1].rank).toBe(2);
      expect(ranked[2].participantName).toBe('Alice');
      expect(ranked[2].rank).toBe(3);
    });

    it('uses wins as first tiebreaker when points are equal', () => {
      const standings = [
        { participantId: 'p1', participantName: 'Alice', points: 7, wins: 2, goalDifference: 3 },
        { participantId: 'p2', participantName: 'Bob', points: 7, wins: 1, goalDifference: 5 },
        { participantId: 'p3', participantName: 'Charlie', points: 7, wins: 3, goalDifference: 1 }
      ];

      const ranked = rankParticipants(standings);

      expect(ranked[0].participantName).toBe('Charlie');
      expect(ranked[0].rank).toBe(1);
      expect(ranked[1].participantName).toBe('Alice');
      expect(ranked[1].rank).toBe(2);
      expect(ranked[2].participantName).toBe('Bob');
      expect(ranked[2].rank).toBe(3);
    });

    it('uses goal difference as second tiebreaker when points and wins are equal', () => {
      const standings = [
        { participantId: 'p1', participantName: 'Alice', points: 7, wins: 2, goalDifference: 1 },
        { participantId: 'p2', participantName: 'Bob', points: 7, wins: 2, goalDifference: 5 },
        { participantId: 'p3', participantName: 'Charlie', points: 7, wins: 2, goalDifference: 3 }
      ];

      const ranked = rankParticipants(standings);

      expect(ranked[0].participantName).toBe('Bob');
      expect(ranked[0].rank).toBe(1);
      expect(ranked[1].participantName).toBe('Charlie');
      expect(ranked[1].rank).toBe(2);
      expect(ranked[2].participantName).toBe('Alice');
      expect(ranked[2].rank).toBe(3);
    });

    it('assigns shared rank when all tiebreakers are equal', () => {
      const standings = [
        { participantId: 'p1', participantName: 'Alice', points: 7, wins: 2, goalDifference: 3 },
        { participantId: 'p2', participantName: 'Bob', points: 7, wins: 2, goalDifference: 3 },
        { participantId: 'p3', participantName: 'Charlie', points: 5, wins: 1, goalDifference: 1 }
      ];

      const ranked = rankParticipants(standings);

      expect(ranked[0].rank).toBe(1);
      expect(ranked[1].rank).toBe(1);
      expect(ranked[2].rank).toBe(3); // Skips rank 2
    });

    it('skips positions correctly with multiple ties', () => {
      const standings = [
        { participantId: 'p1', participantName: 'Alice', points: 7, wins: 2, goalDifference: 3 },
        { participantId: 'p2', participantName: 'Bob', points: 7, wins: 2, goalDifference: 3 },
        { participantId: 'p3', participantName: 'Charlie', points: 7, wins: 2, goalDifference: 3 },
        { participantId: 'p4', participantName: 'Dave', points: 5, wins: 1, goalDifference: 1 }
      ];

      const ranked = rankParticipants(standings);

      expect(ranked[0].rank).toBe(1);
      expect(ranked[1].rank).toBe(1);
      expect(ranked[2].rank).toBe(1);
      expect(ranked[3].rank).toBe(4); // Skips ranks 2 and 3
    });

    it('handles all participants tied at same rank', () => {
      const standings = [
        { participantId: 'p1', participantName: 'Alice', points: 0, wins: 0, goalDifference: 0 },
        { participantId: 'p2', participantName: 'Bob', points: 0, wins: 0, goalDifference: 0 },
        { participantId: 'p3', participantName: 'Charlie', points: 0, wins: 0, goalDifference: 0 }
      ];

      const ranked = rankParticipants(standings);

      expect(ranked[0].rank).toBe(1);
      expect(ranked[1].rank).toBe(1);
      expect(ranked[2].rank).toBe(1);
    });

    it('handles a single participant', () => {
      const standings = [
        { participantId: 'p1', participantName: 'Alice', points: 10, wins: 3, goalDifference: 5 }
      ];

      const ranked = rankParticipants(standings);

      expect(ranked[0].rank).toBe(1);
    });

    it('handles empty standings array', () => {
      const ranked = rankParticipants([]);
      expect(ranked).toEqual([]);
    });

    it('handles negative goal difference correctly', () => {
      const standings = [
        { participantId: 'p1', participantName: 'Alice', points: 3, wins: 1, goalDifference: -2 },
        { participantId: 'p2', participantName: 'Bob', points: 3, wins: 1, goalDifference: -5 }
      ];

      const ranked = rankParticipants(standings);

      expect(ranked[0].participantName).toBe('Alice');
      expect(ranked[0].rank).toBe(1);
      expect(ranked[1].participantName).toBe('Bob');
      expect(ranked[1].rank).toBe(2);
    });
  });

  describe('getLeagueStandings', () => {
    it('returns empty array when league has no participants', async () => {
      await createTestLeague('empty-league', [], {});

      const standings = await getLeagueStandings('empty-league');

      expect(standings).toEqual([]);
    });

    it('returns all participants at rank 1 with zero stats when no results exist', async () => {
      await createTestLeague('test-league',
        [
          { id: 'p1', name: 'Alice' },
          { id: 'p2', name: 'Bob' },
          { id: 'p3', name: 'Charlie' }
        ],
        {
          p1: { pot1: ['usa', 'ger'], pot2: ['mex', 'jpn'], pot3: ['crc', 'nzl'], pot4: ['ind', 'chn'] },
          p2: { pot1: ['bra', 'arg'], pot2: ['col', 'uru'], pot3: ['per', 'ecu'], pot4: ['bol', 'ven'] },
          p3: { pot1: ['fra', 'esp'], pot2: ['eng', 'ned'], pot3: ['bel', 'por'], pot4: ['den', 'sui'] }
        }
      );

      const standings = await getLeagueStandings('test-league');

      expect(standings).toHaveLength(3);
      for (const s of standings) {
        expect(s.rank).toBe(1);
        expect(s.points).toBe(0);
        expect(s.wins).toBe(0);
        expect(s.draws).toBe(0);
        expect(s.losses).toBe(0);
        expect(s.goalsScored).toBe(0);
        expect(s.goalsConceded).toBe(0);
        expect(s.goalDifference).toBe(0);
      }
    });

    it('calculates and ranks standings correctly with match results', async () => {
      await createTestLeague('test-league',
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

      const standings = await getLeagueStandings('test-league');

      expect(standings).toHaveLength(2);
      // Alice (usa won) should be rank 1
      expect(standings[0].participantName).toBe('Alice');
      expect(standings[0].rank).toBe(1);
      expect(standings[0].points).toBe(3);
      expect(standings[0].wins).toBe(1);
      expect(standings[0].goalsScored).toBe(2);
      expect(standings[0].goalsConceded).toBe(1);
      // Bob (bra lost) should be rank 2
      expect(standings[1].participantName).toBe('Bob');
      expect(standings[1].rank).toBe(2);
      expect(standings[1].points).toBe(0);
      expect(standings[1].losses).toBe(1);
    });

    it('includes participantId and participantName in standings', async () => {
      await createTestLeague('test-league',
        [{ id: 'p1', name: 'Alice' }],
        { p1: { pot1: ['usa'], pot2: [], pot3: [], pot4: [] } }
      );

      const standings = await getLeagueStandings('test-league');

      expect(standings[0].participantId).toBe('p1');
      expect(standings[0].participantName).toBe('Alice');
    });

    it('handles penalty shootout points in standings', async () => {
      await createTestLeague('test-league',
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
          homeScore: 1, awayScore: 1, date: '2026-07-10T20:00:00Z', stage: 'Round of 16',
          penaltyShootout: { winner: 'usa', homeGoals: 4, awayGoals: 2 }
        }]
      });

      const standings = await getLeagueStandings('test-league');

      // Alice: draw (1) + shootout bonus (1) = 2
      expect(standings[0].participantName).toBe('Alice');
      expect(standings[0].points).toBe(2);
      // Bob: draw (1) = 1
      expect(standings[1].participantName).toBe('Bob');
      expect(standings[1].points).toBe(1);
    });

    it('throws 404 for non-existent league', async () => {
      await expect(getLeagueStandings('nonexistent'))
        .rejects.toMatchObject({ statusCode: 404 });
    });
  });
});
