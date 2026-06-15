import { readFile } from './storageService.js';

const FIXTURES_FILE = 'fixtures.json';
const RESULTS_FILE = 'results.json';

/**
 * Load the bracket template, returning null if missing or malformed.
 * @returns {Promise<object|null>}
 */
async function loadBracketTemplate() {
  try {
    return await readFile('bracket-template.json');
  } catch (err) {
    console.warn('[BracketService] Bracket template unavailable, using TBD fallback:', err.message || err);
    return null;
  }
}

/**
 * Resolve placeholders for a single fixture.
 * @param {object} fixture - The bracket fixture object (has homeTeam, awayTeam, position)
 * @param {number} roundIndex - Index of the current round (0 = Round of 32)
 * @param {object|null} template - The loaded bracket template
 * @param {Array} previousRoundFixtures - Fixtures from the previous round (for W{N} refs)
 */
function resolvePlaceholders(fixture, roundIndex, template, previousRoundFixtures) {
  if (roundIndex === 0) {
    // Round of 32: use template
    const templateEntry = template?.roundOf32?.[fixture.position];
    fixture.homePlaceholder = fixture.homeTeam === 'TBD'
      ? (templateEntry?.home || 'TBD')
      : null;
    fixture.awayPlaceholder = fixture.awayTeam === 'TBD'
      ? (templateEntry?.away || 'TBD')
      : null;
  } else {
    // Later rounds: use W{N} referencing previous round match numbers
    const homeSourceIndex = fixture.position * 2;
    const awaySourceIndex = fixture.position * 2 + 1;
    const homeSourceMatch = previousRoundFixtures?.[homeSourceIndex];
    const awaySourceMatch = previousRoundFixtures?.[awaySourceIndex];

    fixture.homePlaceholder = fixture.homeTeam === 'TBD'
      ? (homeSourceMatch ? `W${homeSourceMatch.matchNumber}` : 'TBD')
      : null;
    fixture.awayPlaceholder = fixture.awayTeam === 'TBD'
      ? (awaySourceMatch ? `W${awaySourceMatch.matchNumber}` : 'TBD')
      : null;
  }
}

/**
 * Knockout stage rounds in chronological order.
 * Each round feeds winners into the next round.
 */
const KNOCKOUT_ROUNDS = [
  'Round of 32',
  'Round of 16',
  'Quarter-finals',
  'Semi-finals',
  'Final'
];

/**
 * Official FIFA 2026 match numbers in bracket depth-first order per round.
 * Ordering a round's fixtures into this sequence lets the renderer's pairwise
 * merge (slots 2k and 2k+1 feed slot k of the next round) reconstruct the real
 * tournament tree all the way to the final. Third-place playoff (match 103) is
 * intentionally excluded — it is not part of the bracket tree.
 * Source: en.wikipedia.org/wiki/2026_FIFA_World_Cup_knockout_stage
 */
const BRACKET_SLOT_ORDER = {
  'Round of 32': [74, 77, 73, 75, 83, 84, 81, 82, 76, 78, 79, 80, 86, 88, 85, 87],
  'Round of 16': [89, 90, 93, 94, 91, 92, 95, 96],
  'Quarter-finals': [97, 98, 99, 100],
  'Semi-finals': [101, 102],
  'Final': [104],
};

/** Official FIFA match number of the first match in each knockout round. */
const ROUND_BASE_MATCH_NUMBER = {
  'Round of 32': 73,
  'Round of 16': 89,
  'Quarter-finals': 97,
  'Semi-finals': 101,
  'Final': 104,
};

/**
 * Order a round's fixtures into bracket depth-first slot order (mutates in place).
 *
 * The API does not expose the official FIFA match number, but football-data.org
 * assigns match ids in schedule order, so sorting by apiMatchId recovers the
 * official match sequence within a round. Each fixture's official number is then
 * `base + rank`, and BRACKET_SLOT_ORDER maps that number to its bracket slot.
 *
 * Only applied when the full round is present and every fixture has an
 * apiMatchId. Otherwise (partial data, or manually-entered fixtures with no
 * apiMatchId) it falls back to chronological order, the previous behaviour.
 *
 * @param {string} roundName
 * @param {Array<object>} roundFixtures
 */
