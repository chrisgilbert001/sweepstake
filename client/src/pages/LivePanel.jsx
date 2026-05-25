import TabPanel from '../components/shell/TabPanel.jsx';
import MatchDayView from './MatchDayView.jsx';
import ActivityFeed from './ActivityFeed.jsx';

/**
 * LivePanel — wraps MatchDayView and ActivityFeed in a TabPanel.
 * Rendered at /league/:slug/live
 */
export default function LivePanel() {
  const tabs = [
    { id: 'match-day', label: 'Match Day', content: <MatchDayView /> },
    { id: 'activity', label: 'Activity', content: <ActivityFeed /> },
  ];

  return <TabPanel tabs={tabs} defaultTab="match-day" />;
}
