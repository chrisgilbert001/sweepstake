# Design Document

## Overview

This feature replaces generic "TBD" labels in the knockout bracket with meaningful placeholders that describe the group-stage origin of each position. A static bracket template JSON file defines the FIFA 2026 Round of 32 matchup mapping, and the bracket service resolves these placeholders against actual group standings. Later rounds use match-position references (e.g., "W1") to trace the bracket path.

## Architecture

The feature follows the existing data-driven architecture:

```
bracket-template.json (static data)
        │
        ▼
bracketService.js (reads template, resolves placeholders)
        │
        ▼
GET /bracket API response (includes placeholder fields)
        │
        ▼
KnockoutBracket.jsx (renders placeholders in SVG)
```

No new services or routes are needed. The change extends the existing `bracketService.js` and `KnockoutBracket.jsx`.

## Components and Interfaces

### 1. Bracket Template Data File (`server/data/bracket-template.json`)

A static JSON file defining the FIFA 2026 Round of 32 structure. This file is read by the bracket service and never modified at runtime.

**Structure:**
- `roundOf32`: Array of 16 match objects, each with `matchNumber` (1-16), `home` (position reference), and `away` (position reference).
- `thirdPlaceAllocations`: Object mapping qualifying-group combinations to slot assignments. Each key is a slash-separated sorted list of the 8 groups whose third-place teams qualify. Values map slot identifiers to the "3rd X/Y/Z" label used in the `roundOf32` entries.

```json
{
  "roundOf32": [
    { "matchNumber": 1, "home": "1A", "away": "2B" },
    { "matchNumber": 2, "home": "1C", "away": "2D" }
  ],
  "thirdPlaceAllocations": {
    "A/B/C/D/E/F/G/H": { "slot1": "3rd A/B", "slot2": "3rd C/D" }
  }
}
```

Position reference formats:
- Group winners/runners-up: `"1A"`, `"2L"` (position + group letter)
- Third-place qualifiers: `"3rd A/B/C"` (possible source groups)

### 2. Bracket Service Enhancements (`server/services/bracketService.js`)

**New responsibilities:**
- Read `bracket-template.json` on each request
- Attach `homePlaceholder` and `awayPlaceholder` fields to each fixture
- For Round of 32: resolve from template position references
- For later rounds: generate "W{N}" match-position references
- Handle missing/malformed template gracefully (fallback to "TBD")

**New internal function:**

```javascript
/**
 * Load the bracket template, returning null if missing or malformed.
 * @returns {Promise<object|null>}
 */
async function loadBracketTemplate() {
  try {
    return await readFile('bracket-template.json');
  } catch (err) {
    console.warn('Bracket template unavailable, using TBD fallback:', err.message);
    return null;
  }
}
```

**Modified `getBracketData()` flow:**

1. Load fixtures, results, and bracket template
2. Build rounds as before (group by stage, sort by date)
3. Assign sequential match numbers within each round (1-based, by date order)
4. Attach placeholders:
   - Round of 32: use template's `home`/`away` values for TBD positions
   - Later rounds: use `"W{N}"` where N is the source match number from the previous round
5. Propagate winners (existing logic)
6. Set placeholder to `null` for any position that has a resolved team ID

**Placeholder resolution logic:**

```javascript
/**
 * Resolve placeholders for a single fixture.
 * @param {object} fixture - The bracket fixture object
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
    // Later rounds: use W{N} referencing previous round
    const homeSourceIndex = fixture.position * 2;
    const awaySourceIndex = fixture.position * 2 + 1;
    const homeSourceMatch = previousRoundFixtures[homeSourceIndex];
    const awaySourceMatch = previousRoundFixtures[awaySourceIndex];

    fixture.homePlaceholder = fixture.homeTeam === 'TBD'
      ? (homeSourceMatch ? `W${homeSourceMatch.matchNumber}` : 'TBD')
      : null;
    fixture.awayPlaceholder = fixture.awayTeam === 'TBD'
      ? (awaySourceMatch ? `W${awaySourceMatch.matchNumber}` : 'TBD')
      : null;
  }
}
```

### 3. Client Display Changes (`client/src/components/KnockoutBracket.jsx`)

**Modified `getDisplayName()` function:**

```javascript
function getDisplayName(teamId, teamNameMap, placeholder) {
  if (teamId === 'TBD') {
    return placeholder || 'TBD';
  }
  return teamNameMap[teamId] || teamId;
}
```

**Modified `FixtureBox` component:**
- Read `homePlaceholder` and `awayPlaceholder` from `fixture.data`
- Pass placeholder to `getDisplayName`
- Apply `font-style: italic` and muted color to placeholder text via a conditional check

```javascript
const isHomePlaceholder = fixture.homeTeam === 'TBD';
const isAwayPlaceholder = fixture.awayTeam === 'TBD';
// Use fontStyle="italic" and fill with muted color for placeholder text
```

