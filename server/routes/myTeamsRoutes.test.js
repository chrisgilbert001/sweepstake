import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import app from '../index.js';

// Mock the myTeamsService to isolate route logic
vi.mock('../services/myTeamsService.js', () => ({
  getMyTeamsData: vi.fn()
}));

import { getMyTeamsData } from '../services/myTeamsService.js';

describe('My Teams API Routes', () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('GET /api/leagues/:slug/my-teams/:participantId', () => {
    it('returns my teams data for a valid league and participant', async () => {
      const mockData = {
        totalPoints: 10,
        teams: [
          {
            teamId: 'eng',
            teamName: 'England',
            pot: 1,
            points: 6,
            wins: 2,
            draws: 0,
            losses: 0,
            goalsScored: 4,
            goalsConceded: 1,
            form: ['W', 'W'],
            upcomingFixtures: []
          },
          {
            teamId: 'bra',
            teamName: 'Brazil',
            pot: 2,
            points: 4,
            wins: 1,
            draws: 1,
            losses: 0,
            goalsScored: 3,
            goalsConceded: 2,
            form: ['W', 'D'],
            upcomingFixtures: []
          }
        ]
      };

      getMyTeamsData.mockResolvedValue(mockData);

      const res = await request(app)
        .get('/api/leagues/test-league/my-teams/p1');

      expect(res.status).toBe(200);
      expect(res.body.totalPoints).toBe(10);
      expect(res.body.teams).toHaveLength(2);
      expect(res.body.teams[0].teamId).toBe('eng');
      expect(res.body.teams[1].teamId).toBe('bra');
      expect(getMyTeamsData).toHaveBeenCalledWith('test-league', 'p1');
    });

    it('returns 404 when league is not found', async () => {
      getMyTeamsData.mockRejectedValue({ statusCode: 404, message: 'League not found' });

      const res = await request(app)
        .get('/api/leagues/nonexistent/my-teams/p1');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('League not found');
    });

    it('returns 404 when participant is not found', async () => {
      getMyTeamsData.mockRejectedValue({ statusCode: 404, message: 'Participant not found' });

      const res = await request(app)
        .get('/api/leagues/test-league/my-teams/p99');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Participant not found');
    });

    it('passes unexpected errors to the error handler', async () => {
      getMyTeamsData.mockRejectedValue(new Error('Unexpected failure'));

      const res = await request(app)
        .get('/api/leagues/test-league/my-teams/p1');

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Internal server error');
    });
  });
});
