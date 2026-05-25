/**
 * API Client for football-data.org v4 API
 *
 * Handles authentication, request timeouts, rate limiting integration,
 * and retry logic for timeout and 429 (rate limit) responses.
 */

import { acquireSlot, recordRequest } from './rateLimiter.js';

const BASE_URL = 'https://api.football-data.org';
const TIMEOUT_MS = 30_000;
const TIMEOUT_RETRIES = 2;
const TIMEOUT_RETRY_DELAY_MS = 5_000;
const RATE_LIMIT_RETRIES = 3;
const RATE_LIMIT_RETRY_DELAY_MS = 60_000;

/**
 * Custom error class for API failures.
 */
export class ApiError extends Error {
  /**
   * @param {number} status - HTTP status code (0 for network/timeout errors)
   * @param {string} message - Human-readable error description
   * @param {boolean} retryable - Whether the error is worth retrying
   */
  constructor(status, message, retryable) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.message = message;
    this.retryable = retryable;
  }
}

/**
 * Delays execution for the specified duration.
 * @param {number} ms - Milliseconds to wait
 * @returns {Promise<void>}
 */
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetches data from the football-data.org API.
 *
 * @param {string} endpoint - API path (e.g., '/v4/competitions/WC/matches')
 * @param {object} [params={}] - Query parameters
 * @returns {Promise<object>} Parsed JSON response
 * @throws {ApiError} On HTTP errors, timeouts, or rate limit exhaustion
 */
export async function fetchFromApi(endpoint, params = {}) {
  const apiKey = process.env.FOOTBALL_DATA_API_KEY;

  if (!apiKey) {
    throw new ApiError(0, 'API key is not configured (FOOTBALL_DATA_API_KEY is missing or empty)', false);
  }

  const url = buildUrl(endpoint, params);
  const headers = {
    'X-Auth-Token': apiKey,
  };

  let lastError;

  // Outer loop handles 429 retries
  for (let rateLimitAttempt = 0; rateLimitAttempt <= RATE_LIMIT_RETRIES; rateLimitAttempt++) {
    if (rateLimitAttempt > 0) {
      await delay(RATE_LIMIT_RETRY_DELAY_MS);
    }

    // Inner loop handles timeout retries
    for (let timeoutAttempt = 0; timeoutAttempt <= TIMEOUT_RETRIES; timeoutAttempt++) {
      if (timeoutAttempt > 0) {
        await delay(TIMEOUT_RETRY_DELAY_MS);
      }

      try {
        await acquireSlot();

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

        let response;
        try {
          response = await fetch(url.toString(), {
            headers,
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timeoutId);
        }

        recordRequest();

        // Handle 403 - no retry
        if (response.status === 403) {
          throw new ApiError(
            403,
            'Authentication failure: invalid or expired API key',
            false
          );
        }

        // Handle 429 - break inner loop to trigger rate limit retry
        if (response.status === 429) {
          lastError = new ApiError(
            429,
            'Rate limit exceeded (HTTP 429)',
            true
          );
          break; // Break timeout loop, continue rate limit loop
        }

        // Handle other HTTP errors
        if (!response.ok) {
          const body = await readResponseBody(response);
          throw new ApiError(
            response.status,
            `HTTP ${response.status}: ${body}`,
            response.status >= 500
          );
        }

        // Parse JSON response
        let data;
        try {
          data = await response.json();
        } catch (parseError) {
          const text = await readResponseBody(response).catch(() => 'Unable to read response body');
          throw new ApiError(
            0,
            `Failed to parse JSON response: ${text.slice(0, 512)}`,
            false
          );
        }

        return data;
      } catch (error) {
        // Re-throw ApiErrors (non-retryable ones)
        if (error instanceof ApiError && !error.retryable) {
          throw error;
        }

        // Handle 429 ApiError - break to rate limit retry loop
        if (error instanceof ApiError && error.status === 429) {
          lastError = error;
          break;
        }

        // Handle abort/timeout errors
        if (error.name === 'AbortError' || error.name === 'TimeoutError') {
          lastError = new ApiError(
            0,
            `Request timeout after ${TIMEOUT_MS}ms`,
            true
          );
          // Continue timeout retry loop
          continue;
        }

        // Handle network errors
        if (error instanceof TypeError || error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
          lastError = new ApiError(
            0,
            `Network error: ${error.message}`,
            true
          );
          // Treat network errors like timeouts for retry purposes
          continue;
        }

        // Re-throw unexpected ApiErrors (e.g., 5xx)
        if (error instanceof ApiError) {
          throw error;
        }

        // Unexpected errors
        lastError = new ApiError(
          0,
          `Unexpected error: ${error.message}`,
          false
        );
        throw lastError;
      }
    }

    // If we broke out of the timeout loop due to 429, continue rate limit loop
    if (lastError && lastError.status === 429 && rateLimitAttempt < RATE_LIMIT_RETRIES) {
      continue;
    }

    // If we exhausted timeout retries (not a 429), throw
    if (lastError && lastError.status !== 429) {
      throw lastError;
    }
  }

  // Exhausted all rate limit retries
  throw new ApiError(
    429,
    `Rate limit exceeded after ${RATE_LIMIT_RETRIES} retry attempts`,
    false
  );
}

/**
 * Builds the full URL with query parameters.
 * @param {string} endpoint - API path
 * @param {object} params - Query parameters
 * @returns {URL}
 */
function buildUrl(endpoint, params) {
  const url = new URL(endpoint, BASE_URL);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value));
    }
  }
  return url;
}

/**
 * Reads response body as text, truncated to 1024 characters.
 * @param {Response} response
 * @returns {Promise<string>}
 */
async function readResponseBody(response) {
  try {
    const text = await response.text();
    return text.slice(0, 1024);
  } catch {
    return 'Unable to read response body';
  }
}
