import { Router } from 'express';
import { getActivityFeed } from '../services/activityService.js';

const router = Router();

/**
 * GET /api/leagues/:slug/activity
 * Returns paginated activity feed events for a league.
 * Query params:
 *   - page (default: 1) — must be a positive integer
 *   - limit (default: 50) — events per page
 */
router.get('/leagues/:slug/activity', async (req, res, next) => {
  try {
    const { slug } = req.params;
    const page = req.query.page !== undefined ? Number(req.query.page) : 1;
    const limit = req.query.limit !== undefined ? Number(req.query.limit) : 50;

    if (!Number.isFinite(page) || page < 1 || Math.floor(page) !== page) {
      return res.status(400).json({ error: 'Invalid page number' });
    }

    const result = await getActivityFeed(slug, page, limit);
    res.json(result);
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    next(err);
  }
});

export default router;
