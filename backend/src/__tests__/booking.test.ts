// backend/src/__tests__/booking.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../app.js';
import type { FastifyInstance } from 'fastify';

describe('Booking routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/booking/:company/:event/slots returns 404 for unknown company', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/booking/nonexistent/test/slots',
    });
    expect(res.statusCode).toBe(404);
  });

  it('POST /api/booking/:company/:event returns 404 for unknown company', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/booking/nonexistent/test',
      payload: {
        startTime: new Date().toISOString(),
        name: 'Test User',
        email: 'test@example.com',
      },
    });
    expect(res.statusCode).toBe(404);
  });

  it('POST /api/booking/:token/cancel returns 404 for unknown token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/booking/nonexistent-token/cancel',
    });
    expect(res.statusCode).toBe(404);
  });
});
