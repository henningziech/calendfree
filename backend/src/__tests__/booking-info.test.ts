import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../app.js';
import type { FastifyInstance } from 'fastify';

describe('Booking info endpoints', () => {
  let app: FastifyInstance;
  beforeAll(async () => { app = await buildApp(); });
  afterAll(async () => { await app.close(); });

  it('GET /api/booking/:company/info returns company data for seeded company', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/booking/seibert-group-gmbh/info' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.name).toBe('Seibert Group GmbH');
    expect(body.slug).toBe('seibert-group-gmbh');
  });

  it('GET /api/booking/:company/info returns 404 for unknown', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/booking/nonexistent/info' });
    expect(res.statusCode).toBe(404);
  });
});
