import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies
vi.mock('../apiClient.js');
vi.mock('../teamMapper.js');
vi.mock('../statusMapper.js');
vi.mock('../../storageService.js');
vi.mock('../../tournamentService.js');

import { executeSyncCycle } from '../syncService.js';
import { fetchFromApi } from '../apiClient.js';
import { mapTeamId } from '../teamMapper.js';
import { mapMatchStatus } from '../statusMapper.js';
import { readFile, writeFile, atomicWriteFile } from '../../storageService.js';
import { checkTournamentComplete } from '../../tournamentService.js';

describe('syncService - fixture sync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: storageService returns empty fixtures and results
    readFile.mockResolvedValue({ fixtures: [], results: [] });
    writeFile.mockResolvedValue(undefined);
    atomicWriteFile.mockResolvedValue(undefined);
    checkTournamentComplete.mockResolvedValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns success with stats when sync completes', async () => {
    fetchFromApi.mockResolvedValue({ matches: [] });

    const result = await executeSyncCycle();

    expect(result.outcome).toBe('success');
    expect(result.error).toBeNull();
    expect(result.stats.fixtures).toBe(0);
    expect(result.timestamp).toBeDefined();
  });

  it('fetches matches from /v4/competitions/WC/matches', async () => {
    fetchFromApi.mockResolvedValue({ matches: [] });

    await executeSyncCycle();

    expect(fetchFromApi).toHaveBeenCalledWith('/v4/competitions/WC/matches');
  });

  it('creates new fixtures for unmatched API matches with valid team mappings', async () => {
    fetchFromApi.mockResolvedValue({
      matches: [
        {
          id: 12345,
          utcDate: '2026-06-15T18:00:00Z',
          status: 'SCHEDULED',
          stage: 'GROUP_STAGE',
          group: 'GROUP_A',
          homeTeam: { id: 760, name: 'Spain' },
          awayTeam: { id: 762, name: 'Argentina' },
        },
      ],
    });

    mapTeamId.mockImplementation((id) => {
      if (id === 760) return 'esp';
      if (id === 762) return 'arg';
      return null;
    });

    mapMatchStatus.mockReturnValue({ status: 'scheduled', known: true });

    const result = await executeSyncCycle();

    expect(result.outcome).toBe('success');
    expect(result.stats.fixtures).toBe(1);
    expect(writeFile).toHaveBeenCalledWith('fixtures.json', {
      fixtures: [
        expect.objectContaining({
          apiMatchId: 12345,
          homeTeam: 'esp',
          awayTeam: 'arg',
          date: '2026-06-15T18:00:00Z',
          stage: 'Group Stage',
          status: 'scheduled',
        }),
      ],
    });
  });

  it('updates existing fixtures matched by apiMatchId', async () => {
    readFile.mockResolvedValue({
      fixtures: [
        {
          id: 'f001',
          apiMatchId: 12345,
          homeTeam: 'esp',
          awayTeam: 'arg',
          date: '2026-06-15T18:00:00Z',
          stage: 'Group Stage',
          status: 'scheduled',
        },
      ],
    });

    fetchFromApi.mockResolvedValue({
      matches: [
        {
          id: 12345,
          utcDate: '2026-06-16T20:00:00Z',
          status: 'LIVE',
          stage: 'GROUP_STAGE',
          group: 'GROUP_A',
          homeTeam: { id: 760, name: 'Spain' },
          awayTeam: { id: 762, name: 'Argentina' },
        },
      ],
    });

    mapTeamId.mockImplementation((id) => {
      if (id === 760) return 'esp';
      if (id === 762) return 'arg';
      return null;
    });

    mapMatchStatus.mockReturnValue({ status: 'in_progress', known: true });

    const result = await executeSyncCycle();

    expect(result.outcome).toBe('success');
    expect(result.stats.fixtures).toBe(1);
    expect(writeFile).toHaveBeenCalledWith('fixtures.json', {
      fixtures: [
        expect.objectContaining({
          id: 'f001',
          apiMatchId: 12345,
          homeTeam: 'esp',
          awayTeam: 'arg',
          date: '2026-06-16T20:00:00Z',
          status: 'in_progress',
        }),
      ],
    });
  });

  it('skips matches with unmapped teams and logs warning', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    fetchFromApi.mockResolvedValue({
      matches: [
        {
          id: 99999,
          utcDate: '2026-06-15T18:00:00Z',
          status: 'SCHEDULED',
          stage: 'GROUP_STAGE',
          group: 'GROUP_A',
          homeTeam: { id: 9999, name: 'Unknown Team' },
          awayTeam: { id: 762, name: 'Argentina' },
        },
      ],
    });

    mapTeamId.mockImplementation((id) => {
      if (id === 762) return 'arg';
      return null;
    });

    const result = await executeSyncCycle();

    expect(result.outcome).toBe('success');
    expect(result.stats.fixtures).toBe(0);
    expect(writeFile).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('unmapped team')
    );

    warnSpy.mockRestore();
  });

  it('retains current fixture status for unknown API status', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    readFile.mockResolvedValue({
      fixtures: [
        {
          id: 'f001',
          apiMatchId: 12345,
          homeTeam: 'esp',
          awayTeam: 'arg',
          date: '2026-06-15T18:00:00Z',
          stage: 'Group Stage',
          status: 'scheduled',
        },
      ],
    });

    fetchFromApi.mockResolvedValue({
      matches: [
        {
          id: 12345,
          utcDate: '2026-06-15T18:00:00Z',
          status: 'SOME_UNKNOWN_STATUS',
          stage: 'GROUP_STAGE',
          group: 'GROUP_A',
          homeTeam: { id: 760, name: 'Spain' },
          awayTeam: { id: 762, name: 'Argentina' },
        },
      ],
    });

    mapTeamId.mockImplementation((id) => {
      if (id === 760) return 'esp';
      if (id === 762) return 'arg';
      return null;
    });

    mapMatchStatus.mockReturnValue({ status: null, known: false });

    const result = await executeSyncCycle();

    expect(result.outcome).toBe('success');
    // No changes since status is unknown and date hasn't changed
    expect(result.stats.fixtures).toBe(0);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Unknown status')
    );

    warnSpy.mockRestore();
  });

  it('never removes fixtures that have no corresponding API match', async () => {
    readFile.mockResolvedValue({
      fixtures: [
        {
          id: 'f001',
          apiMatchId: 11111,
          homeTeam: 'bra',
          awayTeam: 'ger',
          date: '2026-06-10T15:00:00Z',
          stage: 'Group Stage',
          status: 'completed',
        },
        {
          id: 'f002',
          homeTeam: 'fra',
          awayTeam: 'eng',
          date: '2026-06-12T18:00:00Z',
          stage: 'Group Stage',
          status: 'scheduled',
        },
      ],
    });

    fetchFromApi.mockResolvedValue({
      matches: [
        {
          id: 22222,
          utcDate: '2026-06-20T20:00:00Z',
          status: 'SCHEDULED',
          stage: 'GROUP_STAGE',
          group: 'GROUP_B',
          homeTeam: { id: 765, name: 'Portugal' },
          awayTeam: { id: 805, name: 'Belgium' },
        },
      ],
    });

    mapTeamId.mockImplementation((id) => {
      if (id === 765) return 'por';
      if (id === 805) return 'bel';
      return null;
    });

    mapMatchStatus.mockReturnValue({ status: 'scheduled', known: true });

    const result = await executeSyncCycle();

    expect(result.outcome).toBe('success');
    expect(result.stats.fixtures).toBe(1);

    const writtenData = writeFile.mock.calls[0][1];
    expect(writtenData.fixtures).toHaveLength(3);
    // Original fixtures preserved
    expect(writtenData.fixtures[0]).toEqual(expect.objectContaining({ id: 'f001', apiMatchId: 11111 }));
    expect(writtenData.fixtures[1]).toEqual(expect.objectContaining({ id: 'f002', homeTeam: 'fra' }));
    // New fixture added
    expect(writtenData.fixtures[2]).toEqual(expect.objectContaining({ apiMatchId: 22222, homeTeam: 'por', awayTeam: 'bel' }));
  });

  it('returns failure when API fetch throws an error', async () => {
    fetchFromApi.mockRejectedValue(new Error('Network error: connection refused'));

    const result = await executeSyncCycle();

    expect(result.outcome).toBe('failure');
    expect(result.error).toContain('Network error');
    expect(result.stats.fixtures).toBe(0);
    expect(writeFile).not.toHaveBeenCalled();
  });

  it('does not write fixtures.json when there are no changes', async () => {
    readFile.mockResolvedValue({
      fixtures: [
        {
          id: 'f001',
          apiMatchId: 12345,
          homeTeam: 'esp',
          awayTeam: 'arg',
          date: '2026-06-15T18:00:00Z',
          stage: 'Group Stage',
          status: 'scheduled',
        },
      ],
    });

    fetchFromApi.mockResolvedValue({
      matches: [
        {
          id: 12345,
          utcDate: '2026-06-15T18:00:00Z',
          status: 'SCHEDULED',
          stage: 'GROUP_STAGE',
          group: 'GROUP_A',
          homeTeam: { id: 760, name: 'Spain' },
          awayTeam: { id: 762, name: 'Argentina' },
        },
      ],
    });

    mapTeamId.mockImplementation((id) => {
      if (id === 760) return 'esp';
      if (id === 762) return 'arg';
      return null;
    });

    mapMatchStatus.mockReturnValue({ status: 'scheduled', known: true });

    const result = await executeSyncCycle();

    expect(result.outcome).toBe('success');
    expect(result.stats.fixtures).toBe(0);
    expect(writeFile).not.toHaveBeenCalled();
  });

  it('handles empty matches array from API', async () => {
    readFile.mockResolvedValue({
      fixtures: [
        {
          id: 'f001',
          apiMatchId: 12345,
          homeTeam: 'esp',
          awayTeam: 'arg',
          date: '2026-06-15T18:00:00Z',
          stage: 'Group Stage',
          status: 'scheduled',
        },
      ],
    });

    fetchFromApi.mockResolvedValue({ matches: [] });

    const result = await executeSyncCycle();

    expect(result.outcome).toBe('success');
    expect(result.stats.fixtures).toBe(0);
    expect(writeFile).not.toHaveBeenCalled();
  });

  it('skips new match creation when status is unknown', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    fetchFromApi.mockResolvedValue({
      matches: [
        {
          id: 55555,
          utcDate: '2026-06-15T18:00:00Z',
          status: 'WEIRD_STATUS',
          stage: 'GROUP_STAGE',
          group: 'GROUP_A',
          homeTeam: { id: 760, name: 'Spain' },
          awayTeam: { id: 762, name: 'Argentina' },
        },
      ],
    });

    mapTeamId.mockImplementation((id) => {
      if (id === 760) return 'esp';
      if (id === 762) return 'arg';
      return null;
    });

    mapMatchStatus.mockReturnValue({ status: null, known: false });

    const result = await executeSyncCycle();

    expect(result.outcome).toBe('success');
    expect(result.stats.fixtures).toBe(0);
    expect(writeFile).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Unknown status')
    );

    warnSpy.mockRestore();
  });

  it('generates unique fixture IDs for new fixtures', async () => {
    readFile.mockResolvedValue({
      fixtures: [
        { id: 'f001', apiMatchId: 11111, homeTeam: 'esp', awayTeam: 'arg', date: '2026-06-10T15:00:00Z', stage: 'Group Stage', status: 'scheduled' },
        { id: 'f005', apiMatchId: 22222, homeTeam: 'bra', awayTeam: 'ger', date: '2026-06-11T15:00:00Z', stage: 'Group Stage', status: 'scheduled' },
      ],
    });

    fetchFromApi.mockResolvedValue({
      matches: [
        {
          id: 33333,
          utcDate: '2026-06-20T20:00:00Z',
          status: 'SCHEDULED',
          stage: 'GROUP_STAGE',
          group: 'GROUP_C',
          homeTeam: { id: 773, name: 'France' },
          awayTeam: { id: 66, name: 'England' },
        },
        {
          id: 44444,
          utcDate: '2026-06-21T20:00:00Z',
          status: 'SCHEDULED',
          stage: 'GROUP_STAGE',
          group: 'GROUP_D',
          homeTeam: { id: 765, name: 'Portugal' },
          awayTeam: { id: 805, name: 'Belgium' },
        },
      ],
    });

    mapTeamId.mockImplementation((id) => {
      const map = { 773: 'fra', 66: 'eng', 765: 'por', 805: 'bel' };
      return map[id] || null;
    });

    mapMatchStatus.mockReturnValue({ status: 'scheduled', known: true });

    const result = await executeSyncCycle();

    expect(result.outcome).toBe('success');
    expect(result.stats.fixtures).toBe(2);

    const writtenData = writeFile.mock.calls[0][1];
    const newFixtures = writtenData.fixtures.filter(f => f.apiMatchId === 33333 || f.apiMatchId === 44444);
    expect(newFixtures[0].id).toBe('f006');
    expect(newFixtures[1].id).toBe('f007');
  });
});

