# Calendfree Phase 3: Notifications — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement email notifications via Gmail API (sending as the assigned consultant), configurable email templates, and pg-boss job queue for scheduled reminders (24h/1h before) and follow-ups (after meeting).

**Architecture:** `EmailService` wraps Gmail API to send emails as the consultant. `TemplateService` renders email templates with variables. `pg-boss` handles job scheduling: booking confirmation is sent immediately, reminders are scheduled at booking creation, follow-ups are scheduled for after meeting end time. All jobs are persistent (survive restarts) and retried on failure.

**Tech Stack:** googleapis (Gmail API v1), pg-boss, handlebars (template rendering)

---

## Chunk 1: Email & Template Services

### Task 1: Install Handlebars

**Files:**
- Modify: `backend/package.json`

- [ ] **Step 1: Install handlebars**

```bash
cd /Users/hziech/calendfree && npm install -w backend handlebars
```

- [ ] **Step 2: Commit + push**

```bash
cd /Users/hziech/calendfree && git add backend/package.json backend/package-lock.json && git commit -m "feat: add handlebars for email template rendering" && git push
```

---

### Task 2: Create EmailService (Gmail API)

**Files:**
- Create: `backend/src/services/email.ts`
- Create: `backend/src/__tests__/email.test.ts`

- [ ] **Step 1: Create EmailService**

