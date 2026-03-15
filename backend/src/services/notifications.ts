// backend/src/services/notifications.ts
import { prisma } from '../db.js';
import { sendEmail } from './email.js';
import { renderTemplate, type TemplateVars } from './templates.js';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { de } from 'date-fns/locale';
import { config } from '../config.js';

/** Build template variables from a booking ID. */
async function getTemplateVars(bookingId: string): Promise<TemplateVars & { customerEmail: string }> {
  const booking = await prisma.booking.findUniqueOrThrow({
    where: { id: bookingId },
    include: {
      assignedUser: true,
      eventType: { include: { company: true } },
      formData: true,
    },
  });

  const customerTz = booking.customerTimezone;
  const zonedStart = toZonedTime(booking.startTime, customerTz);

  return {
    customerName: booking.formData?.name ?? 'Kunde',
    customerEmail: booking.formData?.email ?? '',
    consultantName: booking.assignedUser.name,
    consultantEmail: booking.assignedUser.email,
    eventTypeTitle: booking.eventType.title,
    dateTime: format(zonedStart, "d. MMMM yyyy, HH:mm 'Uhr'", { locale: de }),
    duration: booking.eventType.duration,
    meetLink: booking.calendarEventId ? null : null, // Meet link would need to be stored on booking
    cancelUrl: `${config.FRONTEND_URL}/manage/${booking.bookingToken}/cancel`,
    rescheduleUrl: `${config.FRONTEND_URL}/manage/${booking.bookingToken}/reschedule`,
    companyName: booking.eventType.company?.name ?? 'Calendfree',
  };
}

/** Send booking confirmation email to customer. */
export async function sendBookingConfirmation(bookingId: string): Promise<void> {
  const vars = await getTemplateVars(bookingId);
  const { subject, htmlBody } = renderTemplate('booking-confirmation', vars);

  const booking = await prisma.booking.findUniqueOrThrow({
    where: { id: bookingId },
  });

  await sendEmail({
    userId: booking.assignedUserId,
    to: vars.customerEmail,
    subject,
    htmlBody,
  });
}

/** Send booking reminder email to customer. */
export async function sendBookingReminder(bookingId: string, reminderText: string): Promise<void> {
  const booking = await prisma.booking.findUniqueOrThrow({
    where: { id: bookingId },
  });

  // Don't send reminders for cancelled bookings
  if (booking.status === 'CANCELLED' || booking.status === 'RESCHEDULED') return;

  const vars = await getTemplateVars(bookingId);
  const { subject, htmlBody } = renderTemplate('booking-reminder', { ...vars, reminderText });

  await sendEmail({
    userId: booking.assignedUserId,
    to: vars.customerEmail,
    subject,
    htmlBody,
  });
}

/** Send cancellation notification to customer. */
export async function sendCancellationEmail(bookingId: string): Promise<void> {
  const vars = await getTemplateVars(bookingId);
  const { subject, htmlBody } = renderTemplate('booking-cancellation', vars);

  const booking = await prisma.booking.findUniqueOrThrow({
    where: { id: bookingId },
  });

  await sendEmail({
    userId: booking.assignedUserId,
    to: vars.customerEmail,
    subject,
    htmlBody,
  });
}

/** Send follow-up email after meeting. */
export async function sendFollowUpEmail(bookingId: string): Promise<void> {
  const booking = await prisma.booking.findUniqueOrThrow({
    where: { id: bookingId },
  });

  // Only send follow-ups for completed/confirmed bookings
  if (booking.status === 'CANCELLED' || booking.status === 'RESCHEDULED') return;

  const vars = await getTemplateVars(bookingId);
  const { subject, htmlBody } = renderTemplate('booking-followup', vars);

  await sendEmail({
    userId: booking.assignedUserId,
    to: vars.customerEmail,
    subject,
    htmlBody,
  });
}