describe('syncService - sync status persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    readFile.mockResolvedValue({ fixtures: [], results: [] });
    writeFile.mockResolvedValue(undefined);
    atomicWriteFile.mockResolvedValue(undefined);
    checkTournamentComplete.mockResolvedValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('writes sync status with success outcome after successful sync', async () => {
    fetchFromApi.mockResolvedValue({ matches: [] });

    await executeSyncCycle();

    expect(atomicWriteFile).toHaveBeenCalledWith('sync-status.json', {
      lastSync: {
        timestamp: expect.any(String),
        outcome: 'success',
        error: null,
        stats: {
          fixturesUpdated: 0,
          resultsCreated: 0,
          liveUpdated: 0,
          standingsUpdated: false,
        },
      },
    });
  });

  it('writes sync status with failure outcome after failed sync', async () => {
    fetchFromApi.mockRejectedValue(new Error('API unavailable'));

    await executeSyncCycle();

    expect(atomicWriteFile).toHaveBeenCalledWith('sync-status.json', {
      lastSync: {
        timestamp: expect.any(String),
        outcome: 'failure',
        error: 'API unavailable',
        stats: {
          fixturesUpdated: 0,
          resultsCreated: 0,
          liveUpdated: 0,
          standingsUpdated: false,
        },
      },
    });
  });

  it('includes ISO 8601 UTC timestamp in sync status', async () => {
    fetchFromApi.mockResolvedValue({ matches: [] });

    await executeSyncCycle();

    const statusData = atomicWriteFile.mock.calls[0][1];
    // Verify it's a valid ISO 8601 timestamp
    const parsed = new Date(statusData.lastSync.timestamp);
    expect(parsed.toISOString()).toBe(statusData.lastSync.timestamp);
  });

  it('includes correct stats in sync status after fixtures are updated', async () => {
    fetchFromApi.mockResolvedValue({
      matches: [
        {
          id: 12345,
          utcDate: '2026-06-15T18:00:00Z',
          status: 'SCHEDULED',
          stage: 'GROUP_STAGE',
          group: 'GROUP_A',
          homeTeam: { id: 760, name: 'Spain' },
          awayTeam: { id: 762, name: 'Argentina' },
        },
      ],
    });

    mapTeamId.mockImplementation((id) => {
      if (id === 760) return 'esp';
      if (id === 762) return 'arg';
      return null;
    });

    mapMatchStatus.mockReturnValue({ status: 'scheduled', known: true });

    await executeSyncCycle();

    const statusData = atomicWriteFile.mock.calls[0][1];
    expect(statusData.lastSync.stats.fixturesUpdated).toBe(1);
  });

  it('uses atomicWriteFile for sync status persistence', async () => {
    fetchFromApi.mockResolvedValue({ matches: [] });

    await executeSyncCycle();

    expect(atomicWriteFile).toHaveBeenCalledTimes(1);
    expect(atomicWriteFile.mock.calls[0][0]).toBe('sync-status.json');
  });

  it('still returns result even if sync status write fails on failure path', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    fetchFromApi.mockRejectedValue(new Error('Network error'));
    atomicWriteFile.mockRejectedValue(new Error('Disk full'));

    const result = await executeSyncCycle();

    expect(result.outcome).toBe('failure');
    expect(result.error).toContain('Network error');
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Failed to write sync status')
    );

    errorSpy.mockRestore();
  });
});

