import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the sync service
vi.mock('../syncService.js');

import {
  startScheduler,
  stopScheduler,
  isSyncInProgress,
  triggerManualSync,
  getValidatedInterval,
} from '../syncScheduler.js';
import { executeSyncCycle } from '../syncService.js';

describe('syncScheduler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    executeSyncCycle.mockResolvedValue({
      outcome: 'success',
      timestamp: new Date().toISOString(),
      error: null,
      stats: { fixtures: 0, results: 0, standings: false },
    });
  });

  afterEach(async () => {
    // Ensure scheduler is stopped between tests
    await stopScheduler();
    vi.useRealTimers();
    // Reset env var
    delete process.env.SYNC_INTERVAL_MS;
  });

  describe('getValidatedInterval', () => {
    it('returns default 60000ms when SYNC_INTERVAL_MS is not set', () => {
      delete process.env.SYNC_INTERVAL_MS;
      expect(getValidatedInterval()).toBe(60000);
    });

    it('returns default when SYNC_INTERVAL_MS is empty string', () => {
      process.env.SYNC_INTERVAL_MS = '';
      expect(getValidatedInterval()).toBe(60000);
    });

    it('accepts valid integer within range (60000)', () => {
      process.env.SYNC_INTERVAL_MS = '60000';
      expect(getValidatedInterval()).toBe(60000);
    });

    it('accepts valid integer within range (86400000)', () => {
      process.env.SYNC_INTERVAL_MS = '86400000';
      expect(getValidatedInterval()).toBe(86400000);
    });

    it('accepts valid integer within range (1800000)', () => {
      process.env.SYNC_INTERVAL_MS = '1800000';
      expect(getValidatedInterval()).toBe(1800000);
    });

    it('falls back to default for value below minimum (59999)', () => {
      process.env.SYNC_INTERVAL_MS = '59999';
      expect(getValidatedInterval()).toBe(60000);
    });

    it('falls back to default for value above maximum (86400001)', () => {
      process.env.SYNC_INTERVAL_MS = '86400001';
      expect(getValidatedInterval()).toBe(60000);
    });

    it('falls back to default for non-integer (3.14)', () => {
      process.env.SYNC_INTERVAL_MS = '3.14';
      expect(getValidatedInterval()).toBe(60000);
    });

    it('falls back to default for non-numeric string', () => {
      process.env.SYNC_INTERVAL_MS = 'abc';
      expect(getValidatedInterval()).toBe(60000);
    });

    it('falls back to default for negative value', () => {
      process.env.SYNC_INTERVAL_MS = '-1000';
      expect(getValidatedInterval()).toBe(60000);
    });

    it('falls back to default for zero', () => {
      process.env.SYNC_INTERVAL_MS = '0';
      expect(getValidatedInterval()).toBe(60000);
    });

    it('falls back to default for NaN', () => {
      process.env.SYNC_INTERVAL_MS = 'NaN';
      expect(getValidatedInterval()).toBe(60000);
    });

    it('falls back to default for Infinity', () => {
      process.env.SYNC_INTERVAL_MS = 'Infinity';
      expect(getValidatedInterval()).toBe(60000);
    });
  });

  describe('startScheduler', () => {
    it('executes first sync after initial delay (default 5s)', async () => {
      startScheduler();

      expect(executeSyncCycle).not.toHaveBeenCalled();

      // Advance past the initial delay
      await vi.advanceTimersByTimeAsync(5000);

      expect(executeSyncCycle).toHaveBeenCalledTimes(1);
    });

    it('executes first sync after custom initial delay', async () => {
      startScheduler({ initialDelayMs: 2000 });

      await vi.advanceTimersByTimeAsync(1999);
      expect(executeSyncCycle).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(1);
      expect(executeSyncCycle).toHaveBeenCalledTimes(1);
    });

    it('repeats sync at the configured interval', async () => {
      startScheduler({ initialDelayMs: 1000, intervalMs: 10000 });

      // First sync after initial delay
      await vi.advanceTimersByTimeAsync(1000);
      expect(executeSyncCycle).toHaveBeenCalledTimes(1);

      // Second sync after interval
      await vi.advanceTimersByTimeAsync(10000);
      expect(executeSyncCycle).toHaveBeenCalledTimes(2);

      // Third sync after another interval
      await vi.advanceTimersByTimeAsync(10000);
      expect(executeSyncCycle).toHaveBeenCalledTimes(3);
    });

    it('does not start if already running', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      startScheduler({ initialDelayMs: 1000 });
      startScheduler({ initialDelayMs: 1000 });

      await vi.advanceTimersByTimeAsync(1000);

      // Should only execute once (second start was ignored)
      expect(executeSyncCycle).toHaveBeenCalledTimes(1);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('already running')
      );

      warnSpy.mockRestore();
    });
  });

  describe('stopScheduler', () => {
    it('cancels pending initial timer', async () => {
      startScheduler({ initialDelayMs: 5000 });

      await stopScheduler();

      // Advance past the initial delay — sync should not execute
      await vi.advanceTimersByTimeAsync(10000);
      expect(executeSyncCycle).not.toHaveBeenCalled();
    });

    it('cancels repeating interval', async () => {
      startScheduler({ initialDelayMs: 1000, intervalMs: 5000 });

      // Let first sync execute
      await vi.advanceTimersByTimeAsync(1000);
      expect(executeSyncCycle).toHaveBeenCalledTimes(1);

      await stopScheduler();

      // Advance past interval — no more syncs
      await vi.advanceTimersByTimeAsync(10000);
      expect(executeSyncCycle).toHaveBeenCalledTimes(1);
    });

    it('waits for in-progress sync to complete', async () => {
      let resolveSync;
      executeSyncCycle.mockImplementation(
        () => new Promise((resolve) => { resolveSync = resolve; })
      );

      startScheduler({ initialDelayMs: 1000 });

      // Trigger the first sync
      await vi.advanceTimersByTimeAsync(1000);

      // Start stopping — should wait for sync
      const stopPromise = stopScheduler();

      // Resolve the sync
      resolveSync({
        outcome: 'success',
        timestamp: new Date().toISOString(),
        error: null,
        stats: { fixtures: 0, results: 0, standings: false },
      });

      await stopPromise;
      // If we get here, stopScheduler waited for the sync to complete
    });

    it('is a no-op if scheduler is not running', async () => {
      // Should not throw
      await stopScheduler();
    });
  });

  describe('isSyncInProgress', () => {
    it('returns false when no sync is running', () => {
      expect(isSyncInProgress()).toBe(false);
    });

    it('returns true during a sync execution', async () => {
      let resolveSync;
      executeSyncCycle.mockImplementation(
        () => new Promise((resolve) => { resolveSync = resolve; })
      );

      startScheduler({ initialDelayMs: 1000 });
      await vi.advanceTimersByTimeAsync(1000);

      expect(isSyncInProgress()).toBe(true);

      resolveSync({
        outcome: 'success',
        timestamp: new Date().toISOString(),
        error: null,
        stats: { fixtures: 0, results: 0, standings: false },
      });

      // Allow the promise chain to resolve
      await vi.advanceTimersByTimeAsync(0);
      expect(isSyncInProgress()).toBe(false);
    });
  });

  describe('triggerManualSync', () => {
    it('executes an immediate sync', async () => {
      const result = await triggerManualSync();

      expect(executeSyncCycle).toHaveBeenCalledTimes(1);
      expect(result.outcome).toBe('success');
    });

    it('throws if sync is already in progress', async () => {
      let resolveSync;
      executeSyncCycle.mockImplementation(
        () => new Promise((resolve) => { resolveSync = resolve; })
      );

      startScheduler({ initialDelayMs: 1000 });
      await vi.advanceTimersByTimeAsync(1000);

      // Sync is now in progress
      await expect(triggerManualSync()).rejects.toThrow('Sync already in progress');

      resolveSync({
        outcome: 'success',
        timestamp: new Date().toISOString(),
        error: null,
        stats: { fixtures: 0, results: 0, standings: false },
      });

      await vi.advanceTimersByTimeAsync(0);
    });

    it('resets syncInProgress flag after completion', async () => {
      await triggerManualSync();
      expect(isSyncInProgress()).toBe(false);
    });

    it('resets syncInProgress flag even if sync fails', async () => {
      executeSyncCycle.mockRejectedValue(new Error('Sync failed'));

      await expect(triggerManualSync()).rejects.toThrow('Sync failed');
      expect(isSyncInProgress()).toBe(false);
    });
  });

  describe('overlap prevention', () => {
    it('does not start a new scheduled sync until the previous one completes', async () => {
      let resolveSync;
      executeSyncCycle.mockImplementation(
        () => new Promise((resolve) => { resolveSync = resolve; })
      );

      startScheduler({ initialDelayMs: 1000, intervalMs: 2000 });

      // Trigger first sync — it hangs (does not resolve yet)
      await vi.advanceTimersByTimeAsync(1000);
      expect(executeSyncCycle).toHaveBeenCalledTimes(1);

      // The next sync is only scheduled after the current one finishes, so
      // advancing past the interval while the sync is in flight does nothing.
      await vi.advanceTimersByTimeAsync(2000);
      expect(executeSyncCycle).toHaveBeenCalledTimes(1);

      // Resolve the first sync; the next sync is now scheduled.
      resolveSync({
        outcome: 'success',
        timestamp: new Date().toISOString(),
        error: null,
        stats: { fixtures: 0, results: 0, live: 0, standings: false },
      });
      await vi.advanceTimersByTimeAsync(0);

      executeSyncCycle.mockResolvedValue({
        outcome: 'success',
        timestamp: new Date().toISOString(),
        error: null,
        stats: { fixtures: 0, results: 0, live: 0, standings: false },
      });

      // After the base interval elapses, the next sync runs.
      await vi.advanceTimersByTimeAsync(2000);
      expect(executeSyncCycle).toHaveBeenCalledTimes(2);
    });
  });

  describe('fixed cadence', () => {
    it('keeps the configured interval regardless of live matches', async () => {
      // A live match is reported, but the interval must not change.
      executeSyncCycle.mockResolvedValue({
        outcome: 'success',
        timestamp: new Date().toISOString(),
        error: null,
        stats: { fixtures: 0, results: 1, live: 1, standings: false },
      });

      startScheduler({ initialDelayMs: 1000, intervalMs: 120000 });

      await vi.advanceTimersByTimeAsync(1000);
      expect(executeSyncCycle).toHaveBeenCalledTimes(1);

      // No early sync before the configured interval, even with a live match.
      await vi.advanceTimersByTimeAsync(60000);
      expect(executeSyncCycle).toHaveBeenCalledTimes(1);

      // The configured interval (120s total) triggers the next sync.
      await vi.advanceTimersByTimeAsync(60000);
      expect(executeSyncCycle).toHaveBeenCalledTimes(2);
    });
  });
});
