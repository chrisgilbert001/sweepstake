/**
 * Sync Scheduler
 *
 * Manages timing of sync executions, prevents overlapping runs,
 * and handles graceful shutdown. Uses setInterval/setTimeout for scheduling.
 */

import { executeSyncCycle } from './syncService.js';

/** Default interval between syncs: 1 hour */
const DEFAULT_INTERVAL_MS = 3600000;

/** Default initial delay before first sync: 5 seconds */
const DEFAULT_INITIAL_DELAY_MS = 5000;

/** Minimum allowed interval: 1 minute */
const MIN_INTERVAL_MS = 60000;

/** Maximum allowed interval: 24 hours */
const MAX_INTERVAL_MS = 86400000;

/** Timer reference for the initial delay timeout */
let initialTimer = null;

/** Timer reference for the repeating interval */
let intervalTimer = null;

/** Whether a sync is currently in progress */
let syncInProgress = false;

/** Promise that resolves when the current sync completes (used for graceful shutdown) */
let currentSyncPromise = null;

/** Whether the scheduler has been started */
let schedulerRunning = false;

/**
 * Reads and validates the SYNC_INTERVAL_MS environment variable.
 * Returns the validated interval or the default if invalid.
 *
 * @returns {number} Validated interval in milliseconds
 */
export function getValidatedInterval() {
  const envValue = process.env.SYNC_INTERVAL_MS;

  if (envValue === undefined || envValue === null || envValue === '') {
    return DEFAULT_INTERVAL_MS;
  }

  const parsed = Number(envValue);

  // Must be a finite integer within the valid range
  if (
    !Number.isFinite(parsed) ||
    !Number.isInteger(parsed) ||
    parsed < MIN_INTERVAL_MS ||
    parsed > MAX_INTERVAL_MS
  ) {
    console.warn(
      `[SyncScheduler] Invalid SYNC_INTERVAL_MS value "${envValue}". ` +
      `Must be an integer between ${MIN_INTERVAL_MS} and ${MAX_INTERVAL_MS}. ` +
      `Falling back to default ${DEFAULT_INTERVAL_MS}ms.`
    );
    return DEFAULT_INTERVAL_MS;
  }

  return parsed;
}

/**
 * Executes a sync cycle with overlap protection.
 * If a sync is already in progress, skips execution and logs the reason.
 *
 * @returns {Promise<void>}
 */
async function executeWithOverlapProtection() {
  if (syncInProgress) {
    console.warn(
      '[SyncScheduler] Skipping scheduled sync: previous sync still in progress'
    );
    return;
  }

  syncInProgress = true;
  currentSyncPromise = executeSyncCycle()
    .then((result) => {
      console.log(
        `[SyncScheduler] Sync cycle completed: ${result.outcome}`
      );
    })
    .catch((error) => {
      console.error(
        `[SyncScheduler] Sync cycle error: ${error.message || error}`
      );
    })
    .finally(() => {
      syncInProgress = false;
      currentSyncPromise = null;
    });

  await currentSyncPromise;
}

/**
 * Starts the sync scheduler.
 *
 * Schedules the first sync after an initial delay (default 5s),
 * then repeats at the configured interval (default 1 hour).
 *
 * @param {object} [options]
 * @param {number} [options.intervalMs] - Interval between syncs (overrides env var)
 * @param {number} [options.initialDelayMs=5000] - Delay before first sync
 */
export function startScheduler(options = {}) {
  if (schedulerRunning) {
    console.warn('[SyncScheduler] Scheduler is already running');
    return;
  }

  const intervalMs = options.intervalMs ?? getValidatedInterval();
  const initialDelayMs = options.initialDelayMs ?? DEFAULT_INITIAL_DELAY_MS;

  schedulerRunning = true;

  console.log(
    `[SyncScheduler] Starting scheduler: initial delay ${initialDelayMs}ms, ` +
    `interval ${intervalMs}ms`
  );

  // Schedule the first sync after the initial delay
  initialTimer = setTimeout(() => {
    initialTimer = null;
    executeWithOverlapProtection();

    // Set up the repeating interval
    intervalTimer = setInterval(() => {
      executeWithOverlapProtection();
    }, intervalMs);
  }, initialDelayMs);
}

/**
 * Stops the scheduler and waits for any in-progress sync to complete.
 *
 * @returns {Promise<void>}
 */
export async function stopScheduler() {
  if (!schedulerRunning) {
    return;
  }

  schedulerRunning = false;

  // Cancel the initial delay timer if it hasn't fired yet
  if (initialTimer !== null) {
    clearTimeout(initialTimer);
    initialTimer = null;
  }

  // Cancel the repeating interval
  if (intervalTimer !== null) {
    clearInterval(intervalTimer);
    intervalTimer = null;
  }

  // Wait for any in-progress sync to complete
  if (currentSyncPromise) {
    console.log('[SyncScheduler] Waiting for in-progress sync to complete...');
    await currentSyncPromise;
  }

  console.log('[SyncScheduler] Scheduler stopped');
}

/**
 * Returns whether a sync is currently in progress.
 *
 * @returns {boolean}
 */
export function isSyncInProgress() {
  return syncInProgress;
}

/**
 * Triggers an immediate sync (for admin endpoint).
 *
 * @returns {Promise<import('./syncService.js').SyncResult>}
 * @throws {Error} If sync already in progress
 */
export async function triggerManualSync() {
  if (syncInProgress) {
    throw new Error('Sync already in progress');
  }

  syncInProgress = true;
  try {
    const result = await executeSyncCycle();
    return result;
  } finally {
    syncInProgress = false;
    currentSyncPromise = null;
  }
}
