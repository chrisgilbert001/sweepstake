import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readdir, rm, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import request from 'supertest';
import app from '../index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LEAGUES_DIR = path.join(__dirname, '..', 'data', 'leagues');

async function cleanLeagues() {
  try {
    const files = await readdir(LEAGUES_DIR);
    for (const file of files) {
      if (file === '.gitkeep') continue;
      await rm(path.join(LEAGUES_DIR, file), { recursive: true });
    }
  } catch (e) { /* ignore */ }
}

async function createLeagueWith6Participants(leagueName = 'Draft League') {
  const createRes = await request(app)
    .post('/api/leagues')
    .send({ name: leagueName });

  const slug = createRes.body.slug;

  for (let i = 1; i <= 6; i++) {
    await request(app)
      .post(`/api/leagues/${slug}/participants`)
      .send({ name: `Player ${i}` });
  }

  return slug;
}

describe('Draft API Routes', () => {
  beforeEach(async () => {
    if (!existsSync(LEAGUES_DIR)) {
      await mkdir(LEAGUES_DIR, { recursive: true });
    }
    await cleanLeagues();
  });

  afterEach(async () => {
    await cleanLeagues();
  });

  describe('POST /api/leagues/:slug/draft/start', () => {
    it('starts the draft and returns draft state', async () => {
      const slug = await createLeagueWith6Participants();

      const res = await request(app)
        .post(`/api/leagues/${slug}/draft/start`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('in_progress');
      expect(res.body.order).toHaveLength(6);
      expect(res.body.currentPot).toBe(4);
      expect(res.body.currentRound).toBe(1);
      expect(res.body.currentPickIndex).toBe(0);
      expect(res.body.spinsCompleted).toBe(0);
      expect(res.body.allocations).toBeDefined();
    });

    it('returns 400 when league has fewer than 6 participants', async () => {
      const createRes = await request(app)
        .post('/api/leagues')
        .send({ name: 'Small League' });

      const slug = createRes.body.slug;

      await request(app)
        .post(`/api/leagues/${slug}/participants`)
        .send({ name: 'Alice' });

      const res = await request(app)
        .post(`/api/leagues/${slug}/draft/start`);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Exactly 6 participants required to start draft');
    });

    it('returns 400 when draft is already completed', async () => {
      const slug = await createLeagueWith6Participants();

      // Start the draft
      await request(app)
        .post(`/api/leagues/${slug}/draft/start`);

      // Complete all 48 spins
      for (let i = 0; i < 48; i++) {
        await request(app)
          .post(`/api/leagues/${slug}/draft/spin`);
      }

      // Try to start again
      const res = await request(app)
        .post(`/api/leagues/${slug}/draft/start`);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Draft has already been completed');
    });

    it('returns 404 for non-existent league', async () => {
      const res = await request(app)
        .post('/api/leagues/nonexistent/draft/start');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('League not found');
    });
  });

  describe('GET /api/leagues/:slug/draft/state', () => {
    it('returns draft state for a league with not_started draft', async () => {
      const slug = await createLeagueWith6Participants();

      const res = await request(app)
        .get(`/api/leagues/${slug}/draft/state`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('not_started');
    });

    it('returns draft state with available teams when in progress', async () => {
      const slug = await createLeagueWith6Participants();

      await request(app)
        .post(`/api/leagues/${slug}/draft/start`);

      const res = await request(app)
        .get(`/api/leagues/${slug}/draft/state`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('in_progress');
      expect(res.body.availableTeams).toBeDefined();
      expect(res.body.availableTeams.length).toBe(12);
      expect(res.body.currentPicker).toBeDefined();
      expect(res.body.order).toHaveLength(6);
    });

    it('returns 404 for non-existent league', async () => {
      const res = await request(app)
        .get('/api/leagues/nonexistent/draft/state');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('League not found');
    });
  });

  describe('POST /api/leagues/:slug/draft/spin', () => {
    it('performs a spin and returns selected team', async () => {
      const slug = await createLeagueWith6Participants();

      await request(app)
        .post(`/api/leagues/${slug}/draft/start`);

      const res = await request(app)
        .post(`/api/leagues/${slug}/draft/spin`);

      expect(res.status).toBe(200);
      expect(res.body.selectedTeam).toBeDefined();
      expect(res.body.selectedTeam.id).toBeDefined();
      expect(res.body.selectedTeam.name).toBeDefined();
      expect(res.body.participant).toBeDefined();
      expect(res.body.draft).toBeDefined();
      expect(res.body.draft.spinsCompleted).toBe(1);
    });

    it('advances draft state after each spin', async () => {
      const slug = await createLeagueWith6Participants();

      await request(app)
        .post(`/api/leagues/${slug}/draft/start`);

      // First spin
      const res1 = await request(app)
        .post(`/api/leagues/${slug}/draft/spin`);

      expect(res1.body.draft.spinsCompleted).toBe(1);
      expect(res1.body.draft.currentPickIndex).toBe(1);

      // Second spin
      const res2 = await request(app)
        .post(`/api/leagues/${slug}/draft/spin`);

      expect(res2.body.draft.spinsCompleted).toBe(2);
      expect(res2.body.draft.currentPickIndex).toBe(2);
    });

    it('returns 400 when draft is not in progress', async () => {
      const slug = await createLeagueWith6Participants();

      // Draft not started yet
      const res = await request(app)
        .post(`/api/leagues/${slug}/draft/spin`);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Draft is not in progress');
    });

    it('returns 400 when draft is already completed', async () => {
      const slug = await createLeagueWith6Participants();

      await request(app)
        .post(`/api/leagues/${slug}/draft/start`);

      // Complete all 48 spins
      for (let i = 0; i < 48; i++) {
        await request(app)
          .post(`/api/leagues/${slug}/draft/spin`);
      }

      // Try one more spin
      const res = await request(app)
        .post(`/api/leagues/${slug}/draft/spin`);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Draft is not in progress');
    });

    it('returns 404 for non-existent league', async () => {
      const res = await request(app)
        .post('/api/leagues/nonexistent/draft/spin');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('League not found');
    });

    it('completes draft after 48 spins', async () => {
      const slug = await createLeagueWith6Participants();

      await request(app)
        .post(`/api/leagues/${slug}/draft/start`);

      let lastRes;
      for (let i = 0; i < 48; i++) {
        lastRes = await request(app)
          .post(`/api/leagues/${slug}/draft/spin`);
        expect(lastRes.status).toBe(200);
      }

      expect(lastRes.body.draft.status).toBe('completed');
      expect(lastRes.body.draft.spinsCompleted).toBe(48);

      // Verify state shows completed
      const stateRes = await request(app)
        .get(`/api/leagues/${slug}/draft/state`);

      expect(stateRes.body.status).toBe('completed');
    });
  });
});
