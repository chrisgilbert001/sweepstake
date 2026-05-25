import { describe, it, expect } from 'vitest';
import { mapTeamId, validateMapping, TEAM_ID_MAP } from '../teamMapper.js';

describe('teamMapper', () => {
  describe('TEAM_ID_MAP', () => {
    it('contains exactly 48 entries', () => {
      expect(TEAM_ID_MAP.size).toBe(48);
    });

    it('all values are 3-letter lowercase strings', () => {
      for (const [, code] of TEAM_ID_MAP) {
        expect(code).toMatch(/^[a-z]{3}$/);
      }
    });

    it('all values are unique (no duplicate codes)', () => {
      const codes = [...TEAM_ID_MAP.values()];
      const uniqueCodes = new Set(codes);
      expect(uniqueCodes.size).toBe(codes.length);
    });

    it('all keys are positive integers', () => {
      for (const [id] of TEAM_ID_MAP) {
        expect(Number.isInteger(id)).toBe(true);
        expect(id).toBeGreaterThan(0);
      }
    });
  });

  describe('mapTeamId', () => {
    it('returns the correct code for a known team ID', () => {
      expect(mapTeamId(760)).toBe('esp');
      expect(mapTeamId(762)).toBe('arg');
      expect(mapTeamId(773)).toBe('fra');
      expect(mapTeamId(66)).toBe('eng');
    });

    it('returns null for an unknown team ID', () => {
      expect(mapTeamId(99999)).toBeNull();
    });

    it('returns null for 0', () => {
      expect(mapTeamId(0)).toBeNull();
    });

    it('returns null for negative numbers', () => {
      expect(mapTeamId(-1)).toBeNull();
    });

    it('returns null for undefined', () => {
      expect(mapTeamId(undefined)).toBeNull();
    });

    it('maps all pot 1 teams correctly', () => {
      expect(mapTeamId(764)).toBe('bra');
      expect(mapTeamId(765)).toBe('por');
      expect(mapTeamId(8601)).toBe('ned');
      expect(mapTeamId(805)).toBe('bel');
      expect(mapTeamId(759)).toBe('ger');
      expect(mapTeamId(7850)).toBe('usa');
      expect(mapTeamId(7890)).toBe('mex');
      expect(mapTeamId(7886)).toBe('can');
    });
  });

  describe('validateMapping', () => {
    it('returns valid when all internal IDs are mapped', () => {
      const allCodes = [...TEAM_ID_MAP.values()];
      const result = validateMapping(allCodes);
      expect(result.valid).toBe(true);
      expect(result.unmapped).toEqual([]);
    });

    it('returns invalid with unmapped codes when some IDs are missing', () => {
      const result = validateMapping(['esp', 'arg', 'xyz', 'abc']);
      expect(result.valid).toBe(false);
      expect(result.unmapped).toContain('xyz');
      expect(result.unmapped).toContain('abc');
      expect(result.unmapped).not.toContain('esp');
      expect(result.unmapped).not.toContain('arg');
    });

    it('returns valid for an empty array', () => {
      const result = validateMapping([]);
      expect(result.valid).toBe(true);
      expect(result.unmapped).toEqual([]);
    });

    it('returns invalid when a single code is unmapped', () => {
      const result = validateMapping(['esp', 'zzz']);
      expect(result.valid).toBe(false);
      expect(result.unmapped).toEqual(['zzz']);
    });
  });
});
