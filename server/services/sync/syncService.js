/**
 * Sync Service
 *
 * Orchestrates the sync cycle: fetches data from the football-data.org API,
 * transforms it to match internal formats, and writes updates to local data files.
 *
 * Handles fixture sync, result sync, and group standings sync.
 */

import { fetchFromApi } from './apiClient.js';
import { mapTeamId } from './teamMapper.js';
import { mapMatchStatus } from './statusMapper.js';
import { readFile, writeFile, atomicWriteFile } from '../storageService.js';
import { checkTournamentComplete } from '../tournamentService.js';

/** Valid group names A through L */
const VALID_GROUP_NAMES = new Set([
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L',
]);

/** API statuses that represent a match currently in progress */
const LIVE_API_STATUSES = new Set(['LIVE', 'IN_PLAY', 'PAUSED']);

/**
 * Executes a full sync cycle: fixtures → results → standings.
 *
 * @returns {Promise<SyncResult>}
 *
 * @typedef {Object} SyncResult
 * @property {'success'|'failure'} outcome
 * @property {string} timestamp - ISO 8601 UTC
 * @property {string|null} error - Error details on failure
 * @property {{ fixtures: number, results: number, live: number, standings: boolean }} stats
 */
export async function executeSyncCycle() {
  const timestamp = new Date().toISOString();

  try {
    const stats = { fixtures: 0, results: 0, live: 0, standings: false };

    // Step 1: Fetch matches from the API
    const matchData = await fetchFromApi('/v4/competitions/WC/matches');
    const apiMatches = matchData.matches || [];

    // Step 2: Sync fixtures
    stats.fixtures = await syncFixtures(apiMatches);

    // Step 3: Sync results for FINISHED and in-progress matches
    const resultStats = await syncResults(apiMatches);
    stats.results = resultStats.results;
    stats.live = resultStats.live;

    // Step 4: Sync group standings (if group stage is still active)
    stats.standings = await syncGroupStandings();

    const syncResult = {
      outcome: 'success',
      timestamp,
      error: null,
      stats,
    };

    // Write sync status after successful cycle
    await writeSyncStatus(syncResult);

    return syncResult;
  } catch (error) {
    const errorMessage = error.message || String(error);
    console.error(`[SyncService] Sync cycle failed: ${errorMessage}`);

    const syncResult = {
      outcome: 'failure',
      timestamp,
      error: errorMessage,
      stats: { fixtures: 0, results: 0, live: 0, standings: false },
    };

    // Write sync status after failed cycle
    try {
      await writeSyncStatus(syncResult);
    } catch (writeError) {
      console.error(`[SyncService] Failed to write sync status: ${writeError.message || writeError}`);
    }

    return syncResult;
  }
}

/**
 * Writes the sync status to sync-status.json using atomic writes.
 *
 * @param {SyncResult} syncResult - The result of the sync cycle
 * @returns {Promise<void>}
 */
async function writeSyncStatus(syncResult) {
  const statusData = {
    lastSync: {
      timestamp: syncResult.timestamp,
      outcome: syncResult.outcome,
      error: syncResult.error || null,
      stats: {
        fixturesUpdated: syncResult.stats.fixtures,
        resultsCreated: syncResult.stats.results,
        liveUpdated: syncResult.stats.live,
        standingsUpdated: syncResult.stats.standings,
      },
    },
  };

  await atomicWriteFile('sync-status.json', statusData);
}

/**
 * Syncs fixture data from API matches into fixtures.json.
 *
 * - Matches API entries to existing fixtures by `apiMatchId`
 * - Updates existing fixtures (date, status)
 * - Creates new entries for unmatched API matches with valid team mappings
 * - Skips matches with unmapped teams (logs warning)
 * - Skips matches with unknown status (retains current fixture status, logs warning)
 * - Never removes or modifies fixtures that have no corresponding API match
 *
 * @param {Array<object>} apiMatches - Matches from the API response
 * @returns {Promise<number>} Number of fixtures updated or created
 */
