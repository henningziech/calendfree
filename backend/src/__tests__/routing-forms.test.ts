import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../app.js';
import type { FastifyInstance } from 'fastify';

describe('Routing forms', () => {
  let app: FastifyInstance;
  beforeAll(async () => { app = await buildApp(); });
  afterAll(async () => { await app.close(); });

  it('GET /api/routing/:company/:form returns 404 for unknown', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/routing/nonexistent/test' });
    expect(res.statusCode).toBe(404);
  });

  it('POST /api/admin/companies/:id/routing-forms requires auth', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/admin/companies/fake/routing-forms', payload: { title: 'T', slug: 's' } });
    expect(res.statusCode).toBe(401);
  });
});
