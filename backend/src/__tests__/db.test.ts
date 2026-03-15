import { describe, it, expect, afterAll } from 'vitest';
import { prisma } from '../db.js';

describe('Database connection', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('connects to PostgreSQL', async () => {
    const result = await prisma.$queryRaw<[{ now: Date }]>`SELECT NOW()`;
    expect(result[0].now).toBeInstanceOf(Date);
  });
});
