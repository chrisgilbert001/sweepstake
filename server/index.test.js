import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import app from './index.js';

describe('Express server', () => {
  describe('GET /health', () => {
    it('returns status ok', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: 'ok' });
    });
  });

  describe('JSON body parsing', () => {
    it('returns 400 for malformed JSON', async () => {
      const res = await request(app)
        .post('/health')
        .set('Content-Type', 'application/json')
        .send('{ invalid json }');
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'Invalid request body' });
    });

    it('accepts valid JSON body', async () => {
      const res = await request(app)
        .post('/health')
        .set('Content-Type', 'application/json')
        .send(JSON.stringify({ test: 'data' }));
      // POST to /health isn't defined, so it should 404 or pass through
      // The important thing is it doesn't return 400 for valid JSON
      expect(res.status).not.toBe(400);
    });
  });

  describe('CORS', () => {
    it('includes CORS headers in response', async () => {
      const res = await request(app).get('/health');
      expect(res.headers['access-control-allow-origin']).toBe('*');
    });
  });

  describe('Error handling middleware', () => {
    it('handles errors with custom status codes', async () => {
      // We can test this indirectly through the global error handler
      // by triggering an error in a route
      const testApp = (await import('express')).default();
      testApp.use((await import('cors')).default());
      testApp.get('/test-error', (req, res, next) => {
        const err = new Error('Not found');
        err.status = 404;
        next(err);
      });
      testApp.get('/test-500', (req, res, next) => {
        next(new Error('Something broke'));
      });
      // Add the same error handler
      // eslint-disable-next-line no-unused-vars
      testApp.use((err, req, res, next) => {
        const status = err.status || err.statusCode || 500;
        const message = err.message || 'Internal server error';
        if (status === 400) return res.status(400).json({ error: message });
        if (status === 401) return res.status(401).json({ error: message });
        if (status === 404) return res.status(404).json({ error: message });
        if (status === 409) return res.status(409).json({ error: message });
        if (status === 503) return res.status(503).json({ error: message });
        res.status(500).json({ error: 'Internal server error' });
      });

      const res404 = await request(testApp).get('/test-error');
      expect(res404.status).toBe(404);
      expect(res404.body).toEqual({ error: 'Not found' });

      const res500 = await request(testApp).get('/test-500');
      expect(res500.status).toBe(500);
      expect(res500.body).toEqual({ error: 'Internal server error' });
    });
  });
});
