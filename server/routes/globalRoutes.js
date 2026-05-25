import { Router } from 'express';
import { getFixtures } from '../services/fixtureService.js';
import { getResults } from '../services/matchService.js';
import { getTournamentOdds, getMatchOdds } from '../services/oddsService.js';
import { getBracketData } from '../services/bracketService.js';
import { getGroupStandings } from '../services/groupService.js';

const router = Router();

/**
 * GET /api/fixtures
 * Returns all fixtures sorted by date ascending.
 */
router.get('/fixtures', async (req, res, next) => {
  try {
    const fixtures = await getFixtures();
    res.json(fixtures);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/results
 * Returns all match results.
 */
router.get('/results', async (req, res, next) => {
  try {
    const results = await getResults();
    res.json(results);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/odds/tournament
 * Returns tournament odds snapshot.
 */
router.get('/odds/tournament', async (req, res, next) => {
  try {
    const odds = await getTournamentOdds();
    res.json(odds);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/odds/match/:fixtureId
 * Returns match odds for a specific fixture.
 */
router.get('/odds/match/:fixtureId', async (req, res, next) => {
  try {
    const odds = await getMatchOdds(req.params.fixtureId);
    res.json(odds);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/groups
 * Returns group stage standings for all 12 groups.
 */
router.get('/groups', async (req, res, next) => {
  try {
    const standings = await getGroupStandings();
    res.json(standings);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/bracket
 * Returns the knockout bracket structure with all rounds, fixtures, scores, and team placements.
 */
router.get('/bracket', async (req, res, next) => {
  try {
    const bracket = await getBracketData();
    res.json(bracket);
  } catch (err) {
    next(err);
  }
});

export default router;
