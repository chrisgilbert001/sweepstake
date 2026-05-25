import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { rm, mkdir, readdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createLeague, addParticipant } from './leagueService.js';
import { readFile } from './storageService.js';
import {
  startDraft,
  getDraftState,
  spinWheel,
  shuffleArray,
  getAllocatedTeamsInPot,
  getCurrentPicker,
  advanceDraftState
} from './draftService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LEAGUES_DIR = path.join(__dirname, '..', 'data', 'leagues');

async function cleanLeagues() {
  try {
    const files = await readdir(LEAGUES_DIR);
    for (const file of files) {
      if (file === '.gitkeep') continue;
      try {
        await rm(path.join(LEAGUES_DIR, file), { recursive: true, force: true });
      } catch (e) { /* ignore individual file cleanup errors */ }
    }
  } catch (e) { /* ignore */ }
}

/**
 * Helper: create a league with 6 participants.
 * Uses a unique name per call to avoid collisions with parallel test files.
 */
let leagueCounter = 0;
function uniqueLeagueName() {
  return `Draft Svc Test ${++leagueCounter} ${Date.now()}`;
}

async function createLeagueWith6Participants(name) {
  const leagueName = name || uniqueLeagueName();
  const league = await createLeague(leagueName);
  const slug = league.slug;
  await addParticipant(slug, 'Alice');
  await addParticipant(slug, 'Bob');
  await addParticipant(slug, 'Charlie');
  await addParticipant(slug, 'Diana');
  await addParticipant(slug, 'Eve');
  await addParticipant(slug, 'Frank');
  return slug;
}

