# Requirements Document

## Introduction

Modernize the UI/UX of the World Cup Sweepstake web app to deliver a polished, engaging experience. The current app uses scattered emoji-prefixed navigation links, a rigid single-column layout, and a basic green/gold theme with system fonts. This feature introduces a persistent navigation shell, consolidates related views into tabbed panels, upgrades the visual design system, and ensures responsive layouts across desktop and mobile. The app is used among friends to track a World Cup sweepstake — the tone should be fun, social, and easy to use.

## Glossary

- **App_Shell**: The persistent layout wrapper that contains the Navigation_Bar, main content area, and optional sidebar across all authenticated views
- **Navigation_Bar**: The primary navigation component providing access to all league sections, rendered as a top bar on desktop and a bottom tab bar on mobile
- **Navigation_Item**: A single clickable entry in the Navigation_Bar representing a route or view section
- **Tab_Panel**: A container that groups related content sections (e.g., Schedule + Match Day) under switchable tabs within a single page view
- **Content_Area**: The main region of the App_Shell where page content and Tab_Panels are rendered
- **Theme_System**: The collection of CSS custom properties, typography scales, color palettes, and design tokens that define the visual appearance
- **Responsive_Layout**: The layout system that adapts content arrangement, navigation placement, and component sizing based on viewport width
- **League_Dashboard**: The consolidated league view that combines standings, navigation, and contextual panels into a single cohesive page
- **Card_Component**: A reusable visual container with consistent padding, border radius, shadow, and background used to group related content
- **Mobile_Breakpoint**: The viewport width threshold (768px) below which the layout switches to mobile-optimized navigation and stacking

## Requirements

### Requirement 1: Persistent App Shell

**User Story:** As a user, I want a consistent navigation shell around all league pages, so that I can move between sections without losing context or orientation.

#### Acceptance Criteria

1. WHEN a user navigates to any route matching `/league/:slug/*`, THE App_Shell SHALL render the Navigation_Bar and Content_Area in a persistent layout that does not unmount between route changes within the league
2. WHILE the user is on a league route, THE App_Shell SHALL display the league name and the current section title corresponding to the active route in a header region above the Content_Area
3. WHILE the user is on a league route, THE Navigation_Bar SHALL visually indicate the currently active Navigation_Item such that the active item has at least one distinguishing visual property (background, border, or font weight) different from inactive items
4. THE App_Shell SHALL render the ThemeToggle control within the Navigation_Bar header region instead of as a floating element
5. IF the user navigates to a non-league route (home, join, or admin), THEN THE App_Shell SHALL NOT render the Navigation_Bar or league header

### Requirement 2: Responsive Navigation Bar

**User Story:** As a user, I want navigation that works well on both desktop and mobile, so that I can easily access all sections regardless of my device.

#### Acceptance Criteria

1. WHILE the viewport width is above the Mobile_Breakpoint (768px), THE Navigation_Bar SHALL render as a horizontal top bar with Navigation_Items displayed as labeled icons
2. WHILE the viewport width is at or below the Mobile_Breakpoint (768px), THE Navigation_Bar SHALL render as a fixed bottom tab bar with Navigation_Items displayed as icons with compact labels beneath
3. IF the number of Navigation_Items exceeds 5, THEN THE Navigation_Bar SHALL display the first 4 items as primary visible items and group the remaining items under a "More" overflow icon
4. WHEN a user activates the "More" overflow menu, THE Navigation_Bar SHALL display the remaining Navigation_Items in a popover panel (desktop) or slide-up panel (mobile) within 200ms
5. WHILE the viewport width is at or below the Mobile_Breakpoint (768px), THE Navigation_Bar SHALL provide a minimum touch target of 44x44 pixels for each Navigation_Item
6. WHEN a user taps outside the overflow panel or activates a Navigation_Item within it, THE Navigation_Bar SHALL dismiss the overflow panel within 150ms
7. THE Navigation_Bar SHALL visually distinguish the currently active Navigation_Item from inactive items by applying a distinct highlight style to the active item
8. WHEN a user activates a Navigation_Item, THE Navigation_Bar SHALL navigate to the corresponding section and update the active item indicator within 100ms of the activation event

