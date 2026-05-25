# Requirements Document

## Introduction

A World Cup Sweepstake website that allows groups of 6 people to form named leagues, where teams from the FIFA World Cup are randomly allocated using a snake draft across 4 seeding pots. The site tracks all World Cup match results, calculates points (3 for a win, 1 for a draw, 0 for a loss), and displays tournament and per-game odds to identify underdogs. Multiple independent leagues can run simultaneously.

## Glossary

- **League**: A named group of exactly 6 participants competing in the same sweepstake
- **Participant**: A person within a League who is allocated teams and earns points
- **Pot**: One of 4 groups of 12 teams, organized by FIFA World Cup seeding (Pot 1 through Pot 4)
- **Snake_Draft**: An allocation method where the order reverses each round (1-2-3-4-5-6, 6-5-4-3-2-1, etc.)
- **Wheel_Spin**: A visual animated spinner that randomly selects a team from the available teams in the current Pot and assigns it to the current Participant in the draft order
- **Draft_Session**: The interactive process of performing all 48 Wheel_Spins to complete the Snake_Draft for a League
- **Match**: A single World Cup game between two teams with a result of win, draw, or loss for each team
- **Points_System**: The scoring mechanism where a team win earns 3 points, a draw earns 1 point, a penalty shootout progression earns an additional 1 point (2 total for that match), and a loss earns 0 points for the Participant who owns that team
- **Tournament_Odds**: The odds for each team to win the entire World Cup, captured at the start of the tournament
- **Match_Odds**: The odds for each team in a specific Match, used to identify underdogs
- **Allocation**: The assignment of teams to a Participant within a League via the Snake_Draft
- **Join_Link**: A unique shareable URL that allows anyone to access and join a specific League without authentication
- **League_URL**: A unique URL that provides direct access to view a specific League's standings and details
- **Fixture**: A scheduled Match that has not yet been played, including the two competing teams, date, time, and tournament stage
- **Eliminated_Team**: A team that has been knocked out of the World Cup and can no longer earn points from future Matches
- **Goal_Difference**: The total goals scored by all of a Participant's teams minus the total goals conceded by all of a Participant's teams across all Matches
- **Tournament_Complete**: The state of the tournament after the Final Match has been played and all results are recorded

## Requirements

### Requirement 1: League Creation

**User Story:** As a user, I want to create a named league, so that a group of people can participate in the sweepstake together.

#### Acceptance Criteria

1. WHEN a user creates a new League, THE System SHALL require a unique League name that is between 1 and 50 characters in length and contains at least one non-whitespace character
2. IF a user attempts to create a League with a name that already exists in the system, THEN THE System SHALL reject the creation and display an error message indicating the name is already taken
3. WHEN a League is created, THE System SHALL allow exactly 6 Participants to be added to the League
4. WHEN a user adds a Participant to a League, THE System SHALL store the Participant name within that League, where the Participant name must be between 1 and 50 characters in length and contain at least one non-whitespace character
5. IF a user attempts to add a Participant with the same name as an existing Participant in that League, THEN THE System SHALL reject the addition and display an error message indicating the name is already used in the League
6. IF a user attempts to add more than 6 Participants to a League, THEN THE System SHALL reject the addition and display an error message indicating the League already has the maximum number of Participants

### Requirement 2: Team Pot Structure

**User Story:** As a league organizer, I want teams organized into 4 seeding pots of 12 teams each, so that the allocation reflects FIFA World Cup seeding.

#### Acceptance Criteria

1. THE System SHALL store exactly 48 teams across 4 Pots
2. THE System SHALL assign exactly 12 teams to each Pot
3. THE System SHALL assign teams to Pots in descending order of seed rank, where Pot 1 contains the 12 highest-seeded teams (seed ranks 1–12), Pot 2 contains seed ranks 13–24, Pot 3 contains seed ranks 25–36, and Pot 4 contains seed ranks 37–48
4. WHEN a team is assigned to a Pot, THE System SHALL prevent that team from appearing in any other Pot
5. THE System SHALL uniquely identify each team such that no two teams in the 48-team pool share the same identity
6. IF the number of teams provided is not exactly 48, THEN THE System SHALL reject the pot assignment and display an error message indicating the required team count is 48

