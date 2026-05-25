import { describe, it, expect } from 'vitest';
import { mapMatchStatus } from '../statusMapper.js';

describe('statusMapper', () => {
  describe('mapMatchStatus', () => {
    it('maps SCHEDULED to "scheduled"', () => {
      const result = mapMatchStatus('SCHEDULED');
      expect(result).toEqual({ status: 'scheduled', known: true });
    });

    it('maps TIMED to "scheduled"', () => {
      const result = mapMatchStatus('TIMED');
      expect(result).toEqual({ status: 'scheduled', known: true });
    });

    it('maps FINISHED to "completed"', () => {
      const result = mapMatchStatus('FINISHED');
      expect(result).toEqual({ status: 'completed', known: true });
    });

    it('maps LIVE to "in_progress"', () => {
      const result = mapMatchStatus('LIVE');
      expect(result).toEqual({ status: 'in_progress', known: true });
    });

    it('maps IN_PLAY to "in_progress"', () => {
      const result = mapMatchStatus('IN_PLAY');
      expect(result).toEqual({ status: 'in_progress', known: true });
    });

    it('maps PAUSED to "in_progress"', () => {
      const result = mapMatchStatus('PAUSED');
      expect(result).toEqual({ status: 'in_progress', known: true });
    });

    it('maps POSTPONED to "postponed"', () => {
      const result = mapMatchStatus('POSTPONED');
      expect(result).toEqual({ status: 'postponed', known: true });
    });

    it('maps SUSPENDED to "postponed"', () => {
      const result = mapMatchStatus('SUSPENDED');
      expect(result).toEqual({ status: 'postponed', known: true });
    });

    it('maps CANCELLED to "postponed"', () => {
      const result = mapMatchStatus('CANCELLED');
      expect(result).toEqual({ status: 'postponed', known: true });
    });

    it('returns { status: null, known: false } for unrecognised status', () => {
      const result = mapMatchStatus('UNKNOWN_STATUS');
      expect(result).toEqual({ status: null, known: false });
    });

    it('returns { status: null, known: false } for empty string', () => {
      const result = mapMatchStatus('');
      expect(result).toEqual({ status: null, known: false });
    });

    it('returns { status: null, known: false } for undefined', () => {
      const result = mapMatchStatus(undefined);
      expect(result).toEqual({ status: null, known: false });
    });
  });
});
