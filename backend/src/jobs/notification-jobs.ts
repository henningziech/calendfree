// backend/src/jobs/notification-jobs.ts
import { getQueue } from './queue.js';
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

/** Register all notification job handlers with pg-boss. */
export async function registerNotificationHandlers(): Promise<void> {
  const queue = getQueue();

  await queue.work(JOB_NAMES.BOOKING_CONFIRMATION, async (job) => {
    await sendBookingConfirmation(job.data.bookingId);
  });

  await queue.work(JOB_NAMES.BOOKING_REMINDER_24H, async (job) => {
    await sendBookingReminder(job.data.bookingId, '24 Stunden');
  });

  await queue.work(JOB_NAMES.BOOKING_REMINDER_1H, async (job) => {
    await sendBookingReminder(job.data.bookingId, '1 Stunde');
  });

  await queue.work(JOB_NAMES.BOOKING_CANCELLATION, async (job) => {
    await sendCancellationEmail(job.data.bookingId);
  });

  await queue.work(JOB_NAMES.BOOKING_FOLLOWUP, async (job) => {
    await sendFollowUpEmail(job.data.bookingId);
  });
}

/** Schedule all notification jobs for a new booking. */
export async function scheduleBookingNotifications(params: {
  bookingId: string;
  startTime: Date;
  endTime: Date;
}): Promise<void> {
  const queue = getQueue();
  const { bookingId, startTime, endTime } = params;

  // Immediate: confirmation email
  await queue.send(JOB_NAMES.BOOKING_CONFIRMATION, { bookingId });

  // 24h before: reminder (only if booking is >24h away)
  const reminder24h = new Date(startTime.getTime() - 24 * 60 * 60 * 1000);
  if (reminder24h > new Date()) {
    await queue.send(JOB_NAMES.BOOKING_REMINDER_24H, { bookingId }, {
      startAfter: reminder24h,
    });
  }

  // 1h before: reminder (only if booking is >1h away)
  const reminder1h = new Date(startTime.getTime() - 60 * 60 * 1000);
  if (reminder1h > new Date()) {
    await queue.send(JOB_NAMES.BOOKING_REMINDER_1H, { bookingId }, {
      startAfter: reminder1h,
    });
  }

  // After meeting: follow-up (30 min after end)
  const followUp = new Date(endTime.getTime() + 30 * 60 * 1000);
  await queue.send(JOB_NAMES.BOOKING_FOLLOWUP, { bookingId }, {
    startAfter: followUp,
  });
}

/** Cancel pending notification jobs for a booking (e.g., when cancelled). */
export async function cancelBookingNotifications(bookingId: string): Promise<void> {
  const queue = getQueue();
  // pg-boss doesn't have a direct "cancel by data" API,
  // but reminders/follow-ups check booking status before sending
  // So cancelled bookings will be skipped automatically.
  // For the cancellation notification, send it now:
  await queue.send(JOB_NAMES.BOOKING_CANCELLATION, { bookingId });
}