describe('syncService - result sync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    writeFile.mockResolvedValue(undefined);
    atomicWriteFile.mockResolvedValue(undefined);
    checkTournamentComplete.mockResolvedValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates result entries for FINISHED matches with valid scores', async () => {
    readFile.mockResolvedValue({
      fixtures: [
        {
          id: 'f001',
          apiMatchId: 12345,
          homeTeam: 'esp',
          awayTeam: 'arg',
          date: '2026-06-15T18:00:00Z',
          stage: 'Group Stage',
          status: 'scheduled',
        },
      ],
      results: [],
    });

    fetchFromApi.mockResolvedValue({
      matches: [
        {
          id: 12345,
          utcDate: '2026-06-15T18:00:00Z',
          status: 'FINISHED',
          stage: 'GROUP_STAGE',
          group: 'GROUP_A',
          homeTeam: { id: 760, name: 'Spain' },
          awayTeam: { id: 762, name: 'Argentina' },
          score: {
            fullTime: { home: 2, away: 1 },
            penalties: { home: null, away: null },
          },
        },
      ],
    });

    mapTeamId.mockImplementation((id) => {
      if (id === 760) return 'esp';
      if (id === 762) return 'arg';
      return null;
    });

    mapMatchStatus.mockReturnValue({ status: 'completed', known: true });

    const result = await executeSyncCycle();

    expect(result.outcome).toBe('success');
    expect(result.stats.results).toBe(1);

    // Should write results.json with the new result
    expect(writeFile).toHaveBeenCalledWith('results.json', {
      results: [
        expect.objectContaining({
          fixtureId: 'f001',
          homeTeam: 'esp',
          awayTeam: 'arg',
          homeScore: 2,
          awayScore: 1,
          penaltyShootout: null,
        }),
      ],
    });
  });

  it('stores homeScore and awayScore as non-negative integers', async () => {
    readFile.mockResolvedValue({
      fixtures: [
        {
          id: 'f001',
          apiMatchId: 12345,
          homeTeam: 'bra',
          awayTeam: 'ger',
          date: '2026-06-15T18:00:00Z',
          stage: 'Group Stage',
          status: 'scheduled',
        },
      ],
      results: [],
    });

    fetchFromApi.mockResolvedValue({
      matches: [
        {
          id: 12345,
          utcDate: '2026-06-15T18:00:00Z',
          status: 'FINISHED',
          stage: 'GROUP_STAGE',
          group: 'GROUP_A',
          homeTeam: { id: 764, name: 'Brazil' },
          awayTeam: { id: 759, name: 'Germany' },
          score: {
            fullTime: { home: 0, away: 0 },
            penalties: { home: null, away: null },
          },
        },
      ],
    });

    mapTeamId.mockImplementation((id) => {
      if (id === 764) return 'bra';
      if (id === 759) return 'ger';
      return null;
    });

    mapMatchStatus.mockReturnValue({ status: 'completed', known: true });

    const result = await executeSyncCycle();

    expect(result.stats.results).toBe(1);
    const writtenResults = writeFile.mock.calls.find(c => c[0] === 'results.json')[1];
    expect(writtenResults.results[0].homeScore).toBe(0);
    expect(writtenResults.results[0].awayScore).toBe(0);
    expect(Number.isInteger(writtenResults.results[0].homeScore)).toBe(true);
    expect(Number.isInteger(writtenResults.results[0].awayScore)).toBe(true);
  });

  it('populates penaltyShootout when scores are equal and penalty data exists', async () => {
    readFile.mockResolvedValue({
      fixtures: [
        {
          id: 'f001',
          apiMatchId: 12345,
          homeTeam: 'esp',
          awayTeam: 'arg',
          date: '2026-06-15T18:00:00Z',
          stage: 'Round of 16',
          status: 'scheduled',
        },
      ],
      results: [],
    });

    fetchFromApi.mockResolvedValue({
      matches: [
        {
          id: 12345,
          utcDate: '2026-06-15T18:00:00Z',
          status: 'FINISHED',
          stage: 'ROUND_OF_16',
          homeTeam: { id: 760, name: 'Spain' },
          awayTeam: { id: 762, name: 'Argentina' },
          score: {
            fullTime: { home: 1, away: 1 },
            penalties: { home: 4, away: 3 },
          },
        },
      ],
    });

    mapTeamId.mockImplementation((id) => {
      if (id === 760) return 'esp';
      if (id === 762) return 'arg';
      return null;
    });

    mapMatchStatus.mockReturnValue({ status: 'completed', known: true });

    const result = await executeSyncCycle();

    expect(result.stats.results).toBe(1);
    const writtenResults = writeFile.mock.calls.find(c => c[0] === 'results.json')[1];
    expect(writtenResults.results[0].penaltyShootout).toEqual({
      winner: 'esp',
      homeGoals: 4,
      awayGoals: 3,
    });
  });

  it('records the level score for a PENALTY_SHOOTOUT match (fullTime folds in the kicks)', async () => {
    // Real football-data.org behaviour: a 1-1 draw won 4-3 on penalties is
    // reported with fullTime 5-4 and duration PENALTY_SHOOTOUT. The base score
    // must be recovered as 1-1 so the result counts as a draw + shootout win.
    readFile.mockResolvedValue({
      fixtures: [
        {
          id: 'f001',
          apiMatchId: 12345,
          homeTeam: 'esp',
          awayTeam: 'arg',
          date: '2026-06-15T18:00:00Z',
          stage: 'Round of 16',
          status: 'scheduled',
        },
      ],
      results: [],
    });

    fetchFromApi.mockResolvedValue({
      matches: [
        {
          id: 12345,
          utcDate: '2026-06-15T18:00:00Z',
          status: 'FINISHED',
          stage: 'ROUND_OF_16',
          homeTeam: { id: 760, name: 'Spain' },
          awayTeam: { id: 762, name: 'Argentina' },
          score: {
            winner: 'HOME_TEAM',
            duration: 'PENALTY_SHOOTOUT',
            fullTime: { home: 5, away: 4 },
            halfTime: { home: 0, away: 0 },
            regularTime: { home: 1, away: 1 },
            extraTime: { home: 0, away: 0 },
            penalties: { home: 4, away: 3 },
          },
        },
      ],
    });

    mapTeamId.mockImplementation((id) => {
      if (id === 760) return 'esp';
      if (id === 762) return 'arg';
      return null;
    });

    mapMatchStatus.mockReturnValue({ status: 'completed', known: true });

    const result = await executeSyncCycle();

    expect(result.stats.results).toBe(1);
    const writtenResults = writeFile.mock.calls.find(c => c[0] === 'results.json')[1];
    const stored = writtenResults.results[0];
    // Base score is the level score at the end of extra time, not fullTime.
    expect(stored.homeScore).toBe(1);
    expect(stored.awayScore).toBe(1);
    expect(stored.penaltyShootout).toEqual({
      winner: 'esp',
      homeGoals: 4,
      awayGoals: 3,
    });
  });

  it('recovers the level score from penalties when regularTime is absent', async () => {
    // Defensive: if the API omits regularTime/extraTime, the base score is
    // still recoverable as fullTime minus the shootout kicks.
    readFile.mockResolvedValue({
      fixtures: [
        {
          id: 'f001',
          apiMatchId: 12345,
          homeTeam: 'esp',
          awayTeam: 'arg',
          date: '2026-06-15T18:00:00Z',
          stage: 'Round of 16',
          status: 'scheduled',
        },
      ],
      results: [],
    });

    fetchFromApi.mockResolvedValue({
      matches: [
        {
          id: 12345,
          utcDate: '2026-06-15T18:00:00Z',
          status: 'FINISHED',
          stage: 'ROUND_OF_16',
          homeTeam: { id: 760, name: 'Spain' },
          awayTeam: { id: 762, name: 'Argentina' },
          score: {
            winner: 'AWAY_TEAM',
            duration: 'PENALTY_SHOOTOUT',
            fullTime: { home: 3, away: 4 },
            halfTime: { home: 1, away: 1 },
            penalties: { home: 2, away: 3 },
          },
        },
      ],
    });

    mapTeamId.mockImplementation((id) => {
      if (id === 760) return 'esp';
      if (id === 762) return 'arg';
      return null;
    });

    mapMatchStatus.mockReturnValue({ status: 'completed', known: true });

    await executeSyncCycle();

    const writtenResults = writeFile.mock.calls.find(c => c[0] === 'results.json')[1];
    const stored = writtenResults.results[0];
    expect(stored.homeScore).toBe(1);
    expect(stored.awayScore).toBe(1);
    expect(stored.penaltyShootout).toEqual({
      winner: 'arg',
      homeGoals: 2,
      awayGoals: 3,
    });
  });

  it('sets fixture status to completed only when result entry exists', async () => {
    readFile.mockResolvedValue({
      fixtures: [
        {
          id: 'f001',
          apiMatchId: 12345,
          homeTeam: 'esp',
          awayTeam: 'arg',
          date: '2026-06-15T18:00:00Z',
          stage: 'Group Stage',
          status: 'in_progress',
        },
      ],
      results: [],
    });

    fetchFromApi.mockResolvedValue({
      matches: [
        {
          id: 12345,
          utcDate: '2026-06-15T18:00:00Z',
          status: 'FINISHED',
          stage: 'GROUP_STAGE',
          group: 'GROUP_A',
          homeTeam: { id: 760, name: 'Spain' },
          awayTeam: { id: 762, name: 'Argentina' },
          score: {
            fullTime: { home: 3, away: 0 },
            penalties: { home: null, away: null },
          },
        },
      ],
    });

    mapTeamId.mockImplementation((id) => {
      if (id === 760) return 'esp';
      if (id === 762) return 'arg';
      return null;
    });

    mapMatchStatus.mockReturnValue({ status: 'completed', known: true });

    const result = await executeSyncCycle();

    expect(result.stats.results).toBe(1);

    // Fixture status should be updated to "completed" because result was created
    const fixtureWrite = writeFile.mock.calls.find(c => c[0] === 'fixtures.json');
    expect(fixtureWrite).toBeDefined();
    expect(fixtureWrite[1].fixtures[0].status).toBe('completed');
  });

  it('prevents duplicate results for same fixtureId (updates existing)', async () => {
    readFile.mockResolvedValue({
      fixtures: [
        {
          id: 'f001',
          apiMatchId: 12345,
          homeTeam: 'esp',
          awayTeam: 'arg',
          date: '2026-06-15T18:00:00Z',
          stage: 'Group Stage',
          status: 'completed',
        },
      ],
      results: [
        {
          id: 'r001',
          fixtureId: 'f001',
          homeTeam: 'esp',
          awayTeam: 'arg',
          homeScore: 1,
          awayScore: 0,
          date: '2026-06-15T18:00:00Z',
          stage: 'Group Stage',
          penaltyShootout: null,
        },
      ],
    });

    fetchFromApi.mockResolvedValue({
      matches: [
        {
          id: 12345,
          utcDate: '2026-06-15T18:00:00Z',
          status: 'FINISHED',
          stage: 'GROUP_STAGE',
          group: 'GROUP_A',
          homeTeam: { id: 760, name: 'Spain' },
          awayTeam: { id: 762, name: 'Argentina' },
          score: {
            fullTime: { home: 2, away: 1 },
            penalties: { home: null, away: null },
          },
        },
      ],
    });

    mapTeamId.mockImplementation((id) => {
      if (id === 760) return 'esp';
      if (id === 762) return 'arg';
      return null;
    });

    mapMatchStatus.mockReturnValue({ status: 'completed', known: true });

    const result = await executeSyncCycle();

    expect(result.stats.results).toBe(1);
    const writtenResults = writeFile.mock.calls.find(c => c[0] === 'results.json')[1];
    // Should still have exactly one result (updated, not duplicated)
    expect(writtenResults.results).toHaveLength(1);
    expect(writtenResults.results[0].id).toBe('r001');
    expect(writtenResults.results[0].homeScore).toBe(2);
    expect(writtenResults.results[0].awayScore).toBe(1);
  });

  it('skips finished matches that cannot be matched to a fixture', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    readFile.mockResolvedValue({
      fixtures: [
        {
          id: 'f001',
          apiMatchId: 99999,
          homeTeam: 'bra',
          awayTeam: 'ger',
          date: '2026-06-15T18:00:00Z',
          stage: 'Group Stage',
          status: 'scheduled',
        },
      ],
      results: [],
    });

    fetchFromApi.mockResolvedValue({
      matches: [
        {
          id: 12345,
          utcDate: '2026-06-15T18:00:00Z',
          status: 'FINISHED',
          stage: 'GROUP_STAGE',
          group: 'GROUP_A',
          homeTeam: { id: 760, name: 'Spain' },
          awayTeam: { id: 762, name: 'Argentina' },
          score: {
            fullTime: { home: 2, away: 1 },
            penalties: { home: null, away: null },
          },
        },
      ],
    });

    mapTeamId.mockImplementation((id) => {
      if (id === 760) return 'esp';
      if (id === 762) return 'arg';
      return null;
    });

    mapMatchStatus.mockReturnValue({ status: 'completed', known: true });

    const result = await executeSyncCycle();

    expect(result.stats.results).toBe(0);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('no matching fixture found')
    );

    warnSpy.mockRestore();
  });

  it('triggers checkTournamentComplete when new results are added', async () => {
    readFile.mockResolvedValue({
      fixtures: [
        {
          id: 'f001',
          apiMatchId: 12345,
          homeTeam: 'esp',
          awayTeam: 'arg',
          date: '2026-06-15T18:00:00Z',
          stage: 'Group Stage',
          status: 'scheduled',
        },
      ],
      results: [],
    });

    fetchFromApi.mockResolvedValue({
      matches: [
        {
          id: 12345,
          utcDate: '2026-06-15T18:00:00Z',
          status: 'FINISHED',
          stage: 'GROUP_STAGE',
          group: 'GROUP_A',
          homeTeam: { id: 760, name: 'Spain' },
          awayTeam: { id: 762, name: 'Argentina' },
          score: {
            fullTime: { home: 1, away: 0 },
            penalties: { home: null, away: null },
          },
        },
      ],
    });

    mapTeamId.mockImplementation((id) => {
      if (id === 760) return 'esp';
      if (id === 762) return 'arg';
      return null;
    });

    mapMatchStatus.mockReturnValue({ status: 'completed', known: true });

    await executeSyncCycle();

    expect(checkTournamentComplete).toHaveBeenCalled();
  });

  it('does not trigger checkTournamentComplete when no results are added', async () => {
    readFile.mockResolvedValue({
      fixtures: [
        {
          id: 'f001',
          apiMatchId: 12345,
          homeTeam: 'esp',
          awayTeam: 'arg',
          date: '2026-06-15T18:00:00Z',
          stage: 'Group Stage',
          status: 'scheduled',
        },
      ],
      results: [],
    });

    fetchFromApi.mockResolvedValue({
      matches: [
        {
          id: 12345,
          utcDate: '2026-06-15T18:00:00Z',
          status: 'SCHEDULED',
          stage: 'GROUP_STAGE',
          group: 'GROUP_A',
          homeTeam: { id: 760, name: 'Spain' },
          awayTeam: { id: 762, name: 'Argentina' },
        },
      ],
    });

    mapTeamId.mockImplementation((id) => {
      if (id === 760) return 'esp';
      if (id === 762) return 'arg';
      return null;
    });

    mapMatchStatus.mockReturnValue({ status: 'scheduled', known: true });

    await executeSyncCycle();

    expect(checkTournamentComplete).not.toHaveBeenCalled();
  });

  it('skips results with invalid scores', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    readFile.mockResolvedValue({
      fixtures: [
        {
          id: 'f001',
          apiMatchId: 12345,
          homeTeam: 'esp',
          awayTeam: 'arg',
          date: '2026-06-15T18:00:00Z',
          stage: 'Group Stage',
          status: 'scheduled',
        },
      ],
      results: [],
    });

    fetchFromApi.mockResolvedValue({
      matches: [
        {
          id: 12345,
          utcDate: '2026-06-15T18:00:00Z',
          status: 'FINISHED',
          stage: 'GROUP_STAGE',
          group: 'GROUP_A',
          homeTeam: { id: 760, name: 'Spain' },
          awayTeam: { id: 762, name: 'Argentina' },
          score: {
            fullTime: { home: null, away: null },
          },
        },
      ],
    });

    mapTeamId.mockImplementation((id) => {
      if (id === 760) return 'esp';
      if (id === 762) return 'arg';
      return null;
    });

    mapMatchStatus.mockReturnValue({ status: 'completed', known: true });

    const result = await executeSyncCycle();

    expect(result.stats.results).toBe(0);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('invalid scores')
    );

    warnSpy.mockRestore();
  });

  it('does not populate penaltyShootout when scores are not equal', async () => {
    readFile.mockResolvedValue({
      fixtures: [
        {
          id: 'f001',
          apiMatchId: 12345,
          homeTeam: 'esp',
          awayTeam: 'arg',
          date: '2026-06-15T18:00:00Z',
          stage: 'Round of 16',
          status: 'scheduled',
        },
      ],
      results: [],
    });

    fetchFromApi.mockResolvedValue({
      matches: [
        {
          id: 12345,
          utcDate: '2026-06-15T18:00:00Z',
          status: 'FINISHED',
          stage: 'ROUND_OF_16',
          homeTeam: { id: 760, name: 'Spain' },
          awayTeam: { id: 762, name: 'Argentina' },
          score: {
            fullTime: { home: 2, away: 1 },
            penalties: { home: 4, away: 3 },
          },
        },
      ],
    });

    mapTeamId.mockImplementation((id) => {
      if (id === 760) return 'esp';
      if (id === 762) return 'arg';
      return null;
    });

    mapMatchStatus.mockReturnValue({ status: 'completed', known: true });

    const result = await executeSyncCycle();

    expect(result.stats.results).toBe(1);
    const writtenResults = writeFile.mock.calls.find(c => c[0] === 'results.json')[1];
    // Penalty data should NOT be populated since scores are not equal
    expect(writtenResults.results[0].penaltyShootout).toBeNull();
  });

  it('fixture sync does not set status to completed directly (defers to result sync)', async () => {
    readFile.mockResolvedValue({
      fixtures: [
        {
          id: 'f001',
          apiMatchId: 12345,
          homeTeam: 'esp',
          awayTeam: 'arg',
          date: '2026-06-15T18:00:00Z',
          stage: 'Group Stage',
          status: 'scheduled',
        },
      ],
      results: [],
    });

    fetchFromApi.mockResolvedValue({
      matches: [
        {
          id: 12345,
          utcDate: '2026-06-15T18:00:00Z',
          status: 'FINISHED',
          stage: 'GROUP_STAGE',
          group: 'GROUP_A',
          homeTeam: { id: 760, name: 'Spain' },
          awayTeam: { id: 762, name: 'Argentina' },
          score: {
            fullTime: { home: null, away: null },
          },
        },
      ],
    });

    mapTeamId.mockImplementation((id) => {
      if (id === 760) return 'esp';
      if (id === 762) return 'arg';
      return null;
    });

    mapMatchStatus.mockReturnValue({ status: 'completed', known: true });

    const result = await executeSyncCycle();

    // Fixture sync should NOT write fixtures because "completed" is deferred
    // (date didn't change, status change to "completed" is deferred)
    expect(result.stats.fixtures).toBe(0);
  });
});

