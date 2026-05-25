---
inclusion: fileMatch
fileMatchPattern: "server/data/**"
---

# Data File Schemas

Reference for all JSON data files in `server/data/`.

## fixtures.json

```json
{
  "fixtures": [
    {
      "id": "f001",
      "apiMatchId": 12345,          // optional - set by sync service
      "homeTeam": "esp",            // 3-letter team code
      "awayTeam": "arg",            // 3-letter team code
      "date": "2026-06-15T18:00:00Z",
      "stage": "Group Stage",       // "Group Stage" | "Round of 16" | "Quarter-finals" | "Semi-finals" | "Third Place" | "Final"
      "group": "A",                 // optional - only for Group Stage
      "status": "scheduled"         // "scheduled" | "in_progress" | "completed" | "postponed"
    }
  ]
}
```

## results.json

```json
{
  "results": [
    {
      "id": "r001",
      "fixtureId": "f001",
      "homeTeam": "esp",
      "awayTeam": "arg",
      "homeScore": 2,               // non-negative integer 0-99
      "awayScore": 1,               // non-negative integer 0-99
      "date": "2026-06-15T18:00:00Z",
      "stage": "Group Stage",
      "penaltyShootout": null       // null or { "winner": "esp", "homeGoals": 4, "awayGoals": 3 }
    }
  ]
}
```

## groups.json

```json
{
  "groups": [
    {
      "name": "A",                  // single letter A-L
      "teams": ["mex", "rsa", "kor", "cze"]  // 4 team codes, ordered by standings position
    }
  ]
}
```

## teams.json

```json
{
  "pots": [
    {
      "potNumber": 1,               // 1-4
      "teams": [
        { "id": "esp", "name": "Spain", "seedRank": 1 }
      ]
    }
  ]
}
```

## leagues/{slug}.json

```json
{
  "slug": "the-lads",
  "name": "The Lads",
  "joinCode": "abc123",            // 6-char alphanumeric
  "createdAt": "2026-06-01T10:00:00.000Z",
  "participants": [
    { "id": "p1", "name": "Dave" }  // max 6 participants
  ],
  "draft": {
    "status": "completed",          // "not_started" | "in_progress" | "completed"
    "order": ["p1", "p2"],
    "currentPot": 4,
    "currentRound": 4,
    "currentPickIndex": 6,
    "spinsCompleted": 48,
    "allocations": {
      "p1": {
        "pot1": ["esp", "ned"],     // teams from pot 1
        "pot2": ["cro", "sen"],     // teams from pot 2
        "pot3": ["nor", "tun"],     // teams from pot 3
        "pot4": ["jor", "cur"]      // teams from pot 4
      }
    }
  }
}
```

**Important:** Allocations MUST be keyed by pot (`pot1`, `pot2`, `pot3`, `pot4`), not a flat array. The services iterate with `Object.values(allocations[participantId])` expecting pot-grouped arrays.

## sync-status.json

```json
{
  "lastSync": {
    "timestamp": "2026-06-15T12:00:00.000Z",  // ISO 8601 UTC, or null if never run
    "outcome": "success",           // "success" | "failure" | "not_run"
    "error": null,                  // error message string on failure, null on success
    "stats": {
      "fixturesUpdated": 3,
      "resultsCreated": 2,
      "standingsUpdated": true
    }
  }
}
```

## odds.json

```json
{
  "tournament": {
    "capturedAt": "2026-06-10T00:00:00Z",
    "odds": { "esp": 5.5, "arg": 6.0 }
  },
  "matches": {
    "f001": { "esp": 1.85, "arg": 3.40, "draw": 3.60 }
  }
}
```
