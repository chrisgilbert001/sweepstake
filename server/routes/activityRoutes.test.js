import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import activityRoutes from './activityRoutes.js';

vi.mock('../services/activityService.js', () => ({
  getActivityFeed: vi.fn()
}));

import { getActivityFeed } from '../services/activityService.js';

function createApp() {
  const app = express();
  app.use('/api', activityRoutes);
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    const status = err.statusCode || err.status || 500;
    const message = err.message || 'Internal server error';
    res.status(status).json({ error: message });
  });
  return app;
}

describe('GET /api/leagues/:slug/activity', () => {
  let app;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createApp();
  });

  it('returns activity feed with default pagination', async () => {
    const mockResult = {
      events: [{ id: 'mr-r001', type: 'match_result', timestamp: '2026-06-11T18:00:00Z', data: {} }],
      page: 1,
      totalPages: 1,
      totalEvents: 1
    };
    getActivityFeed.mockResolvedValue(mockResult);

    const res = await request(app).get('/api/leagues/test-league/activity');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockResult);
    expect(getActivityFeed).toHaveBeenCalledWith('test-league', 1, 50);
  });

  it('passes page and limit query params to service', async () => {
    const mockResult = { events: [], page: 2, totalPages: 3, totalEvents: 120 };
    getActivityFeed.mockResolvedValue(mockResult);

    const res = await request(app).get('/api/leagues/test-league/activity?page=2&limit=25');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockResult);
    expect(getActivityFeed).toHaveBeenCalledWith('test-league', 2, 25);
  });

  it('returns 400 for page less than 1', async () => {
    const res = await request(app).get('/api/leagues/test-league/activity?page=0');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Invalid page number' });
    expect(getActivityFeed).not.toHaveBeenCalled();
  });

  it('returns 400 for negative page number', async () => {
    const res = await request(app).get('/api/leagues/test-league/activity?page=-1');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Invalid page number' });
    expect(getActivityFeed).not.toHaveBeenCalled();
  });

  it('returns 400 for non-numeric page', async () => {
    const res = await request(app).get('/api/leagues/test-league/activity?page=abc');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Invalid page number' });
    expect(getActivityFeed).not.toHaveBeenCalled();
  });

  it('returns 400 for decimal page number', async () => {
    const res = await request(app).get('/api/leagues/test-league/activity?page=1.5');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Invalid page number' });
    expect(getActivityFeed).not.toHaveBeenCalled();
  });

  it('returns 404 when league not found', async () => {
    const error = new Error('League not found');
    error.statusCode = 404;
    getActivityFeed.mockRejectedValue(error);

    const res = await request(app).get('/api/leagues/nonexistent/activity');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'League not found' });
  });

  it('returns 500 when service throws unexpected error', async () => {
    getActivityFeed.mockRejectedValue(new Error('File read error'));

    const res = await request(app).get('/api/leagues/test-league/activity');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'File read error' });
  });
});
