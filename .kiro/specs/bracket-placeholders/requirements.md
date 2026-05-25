# Requirements Document

## Introduction

Replace generic "TBD" labels in the knockout bracket with meaningful placeholders that describe the group-stage origin of each position (e.g., "1A vs 2B"). The 2026 FIFA World Cup uses 48 teams across 12 groups (A–L), with the top 2 from each group plus 8 best third-place teams advancing to a Round of 32. A static bracket template defines the Round of 32 matchup mapping, and the bracket service resolves these placeholders against actual group standings when teams are determined.

## Glossary

- **Bracket_Service**: The server-side service (`server/services/bracketService.js`) responsible for building the knockout bracket structure from fixtures, results, and the bracket template.
- **Bracket_Template**: A static JSON data file (`server/data/bracket-template.json`) that defines the FIFA Round of 32 matchup mapping using group-position references.
- **KnockoutBracket_Component**: The client-side SVG component (`client/src/components/KnockoutBracket.jsx`) that renders the knockout bracket visually.
- **Placeholder**: A descriptive label (e.g., "1A", "2B", "3rd A/B/C", "W1") indicating the group-stage origin or prior-round origin of a team position that has not yet been determined.
- **Group_Position_Reference**: A string identifying a team's finishing position within a group (e.g., "1A" means winner of Group A, "2L" means runner-up of Group L).
- **Third_Place_Allocation**: A FIFA-defined mapping that assigns specific best third-place qualifiers to specific Round of 32 slots based on which groups the qualifying third-place teams come from.
- **Match_Position_Reference**: A string referencing the winner of a prior knockout match (e.g., "W1" means winner of match 1 in the previous round).

## Requirements

### Requirement 1: Bracket Template Data File

**User Story:** As a developer, I want a static JSON data file that defines the FIFA 2026 Round of 32 matchup structure, so that the bracket service can resolve meaningful placeholders without hard-coding matchup logic.

#### Acceptance Criteria

1. THE Bracket_Template SHALL define 16 Round of 32 match entries, each containing a match number, a home position reference, and an away position reference.
2. THE Bracket_Template SHALL use Group_Position_References in the format "{position}{group}" where position is "1" or "2" and group is a letter from A to L (e.g., "1A", "2B").
3. THE Bracket_Template SHALL use Third_Place_Allocation references in the format "3rd {group_list}" where group_list is a slash-separated set of possible source groups (e.g., "3rd A/B/C").
4. THE Bracket_Template SHALL include a third-place allocation table that maps each combination of qualifying third-place groups to their assigned Round of 32 slots.

### Requirement 2: Bracket Service Placeholder Resolution

**User Story:** As a user viewing the knockout bracket, I want to see descriptive placeholders for undetermined team positions, so that I understand which group-stage slot feeds into each knockout match.

#### Acceptance Criteria

1. WHEN a team position in the Round of 32 is undetermined, THE Bracket_Service SHALL include a `placeholder` field on the fixture containing the Group_Position_Reference or Third_Place_Allocation label from the Bracket_Template.
2. WHEN a team position in the Round of 32 is determined (actual team ID is known), THE Bracket_Service SHALL use the team ID as normal and omit the `placeholder` field for that position.
3. WHEN a team position in a round beyond the Round of 32 is undetermined, THE Bracket_Service SHALL include a `placeholder` field containing a Match_Position_Reference in the format "W{match_number}" referencing the source match from the previous round.
4. THE Bracket_Service SHALL read the Bracket_Template file on startup or on each request to resolve Round of 32 placeholders.
5. WHEN the Bracket_Template file is missing or malformed, THE Bracket_Service SHALL fall back to using "TBD" as the placeholder value and log a warning.

### Requirement 3: Placeholder Field Structure

**User Story:** As a front-end developer, I want a consistent placeholder field structure in the bracket API response, so that the client can reliably display descriptive labels.

#### Acceptance Criteria

1. THE Bracket_Service SHALL include `homePlaceholder` and `awayPlaceholder` fields on each fixture object when the corresponding team position is "TBD".
2. WHEN `homeTeam` is a valid team ID (not "TBD"), THE Bracket_Service SHALL set `homePlaceholder` to null.
3. WHEN `awayTeam` is a valid team ID (not "TBD"), THE Bracket_Service SHALL set `awayPlaceholder` to null.
4. THE Bracket_Service SHALL ensure placeholder values are non-empty strings when the team position is "TBD".

### Requirement 4: Client Display of Placeholders

**User Story:** As a user, I want to see meaningful labels like "1A" or "W3" in the bracket instead of "TBD", so that I can understand the bracket structure before teams are determined.

#### Acceptance Criteria

1. WHEN a fixture's `homeTeam` is "TBD" and `homePlaceholder` is present, THE KnockoutBracket_Component SHALL display the `homePlaceholder` value instead of "TBD".
2. WHEN a fixture's `awayTeam` is "TBD" and `awayPlaceholder` is present, THE KnockoutBracket_Component SHALL display the `awayPlaceholder` value instead of "TBD".
3. WHEN a fixture's team position is "TBD" and no placeholder field is present, THE KnockoutBracket_Component SHALL fall back to displaying "TBD".
4. THE KnockoutBracket_Component SHALL visually distinguish placeholder text from resolved team names using a muted or italic style.

### Requirement 5: Cascading Placeholders for Later Rounds

**User Story:** As a user, I want later knockout rounds to show labels like "W1 vs W2" referencing earlier match positions, so that I can trace the bracket path before results are known.

#### Acceptance Criteria

1. WHEN generating placeholders for the Round of 16, THE Bracket_Service SHALL use Match_Position_References in the format "W{N}" where N is the 1-based match number from the Round of 32.
2. WHEN generating placeholders for the Quarter-finals, THE Bracket_Service SHALL use Match_Position_References referencing the Round of 16 match numbers.
3. WHEN generating placeholders for the Semi-finals and Final, THE Bracket_Service SHALL use Match_Position_References referencing the previous round's match numbers.
4. THE Bracket_Service SHALL assign match numbers sequentially within each round starting from 1, based on fixture sort order (by date ascending).
