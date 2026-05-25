import { describe, it, expect, vi, beforeEach } from 'vitest';
import { calculateTeamStats, calculateForm, getUpcomingFixtures } from './myTeamsService.js';

describe('myTeamsService', () => {
  describe('calculateTeamStats', () => {
    it('should return zero stats when no results involve the team', () => {
      const results = [
        { homeTeam: 'fra', awayTeam: 'ger', homeScore: 2, awayScore: 1, date: '2026-06-12', penaltyShootout: null }
      ];
      const stats = calculateTeamStats('eng', results);
      expect(stats).toEqual({ points: 0, wins: 0, draws: 0, losses: 0, goalsScored: 0, goalsConceded: 0 });
    });

    it('should calculate a win correctly when team is home', () => {
      const results = [
        { homeTeam: 'eng', awayTeam: 'fra', homeScore: 3, awayScore: 1, date: '2026-06-12', penaltyShootout: null }
      ];
      const stats = calculateTeamStats('eng', results);
      expect(stats).toEqual({ points: 3, wins: 1, draws: 0, losses: 0, goalsScored: 3, goalsConceded: 1 });
    });

    it('should calculate a win correctly when team is away', () => {
      const results = [
        { homeTeam: 'fra', awayTeam: 'eng', homeScore: 0, awayScore: 2, date: '2026-06-12', penaltyShootout: null }
      ];
      const stats = calculateTeamStats('eng', results);
      expect(stats).toEqual({ points: 3, wins: 1, draws: 0, losses: 0, goalsScored: 2, goalsConceded: 0 });
    });

    it('should calculate a draw with 1 point', () => {
      const results = [
        { homeTeam: 'eng', awayTeam: 'fra', homeScore: 1, awayScore: 1, date: '2026-06-12', penaltyShootout: null }
      ];
      const stats = calculateTeamStats('eng', results);
      expect(stats).toEqual({ points: 1, wins: 0, draws: 1, losses: 0, goalsScored: 1, goalsConceded: 1 });
    });

    it('should add penalty bonus point when team wins shootout on a draw', () => {
      const results = [
        { homeTeam: 'eng', awayTeam: 'fra', homeScore: 1, awayScore: 1, date: '2026-06-12', penaltyShootout: { winner: 'eng', homeGoals: 4, awayGoals: 2 } }
      ];
      const stats = calculateTeamStats('eng', results);
      expect(stats).toEqual({ points: 2, wins: 0, draws: 1, losses: 0, goalsScored: 1, goalsConceded: 1 });
    });

    it('should not add penalty bonus when team loses shootout', () => {
      const results = [
        { homeTeam: 'eng', awayTeam: 'fra', homeScore: 1, awayScore: 1, date: '2026-06-12', penaltyShootout: { winner: 'fra', homeGoals: 2, awayGoals: 4 } }
      ];
      const stats = calculateTeamStats('eng', results);
      expect(stats).toEqual({ points: 1, wins: 0, draws: 1, losses: 0, goalsScored: 1, goalsConceded: 1 });
    });

    it('should calculate a loss correctly', () => {
      const results = [
        { homeTeam: 'eng', awayTeam: 'fra', homeScore: 0, awayScore: 3, date: '2026-06-12', penaltyShootout: null }
      ];
      const stats = calculateTeamStats('eng', results);
      expect(stats).toEqual({ points: 0, wins: 0, draws: 0, losses: 1, goalsScored: 0, goalsConceded: 3 });
    });

    it('should accumulate stats across multiple results', () => {
      const results = [
        { homeTeam: 'eng', awayTeam: 'fra', homeScore: 2, awayScore: 0, date: '2026-06-12', penaltyShootout: null },
        { homeTeam: 'ger', awayTeam: 'eng', homeScore: 1, awayScore: 1, date: '2026-06-14', penaltyShootout: null },
        { homeTeam: 'eng', awayTeam: 'bra', homeScore: 0, awayScore: 1, date: '2026-06-16', penaltyShootout: null }
      ];
      const stats = calculateTeamStats('eng', results);
      expect(stats).toEqual({ points: 4, wins: 1, draws: 1, losses: 1, goalsScored: 3, goalsConceded: 2 });
    });
  });

  describe('calculateForm', () => {
    it('should return empty array when no results involve the team', () => {
      const results = [
        { homeTeam: 'fra', awayTeam: 'ger', homeScore: 2, awayScore: 1, date: '2026-06-12' }
      ];
      expect(calculateForm('eng', results)).toEqual([]);
    });

    it('should return W/D/L in most recent first order', () => {
      const results = [
        { homeTeam: 'eng', awayTeam: 'fra', homeScore: 2, awayScore: 0, date: '2026-06-10' },
        { homeTeam: 'eng', awayTeam: 'ger', homeScore: 1, awayScore: 1, date: '2026-06-12' },
        { homeTeam: 'bra', awayTeam: 'eng', homeScore: 3, awayScore: 0, date: '2026-06-14' }
      ];
      // Most recent first: L (Jun 14), D (Jun 12), W (Jun 10)
      expect(calculateForm('eng', results)).toEqual(['L', 'D', 'W']);
    });

    it('should return at most 5 entries', () => {
      const results = [
        { homeTeam: 'eng', awayTeam: 'fra', homeScore: 1, awayScore: 0, date: '2026-06-01' },
        { homeTeam: 'eng', awayTeam: 'ger', homeScore: 1, awayScore: 0, date: '2026-06-03' },
        { homeTeam: 'eng', awayTeam: 'bra', homeScore: 1, awayScore: 0, date: '2026-06-05' },
        { homeTeam: 'eng', awayTeam: 'arg', homeScore: 1, awayScore: 0, date: '2026-06-07' },
        { homeTeam: 'eng', awayTeam: 'ned', homeScore: 1, awayScore: 0, date: '2026-06-09' },
        { homeTeam: 'eng', awayTeam: 'por', homeScore: 0, awayScore: 1, date: '2026-06-11' }
      ];
      const form = calculateForm('eng', results);
      expect(form).toHaveLength(5);
      // Most recent 5: L (Jun 11), W (Jun 9), W (Jun 7), W (Jun 5), W (Jun 3)
      expect(form).toEqual(['L', 'W', 'W', 'W', 'W']);
    });

    it('should handle fewer than 5 matches', () => {
      const results = [
        { homeTeam: 'eng', awayTeam: 'fra', homeScore: 2, awayScore: 1, date: '2026-06-10' },
        { homeTeam: 'ger', awayTeam: 'eng', homeScore: 0, awayScore: 0, date: '2026-06-12' }
      ];
      expect(calculateForm('eng', results)).toEqual(['D', 'W']);
    });
  });

  describe('getUpcomingFixtures', () => {
    const teamLookup = {
      eng: 'England',
      fra: 'France',
      ger: 'Germany',
      bra: 'Brazil'
    };

    it('should return empty array when no scheduled fixtures exist', () => {
      const now = new Date('2026-06-10T00:00:00Z');
      const sevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const fixtures = [];
      expect(getUpcomingFixtures('eng', fixtures, teamLookup, now, sevenDays)).toEqual([]);
    });

    it('should return fixtures within next 7 days for the team', () => {
      const now = new Date('2026-06-10T00:00:00Z');
      const sevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const fixtures = [
        { homeTeam: 'eng', awayTeam: 'fra', date: '2026-06-12T15:00:00Z', stage: 'Group Stage', status: 'scheduled' },
        { homeTeam: 'ger', awayTeam: 'eng', date: '2026-06-15T18:00:00Z', stage: 'Group Stage', status: 'scheduled' }
      ];
      const result = getUpcomingFixtures('eng', fixtures, teamLookup, now, sevenDays);
      expect(result).toEqual([
        { opponentId: 'fra', opponentName: 'France', date: '2026-06-12T15:00:00Z', stage: 'Group Stage' },
        { opponentId: 'ger', opponentName: 'Germany', date: '2026-06-15T18:00:00Z', stage: 'Group Stage' }
      ]);
    });

    it('should exclude fixtures outside the 7-day window', () => {
      const now = new Date('2026-06-10T00:00:00Z');
      const sevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const fixtures = [
        { homeTeam: 'eng', awayTeam: 'fra', date: '2026-06-20T15:00:00Z', stage: 'Group Stage', status: 'scheduled' }
      ];
      expect(getUpcomingFixtures('eng', fixtures, teamLookup, now, sevenDays)).toEqual([]);
    });

    it('should exclude fixtures in the past', () => {
      const now = new Date('2026-06-10T00:00:00Z');
      const sevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const fixtures = [
        { homeTeam: 'eng', awayTeam: 'fra', date: '2026-06-08T15:00:00Z', stage: 'Group Stage', status: 'scheduled' }
      ];
      expect(getUpcomingFixtures('eng', fixtures, teamLookup, now, sevenDays)).toEqual([]);
    });

    it('should exclude non-scheduled fixtures', () => {
      const now = new Date('2026-06-10T00:00:00Z');
      const sevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const fixtures = [
        { homeTeam: 'eng', awayTeam: 'fra', date: '2026-06-12T15:00:00Z', stage: 'Group Stage', status: 'completed' }
      ];
      expect(getUpcomingFixtures('eng', fixtures, teamLookup, now, sevenDays)).toEqual([]);
    });

    it('should sort upcoming fixtures by date ascending', () => {
      const now = new Date('2026-06-10T00:00:00Z');
      const sevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const fixtures = [
        { homeTeam: 'eng', awayTeam: 'bra', date: '2026-06-15T18:00:00Z', stage: 'Group Stage', status: 'scheduled' },
        { homeTeam: 'fra', awayTeam: 'eng', date: '2026-06-11T12:00:00Z', stage: 'Group Stage', status: 'scheduled' }
      ];
      const result = getUpcomingFixtures('eng', fixtures, teamLookup, now, sevenDays);
      expect(result[0].opponentId).toBe('fra');
      expect(result[1].opponentId).toBe('bra');
    });
  });
});
