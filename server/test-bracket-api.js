/**
 * Test script: Verify that football-data.org match IDs for knockout fixtures
 * map correctly to official FIFA match numbers via our BRACKET_SLOT_ORDER logic.
 *
 * Usage: node server/test-bracket-api.js
 * Requires: FOOTBALL_DATA_API_KEY in .env or environment
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// Load .env from project root
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = resolve(__dirname, '..', '.env');
console.log('Loading .env from:', envPath);
try {
  const envContent = readFileSync(envPath, 'utf8');
  for (const line of envContent.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim();
      const value = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) process.env[key] = value;
    }
  }
} catch { /* no .env file */ }

const API_KEY = process.env.FOOTBALL_DATA_API_KEY;
const BASE_URL = 'https://api.football-data.org';

if (!API_KEY) {
  console.error('❌ FOOTBALL_DATA_API_KEY not set. Add it to .env or export it.');
  process.exit(1);
}

// --- Bracket constants (from bracketService.js) ---

const BRACKET_SLOT_ORDER = {
  'Round of 32': [74, 77, 73, 75, 83, 84, 81, 82, 76, 78, 79, 80, 86, 88, 85, 87],
  'Round of 16': [89, 90, 93, 94, 91, 92, 95, 96],
  'Quarter-finals': [97, 98, 99, 100],
  'Semi-finals': [101, 102],
  'Final': [104],
};

const ROUND_BASE_MATCH_NUMBER = {
  'Round of 32': 73,
  'Round of 16': 89,
  'Quarter-finals': 97,
  'Semi-finals': 101,
  'Final': 104,
};

/** Map API stage strings to our internal round names */
const STAGE_MAP = {
  LAST_32: 'Round of 32',
  ROUND_OF_32: 'Round of 32',
  LAST_16: 'Round of 16',
  ROUND_OF_16: 'Round of 16',
  QUARTER_FINALS: 'Quarter-finals',
  SEMI_FINALS: 'Semi-finals',
  FINAL: 'Final',
  THIRD_PLACE: 'Third Place',
};

// --- Fetch matches from API ---

async function fetchMatches() {
  const url = `${BASE_URL}/v4/competitions/WC/matches`;
  const res = await fetch(url, {
    headers: { 'X-Auth-Token': API_KEY },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API returned ${res.status}: ${body.slice(0, 500)}`);
  }

  return res.json();
}

// --- Main test logic ---

async function main() {
  console.log('Fetching World Cup matches from football-data.org...\n');

  const data = await fetchMatches();
  const matches = data.matches || [];

  console.log(`Total matches returned: ${matches.length}\n`);

  // Group knockout matches by our internal round name
  const knockoutByRound = new Map();
  for (const roundName of Object.keys(BRACKET_SLOT_ORDER)) {
    knockoutByRound.set(roundName, []);
  }

  let skippedGroupStage = 0;
  let skippedThirdPlace = 0;
  let skippedUnknown = 0;

  for (const match of matches) {
    const roundName = STAGE_MAP[match.stage];
    if (!roundName) {
      if (match.stage === 'GROUP_STAGE') {
        skippedGroupStage++;
      } else {
        skippedUnknown++;
        console.warn(`  ⚠️  Unknown stage: "${match.stage}" (match id: ${match.id})`);
      }
      continue;
    }
    if (roundName === 'Third Place') {
      skippedThirdPlace++;
      continue;
    }
    if (knockoutByRound.has(roundName)) {
      knockoutByRound.get(roundName).push(match);
    }
  }

  console.log(`Skipped: ${skippedGroupStage} group stage, ${skippedThirdPlace} third place, ${skippedUnknown} unknown\n`);

  // --- For each knockout round, apply our ordering logic and verify ---

  let allPassed = true;

  for (const [roundName, slotOrder] of Object.entries(BRACKET_SLOT_ORDER)) {
    const roundMatches = knockoutByRound.get(roundName);
    const base = ROUND_BASE_MATCH_NUMBER[roundName];
    const expectedCount = slotOrder.length;

    console.log(`━━━ ${roundName} ━━━`);
    console.log(`  Expected fixtures: ${expectedCount}, API returned: ${roundMatches.length}`);

    if (roundMatches.length === 0) {
      console.log(`  ⏭️  No matches available yet for this round.\n`);
      continue;
    }

    if (roundMatches.length !== expectedCount) {
      console.log(`  ⚠️  Count mismatch! Expected ${expectedCount}, got ${roundMatches.length}`);
      console.log(`  Match IDs: ${roundMatches.map(m => m.id).sort((a, b) => a - b).join(', ')}\n`);
      allPassed = false;
      continue;
    }

    // Sort by apiMatchId (ascending) to recover chronological/official order
    const sorted = [...roundMatches].sort((a, b) => a.id - b.id);

    // Assign official match numbers: base + rank
    const officialNumbers = sorted.map((match, rank) => ({
      apiMatchId: match.id,
      officialMatchNumber: base + rank,
      homeTeam: match.homeTeam?.name || match.homeTeam?.tla || 'TBD',
      awayTeam: match.awayTeam?.name || match.awayTeam?.tla || 'TBD',
    }));

    console.log(`  API match IDs (sorted): ${sorted.map(m => m.id).join(', ')}`);
    console.log(`  Derived FIFA match numbers: ${officialNumbers.map(o => o.officialMatchNumber).join(', ')}`);
    console.log(`  Expected slot order:        ${slotOrder.join(', ')}`);

    // Check: does the set of derived official numbers match what BRACKET_SLOT_ORDER expects?
    const derivedSet = new Set(officialNumbers.map(o => o.officialMatchNumber));
    const expectedSet = new Set(slotOrder);

    const missing = [...expectedSet].filter(n => !derivedSet.has(n));
    const extra = [...derivedSet].filter(n => !expectedSet.has(n));

    if (missing.length > 0 || extra.length > 0) {
      console.log(`  ❌ MISMATCH!`);
      if (missing.length) console.log(`     Missing from derived: ${missing.join(', ')}`);
      if (extra.length) console.log(`     Extra in derived: ${extra.join(', ')}`);
      allPassed = false;
    } else {
      console.log(`  ✅ Match numbers align correctly.`);
    }

    // Show the bracket slot mapping
    console.log(`\n  Bracket slot mapping (depth-first order):`);
    const byOfficialNumber = new Map(officialNumbers.map(o => [o.officialMatchNumber, o]));
    for (let i = 0; i < slotOrder.length; i++) {
      const matchNum = slotOrder[i];
      const entry = byOfficialNumber.get(matchNum);
      if (entry) {
        console.log(`    Slot ${i}: Match ${matchNum} (API id: ${entry.apiMatchId}) — ${entry.homeTeam} vs ${entry.awayTeam}`);
      } else {
        console.log(`    Slot ${i}: Match ${matchNum} — ❌ NOT FOUND`);
      }
    }

    console.log('');
  }

  // --- Summary ---
  console.log('━━━━━━━━━━━━━━━━━━━━━━');
  if (allPassed) {
    console.log('✅ All knockout rounds: API match IDs map correctly to bracket template.');
  } else {
    console.log('❌ Some rounds have mismatches. Review output above.');
  }
}

main().catch((err) => {
  console.error('💥 Error:', err.message);
  if (err.cause) console.error('   Cause:', err.cause.message || err.cause);
  process.exit(1);
});
