import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import teamRoutes from './teamRoutes.js';

// Mock the teamService
vi.mock('../services/teamService.js', () => ({
  getAllTeams: vi.fn()
}));

import { getAllTeams } from '../services/teamService.js';

function createApp() {
  const app = express();
  app.use('/api/teams', teamRoutes);
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    const status = err.statusCode || err.status || 500;
    const message = err.message || 'Internal server error';
    res.status(status).json({ error: message });
  });
  return app;
}

describe('GET /api/teams', () => {
  let app;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createApp();
  });

  it('returns all teams with pot assignments', async () => {
    const mockTeams = {
      pots: [
        {
          potNumber: 1,
          teams: [
            { id: 'usa', name: 'United States', seedRank: 1 },
            { id: 'ger', name: 'Germany', seedRank: 2 }
          ]
        },
        {
          potNumber: 2,
          teams: [
            { id: 'jpn', name: 'Japan', seedRank: 13 },
            { id: 'mex', name: 'Mexico', seedRank: 14 }
          ]
        }
      ]
    };

    getAllTeams.mockResolvedValue(mockTeams);

    const res = await request(app).get('/api/teams');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockTeams);
    expect(res.body.pots).toHaveLength(2);
    expect(res.body.pots[0].potNumber).toBe(1);
    expect(res.body.pots[0].teams[0].id).toBe('usa');
  });

  it('returns 200 with correct content-type', async () => {
    getAllTeams.mockResolvedValue({ pots: [] });

    const res = await request(app).get('/api/teams');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/json/);
  });

  it('returns 500 when teamService throws an error', async () => {
    getAllTeams.mockRejectedValue(new Error('File read error'));

    const res = await request(app).get('/api/teams');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'File read error' });
  });

  it('returns 500 with statusCode from service error', async () => {
    const err = new Error('Storage unavailable');
    err.statusCode = 503;
    getAllTeams.mockRejectedValue(err);

    const res = await request(app).get('/api/teams');

    expect(res.status).toBe(503);
    expect(res.body).toEqual({ error: 'Storage unavailable' });
  });
});
