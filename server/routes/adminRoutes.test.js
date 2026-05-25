import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import adminRoutes, { _resetManualTriggerCooldown } from './adminRoutes.js';

vi.mock('../services/matchService.js', () => ({
  addResult: vi.fn(),
  updateResult: vi.fn()
}));

vi.mock('../services/oddsService.js', () => ({
  setTournamentOdds: vi.fn(),
  setMatchOdds: vi.fn()
}));

vi.mock('../services/fixtureService.js', () => ({
  addFixture: vi.fn(),
  updateFixture: vi.fn()
}));

import { addResult, updateResult } from '../services/matchService.js';
import { setTournamentOdds, setMatchOdds } from '../services/oddsService.js';
import { addFixture, updateFixture } from '../services/fixtureService.js';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/admin', adminRoutes);
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    const status = err.statusCode || err.status || 500;
    const message = err.message || 'Internal server error';
    res.status(status).json({ error: message });
  });
  return app;
}

describe('Admin Routes - Authentication', () => {
  const originalToken = process.env.ADMIN_TOKEN;

  afterEach(() => {
    if (originalToken !== undefined) {
      process.env.ADMIN_TOKEN = originalToken;
    } else {
      delete process.env.ADMIN_TOKEN;
    }
  });

  it('returns 401 for all routes without auth token', async () => {
    process.env.ADMIN_TOKEN = 'test-token';
    const app = createApp();

    const res = await request(app).post('/api/admin/results');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Unauthorized' });
  });

  it('returns 401 with invalid token', async () => {
    process.env.ADMIN_TOKEN = 'test-token';
    const app = createApp();

    const res = await request(app)
      .post('/api/admin/results')
      .set('Authorization', 'Bearer wrong-token');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Unauthorized' });
  });
});

describe('POST /api/admin/results', () => {
  let app;
  const originalToken = process.env.ADMIN_TOKEN;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ADMIN_TOKEN = 'test-token';
    app = createApp();
  });

  afterEach(() => {
    if (originalToken !== undefined) {
      process.env.ADMIN_TOKEN = originalToken;
    } else {
      delete process.env.ADMIN_TOKEN;
    }
  });

  it('creates a match result and returns 201', async () => {
    const mockResult = { id: 'r001', homeTeam: 'usa', awayTeam: 'ger', homeScore: 2, awayScore: 1, stage: 'Group Stage' };
    addResult.mockResolvedValue(mockResult);

    const res = await request(app)
      .post('/api/admin/results')
      .set('Authorization', 'Bearer test-token')
      .send({ homeTeam: 'usa', awayTeam: 'ger', homeScore: 2, awayScore: 1, stage: 'Group Stage' });

    expect(res.status).toBe(201);
    expect(res.body).toEqual(mockResult);
  });

  it('returns 400 when service throws validation error', async () => {
    addResult.mockRejectedValue({ statusCode: 400, message: 'Scores must be non-negative integers' });

    const res = await request(app)
      .post('/api/admin/results')
      .set('Authorization', 'Bearer test-token')
      .send({ homeTeam: 'usa', awayTeam: 'ger', homeScore: -1, awayScore: 1, stage: 'Group Stage' });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Scores must be non-negative integers' });
  });
});

describe('PUT /api/admin/results/:id', () => {
  let app;
  const originalToken = process.env.ADMIN_TOKEN;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ADMIN_TOKEN = 'test-token';
    app = createApp();
  });

  afterEach(() => {
    if (originalToken !== undefined) {
      process.env.ADMIN_TOKEN = originalToken;
    } else {
      delete process.env.ADMIN_TOKEN;
    }
  });

  it('updates a match result and returns 200', async () => {
    const mockResult = { id: 'r001', homeTeam: 'usa', awayTeam: 'ger', homeScore: 3, awayScore: 1, stage: 'Group Stage' };
    updateResult.mockResolvedValue(mockResult);

    const res = await request(app)
      .put('/api/admin/results/r001')
      .set('Authorization', 'Bearer test-token')
      .send({ homeTeam: 'usa', awayTeam: 'ger', homeScore: 3, awayScore: 1, stage: 'Group Stage' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockResult);
    expect(updateResult).toHaveBeenCalledWith('r001', expect.any(Object));
  });

  it('returns 404 when result not found', async () => {
    updateResult.mockRejectedValue({ statusCode: 404, message: 'Result not found' });

    const res = await request(app)
      .put('/api/admin/results/r999')
      .set('Authorization', 'Bearer test-token')
      .send({ homeTeam: 'usa', awayTeam: 'ger', homeScore: 1, awayScore: 0, stage: 'Group Stage' });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Result not found' });
  });
});

