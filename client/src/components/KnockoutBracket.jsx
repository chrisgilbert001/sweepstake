import { useMemo } from 'react';

// Layout constants
const FIXTURE_WIDTH = 200;
const FIXTURE_HEIGHT = 60;
const ROUND_GAP = 80;
const FIXTURE_VERTICAL_GAP = 20;
const PADDING = 20;
const CONNECTOR_OFFSET = 20;

/**
 * SVG-based knockout bracket renderer.
 * Displays rounds in columns left to right with connector lines between rounds.
 *
 * Props:
 * - rounds: Array of { name, fixtures } from the bracket API
 * - ownerMap: Object mapping teamId -> participant name
 * - teamNameMap: Object mapping teamId -> display name
 */
export default function KnockoutBracket({ rounds, ownerMap, teamNameMap }) {
  const layout = useMemo(() => computeLayout(rounds), [rounds]);

  if (!layout) return null;

  const { width, height, roundLayouts } = layout;

  return (
    <svg
      className="knockout-bracket-svg"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Knockout stage bracket"
    >
      {/* Connector lines between rounds */}
      {roundLayouts.map((roundLayout, roundIndex) => {
        if (roundIndex === roundLayouts.length - 1) return null;
        const nextRound = roundLayouts[roundIndex + 1];
        return roundLayout.fixtures.map((fixture, fixtureIndex) => {
          const nextFixtureIndex = Math.floor(fixtureIndex / 2);
          const nextFixture = nextRound.fixtures[nextFixtureIndex];
          if (!nextFixture) return null;

          const startX = fixture.x + FIXTURE_WIDTH;
          const startY = fixture.y + FIXTURE_HEIGHT / 2;
          const endX = nextFixture.x;
          const endY = nextFixture.y + FIXTURE_HEIGHT / 2;
          const midX = startX + CONNECTOR_OFFSET;

          return (
            <path
              key={`connector-${roundIndex}-${fixtureIndex}`}
              d={`M ${startX} ${startY} H ${midX} V ${endY} H ${endX}`}
              fill="none"
              stroke="var(--color-border, #dee2e6)"
              strokeWidth="2"
            />
          );
        });
      })}

      {/* Fixture boxes */}
      {roundLayouts.map((roundLayout, roundIndex) => (
        <g key={`round-${roundIndex}`}>
          {/* Round title */}
          <text
            x={roundLayout.x + FIXTURE_WIDTH / 2}
            y={PADDING - 4}
            textAnchor="middle"
            className="bracket-round-title"
            fill="var(--color-text, #212529)"
            fontSize="12"
            fontWeight="600"
          >
            {roundLayout.name}
          </text>

          {roundLayout.fixtures.map((fixture, fixtureIndex) => (
            <FixtureBox
              key={`fixture-${roundIndex}-${fixtureIndex}`}
              fixture={fixture.data}
              x={fixture.x}
              y={fixture.y}
              ownerMap={ownerMap}
              teamNameMap={teamNameMap}
            />
          ))}
        </g>
      ))}
    </svg>
  );
}

