import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { adminAuth } from './adminAuth.js';

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.get('/admin/test', adminAuth, (req, res) => {
    res.json({ success: true });
  });
  return app;
}

describe('adminAuth middleware', () => {
  const originalEnv = process.env.ADMIN_TOKEN;

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.ADMIN_TOKEN = originalEnv;
    } else {
      delete process.env.ADMIN_TOKEN;
    }
  });

  it('returns 401 when ADMIN_TOKEN env var is not set', async () => {
    delete process.env.ADMIN_TOKEN;
    const app = createTestApp();

    const res = await request(app)
      .get('/admin/test');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Unauthorized' });
  });

  it('returns 401 when Authorization header is missing', async () => {
    process.env.ADMIN_TOKEN = 'secret-token';
    const app = createTestApp();

    const res = await request(app)
      .get('/admin/test');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Unauthorized' });
  });

  it('returns 401 when token does not match', async () => {
    process.env.ADMIN_TOKEN = 'secret-token';
    const app = createTestApp();

    const res = await request(app)
      .get('/admin/test')
      .set('Authorization', 'Bearer wrong-token');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Unauthorized' });
  });

  it('allows access with valid Bearer token', async () => {
    process.env.ADMIN_TOKEN = 'secret-token';
    const app = createTestApp();

    const res = await request(app)
      .get('/admin/test')
      .set('Authorization', 'Bearer secret-token');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
  });

  it('allows access with raw token (no Bearer prefix)', async () => {
    process.env.ADMIN_TOKEN = 'secret-token';
    const app = createTestApp();

    const res = await request(app)
      .get('/admin/test')
      .set('Authorization', 'secret-token');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
  });
});
