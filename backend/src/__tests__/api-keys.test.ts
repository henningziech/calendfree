// backend/src/__tests__/api-keys.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../app.js';
import type { FastifyInstance } from 'fastify';

describe('API Key routes', () => {
  let app: FastifyInstance;
  beforeAll(async () => { app = await buildApp(); });
  afterAll(async () => { await app.close(); });

  it('GET /api/me/api-keys requires auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/me/api-keys' });
    expect(res.statusCode).toBe(401);
  });

  it('invalid API key returns 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/me/api-keys',
      headers: { authorization: 'Bearer cf_live_invalid_key_here' },
    });
    expect(res.statusCode).toBe(401);
  });
});
