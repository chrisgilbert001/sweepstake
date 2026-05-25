import { Router } from 'express';
import { getAllTeams } from '../services/teamService.js';

const router = Router();

/**
 * GET /api/teams
 * Returns all teams with pot assignments.
 */
router.get('/', async (req, res, next) => {
  try {
    const teams = await getAllTeams();
    res.json(teams);
  } catch (err) {
    next(err);
  }
});

export default router;
