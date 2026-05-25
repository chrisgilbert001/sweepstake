import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import teamRoutes from './routes/teamRoutes.js';
import leagueRoutes from './routes/leagueRoutes.js';
import draftRoutes from './routes/draftRoutes.js';
import globalRoutes from './routes/globalRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import matchDayRoutes from './routes/matchDayRoutes.js';
import activityRoutes from './routes/activityRoutes.js';
import myTeamsRoutes from './routes/myTeamsRoutes.js';
import { startScheduler, stopScheduler } from './services/sync/syncScheduler.js';
import { validateMapping } from './services/sync/teamMapper.js';
import { readFile } from './services/storageService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;

// CORS middleware for local development
app.use(cors());

// JSON body parsing with error handling for malformed JSON
app.use((req, res, next) => {
  express.json()(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: 'Invalid request body' });
    }
    next();
  });
});

// Routes
app.use('/api/teams', teamRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', matchDayRoutes);
app.use('/api', activityRoutes);
app.use('/api', myTeamsRoutes);
app.use('/api', globalRoutes);
app.use('/api', leagueRoutes);
app.use('/api', draftRoutes);

// Health endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Serve static client files in production
const clientDistPath = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDistPath));

// 404 handler for unmatched API routes
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// SPA fallback — serve index.html for all non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(clientDistPath, 'index.html'));
});

// Global error handling middleware
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Internal server error';

  // Map known error types to appropriate HTTP status codes
  if (status === 400) {
    return res.status(400).json({ error: message });
  }
  if (status === 401) {
    return res.status(401).json({ error: message });
  }
  if (status === 404) {
    return res.status(404).json({ error: message });
  }
  if (status === 409) {
    return res.status(409).json({ error: message });
  }
  if (status === 503) {
    return res.status(503).json({ error: message });
  }

  // Default to 500 for unexpected errors
  res.status(500).json({ error: 'Internal server error' });
});

/**
 * Initializes the sync scheduler if the API key is configured and team mapping is valid.
 * Called on server boot (outside of test mode).
 */
async function initializeSync() {
  const apiKey = process.env.FOOTBALL_DATA_API_KEY;

  if (!apiKey || apiKey.trim() === '') {
    console.warn('[Sync] FOOTBALL_DATA_API_KEY is not set or empty. Automatic sync is disabled.');
    return;
  }

  // Validate team mapping against teams.json
  try {
    const teamsData = await readFile('teams.json');
    const internalTeamIds = teamsData.pots.flatMap(pot => pot.teams.map(t => t.id));
    const { valid, unmapped } = validateMapping(internalTeamIds);

    if (!valid) {
      console.error(
        `[Sync] Team mapping validation failed. Unmapped team codes: ${unmapped.join(', ')}. ` +
        'Automatic sync is disabled until the mapping is corrected.'
      );
      return;
    }
  } catch (error) {
    console.error(`[Sync] Failed to validate team mapping: ${error.message || error}. Automatic sync is disabled.`);
    return;
  }

  startScheduler();
  console.log('[Sync] Scheduler started successfully.');
}

// Only start listening when not in test mode
if (process.env.NODE_ENV !== 'test') {
  const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    initializeSync();
  });

  // Graceful shutdown handlers
  const gracefulShutdown = async (signal) => {
    console.log(`\n[Server] Received ${signal}. Shutting down gracefully...`);
    await stopScheduler();
    server.close(() => {
      console.log('[Server] HTTP server closed.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

export { initializeSync };
export default app;
