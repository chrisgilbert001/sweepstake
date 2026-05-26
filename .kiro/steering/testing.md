---
inclusion: fileMatch
fileMatchPattern: "**/*.test.*"
---

# Testing Guide

## Framework

- **Vitest** for all tests (unit + integration)
- **Supertest** for HTTP endpoint testing
- **fast-check** available for property-based testing

## Running Tests

```bash
# Single run (CI-friendly)
npm test

# Watch mode (development)
npm run test:watch
```

## Test File Location

Tests are co-located with source files using `.test.js` suffix:
```
server/routes/leagueRoutes.js
server/routes/leagueRoutes.test.js
```

## Writing Server Integration Tests

```js
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import app from '../index.js';

describe('POST /api/leagues', () => {
  it('creates a league and returns 201', async () => {
    const res = await request(app)
      .post('/api/leagues')
      .send({ name: 'Test League' });

    expect(res.status).toBe(201);
    expect(res.body.slug).toBe('test-league');
  });

  it('returns 400 for invalid input', async () => {
    const res = await request(app)
      .post('/api/leagues')
      .send({ name: '' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });
});
```

## Test Data Cleanup

Tests that create league files should clean up in `beforeEach`/`afterEach`:
```js
const PROTECTED_FILES = new Set(['.gitkeep', 'the-lads.json']);

async function cleanLeagues() {
  const files = await readdir(LEAGUES_DIR);
  for (const file of files) {
    if (PROTECTED_FILES.has(file)) continue;
    await rm(path.join(LEAGUES_DIR, file), { recursive: true });
  }
}
```

## Key Testing Patterns

1. **Test the HTTP contract** — status codes, response shapes, error messages
2. **Test edge cases** — empty strings, max lengths, duplicates, missing resources
3. **Don't mock the storage layer** — tests use real file I/O for integration confidence
4. **Protect seed data** — never delete `the-lads.json` or `.gitkeep` in cleanup
5. **Use `NODE_ENV=test`** — prevents the server from starting the listener or sync scheduler
