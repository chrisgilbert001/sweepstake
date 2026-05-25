# Implementation Plan: Bracket Placeholders

## Overview

Replace generic "TBD" labels in the knockout bracket with meaningful placeholders describing group-stage origins. Implementation involves creating a static bracket template JSON, enhancing the bracket service to resolve placeholders, and updating the client component to render them with distinct styling.

## Tasks

- [x] 1. Create bracket template data file
  - [x] 1.1 Create `server/data/bracket-template.json` with FIFA 2026 Round of 32 structure
    - Define 16 match entries with `matchNumber`, `home`, and `away` position references
    - Use format `"{position}{group}"` for winners/runners-up (e.g., "1A", "2B")
    - Use format `"3rd {groups}"` for third-place qualifiers (e.g., "3rd A/B/C")
    - Include `thirdPlaceAllocations` mapping qualifying-group combinations to slot assignments
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 2. Enhance bracket service with placeholder resolution
  - [x] 2.1 Add `loadBracketTemplate()` function to `server/services/bracketService.js`
    - Read `bracket-template.json` using the existing `readFile` from `storageService.js`
    - Return `null` if file is missing or malformed, log a warning
    - _Requirements: 2.4, 2.5_

  - [x] 2.2 Add `resolvePlaceholders()` function to `server/services/bracketService.js`
    - For Round of 32: look up template entry by fixture position, assign `home`/`away` values
    - For later rounds: generate `"W{N}"` references from previous round match numbers
    - Set placeholder to `null` when team position has a resolved team ID
    - _Requirements: 2.1, 2.2, 2.3, 3.1, 3.2, 3.3, 3.4_

  - [x] 2.3 Modify `getBracketData()` to assign match numbers and attach placeholders
    - Assign sequential 1-based `matchNumber` within each round (by date order)
    - Call `loadBracketTemplate()` once per request
    - Call `resolvePlaceholders()` for each fixture in each round
    - Ensure `homePlaceholder`/`awayPlaceholder` fields are included in the response
    - _Requirements: 2.1, 2.3, 3.1, 5.1, 5.2, 5.3, 5.4_

  - [ ]* 2.4 Write property test: Round of 32 placeholder resolution from template
    - **Property 1: Round of 32 placeholder resolution from template**
    - **Validates: Requirements 2.1, 3.1, 3.4**

  - [ ]* 2.5 Write property test: Determined team nullifies placeholder
    - **Property 2: Determined team nullifies placeholder**
    - **Validates: Requirements 2.2, 3.2, 3.3**

  - [ ]* 2.6 Write property test: Cascading match references for later rounds
    - **Property 3: Cascading match references for later rounds**
    - **Validates: Requirements 2.3, 5.1, 5.2, 5.3**

  - [ ]* 2.7 Write property test: Sequential match numbering
    - **Property 4: Sequential match numbering**
    - **Validates: Requirements 5.4**

  - [ ]* 2.8 Write property test: Placeholder and team ID mutual exclusivity
    - **Property 6: Placeholder and team ID mutual exclusivity**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4**

- [x] 3. Checkpoint - Ensure server-side logic is correct
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Update client component to display placeholders
  - [x] 4.1 Modify `getDisplayName()` in `client/src/components/KnockoutBracket.jsx`
    - Accept a `placeholder` parameter
    - Return placeholder value when team is "TBD" and placeholder is present
    - Fall back to "TBD" when no placeholder is available
    - _Requirements: 4.1, 4.2, 4.3_

  - [x] 4.2 Modify `FixtureBox` component to pass placeholders and apply styling
    - Read `homePlaceholder` and `awayPlaceholder` from `fixture` data
    - Pass placeholder to `getDisplayName()` for each team position
    - Apply `fontStyle="italic"` and muted fill color (`var(--color-text-muted, #6c757d)`) to placeholder text
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [ ]* 4.3 Write property test: Display function prefers placeholder over TBD
    - **Property 5: Display function prefers placeholder over TBD**
    - **Validates: Requirements 4.1, 4.2, 4.3**

- [x] 5. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- The project uses Vitest + fast-check for property-based testing
- Server tests are co-located with services (e.g., `bracketService.test.js`)
- Client property tests go in `client/src/__tests__/`

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["2.1"] },
    { "id": 2, "tasks": ["2.2"] },
    { "id": 3, "tasks": ["2.3"] },
    { "id": 4, "tasks": ["2.4", "2.5", "2.6", "2.7", "2.8"] },
    { "id": 5, "tasks": ["4.1"] },
    { "id": 6, "tasks": ["4.2"] },
    { "id": 7, "tasks": ["4.3"] }
  ]
}
```