### Requirement 3: Consolidated League Dashboard

**User Story:** As a user, I want related content grouped together in one view, so that I spend less time navigating between separate pages for closely related information.

#### Acceptance Criteria

1. THE League_Dashboard SHALL display the standings table, draft status, and participant management as vertically stacked sections within a single scrollable view, without requiring navigation to separate routes
2. WHEN the user selects the "Tournament" navigation section, THE App_Shell SHALL display a Tab_Panel containing Schedule, Groups, and Bracket as switchable tabs, with the first tab (Schedule) selected by default
3. WHEN the user selects the "Live" navigation section, THE App_Shell SHALL display a Tab_Panel containing Match Day and Activity Feed as switchable tabs, with the first tab (Match Day) selected by default
4. WHEN the user switches between tabs within a Tab_Panel, THE Tab_Panel SHALL update the displayed content without a full page navigation or route change, and SHALL visually indicate the active tab by applying a distinct selected state to the active tab control
5. THE Tab_Panel SHALL preserve the scroll position of each tab when the user switches away and returns within the same browser session
6. IF tab content fails to load, THEN THE Tab_Panel SHALL display an error message indicating the content could not be retrieved, while keeping the tab controls interactive so the user can switch to other tabs

### Requirement 4: Modern Visual Design System

**User Story:** As a user, I want the app to look modern and visually appealing, so that it feels fun and engaging to use with friends.

#### Acceptance Criteria

1. THE Theme_System SHALL define a color palette with primary, primary-light, primary-dark, secondary, secondary-light, and secondary-dark tokens, where all text-on-background combinations maintain a minimum WCAG AA contrast ratio of 4.5:1 for normal text and 3:1 for large text (18px bold or 24px regular and above)
2. THE Theme_System SHALL use a font stack with Inter (or a variable font supporting weights 400 through 700) as the primary typeface, and define a typographic scale of at least 6 distinct size tokens ranging from 0.75rem (captions) to 2.5rem (page headings)
3. THE Card_Component SHALL apply consistent styling with 16px border-radius, a box-shadow of no more than 15px blur radius and no more than 0.1 opacity, and a backdrop-filter blur of 4px to 12px for overlapping elements
4. THE Theme_System SHALL support both light and dark modes using CSS custom properties, with color and background-color transitions between 200ms and 350ms using an ease or ease-in-out timing function
5. THE Theme_System SHALL define spacing tokens using an 8px base grid system, providing at minimum tokens for 4px, 8px, 16px, 24px, 32px, and 48px increments
6. WHEN the user toggles between light and dark mode, THE Theme_System SHALL persist the selected preference to local storage and apply it on subsequent page loads without a visible flash of the opposite theme

### Requirement 5: Responsive Content Layout

**User Story:** As a user, I want the layout to adapt fluidly to my screen size, so that content is readable and usable on any device.

#### Acceptance Criteria

1. WHILE the viewport width is above 1024px, THE Responsive_Layout SHALL render the Content_Area with a maximum width of 1200px centered horizontally with left and right padding of 32px
2. WHILE the viewport width is between 768px and 1024px, THE Responsive_Layout SHALL render content in a single column with left and right padding of 16px
3. WHILE the viewport width is at or below 768px, THE Responsive_Layout SHALL stack all content vertically with left and right padding of 16px and no additional horizontal padding on child containers
4. THE Responsive_Layout SHALL use CSS Grid or Flexbox for all layout composition without fixed pixel widths on content containers
5. WHEN the viewport is resized, THE Responsive_Layout SHALL reflow content without introducing a horizontal scrollbar or causing visible content to shift position by more than the change in available width
6. WHILE the viewport width is at or below 768px, THE Responsive_Layout SHALL ensure all interactive elements remain at least 44px in both width and height to meet minimum touch target size

