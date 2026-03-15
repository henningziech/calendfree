// backend/src/__tests__/email.test.ts
import { describe, it, expect } from 'vitest';

describe('EmailService', () => {
  it('exports sendEmail function', async () => {
    const mod = await import('../services/email.js');
    expect(mod.sendEmail).toBeDefined();
  });
});
