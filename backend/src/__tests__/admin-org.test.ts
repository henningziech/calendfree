// backend/src/__tests__/admin-org.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../app.js';
import type { FastifyInstance } from 'fastify';

describe('Admin organization routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => { app = await buildApp(); });
  afterAll(async () => { await app.close(); });

  it('GET /api/admin/org requires auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/org' });
    expect(res.statusCode).toBe(401);
  });

  it('GET /api/admin/companies requires auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/companies' });
    expect(res.statusCode).toBe(401);
  });

  it('POST /api/admin/companies requires auth', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/companies',
      payload: { name: 'Test', slug: 'test' },
    });
    expect(res.statusCode).toBe(401);
  });
});
