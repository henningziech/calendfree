// backend/src/__tests__/middleware.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../app.js';
import type { FastifyInstance } from 'fastify';
import { requireAuth, requireRole } from '../middleware/auth.js';

describe('Auth middleware', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();

    // Register a test route that requires auth
    app.get('/test/protected', { preHandler: [requireAuth] }, async (req) => {
      return { user: req.session.user };
    });

    // Register a test route that requires COMPANY_ADMIN
    app.get('/test/admin', {
      preHandler: [requireRole('COMPANY_ADMIN', 'ORG_ADMIN')],
    }, async (req) => {
      return { role: req.session.user?.activeRole };
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('requireAuth returns 401 for unauthenticated requests', async () => {
    const response = await app.inject({ method: 'GET', url: '/test/protected' });
    expect(response.statusCode).toBe(401);
  });

  it('requireRole returns 401 for unauthenticated requests', async () => {
    const response = await app.inject({ method: 'GET', url: '/test/admin' });
    expect(response.statusCode).toBe(401);
  });
});
