import { Router } from 'express';
import { startDraft, getDraftState, spinWheel } from '../services/draftService.js';
import { getLeague } from '../services/leagueService.js';

const router = Router();

/**
 * POST /api/leagues/:slug/draft/start
 * Initiate the snake draft for a league.
 * Requires exactly 6 participants. Randomizes draft order.
 */
router.post('/leagues/:slug/draft/start', async (req, res, next) => {
  try {
    // Verify league exists first
    await getLeague(req.params.slug);
    const league = await startDraft(req.params.slug);
    res.json(league.draft);
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    next(err);
  }
});

/**
 * GET /api/leagues/:slug/draft/state
 * Get the current draft state including order, progress, and available teams.
 */
router.get('/leagues/:slug/draft/state', async (req, res, next) => {
  try {
    // Verify league exists first
    await getLeague(req.params.slug);
    const state = await getDraftState(req.params.slug);
    res.json(state);
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    next(err);
  }
});

/**
 * POST /api/leagues/:slug/draft/spin
 * Trigger a wheel spin. Server selects a random team from the available pool
 * in the current pot and assigns it to the current participant.
 */
router.post('/leagues/:slug/draft/spin', async (req, res, next) => {
  try {
    // Verify league exists first
    await getLeague(req.params.slug);
    const result = await spinWheel(req.params.slug);
    res.json(result);
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    next(err);
  }
});

export default router;
