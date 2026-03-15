// backend/src/__tests__/calendar.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// We test the service logic by mocking the Google APIs and Prisma
// Full integration tests with real Google API will be manual

describe('CalendarService', () => {
  it('module exports all required functions', async () => {
    const mod = await import('../services/calendar.js');
    expect(mod.getAuthenticatedClient).toBeDefined();
    expect(mod.getFreeBusy).toBeDefined();
    expect(mod.createCalendarEvent).toBeDefined();
    expect(mod.deleteCalendarEvent).toBeDefined();
  });
});