function orderRoundFixtures(roundName, roundFixtures) {
  const slotOrder = BRACKET_SLOT_ORDER[roundName];
  const base = ROUND_BASE_MATCH_NUMBER[roundName];
  const fullSet = slotOrder && roundFixtures.length === slotOrder.length;
  const allHaveApiId = roundFixtures.every((f) => f.apiMatchId != null);

  if (fullSet && allHaveApiId) {
    const byOfficialNumber = new Map();
    [...roundFixtures]
      .sort((a, b) => a.apiMatchId - b.apiMatchId)
      .forEach((fixture, rank) => byOfficialNumber.set(base + rank, fixture));

    const ordered = slotOrder.map((num) => byOfficialNumber.get(num));
    if (ordered.every(Boolean)) {
      roundFixtures.splice(0, roundFixtures.length, ...ordered);
      return;
    }
  }

  // Fallback: chronological order.
  roundFixtures.sort((a, b) => new Date(a.date) - new Date(b.date));
}

/**
 * Determine the winner of a knockout fixture given its result.
 * - If one team scored more goals, they win.
 * - If scores are equal and a penalty shootout was played, the shootout winner wins.
 * - If scores are equal with no shootout recorded, returns null (undetermined).
 * @param {object} result - The match result
 * @returns {string|null} The winning team ID, or null if undetermined
 */
export function determineWinner(result) {
  if (result.homeScore > result.awayScore) {
    return result.homeTeam;
  } else if (result.awayScore > result.homeScore) {
    return result.awayTeam;
  } else if (result.penaltyShootout && result.penaltyShootout.winner) {
    return result.penaltyShootout.winner;
  }
  return null;
}

/**
 * Build the knockout bracket structure from fixtures and results.
 *
 * The bracket is organized by round. For each fixture with a result,
 * the winner is determined and placed into the next round's corresponding
 * position. Fixtures without results have team positions marked as "TBD".
 *
 * Progression logic:
 * - Winner of fixture at index i in round N goes to fixture Math.floor(i / 2)
 *   in round N+1.
 * - If i is even, the winner becomes the homeTeam of the next fixture.
 * - If i is odd, the winner becomes the awayTeam of the next fixture.
 *
 * @returns {Promise<object>} Bracket structure with rounds array
 */
