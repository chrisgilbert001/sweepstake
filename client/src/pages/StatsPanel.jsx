import TabPanel from '../components/shell/TabPanel.jsx';
import PointsTimeline from './PointsTimeline.jsx';
import StandingsTable from '../components/StandingsTable.jsx';
import { useLeague } from '../context/LeagueContext.jsx';

/**
 * StatsPanel — wraps PointsTimeline and StandingsTable in a TabPanel.
 * Rendered at /league/:slug/stats
 */
export default function StatsPanel() {
  const { league, results, teams } = useLeague();

  // Compute standings from league context data
  function computeStandings() {
    if (!league || !league.participants || league.draft?.status !== 'completed') {
      return [];
    }

    const standings = league.participants.map((participant) => {
      const allocations = league.draft.allocations?.[participant.id];
      if (!allocations) {
        return {
          participantId: participant.id,
          participantName: participant.name,
          points: 0,
          wins: 0,
          draws: 0,
          penaltyWins: 0,
          losses: 0,
          goalsScored: 0,
          goalsConceded: 0,
          goalDifference: 0,
        };
      }

      const participantTeams = Object.values(allocations).flat();
      let points = 0, wins = 0, draws = 0, penaltyWins = 0, losses = 0;
      let goalsScored = 0, goalsConceded = 0;

      for (const result of results) {
        // The third-place playoff does not count toward sweepstake scoring.
        // Accept both the API-sync name and the manual-entry name.
        if (result.stage === 'Third Place' || result.stage === 'Third-place playoff') continue;
        for (const teamId of participantTeams) {
          if (result.homeTeam === teamId) {
            goalsScored += result.homeScore;
            goalsConceded += result.awayScore;
            if (result.homeScore > result.awayScore) { points += 3; wins++; }
            else if (result.homeScore === result.awayScore) {
              points += 1;
              if (result.penaltyShootout?.winner === teamId) { points += 1; penaltyWins++; }
              else { draws++; }
            } else { losses++; }
          } else if (result.awayTeam === teamId) {
            goalsScored += result.awayScore;
            goalsConceded += result.homeScore;
            if (result.awayScore > result.homeScore) { points += 3; wins++; }
            else if (result.homeScore === result.awayScore) {
              points += 1;
              if (result.penaltyShootout?.winner === teamId) { points += 1; penaltyWins++; }
              else { draws++; }
            } else { losses++; }
          }
        }
      }

      return {
        participantId: participant.id,
        participantName: participant.name,
        points, wins, draws, penaltyWins, losses,
        goalsScored, goalsConceded,
        goalDifference: goalsScored - goalsConceded,
      };
    });

    standings.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.wins !== a.wins) return b.wins - a.wins;
      return b.goalDifference - a.goalDifference;
    });

    for (let i = 0; i < standings.length; i++) {
      if (i === 0) { standings[i].rank = 1; }
      else {
        const prev = standings[i - 1];
        const curr = standings[i];
        curr.rank = (curr.points === prev.points && curr.wins === prev.wins && curr.goalDifference === prev.goalDifference)
          ? prev.rank : i + 1;
      }
    }

    return standings;
  }

  const standings = computeStandings();

  function StandingsContent() {
    return (
      <StandingsTable
        standings={standings}
        allocations={league?.draft?.allocations || {}}
        eliminatedTeams={new Set()}
        tournamentOdds={null}
        teams={teams}
        isTournamentComplete={false}
      />
    );
  }

  const tabs = [
    { id: 'points-history', label: 'Points History', content: <PointsTimeline /> },
    { id: 'standings', label: 'Standings', content: <StandingsContent /> },
  ];

  return <TabPanel tabs={tabs} defaultTab="points-history" />;
}