async function syncFixtures(apiMatches) {
  const fixtureData = await readFile('fixtures.json');
  const existingFixtures = fixtureData.fixtures || [];

  // Build a lookup map of existing fixtures by apiMatchId
  const fixturesByApiMatchId = new Map();
  for (const fixture of existingFixtures) {
    if (fixture.apiMatchId != null) {
      fixturesByApiMatchId.set(fixture.apiMatchId, fixture);
    }
  }

  let updatedCount = 0;
  const newFixtures = [];

  for (const match of apiMatches) {
    const apiMatchId = match.id;

    // Map teams
    const homeTeam = mapTeamId(match.homeTeam?.id);
    const awayTeam = mapTeamId(match.awayTeam?.id);

    if (homeTeam === null || awayTeam === null) {
      console.warn(
        `[SyncService] Skipping match ${apiMatchId}: unmapped team(s) ` +
        `(home: ${match.homeTeam?.id} → ${homeTeam}, away: ${match.awayTeam?.id} → ${awayTeam})`
      );
      continue;
    }

    // Map status
    const { status: mappedStatus, known } = mapMatchStatus(match.status);

    const existingFixture = fixturesByApiMatchId.get(apiMatchId);

    if (existingFixture) {
      // Update existing fixture
      let changed = false;

      // Update date if changed
      if (match.utcDate && existingFixture.date !== match.utcDate) {
        existingFixture.date = match.utcDate;
        changed = true;
      }

      // Update status if known
      if (known && mappedStatus !== null) {
        // "completed" status is only set by the result sync step (requirement 10.3/10.4)
        // Fixture sync defers "completed" transitions to syncResults()
        if (mappedStatus === 'completed') {
          // Only set to "completed" if fixture already has that status
          // (i.e., don't regress it). The result sync will handle the transition.
        } else if (existingFixture.status === 'completed') {
          // Requirement 10.2: If fixture is "completed" but API reports non-FINISHED,
          // update status and log a warning about the correction
          console.warn(
            `[SyncService] Status correction for match ${apiMatchId}: ` +
            `fixture was "completed" but API reports "${match.status}", ` +
            `updating to "${mappedStatus}"`
          );
          existingFixture.status = mappedStatus;
          changed = true;
        } else if (existingFixture.status !== mappedStatus) {
          existingFixture.status = mappedStatus;
          changed = true;
        }
      } else if (!known) {
        console.warn(
          `[SyncService] Unknown status "${match.status}" for match ${apiMatchId}, ` +
          `retaining current fixture status "${existingFixture.status}"`
        );
      }

      // Update team mappings in case they changed
      if (existingFixture.homeTeam !== homeTeam) {
        existingFixture.homeTeam = homeTeam;
        changed = true;
      }
      if (existingFixture.awayTeam !== awayTeam) {
        existingFixture.awayTeam = awayTeam;
        changed = true;
      }

      if (changed) {
        updatedCount++;
      }
    } else {
      // Create new fixture entry — skip if status is unknown
      if (!known) {
        console.warn(
          `[SyncService] Unknown status "${match.status}" for new match ${apiMatchId}, ` +
          `skipping creation (cannot determine initial status)`
        );
        continue;
      }

      const newFixture = {
        id: generateFixtureId(existingFixtures, newFixtures),
        apiMatchId,
        homeTeam,
        awayTeam,
        date: match.utcDate || null,
        stage: mapStage(match.stage, match.group),
        status: mappedStatus,
      };

      newFixtures.push(newFixture);
      updatedCount++;
    }
  }

  // Only write if there were changes
  if (updatedCount > 0 || newFixtures.length > 0) {
    const allFixtures = [...existingFixtures, ...newFixtures];
    await writeFile('fixtures.json', { fixtures: allFixtures });
  }

  return updatedCount;
}

/**
 * Generates a unique fixture ID.
 * Uses format "f" + zero-padded number.
 *
 * @param {Array<object>} existingFixtures - Current fixtures
 * @param {Array<object>} newFixtures - Newly created fixtures in this cycle
 * @returns {string} A unique fixture ID
 */