### Requirement 6: Enhanced Card and Component Styling

**User Story:** As a user, I want visual hierarchy that makes it easy to scan information, so that I can quickly find what matters to me.

#### Acceptance Criteria

1. THE Card_Component SHALL provide three elevation levels: flat (no box-shadow), raised (box-shadow offset-y 4px, blur 6px), and prominent (box-shadow offset-y 10px, blur 15px), for establishing visual hierarchy between content sections
2. WHEN a user hovers over a Card_Component that contains a navigational link or clickable action, THE Card_Component SHALL translate upward by 2px on the Y-axis and transition from its current elevation shadow to the next higher elevation shadow, completing the transition within 200ms using an ease timing function
3. THE League_Dashboard SHALL use the prominent elevation for the standings table card and flat elevation for the add-participant section and navigation panels
4. THE App_Shell SHALL apply consistent section spacing of 24px between Card_Components within the Content_Area
5. WHILE the viewport width is 768px or wider, THE Card_Component SHALL apply 24px internal padding
6. WHILE the viewport width is narrower than 768px, THE Card_Component SHALL apply 16px internal padding

### Requirement 7: Animated Transitions and Micro-interactions

**User Story:** As a user, I want smooth transitions between views and interactive feedback, so that the app feels polished and responsive to my actions.

#### Acceptance Criteria

1. WHEN the user navigates between sections within the App_Shell, THE Content_Area SHALL apply a fade-in transition of 200ms duration using an opacity change from 0 to 1 on the incoming content
2. WHEN the user switches tabs within a Tab_Panel, THE Tab_Panel SHALL animate the content transition with a horizontal slide of 150ms in the direction of the selected tab relative to the previously active tab (left-to-right when selecting a tab to the right, right-to-left when selecting a tab to the left)
3. WHEN a user presses (mousedown or touchstart) a button or Navigation_Item, THE App_Shell SHALL apply a scale transform of 0.96 within 100ms of the press event, and revert the scale on release
4. WHEN a user hovers over or focuses a button or Navigation_Item, THE App_Shell SHALL apply a visible change in background color or opacity within 100ms of the hover or focus event
5. IF the user has enabled reduced-motion preferences in their operating system (prefers-reduced-motion: reduce), THEN THE App_Shell SHALL replace all fade and slide transitions with instant content swaps (0ms duration) while preserving non-animated visual feedback such as color and opacity changes on interaction
6. THE App_Shell SHALL ensure that no animation prevents pointer events, keyboard input, or content visibility for longer than 300ms from the moment the animation begins

### Requirement 8: Points History and My Teams Integration

**User Story:** As a user, I want quick access to my personal stats and points history without navigating away from the main dashboard, so that I can track my progress in context.

#### Acceptance Criteria

1. WHEN the user selects "My Teams" from the Navigation_Bar, THE App_Shell SHALL display a participant selector listing all participants in the league, and WHEN a participant is selected, THE App_Shell SHALL render that participant's team dashboard within the Content_Area using client-side routing without triggering a full page reload
2. WHEN the user selects "Stats" from the Navigation_Bar, THE App_Shell SHALL display a Tab_Panel containing two switchable tabs: "Points History" showing the cumulative points timeline chart, and "Standings" showing the league standings table with rank, total points, wins, draws, losses, and goal difference for each participant
3. WHILE the league draft status is "completed" and a participant is identified via the participant selector, THE League_Dashboard SHALL display a points summary widget in the dashboard header area showing that participant's current rank (numeric position) and total points (integer value)
4. WHEN new match results are available, THE points summary widget SHALL update its displayed rank and total points values within the next polling cycle of 30 seconds
5. IF the league draft status is not "completed", THEN THE League_Dashboard SHALL hide the points summary widget and display no rank or points data in the header area
