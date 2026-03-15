// backend/src/__tests__/availability.test.ts
import { describe, it, expect } from 'vitest';

describe('AvailabilityService', () => {
  it('module exports getAvailableSlots', async () => {
    const mod = await import('../services/availability.js');
    expect(mod.getAvailableSlots).toBeDefined();
  });
});
