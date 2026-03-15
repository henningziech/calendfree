// backend/src/__tests__/admin-teams.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../app.js';
import type { FastifyInstance } from 'fastify';

describe('Admin team routes', () => {
  let app: FastifyInstance;
  beforeAll(async () => { app = await buildApp(); });
  afterAll(async () => { await app.close(); });

  it('POST /api/admin/companies/:id/teams requires auth', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/admin/companies/fake-id/teams', payload: { name: 'Test' } });
    expect(res.statusCode).toBe(401);
  });

  it('GET /api/admin/teams/:id requires auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/teams/fake-id' });
    expect(res.statusCode).toBe(401);
  });
});
