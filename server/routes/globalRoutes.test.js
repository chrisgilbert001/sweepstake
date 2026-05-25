import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import globalRoutes from './globalRoutes.js';

vi.mock('../services/fixtureService.js', () => ({
  getFixtures: vi.fn()
}));

vi.mock('../services/matchService.js', () => ({
  getResults: vi.fn()
}));

vi.mock('../services/oddsService.js', () => ({
  getTournamentOdds: vi.fn(),
  getMatchOdds: vi.fn()
}));

vi.mock('../services/bracketService.js', () => ({
  getBracketData: vi.fn()
}));

vi.mock('../services/groupService.js', () => ({
  getGroupStandings: vi.fn()
}));

import { getFixtures } from '../services/fixtureService.js';
import { getResults } from '../services/matchService.js';
import { getTournamentOdds, getMatchOdds } from '../services/oddsService.js';
import { getBracketData } from '../services/bracketService.js';
import { getGroupStandings } from '../services/groupService.js';

function createApp() {
  const app = express();
  app.use('/api', globalRoutes);
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    const status = err.statusCode || err.status || 500;
    const message = err.message || 'Internal server error';
    res.status(status).json({ error: message });
  });
  return app;
}

describe('GET /api/fixtures', () => {
  let app;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createApp();
  });

  it('returns all fixtures', async () => {
    const mockFixtures = [
      { id: 'f001', homeTeam: 'usa', awayTeam: 'ger', date: '2026-06-11T18:00:00Z', stage: 'Group Stage', status: 'scheduled' }
    ];
    getFixtures.mockResolvedValue(mockFixtures);

    const res = await request(app).get('/api/fixtures');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockFixtures);
  });

  it('returns 500 when service throws', async () => {
    getFixtures.mockRejectedValue(new Error('File read error'));

    const res = await request(app).get('/api/fixtures');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'File read error' });
  });
});

describe('GET /api/results', () => {
  let app;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createApp();
  });

  it('returns all match results', async () => {
    const mockResults = [
      { id: 'r001', fixtureId: 'f001', homeTeam: 'usa', awayTeam: 'ger', homeScore: 2, awayScore: 1, stage: 'Group Stage' }
    ];
    getResults.mockResolvedValue(mockResults);

    const res = await request(app).get('/api/results');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockResults);
  });

  it('returns 500 when service throws', async () => {
    getResults.mockRejectedValue(new Error('Storage error'));

    const res = await request(app).get('/api/results');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Storage error' });
  });
});

describe('GET /api/odds/tournament', () => {
  let app;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createApp();
  });

  it('returns tournament odds', async () => {
    const mockOdds = { capturedAt: '2026-06-10T00:00:00Z', odds: { usa: 5.5, ger: 7.0 } };
    getTournamentOdds.mockResolvedValue(mockOdds);

    const res = await request(app).get('/api/odds/tournament');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockOdds);
  });

  it('returns null when no odds set', async () => {
    getTournamentOdds.mockResolvedValue(null);

    const res = await request(app).get('/api/odds/tournament');

    expect(res.status).toBe(200);
    expect(res.body).toBeNull();
  });

  it('returns 500 when service throws', async () => {
    getTournamentOdds.mockRejectedValue(new Error('Read error'));

    const res = await request(app).get('/api/odds/tournament');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Read error' });
  });
});

describe('GET /api/odds/match/:fixtureId', () => {
  let app;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createApp();
  });

  it('returns match odds for a fixture', async () => {
    const mockOdds = { usa: 1.85, ger: 3.40, draw: 3.60 };
    getMatchOdds.mockResolvedValue(mockOdds);

    const res = await request(app).get('/api/odds/match/f001');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockOdds);
    expect(getMatchOdds).toHaveBeenCalledWith('f001');
  });

  it('returns null when no odds set for fixture', async () => {
    getMatchOdds.mockResolvedValue(null);

    const res = await request(app).get('/api/odds/match/f999');

    expect(res.status).toBe(200);
    expect(res.body).toBeNull();
  });

  it('returns 500 when service throws', async () => {
    getMatchOdds.mockRejectedValue(new Error('Read error'));

    const res = await request(app).get('/api/odds/match/f001');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Read error' });
  });
});

describe('GET /api/groups', () => {
  let app;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createApp();
  });

  it('returns group standings', async () => {
    const mockStandings = [
      {
        group: 'A',
        teams: [
          { teamId: 'mex', teamName: 'Mexico', played: 3, won: 2, drawn: 1, lost: 0, goalsFor: 5, goalsAgainst: 2, goalDifference: 3, points: 7 },
          { teamId: 'rsa', teamName: 'South Africa', played: 3, won: 1, drawn: 1, lost: 1, goalsFor: 3, goalsAgainst: 3, goalDifference: 0, points: 4 },
          { teamId: 'kor', teamName: 'South Korea', played: 3, won: 1, drawn: 0, lost: 2, goalsFor: 2, goalsAgainst: 4, goalDifference: -2, points: 3 },
          { teamId: 'cze', teamName: 'Czech Republic', played: 3, won: 0, drawn: 2, lost: 1, goalsFor: 1, goalsAgainst: 2, goalDifference: -1, points: 2 }
        ]
      }
    ];
    getGroupStandings.mockResolvedValue(mockStandings);

    const res = await request(app).get('/api/groups');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockStandings);
  });

  it('returns 500 when service throws', async () => {
    getGroupStandings.mockRejectedValue(new Error('File read error'));

    const res = await request(app).get('/api/groups');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'File read error' });
  });
});

describe('GET /api/bracket', () => {
  let app;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createApp();
  });

  it('returns bracket data with rounds', async () => {
    const mockBracket = {
      rounds: [
        {
          name: 'Round of 16',
          fixtures: [
            {
              fixtureId: 'f010',
              position: 0,
              homeTeam: 'usa',
              awayTeam: 'ger',
              homeScore: 2,
              awayScore: 1,
              winner: 'usa'
            }
          ]
        },
        {
          name: 'Quarter-finals',
          fixtures: [
            {
              fixtureId: 'f020',
              position: 0,
              homeTeam: 'usa',
              awayTeam: 'TBD'
            }
          ]
        }
      ]
    };
    getBracketData.mockResolvedValue(mockBracket);

    const res = await request(app).get('/api/bracket');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockBracket);
    expect(res.body.rounds).toHaveLength(2);
    expect(res.body.rounds[0].name).toBe('Round of 16');
  });

  it('returns empty rounds when no knockout fixtures exist', async () => {
    const mockBracket = {
      rounds: [
        { name: 'Round of 32', fixtures: [] },
        { name: 'Round of 16', fixtures: [] },
        { name: 'Quarter-finals', fixtures: [] },
        { name: 'Semi-finals', fixtures: [] },
        { name: 'Final', fixtures: [] }
      ]
    };
    getBracketData.mockResolvedValue(mockBracket);

    const res = await request(app).get('/api/bracket');

    expect(res.status).toBe(200);
    expect(res.body.rounds).toHaveLength(5);
    expect(res.body.rounds.every(r => r.fixtures.length === 0)).toBe(true);
  });

  it('returns 500 when service throws', async () => {
    getBracketData.mockRejectedValue(new Error('Storage error'));

    const res = await request(app).get('/api/bracket');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Storage error' });
  });
});
