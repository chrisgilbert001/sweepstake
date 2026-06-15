import { useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useLeague } from '../context/LeagueContext.jsx';
import { runFullDraft } from '../api/draft.js';
import { getTournamentOdds, getMatchOdds } from '../api/odds.js';
import Card from '../components/ui/Card.jsx';
import StandingsTable from '../components/StandingsTable.jsx';
import ShareExportButtons from '../components/ShareExportButtons.jsx';
import TeamDetailModal from '../components/TeamDetailModal.jsx';
import DraftRevealDialog from '../components/DraftRevealDialog.jsx';
import './LeagueDashboard.css';

/**
 * LeagueDashboard — index route for /league/:slug.
 * Renders standings, participant management, draft actions, and points summary.
 * Uses LeagueContext for shared league data (already polled every 30s).
 */
export default function LeagueDashboard() {
  const { slug } = useParams();
  const { league, participants, draftStatus, teams, results, loading, error, refetch } = useLeague();

  // Copy link state
  const [copied, setCopied] = useState(false);

  // Draft run state
  const [runningDraft, setRunningDraft] = useState(false);

  // Draft reveal dialog state
  const [showReveal, setShowReveal] = useState(true);

  // Team detail modal state
  const [selectedTeamId, setSelectedTeamId] = useState(null);
  const [matchOdds, setMatchOdds] = useState({});

  // Tournament odds (fetched once)
  const [tournamentOdds, setTournamentOdds] = useState(null);
  const [oddsLoaded, setOddsLoaded] = useState(false);

  // Tournament status
  const [isTournamentComplete, setIsTournamentComplete] = useState(false);

  // Ref for standings table (used by ShareExportButtons for image capture)
  const standingsRef = useRef(null);

  // Fetch tournament odds on first render when draft is completed
  if (!oddsLoaded && draftStatus === 'completed') {
    setOddsLoaded(true);
    getTournamentOdds()
      .then((data) => {
        if (data?.odds) setTournamentOdds(data.odds);
      })
      .catch(() => {});

    // Check tournament status
    fetch('/api/tournament')
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (data?.status === 'complete') setIsTournamentComplete(true);
      })
      .catch(() => {});
  }

  // Compute standings client-side
  function computeStandings() {
    if (!league || !league.participants || draftStatus !== 'completed') {
      return [];
    }

    const standings = league.participants.map((participant) => {
      const allocations = league.draft?.allocations?.[participant.id];
      if (!allocations) {
        return {
          participantId: participant.id,
          participantName: participant.name,
          points: 0,
          wins: 0,
          draws: 0,
          losses: 0,
          goalsScored: 0,
          goalsConceded: 0,
          goalDifference: 0,
        };
      }

      const participantTeams = Object.values(allocations).flat();
      let points = 0, wins = 0, draws = 0, losses = 0;
      let goalsScored = 0, goalsConceded = 0;

      for (const result of results) {
        // The third-place playoff does not count toward sweepstake scoring.
        // Accept both the API-sync name and the manual-entry name.
        if (result.stage === 'Third Place' || result.stage === 'Third-place playoff') continue;
        for (const teamId of participantTeams) {
          if (result.homeTeam === teamId) {
            goalsScored += result.homeScore;
            goalsConceded += result.awayScore;
            if (result.homeScore > result.awayScore) {
              points += 3;
              wins++;
            } else if (result.homeScore === result.awayScore) {
              points += 1;
              draws++;
              if (result.penaltyShootout?.winner === teamId) {
                points += 1;
              }
            } else {
              losses++;
            }
          } else if (result.awayTeam === teamId) {
            goalsScored += result.awayScore;
            goalsConceded += result.homeScore;
            if (result.awayScore > result.homeScore) {
              points += 3;
              wins++;
            } else if (result.homeScore === result.awayScore) {
              points += 1;
              draws++;
              if (result.penaltyShootout?.winner === teamId) {
                points += 1;
              }
            } else {
              losses++;
            }
          }
        }
      }

      return {
        participantId: participant.id,
        participantName: participant.name,
        points,
        wins,
        draws,
        losses,
        goalsScored,
        goalsConceded,
        goalDifference: goalsScored - goalsConceded,
      };
    });

    // Rank participants
    standings.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.wins !== a.wins) return b.wins - a.wins;
      return b.goalDifference - a.goalDifference;
    });

    for (let i = 0; i < standings.length; i++) {
      if (i === 0) {
        standings[i].rank = 1;
      } else {
        const prev = standings[i - 1];
        const curr = standings[i];
        if (
          curr.points === prev.points &&
          curr.wins === prev.wins &&
          curr.goalDifference === prev.goalDifference
        ) {
          curr.rank = prev.rank;
        } else {
          curr.rank = i + 1;
        }
      }
    }

    return standings;
  }

  // Compute eliminated teams
  function getEliminatedTeams() {
    const eliminated = new Set();
    // Accept both the API-sync stage names (plural) and the original
    // manual-entry names (singular); include Round of 32 (48-team format).
    const knockoutStages = [
      'Round of 32',
      'Round of 16',
      'Quarter-finals', 'Quarter-final',
      'Semi-finals', 'Semi-final',
      'Third Place', 'Third-place playoff',
    ];

    for (const result of results) {
      // Live (in-progress) results are provisional — never eliminate on them
      if (result.status === 'live') continue;
      if (!knockoutStages.includes(result.stage)) continue;

      if (result.penaltyShootout) {
        const loser =
          result.penaltyShootout.winner === result.homeTeam
            ? result.awayTeam
            : result.homeTeam;
        eliminated.add(loser);
      } else if (result.homeScore > result.awayScore) {
        eliminated.add(result.awayTeam);
      } else if (result.awayScore > result.homeScore) {
        eliminated.add(result.homeTeam);
      }
    }

    return eliminated;
  }

  function handleCopyLink() {
    const joinUrl = `${window.location.origin}/join/${league.joinCode}`;
    navigator.clipboard.writeText(joinUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  async function handleRunDraft() {
    setRunningDraft(true);
    try {
      await runFullDraft(slug);
      await refetch();
    } catch (err) {
      // eslint-disable-next-line no-alert
      alert(err.message || 'Failed to run draft');
    } finally {
      setRunningDraft(false);
    }
  }

  function handleTeamClick(teamId) {
    setSelectedTeamId(teamId);
    // Fetch match odds for all fixtures involving this team
    const teamResults = results.filter(
      (r) => r.homeTeam === teamId || r.awayTeam === teamId
    );
    const fixtureIds = teamResults.map((r) => r.fixtureId).filter(Boolean);

    // Fetch match odds for relevant fixtures
    Promise.all(
      fixtureIds
        .filter((fid) => !matchOdds[fid])
        .map((fid) =>
          getMatchOdds(fid)
            .then((data) => ({ fixtureId: fid, data }))
            .catch(() => null)
        )
    ).then((oddsResults) => {
      const newOdds = { ...matchOdds };
      for (const item of oddsResults) {
        if (item?.data) {
          newOdds[item.fixtureId] = item.data;
        }
      }
      setMatchOdds(newOdds);
    });
  }

  if (loading) {
    return (
      <div className="league-dashboard league-dashboard__loading">
        <p>Loading dashboard...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="league-dashboard league-dashboard__error">
        <h2>League not found</h2>
        <p>{error}</p>
        <Link to="/">← Back to Home</Link>
      </div>
    );
  }

  if (!league) return null;

  const participantCount = participants.length;
  const standings = computeStandings();
  const eliminatedTeams = getEliminatedTeams();
  const hasLiveResults = results.some((r) => r.status === 'live');

  // Teams currently in a match in progress, so the standings can flag which
  // participants have a live game.
  const liveTeamIds = new Set();
  for (const r of results) {
    if (r.status === 'live') {
      liveTeamIds.add(r.homeTeam);
      liveTeamIds.add(r.awayTeam);
    }
  }

  // Check if current user is the league owner
  const currentEmail = localStorage.getItem('sweepstake_user_email') || '';
  const isOwner = league.createdBy && league.createdBy === currentEmail;
  const currentParticipant = participants.find(p => p.email === currentEmail);
  const selectedTeam = teams.find((t) => t.id === selectedTeamId);

  // Points summary: show the league leader's stats
  const leader = standings.length > 0 ? standings[0] : null;

  // Show draft reveal dialog on first visit after draft completes
  const shouldReveal = draftStatus === 'completed' && currentParticipant &&
    showReveal && !currentParticipant.draftSeen;

  return (
    <div className="league-dashboard">
      {shouldReveal && (
        <DraftRevealDialog
          slug={slug}
          allocations={league.draft?.allocations || {}}
          participantId={currentParticipant.id}
          email={currentEmail}
          teams={teams}
          onClose={() => setShowReveal(false)}
        />
      )}
      {/* Dashboard Header */}
      <div className="league-dashboard__header">
        <div className="league-dashboard__meta">
          <span className="league-dashboard__participant-count">
            👥 {participantCount}/6 participants
          </span>
          <div className="league-dashboard__join-link">
            <span className="league-dashboard__join-url">
              {window.location.origin}/join/{league.joinCode}
            </span>
            <button
              className={`league-dashboard__copy-btn ${copied ? 'copied' : ''}`}
              onClick={handleCopyLink}
              aria-label="Copy join link"
            >
              {copied ? '✓ Copied' : 'Copy'}
            </button>
          </div>
        </div>

        {/* Points Summary Widget — only shown when draft is completed (task 7.5, 7.7) */}
        {draftStatus === 'completed' && leader && (
          <div className="points-summary-widget" aria-label="Points summary">
            <span className="points-summary-widget__rank">🏅 #{leader.rank}</span>
            <span className="points-summary-widget__name">{leader.participantName}</span>
            <span className="points-summary-widget__points">{leader.points} pts</span>
          </div>
        )}
      </div>

      {/* Participant list — shown when less than 6 participants */}
      {participantCount < 6 && (
        <Card elevation="flat">
          <h3 className="add-participant__title">Participants ({participantCount}/6)</h3>
          <p className="add-participant__hint">Share the join link to invite others.</p>
          {participantCount > 0 && (
            <div className="add-participant__chips">
              {participants.map((p) => (
                <span key={p.id} className="add-participant__chip">
                  {p.name}
                </span>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Draft actions */}
      {participantCount === 6 && draftStatus === 'not_started' && isOwner && (
        <div className="league-dashboard__draft-actions">
          <button
            className="league-dashboard__start-draft-btn"
            onClick={handleRunDraft}
            disabled={runningDraft}
          >
            {runningDraft ? '🎲 Running Draft...' : '🎯 Start Draft'}
          </button>
        </div>
      )}

      {participantCount === 6 && draftStatus === 'not_started' && !isOwner && (
        <div className="league-dashboard__draft-actions">
          <div className="league-dashboard__draft-in-progress">
            <span>Waiting for the league owner to start the draft...</span>
          </div>
        </div>
      )}

      {draftStatus === 'in_progress' && (
        <div className="league-dashboard__draft-actions">
          <div className="league-dashboard__draft-in-progress">
            <span>🎡 Draft is in progress!</span>
            <Link to={`/league/${slug}/draft`}>Continue Draft →</Link>
          </div>
        </div>
      )}

      {/* Standings table — shown when draft is complete (task 7.3: prominent Card) */}
      {draftStatus === 'completed' && (
        <Card elevation="prominent">
          <ShareExportButtons
            leagueSlug={slug}
            leagueName={league.name}
            standingsRef={standingsRef}
          />
          <div ref={standingsRef} className="league-dashboard__standings">
            <StandingsTable
              standings={standings}
              allocations={league.draft?.allocations || {}}
              eliminatedTeams={eliminatedTeams}
              tournamentOdds={tournamentOdds}
              teams={teams}
              isTournamentComplete={isTournamentComplete}
              hasLiveResults={hasLiveResults}
              liveTeamIds={liveTeamIds}
              onTeamClick={handleTeamClick}
            />
          </div>
        </Card>
      )}

      {/* Team Detail Modal */}
      {selectedTeamId && selectedTeam && (
        <TeamDetailModal
          teamId={selectedTeamId}
          teamName={selectedTeam.name}
          results={results}
          matchOdds={matchOdds}
          teams={teams}
          onClose={() => setSelectedTeamId(null)}
        />
      )}
    </div>
  );
}
