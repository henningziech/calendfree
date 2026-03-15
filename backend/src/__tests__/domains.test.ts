import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../app.js';
import type { FastifyInstance } from 'fastify';

describe('Custom domains', () => {
  let app: FastifyInstance;
  beforeAll(async () => { app = await buildApp(); });
  afterAll(async () => { await app.close(); });

  it('GET /api/admin/companies/:id/domain requires auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/companies/fake/domain' });
    expect(res.statusCode).toBe(401);
  });
});
