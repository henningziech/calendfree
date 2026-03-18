// backend/src/services/notifications.ts
import { prisma } from '../db.js';
import { sendEmail } from './email.js';
import { renderNotificationEmail, type TemplateVars } from './templates.js';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { de, enUS } from 'date-fns/locale';
import { config } from '../config.js';

/** Return a human-readable timing label for reminder codes, localized by language. */
function getTimingLabel(code: string, language: string): string {
  const labels: Record<string, Record<string, string>> = {
    de: { '15min': '15 Minuten', '30min': '30 Minuten', '1h': '1 Stunde', '2h': '2 Stunden', '4h': '4 Stunden', '6h': '6 Stunden', '12h': '12 Stunden', '24h': '24 Stunden', '48h': '48 Stunden' },
    en: { '15min': '15 minutes', '30min': '30 minutes', '1h': '1 hour', '2h': '2 hours', '4h': '4 hours', '6h': '6 hours', '12h': '12 hours', '24h': '24 hours', '48h': '48 hours' },
  };
  return labels[language]?.[code] ?? labels['de']?.[code] ?? code;
}

/** Build template variables and context from a booking ID. */
async function getTemplateVars(bookingId: string) {
  const booking = await prisma.booking.findUniqueOrThrow({
    where: { id: bookingId },
    include: {
      assignedUser: true,
      eventType: { include: { company: { include: { branding: true } }, notificationConfig: true } },
      formData: true,
    },
  });

  const language = booking.eventType.company?.language ?? 'de';
  const locale = language === 'en' ? enUS : de;
  const dateFormat = language === 'en' ? "MMMM d, yyyy, h:mm a" : "d. MMMM yyyy, HH:mm 'Uhr'";
  const customerTz = booking.customerTimezone;
  const zonedStart = toZonedTime(booking.startTime, customerTz);

  return {
    vars: {
      customerName: booking.formData?.name ?? 'Kunde',
      customerEmail: booking.formData?.email ?? '',
      consultantName: booking.assignedUser.name,
      consultantEmail: booking.assignedUser.email,
      eventTypeTitle: booking.eventType.title,
      dateTime: format(zonedStart, dateFormat, { locale }),
      duration: booking.eventType.duration,
      meetLink: booking.meetLink ?? null,
      cancelUrl: `${config.FRONTEND_URL}/manage/${booking.bookingToken}/cancel`,
      rescheduleUrl: `${config.FRONTEND_URL}/manage/${booking.bookingToken}/reschedule`,
      companyName: booking.eventType.company?.name ?? 'Calendfree',
    },
    assignedUserId: booking.assignedUserId,
    notificationConfig: booking.eventType.notificationConfig,
    language,
    branding: booking.eventType.company?.branding
      ? { logoUrl: booking.eventType.company.branding.logoUrl, primaryColor: booking.eventType.company.branding.primaryColor, companyName: booking.eventType.company?.name }
      : undefined,
  };
}

/** Send booking confirmation email to customer. */
export async function sendBookingConfirmation(bookingId: string): Promise<void> {
  const { vars, assignedUserId, notificationConfig, language, branding } = await getTemplateVars(bookingId);

  const { subject, htmlBody } = renderNotificationEmail({
    type: 'booking-confirmation',
    customSubject: notificationConfig?.confirmationSubject ?? null,
    customBody: notificationConfig?.confirmationBody ?? null,
    vars,
    branding,
    language,
  });

  await sendEmail({ userId: assignedUserId, to: vars.customerEmail, subject, htmlBody });
}

/** Send booking reminder email to customer. */
export async function sendBookingReminder(bookingId: string, timingCode: string): Promise<void> {
  const booking = await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });
  if (booking.status === 'CANCELLED' || booking.status === 'RESCHEDULED') return;

  const { vars, assignedUserId, notificationConfig, language, branding } = await getTemplateVars(bookingId);
  const reminderText = getTimingLabel(timingCode, language);

  const { subject, htmlBody } = renderNotificationEmail({
    type: 'booking-reminder',
    customSubject: notificationConfig?.reminder1Subject ?? null,
    customBody: notificationConfig?.reminder1Body ?? null,
    vars: { ...vars, reminderText },
    branding,
    language,
  });

  await sendEmail({ userId: assignedUserId, to: vars.customerEmail, subject, htmlBody });
}

/** Send cancellation notification to customer. */
export async function sendCancellationEmail(bookingId: string): Promise<void> {
  const { vars, assignedUserId, notificationConfig, language, branding } = await getTemplateVars(bookingId);

  const { subject, htmlBody } = renderNotificationEmail({
    type: 'booking-cancellation',
    customSubject: notificationConfig?.cancellationSubject ?? null,
    customBody: notificationConfig?.cancellationBody ?? null,
    vars,
    branding,
    language,
  });

  await sendEmail({ userId: assignedUserId, to: vars.customerEmail, subject, htmlBody });
}

/** Send follow-up email after meeting. */
export async function sendFollowUpEmail(bookingId: string): Promise<void> {
  const booking = await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });
  if (booking.status === 'CANCELLED' || booking.status === 'RESCHEDULED') return;

  const { vars, assignedUserId, notificationConfig, language, branding } = await getTemplateVars(bookingId);

  const { subject, htmlBody } = renderNotificationEmail({
    type: 'booking-followup',
    customSubject: notificationConfig?.followUpSubject ?? null,
    customBody: notificationConfig?.followUpBody ?? null,
    vars,
    branding,
    language,
  });

  await sendEmail({ userId: assignedUserId, to: vars.customerEmail, subject, htmlBody });
}
