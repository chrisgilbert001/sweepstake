# Requirements Document

## Introduction

This document defines the requirements for enhancing the existing World Cup Sweepstake application with new high-impact features, social/fun features, and quality-of-life improvements. The existing application is a React (Vite) frontend with an Express.js backend using JSON file storage, and already supports league management, draft system, fixtures, results, odds, standings, team detail, schedule view, and admin panel.

## Glossary

- **Application**: The World Cup Sweepstake web application comprising the React frontend and Express.js backend
- **Participant**: A registered member of a sweepstake league who has been allocated teams via the draft
- **League**: A group of participants competing against each other in the sweepstake
- **Fixture**: A scheduled match between two teams with a date, stage, and status
- **Result**: A completed fixture with scores recorded for both teams
- **Match_Day_View**: The page displaying fixtures scheduled for the current day or current week
- **Points_Timeline**: A visual chart showing the progression of participant points over time
- **Activity_Feed**: A chronological list of recent sweepstake events such as match results and point changes
- **My_Teams_Dashboard**: A participant-specific view showing only their allocated teams and related statistics
- **Group_Stage_Table**: A display of the official World Cup group standings (Groups A-L)
- **Share_Export_Module**: The component responsible for generating shareable images or text summaries of standings
- **Theme_Manager**: The component responsible for switching between light and dark visual themes
- **PWA_Module**: The Progressive Web App infrastructure including manifest and service worker
- **Countdown_Timer**: A real-time display showing time remaining until a fixture kicks off
- **Kickoff_Time**: The scheduled start time of a fixture
- **Knockout_Bracket_View**: A graphical bracket display showing the progression of teams through knockout stage rounds

## Requirements

### Requirement 1: Live Match Day View

**User Story:** As a participant, I want to see today's and this week's matches in a dedicated view, so that I can quickly find out what's happening without scrolling through the full schedule.

#### Acceptance Criteria

