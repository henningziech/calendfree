import { describe, it, expect } from 'vitest';

describe('HubSpot integration', () => {
  it('exports service functions', async () => {
    const mod = await import('../services/hubspot.js');
    expect(mod.upsertContact).toBeDefined();
    expect(mod.createMeeting).toBeDefined();
  });

  it('exports job functions', async () => {
    const mod = await import('../jobs/hubspot-jobs.js');
    expect(mod.queueHubSpotSync).toBeDefined();
    expect(mod.registerHubSpotHandlers).toBeDefined();
  });
});
