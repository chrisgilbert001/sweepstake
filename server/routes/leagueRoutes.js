import { Router } from 'express';
import {
  createLeague,
  getLeague,
  getLeagueByJoinCode,
  addParticipant,
  getLeaguesByEmail,
  markDraftSeen
} from '../services/leagueService.js';
import { getPointsHistory } from '../services/pointsHistoryService.js';
import { generateStandingsText } from '../services/exportService.js';

const router = Router();

/**
 * POST /api/leagues
 * Create a new league.
 * Body: { "name": "League Name", "email": "creator@example.com" }
 */
router.post('/leagues', async (req, res, next) => {
  try {
    const { name, email } = req.body;
    const league = await createLeague(name, email);
    res.status(201).json(league);
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    next(err);
  }
});

/**
 * GET /api/leagues/:slug
 * Get league details (standings, teams, allocations).
 */
router.get('/leagues/:slug', async (req, res, next) => {
  try {
    const league = await getLeague(req.params.slug);
    res.json(league);
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    next(err);
  }
});

/**
 * POST /api/leagues/:slug/participants
 * Add a participant to a league.
 * Body: { "name": "Participant Name", "email": "user@example.com" }
 */
router.post('/leagues/:slug/participants', async (req, res, next) => {
  try {
    const { name, email } = req.body;
    const league = await addParticipant(req.params.slug, name, email);
    res.status(201).json(league);
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    next(err);
  }
});

/**
 * GET /api/leagues/join/:joinCode
 * Get league info via join link (so user can see the league before joining).
 */
router.get('/leagues/join/:joinCode', async (req, res, next) => {
  try {
    const league = await getLeagueByJoinCode(req.params.joinCode);
    res.json(league);
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    next(err);
  }
});

/**
 * POST /api/leagues/join/:joinCode
 * Join a league via join link. Adds a participant to the league found by join code.
 * Body: { "name": "Participant Name", "email": "user@example.com" }
 */
router.post('/leagues/join/:joinCode', async (req, res, next) => {
  try {
    const { name, email } = req.body;
    const league = await getLeagueByJoinCode(req.params.joinCode);
    const updated = await addParticipant(league.slug, name, email);
    res.status(201).json(updated);
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    next(err);
  }
});

/**
 * GET /api/me/:email/leagues
 * Get all leagues that a user (by email) belongs to.
 */
router.get('/me/:email/leagues', async (req, res, next) => {
  try {
    const leagues = await getLeaguesByEmail(req.params.email);
    res.json(leagues);
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    next(err);
  }
});

/**
 * POST /api/leagues/:slug/draft-seen
 * Mark the draft reveal as seen for a participant (by email).
 * Body: { "email": "user@example.com" }
 */
router.post('/leagues/:slug/draft-seen', async (req, res, next) => {
  try {
    const { email } = req.body;
    const league = await markDraftSeen(req.params.slug, email);
    res.json(league);
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    next(err);
  }
});

/**
 * GET /api/leagues/:slug/points-history
 * Get cumulative points history for all participants in a league.
 */
router.get('/leagues/:slug/points-history', async (req, res, next) => {
  try {
    const history = await getPointsHistory(req.params.slug);
    res.json(history);
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    next(err);
  }
});

/**
 * GET /api/leagues/:slug/standings/export
 * Returns a plain-text summary of the league standings.
 */
router.get('/leagues/:slug/standings/export', async (req, res, next) => {
  try {
    const text = await generateStandingsText(req.params.slug);
    res.setHeader('Content-Type', 'text/plain');
    res.send(text);
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    next(err);
  }
});

export default router;
