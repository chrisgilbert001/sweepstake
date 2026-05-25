import { acquireSlot, recordRequest, reset } from '../rateLimiter.js';

describe('rateLimiter', () => {
  beforeEach(() => {
    reset();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('acquireSlot', () => {
    it('resolves immediately when no requests have been made', async () => {
      await expect(acquireSlot()).resolves.toBeUndefined();
    });

    it('resolves immediately when fewer than 9 requests in the window', async () => {
      for (let i = 0; i < 8; i++) {
        recordRequest();
      }
      await expect(acquireSlot()).resolves.toBeUndefined();
    });

    it('delays when 9 requests have been made within the window', async () => {
      for (let i = 0; i < 9; i++) {
        recordRequest();
      }

      let resolved = false;
      const promise = acquireSlot().then(() => { resolved = true; });

      // Should not resolve immediately
      await vi.advanceTimersByTimeAsync(1);
      expect(resolved).toBe(false);

      // Advance past the 60s window so the oldest request expires
      await vi.advanceTimersByTimeAsync(60_000);
      await promise;
      expect(resolved).toBe(true);
    });

    it('resolves after oldest request exits the window', async () => {
      // Record 9 requests at time 0
      for (let i = 0; i < 9; i++) {
        recordRequest();
      }

      // Advance time by 30s, then try to acquire
      await vi.advanceTimersByTimeAsync(30_000);

      let resolved = false;
      const promise = acquireSlot().then(() => { resolved = true; });

      // Should need to wait ~30s more for the oldest to expire
      await vi.advanceTimersByTimeAsync(29_000);
      expect(resolved).toBe(false);

      await vi.advanceTimersByTimeAsync(2_000);
      await promise;
      expect(resolved).toBe(true);
    });

    it('throws if required delay exceeds 65 seconds', async () => {
      // Simulate requests that would require > 65s delay
      // Record 9 requests at a future time (trick: set time forward, record, set back)
      const now = Date.now();
      vi.setSystemTime(now + 70_000);
      for (let i = 0; i < 9; i++) {
        recordRequest();
      }
      vi.setSystemTime(now);

      await expect(acquireSlot()).rejects.toThrow(/exceeds maximum/);
    });
  });

  describe('recordRequest', () => {
    it('adds a timestamp to the internal tracking', async () => {
      recordRequest();
      recordRequest();
      // After 2 records, we should still have slots available (< 9)
      await expect(acquireSlot()).resolves.toBeUndefined();
    });
  });

  describe('reset', () => {
    it('clears all tracked timestamps', async () => {
      for (let i = 0; i < 9; i++) {
        recordRequest();
      }
      reset();
      // After reset, should resolve immediately
      await expect(acquireSlot()).resolves.toBeUndefined();
    });
  });
});