```typescript
// backend/src/services/email.ts
import { google } from 'googleapis';
import { getAuthenticatedClient } from './calendar.js';

/**
 * Send an email via Gmail API using the specified user's OAuth tokens.
 * The email appears to come FROM the user (consultant), not from a system address.
 */
export async function sendEmail(params: {
  userId: string;
  to: string;
  subject: string;
  htmlBody: string;
  replyTo?: string;
}): Promise<{ messageId: string }> {
  const auth = await getAuthenticatedClient(params.userId);
  const gmail = google.gmail({ version: 'v1', auth });

  // Build RFC 2822 compliant email
  const messageParts = [
    `To: ${params.to}`,
    `Subject: ${params.subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/html; charset="UTF-8"`,
  ];

  if (params.replyTo) {
    messageParts.push(`Reply-To: ${params.replyTo}`);
  }

  messageParts.push('', params.htmlBody);
  const rawMessage = messageParts.join('\r\n');

  // Base64url encode
  const encoded = Buffer.from(rawMessage)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const response = await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw: encoded },
  });

  return { messageId: response.data.id! };
}
```

- [ ] **Step 2: Write test**

```typescript
// backend/src/__tests__/email.test.ts
import { describe, it, expect } from 'vitest';

describe('EmailService', () => {
  it('exports sendEmail function', async () => {
    const mod = await import('../services/email.js');
    expect(mod.sendEmail).toBeDefined();
  });
});
```

- [ ] **Step 3: Run tests, commit + push**

```bash
cd /Users/hziech/calendfree && npm run test -w backend && git add backend/src/services/email.ts backend/src/__tests__/email.test.ts && git commit -m "feat: add EmailService for sending emails via Gmail API" && git push
```

---

### Task 3: Create TemplateService

**Files:**
- Create: `backend/src/services/templates.ts`
- Create: `backend/src/__tests__/templates.test.ts`

- [ ] **Step 1: Create TemplateService**

```typescript
// backend/src/services/templates.ts
import Handlebars from 'handlebars';

/** Available template variables for all booking-related emails. */
export interface TemplateVars {
  customerName: string;
  consultantName: string;
  consultantEmail: string;
  eventTypeTitle: string;
  dateTime: string;
  duration: number;
  meetLink: string | null;
  cancelUrl: string;
  rescheduleUrl: string;
  companyName: string;
}

const DEFAULT_TEMPLATES = {
  'booking-confirmation': {
    subject: 'Terminbestätigung: {{eventTypeTitle}}',
    body: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Termin bestätigt</h2>
        <p>Hallo {{customerName}},</p>
        <p>Ihr Termin <strong>{{eventTypeTitle}}</strong> mit {{consultantName}} wurde bestätigt.</p>
        <table style="border-collapse: collapse; margin: 16px 0;">
          <tr><td style="padding: 4px 12px 4px 0; color: #666;">Wann:</td><td>{{dateTime}}</td></tr>
          <tr><td style="padding: 4px 12px 4px 0; color: #666;">Dauer:</td><td>{{duration}} Minuten</td></tr>
          {{#if meetLink}}
          <tr><td style="padding: 4px 12px 4px 0; color: #666;">Meeting-Link:</td><td><a href="{{meetLink}}">Google Meet beitreten</a></td></tr>
          {{/if}}
        </table>
        <p>
          <a href="{{rescheduleUrl}}" style="color: #2563EB;">Termin verschieben</a> &nbsp;|&nbsp;
          <a href="{{cancelUrl}}" style="color: #DC2626;">Termin absagen</a>
        </p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
        <p style="color: #999; font-size: 12px;">{{companyName}} — Powered by Calendfree</p>
      </div>
    `,
  },
  'booking-reminder': {
    subject: 'Erinnerung: {{eventTypeTitle}} in {{reminderText}}',
    body: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Terminerinnerung</h2>
        <p>Hallo {{customerName}},</p>
        <p>Ihr Termin <strong>{{eventTypeTitle}}</strong> mit {{consultantName}} beginnt in {{reminderText}}.</p>
        <table style="border-collapse: collapse; margin: 16px 0;">
          <tr><td style="padding: 4px 12px 4px 0; color: #666;">Wann:</td><td>{{dateTime}}</td></tr>
          {{#if meetLink}}
          <tr><td style="padding: 4px 12px 4px 0; color: #666;">Meeting-Link:</td><td><a href="{{meetLink}}">Google Meet beitreten</a></td></tr>
          {{/if}}
        </table>
        <p>
          <a href="{{rescheduleUrl}}" style="color: #2563EB;">Termin verschieben</a> &nbsp;|&nbsp;
          <a href="{{cancelUrl}}" style="color: #DC2626;">Termin absagen</a>
        </p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
        <p style="color: #999; font-size: 12px;">{{companyName}} — Powered by Calendfree</p>
      </div>
    `,
  },
  'booking-cancellation': {
    subject: 'Termin abgesagt: {{eventTypeTitle}}',
    body: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Termin abgesagt</h2>
        <p>Hallo {{customerName}},</p>
        <p>Ihr Termin <strong>{{eventTypeTitle}}</strong> mit {{consultantName}} am {{dateTime}} wurde abgesagt.</p>
        <p>Sie können gerne einen neuen Termin buchen.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
        <p style="color: #999; font-size: 12px;">{{companyName}} — Powered by Calendfree</p>
      </div>
    `,
  },
  'booking-followup': {
    subject: 'Vielen Dank für Ihren Termin: {{eventTypeTitle}}',
    body: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Vielen Dank!</h2>
        <p>Hallo {{customerName}},</p>
        <p>Vielen Dank, dass Sie sich die Zeit für <strong>{{eventTypeTitle}}</strong> mit {{consultantName}} genommen haben.</p>
        <p>Wir freuen uns auf die weitere Zusammenarbeit!</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
        <p style="color: #999; font-size: 12px;">{{companyName}} — Powered by Calendfree</p>
      </div>
    `,
  },
} as const;

export type TemplateName = keyof typeof DEFAULT_TEMPLATES;

/**
 * Render an email template with the given variables.
 * Returns { subject, htmlBody } ready for EmailService.
 */
export function renderTemplate(
  templateName: TemplateName,
  vars: TemplateVars & Record<string, unknown>,
): { subject: string; htmlBody: string } {
  const template = DEFAULT_TEMPLATES[templateName];

  const subjectTemplate = Handlebars.compile(template.subject);
  const bodyTemplate = Handlebars.compile(template.body);

  return {
    subject: subjectTemplate(vars),
    htmlBody: bodyTemplate(vars),
  };
}
```

- [ ] **Step 2: Write template test**

```typescript
// backend/src/__tests__/templates.test.ts
import { describe, it, expect } from 'vitest';
import { renderTemplate } from '../services/templates.js';

describe('TemplateService', () => {
  const baseVars = {
    customerName: 'Max Mustermann',
    consultantName: 'Anna Berater',
    consultantEmail: 'anna@seibert.group',
    eventTypeTitle: '30min Erstgespräch',
    dateTime: '15. März 2026, 10:00 Uhr',
    duration: 30,
    meetLink: 'https://meet.google.com/abc-defg-hij',
    cancelUrl: 'https://calendfree.example.com/manage/token123/cancel',
    rescheduleUrl: 'https://calendfree.example.com/manage/token123/reschedule',
    companyName: 'Seibert Solutions GmbH',
  };

  it('renders booking-confirmation template', () => {
    const result = renderTemplate('booking-confirmation', baseVars);
    expect(result.subject).toContain('30min Erstgespräch');
    expect(result.htmlBody).toContain('Max Mustermann');
    expect(result.htmlBody).toContain('Anna Berater');
    expect(result.htmlBody).toContain('meet.google.com');
    expect(result.htmlBody).toContain('cancel');
    expect(result.htmlBody).toContain('reschedule');
  });

  it('renders booking-reminder template', () => {
    const result = renderTemplate('booking-reminder', {
      ...baseVars,
      reminderText: '1 Stunde',
    });
    expect(result.subject).toContain('1 Stunde');
    expect(result.htmlBody).toContain('Terminerinnerung');
  });

  it('renders booking-cancellation template', () => {
    const result = renderTemplate('booking-cancellation', baseVars);
    expect(result.subject).toContain('abgesagt');
    expect(result.htmlBody).toContain('abgesagt');
  });

  it('renders booking-followup template', () => {
    const result = renderTemplate('booking-followup', baseVars);
    expect(result.subject).toContain('Vielen Dank');
  });

  it('handles null meetLink gracefully', () => {
    const result = renderTemplate('booking-confirmation', {
      ...baseVars,
      meetLink: null,
    });
    expect(result.htmlBody).not.toContain('meet.google.com');
    expect(result.htmlBody).not.toContain('Google Meet beitreten');
  });
});
```

- [ ] **Step 3: Run tests, commit + push**

```bash
cd /Users/hziech/calendfree && npm run test -w backend && git add backend/src/services/templates.ts backend/src/__tests__/templates.test.ts && git commit -m "feat: add TemplateService with booking confirmation, reminder, cancellation, and follow-up templates" && git push
```

---

## Chunk 2: pg-boss Job Queue & Notification Jobs

### Task 4: Set Up pg-boss

**Files:**
- Create: `backend/src/jobs/queue.ts`
- Modify: `backend/src/app.ts`

- [ ] **Step 1: Create job queue manager**

```typescript
// backend/src/jobs/queue.ts
import PgBoss from 'pg-boss';
import { config } from '../config.js';

let boss: PgBoss | null = null;

/** Initialize and start the pg-boss job queue. */
export async function startJobQueue(): Promise<PgBoss> {
  boss = new PgBoss({
    connectionString: config.DATABASE_URL,
    retryLimit: 3,
    retryDelay: 60, // 1 minute
    retryBackoff: true,
    expireInHours: 24,
    archiveCompletedAfterSeconds: 7 * 24 * 60 * 60, // 7 days
  });

  boss.on('error', (err) => {
    console.error('pg-boss error:', err);
  });

  await boss.start();
  return boss;
}

/** Get the pg-boss instance. */
export function getQueue(): PgBoss {
  if (!boss) throw new Error('Job queue not started. Call startJobQueue() first.');
  return boss;
}

/** Stop the job queue gracefully. */
export async function stopJobQueue(): Promise<void> {
  if (boss) {
    await boss.stop({ graceful: true, timeout: 10000 });
    boss = null;
  }
}
```

- [ ] **Step 2: Register pg-boss in app.ts**

Add to `backend/src/app.ts`:
```typescript
import { startJobQueue, stopJobQueue } from './jobs/queue.js';

// After all route registrations:
// Start job queue (only in non-test environments)
if (config.NODE_ENV !== 'test') {
  app.addHook('onReady', async () => {
    await startJobQueue();
    app.log.info('pg-boss job queue started');
  });

  app.addHook('onClose', async () => {
    await stopJobQueue();
  });
}
```

- [ ] **Step 3: Commit + push**

```bash
cd /Users/hziech/calendfree && npm run test -w backend && git add backend/src/jobs/queue.ts backend/src/app.ts && git commit -m "feat: add pg-boss job queue manager with startup and graceful shutdown" && git push
```

---

### Task 5: Create Notification Jobs

**Files:**
- Create: `backend/src/jobs/notification-jobs.ts`
- Create: `backend/src/services/notifications.ts`
- Create: `backend/src/__tests__/notifications.test.ts`

- [ ] **Step 1: Create NotificationService (orchestrator)**

```typescript
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
```

- [ ] **Step 2: Create notification job handlers**

```typescript
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
```

- [ ] **Step 3: Register handlers in app.ts**

Add to the `onReady` hook in `backend/src/app.ts`:
```typescript
import { registerNotificationHandlers } from './jobs/notification-jobs.js';

// Inside the onReady hook, after startJobQueue():
await registerNotificationHandlers();
app.log.info('Notification job handlers registered');
```

- [ ] **Step 4: Integrate with booking routes**

Modify `backend/src/routes/booking.ts` — add after successful booking creation:
```typescript
import { scheduleBookingNotifications, cancelBookingNotifications } from '../jobs/notification-jobs.js';

// After the booking is created (after the calendar event try/catch):
if (config.NODE_ENV !== 'test') {
  try {
    await scheduleBookingNotifications({
      bookingId: booking.id,
      startTime,
      endTime,
    });
  } catch (err) {
    app.log.error(err, 'Failed to schedule notifications');
  }
}

// In the cancel handler, after updating booking status:
if (config.NODE_ENV !== 'test') {
  try {
    await cancelBookingNotifications(booking.id);
  } catch (err) {
    app.log.error(err, 'Failed to send cancellation notification');
  }
}
```

Also add `import { config } from '../config.js';` to booking.ts.

- [ ] **Step 5: Write notification test**

```typescript
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
```

- [ ] **Step 6: Run all tests, commit + push**

```bash
cd /Users/hziech/calendfree && npm run test -w backend && git add backend/src/ && git commit -m "feat: add notification system with Gmail-based emails, templates, and pg-boss job scheduling" && git push
```

---

## Verification Checklist

1. **`npm run test -w backend`** — all tests pass
2. **EmailService** — sends email via Gmail API as the consultant
3. **TemplateService** — renders 4 template types with Handlebars, handles null meetLink
4. **NotificationService** — orchestrates template rendering + email sending for all booking events
5. **pg-boss** — starts on app ready, stops gracefully on close, skipped in test env
6. **Job scheduling** — confirmation (immediate), reminders (24h/1h before), follow-up (30min after)
7. **Cancellation flow** — sends cancellation email, reminders check status before sending
8. **Booking routes** — integrated with notification scheduling