describe('draftService', () => {
  beforeEach(async () => {
    if (!existsSync(LEAGUES_DIR)) {
      await mkdir(LEAGUES_DIR, { recursive: true });
    }
    await cleanLeagues();
  });

  afterEach(async () => {
    await cleanLeagues();
  });

  describe('shuffleArray', () => {
    it('returns an array of the same length', () => {
      const input = [1, 2, 3, 4, 5, 6];
      const result = shuffleArray(input);
      expect(result).toHaveLength(6);
    });

    it('contains all original elements', () => {
      const input = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'];
      const result = shuffleArray(input);
      expect(result.sort()).toEqual(input.sort());
    });

    it('does not mutate the original array', () => {
      const input = [1, 2, 3, 4, 5, 6];
      const copy = [...input];
      shuffleArray(input);
      expect(input).toEqual(copy);
    });

    it('produces different orderings over multiple calls', () => {
      const input = ['a', 'b', 'c', 'd', 'e', 'f'];
      const results = new Set();
      for (let i = 0; i < 30; i++) {
        results.add(JSON.stringify(shuffleArray(input)));
      }
      // With 720 permutations, 30 shuffles should produce multiple unique orderings
      expect(results.size).toBeGreaterThan(1);
    });
  });

  describe('getAllocatedTeamsInPot', () => {
    it('returns empty array when no teams allocated', () => {
      const allocations = {
        p1: { pot1: [], pot2: [], pot3: [], pot4: [] },
        p2: { pot1: [], pot2: [], pot3: [], pot4: [] }
      };
      expect(getAllocatedTeamsInPot(allocations, 4)).toEqual([]);
    });

    it('returns all allocated teams in a specific pot', () => {
      const allocations = {
        p1: { pot1: [], pot2: [], pot3: [], pot4: ['cmr', 'gha'] },
        p2: { pot1: [], pot2: [], pot3: [], pot4: ['jam'] }
      };
      expect(getAllocatedTeamsInPot(allocations, 4)).toEqual(['cmr', 'gha', 'jam']);
    });

    it('only returns teams from the specified pot', () => {
      const allocations = {
        p1: { pot1: ['usa'], pot2: ['ita'], pot3: ['sen'], pot4: ['cmr'] }
      };
      expect(getAllocatedTeamsInPot(allocations, 1)).toEqual(['usa']);
      expect(getAllocatedTeamsInPot(allocations, 4)).toEqual(['cmr']);
    });
  });

  describe('getCurrentPicker', () => {
    const order = ['p3', 'p1', 'p6', 'p2', 'p5', 'p4'];

    it('returns forward order for round 1', () => {
      expect(getCurrentPicker(order, 1, 0)).toBe('p3');
      expect(getCurrentPicker(order, 1, 1)).toBe('p1');
      expect(getCurrentPicker(order, 1, 5)).toBe('p4');
    });

    it('returns reverse order for round 2', () => {
      expect(getCurrentPicker(order, 2, 0)).toBe('p4');
      expect(getCurrentPicker(order, 2, 1)).toBe('p5');
      expect(getCurrentPicker(order, 2, 5)).toBe('p3');
    });
  });

  describe('advanceDraftState', () => {
    it('advances pick index within a round', () => {
      const draft = { currentPickIndex: 0, currentRound: 1, currentPot: 4, spinsCompleted: 0 };
      const result = advanceDraftState(draft);
      expect(result.currentPickIndex).toBe(1);
      expect(result.currentRound).toBe(1);
      expect(result.currentPot).toBe(4);
      expect(result.status).toBe('in_progress');
    });

    it('transitions from round 1 to round 2 within same pot', () => {
      const draft = { currentPickIndex: 5, currentRound: 1, currentPot: 4, spinsCompleted: 5 };
      const result = advanceDraftState(draft);
      expect(result.currentPickIndex).toBe(0);
      expect(result.currentRound).toBe(2);
      expect(result.currentPot).toBe(4);
    });

    it('transitions from round 2 to next pot', () => {
      const draft = { currentPickIndex: 5, currentRound: 2, currentPot: 4, spinsCompleted: 11 };
      const result = advanceDraftState(draft);
      expect(result.currentPickIndex).toBe(0);
      expect(result.currentRound).toBe(1);
      expect(result.currentPot).toBe(3);
    });

    it('transitions through all pots correctly (pot 3 → pot 2)', () => {
      const draft = { currentPickIndex: 5, currentRound: 2, currentPot: 3, spinsCompleted: 23 };
      const result = advanceDraftState(draft);
      expect(result.currentPickIndex).toBe(0);
      expect(result.currentRound).toBe(1);
      expect(result.currentPot).toBe(2);
    });

    it('transitions pot 2 → pot 1', () => {
      const draft = { currentPickIndex: 5, currentRound: 2, currentPot: 2, spinsCompleted: 35 };
      const result = advanceDraftState(draft);
      expect(result.currentPickIndex).toBe(0);
      expect(result.currentRound).toBe(1);
      expect(result.currentPot).toBe(1);
    });

    it('marks draft as completed at 48 spins', () => {
      const draft = { currentPickIndex: 5, currentRound: 2, currentPot: 1, spinsCompleted: 47 };
      const result = advanceDraftState(draft);
      expect(result.status).toBe('completed');
    });

    it('does not mark as completed before 48 spins', () => {
      const draft = { currentPickIndex: 4, currentRound: 2, currentPot: 1, spinsCompleted: 46 };
      const result = advanceDraftState(draft);
      expect(result.status).toBe('in_progress');
    });
  });

  describe('startDraft', () => {
    it('starts a draft with 6 participants', async () => {
      const slug = await createLeagueWith6Participants();
      const updated = await startDraft(slug);

      expect(updated.draft.status).toBe('in_progress');
      expect(updated.draft.order).toHaveLength(6);
      expect(updated.draft.currentPot).toBe(4);
      expect(updated.draft.currentRound).toBe(1);
      expect(updated.draft.currentPickIndex).toBe(0);
      expect(updated.draft.spinsCompleted).toBe(0);
    });

    it('randomizes the draft order as a permutation of participant IDs', async () => {
      const slug = await createLeagueWith6Participants();
      const updated = await startDraft(slug);

      const expectedIds = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'];
      expect(updated.draft.order.sort()).toEqual(expectedIds);
    });

    it('initializes empty allocations for all participants', async () => {
      const slug = await createLeagueWith6Participants();
      const updated = await startDraft(slug);

      for (const id of ['p1', 'p2', 'p3', 'p4', 'p5', 'p6']) {
        expect(updated.draft.allocations[id]).toEqual({
          pot1: [], pot2: [], pot3: [], pot4: []
        });
      }
    });

    it('rejects draft start with fewer than 6 participants', async () => {
      const league = await createLeague(uniqueLeagueName());
      await addParticipant(league.slug, 'Alice');
      await addParticipant(league.slug, 'Bob');

      await expect(startDraft(league.slug)).rejects.toMatchObject({
        statusCode: 400,
        message: 'Exactly 6 participants required to start draft'
      });
    });

    it('rejects draft start with 0 participants', async () => {
      const league = await createLeague(uniqueLeagueName());

      await expect(startDraft(league.slug)).rejects.toMatchObject({
        statusCode: 400,
        message: 'Exactly 6 participants required to start draft'
      });
    });

    it('rejects draft start if already completed', async () => {
      const slug = await createLeagueWith6Participants();
      await startDraft(slug);

      // Manually set status to completed
      const { updateFile: uf } = await import('./storageService.js');
      await uf(`leagues/${slug}.json`, (league) => ({
        ...league,
        draft: { ...league.draft, status: 'completed' }
      }));

      await expect(startDraft(slug)).rejects.toMatchObject({
        statusCode: 400,
        message: 'Draft has already been completed'
      });
    });
  });

  describe('getDraftState', () => {
    it('returns not_started state before draft begins', async () => {
      const slug = await createLeagueWith6Participants();
      const state = await getDraftState(slug);

      expect(state.status).toBe('not_started');
      expect(state.order).toEqual([]);
    });

    it('returns in_progress state with available teams after draft starts', async () => {
      const slug = await createLeagueWith6Participants();
      await startDraft(slug);
      const state = await getDraftState(slug);

      expect(state.status).toBe('in_progress');
      expect(state.order).toHaveLength(6);
      expect(state.availableTeams).toHaveLength(12); // All 12 teams in pot 4
      expect(state.currentPicker).toBeDefined();
      expect(state.currentPot).toBe(4);
    });

    it('does not include availableTeams when draft is not in progress', async () => {
      const slug = await createLeagueWith6Participants();
      const state = await getDraftState(slug);

      expect(state.availableTeams).toBeUndefined();
      expect(state.currentPicker).toBeUndefined();
    });
  });

  describe('spinWheel', () => {
    it('selects a team from the current pot', async () => {
      const slug = await createLeagueWith6Participants();
      await startDraft(slug);

      const result = await spinWheel(slug);

      expect(result.selectedTeam).toBeDefined();
      expect(result.selectedTeam.id).toBeDefined();
      expect(result.selectedTeam.name).toBeDefined();
      expect(result.participant).toBeDefined();
    });

    it('advances spinsCompleted after each spin', async () => {
      const slug = await createLeagueWith6Participants();
      await startDraft(slug);

      const result = await spinWheel(slug);
      expect(result.draft.spinsCompleted).toBe(1);

      const result2 = await spinWheel(slug);
      expect(result2.draft.spinsCompleted).toBe(2);
    });

    it('allocates team to the correct participant', async () => {
      const slug = await createLeagueWith6Participants();
      await startDraft(slug);

      const league = await readFile(`leagues/${slug}.json`);
      const firstPicker = league.draft.order[0]; // Round 1, index 0 = forward

      const result = await spinWheel(slug);
      expect(result.participant).toBe(firstPicker);
      expect(result.draft.allocations[firstPicker].pot4).toHaveLength(1);
      expect(result.draft.allocations[firstPicker].pot4[0]).toBe(result.selectedTeam.id);
    });

    it('does not select already allocated teams', async () => {
      const slug = await createLeagueWith6Participants();
      await startDraft(slug);

      const selectedTeams = new Set();
      // Spin 12 times to complete pot 4
      for (let i = 0; i < 12; i++) {
        const result = await spinWheel(slug);
        expect(selectedTeams.has(result.selectedTeam.id)).toBe(false);
        selectedTeams.add(result.selectedTeam.id);
      }
      // All 12 teams in pot 4 should be allocated
      expect(selectedTeams.size).toBe(12);
    });

    it('transitions to next pot after 12 spins', async () => {
      const slug = await createLeagueWith6Participants();
      await startDraft(slug);

      // Complete pot 4 (12 spins)
      for (let i = 0; i < 12; i++) {
        await spinWheel(slug);
      }

      const state = await getDraftState(slug);
      expect(state.currentPot).toBe(3);
      expect(state.currentRound).toBe(1);
      expect(state.currentPickIndex).toBe(0);
      expect(state.spinsCompleted).toBe(12);
    });

    it('completes draft after 48 spins', async () => {
      const slug = await createLeagueWith6Participants();
      await startDraft(slug);

      // Complete all 48 spins
      for (let i = 0; i < 48; i++) {
        await spinWheel(slug);
      }

      const state = await getDraftState(slug);
      expect(state.status).toBe('completed');
      expect(state.spinsCompleted).toBe(48);

      // Each participant should have 2 teams per pot
      for (const id of ['p1', 'p2', 'p3', 'p4', 'p5', 'p6']) {
        expect(state.allocations[id].pot1).toHaveLength(2);
        expect(state.allocations[id].pot2).toHaveLength(2);
        expect(state.allocations[id].pot3).toHaveLength(2);
        expect(state.allocations[id].pot4).toHaveLength(2);
      }
    });

    it('rejects spin when draft is not in progress', async () => {
      const slug = await createLeagueWith6Participants();

      await expect(spinWheel(slug)).rejects.toMatchObject({
        statusCode: 400,
        message: 'Draft is not in progress'
      });
    });

    it('follows snake order: round 1 forward, round 2 reverse', async () => {
      const slug = await createLeagueWith6Participants();
      await startDraft(slug);

      const league = await readFile(`leagues/${slug}.json`);
      const order = league.draft.order;

      // Track which participant picks in each spin
      const pickers = [];
      for (let i = 0; i < 12; i++) {
        const result = await spinWheel(slug);
        pickers.push(result.participant);
      }

      // First 6 should be forward order
      expect(pickers.slice(0, 6)).toEqual(order);
      // Next 6 should be reverse order
      expect(pickers.slice(6, 12)).toEqual([...order].reverse());
    });
  });
});