### Requirement 3: Snake Draft Allocation

**User Story:** As a league organizer, I want teams allocated via an interactive snake draft starting from the worst pot, so that the draw is a fun group experience that builds excitement toward the best teams.

#### Acceptance Criteria

1. IF the League does not have exactly 6 Participants, THEN THE System SHALL prevent the Snake_Draft from being initiated and SHALL display an error message indicating that exactly 6 Participants are required
2. WHEN the Snake_Draft is initiated for a League, THE System SHALL randomly determine the initial draft order of the 6 Participants and display the draft order to all viewers
3. WHEN the Snake_Draft is initiated, THE System SHALL proceed through Pots in ascending order starting from Pot 4 (lowest-seeded teams), then Pot 3, then Pot 2, then Pot 1 (highest-seeded teams)
4. WHEN allocating teams from a Pot, THE System SHALL assign 2 teams from that Pot to each Participant (one per round)
5. WHEN the first round of a Pot is allocated, THE System SHALL assign teams in the draft order (positions 1 through 6), using the same draft order that was determined at initiation for all 4 Pots
6. WHEN the second round of a Pot is allocated, THE System SHALL assign teams in reverse draft order (positions 6 through 1)
7. WHEN a team is to be assigned, THE System SHALL wait for the user to trigger the Wheel_Spin before selecting and assigning the team
8. WHEN the Wheel_Spin is triggered, THE System SHALL randomly select one team from the remaining available teams in the current Pot and assign that team to the current Participant in the draft sequence
9. WHEN the Snake_Draft is complete, THE System SHALL have assigned exactly 8 teams to each Participant (2 from each of the 4 Pots)
10. IF the Snake_Draft has already been completed for a League, THEN THE System SHALL prevent a new Snake_Draft from being initiated and SHALL display an error message indicating the draft has already been completed

### Requirement 11: Interactive Wheel Spin UI

**User Story:** As a league organizer running the draft with friends, I want a visual spinning wheel animation for each team allocation, so that the draw feels exciting and interactive for the group.

#### Acceptance Criteria

1. WHEN a Wheel_Spin is pending, THE System SHALL display a wheel containing the names of all remaining available teams in the current Pot
2. WHEN the user triggers the Wheel_Spin, THE System SHALL animate the wheel spinning and decelerating before landing on the randomly selected team
3. WHEN the Wheel_Spin animation completes, THE System SHALL display the selected team name prominently and indicate which Participant received that team
4. WHILE a Wheel_Spin animation is in progress, THE System SHALL disable the spin trigger to prevent multiple simultaneous spins
5. WHEN a Wheel_Spin completes, THE System SHALL display the current Participant name, the current Pot number, and the round number (1 or 2) for the next pending spin
6. WHEN all teams in a Pot have been allocated, THE System SHALL display a summary of the Pot allocations before proceeding to the next Pot
7. WHEN the final Wheel_Spin of the Draft_Session completes, THE System SHALL display a complete summary showing all Participants and their 8 allocated teams grouped by Pot
8. THE System SHALL display a progress indicator showing how many of the 48 total Wheel_Spins have been completed during the Draft_Session

### Requirement 4: Tournament Odds Snapshot

**User Story:** As a participant, I want to see each team's odds to win the tournament, so that I can understand the relative strength of my allocated teams.

#### Acceptance Criteria

1. THE System SHALL store Tournament_Odds as a decimal value greater than 1.0 for each of the 48 teams
2. WHEN Tournament_Odds are recorded, THE System SHALL capture odds for all 48 teams as a single snapshot before the first Match of the tournament
3. THE System SHALL display Tournament_Odds alongside each team in the League view
4. WHEN Tournament_Odds are stored, THE System SHALL preserve the original values without modification for the duration of the tournament
5. IF Tournament_Odds have not yet been recorded, THEN THE System SHALL display the League view without odds values and indicate that odds are pending
6. IF a Tournament_Odds snapshot does not include a value for every one of the 48 teams, THEN THE System SHALL reject the entire snapshot and display an error message indicating incomplete odds data

