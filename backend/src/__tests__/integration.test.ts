// backend/src/__tests__/integration.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../app.js';
import type { FastifyInstance } from 'fastify';

describe('Phase 1 Integration', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('health check reports all services ok', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe('ok');
    expect(body.services.database).toBe(true);
    expect(body.services.redis).toBe(true);
  });

  it('swagger docs are accessible', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/docs/json' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.openapi).toBeDefined();
    expect(body.info.title).toBe('Calendfree API');
  });

  it('unauthenticated /api/auth/me returns 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/auth/me' });
    expect(res.statusCode).toBe(401);
  });

  it('oauth redirect points to Google', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/auth/google' });
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toContain('accounts.google.com');
    expect(res.headers.location).toContain('calendar');
    expect(res.headers.location).toContain('gmail');
  });
});
