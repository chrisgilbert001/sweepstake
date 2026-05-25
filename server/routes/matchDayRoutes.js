import { Router } from 'express';
import { getFixturesForDate, getFixturesForWeek } from '../services/matchDayService.js';

const router = Router();

/**
 * GET /api/fixtures/today
 * Returns fixtures for the current day, sorted by date ascending.
 */
router.get('/fixtures/today', async (req, res, next) => {
  try {
    const today = new Date().toISOString();
    const fixtures = await getFixturesForDate(today);
    res.json(fixtures);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/fixtures/week
 * Returns fixtures for the current week (Monday–Sunday), sorted by date ascending.
 */
router.get('/fixtures/week', async (req, res, next) => {
  try {
    const today = new Date().toISOString();
    const fixtures = await getFixturesForWeek(today);
    res.json(fixtures);
  } catch (err) {
    next(err);
  }
});

export default router;
