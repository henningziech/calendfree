// backend/src/__tests__/round-robin.test.ts
import { describe, it, expect } from 'vitest';

describe('RoundRobinService', () => {
  it('module exports assignUser', async () => {
    const mod = await import('../services/round-robin.js');
    expect(mod.assignUser).toBeDefined();
  });
});