1. WHEN a participant navigates to the Match_Day_View, THE Application SHALL display all fixtures scheduled for the current calendar day (based on the participant's local timezone) sorted by Kickoff_Time ascending, with the daily view selected by default
2. WHEN a participant selects the weekly view toggle, THE Application SHALL display all fixtures scheduled for the current calendar week (Monday to Sunday, based on the participant's local timezone) sorted by Kickoff_Time ascending
3. WHILE a fixture has not yet reached its Kickoff_Time, THE Match_Day_View SHALL display a Countdown_Timer that updates every 1 second showing hours, minutes, and seconds remaining until kickoff
4. WHEN a fixture's Kickoff_Time is reached, THE Countdown_Timer SHALL transition to display "LIVE" status
5. WHEN a result is recorded for a displayed fixture, THE Match_Day_View SHALL update to show the final score within 60 seconds without requiring a page refresh
6. IF no fixtures are scheduled for the selected time period, THEN THE Match_Day_View SHALL display a message indicating no matches are scheduled
7. WHEN a fixture displayed in the Match_Day_View has a recorded result, THE Application SHALL display the final score and replace any Countdown_Timer or "LIVE" indicator with a completed status

### Requirement 2: Points History Timeline

**User Story:** As a participant, I want to see how my points and other participants' points have changed over time, so that I can track momentum and see who is gaining ground.

#### Acceptance Criteria

1. WHEN a participant navigates to the Points_Timeline, THE Application SHALL display a line chart showing cumulative points for each participant over time, with the x-axis representing match days in chronological order and the y-axis representing total points starting from zero
2. THE Points_Timeline SHALL plot one data point per match day, where a match day is defined as a calendar date (UTC) on which at least one result involving a league participant's team was recorded
3. WHEN a participant hovers over a data point on the Points_Timeline, THE Application SHALL display a tooltip showing the participant name, the match day date, the cumulative points total at that date, and a list of match results on that date that involved the participant's teams (showing team names and scores)
4. WHEN a participant clicks on a specific participant's name in the legend, THE Points_Timeline SHALL toggle visibility of that participant's line on the chart
5. THE Points_Timeline SHALL use a distinct colour for each participant's line, with the same colour assigned to a given participant wherever their colour appears in the application
6. IF no match results have been recorded when a participant navigates to the Points_Timeline, THEN THE Application SHALL display a message indicating that points data will appear once match results are available

### Requirement 3: Activity Feed

**User Story:** As a participant, I want to see a feed of recent sweepstake events, so that I can stay engaged and see what's happening without checking individual results.

#### Acceptance Criteria

1. WHEN a Match result is recorded, THE Activity_Feed SHALL generate an event entry for each League containing at least one of the involved teams, showing the Match score, tournament stage, the Participant who owns each team within that League, and the points awarded to each Participant from that Match
2. THE Activity_Feed SHALL display events in reverse chronological order based on event generation time, with the most recent event at the top
3. WHEN a team is eliminated from the tournament, THE Activity_Feed SHALL generate an event entry for each League where that team is allocated, identifying the team, the owning Participant within that League, and the stage of elimination
4. THE Activity_Feed SHALL display a maximum of 50 events per page with pagination controls to view older events
5. WHEN a new event is generated while a Participant is viewing the Activity_Feed, THE Application SHALL display a notification indicator showing the count of new events available, and SHALL prepend those new events to the feed when the Participant activates the notification indicator
6. IF no events have been generated for a League, THEN THE Activity_Feed SHALL display a message indicating that no activity has occurred yet

### Requirement 4: My Teams Dashboard

**User Story:** As a participant, I want a personalised view showing only my teams, so that I can quickly see how my teams are performing and what's coming up.

#### Acceptance Criteria

1. WHEN a participant navigates to the My_Teams_Dashboard, THE Application SHALL display all teams allocated to that participant, grouped by draft pot (Pot 1, Pot 2, Pot 3, Pot 4), with each group labelled by its pot number
2. THE My_Teams_Dashboard SHALL display each team's current points contribution, wins, draws, losses, goals scored, and goals conceded, where points contribution is calculated as 3 points per win, 1 point per draw, and 1 bonus point per penalty shootout win
3. THE My_Teams_Dashboard SHALL display upcoming fixtures for each of the participant's teams that have a status of "scheduled" and a date within the next 7 calendar days from the current date, showing the opposing team name and fixture date/time
4. THE My_Teams_Dashboard SHALL display a form indicator for each team showing results of the last 5 completed matches in reverse chronological order as a Win/Draw/Loss sequence, where each entry corresponds to one match result for that team
5. IF a team has played fewer than 5 matches, THEN THE My_Teams_Dashboard SHALL display the form indicator with only the available match results in reverse chronological order
6. THE My_Teams_Dashboard SHALL display the total points earned across all of the participant's teams as a summary at the top of the view, calculated as the sum of individual team points contributions
7. IF the participant has no upcoming fixtures within the next 7 days for any of their teams, THEN THE My_Teams_Dashboard SHALL display a message indicating no upcoming fixtures are scheduled

### Requirement 5: Group Stage Table


**User Story:** As a participant, I want to see the official World Cup group tables, so that I can track which of my teams are progressing through the group stage.

#### Acceptance Criteria

1. THE Group_Stage_Table SHALL display all 12 World Cup groups (A through L) with each group containing exactly 4 teams listed by their team name and country code
2. THE Group_Stage_Table SHALL display each team's matches played (P), won (W), drawn (D), lost (L), goals for (GF), goals against (GA), goal difference (GD), and points (Pts) within their group, where points are calculated as 3 for a win, 1 for a draw, and 0 for a loss
3. THE Group_Stage_Table SHALL sort teams within each group by points descending, then goal difference descending, then goals scored descending
4. WHEN a team in the Group_Stage_Table belongs to a participant in the current league, THE Application SHALL visually distinguish that team's row from other teams and display the owning participant's name adjacent to the team name
5. THE Group_Stage_Table SHALL display a visible qualification line between position 2 and position 3 in each group, indicating that the top 2 teams advance to the knockout stage
6. IF no group stage results have been recorded, THEN THE Group_Stage_Table SHALL display all teams in each group with 0 values for all statistical columns (P, W, D, L, GF, GA, GD, Pts)

### Requirement 6: Share and Export Standings

**User Story:** As a participant, I want to generate a shareable summary of the current standings, so that I can post it to our WhatsApp group chat.

#### Acceptance Criteria

1. WHEN a participant clicks the share button on the standings view, THE Share_Export_Module SHALL generate a plain-text summary listing each participant on a separate line in rank order, with rank number, participant name, and total points, prefixed by the league name and current date in DD/MM/YYYY format
2. WHEN a participant clicks the export-as-image button on the standings view, THE Share_Export_Module SHALL generate a PNG image of the current standings table with a maximum width of 800 pixels
3. WHEN the text summary is generated, THE Share_Export_Module SHALL copy the text to the clipboard and display a confirmation message for 3 seconds
4. IF the clipboard API is unavailable or the copy operation fails, THEN THE Share_Export_Module SHALL display the generated text in a selectable read-only text area so the participant can manually copy it
5. WHEN the PNG image is generated, THE Share_Export_Module SHALL trigger a file download with the filename format "standings-{league-slug}-{YYYY-MM-DD}.png" where the date is the current date in ISO format
6. THE Share_Export_Module SHALL include the league name and current date in DD/MM/YYYY format in both the text summary header and the image output header

### Requirement 7: Dark Mode

**User Story:** As a participant, I want to switch to a dark colour theme, so that I can comfortably view the application during evening match viewing.

#### Acceptance Criteria

1. WHEN a participant toggles the theme switch, THE Theme_Manager SHALL apply the dark colour theme to all rendered application views without requiring a page reload
2. WHEN a participant toggles the theme switch, THE Theme_Manager SHALL persist the selected theme preference to browser local storage within 1 second of the toggle action
3. WHEN a participant loads the Application with a previously saved dark theme preference, THE Theme_Manager SHALL apply the dark theme before rendering visible content so that no flash of the light theme is displayed
4. THE Application SHALL define dark theme colours using CSS custom properties to ensure consistent theming across all components
5. WHEN no theme preference is stored and the browser reports a system colour scheme preference via prefers-color-scheme, THE Theme_Manager SHALL default to the system-reported colour scheme
6. IF no theme preference is stored and the browser does not support system colour scheme detection, THEN THE Theme_Manager SHALL default to the light theme
7. THE Application SHALL maintain a minimum colour contrast ratio of 4.5:1 between text and background colours in both light and dark themes to meet WCAG AA compliance

### Requirement 8: Mobile PWA Support

**User Story:** As a participant, I want to install the application on my phone's home screen, so that I can access it quickly like a native app.

#### Acceptance Criteria

1. THE PWA_Module SHALL include a valid web app manifest with application name, icons (192x192 and 512x512 pixels in PNG format), theme colour, display set to "standalone", and start URL pointing to the application root
2. THE PWA_Module SHALL register a service worker that caches the application shell (HTML, CSS, JavaScript, and static image assets) for offline access using a cache-first strategy, and SHALL update the cache in the background when a new version is deployed
3. WHEN the application is installed to the home screen, THE Application SHALL launch in standalone display mode without browser navigation chrome
4. WHEN the device has no network connectivity, THE PWA_Module SHALL serve the cached application shell and display a visible inline message on each page that would normally load live data, indicating that live data is unavailable, while allowing navigation between cached pages
5. WHEN network connectivity is restored, THE PWA_Module SHALL fetch fresh data within 5 seconds and update the displayed content, replacing the offline message
6. IF the data fetch on network restoration fails, THEN THE PWA_Module SHALL retry up to 3 times with a 5-second interval between attempts and continue displaying the offline unavailability message until data is successfully retrieved
7. IF service worker registration fails, THEN THE Application SHALL continue to function as a standard web application without offline capabilities

### Requirement 9: Knockout Bracket View

**User Story:** As a participant, I want to see a visual bracket graphic showing the knockout stage progression, so that I can see how teams advance through the Round of 32, Round of 16, Quarter-finals, Semi-finals, and Final.

#### Acceptance Criteria

1. WHEN a participant navigates to the Knockout Bracket View, THE Application SHALL display a graphical bracket showing all knockout stage rounds (Round of 32, Round of 16, Quarter-finals, Semi-finals, and Final) arranged in columns from left to right in chronological order, with connector lines linking each fixture to its subsequent round fixture
2. THE Knockout Bracket View SHALL display each fixture within the bracket showing the two competing team names, or the placeholder label "TBD" for each team position where the qualifying team has not yet been determined
3. WHEN a knockout fixture has a recorded result, THE Bracket View SHALL display the score next to each team name in the format "home score – away score" and render the winning team's name in bold text
4. IF a knockout fixture was decided by a penalty shootout, THEN THE Bracket View SHALL display the penalty score in parentheses adjacent to the match score
5. WHEN a team in the bracket belongs to a participant in the current league, THE Application SHALL display that team's name with a distinct background colour and show the owning participant's name below the team name
6. THE Knockout Bracket View SHALL be horizontally scrollable on viewports narrower than the bracket's rendered width, allowing the participant to pan across all rounds
7. IF no knockout stage fixtures exist in the system, THEN THE Application SHALL display a message indicating that the knockout stage has not yet started
