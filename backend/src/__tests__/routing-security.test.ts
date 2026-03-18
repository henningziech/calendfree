// backend/src/__tests__/routing-security.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../app.js';
import type { FastifyInstance } from 'fastify';

describe('Routing form security', () => {
  let app: FastifyInstance;
  beforeAll(async () => { app = await buildApp(); });
  afterAll(async () => { await app.close(); });

  it('POST /api/routing resolve returns 404 for nonexistent company', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/routing/nonexistent/nonexistent/resolve',
      payload: { optionId: '00000000-0000-0000-0000-000000000000' },
    });
    expect(res.statusCode).toBe(404);
  });
});
