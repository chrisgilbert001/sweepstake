import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import matchDayRoutes from './matchDayRoutes.js';

vi.mock('../services/matchDayService.js', () => ({
  getFixturesForDate: vi.fn(),
  getFixturesForWeek: vi.fn()
}));

import { getFixturesForDate, getFixturesForWeek } from '../services/matchDayService.js';

function createApp() {
  const app = express();
  app.use('/api', matchDayRoutes);
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    const status = err.statusCode || err.status || 500;
    const message = err.message || 'Internal server error';
    res.status(status).json({ error: message });
  });
  return app;
}

describe('GET /api/fixtures/today', () => {
  let app;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createApp();
  });

  it('returns fixtures for the current day', async () => {
    const mockFixtures = [
      { id: 'f001', homeTeam: 'usa', awayTeam: 'ger', date: '2026-06-11T18:00:00Z', stage: 'Group Stage', status: 'scheduled' },
      { id: 'f002', homeTeam: 'bra', awayTeam: 'arg', date: '2026-06-11T21:00:00Z', stage: 'Group Stage', status: 'completed', homeScore: 2, awayScore: 1 }
    ];
    getFixturesForDate.mockResolvedValue(mockFixtures);

    const res = await request(app).get('/api/fixtures/today');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockFixtures);
    expect(getFixturesForDate).toHaveBeenCalledWith(expect.any(String));
  });

  it('returns empty array when no fixtures today', async () => {
    getFixturesForDate.mockResolvedValue([]);

    const res = await request(app).get('/api/fixtures/today');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns 500 when service throws', async () => {
    getFixturesForDate.mockRejectedValue(new Error('File read error'));

    const res = await request(app).get('/api/fixtures/today');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'File read error' });
  });
});

describe('GET /api/fixtures/week', () => {
  let app;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createApp();
  });

  it('returns fixtures for the current week', async () => {
    const mockFixtures = [
      { id: 'f001', homeTeam: 'usa', awayTeam: 'ger', date: '2026-06-09T18:00:00Z', stage: 'Group Stage', status: 'scheduled' },
      { id: 'f002', homeTeam: 'bra', awayTeam: 'arg', date: '2026-06-11T21:00:00Z', stage: 'Group Stage', status: 'completed', homeScore: 2, awayScore: 1 },
      { id: 'f003', homeTeam: 'fra', awayTeam: 'esp', date: '2026-06-14T15:00:00Z', stage: 'Group Stage', status: 'scheduled' }
    ];
    getFixturesForWeek.mockResolvedValue(mockFixtures);

    const res = await request(app).get('/api/fixtures/week');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockFixtures);
    expect(getFixturesForWeek).toHaveBeenCalledWith(expect.any(String));
  });

  it('returns empty array when no fixtures this week', async () => {
    getFixturesForWeek.mockResolvedValue([]);

    const res = await request(app).get('/api/fixtures/week');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns 500 when service throws', async () => {
    getFixturesForWeek.mockRejectedValue(new Error('Storage error'));

    const res = await request(app).get('/api/fixtures/week');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Storage error' });
  });
});