### 4. Bracket API Response (extended fixture object)

```javascript
{
  fixtureId: "f049",
  position: 0,
  matchNumber: 1,              // NEW: 1-based sequential within round
  homeTeam: "TBD",
  awayTeam: "TBD",
  homePlaceholder: "1A",       // NEW: null when homeTeam is resolved
  awayPlaceholder: "2B",       // NEW: null when awayTeam is resolved
  // ... existing fields (homeScore, awayScore, winner, penaltyShootout)
}
```

### 5. Bracket Template Schema

```javascript
{
  roundOf32: Array<{
    matchNumber: number,        // 1-16
    home: string,              // e.g. "1A", "3rd A/B/C"
    away: string               // e.g. "2B", "3rd D/E/F"
  }>,
  thirdPlaceAllocations: {
    [groupCombination: string]: {
      [slotLabel: string]: string  // maps "3rd X/Y/Z" label to assigned slot
    }
  }
}
```

## Data Models

### Fixture Object (extended)

| Field | Type | Description |
|-------|------|-------------|
| `fixtureId` | string | Unique fixture identifier |
| `position` | number | 0-based index within round |
| `matchNumber` | number | 1-based sequential number within round (by date) |
| `homeTeam` | string | Team ID or "TBD" |
| `awayTeam` | string | Team ID or "TBD" |
| `homePlaceholder` | string \| null | Placeholder label when homeTeam is "TBD", null otherwise |
| `awayPlaceholder` | string \| null | Placeholder label when awayTeam is "TBD", null otherwise |
| `homeScore` | number \| undefined | Home team score (when result exists) |
| `awayScore` | number \| undefined | Away team score (when result exists) |
| `winner` | string \| null \| undefined | Winner team ID |
| `penaltyShootout` | object \| undefined | Penalty shootout details |

### Placeholder Resolution Rules

| Round | Source | Format | Example |
|-------|--------|--------|---------|
| Round of 32 | bracket-template.json | `"{position}{group}"` or `"3rd {groups}"` | "1A", "3rd A/B/C" |
| Round of 16 | Previous round match numbers | `"W{N}"` | "W1", "W2" |
| Quarter-finals | Previous round match numbers | `"W{N}"` | "W1", "W2" |
| Semi-finals | Previous round match numbers | `"W{N}"` | "W1", "W2" |
| Final | Previous round match numbers | `"W{N}"` | "W1", "W2" |

## Error Handling

| Scenario | Behavior |
|----------|----------|
| `bracket-template.json` missing | Log warning, use "TBD" for all R32 placeholders |
| `bracket-template.json` malformed JSON | Log warning, use "TBD" for all R32 placeholders |
| Template has fewer than 16 entries | Use template entries where available, "TBD" for missing slots |
| Fixture position exceeds template entries | Use "TBD" as placeholder |
| Match number reference invalid | Use "TBD" as placeholder |

## Testing Strategy

**Unit tests** (Vitest, example-based):
- Bracket template file structure validation (16 entries, correct format)
- Error handling: missing template fallback, malformed template fallback
- Visual styling: placeholder text gets italic/muted treatment

**Property-based tests** (fast-check):
- Placeholder resolution correctness across generated bracket states
- Mutual exclusivity of team ID and placeholder
- Match number sequencing invariant
- Display function behavior across generated fixtures

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Round of 32 placeholder resolution from template

*For any* Round of 32 fixture where a team position is "TBD" and a valid bracket template is loaded, the corresponding placeholder field shall contain the exact value from the bracket template's matching entry (by position index), and shall be a non-empty string.

**Validates: Requirements 2.1, 3.1, 3.4**

### Property 2: Determined team nullifies placeholder

*For any* fixture in any round where a team position contains a valid team ID (not "TBD"), the corresponding placeholder field shall be null.

**Validates: Requirements 2.2, 3.2, 3.3**

### Property 3: Cascading match references for later rounds

*For any* fixture in a round beyond the Round of 32 where a team position is "TBD", the corresponding placeholder shall be in the format "W{N}" where N is a valid 1-based match number from the immediately preceding round, and the referenced match is the correct source match based on the fixture's position within its round.

**Validates: Requirements 2.3, 5.1, 5.2, 5.3**

### Property 4: Sequential match numbering

*For any* round in the bracket, the match numbers assigned to fixtures shall be sequential integers starting from 1, ordered by fixture date ascending.

**Validates: Requirements 5.4**

### Property 5: Display function prefers placeholder over TBD

*For any* fixture where a team position is "TBD" and a non-null placeholder value is present, the display function shall return the placeholder value; when no placeholder is present, it shall return "TBD".

**Validates: Requirements 4.1, 4.2, 4.3**

### Property 6: Placeholder and team ID mutual exclusivity

*For any* fixture in the bracket response, for each position (home/away): either the team is "TBD" and the placeholder is a non-empty string, or the team is a valid ID and the placeholder is null. No other combination is valid.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**
