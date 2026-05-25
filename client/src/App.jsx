import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext.jsx';
import HomePage from './pages/HomePage.jsx';
import JoinPage from './pages/JoinPage.jsx';
import AdminPanel from './pages/AdminPanel.jsx';
import AppShell from './components/shell/AppShell.jsx';
import LeagueDashboard from './pages/LeagueDashboard.jsx';
import TournamentPanel from './pages/TournamentPanel.jsx';
import LivePanel from './pages/LivePanel.jsx';
import StatsPanel from './pages/StatsPanel.jsx';
import MyTeamsView from './pages/MyTeamsView.jsx';
import DraftSession from './pages/DraftSession.jsx';

function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/admin" element={<AdminPanel />} />
          <Route path="/join/:joinCode" element={<JoinPage />} />
          <Route path="/league/:slug" element={<AppShell />}>
            <Route index element={<LeagueDashboard />} />
            <Route path="tournament" element={<TournamentPanel />} />
            <Route path="live" element={<LivePanel />} />
            <Route path="stats" element={<StatsPanel />} />
            <Route path="my-teams" element={<MyTeamsView />} />
            <Route path="draft" element={<DraftSession />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
