import crypto from 'crypto';
import { readFile, updateFile } from './storageService.js';
import { getTeamsInPot } from './teamService.js';

/**
 * Shuffle an array in place using Fisher-Yates with crypto.randomInt for unbiased randomness.
 * @param {Array} array - Array to shuffle (will be copied)
 * @returns {Array} A new shuffled array
 */
function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Get the list of team IDs already allocated in a specific pot across all participants.
 * @param {object} allocations - The allocations map
 * @param {number} potNumber - The pot number (1-4)
 * @returns {string[]} Array of allocated team IDs
 */
function getAllocatedTeamsInPot(allocations, potNumber) {
  const potKey = `pot${potNumber}`;
  return Object.values(allocations).flatMap(a => a[potKey] || []);
}

/**
 * Determine the current picker based on draft order, round, and pick index.
 * Round 1: forward order (index 0→5)
 * Round 2: reverse order (index 0→5 maps to positions 5→0)
 * @param {string[]} order - The draft order array
 * @param {number} currentRound - 1 or 2
 * @param {number} currentPickIndex - 0-5
 * @returns {string} The participant ID who picks next
 */
function getCurrentPicker(order, currentRound, currentPickIndex) {
  if (currentRound === 1) {
    return order[currentPickIndex];
  }
  // Round 2: reverse order
  return order[order.length - 1 - currentPickIndex];
}

/**
 * Advance the draft state after a pick.
 * Returns the new currentPickIndex, currentRound, and currentPot.
 * Does NOT update spinsCompleted (caller handles that).
 * @param {object} draft - Current draft state
 * @returns {object} New state fields: currentPickIndex, currentRound, currentPot, status
 */
function advanceDraftState(draft) {
  const totalSpins = draft.spinsCompleted + 1;

  // If we've completed all 48 spins, mark as completed
  if (totalSpins >= 48) {
    return {
      currentPickIndex: draft.currentPickIndex,
      currentRound: draft.currentRound,
      currentPot: draft.currentPot,
      status: 'completed'
    };
  }

  let { currentPickIndex, currentRound, currentPot } = draft;

  // Advance pick index
  currentPickIndex++;

  // If we've gone through all 6 picks in this round
  if (currentPickIndex >= 6) {
    currentPickIndex = 0;

    if (currentRound === 1) {
      // Move to round 2 of same pot
      currentRound = 2;
    } else {
      // Round 2 complete — move to next pot (4→3→2→1)
      currentRound = 1;
      currentPot--;
    }
  }

  return {
    currentPickIndex,
    currentRound,
    currentPot,
    status: 'in_progress'
  };
}

/**
 * Start the draft for a league.
 * Validates exactly 6 participants, randomizes order, sets status to in_progress.
 * @param {string} leagueSlug
 * @returns {Promise<object>} The updated league data
 * @throws {object} 400 if not exactly 6 participants or draft already completed
 */
export async function startDraft(leagueSlug) {
  const updated = await updateFile(`leagues/${leagueSlug}.json`, (league) => {
    if (league.draft.status === 'completed') {
      throw { statusCode: 400, message: 'Draft has already been completed' };
    }

    if (league.participants.length !== 6) {
      throw { statusCode: 400, message: 'Exactly 6 participants required to start draft' };
    }

    // Randomize order using Fisher-Yates shuffle with crypto.randomInt
    const participantIds = league.participants.map(p => p.id);
    const order = shuffleArray(participantIds);

    // Initialize allocations for each participant
    const allocations = {};
    for (const id of participantIds) {
      allocations[id] = { pot1: [], pot2: [], pot3: [], pot4: [] };
    }

    return {
      ...league,
      draft: {
        status: 'in_progress',
        order,
        currentPot: 4,
        currentRound: 1,
        currentPickIndex: 0,
        spinsCompleted: 0,
        allocations
      }
    };
  });

  return updated;
}

/**
 * Get the current draft state for a league.
 * Returns order, progress, and available teams in the current pot.
 * @param {string} leagueSlug
 * @returns {Promise<object>} Draft state with available teams
 * @throws {object} 404 if league not found
 */
