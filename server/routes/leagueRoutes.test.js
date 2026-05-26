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

const PROTECTED_FILES = new Set(['.gitkeep', 'the-lads.json']);

async function cleanLeagues() {
  try {
    const files = await readdir(LEAGUES_DIR);
    for (const file of files) {
      if (PROTECTED_FILES.has(file)) continue;
      await rm(path.join(LEAGUES_DIR, file), { recursive: true });
    }
  } catch (e) { /* ignore */ }
}

describe('League API Routes', () => {
  beforeEach(async () => {
    if (!existsSync(LEAGUES_DIR)) {
      await mkdir(LEAGUES_DIR, { recursive: true });
    }
    await cleanLeagues();
  });

  afterEach(async () => {
    await cleanLeagues();
  });

  describe('POST /api/leagues', () => {
    it('creates a league and returns 201', async () => {
      const res = await request(app)
        .post('/api/leagues')
        .send({ name: 'Office Legends' });

      expect(res.status).toBe(201);
      expect(res.body.slug).toBe('office-legends');
      expect(res.body.name).toBe('Office Legends');
      expect(res.body.joinCode).toMatch(/^[a-z0-9]{6}$/);
      expect(res.body.participants).toEqual([]);
      expect(res.body.draft.status).toBe('not_started');
    });

    it('returns 400 for invalid name (empty)', async () => {
      const res = await request(app)
        .post('/api/leagues')
        .send({ name: '' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it('returns 400 for invalid name (whitespace only)', async () => {
      const res = await request(app)
        .post('/api/leagues')
        .send({ name: '   ' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it('returns 400 for name exceeding 50 characters', async () => {
      const res = await request(app)
        .post('/api/leagues')
        .send({ name: 'a'.repeat(51) });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it('returns 409 for duplicate league name', async () => {
      await request(app)
        .post('/api/leagues')
        .send({ name: 'Office Legends' });

      const res = await request(app)
        .post('/api/leagues')
        .send({ name: 'Office Legends' });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('League name already taken');
    });
  });

  describe('GET /api/leagues/:slug', () => {
    it('returns league details', async () => {
      await request(app)
        .post('/api/leagues')
        .send({ name: 'Test League' });

      const res = await request(app)
        .get('/api/leagues/test-league');

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Test League');
      expect(res.body.slug).toBe('test-league');
    });

    it('returns 404 for non-existent league', async () => {
      const res = await request(app)
        .get('/api/leagues/nonexistent');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('League not found');
    });
  });

  describe('POST /api/leagues/:slug/participants', () => {
    beforeEach(async () => {
      await request(app)
        .post('/api/leagues')
        .send({ name: 'Participant League' });
    });

    it('adds a participant and returns 201', async () => {
      const res = await request(app)
        .post('/api/leagues/participant-league/participants')
        .send({ name: 'Alice', email: 'alice@example.com' });

      expect(res.status).toBe(201);
      expect(res.body.participants).toHaveLength(1);
      expect(res.body.participants[0]).toEqual({ id: 'p1', name: 'Alice', email: 'alice@example.com' });
    });

    it('returns 400 for invalid participant name', async () => {
      const res = await request(app)
        .post('/api/leagues/participant-league/participants')
        .send({ name: '', email: 'a@b.com' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it('returns 400 for missing email', async () => {
      const res = await request(app)
        .post('/api/leagues/participant-league/participants')
        .send({ name: 'Alice' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it('returns 400 for invalid email', async () => {
      const res = await request(app)
        .post('/api/leagues/participant-league/participants')
        .send({ name: 'Alice', email: 'notanemail' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it('returns 409 for duplicate participant name', async () => {
      await request(app)
        .post('/api/leagues/participant-league/participants')
        .send({ name: 'Alice', email: 'alice@example.com' });

      const res = await request(app)
        .post('/api/leagues/participant-league/participants')
        .send({ name: 'Alice', email: 'different@example.com' });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('Participant name already used in this league');
    });

    it('returns 400 when league already has 6 participants', async () => {
      for (let i = 1; i <= 6; i++) {
        await request(app)
          .post('/api/leagues/participant-league/participants')
          .send({ name: `Player ${i}`, email: `p${i}@example.com` });
      }

      const res = await request(app)
        .post('/api/leagues/participant-league/participants')
        .send({ name: 'Player 7', email: 'p7@example.com' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('League already has maximum 6 participants');
    });
  });

  describe('GET /api/leagues/join/:joinCode', () => {
    it('returns league info via join code', async () => {
      const createRes = await request(app)
        .post('/api/leagues')
        .send({ name: 'Join League' });

      const joinCode = createRes.body.joinCode;

      const res = await request(app)
        .get(`/api/leagues/join/${joinCode}`);

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Join League');
      expect(res.body.joinCode).toBe(joinCode);
    });

    it('returns 404 for invalid join code', async () => {
      const res = await request(app)
        .get('/api/leagues/join/zzzzzz');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('League not found');
    });
  });

  describe('POST /api/leagues/join/:joinCode', () => {
    let joinCode;

    beforeEach(async () => {
      const createRes = await request(app)
        .post('/api/leagues')
        .send({ name: 'Joinable League' });
      joinCode = createRes.body.joinCode;
    });

    it('adds a participant via join code and returns 201', async () => {
      const res = await request(app)
        .post(`/api/leagues/join/${joinCode}`)
        .send({ name: 'Charlie', email: 'charlie@example.com' });

      expect(res.status).toBe(201);
      expect(res.body.participants).toHaveLength(1);
      expect(res.body.participants[0].name).toBe('Charlie');
      expect(res.body.participants[0].email).toBe('charlie@example.com');
    });

    it('returns 404 for invalid join code', async () => {
      const res = await request(app)
        .post('/api/leagues/join/zzzzzz')
        .send({ name: 'Charlie', email: 'charlie@example.com' });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('League not found');
    });

    it('returns 400 for invalid participant name', async () => {
      const res = await request(app)
        .post(`/api/leagues/join/${joinCode}`)
        .send({ name: '', email: 'charlie@example.com' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it('returns 400 for missing email', async () => {
      const res = await request(app)
        .post(`/api/leagues/join/${joinCode}`)
        .send({ name: 'Charlie' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it('returns 409 for duplicate participant name via join', async () => {
      await request(app)
        .post(`/api/leagues/join/${joinCode}`)
        .send({ name: 'Charlie', email: 'charlie@example.com' });

      const res = await request(app)
        .post(`/api/leagues/join/${joinCode}`)
        .send({ name: 'Charlie', email: 'other@example.com' });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('Participant name already used in this league');
    });

    it('returns 400 when league is full via join', async () => {
      for (let i = 1; i <= 6; i++) {
        await request(app)
          .post(`/api/leagues/join/${joinCode}`)
          .send({ name: `Player ${i}`, email: `p${i}@example.com` });
      }

      const res = await request(app)
        .post(`/api/leagues/join/${joinCode}`)
        .send({ name: 'Player 7', email: 'p7@example.com' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('League already has maximum 6 participants');
    });
  });

  describe('GET /api/me/:email/leagues', () => {
    it('returns leagues for a participant email', async () => {
      await request(app).post('/api/leagues').send({ name: 'League One' });
      await request(app).post('/api/leagues').send({ name: 'League Two' });

      await request(app)
        .post('/api/leagues/league-one/participants')
        .send({ name: 'Alice', email: 'alice@example.com' });
      await request(app)
        .post('/api/leagues/league-two/participants')
        .send({ name: 'Ally', email: 'alice@example.com' });

      const res = await request(app)
        .get('/api/me/alice@example.com/leagues');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body.map(l => l.slug).sort()).toEqual(['league-one', 'league-two']);
    });

    it('returns empty array for unknown email', async () => {
      const res = await request(app)
        .get('/api/me/nobody@example.com/leagues');

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('returns 400 for invalid email', async () => {
      const res = await request(app)
        .get('/api/me/notanemail/leagues');

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });
  });

  describe('GET /api/leagues/:slug/points-history', () => {
    it('returns points history for an existing league', async () => {
      await request(app)
        .post('/api/leagues')
        .send({ name: 'Points League' });

      const res = await request(app)
        .get('/api/leagues/points-league/points-history');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('returns 404 for non-existent league', async () => {
      const res = await request(app)
        .get('/api/leagues/nonexistent/points-history');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('League not found');
    });
  });
});
