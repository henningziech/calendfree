import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../app.js';
import type { FastifyInstance } from 'fastify';

describe('Auth routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/auth/google redirects to Google', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/auth/google',
    });
    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toContain('accounts.google.com');
  });

  it('GET /api/auth/me returns 401 when not authenticated', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
    });
    expect(response.statusCode).toBe(401);
  });
});
