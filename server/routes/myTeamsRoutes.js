import { Router } from 'express';
import { getMyTeamsData } from '../services/myTeamsService.js';

const router = Router();

/**
 * GET /api/leagues/:slug/my-teams/:participantId
 * Get the "My Teams" dashboard data for a specific participant in a league.
 */
router.get('/leagues/:slug/my-teams/:participantId', async (req, res, next) => {
  try {
    const { slug, participantId } = req.params;
    const data = await getMyTeamsData(slug, participantId);
    res.json(data);
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    next(err);
  }
});

export default router;