### Requirement 5: Match Odds Storage

**User Story:** As a participant, I want to see the odds for each game, so that I can identify which team is the underdog in any given match.

#### Acceptance Criteria

1. WHEN a Match is stored, THE System SHALL record Match_Odds for each team in that Match as decimal odds values (e.g., 2.50) captured prior to the match kickoff
2. THE System SHALL display Match_Odds alongside each Match result
3. WHEN Match_Odds are displayed, THE System SHALL visually label the team with the higher decimal odds value as the underdog
4. IF both teams in a Match have equal Match_Odds, THEN THE System SHALL display the odds without labeling either team as the underdog
5. IF Match_Odds are unavailable for a Match, THEN THE System SHALL display the Match result without odds and without an underdog indicator

### Requirement 6: Match Results Storage

**User Story:** As a participant, I want all World Cup match results stored, so that points can be calculated and I can review past games.

#### Acceptance Criteria

1. THE System SHALL store all World Cup Matches including the two competing teams, the date, and the stage of the tournament (Group Stage, Round of 16, Quarter-final, Semi-final, Third-place playoff, or Final)
2. WHEN a Match result is recorded, THE System SHALL store the final score as a non-negative integer of goals for each team, representing the score at the end of normal time or extra time (excluding penalty shootout goals)
3. WHEN a Match result is recorded and one team's score is higher than the other, THE System SHALL determine the outcome as a win for the team with the higher score and a loss for the team with the lower score
4. WHEN a Match result is recorded and both teams' scores are equal, THE System SHALL determine the outcome as a draw for both teams
5. IF a Match is decided by a penalty shootout, THEN THE System SHALL store the score at the end of extra time (which is level), record the outcome as a draw for points purposes, and store which team won the penalty shootout
6. IF a Match result is recorded with a team that does not exist in the 48-team pool, THEN THE System SHALL reject the result and display an error message indicating an invalid team

### Requirement 7: Points Calculation

**User Story:** As a participant, I want points calculated automatically from match results, so that I can see my standing in the league.

#### Acceptance Criteria

1. WHEN a team wins a Match, THE Points_System SHALL award 3 points to the Participant who owns that team within each League where that team is allocated
2. WHEN a Match ends in a draw, THE Points_System SHALL award 1 point to each Participant who owns a team in that Match within each League where that team is allocated
3. WHEN a Match is decided by a penalty shootout, THE Points_System SHALL award 1 additional point (2 points total for that Match) to the Participant who owns the team that won the shootout, within each League where that team is allocated
4. WHEN a team loses a Match, THE Points_System SHALL award 0 points to the Participant who owns that team
5. THE System SHALL calculate a Participant's total points as the sum of all points earned by all 8 of the Participant's allocated teams within that Participant's League
6. WHEN a Match result is recorded, THE System SHALL update the points totals for all affected Participants across all Leagues containing the involved teams within 5 seconds of the result being saved
7. IF a Match result is corrected after initial recording, THEN THE System SHALL recalculate the points for all affected Participants by reversing the previous points award and applying the new result

### Requirement 8: League Standings Display

**User Story:** As a participant, I want to see the league standings with detailed stats and clear tiebreaker rules, so that I can track my position relative to other participants.

#### Acceptance Criteria

