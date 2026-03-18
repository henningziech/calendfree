// backend/src/jobs/notification-jobs.ts
import { getQueue } from './queue.js';
import { prisma } from '../db.js';
import {
  sendBookingConfirmation,
  sendBookingReminder,
  sendCancellationEmail,
  sendFollowUpEmail,
} from '../services/notifications.js';

export const JOB_NAMES = {
  BOOKING_CONFIRMATION: 'booking-confirmation',
  BOOKING_REMINDER_24H: 'booking-reminder-24h',
  BOOKING_REMINDER_1H: 'booking-reminder-1h',
  BOOKING_CANCELLATION: 'booking-cancellation',
  BOOKING_FOLLOWUP: 'booking-followup',
} as const;

const TIMING_MS: Record<string, number> = {
  '15min': 15 * 60 * 1000,
  '30min': 30 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '2h': 2 * 60 * 60 * 1000,
  '4h': 4 * 60 * 60 * 1000,
  '6h': 6 * 60 * 60 * 1000,
  '12h': 12 * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '48h': 48 * 60 * 60 * 1000,
};

/** Register all notification job handlers with pg-boss. */
export async function registerNotificationHandlers(): Promise<void> {
  const queue = getQueue();

  await queue.work(JOB_NAMES.BOOKING_CONFIRMATION, async (job) => {
    await sendBookingConfirmation(job.data.bookingId);
  });

  await queue.work(JOB_NAMES.BOOKING_REMINDER_24H, async (job) => {
    await sendBookingReminder(job.data.bookingId, job.data.reminderText ?? '24h');
  });

  await queue.work(JOB_NAMES.BOOKING_REMINDER_1H, async (job) => {
    await sendBookingReminder(job.data.bookingId, job.data.reminderText ?? '1h');
  });

  await queue.work(JOB_NAMES.BOOKING_CANCELLATION, async (job) => {
    await sendCancellationEmail(job.data.bookingId);
  });

  await queue.work(JOB_NAMES.BOOKING_FOLLOWUP, async (job) => {
    await sendFollowUpEmail(job.data.bookingId);
  });
}

/** Schedule all notification jobs for a new booking, based on NotificationConfig. */
export async function scheduleBookingNotifications(params: {
  bookingId: string;
  eventTypeId: string;
  startTime: Date;
  endTime: Date;
}): Promise<void> {
  const queue = getQueue();
  const { bookingId, eventTypeId, startTime, endTime } = params;

  const config = await prisma.notificationConfig.findUnique({
    where: { eventTypeId },
  });

  // No config = all notifications off (default)
  if (!config) return;

  if (config.confirmationEnabled) {
    await queue.send(JOB_NAMES.BOOKING_CONFIRMATION, { bookingId });
  }

  if (config.reminder1Enabled) {
    const ms = TIMING_MS[config.reminder1Timing] ?? TIMING_MS['24h'];
    const reminderTime = new Date(startTime.getTime() - ms);
    if (reminderTime > new Date()) {
      await queue.send(JOB_NAMES.BOOKING_REMINDER_24H, {
        bookingId, reminderText: config.reminder1Timing,
      }, { startAfter: reminderTime });
    }
  }

  if (config.reminder2Enabled) {
    const ms = TIMING_MS[config.reminder2Timing] ?? TIMING_MS['1h'];
    const reminderTime = new Date(startTime.getTime() - ms);
    if (reminderTime > new Date()) {
      await queue.send(JOB_NAMES.BOOKING_REMINDER_1H, {
        bookingId, reminderText: config.reminder2Timing,
      }, { startAfter: reminderTime });
    }
  }

  if (config.followUpEnabled) {
    const ms = TIMING_MS[config.followUpTiming] ?? TIMING_MS['30min'];
    const followUpTime = new Date(endTime.getTime() + ms);
    await queue.send(JOB_NAMES.BOOKING_FOLLOWUP, { bookingId }, {
      startAfter: followUpTime,
    });
  }
}

/** Cancel pending notification jobs for a booking (e.g., when cancelled). */
export async function cancelBookingNotifications(bookingId: string): Promise<void> {
  const queue = getQueue();

  const booking = await prisma.booking.findUniqueOrThrow({
    where: { id: bookingId },
    select: { eventTypeId: true },
  });

  const config = await prisma.notificationConfig.findUnique({
    where: { eventTypeId: booking.eventTypeId },
  });

  if (config?.cancellationEnabled) {
    await queue.send(JOB_NAMES.BOOKING_CANCELLATION, { bookingId });
  }
}
