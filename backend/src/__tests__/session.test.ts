import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../app.js';
import type { FastifyInstance } from 'fastify';

describe('Session management', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('health check reports redis status', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/health' });
    const body = response.json();
    expect(body.services).toHaveProperty('redis');
    expect(body.services).toHaveProperty('database');
  });
});
