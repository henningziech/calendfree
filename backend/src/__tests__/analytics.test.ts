import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../app.js';
import type { FastifyInstance } from 'fastify';

describe('Analytics', () => {
  let app: FastifyInstance;
  beforeAll(async () => { app = await buildApp(); });
  afterAll(async () => { await app.close(); });

  it('GET /api/admin/analytics/overview requires auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/analytics/overview' });
    expect(res.statusCode).toBe(401);
  });
});