1. THE System SHALL display a League standings table showing each Participant ranked by total points in descending order (highest points first)
2. IF two or more Participants have equal total points, THEN THE System SHALL break the tie using number of wins in descending order as the first tiebreaker
3. IF two or more Participants remain tied after applying the first tiebreaker, THEN THE System SHALL break the tie using Goal_Difference in descending order as the second tiebreaker
4. IF two or more Participants remain tied after applying both tiebreakers, THEN THE System SHALL display them at the same rank and assign the next rank by skipping the number of tied positions
5. THE System SHALL display each Participant's total points, number of team wins, number of team draws, number of team losses, goals scored (total goals scored by all of the Participant's teams), goals conceded (total goals conceded by all of the Participant's teams), and Goal_Difference in the standings table
6. THE System SHALL display each Participant's allocated teams alongside their standings entry, visually indicating which teams are eliminated
7. WHEN a Match result is recorded, THE System SHALL recalculate and display the updated standings without requiring a manual refresh
8. IF no Match results have been recorded, THEN THE System SHALL display all 6 Participants at rank 1 with 0 points, 0 wins, 0 draws, 0 losses, 0 goals scored, 0 goals conceded, and 0 Goal_Difference

### Requirement 9: Multiple League Support

**User Story:** As a user, I want to create and participate in multiple independent leagues, so that different groups of people can run their own sweepstakes.

#### Acceptance Criteria

1. THE System SHALL support a minimum of 100 concurrent Leagues
2. WHEN a League is created, THE System SHALL isolate that League's Participants, Allocations, and Points totals from all other Leagues
3. THE System SHALL allow the same team data, Pot structure, Match results, Tournament_Odds, and Match_Odds to be shared across all Leagues
4. WHEN a Snake_Draft is run for one League, THE System SHALL not affect the Allocations in any other League
5. THE System SHALL allow the same person to be added as a Participant in multiple Leagues, with separate Allocations and Points in each League

### Requirement 10: Team and Match Viewing

**User Story:** As a participant, I want to view my allocated teams and their match history, so that I can follow my teams' progress through the tournament.

#### Acceptance Criteria

1. WHEN a Participant views their League, THE System SHALL display all 8 teams allocated to that Participant grouped by Pot (Pot 1 through Pot 4), showing the team name and Tournament_Odds for each team
2. WHEN a Participant selects a team, THE System SHALL display all Matches played by that team ordered by date ascending, showing for each Match the opponent, date, tournament stage, final score, match outcome (win, draw, or loss), Match_Odds, and points earned from that Match
3. IF a Participant selects a team that has not yet played any Matches, THEN THE System SHALL display a message indicating no Matches have been played
4. WHEN a Participant views their League, THE System SHALL display the total points accumulated by each of the Participant's 8 teams

### Requirement 12: League Access and Sharing

**User Story:** As a league organizer, I want each league to have a unique URL and a shareable join link, so that participants can easily access the league without needing to authenticate.

#### Acceptance Criteria

1. WHEN a League is created, THE System SHALL generate a unique League_URL that provides direct access to view that League's standings, teams, and match results
2. WHEN a League is created, THE System SHALL generate a unique Join_Link that allows anyone with the link to access the League
3. THE System SHALL allow any user with the League_URL to view the League standings, Participant teams, and Match results without requiring authentication
4. THE System SHALL allow any user with the Join_Link to join the League as a Participant without requiring authentication
5. THE System SHALL display the Join_Link prominently within the League view so that existing members can copy and share the link
6. IF a user accesses a League_URL that does not correspond to an existing League, THEN THE System SHALL display an error message indicating the League was not found
7. IF a user accesses a Join_Link for a League that already has 6 Participants, THEN THE System SHALL display the League in view-only mode and indicate that the League is full

### Requirement 13: Match Schedule and Fixtures

**User Story:** As a participant, I want to see upcoming match fixtures with dates and times, so that I can follow when my teams are playing next.

#### Acceptance Criteria

1. THE System SHALL display a schedule of all Fixtures ordered by date and time in ascending order
2. WHEN a Fixture is displayed, THE System SHALL show the two competing teams, the scheduled date and time, and the tournament stage
3. WHEN a Participant views the schedule within a League, THE System SHALL visually highlight Fixtures that involve any of that Participant's allocated teams
4. THE System SHALL indicate which Participant owns each team in a Fixture when viewed within a League context
5. WHEN a Fixture's scheduled date and time has passed and a Match result has been recorded, THE System SHALL replace the Fixture with the completed Match result in the schedule view
6. IF no upcoming Fixtures remain, THEN THE System SHALL display a message indicating all scheduled Matches have been completed

### Requirement 14: Team Elimination Tracking

**User Story:** As a participant, I want to see which teams have been knocked out of the tournament, so that I can understand which of my teams can still earn points.

#### Acceptance Criteria

1. WHEN a team loses a knockout-stage Match (Round of 16, Quarter-final, Semi-final, or Third-place playoff), THE System SHALL mark that team as an Eliminated_Team
2. WHEN a team loses a knockout-stage Match that is decided by a penalty shootout, THE System SHALL mark the team that lost the shootout as an Eliminated_Team
3. THE System SHALL visually distinguish Eliminated_Teams from active teams by displaying them as greyed out or with a strikethrough style
4. WHEN a Participant views their allocated teams, THE System SHALL display the points total for each team and visually indicate which teams are eliminated
5. THE System SHALL display the elimination status of teams in the League standings view alongside each Participant's team list
6. WHILE a team is in the Group Stage, THE System SHALL not mark that team as an Eliminated_Team regardless of results

### Requirement 15: Tournament Completion

**User Story:** As a participant, I want the league to declare final placings when the tournament ends, so that there is a clear winner and recognition for top performers.

#### Acceptance Criteria

1. WHEN all World Cup Matches including the Final have been recorded, THE System SHALL mark the tournament as Tournament_Complete
2. WHEN the tournament is marked as Tournament_Complete, THE System SHALL declare the Participant with the highest final standing as the winner (1st place)
3. WHEN the tournament is marked as Tournament_Complete, THE System SHALL declare the Participant with the second-highest final standing as 2nd place
4. WHEN the tournament is marked as Tournament_Complete, THE System SHALL declare the Participant with the third-highest final standing as 3rd place
5. WHEN the tournament is marked as Tournament_Complete, THE System SHALL display a visual celebration or trophy indicator for the 1st, 2nd, and 3rd place Participants
6. WHILE the tournament is marked as Tournament_Complete, THE System SHALL display the League in a finalized state with final standings locked and clearly labelled as complete
7. THE System SHALL determine final standings using the same ranking rules as the League standings (total points, then wins tiebreaker, then Goal_Difference tiebreaker)

### Requirement 16: Mobile Responsiveness

**User Story:** As a participant, I want to access the sweepstake on my mobile device, so that I can check standings and results on the go.

#### Acceptance Criteria

1. THE System SHALL render all pages using responsive design that adapts to viewport widths from 320 pixels to 1920 pixels
2. THE System SHALL ensure all interactive elements (buttons, links, spin triggers) have a minimum touch target size of 44 by 44 pixels on mobile viewports
3. THE System SHALL display the League standings table in a readable format on mobile viewports without requiring horizontal scrolling for essential data (rank, name, points)
4. THE System SHALL ensure the Wheel_Spin animation is functional and visible on mobile viewports
5. THE System SHALL ensure text remains readable without zooming on mobile viewports by using a minimum font size of 16 pixels for body text

### Requirement 17: Admin Data Entry for Match Results

**User Story:** As a league administrator, I want a clear interface to enter match results and odds, so that I can keep the sweepstake up to date throughout the tournament.

#### Acceptance Criteria

1. THE System SHALL provide an admin interface for entering Match results including the two teams, date, tournament stage, final score, and penalty shootout winner where applicable
2. THE System SHALL provide an admin interface for entering Match_Odds for each upcoming Fixture
3. THE System SHALL provide an admin interface for entering Tournament_Odds for all 48 teams
4. WHEN an admin enters a Match result, THE System SHALL validate that both teams exist in the 48-team pool and that scores are non-negative integers before saving
5. THE System SHALL provide an admin interface for adding and editing Fixtures including the two teams, scheduled date and time, and tournament stage
6. IF an admin enters a result for a Match that already has a recorded result, THEN THE System SHALL prompt for confirmation before overwriting the existing result and recalculating points
7. THE System SHALL display a list of Fixtures without results to help the admin identify which Matches need results entered