export async function getBracketData() {
  const fixturesData = await readFile(FIXTURES_FILE);
  const resultsData = await readFile(RESULTS_FILE);
  const template = await loadBracketTemplate();

  const fixtures = fixturesData.fixtures || [];
  const results = resultsData.results || [];

  // Build a map of fixtureId -> result for quick lookup.
  // Live (in-progress) results are provisional: a match leading at halftime
  // must not be shown as won or advance its team into the next round. Only
  // final results determine winners and bracket progression.
  const resultByFixtureId = new Map();
  for (const result of results) {
    if (result.status === 'live') continue;
    if (result.fixtureId) {
      resultByFixtureId.set(result.fixtureId, result);
    }
  }

  // Group knockout fixtures by round
  const fixturesByRound = new Map();
  for (const round of KNOCKOUT_ROUNDS) {
    fixturesByRound.set(round, []);
  }

  for (const fixture of fixtures) {
    if (KNOCKOUT_ROUNDS.includes(fixture.stage)) {
      fixturesByRound.get(fixture.stage).push(fixture);
    }
  }

  // Order each round into bracket depth-first slot order so the renderer
  // reconstructs the real tournament tree (falls back to date order).
  for (const [roundName, roundFixtures] of fixturesByRound) {
    orderRoundFixtures(roundName, roundFixtures);
  }

  // Generate placeholder fixture slots for rounds that are empty when template is available
  const expectedCounts = { 'Round of 32': 16, 'Round of 16': 8, 'Quarter-finals': 4, 'Semi-finals': 2, 'Final': 1 };
  for (const [roundName, expectedCount] of Object.entries(expectedCounts)) {
    const roundFixtures = fixturesByRound.get(roundName);
    if (roundFixtures.length === 0 && (roundName === 'Round of 32' ? template?.roundOf32?.length > 0 : true)) {
      for (let i = 0; i < expectedCount; i++) {
        roundFixtures.push({
          id: `template-${roundName.toLowerCase().replace(/\s+/g, '-')}-${i + 1}`,
          homeTeam: null,
          awayTeam: null,
          date: null,
          stage: roundName,
        });
      }
    }
  }

  // Build bracket rounds with result data
  const rounds = KNOCKOUT_ROUNDS.map((roundName) => {
    const roundFixtures = fixturesByRound.get(roundName);

    const bracketFixtures = roundFixtures.map((fixture, index) => {
      const result = resultByFixtureId.get(fixture.id);

      const bracketFixture = {
        fixtureId: fixture.id,
        position: index,
        matchNumber: index + 1,
        homeTeam: fixture.homeTeam || 'TBD',
        awayTeam: fixture.awayTeam || 'TBD'
      };

      if (result) {
        bracketFixture.homeScore = result.homeScore;
        bracketFixture.awayScore = result.awayScore;
        bracketFixture.winner = determineWinner(result);

        if (result.penaltyShootout) {
          bracketFixture.penaltyShootout = {
            winner: result.penaltyShootout.winner,
            homeGoals: result.penaltyShootout.homeGoals ?? null,
            awayGoals: result.penaltyShootout.awayGoals ?? null
          };
        }
      }

      return bracketFixture;
    });

    return {
      name: roundName,
      fixtures: bracketFixtures
    };
  });

  // Propagate winners into next round positions
  for (let roundIndex = 0; roundIndex < rounds.length - 1; roundIndex++) {
    const currentRound = rounds[roundIndex];
    const nextRound = rounds[roundIndex + 1];

    for (let fixtureIndex = 0; fixtureIndex < currentRound.fixtures.length; fixtureIndex++) {
      const fixture = currentRound.fixtures[fixtureIndex];

      if (fixture.winner) {
        const nextFixtureIndex = Math.floor(fixtureIndex / 2);

        // Ensure the next round has enough fixture slots
        if (nextFixtureIndex < nextRound.fixtures.length) {
          const nextFixture = nextRound.fixtures[nextFixtureIndex];

          // Only fill a slot the API hasn't already resolved. When the real
          // next-round fixture exists with actual teams, that data is
          // authoritative; propagation is a fallback for undetermined slots
          // only, so it never overwrites a known matchup with a guess.
          if (fixtureIndex % 2 === 0) {
            // Even-indexed fixture winner goes to homeTeam of next fixture
            if (nextFixture.homeTeam === 'TBD') {
              nextFixture.homeTeam = fixture.winner;
            }
          } else {
            // Odd-indexed fixture winner goes to awayTeam of next fixture
            if (nextFixture.awayTeam === 'TBD') {
              nextFixture.awayTeam = fixture.winner;
            }
          }
        }
      }
    }
  }

  // Mark any remaining empty team positions as "TBD"
  for (const round of rounds) {
    for (const fixture of round.fixtures) {
      if (!fixture.homeTeam) {
        fixture.homeTeam = 'TBD';
      }
      if (!fixture.awayTeam) {
        fixture.awayTeam = 'TBD';
      }
    }
  }

  // Resolve placeholders for all fixtures
  for (let roundIndex = 0; roundIndex < rounds.length; roundIndex++) {
    const previousRoundFixtures = roundIndex > 0 ? rounds[roundIndex - 1].fixtures : null;
    for (const fixture of rounds[roundIndex].fixtures) {
      resolvePlaceholders(fixture, roundIndex, template, previousRoundFixtures);
    }
  }

  return { rounds };
}