function generateFixtureId(existingFixtures, newFixtures) {
  const allFixtures = [...existingFixtures, ...newFixtures];
  let maxNum = 0;

  for (const fixture of allFixtures) {
    if (fixture.id && fixture.id.startsWith('f')) {
      const num = parseInt(fixture.id.slice(1), 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    }
  }

  const nextNum = maxNum + 1;
  return `f${String(nextNum).padStart(3, '0')}`;
}

/**
 * Maps API stage/group values to the application's stage format.
 *
 * @param {string} apiStage - API stage value (e.g., "GROUP_STAGE", "ROUND_OF_16")
 * @param {string|null} group - API group value (e.g., "GROUP_A")
 * @returns {string} Application stage string
 */
function mapStage(apiStage, group) {
  const stageMap = {
    GROUP_STAGE: 'Group Stage',
    LAST_16: 'Round of 16',
    ROUND_OF_16: 'Round of 16',
    LAST_32: 'Round of 32',
    ROUND_OF_32: 'Round of 32',
    QUARTER_FINALS: 'Quarter-finals',
    SEMI_FINALS: 'Semi-finals',
    THIRD_PLACE: 'Third Place',
    FINAL: 'Final',
  };

  return stageMap[apiStage] || apiStage || 'Unknown';
}

/**
 * Syncs result data from FINISHED and in-progress API matches into results.json.
 *
 * - Processes matches with status "FINISHED" (final) and LIVE/IN_PLAY/PAUSED (live)
 * - Matches API entries to existing fixtures by `apiMatchId`
 * - Creates or updates result entries matched by fixtureId
 * - Tags each result with `status`: "live" (in progress) or "completed" (final)
 * - Stores homeScore and awayScore as non-negative integers (0–99)
 * - Handles penalty shootout data for finished matches when scores are equal
 * - Sets fixture status to "completed" only when a finished result entry exists
 * - Removes a stale "live" result if its match reverts to a non-active status
 *   (e.g. postponed/suspended after kickoff)
 * - Prevents duplicate results for same fixtureId (updates existing)
 * - Triggers checkTournamentComplete() only when finished results are written
 *
 * Live results are provisional: standings count them immediately (so the table
 * updates in real time), but they never eliminate teams or complete the
 * tournament — that is gated on "completed" results elsewhere.
 *
 * @param {Array<object>} apiMatches - Matches from the API response
 * @returns {Promise<{ results: number, live: number }>}
 *   results: number of result entries created/updated/removed this cycle
 *   live: number of matches currently in progress
 */
async function syncResults(apiMatches) {
  // Read current fixtures and results
  const fixtureData = await readFile('fixtures.json');
  const existingFixtures = fixtureData.fixtures || [];
  const resultData = await readFile('results.json');
  const existingResults = resultData.results || [];

  // Build lookup maps
  const fixturesByApiMatchId = new Map();
  for (const fixture of existingFixtures) {
    if (fixture.apiMatchId != null) {
      fixturesByApiMatchId.set(fixture.apiMatchId, fixture);
    }
  }

  const resultsByFixtureId = new Map();
  for (const result of existingResults) {
    if (result.fixtureId != null) {
      resultsByFixtureId.set(result.fixtureId, result);
    }
  }

  let resultCount = 0;
  let liveCount = 0;
  let fixturesModified = false;
  let finishedResultWritten = false;
  const removedResultIds = new Set();

  for (const match of apiMatches) {
    const apiMatchId = match.id;
    const isFinished = match.status === 'FINISHED';
    const isLive = LIVE_API_STATUSES.has(match.status);

    // Find the corresponding fixture
    const fixture = fixturesByApiMatchId.get(apiMatchId);

    // Match is neither finished nor live: if we previously stored a provisional
    // "live" result for it, the match reverted (postponed/suspended) — drop it.
    if (!isFinished && !isLive) {
      if (fixture) {
        const existingResult = resultsByFixtureId.get(fixture.id);
        if (existingResult && existingResult.status === 'live') {
          removedResultIds.add(existingResult.id);
          resultsByFixtureId.delete(fixture.id);
          resultCount++;
        }
      }
      continue;
    }

    if (!fixture) {
      // Only warn for finished matches; live matches with no fixture are noisy and transient
      if (isFinished) {
        console.warn(
          `[SyncService] Skipping finished match ${apiMatchId}: ` +
          `no matching fixture found (home: ${match.homeTeam?.name}, away: ${match.awayTeam?.name})`
        );
      }
      continue;
    }

    if (isLive) {
      liveCount++;
    }

    // Extract scores from the API response (fullTime holds the running score while in play)
    const homeScore = match.score?.fullTime?.home;
    const awayScore = match.score?.fullTime?.away;

    // Validate scores are non-negative integers in range 0–99.
    // A live match before kickoff may report null scores — skip quietly in that case.
    if (!isValidScore(homeScore) || !isValidScore(awayScore)) {
      if (isFinished) {
        console.warn(
          `[SyncService] Skipping result for match ${apiMatchId}: ` +
          `invalid scores (home: ${homeScore}, away: ${awayScore})`
        );
      }
      continue;
    }

    // Clamp scores to 0–99 range
    const clampedHomeScore = Math.min(Math.max(Math.floor(homeScore), 0), 99);
    const clampedAwayScore = Math.min(Math.max(Math.floor(awayScore), 0), 99);

    const status = isFinished ? 'completed' : 'live';

    // Penalty shootouts only apply to finished matches
    const penaltyShootout = isFinished
      ? buildPenaltyShootout(match, fixture, clampedHomeScore, clampedAwayScore)
      : null;

    // Check if a result already exists for this fixture
    const existingResult = resultsByFixtureId.get(fixture.id);

    if (existingResult) {
      // Update existing result
      const changed =
        existingResult.homeScore !== clampedHomeScore ||
        existingResult.awayScore !== clampedAwayScore ||
        existingResult.status !== status;

      existingResult.homeScore = clampedHomeScore;
      existingResult.awayScore = clampedAwayScore;
      existingResult.status = status;
      existingResult.penaltyShootout = penaltyShootout;

      if (changed) {
        resultCount++;
      }
    } else {
      // Create new result entry
      const newResult = {
        id: generateResultId(existingResults),
        fixtureId: fixture.id,
        homeTeam: fixture.homeTeam,
        awayTeam: fixture.awayTeam,
        homeScore: clampedHomeScore,
        awayScore: clampedAwayScore,
        date: fixture.date || new Date().toISOString(),
        stage: fixture.stage || 'Unknown',
        status,
        penaltyShootout,
      };

      existingResults.push(newResult);
      resultsByFixtureId.set(fixture.id, newResult);
      resultCount++;
    }

    if (isFinished) {
      finishedResultWritten = true;

      // Set fixture status to "completed" now that a finished result entry exists
      if (fixture.status !== 'completed') {
        fixture.status = 'completed';
        fixturesModified = true;
      }
    }
  }

  // Write updated data if there were changes
  if (resultCount > 0) {
    const finalResults = removedResultIds.size > 0
      ? existingResults.filter(r => !removedResultIds.has(r.id))
      : existingResults;

    await writeFile('results.json', { results: finalResults });

    // Write fixtures if any status changed to "completed"
    if (fixturesModified) {
      await writeFile('fixtures.json', { fixtures: existingFixtures });
    }

    // Trigger tournament completion check only when a finished result was written
    if (finishedResultWritten) {
      await checkTournamentComplete();
    }
  }

  return { results: resultCount, live: liveCount };
}

/**
 * Validates that a score is a non-negative integer within the 0–99 range.
 *
 * @param {*} score - The score value to validate
 * @returns {boolean} True if the score is a valid non-negative integer
 */
function isValidScore(score) {
  return typeof score === 'number' && Number.isFinite(score) && score >= 0 && score <= 99;
}

/**
 * Builds penalty shootout data from the API match response.
 * Only populates when full-time scores are equal and penalty data is available.
 *
 * @param {object} match - The API match object
 * @param {object} fixture - The matched fixture
 * @param {number} homeScore - The validated home score
 * @param {number} awayScore - The validated away score
 * @returns {object|null} Penalty shootout data or null
 */
function buildPenaltyShootout(match, fixture, homeScore, awayScore) {
  // Penalty shootout only applies when scores are equal
  if (homeScore !== awayScore) {
    return null;
  }

  const penHome = match.score?.penalties?.home;
  const penAway = match.score?.penalties?.away;

  // If no penalty data available, return null
  if (penHome == null || penAway == null) {
    return null;
  }

  // Validate penalty scores are non-negative integers
  if (typeof penHome !== 'number' || penHome < 0 || typeof penAway !== 'number' || penAway < 0) {
    return null;
  }

  const penHomeGoals = Math.floor(penHome);
  const penAwayGoals = Math.floor(penAway);

  // Determine winner based on penalty scores
  let winner;
  if (penHomeGoals > penAwayGoals) {
    winner = fixture.homeTeam;
  } else if (penAwayGoals > penHomeGoals) {
    winner = fixture.awayTeam;
  } else {
    // Equal penalty scores shouldn't happen in practice, but handle gracefully
    return null;
  }

  return {
    winner,
    homeGoals: penHomeGoals,
    awayGoals: penAwayGoals,
  };
}

/**
 * Generates a unique result ID.
 * Uses format "r" + zero-padded number.
 *
 * @param {Array<object>} existingResults - Current results
 * @returns {string} A unique result ID
 */
function generateResultId(existingResults) {
  let maxNum = 0;

  for (const result of existingResults) {
    if (result.id && result.id.startsWith('r')) {
      const num = parseInt(result.id.slice(1), 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    }
  }

  const nextNum = maxNum + 1;
  return `r${String(nextNum).padStart(3, '0')}`;
}

/**
 * Syncs group standings from the API when the group stage is still active.
 *
 * - Checks if at least one Group Stage fixture has status "scheduled" or "in_progress"
 * - If all Group Stage fixtures are "completed", skips the standings fetch
 * - Fetches standings from `/v4/competitions/WC/standings`
 * - Reorders team codes within each group's `teams` array to match API position order
 * - Preserves group structure (names A–L), only updates ordering
 * - Skips unrecognised group names (logs warning)
 *
 * @returns {Promise<boolean>} True if standings were updated, false if skipped
 */
async function syncGroupStandings() {
  // Read current fixtures to determine if group stage is still active
  const fixtureData = await readFile('fixtures.json');
  const existingFixtures = fixtureData.fixtures || [];

  // Find all Group Stage fixtures
  const groupStageFixtures = existingFixtures.filter(f => f.stage === 'Group Stage');

  // If there are no group stage fixtures, skip (nothing to check)
  if (groupStageFixtures.length === 0) {
    return false;
  }

  // Check if at least one Group Stage fixture is "scheduled" or "in_progress"
  const hasActiveGroupFixture = groupStageFixtures.some(
    f => f.status === 'scheduled' || f.status === 'in_progress'
  );

  // If all Group Stage fixtures are completed, skip standings fetch
  if (!hasActiveGroupFixture) {
    return false;
  }

  // Fetch standings from the API
  const standingsData = await fetchFromApi('/v4/competitions/WC/standings');
  const standings = standingsData.standings || [];

  // Read current groups
  const groupsData = await readFile('groups.json');
  const groups = groupsData.groups || [];

  // Build a lookup map of groups by name
  const groupsByName = new Map();
  for (const group of groups) {
    groupsByName.set(group.name, group);
  }

  let updated = false;

  // Process each standings entry from the API
  for (const standing of standings) {
    // Only process TOTAL type standings for GROUP_STAGE
    if (standing.type !== 'TOTAL') {
      continue;
    }

    // Extract group letter from API group name (e.g., "GROUP_A" → "A")
    const groupName = extractGroupName(standing.group);

    if (groupName === null) {
      console.warn(
        `[SyncService] Skipping unrecognised group in standings: "${standing.group}"`
      );
      continue;
    }

    // Check if this is a valid group name (A–L)
    if (!VALID_GROUP_NAMES.has(groupName)) {
      console.warn(
        `[SyncService] Skipping unrecognised group name: "${groupName}" (from "${standing.group}")`
      );
      continue;
    }

    // Find the corresponding group in our data
    const group = groupsByName.get(groupName);
    if (!group) {
      console.warn(
        `[SyncService] Group "${groupName}" not found in groups.json, skipping`
      );
      continue;
    }

    const table = standing.table || [];

    // Build the new team order from the API standings positions
    const newOrder = [];
    for (const entry of table) {
      const teamCode = mapTeamId(entry.team?.id);
      if (teamCode === null) {
        // Skip unmapped teams in standings — don't reorder this group
        console.warn(
          `[SyncService] Unmapped team ID ${entry.team?.id} in standings for group ${groupName}, ` +
          `skipping group reorder`
        );
        newOrder.length = 0; // Clear to signal we should skip this group
        break;
      }
      newOrder.push(teamCode);
    }

    // If we couldn't map all teams, skip this group
    if (newOrder.length === 0) {
      continue;
    }

    // Only include teams that are already in the group (preserve membership)
    const existingTeamSet = new Set(group.teams);
    const reorderedTeams = newOrder.filter(code => existingTeamSet.has(code));

    // Add any teams from the group that weren't in the API response (append at end)
    for (const existingTeam of group.teams) {
      if (!reorderedTeams.includes(existingTeam)) {
        reorderedTeams.push(existingTeam);
      }
    }

    // Only update if the order actually changed
    if (JSON.stringify(group.teams) !== JSON.stringify(reorderedTeams)) {
      group.teams = reorderedTeams;
      updated = true;
    }
  }

  // Write updated groups if any changes were made
  if (updated) {
    await writeFile('groups.json', { groups });
  }

  return updated;
}

/**
 * Extracts the group letter from an API group string.
 * E.g., "GROUP_A" → "A", "GROUP_L" → "L"
 *
 * @param {string|null|undefined} apiGroup - The API group string
 * @returns {string|null} The group letter or null if unrecognised
 */
function extractGroupName(apiGroup) {
  if (!apiGroup || typeof apiGroup !== 'string') {
    return null;
  }

  const match = apiGroup.match(/^GROUP_([A-Z])$/);
  return match ? match[1] : null;
}