describe('syncService - group standings sync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    writeFile.mockResolvedValue(undefined);
    atomicWriteFile.mockResolvedValue(undefined);
    checkTournamentComplete.mockResolvedValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches standings and reorders groups when group stage is active', async () => {
    // readFile is called multiple times: for fixtures (syncFixtures), results (syncResults),
    // fixtures again (syncGroupStandings), and groups (syncGroupStandings)
    readFile.mockImplementation((filename) => {
      if (filename === 'fixtures.json') {
        return Promise.resolve({
          fixtures: [
            { id: 'f001', apiMatchId: 1, homeTeam: 'esp', awayTeam: 'arg', stage: 'Group Stage', status: 'scheduled', date: '2026-06-15T18:00:00Z' },
          ],
        });
      }
      if (filename === 'groups.json') {
        return Promise.resolve({
          groups: [
            { name: 'A', teams: ['esp', 'arg', 'bra', 'ger'] },
          ],
        });
      }
      if (filename === 'results.json') {
        return Promise.resolve({ results: [] });
      }
      return Promise.resolve({});
    });

    fetchFromApi.mockImplementation((endpoint) => {
      if (endpoint === '/v4/competitions/WC/matches') {
        return Promise.resolve({ matches: [] });
      }
      if (endpoint === '/v4/competitions/WC/standings') {
        return Promise.resolve({
          standings: [
            {
              type: 'TOTAL',
              group: 'GROUP_A',
              table: [
                { position: 1, team: { id: 762, name: 'Argentina' } },
                { position: 2, team: { id: 764, name: 'Brazil' } },
                { position: 3, team: { id: 760, name: 'Spain' } },
                { position: 4, team: { id: 759, name: 'Germany' } },
              ],
            },
          ],
        });
      }
      return Promise.resolve({});
    });

    mapTeamId.mockImplementation((id) => {
      const map = { 760: 'esp', 762: 'arg', 764: 'bra', 759: 'ger' };
      return map[id] || null;
    });

    mapMatchStatus.mockReturnValue({ status: 'scheduled', known: true });

    const result = await executeSyncCycle();

    expect(result.outcome).toBe('success');
    expect(result.stats.standings).toBe(true);

    // Verify groups.json was written with reordered teams
    const groupsWriteCall = writeFile.mock.calls.find(c => c[0] === 'groups.json');
    expect(groupsWriteCall).toBeDefined();
    expect(groupsWriteCall[1].groups[0].teams).toEqual(['arg', 'bra', 'esp', 'ger']);
  });

  it('skips standings fetch when all Group Stage fixtures are completed', async () => {
    readFile.mockImplementation((filename) => {
      if (filename === 'fixtures.json') {
        return Promise.resolve({
          fixtures: [
            { id: 'f001', apiMatchId: 1, homeTeam: 'esp', awayTeam: 'arg', stage: 'Group Stage', status: 'completed', date: '2026-06-15T18:00:00Z' },
            { id: 'f002', apiMatchId: 2, homeTeam: 'bra', awayTeam: 'ger', stage: 'Group Stage', status: 'completed', date: '2026-06-16T18:00:00Z' },
          ],
        });
      }
      if (filename === 'results.json') {
        return Promise.resolve({ results: [] });
      }
      return Promise.resolve({});
    });

    fetchFromApi.mockImplementation((endpoint) => {
      if (endpoint === '/v4/competitions/WC/matches') {
        return Promise.resolve({ matches: [] });
      }
      return Promise.resolve({});
    });

    const result = await executeSyncCycle();

    expect(result.outcome).toBe('success');
    expect(result.stats.standings).toBe(false);
    // Should NOT have fetched standings
    expect(fetchFromApi).not.toHaveBeenCalledWith('/v4/competitions/WC/standings');
  });

  it('skips standings fetch when there are no Group Stage fixtures', async () => {
    readFile.mockImplementation((filename) => {
      if (filename === 'fixtures.json') {
        return Promise.resolve({
          fixtures: [
            { id: 'f001', apiMatchId: 1, homeTeam: 'esp', awayTeam: 'arg', stage: 'Round of 16', status: 'scheduled', date: '2026-07-01T18:00:00Z' },
          ],
        });
      }
      if (filename === 'results.json') {
        return Promise.resolve({ results: [] });
      }
      return Promise.resolve({});
    });

    fetchFromApi.mockImplementation((endpoint) => {
      if (endpoint === '/v4/competitions/WC/matches') {
        return Promise.resolve({ matches: [] });
      }
      return Promise.resolve({});
    });

    const result = await executeSyncCycle();

    expect(result.outcome).toBe('success');
    expect(result.stats.standings).toBe(false);
    expect(fetchFromApi).not.toHaveBeenCalledWith('/v4/competitions/WC/standings');
  });

  it('preserves group structure and only updates ordering', async () => {
    readFile.mockImplementation((filename) => {
      if (filename === 'fixtures.json') {
        return Promise.resolve({
          fixtures: [
            { id: 'f001', apiMatchId: 1, homeTeam: 'esp', awayTeam: 'arg', stage: 'Group Stage', status: 'in_progress', date: '2026-06-15T18:00:00Z' },
          ],
        });
      }
      if (filename === 'groups.json') {
        return Promise.resolve({
          groups: [
            { name: 'A', teams: ['esp', 'arg', 'bra', 'ger'] },
            { name: 'B', teams: ['fra', 'eng', 'por', 'bel'] },
          ],
        });
      }
      if (filename === 'results.json') {
        return Promise.resolve({ results: [] });
      }
      return Promise.resolve({});
    });

    fetchFromApi.mockImplementation((endpoint) => {
      if (endpoint === '/v4/competitions/WC/matches') {
        return Promise.resolve({ matches: [] });
      }
      if (endpoint === '/v4/competitions/WC/standings') {
        return Promise.resolve({
          standings: [
            {
              type: 'TOTAL',
              group: 'GROUP_A',
              table: [
                { position: 1, team: { id: 759, name: 'Germany' } },
                { position: 2, team: { id: 762, name: 'Argentina' } },
                { position: 3, team: { id: 764, name: 'Brazil' } },
                { position: 4, team: { id: 760, name: 'Spain' } },
              ],
            },
          ],
        });
      }
      return Promise.resolve({});
    });

    mapTeamId.mockImplementation((id) => {
      const map = { 760: 'esp', 762: 'arg', 764: 'bra', 759: 'ger', 773: 'fra', 66: 'eng', 765: 'por', 805: 'bel' };
      return map[id] || null;
    });

    mapMatchStatus.mockReturnValue({ status: 'in_progress', known: true });

    const result = await executeSyncCycle();

    expect(result.outcome).toBe('success');
    expect(result.stats.standings).toBe(true);

    const groupsWriteCall = writeFile.mock.calls.find(c => c[0] === 'groups.json');
    expect(groupsWriteCall).toBeDefined();
    const writtenGroups = groupsWriteCall[1].groups;

    // Group A should be reordered
    expect(writtenGroups[0].name).toBe('A');
    expect(writtenGroups[0].teams).toEqual(['ger', 'arg', 'bra', 'esp']);

    // Group B should remain unchanged (no standings data for it)
    expect(writtenGroups[1].name).toBe('B');
    expect(writtenGroups[1].teams).toEqual(['fra', 'eng', 'por', 'bel']);
  });

  it('skips unrecognised group names and logs warning', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    readFile.mockImplementation((filename) => {
      if (filename === 'fixtures.json') {
        return Promise.resolve({
          fixtures: [
            { id: 'f001', apiMatchId: 1, homeTeam: 'esp', awayTeam: 'arg', stage: 'Group Stage', status: 'scheduled', date: '2026-06-15T18:00:00Z' },
          ],
        });
      }
      if (filename === 'groups.json') {
        return Promise.resolve({
          groups: [
            { name: 'A', teams: ['esp', 'arg', 'bra', 'ger'] },
          ],
        });
      }
      if (filename === 'results.json') {
        return Promise.resolve({ results: [] });
      }
      return Promise.resolve({});
    });

    fetchFromApi.mockImplementation((endpoint) => {
      if (endpoint === '/v4/competitions/WC/matches') {
        return Promise.resolve({ matches: [] });
      }
      if (endpoint === '/v4/competitions/WC/standings') {
        return Promise.resolve({
          standings: [
            {
              type: 'TOTAL',
              group: 'GROUP_Z',
              table: [
                { position: 1, team: { id: 760, name: 'Spain' } },
              ],
            },
          ],
        });
      }
      return Promise.resolve({});
    });

    mapTeamId.mockImplementation((id) => {
      const map = { 760: 'esp', 762: 'arg', 764: 'bra', 759: 'ger' };
      return map[id] || null;
    });

    mapMatchStatus.mockReturnValue({ status: 'scheduled', known: true });

    const result = await executeSyncCycle();

    expect(result.outcome).toBe('success');
    expect(result.stats.standings).toBe(false);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('unrecognised group')
    );

    warnSpy.mockRestore();
  });

  it('only processes TOTAL type standings entries', async () => {
    readFile.mockImplementation((filename) => {
      if (filename === 'fixtures.json') {
        return Promise.resolve({
          fixtures: [
            { id: 'f001', apiMatchId: 1, homeTeam: 'esp', awayTeam: 'arg', stage: 'Group Stage', status: 'scheduled', date: '2026-06-15T18:00:00Z' },
          ],
        });
      }
      if (filename === 'groups.json') {
        return Promise.resolve({
          groups: [
            { name: 'A', teams: ['esp', 'arg', 'bra', 'ger'] },
          ],
        });
      }
      if (filename === 'results.json') {
        return Promise.resolve({ results: [] });
      }
      return Promise.resolve({});
    });

    fetchFromApi.mockImplementation((endpoint) => {
      if (endpoint === '/v4/competitions/WC/matches') {
        return Promise.resolve({ matches: [] });
      }
      if (endpoint === '/v4/competitions/WC/standings') {
        return Promise.resolve({
          standings: [
            {
              type: 'HOME',
              group: 'GROUP_A',
              table: [
                { position: 1, team: { id: 762, name: 'Argentina' } },
                { position: 2, team: { id: 764, name: 'Brazil' } },
                { position: 3, team: { id: 760, name: 'Spain' } },
                { position: 4, team: { id: 759, name: 'Germany' } },
              ],
            },
            {
              type: 'AWAY',
              group: 'GROUP_A',
              table: [
                { position: 1, team: { id: 764, name: 'Brazil' } },
                { position: 2, team: { id: 762, name: 'Argentina' } },
                { position: 3, team: { id: 759, name: 'Germany' } },
                { position: 4, team: { id: 760, name: 'Spain' } },
              ],
            },
          ],
        });
      }
      return Promise.resolve({});
    });

    mapTeamId.mockImplementation((id) => {
      const map = { 760: 'esp', 762: 'arg', 764: 'bra', 759: 'ger' };
      return map[id] || null;
    });

    mapMatchStatus.mockReturnValue({ status: 'scheduled', known: true });

    const result = await executeSyncCycle();

    expect(result.outcome).toBe('success');
    // No TOTAL type standings, so no updates
    expect(result.stats.standings).toBe(false);
    // groups.json should not be written
    const groupsWriteCall = writeFile.mock.calls.find(c => c[0] === 'groups.json');
    expect(groupsWriteCall).toBeUndefined();
  });

  it('does not write groups.json when order has not changed', async () => {
    readFile.mockImplementation((filename) => {
      if (filename === 'fixtures.json') {
        return Promise.resolve({
          fixtures: [
            { id: 'f001', apiMatchId: 1, homeTeam: 'esp', awayTeam: 'arg', stage: 'Group Stage', status: 'scheduled', date: '2026-06-15T18:00:00Z' },
          ],
        });
      }
      if (filename === 'groups.json') {
        return Promise.resolve({
          groups: [
            { name: 'A', teams: ['arg', 'bra', 'esp', 'ger'] },
          ],
        });
      }
      if (filename === 'results.json') {
        return Promise.resolve({ results: [] });
      }
      return Promise.resolve({});
    });

    fetchFromApi.mockImplementation((endpoint) => {
      if (endpoint === '/v4/competitions/WC/matches') {
        return Promise.resolve({ matches: [] });
      }
      if (endpoint === '/v4/competitions/WC/standings') {
        return Promise.resolve({
          standings: [
            {
              type: 'TOTAL',
              group: 'GROUP_A',
              table: [
                { position: 1, team: { id: 762, name: 'Argentina' } },
                { position: 2, team: { id: 764, name: 'Brazil' } },
                { position: 3, team: { id: 760, name: 'Spain' } },
                { position: 4, team: { id: 759, name: 'Germany' } },
              ],
            },
          ],
        });
      }
      return Promise.resolve({});
    });

    mapTeamId.mockImplementation((id) => {
      const map = { 760: 'esp', 762: 'arg', 764: 'bra', 759: 'ger' };
      return map[id] || null;
    });

    mapMatchStatus.mockReturnValue({ status: 'scheduled', known: true });

    const result = await executeSyncCycle();

    expect(result.outcome).toBe('success');
    // Order matches already, so no update
    expect(result.stats.standings).toBe(false);
    const groupsWriteCall = writeFile.mock.calls.find(c => c[0] === 'groups.json');
    expect(groupsWriteCall).toBeUndefined();
  });

  it('fetches standings when at least one Group Stage fixture is in_progress', async () => {
    readFile.mockImplementation((filename) => {
      if (filename === 'fixtures.json') {
        return Promise.resolve({
          fixtures: [
            { id: 'f001', apiMatchId: 1, homeTeam: 'esp', awayTeam: 'arg', stage: 'Group Stage', status: 'completed', date: '2026-06-15T18:00:00Z' },
            { id: 'f002', apiMatchId: 2, homeTeam: 'bra', awayTeam: 'ger', stage: 'Group Stage', status: 'in_progress', date: '2026-06-16T18:00:00Z' },
          ],
        });
      }
      if (filename === 'groups.json') {
        return Promise.resolve({
          groups: [
            { name: 'A', teams: ['esp', 'arg', 'bra', 'ger'] },
          ],
        });
      }
      if (filename === 'results.json') {
        return Promise.resolve({ results: [] });
      }
      return Promise.resolve({});
    });

    fetchFromApi.mockImplementation((endpoint) => {
      if (endpoint === '/v4/competitions/WC/matches') {
        return Promise.resolve({ matches: [] });
      }
      if (endpoint === '/v4/competitions/WC/standings') {
        return Promise.resolve({
          standings: [
            {
              type: 'TOTAL',
              group: 'GROUP_A',
              table: [
                { position: 1, team: { id: 764, name: 'Brazil' } },
                { position: 2, team: { id: 762, name: 'Argentina' } },
                { position: 3, team: { id: 760, name: 'Spain' } },
                { position: 4, team: { id: 759, name: 'Germany' } },
              ],
            },
          ],
        });
      }
      return Promise.resolve({});
    });

    mapTeamId.mockImplementation((id) => {
      const map = { 760: 'esp', 762: 'arg', 764: 'bra', 759: 'ger' };
      return map[id] || null;
    });

    mapMatchStatus.mockReturnValue({ status: 'in_progress', known: true });

    const result = await executeSyncCycle();

    expect(result.outcome).toBe('success');
    expect(result.stats.standings).toBe(true);
    expect(fetchFromApi).toHaveBeenCalledWith('/v4/competitions/WC/standings');
  });
});
