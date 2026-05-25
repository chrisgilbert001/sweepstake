import { fetchFromApi, ApiError } from '../apiClient.js';
import { reset } from '../rateLimiter.js';

describe('apiClient', () => {
  const originalEnv = process.env.FOOTBALL_DATA_API_KEY;

  beforeEach(() => {
    reset();
    vi.useFakeTimers();
    process.env.FOOTBALL_DATA_API_KEY = 'test-api-key-123';
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    if (originalEnv !== undefined) {
      process.env.FOOTBALL_DATA_API_KEY = originalEnv;
    } else {
      delete process.env.FOOTBALL_DATA_API_KEY;
    }
  });

  describe('fetchFromApi', () => {
    it('throws ApiError when API key is missing', async () => {
      delete process.env.FOOTBALL_DATA_API_KEY;

      await expect(fetchFromApi('/v4/competitions/WC/matches'))
        .rejects.toMatchObject({
          status: 0,
          retryable: false,
          message: expect.stringContaining('API key is not configured'),
        });
    });

    it('throws ApiError when API key is empty string', async () => {
      process.env.FOOTBALL_DATA_API_KEY = '';

      await expect(fetchFromApi('/v4/competitions/WC/matches'))
        .rejects.toMatchObject({
          status: 0,
          retryable: false,
          message: expect.stringContaining('API key is not configured'),
        });
    });

    it('includes X-Auth-Token header on every request', async () => {
      fetch.mockResolvedValueOnce(new Response(JSON.stringify({ matches: [] }), { status: 200 }));

      await fetchFromApi('/v4/competitions/WC/matches');

      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: { 'X-Auth-Token': 'test-api-key-123' },
        })
      );
    });

    it('builds URL with base URL and query params', async () => {
      fetch.mockResolvedValueOnce(new Response(JSON.stringify({ data: 'ok' }), { status: 200 }));

      await fetchFromApi('/v4/competitions/WC/matches', { season: '2026', status: 'FINISHED' });

      const calledUrl = fetch.mock.calls[0][0];
      expect(calledUrl).toContain('https://api.football-data.org/v4/competitions/WC/matches');
      expect(calledUrl).toContain('season=2026');
      expect(calledUrl).toContain('status=FINISHED');
    });

    it('returns parsed JSON on successful response', async () => {
      const responseData = { matches: [{ id: 1 }] };
      fetch.mockResolvedValueOnce(new Response(JSON.stringify(responseData), { status: 200 }));

      const result = await fetchFromApi('/v4/competitions/WC/matches');

      expect(result).toEqual(responseData);
    });

    it('throws non-retryable ApiError on 403 without retrying', async () => {
      fetch.mockResolvedValue(new Response('Forbidden', { status: 403 }));

      await expect(fetchFromApi('/v4/competitions/WC/matches'))
        .rejects.toMatchObject({
          status: 403,
          retryable: false,
          message: expect.stringContaining('Authentication failure'),
        });

      // Should only be called once (no retries)
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('retries up to 2 additional times on timeout with 5s delay', async () => {
      // All three attempts timeout - use abort signal to properly simulate
      fetch.mockImplementation((url, options) => {
        return new Promise((_, reject) => {
          const onAbort = () => {
            reject(new DOMException('The operation was aborted.', 'AbortError'));
          };
          if (options?.signal?.aborted) {
            onAbort();
          } else {
            options?.signal?.addEventListener('abort', onAbort);
          }
        });
      });

      let error;
      const promise = fetchFromApi('/v4/competitions/WC/matches').catch((e) => { error = e; });

      // First attempt times out at 30s
      await vi.advanceTimersByTimeAsync(30_000);
      // Delay before retry: 5s
      await vi.advanceTimersByTimeAsync(5_000);
      // Second attempt times out at 30s
      await vi.advanceTimersByTimeAsync(30_000);
      // Delay before retry: 5s
      await vi.advanceTimersByTimeAsync(5_000);
      // Third attempt times out at 30s
      await vi.advanceTimersByTimeAsync(30_000);

      await promise;

      expect(error).toBeInstanceOf(ApiError);
      expect(error.status).toBe(0);
      expect(error.retryable).toBe(true);
      expect(error.message).toContain('timeout');
      expect(fetch).toHaveBeenCalledTimes(3);
    });

    it('retries up to 3 times on 429 with 60s delay', async () => {
      // All attempts return 429
      fetch.mockImplementation(() =>
        Promise.resolve(new Response('Too Many Requests', { status: 429 }))
      );

      let error;
      const promise = fetchFromApi('/v4/competitions/WC/matches').catch((e) => { error = e; });

      // Allow microtasks to settle after first attempt
      await vi.advanceTimersByTimeAsync(0);
      // First retry after 60s delay
      await vi.advanceTimersByTimeAsync(60_000);
      await vi.advanceTimersByTimeAsync(0);
      // Second retry after 60s delay
      await vi.advanceTimersByTimeAsync(60_000);
      await vi.advanceTimersByTimeAsync(0);
      // Third retry after 60s delay
      await vi.advanceTimersByTimeAsync(60_000);
      await vi.advanceTimersByTimeAsync(0);

      await promise;

      expect(error).toBeInstanceOf(ApiError);
      expect(error.status).toBe(429);
      expect(error.retryable).toBe(false);
      expect(error.message).toContain('Rate limit exceeded');
      // 1 initial + 3 retries = 4 total
      expect(fetch).toHaveBeenCalledTimes(4);
    });

    it('throws ApiError on non-200 HTTP responses (5xx)', async () => {
      fetch.mockResolvedValueOnce(new Response('Internal Server Error', { status: 500 }));

      await expect(fetchFromApi('/v4/competitions/WC/matches'))
        .rejects.toMatchObject({
          status: 500,
          retryable: true,
          message: expect.stringContaining('HTTP 500'),
        });
    });

    it('throws ApiError on malformed JSON response', async () => {
      fetch.mockResolvedValueOnce(new Response('not valid json{{{', {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }));

      await expect(fetchFromApi('/v4/competitions/WC/matches'))
        .rejects.toMatchObject({
          status: 0,
          retryable: false,
          message: expect.stringContaining('Failed to parse JSON'),
        });
    });

    it('succeeds on retry after initial timeout', async () => {
      const responseData = { matches: [{ id: 42 }] };

      // First call times out, second succeeds
      let callCount = 0;
      fetch.mockImplementation((url, options) => {
        callCount++;
        if (callCount === 1) {
          return new Promise((_, reject) => {
            const onAbort = () => {
              reject(new DOMException('The operation was aborted.', 'AbortError'));
            };
            if (options?.signal?.aborted) {
              onAbort();
            } else {
              options?.signal?.addEventListener('abort', onAbort);
            }
          });
        }
        return Promise.resolve(new Response(JSON.stringify(responseData), { status: 200 }));
      });

      const promise = fetchFromApi('/v4/competitions/WC/matches');

      // First attempt times out
      await vi.advanceTimersByTimeAsync(30_000);
      // 5s delay before retry
      await vi.advanceTimersByTimeAsync(5_000);

      const result = await promise;
      expect(result).toEqual(responseData);
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('succeeds on retry after initial 429', async () => {
      const responseData = { standings: [] };

      let callCount = 0;
      fetch.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve(new Response('Too Many Requests', { status: 429 }));
        }
        return Promise.resolve(new Response(JSON.stringify(responseData), { status: 200 }));
      });

      const promise = fetchFromApi('/v4/competitions/WC/matches');

      // First attempt returns 429, then 60s delay
      await vi.advanceTimersByTimeAsync(60_000);

      const result = await promise;
      expect(result).toEqual(responseData);
      expect(fetch).toHaveBeenCalledTimes(2);
    });
  });
});
