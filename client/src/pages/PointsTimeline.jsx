import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { getPointsHistory } from '../api/pointsHistory.js';
import { useTheme } from '../context/ThemeContext.jsx';
import './PointsTimeline.css';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

// Distinct colour palette for participants (consistent across the app)
const PARTICIPANT_COLOURS = [
  '#2563eb', // blue
  '#dc2626', // red
  '#16a34a', // green
  '#9333ea', // purple
  '#ea580c', // orange
  '#0891b2', // cyan
];

export default function PointsTimeline() {
  const { slug } = useParams();
  const { theme } = useTheme();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchHistory() {
      try {
        const data = await getPointsHistory(slug);
        setHistory(Array.isArray(data) ? data : []);
        setError(null);
      } catch (err) {
        setError(err.message || 'Failed to load points history');
      } finally {
        setLoading(false);
      }
    }
    fetchHistory();
  }, [slug]);

  if (loading) {
    return (
      <div className="container points-timeline-loading">
        <p>Loading points history...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container points-timeline-error">
        <h2>Error</h2>
        <p>{error}</p>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="container points-timeline-empty">
        <h1>Points History</h1>
        <p className="empty-message">
          Points data will appear once match results are available.
        </p>
      </div>
    );
  }

  // Build chart data from history
  const labels = history.map((entry) => {
    const date = new Date(entry.matchDay);
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  });

  // Get all unique participants from the first entry
  const participants = history[0].participants.map((p) => ({
    id: p.participantId,
    name: p.participantName,
  }));

  const datasets = participants.map((participant, index) => {
    const colour = PARTICIPANT_COLOURS[index % PARTICIPANT_COLOURS.length];
    const data = history.map((entry) => {
      const pData = entry.participants.find(
        (p) => p.participantId === participant.id
      );
      return pData ? pData.cumulativePoints : 0;
    });

    return {
      label: participant.name,
      data,
      borderColor: colour,
      backgroundColor: colour,
      tension: 0.3,
      pointRadius: 4,
      pointHoverRadius: 6,
    };
  });

  const chartData = { labels, datasets };

  // Read theme-aware colours from CSS variables so the chart is legible in
  // both the stadium-dark and light themes. `theme` is a dependency so the
  // chart re-renders when the user toggles.
  const rootStyles =
    typeof window !== 'undefined'
      ? getComputedStyle(document.documentElement)
      : null;
  const readVar = (name, fallback) =>
    (rootStyles && rootStyles.getPropertyValue(name).trim()) || fallback;
  const textColor = readVar('--color-text', theme === 'dark' ? '#e9f1ec' : '#0f1c16');
  const mutedColor = readVar('--color-text-muted', '#8fa79b');
  const gridColor =
    theme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(15,28,22,0.08)';

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      title: {
        display: true,
        text: 'Points History',
        color: textColor,
        font: { size: 16, family: "'Archivo', sans-serif", weight: '800' },
      },
      legend: {
        position: 'top',
        labels: { color: textColor },
        onClick: (e, legendItem, legend) => {
          // Default Chart.js legend click toggles dataset visibility
          const index = legendItem.datasetIndex;
          const ci = legend.chart;
          if (ci.isDatasetVisible(index)) {
            ci.hide(index);
            legendItem.hidden = true;
          } else {
            ci.show(index);
            legendItem.hidden = false;
          }
        },
      },
      tooltip: {
        callbacks: {
          title: (tooltipItems) => {
            const idx = tooltipItems[0].dataIndex;
            const entry = history[idx];
            const date = new Date(entry.matchDay);
            return date.toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            });
          },
          label: (tooltipItem) => {
            const idx = tooltipItem.dataIndex;
            const datasetIdx = tooltipItem.datasetIndex;
            const entry = history[idx];
            const participant = entry.participants[datasetIdx];

            if (!participant) return tooltipItem.dataset.label;

            const lines = [
              `${participant.participantName}: ${participant.cumulativePoints} pts`,
            ];

            if (participant.matchResults && participant.matchResults.length > 0) {
              for (const result of participant.matchResults) {
                lines.push(
                  `  ${result.teamName} ${result.score} ${result.opponentName} (+${result.pointsEarned})`
                );
              }
            }

            return lines;
          },
        },
      },
    },
    scales: {
      x: {
        title: {
          display: true,
          text: 'Match Day',
          color: mutedColor,
        },
        ticks: { color: mutedColor },
        grid: { color: gridColor },
      },
      y: {
        title: {
          display: true,
          text: 'Cumulative Points',
          color: mutedColor,
        },
        ticks: { color: mutedColor },
        grid: { color: gridColor },
        beginAtZero: true,
      },
    },
  };

  return (
    <div className="container points-timeline">
      <div className="points-timeline-header">
        <h1>Points History</h1>
      </div>
      <div className="chart-container">
        <Line data={chartData} options={chartOptions} />
      </div>
    </div>
  );
}