export async function getDraftState(leagueSlug) {
  const league = await readFile(`leagues/${leagueSlug}.json`);
  const { draft } = league;

  const state = {
    status: draft.status,
    order: draft.order,
    currentPot: draft.currentPot,
    currentRound: draft.currentRound,
    currentPickIndex: draft.currentPickIndex,
    spinsCompleted: draft.spinsCompleted,
    allocations: draft.allocations
  };

  // If draft is in progress, include available teams and current picker
  if (draft.status === 'in_progress') {
    const potTeams = await getTeamsInPot(draft.currentPot);
    const allocatedInPot = getAllocatedTeamsInPot(draft.allocations, draft.currentPot);
    const availableTeams = potTeams.filter(t => !allocatedInPot.includes(t.id));

    state.availableTeams = availableTeams;
    state.currentPicker = getCurrentPicker(draft.order, draft.currentRound, draft.currentPickIndex);
  }

  return state;
}

/**
 * Perform a wheel spin — select a random team from the available pool in the current pot.
 * Updates allocations and advances draft state.
 * @param {string} leagueSlug
 * @returns {Promise<object>} The spin result including selected team and updated state
 * @throws {object} 400 if draft not in progress
 */
export async function spinWheel(leagueSlug) {
  // Phase 1: Read current state to determine what pot we need
  const league = await readFile(`leagues/${leagueSlug}.json`);
  const { draft } = league;

  if (draft.status !== 'in_progress') {
    throw { statusCode: 400, message: 'Draft is not in progress' };
  }

  // Phase 2: Get available teams in current pot
  const potTeams = await getTeamsInPot(draft.currentPot);
  const allocatedInPot = getAllocatedTeamsInPot(draft.allocations, draft.currentPot);
  const availableTeams = potTeams.filter(t => !allocatedInPot.includes(t.id));

  if (availableTeams.length === 0) {
    throw { statusCode: 500, message: 'No available teams in current pot' };
  }

  // Phase 3: Select random team using crypto.randomInt
  const selectedIndex = crypto.randomInt(0, availableTeams.length);
  const selectedTeam = availableTeams[selectedIndex];

  // Phase 4: Determine current picker
  const currentPicker = getCurrentPicker(draft.order, draft.currentRound, draft.currentPickIndex);

  // Phase 5: Atomically update the league file
  const updated = await updateFile(`leagues/${leagueSlug}.json`, (currentLeague) => {
    const currentDraft = currentLeague.draft;

    // Re-validate state hasn't changed between read and write
    if (currentDraft.status !== 'in_progress') {
      throw { statusCode: 400, message: 'Draft is not in progress' };
    }
    if (currentDraft.spinsCompleted !== draft.spinsCompleted) {
      throw { statusCode: 409, message: 'Draft state changed, please retry' };
    }

    // Add team to participant's allocations for the current pot
    const potKey = `pot${currentDraft.currentPot}`;
    const newAllocations = { ...currentDraft.allocations };
    newAllocations[currentPicker] = {
      ...newAllocations[currentPicker],
      [potKey]: [...newAllocations[currentPicker][potKey], selectedTeam.id]
    };

    // Advance state
    const advancedState = advanceDraftState(currentDraft);

    return {
      ...currentLeague,
      draft: {
        ...currentDraft,
        ...advancedState,
        allocations: newAllocations,
        spinsCompleted: currentDraft.spinsCompleted + 1
      }
    };
  });

  return {
    selectedTeam,
    participant: currentPicker,
    draft: updated.draft
  };
}

// Export internal functions for testing
export { shuffleArray, getAllocatedTeamsInPot, getCurrentPicker, advanceDraftState };

/**
 * Run the entire draft from start to finish in one operation.
 * Starts the draft (randomizes order) then performs all 48 spins.
 * @param {string} leagueSlug
 * @returns {Promise<object>} The final league data with completed draft
 * @throws {object} 400 if not exactly 6 participants or draft already started/completed
 */
export async function runFullDraft(leagueSlug) {
  // Start the draft first
  await startDraft(leagueSlug);

  // Run all 48 spins
  for (let i = 0; i < 48; i++) {
    await spinWheel(leagueSlug);
  }

  // Return the final state
  return await readFile(`leagues/${leagueSlug}.json`);
}
