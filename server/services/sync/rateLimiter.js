/**
 * Rate Limiter for football-data.org API
 *
 * Implements a sliding window algorithm that enforces a maximum of 9 requests
 * per rolling 60-second window (leaving 1 request of headroom below the
 * 10/minute free-tier limit).
 */

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 9;
const MAX_DELAY_MS = 65_000;

/** @type {number[]} Array of request timestamps (ms since epoch) */
let timestamps = [];

/**
 * Removes timestamps older than the sliding window from the array.
 */
function pruneExpired() {
  const cutoff = Date.now() - WINDOW_MS;
  timestamps = timestamps.filter((t) => t > cutoff);
}

/**
 * Waits until a request slot is available within the rate limit window.
 * Resolves immediately if a slot is available, otherwise delays until the
 * oldest request in the window expires.
 *
 * @returns {Promise<void>} Resolves when the request can proceed
 * @throws {Error} If the required delay would exceed 65 seconds
 */
export async function acquireSlot() {
  pruneExpired();

  if (timestamps.length < MAX_REQUESTS) {
    return;
  }

  // Calculate how long until the oldest request exits the window
  const oldest = timestamps[0];
  const delay = oldest + WINDOW_MS - Date.now();

  if (delay <= 0) {
    // The oldest entry just expired, prune and proceed
    pruneExpired();
    return;
  }

  if (delay > MAX_DELAY_MS) {
    throw new Error(
      `Rate limiter: required delay ${delay}ms exceeds maximum ${MAX_DELAY_MS}ms`
    );
  }

  await new Promise((resolve) => setTimeout(resolve, delay));
  pruneExpired();
}

/**
 * Records that a request was made at the current timestamp.
 * Call this after a successful request to the API.
 */
export function recordRequest() {
  timestamps.push(Date.now());
}

/**
 * Resets the rate limiter state. Intended for testing.
 */
export function reset() {
  timestamps = [];
}