function FixtureBox({ fixture, x, y, ownerMap, teamNameMap }) {
  const homeTeamName = getDisplayName(fixture.homeTeam, teamNameMap, fixture.homePlaceholder);
  const awayTeamName = getDisplayName(fixture.awayTeam, teamNameMap, fixture.awayPlaceholder);
  const isHomePlaceholder = fixture.homeTeam === 'TBD';
  const isAwayPlaceholder = fixture.awayTeam === 'TBD';
  const hasResult = fixture.homeScore !== undefined;
  const homeIsWinner = hasResult && fixture.winner === fixture.homeTeam;
  const awayIsWinner = hasResult && fixture.winner === fixture.awayTeam;
  const homeOwner = fixture.homeTeam !== 'TBD' ? ownerMap[fixture.homeTeam] : null;
  const awayOwner = fixture.awayTeam !== 'TBD' ? ownerMap[fixture.awayTeam] : null;

  const halfHeight = FIXTURE_HEIGHT / 2;

  return (
    <g>
      {/* Home team row */}
      <rect
        x={x}
        y={y}
        width={FIXTURE_WIDTH}
        height={halfHeight}
        rx="4"
        ry="4"
        fill={homeOwner ? 'var(--bracket-owner-bg, #e8f5e9)' : 'var(--color-bg-card, #ffffff)'}
        stroke="var(--color-border, #dee2e6)"
        strokeWidth="1"
      />
      <text
        x={x + 6}
        y={y + halfHeight / 2 + 1}
        dominantBaseline="middle"
        className="bracket-team-name"
        fill={isHomePlaceholder ? 'var(--color-text-muted, #6c757d)' : 'var(--color-text, #212529)'}
        fontSize="11"
        fontWeight={homeIsWinner ? '700' : '400'}
        fontStyle={isHomePlaceholder ? 'italic' : 'normal'}
      >
        {truncateText(homeTeamName, 18)}
        {homeOwner && (
          <tspan fontSize="9" fill="var(--color-text-muted, #6c757d)" dx="4">
            ({truncateText(homeOwner, 8)})
          </tspan>
        )}
      </text>
      {hasResult && (
        <text
          x={x + FIXTURE_WIDTH - 6}
          y={y + halfHeight / 2 + 1}
          dominantBaseline="middle"
          textAnchor="end"
          fontSize="11"
          fontWeight={homeIsWinner ? '700' : '400'}
          fill="var(--color-text, #212529)"
        >
          {fixture.homeScore}
          {fixture.penaltyShootout && (
            <tspan fontSize="9" fill="var(--color-text-muted, #6c757d)">
              {' '}({fixture.penaltyShootout.homeGoals})
            </tspan>
          )}
        </text>
      )}

      {/* Away team row */}
      <rect
        x={x}
        y={y + halfHeight}
        width={FIXTURE_WIDTH}
        height={halfHeight}
        rx="4"
        ry="4"
        fill={awayOwner ? 'var(--bracket-owner-bg, #e8f5e9)' : 'var(--color-bg-card, #ffffff)'}
        stroke="var(--color-border, #dee2e6)"
        strokeWidth="1"
      />
      <text
        x={x + 6}
        y={y + halfHeight + halfHeight / 2 + 1}
        dominantBaseline="middle"
        className="bracket-team-name"
        fill={isAwayPlaceholder ? 'var(--color-text-muted, #6c757d)' : 'var(--color-text, #212529)'}
        fontSize="11"
        fontWeight={awayIsWinner ? '700' : '400'}
        fontStyle={isAwayPlaceholder ? 'italic' : 'normal'}
      >
        {truncateText(awayTeamName, 18)}
        {awayOwner && (
          <tspan fontSize="9" fill="var(--color-text-muted, #6c757d)" dx="4">
            ({truncateText(awayOwner, 8)})
          </tspan>
        )}
      </text>
      {hasResult && (
        <text
          x={x + FIXTURE_WIDTH - 6}
          y={y + halfHeight + halfHeight / 2 + 1}
          dominantBaseline="middle"
          textAnchor="end"
          fontSize="11"
          fontWeight={awayIsWinner ? '700' : '400'}
          fill="var(--color-text, #212529)"
        >
          {fixture.awayScore}
          {fixture.penaltyShootout && (
            <tspan fontSize="9" fill="var(--color-text-muted, #6c757d)">
              {' '}({fixture.penaltyShootout.awayGoals})
            </tspan>
          )}
        </text>
      )}
    </g>
  );
}

/**
 * Compute the layout positions for all fixtures in the bracket.
 * Each round is a column, fixtures are vertically centered relative to
 * the fixtures they feed into in the next round.
 */
function computeLayout(rounds) {
  if (!rounds || rounds.length === 0) return null;

  // Find the round with the most fixtures to determine max height
  const maxFixtures = Math.max(...rounds.map((r) => r.fixtures.length));
  if (maxFixtures === 0) return null;

  const roundLayouts = [];

  // Calculate total height based on the first round (most fixtures)
  const firstRoundHeight =
    rounds[0].fixtures.length * FIXTURE_HEIGHT +
    (rounds[0].fixtures.length - 1) * FIXTURE_VERTICAL_GAP;

  const totalHeight = firstRoundHeight + PADDING * 2 + 20; // extra for round titles

  for (let roundIndex = 0; roundIndex < rounds.length; roundIndex++) {
    const round = rounds[roundIndex];
    const x = PADDING + roundIndex * (FIXTURE_WIDTH + ROUND_GAP);
    const fixtureCount = round.fixtures.length;

    // Calculate vertical spacing so fixtures are centered
    const roundHeight =
      fixtureCount * FIXTURE_HEIGHT + (fixtureCount - 1) * FIXTURE_VERTICAL_GAP;
    const startY = PADDING + 20 + (firstRoundHeight - roundHeight) / 2;

    const fixtureLayouts = round.fixtures.map((fixture, fixtureIndex) => {
      const y = startY + fixtureIndex * (FIXTURE_HEIGHT + FIXTURE_VERTICAL_GAP);
      return { x, y, data: fixture };
    });

    roundLayouts.push({
      name: round.name,
      x,
      fixtures: fixtureLayouts,
    });
  }

  const totalWidth =
    PADDING * 2 + rounds.length * FIXTURE_WIDTH + (rounds.length - 1) * ROUND_GAP;

  return { width: totalWidth, height: totalHeight, roundLayouts };
}

function getDisplayName(teamId, teamNameMap, placeholder) {
  if (teamId === 'TBD') {
    return placeholder || 'TBD';
  }
  return teamNameMap[teamId] || teamId;
}

function truncateText(text, maxLen) {
  if (!text) return '';
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 1) + '…';
}