describe('POST /api/admin/odds/tournament', () => {
  let app;
  const originalToken = process.env.ADMIN_TOKEN;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ADMIN_TOKEN = 'test-token';
    app = createApp();
  });

  afterEach(() => {
    if (originalToken !== undefined) {
      process.env.ADMIN_TOKEN = originalToken;
    } else {
      delete process.env.ADMIN_TOKEN;
    }
  });

  it('sets tournament odds and returns 201', async () => {
    const mockSnapshot = { capturedAt: '2026-06-10T00:00:00Z', odds: { usa: 5.5 } };
    setTournamentOdds.mockResolvedValue(mockSnapshot);

    const res = await request(app)
      .post('/api/admin/odds/tournament')
      .set('Authorization', 'Bearer test-token')
      .send({ usa: 5.5 });

    expect(res.status).toBe(201);
    expect(res.body).toEqual(mockSnapshot);
  });

  it('returns 400 when odds already set', async () => {
    setTournamentOdds.mockRejectedValue({ statusCode: 400, message: 'Tournament odds already set' });

    const res = await request(app)
      .post('/api/admin/odds/tournament')
      .set('Authorization', 'Bearer test-token')
      .send({ usa: 5.5 });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Tournament odds already set' });
  });
});

describe('POST /api/admin/odds/match', () => {
  let app;
  const originalToken = process.env.ADMIN_TOKEN;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ADMIN_TOKEN = 'test-token';
    app = createApp();
  });

  afterEach(() => {
    if (originalToken !== undefined) {
      process.env.ADMIN_TOKEN = originalToken;
    } else {
      delete process.env.ADMIN_TOKEN;
    }
  });

  it('sets match odds and returns 201', async () => {
    const mockOdds = { usa: 1.85, ger: 3.40, draw: 3.60 };
    setMatchOdds.mockResolvedValue(mockOdds);

    const res = await request(app)
      .post('/api/admin/odds/match')
      .set('Authorization', 'Bearer test-token')
      .send({ fixtureId: 'f001', odds: { usa: 1.85, ger: 3.40, draw: 3.60 } });

    expect(res.status).toBe(201);
    expect(res.body).toEqual(mockOdds);
    expect(setMatchOdds).toHaveBeenCalledWith('f001', { usa: 1.85, ger: 3.40, draw: 3.60 });
  });

  it('returns 400 when odds validation fails', async () => {
    setMatchOdds.mockRejectedValue({ statusCode: 400, message: 'Odds must be greater than 1.0' });

    const res = await request(app)
      .post('/api/admin/odds/match')
      .set('Authorization', 'Bearer test-token')
      .send({ fixtureId: 'f001', odds: { usa: 0.5 } });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Odds must be greater than 1.0' });
  });
});

describe('POST /api/admin/fixtures', () => {
  let app;
  const originalToken = process.env.ADMIN_TOKEN;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ADMIN_TOKEN = 'test-token';
    app = createApp();
  });

  afterEach(() => {
    if (originalToken !== undefined) {
      process.env.ADMIN_TOKEN = originalToken;
    } else {
      delete process.env.ADMIN_TOKEN;
    }
  });

  it('adds a fixture and returns 201', async () => {
    const mockFixture = { id: 'f001', homeTeam: 'usa', awayTeam: 'ger', date: '2026-06-11T18:00:00Z', stage: 'Group Stage', status: 'scheduled' };
    addFixture.mockResolvedValue(mockFixture);

    const res = await request(app)
      .post('/api/admin/fixtures')
      .set('Authorization', 'Bearer test-token')
      .send({ homeTeam: 'usa', awayTeam: 'ger', date: '2026-06-11T18:00:00Z', stage: 'Group Stage' });

    expect(res.status).toBe(201);
    expect(res.body).toEqual(mockFixture);
  });

  it('returns 400 when fixture validation fails', async () => {
    addFixture.mockRejectedValue({ statusCode: 400, message: 'Both homeTeam and awayTeam are required' });

    const res = await request(app)
      .post('/api/admin/fixtures')
      .set('Authorization', 'Bearer test-token')
      .send({ homeTeam: 'usa' });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Both homeTeam and awayTeam are required' });
  });
});

describe('PUT /api/admin/fixtures/:id', () => {
  let app;
  const originalToken = process.env.ADMIN_TOKEN;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ADMIN_TOKEN = 'test-token';
    app = createApp();
  });

  afterEach(() => {
    if (originalToken !== undefined) {
      process.env.ADMIN_TOKEN = originalToken;
    } else {
      delete process.env.ADMIN_TOKEN;
    }
  });

  it('updates a fixture and returns 200', async () => {
    const mockFixture = { id: 'f001', homeTeam: 'usa', awayTeam: 'bra', date: '2026-06-12T18:00:00Z', stage: 'Group Stage', status: 'scheduled' };
    updateFixture.mockResolvedValue(mockFixture);

    const res = await request(app)
      .put('/api/admin/fixtures/f001')
      .set('Authorization', 'Bearer test-token')
      .send({ homeTeam: 'usa', awayTeam: 'bra', date: '2026-06-12T18:00:00Z', stage: 'Group Stage' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockFixture);
    expect(updateFixture).toHaveBeenCalledWith('f001', expect.any(Object));
  });

  it('returns 404 when fixture not found', async () => {
    updateFixture.mockRejectedValue({ statusCode: 404, message: 'Fixture not found' });

    const res = await request(app)
      .put('/api/admin/fixtures/f999')
      .set('Authorization', 'Bearer test-token')
      .send({ homeTeam: 'usa', awayTeam: 'ger', date: '2026-06-11T18:00:00Z', stage: 'Group Stage' });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Fixture not found' });
  });
});

