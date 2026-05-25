import TabPanel from '../components/shell/TabPanel.jsx';
import ScheduleView from './ScheduleView.jsx';
import GroupStageTable from './GroupStageTable.jsx';
import KnockoutBracketView from './KnockoutBracketView.jsx';

/**
 * TournamentPanel — wraps Schedule, Groups, and Bracket views in a TabPanel.
 * Rendered at /league/:slug/tournament
 */
export default function TournamentPanel() {
  const tabs = [
    { id: 'schedule', label: 'Schedule', content: <ScheduleView /> },
    { id: 'groups', label: 'Groups', content: <GroupStageTable /> },
    { id: 'bracket', label: 'Bracket', content: <KnockoutBracketView /> },
  ];

  return <TabPanel tabs={tabs} defaultTab="schedule" />;
}
