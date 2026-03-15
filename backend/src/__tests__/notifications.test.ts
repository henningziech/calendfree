// backend/src/__tests__/notifications.test.ts
import { describe, it, expect } from 'vitest';

describe('Notification services', () => {
  it('NotificationService exports all functions', async () => {
    const mod = await import('../services/notifications.js');
    expect(mod.sendBookingConfirmation).toBeDefined();
    expect(mod.sendBookingReminder).toBeDefined();
    expect(mod.sendCancellationEmail).toBeDefined();
    expect(mod.sendFollowUpEmail).toBeDefined();
  });

  it('notification-jobs exports schedulers', async () => {
    const mod = await import('../jobs/notification-jobs.js');
    expect(mod.scheduleBookingNotifications).toBeDefined();
    expect(mod.cancelBookingNotifications).toBeDefined();
    expect(mod.registerNotificationHandlers).toBeDefined();
    expect(mod.JOB_NAMES).toBeDefined();
  });
});
