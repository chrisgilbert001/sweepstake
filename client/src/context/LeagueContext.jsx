import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { getLeague } from '../api/leagues.js';
import { getResults } from '../api/results.js';
import { getTeams } from '../api/teams.js';

const LeagueContext = createContext(undefined);

const POLLING_INTERVAL = 30000; // 30 seconds

/**
 * LeagueProvider — fetches and provides shared league data to all shell children.
 * Uses the slug from React Router params to fetch league, results, and teams.
 * Implements 30s polling for data refresh.
 */
export function LeagueProvider({ children }) {
  const { slug } = useParams();

  const [league, setLeague] = useState(null);
  const [results, setResults] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    if (!slug) return;

    try {
      const [leagueData, resultsData, teamsData] = await Promise.all([
        getLeague(slug),
        getResults(),
        getTeams(),
      ]);

      setLeague(leagueData);
      setResults(Array.isArray(resultsData) ? resultsData : (resultsData.results || []));

      // Flatten teams from pots structure
      const allTeams = teamsData.pots
        ? teamsData.pots.flatMap((pot) => pot.teams)
        : Array.isArray(teamsData) ? teamsData : [];
      setTeams(allTeams);

      setError(null);
    } catch (err) {
      setError(err.message || 'Failed to load league data');
    } finally {
      setLoading(false);
    }
  }, [slug]);

  // Initial fetch and refetch on slug change
  useEffect(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]);

  // Polling interval for data refresh
  useEffect(() => {
    const interval = setInterval(fetchData, POLLING_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchData]);

  const participants = league?.participants || [];
  const draftStatus = league?.draft?.status || 'not_started';

  const value = {
    league,
    participants,
    draftStatus,
    teams,
    results,
    loading,
    error,
    refetch: fetchData,
  };

  return (
    <LeagueContext.Provider value={value}>
      {children}
    </LeagueContext.Provider>
  );
}

export function useLeague() {
  const context = useContext(LeagueContext);
  if (context === undefined) {
    throw new Error('useLeague must be used within a LeagueProvider');
  }
  return context;
}

export default LeagueContext;
