// backend/src/__tests__/tenant-isolation.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../app.js';
import type { FastifyInstance } from 'fastify';

describe('Tenant isolation — cross-org access denied', () => {
  let app: FastifyInstance;
  beforeAll(async () => { app = await buildApp(); });
  afterAll(async () => { await app.close(); });

  it('GET /api/admin/companies/:companyId/users requires auth', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/companies/nonexistent-company-id/users',
    });
    expect(res.statusCode).toBe(401);
  });
});