// --- Sync endpoint tests ---

vi.mock('../services/storageService.js', () => ({
  readFile: vi.fn()
}));

vi.mock('../services/sync/syncScheduler.js', () => ({
  triggerManualSync: vi.fn(),
  isSyncInProgress: vi.fn()
}));

import { readFile } from '../services/storageService.js';
import { triggerManualSync, isSyncInProgress } from '../services/sync/syncScheduler.js';

describe('GET /api/admin/sync/status', () => {
  let app;
  const originalToken = process.env.ADMIN_TOKEN;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ADMIN_TOKEN = 'test-token';
    app = createApp();
  });

  afterEach(() => {
    if (originalToken !== undefined) {
      process.env.ADMIN_TOKEN = originalToken;
    } else {
      delete process.env.ADMIN_TOKEN;
    }
  });

  it('returns the latest sync status entry', async () => {
    const mockStatus = {
      lastSync: {
        timestamp: '2025-06-28T12:00:00.000Z',
        outcome: 'success',
        error: null,
        stats: { fixturesUpdated: 3, resultsCreated: 2, standingsUpdated: true }
      }
    };
    readFile.mockResolvedValue(mockStatus);

    const res = await request(app)
      .get('/api/admin/sync/status')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockStatus.lastSync);
    expect(readFile).toHaveBeenCalledWith('sync-status.json');
  });

  it('returns not_run status when no sync has ever run', async () => {
    const mockStatus = {
      lastSync: {
        timestamp: null,
        outcome: 'not_run',
        error: null,
        stats: { fixturesUpdated: 0, resultsCreated: 0, standingsUpdated: false }
      }
    };
    readFile.mockResolvedValue(mockStatus);

    const res = await request(app)
      .get('/api/admin/sync/status')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(200);
    expect(res.body.outcome).toBe('not_run');
    expect(res.body.timestamp).toBeNull();
  });

  it('returns default not_run when sync-status.json does not exist', async () => {
    readFile.mockRejectedValue({ statusCode: 500, message: 'File not found' });

    const res = await request(app)
      .get('/api/admin/sync/status')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ outcome: 'not_run', timestamp: null });
  });

  it('requires authentication', async () => {
    const res = await request(app)
      .get('/api/admin/sync/status');

    expect(res.status).toBe(401);
  });
});

describe('POST /api/admin/sync/trigger', () => {
  let app;
  const originalToken = process.env.ADMIN_TOKEN;

  beforeEach(() => {
    vi.clearAllMocks();
    _resetManualTriggerCooldown();
    process.env.ADMIN_TOKEN = 'test-token';
    app = createApp();
    isSyncInProgress.mockReturnValue(false);
  });

  afterEach(() => {
    if (originalToken !== undefined) {
      process.env.ADMIN_TOKEN = originalToken;
    } else {
      delete process.env.ADMIN_TOKEN;
    }
  });

  it('triggers a manual sync and returns the result', async () => {
    const mockResult = {
      outcome: 'success',
      timestamp: '2025-06-28T12:00:00.000Z',
      error: null,
      stats: { fixtures: 5, results: 2, standings: true }
    };
    triggerManualSync.mockResolvedValue(mockResult);

    const res = await request(app)
      .post('/api/admin/sync/trigger')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockResult);
    expect(triggerManualSync).toHaveBeenCalled();
  });

  it('returns 409 when sync is already in progress', async () => {
    isSyncInProgress.mockReturnValue(true);

    const res = await request(app)
      .post('/api/admin/sync/trigger')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('A sync is already in progress');
    expect(triggerManualSync).not.toHaveBeenCalled();
  });

  it('returns 409 when triggerManualSync throws sync in progress error', async () => {
    isSyncInProgress.mockReturnValue(false);
    triggerManualSync.mockRejectedValue(new Error('Sync already in progress'));

    const res = await request(app)
      .post('/api/admin/sync/trigger')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('A sync is already in progress');
  });

  it('requires authentication', async () => {
    const res = await request(app)
      .post('/api/admin/sync/trigger');

    expect(res.status).toBe(401);
  });

  it('returns 429 when called within 60s of previous manual trigger', async () => {
    const mockResult = {
      outcome: 'success',
      timestamp: '2025-06-28T12:00:00.000Z',
      error: null
    };
    triggerManualSync.mockResolvedValue(mockResult);

    // First call succeeds
    const res1 = await request(app)
      .post('/api/admin/sync/trigger')
      .set('Authorization', 'Bearer test-token');
    expect(res1.status).toBe(200);

    // Second call within 60s should be rejected with 429
    const res2 = await request(app)
      .post('/api/admin/sync/trigger')
      .set('Authorization', 'Bearer test-token');
    expect(res2.status).toBe(429);
    expect(res2.body.error).toMatch(/Manual sync can only be triggered once every 60 seconds/);
  });
});
