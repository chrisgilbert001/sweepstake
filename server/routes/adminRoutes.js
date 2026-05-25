import { Router } from 'express';
import { adminAuth } from '../middleware/adminAuth.js';
import { addResult, updateResult } from '../services/matchService.js';
import { setTournamentOdds, setMatchOdds } from '../services/oddsService.js';
import { addFixture, updateFixture } from '../services/fixtureService.js';
import { readFile, writeFile } from '../services/storageService.js';
import { triggerManualSync, isSyncInProgress } from '../services/sync/syncScheduler.js';

const router = Router();

// Track last manual trigger timestamp for 60s cooldown
let lastManualTriggerTime = 0;

// Cooldown period in milliseconds
const MANUAL_TRIGGER_COOLDOWN_MS = 60000;

/**
 * Reset the manual trigger cooldown (for testing only).
 */
export function _resetManualTriggerCooldown() {
  lastManualTriggerTime = 0;
}

// Apply admin auth middleware to all routes in this router
router.use(adminAuth);

/**
 * POST /api/admin/results
 * Enter a match result.
 */
router.post('/results', async (req, res, next) => {
  try {
    const result = await addResult(req.body);
    res.status(201).json(result);
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    next(err);
  }
});

/**
 * PUT /api/admin/results/:id
 * Update/correct a match result.
 */
router.put('/results/:id', async (req, res, next) => {
  try {
    const result = await updateResult(req.params.id, req.body);
    res.json(result);
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    next(err);
  }
});

/**
 * POST /api/admin/odds/tournament
 * Enter tournament odds snapshot.
 */
router.post('/odds/tournament', async (req, res, next) => {
  try {
    const odds = await setTournamentOdds(req.body);
    res.status(201).json(odds);
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    next(err);
  }
});

/**
 * POST /api/admin/odds/match
 * Enter match odds for a fixture.
 */
router.post('/odds/match', async (req, res, next) => {
  try {
    const { fixtureId, odds } = req.body;
    const result = await setMatchOdds(fixtureId, odds);
    res.status(201).json(result);
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    next(err);
  }
});

/**
 * POST /api/admin/fixtures
 * Add a fixture.
 */
router.post('/fixtures', async (req, res, next) => {
  try {
    const fixture = await addFixture(req.body);
    res.status(201).json(fixture);
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    next(err);
  }
});

/**
 * PUT /api/admin/fixtures/:id
 * Edit a fixture.
 */
router.put('/fixtures/:id', async (req, res, next) => {
  try {
    const fixture = await updateFixture(req.params.id, req.body);
    res.json(fixture);
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    next(err);
  }
});

/**
 * GET /api/admin/sync/status
 * Return the latest sync-status.json entry.
 * If no sync has run, returns { outcome: "not_run", timestamp: null }.
 */
router.get('/sync/status', async (req, res, next) => {
  try {
    const syncStatus = await readFile('sync-status.json');
    const lastSync = syncStatus.lastSync;
    res.json(lastSync);
  } catch (err) {
    // If file doesn't exist or is unreadable, return default not_run state
    if (err.statusCode === 500 && err.message === 'File not found') {
      return res.json({ outcome: 'not_run', timestamp: null });
    }
    next(err);
  }
});

/**
 * POST /api/admin/sync/trigger
 * Trigger an immediate sync execution.
 * Rejects with 429 if called within 60s of previous manual trigger.
 * Rejects with 409 if a sync is already in progress.
 */
router.post('/sync/trigger', async (req, res, next) => {
  try {
    // Check 60s cooldown
    const now = Date.now();
    const elapsed = now - lastManualTriggerTime;
    if (lastManualTriggerTime > 0 && elapsed < MANUAL_TRIGGER_COOLDOWN_MS) {
      const retryAfter = Math.ceil((MANUAL_TRIGGER_COOLDOWN_MS - elapsed) / 1000);
      return res.status(429).json({
        error: `Manual sync can only be triggered once every 60 seconds. Try again in ${retryAfter}s.`
      });
    }

    // Check if sync is already in progress
    if (isSyncInProgress()) {
      return res.status(409).json({ error: 'A sync is already in progress' });
    }

    // Record the trigger time and start the sync
    lastManualTriggerTime = now;
    const result = await triggerManualSync();
    res.json(result);
  } catch (err) {
    if (err.message === 'Sync already in progress') {
      return res.status(409).json({ error: 'A sync is already in progress' });
    }
    next(err);
  }
});

/**
 * POST /api/admin/reset/fixtures
 * Clear all fixtures. Requires admin token.
 */
router.post('/reset/fixtures', async (req, res, next) => {
  try {
    await writeFile('fixtures.json', { fixtures: [] });
    res.json({ message: 'Fixtures cleared' });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/admin/reset/results
 * Clear all results. Requires admin token.
 */
router.post('/reset/results', async (req, res, next) => {
  try {
    await writeFile('results.json', { results: [] });
    res.json({ message: 'Results cleared' });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/admin/reset/all
 * Clear fixtures and results (but NEVER leagues). Requires admin token.
 */
router.post('/reset/all', async (req, res, next) => {
  try {
    await writeFile('fixtures.json', { fixtures: [] });
    await writeFile('results.json', { results: [] });
    res.json({ message: 'Fixtures and results cleared. Leagues are untouched.' });
  } catch (err) {
    next(err);
  }
});

export default router;
