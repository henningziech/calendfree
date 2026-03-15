// backend/src/__tests__/admin-users.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../app.js';
import type { FastifyInstance } from 'fastify';

describe('Admin user and event type routes', () => {
  let app: FastifyInstance;
  beforeAll(async () => { app = await buildApp(); });
  afterAll(async () => { await app.close(); });

  it('GET /api/admin/companies/:id/users requires auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/companies/fake/users' });
    expect(res.statusCode).toBe(401);
  });

  it('GET /api/me requires auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/me' });
    expect(res.statusCode).toBe(401);
  });

  it('POST /api/admin/companies/:id/event-types requires auth', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/admin/companies/fake/event-types', payload: { title: 'T', slug: 'ts' } });
    expect(res.statusCode).toBe(401);
  });
});
