# Event Type Notification System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-EventType notification configuration with editable templates, configurable timing, and a frontend UI. Notifications default to OFF and must be explicitly enabled per EventType.

**Architecture:** New `NotificationConfig` model (1:1 on EventType) stores toggles, timing, and custom template overrides. The existing notification service reads the config before scheduling/sending. A new `meetLink` field on Booking persists the Google Meet link. Frontend gets a notification settings panel as a modal/drawer from the EventType list page.

**Tech Stack:** Prisma, Fastify, Zod, Handlebars, React, Tailwind CSS, react-i18next

**Spec:** `docs/superpowers/specs/2026-03-18-event-type-notifications-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `backend/prisma/schema.prisma` | Modify | Add NotificationConfig model, meetLink on Booking, relation on EventType |
| `shared/src/schemas/admin.ts` | Modify | Add Zod schemas for notification config |
| `backend/src/routes/admin/notifications.ts` | Create | GET/PUT/POST notification config endpoints |
| `backend/src/services/templates.ts` | Modify | Add EN templates, branding wrapper, custom template support |
| `backend/src/services/notifications.ts` | Modify | Fix meetLink, language-aware date formatting |
| `backend/src/jobs/notification-jobs.ts` | Modify | Config-aware scheduling with custom timing |
| `backend/src/routes/booking.ts` | Modify | Persist meetLink, pass eventTypeId to scheduling |
| `backend/src/routes/admin/users.ts` | — | No change needed (cancelBookingNotifications resolves eventTypeId internally) |
| `backend/src/app.ts` | Modify | Register new notification routes |
| `frontend/src/api/admin.ts` | Modify | Add notification API functions |
| `frontend/src/components/notifications/NotificationConfigPanel.tsx` | Create | Notification settings panel component |
| `frontend/src/components/notifications/NotificationTypeCard.tsx` | Create | Single notification type card (toggle, timing, template) |
| `frontend/src/components/notifications/TemplatePreviewModal.tsx` | Create | Preview modal for rendered email |
| `frontend/src/pages/admin/EventTypesPage.tsx` | Modify | Add "Notifications" button per event type |
| `frontend/src/i18n/locales/de/admin.json` | Modify | German notification UI translations |
| `frontend/src/i18n/locales/en/admin.json` | Modify | English notification UI translations |
| `docs/docs/features/notifications.md` | Create | Feature documentation |

---

### Task 1: Prisma schema + migration

**Files:**
- Modify: `backend/prisma/schema.prisma`

- [ ] **Step 1: Add meetLink to Booking model**

In the `Booking` model, add after `calendarEventId`:
```prisma
  meetLink        String?
```

- [ ] **Step 2: Add NotificationConfig model**

Add at the end of schema.prisma:
```prisma
model NotificationConfig {
  id               String  @id @default(uuid())
  eventTypeId      String  @unique
  eventType        EventType @relation(fields: [eventTypeId], references: [id], onDelete: Cascade)

  confirmationEnabled  Boolean @default(false)
  confirmationSubject  String?
  confirmationBody     String?

  cancellationEnabled  Boolean @default(false)
  cancellationSubject  String?
  cancellationBody     String?

  reminder1Enabled     Boolean @default(false)
  reminder1Timing      String  @default("24h")
  reminder1Subject     String?
  reminder1Body        String?

  reminder2Enabled     Boolean @default(false)
  reminder2Timing      String  @default("1h")
  reminder2Subject     String?
  reminder2Body        String?

  followUpEnabled      Boolean @default(false)
  followUpTiming       String  @default("30min")
  followUpSubject      String?
  followUpBody         String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

- [ ] **Step 3: Add reverse relation on EventType**

In the `EventType` model, add:
```prisma
  notificationConfig NotificationConfig?
```

- [ ] **Step 4: Run migration**

```bash
cd /Users/hziech/calendfree && npx prisma migrate dev --name add-notification-config-and-meet-link
npx prisma generate
```

- [ ] **Step 5: Commit**

```bash
git add backend/prisma/
git commit -m "feat: add NotificationConfig model and meetLink to Booking"
git push
```

---

### Task 2: Shared Zod schemas

**Files:**
- Modify: `shared/src/schemas/admin.ts`

- [ ] **Step 1: Add notification schemas at end of file**

```typescript
// Notification config
export const Reminder1TimingSchema = z.enum(['48h', '24h', '12h', '6h', '2h']);
export type Reminder1Timing = z.infer<typeof Reminder1TimingSchema>;

export const Reminder2TimingSchema = z.enum(['4h', '2h', '1h', '30min', '15min']);
export type Reminder2Timing = z.infer<typeof Reminder2TimingSchema>;

export const FollowUpTimingSchema = z.enum(['30min', '1h', '2h', '6h', '24h']);
export type FollowUpTiming = z.infer<typeof FollowUpTimingSchema>;

export const NotificationTypeSchema = z.enum(['confirmation', 'cancellation', 'reminder1', 'reminder2', 'followUp']);
export type NotificationType = z.infer<typeof NotificationTypeSchema>;

export const UpdateNotificationConfigSchema = z.object({
  confirmationEnabled: z.boolean(),
  confirmationSubject: z.string().max(200).nullable(),
  confirmationBody: z.string().max(5000).nullable(),
  cancellationEnabled: z.boolean(),
  cancellationSubject: z.string().max(200).nullable(),
  cancellationBody: z.string().max(5000).nullable(),
  reminder1Enabled: z.boolean(),
  reminder1Timing: Reminder1TimingSchema,
  reminder1Subject: z.string().max(200).nullable(),
  reminder1Body: z.string().max(5000).nullable(),
  reminder2Enabled: z.boolean(),
  reminder2Timing: Reminder2TimingSchema,
  reminder2Subject: z.string().max(200).nullable(),
  reminder2Body: z.string().max(5000).nullable(),
  followUpEnabled: z.boolean(),
  followUpTiming: FollowUpTimingSchema,
  followUpSubject: z.string().max(200).nullable(),
  followUpBody: z.string().max(5000).nullable(),
});
export type UpdateNotificationConfig = z.infer<typeof UpdateNotificationConfigSchema>;

export const PreviewNotificationSchema = z.object({
  type: NotificationTypeSchema,
  subject: z.string().max(200).nullable().optional(),
  body: z.string().max(5000).nullable().optional(),
});
```

- [ ] **Step 2: Export from shared index**

Verify that `shared/src/schemas/admin.ts` is exported from the shared package's index. If it uses barrel exports, add the new schemas.

- [ ] **Step 3: Commit**

```bash
git add shared/
git commit -m "feat: add notification config Zod schemas"
git push
```

---

### Task 3: Template system — EN translations + branding wrapper + custom template support

**Files:**
- Modify: `backend/src/services/templates.ts`

- [ ] **Step 1: Add English default templates**

Add a `DEFAULT_TEMPLATES_EN` object alongside `DEFAULT_TEMPLATES` (rename existing to `DEFAULT_TEMPLATES_DE`). Same structure, English text. Example confirmation:

```typescript
const DEFAULT_TEMPLATES_DE = { /* existing German templates */ };

const DEFAULT_TEMPLATES_EN = {
  'booking-confirmation': {
    subject: 'Booking Confirmation: {{eventTypeTitle}}',
    body: `... English version ...`,
  },
  // ... other 3 types
} as const;

function getDefaultTemplates(language: string) {
  return language === 'en' ? DEFAULT_TEMPLATES_EN : DEFAULT_TEMPLATES_DE;
}
```

- [ ] **Step 2: Add branding wrapper function**

Create a `wrapWithBranding(htmlContent, branding)` function that wraps email body content in an HTML shell with company logo and colors:

```typescript
export function wrapWithBranding(
  htmlContent: string,
  branding?: { logoUrl?: string | null; primaryColor?: string | null; companyName?: string },
): string {
  const primaryColor = branding?.primaryColor ?? '#0B8ECA';
  const logoHtml = branding?.logoUrl
    ? `<img src="${branding.logoUrl}" alt="${branding.companyName ?? ''}" style="max-height: 40px; margin-bottom: 16px;">`
    : '';
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
      ${logoHtml}
      ${htmlContent}
      <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
      <p style="color: #999; font-size: 12px;">${branding?.companyName ?? 'Calendfree'} — Powered by Calendfree</p>
    </div>
  `;
}
```

- [ ] **Step 3: Add renderNotificationEmail function**

New function that handles custom vs default templates:

```typescript
export function renderNotificationEmail(params: {
  type: TemplateName;
  customSubject?: string | null;
  customBody?: string | null;
  vars: TemplateVars & Record<string, unknown>;
  branding?: { logoUrl?: string | null; primaryColor?: string | null; companyName?: string };
  language?: string;
}): { subject: string; htmlBody: string } {
  const { type, customSubject, customBody, vars, branding, language } = params;
  const defaults = getDefaultTemplates(language ?? 'de')[type];

  const subjectSrc = customSubject ?? defaults.subject;
  const bodySrc = customBody ?? defaults.body;

  const subject = Handlebars.compile(subjectSrc)(vars);

  // Custom body is plaintext with Handlebars vars → convert newlines to <br>
  let htmlBody: string;
  if (customBody) {
    const renderedText = Handlebars.compile(bodySrc)(vars);
    htmlBody = `<p>${renderedText.replace(/\n/g, '<br>')}</p>`;
  } else {
    // Default templates already contain HTML
    htmlBody = Handlebars.compile(bodySrc)(vars);
  }

  return { subject, htmlBody: wrapWithBranding(htmlBody, branding) };
}
```

- [ ] **Step 4: Run template tests**

```bash
cd /Users/hziech/calendfree && npx vitest run backend/src/__tests__/templates.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/templates.ts
git commit -m "feat: add EN templates, branding wrapper, and custom template rendering"
git push
```

---

### Task 4: Fix notifications service — meetLink + language-aware formatting

**Files:**
- Modify: `backend/src/services/notifications.ts`

- [ ] **Step 1: Fix meetLink in getTemplateVars**

Replace the broken ternary (line 32):
```typescript
meetLink: booking.calendarEventId ? null : null,
```
With:
```typescript
meetLink: booking.meetLink ?? null,
```

Note: The `meetLink` field is now on the Booking model from Task 1. Prisma client is already regenerated (Task 1 Step 4), so just use `booking.meetLink`.

- [ ] **Step 2: Make date formatting language-aware**

Import `en` locale from date-fns and use company language:

```typescript
import { de, enUS } from 'date-fns/locale';

// In getTemplateVars, after loading booking:
const language = booking.eventType.company?.language ?? 'de';
const locale = language === 'en' ? enUS : de;
const dateFormat = language === 'en' ? "MMMM d, yyyy, h:mm a" : "d. MMMM yyyy, HH:mm 'Uhr'";

// Replace the dateTime line:
dateTime: format(zonedStart, dateFormat, { locale }),
```

- [ ] **Step 3: Add customerEmail and reminderText to TemplateVars interface in templates.ts**

In `backend/src/services/templates.ts`, update the `TemplateVars` interface to include:
```typescript
export interface TemplateVars {
  customerName: string;
  customerEmail: string;  // ADD — was previously returned separately
  consultantName: string;
  consultantEmail: string;
  eventTypeTitle: string;
  dateTime: string;
  duration: number;
  meetLink: string | null;
  cancelUrl: string;
  rescheduleUrl: string;
  companyName: string;
  reminderText?: string;  // ADD — optional, only for reminders
}
```

- [ ] **Step 4: Refactor send functions to use renderNotificationEmail with config-aware templates**

This is the critical wiring step. Each send function must:
1. Load the booking's `NotificationConfig` via eventType
2. Extract the correct custom subject/body for its notification type
3. Load company branding + language
4. Call `renderNotificationEmail` instead of `renderTemplate`

Update `getTemplateVars` to also return `eventTypeId`, `language`, and `branding`:

```typescript
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
```

Then refactor each send function. Example for `sendBookingConfirmation`:

```typescript
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
```

Apply the same pattern to `sendBookingReminder` (using `reminder1Subject`/`reminder1Body` or `reminder2Subject`/`reminder2Body` based on which reminder it is — the job data should indicate which one), `sendCancellationEmail`, and `sendFollowUpEmail`.

For `sendBookingReminder`, the `reminderText` needs to be resolved in the company language:

```typescript
export async function sendBookingReminder(bookingId: string, timingCode: string): Promise<void> {
  const { vars, assignedUserId, notificationConfig, language, branding } = await getTemplateVars(bookingId);

  // Resolve timing label in company language
  const reminderText = getTimingLabel(timingCode, language);

  const { subject, htmlBody } = renderNotificationEmail({
    type: 'booking-reminder',
    customSubject: notificationConfig?.reminder1Subject ?? notificationConfig?.reminder2Subject ?? null,
    customBody: notificationConfig?.reminder1Body ?? notificationConfig?.reminder2Body ?? null,
    vars: { ...vars, reminderText },
    branding,
    language,
  });

  await sendEmail({ userId: assignedUserId, to: vars.customerEmail, subject, htmlBody });
}
```

Add a helper for localized timing labels:
```typescript
function getTimingLabel(code: string, language: string): string {
  const labels: Record<string, Record<string, string>> = {
    de: { '15min': '15 Minuten', '30min': '30 Minuten', '1h': '1 Stunde', '2h': '2 Stunden', '4h': '4 Stunden', '6h': '6 Stunden', '12h': '12 Stunden', '24h': '24 Stunden', '48h': '48 Stunden' },
    en: { '15min': '15 minutes', '30min': '30 minutes', '1h': '1 hour', '2h': '2 hours', '4h': '4 hours', '6h': '6 hours', '12h': '12 hours', '24h': '24 hours', '48h': '48 hours' },
  };
  return labels[language]?.[code] ?? labels['de'][code] ?? code;
}
```

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/notifications.ts backend/src/services/templates.ts
git commit -m "feat: config-aware template rendering with meetLink, language, and branding"
git push
```

---

### Task 5: Config-aware notification scheduling

**Files:**
- Modify: `backend/src/jobs/notification-jobs.ts`

- [ ] **Step 1: Add timing conversion helper**

```typescript
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
```

- [ ] **Step 2: Refactor scheduleBookingNotifications to use config**

Add `eventTypeId` parameter and load config:

```typescript
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
        bookingId,
        reminderText: config.reminder1Timing,
      }, { startAfter: reminderTime });
    }
  }

  if (config.reminder2Enabled) {
    const ms = TIMING_MS[config.reminder2Timing] ?? TIMING_MS['1h'];
    const reminderTime = new Date(startTime.getTime() - ms);
    if (reminderTime > new Date()) {
      await queue.send(JOB_NAMES.BOOKING_REMINDER_1H, {
        bookingId,
        reminderText: config.reminder2Timing,
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
```

- [ ] **Step 3: Update reminder job handler to pass raw timing code**

Change the reminder handlers to pass the raw timing code to `sendBookingReminder` — the localized label is resolved there using the company language (see Task 4 Step 4):

```typescript
await queue.work(JOB_NAMES.BOOKING_REMINDER_24H, async (job) => {
  await sendBookingReminder(job.data.bookingId, job.data.reminderText ?? '24h');
});

await queue.work(JOB_NAMES.BOOKING_REMINDER_1H, async (job) => {
  await sendBookingReminder(job.data.bookingId, job.data.reminderText ?? '1h');
});
```

- [ ] **Step 4: Update cancelBookingNotifications to check config**

```typescript
export async function cancelBookingNotifications(bookingId: string): Promise<void> {
  const queue = getQueue();

  // Load booking to get eventTypeId, then check config
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
```

- [ ] **Step 5: Add prisma import at top**

Add `import { prisma } from '../db.js';` at the top of the file.

- [ ] **Step 6: Commit**

```bash
git add backend/src/jobs/notification-jobs.ts
git commit -m "feat: config-aware notification scheduling with custom timing"
git push
```

---

### Task 6: Persist meetLink in booking creation + pass eventTypeId

**Files:**
- Modify: `backend/src/routes/booking.ts`

- [ ] **Step 1: Store meetLink on booking after calendar event creation**

There are two places where meetLink is set (GROUP and non-GROUP paths). In both, after `meetLink = calEvent.meetLink;`, the existing code updates the booking with `calendarEventId`. Add `meetLink` to that update:

```typescript
await prisma.booking.update({
  where: { id: booking.id },
  data: { calendarEventId: calEvent.eventId, meetLink: calEvent.meetLink },
});
```

Find both occurrences (GROUP path ~line 244 and non-GROUP path ~line 397) and update both.

- [ ] **Step 2: Pass eventTypeId to scheduleBookingNotifications**

In both calls to `scheduleBookingNotifications`, add `eventTypeId`:

```typescript
await scheduleBookingNotifications({
  bookingId: booking.id,
  eventTypeId: eventType.id,
  startTime,
  endTime,
});
```

Find both occurrences (GROUP ~line 265 and non-GROUP ~line 419) and update both.

- [ ] **Step 3: Run tests**

```bash
cd /Users/hziech/calendfree && npx vitest run backend/src/__tests__/booking.test.ts
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/routes/booking.ts
git commit -m "feat: persist meetLink on booking and pass eventTypeId to scheduler"
git push
```

---

### Task 7: Notification config API endpoints

**Files:**
- Create: `backend/src/routes/admin/notifications.ts`
- Modify: `backend/src/app.ts`

- [ ] **Step 1: Create the notification routes file**

Create `backend/src/routes/admin/notifications.ts`:

```typescript
import type { FastifyInstance } from 'fastify';
import { z } from 'zod/v4';
import { prisma } from '../../db.js';
import { requireRole } from '../../middleware/auth.js';
import { UpdateNotificationConfigSchema, PreviewNotificationSchema } from '@calendfree/shared';
import { renderNotificationEmail, type TemplateName } from '../../services/templates.js';

const NOTIFICATION_TYPE_TO_TEMPLATE: Record<string, TemplateName> = {
  confirmation: 'booking-confirmation',
  cancellation: 'booking-cancellation',
  reminder1: 'booking-reminder',
  reminder2: 'booking-reminder',
  followUp: 'booking-followup',
};

const DEFAULT_CONFIG = {
  confirmationEnabled: false, confirmationSubject: null, confirmationBody: null,
  cancellationEnabled: false, cancellationSubject: null, cancellationBody: null,
  reminder1Enabled: false, reminder1Timing: '24h', reminder1Subject: null, reminder1Body: null,
  reminder2Enabled: false, reminder2Timing: '1h', reminder2Subject: null, reminder2Body: null,
  followUpEnabled: false, followUpTiming: '30min', followUpSubject: null, followUpBody: null,
};

export async function notificationRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireRole('USER', 'COMPANY_ADMIN', 'ORG_ADMIN'));

  /** GET /api/admin/event-types/:id/notifications */
  app.get('/api/admin/event-types/:id/notifications', {
    schema: {
      summary: 'Get notification config',
      description: 'Returns the notification configuration for an event type. Returns defaults if none configured.',
      tags: ['Notifications'],
      security: [{ session: [] }, { apiKey: [] }],
      params: z.object({ id: z.string() }),
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = request.session.user!;

    // Org isolation
    const eventType = await prisma.eventType.findFirst({
      where: { id, company: { organizationId: user.organizationId } },
    });
    if (!eventType) return reply.status(404).send({ error: 'Event type not found' });

    const config = await prisma.notificationConfig.findUnique({ where: { eventTypeId: id } });
    return config ?? { eventTypeId: id, ...DEFAULT_CONFIG };
  });

  /** PUT /api/admin/event-types/:id/notifications */
  app.put('/api/admin/event-types/:id/notifications', {
    schema: {
      summary: 'Update notification config',
      description: 'Creates or updates the notification configuration for an event type.',
      tags: ['Notifications'],
      security: [{ session: [] }, { apiKey: [] }],
      params: z.object({ id: z.string() }),
      body: UpdateNotificationConfigSchema,
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = request.session.user!;
    const body = UpdateNotificationConfigSchema.parse(request.body);

    const eventType = await prisma.eventType.findFirst({
      where: { id, company: { organizationId: user.organizationId } },
    });
    if (!eventType) return reply.status(404).send({ error: 'Event type not found' });

    const config = await prisma.notificationConfig.upsert({
      where: { eventTypeId: id },
      update: body,
      create: { eventTypeId: id, ...body },
    });
    return config;
  });

  /** POST /api/admin/event-types/:id/notifications/preview */
  app.post('/api/admin/event-types/:id/notifications/preview', {
    schema: {
      summary: 'Preview notification email',
      description: 'Renders a preview of a notification email with sample data.',
      tags: ['Notifications'],
      security: [{ session: [] }, { apiKey: [] }],
      params: z.object({ id: z.string() }),
      body: PreviewNotificationSchema,
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = request.session.user!;
    const body = PreviewNotificationSchema.parse(request.body);

    const eventType = await prisma.eventType.findFirst({
      where: { id, company: { organizationId: user.organizationId } },
      include: { company: { include: { branding: true } } },
    });
    if (!eventType) return reply.status(404).send({ error: 'Event type not found' });

    const templateName = NOTIFICATION_TYPE_TO_TEMPLATE[body.type];
    const sampleVars = {
      customerName: 'Max Mustermann',
      customerEmail: 'max@example.com',
      consultantName: user.name,
      consultantEmail: user.email,
      eventTypeTitle: eventType.title,
      dateTime: language === 'en' ? 'March 20, 2026, 2:00 PM' : '20. März 2026, 14:00 Uhr',
      duration: eventType.duration,
      meetLink: 'https://meet.google.com/abc-defg-hij',
      cancelUrl: '#',
      rescheduleUrl: '#',
      companyName: eventType.company?.name ?? 'Calendfree',
      reminderText: '24 Stunden',
    };

    const language = eventType.company?.language ?? 'de';
    const branding = eventType.company?.branding;

    const { subject, htmlBody } = renderNotificationEmail({
      type: templateName,
      customSubject: body.subject ?? null,
      customBody: body.body ?? null,
      vars: sampleVars,
      branding: branding ? { logoUrl: branding.logoUrl, primaryColor: branding.primaryColor, companyName: eventType.company?.name } : undefined,
      language,
    });

    return { subject, htmlBody };
  });
}
```

- [ ] **Step 2: Register routes in app.ts**

In `backend/src/app.ts`, add import and register:

```typescript
import { notificationRoutes } from './routes/admin/notifications.js';

// After eventTypeRoutes registration:
await app.register(notificationRoutes);
```

- [ ] **Step 3: Run tests**

```bash
cd /Users/hziech/calendfree && npx vitest run
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/routes/admin/notifications.ts backend/src/app.ts
git commit -m "feat: add notification config API endpoints (GET/PUT/preview)"
git push
```

---

### Task 8: Frontend API functions

**Files:**
- Modify: `frontend/src/api/admin.ts`

- [ ] **Step 1: Add notification API functions**

Add at the end of `frontend/src/api/admin.ts`:

```typescript
// Notification config
export async function getNotificationConfig(eventTypeId: string) {
  return apiRequest<any>(`/admin/event-types/${eventTypeId}/notifications`);
}

export async function updateNotificationConfig(eventTypeId: string, data: any) {
  return apiRequest<any>(`/admin/event-types/${eventTypeId}/notifications`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function previewNotification(eventTypeId: string, data: { type: string; subject?: string | null; body?: string | null }) {
  return apiRequest<{ subject: string; htmlBody: string }>(`/admin/event-types/${eventTypeId}/notifications/preview`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/api/admin.ts
git commit -m "feat: add notification config API functions"
git push
```

---

### Task 9: i18n translations

**Files:**
- Modify: `frontend/src/i18n/locales/de/admin.json`
- Modify: `frontend/src/i18n/locales/en/admin.json`

- [ ] **Step 1: Add German notification keys**

Add a `notifications` section to `de/admin.json`:

```json
{
  "notifications": {
    "title": "Benachrichtigungen",
    "confirmation": "Bestätigung",
    "cancellation": "Absage",
    "reminder1": "Erinnerung 1",
    "reminder2": "Erinnerung 2",
    "followUp": "Follow-Up",
    "enabled": "Aktiviert",
    "disabled": "Deaktiviert",
    "timing": "Zeitpunkt",
    "subject": "Betreff",
    "body": "Text",
    "subjectPlaceholder": "Standard-Betreff wird verwendet",
    "bodyPlaceholder": "Standard-Text wird verwendet",
    "preview": "Vorschau",
    "resetToDefault": "Auf Standard zurücksetzen",
    "variables": "Verfügbare Variablen",
    "save": "Speichern",
    "saved": "Gespeichert",
    "configure": "Benachrichtigungen konfigurieren",
    "timingOptions": {
      "15min": "15 Minuten",
      "30min": "30 Minuten",
      "1h": "1 Stunde",
      "2h": "2 Stunden",
      "4h": "4 Stunden",
      "6h": "6 Stunden",
      "12h": "12 Stunden",
      "24h": "24 Stunden",
      "48h": "48 Stunden"
    },
    "timingPrefix": {
      "reminder": "vor dem Termin",
      "followUp": "nach dem Termin"
    }
  }
}
```

- [ ] **Step 2: Add English notification keys**

Same structure in `en/admin.json`:

```json
{
  "notifications": {
    "title": "Notifications",
    "confirmation": "Confirmation",
    "cancellation": "Cancellation",
    "reminder1": "Reminder 1",
    "reminder2": "Reminder 2",
    "followUp": "Follow-Up",
    "enabled": "Enabled",
    "disabled": "Disabled",
    "timing": "Timing",
    "subject": "Subject",
    "body": "Body",
    "subjectPlaceholder": "Default subject will be used",
    "bodyPlaceholder": "Default body will be used",
    "preview": "Preview",
    "resetToDefault": "Reset to default",
    "variables": "Available variables",
    "save": "Save",
    "saved": "Saved",
    "configure": "Configure notifications",
    "timingOptions": {
      "15min": "15 minutes",
      "30min": "30 minutes",
      "1h": "1 hour",
      "2h": "2 hours",
      "4h": "4 hours",
      "6h": "6 hours",
      "12h": "12 hours",
      "24h": "24 hours",
      "48h": "48 hours"
    },
    "timingPrefix": {
      "reminder": "before appointment",
      "followUp": "after appointment"
    }
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/i18n/locales/
git commit -m "feat: add notification i18n translations (de + en)"
git push
```

---

### Task 10: Frontend — NotificationTypeCard component

**Files:**
- Create: `frontend/src/components/notifications/NotificationTypeCard.tsx`

- [ ] **Step 1: Create the component**

A collapsible card for a single notification type with toggle, optional timing dropdown, and expandable template editor.

```typescript
// See spec for the wireframe. Key elements:
// - Toggle switch (enabled/disabled)
// - Timing dropdown (only for reminder1, reminder2, followUp)
// - Collapsible "Edit" section with subject + body fields
// - Variable chips below body (click to insert)
// - "Preview" button
// - "Reset to default" link
```

Props:
```typescript
interface NotificationTypeCardProps {
  type: 'confirmation' | 'cancellation' | 'reminder1' | 'reminder2' | 'followUp';
  enabled: boolean;
  timing?: string;
  timingOptions?: string[];
  subject: string | null;
  body: string | null;
  onToggle: (enabled: boolean) => void;
  onTimingChange?: (timing: string) => void;
  onSubjectChange: (subject: string | null) => void;
  onBodyChange: (body: string | null) => void;
  onPreview: () => void;
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/notifications/NotificationTypeCard.tsx
git commit -m "feat: add NotificationTypeCard component"
git push
```

---

### Task 11: Frontend — NotificationConfigPanel + TemplatePreviewModal

**Files:**
- Create: `frontend/src/components/notifications/NotificationConfigPanel.tsx`
- Create: `frontend/src/components/notifications/TemplatePreviewModal.tsx`

- [ ] **Step 1: Create TemplatePreviewModal**

Simple modal that renders preview HTML in an iframe or `dangerouslySetInnerHTML` (safe because content comes from our own API):

```typescript
interface TemplatePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  subject: string;
  htmlBody: string;
}
```

Use an iframe with `srcdoc` for style isolation.

- [ ] **Step 2: Create NotificationConfigPanel**

The main panel component. Loads config from API, renders 5 `NotificationTypeCard` components, handles save.

```typescript
interface NotificationConfigPanelProps {
  eventTypeId: string;
  isOpen: boolean;
  onClose: () => void;
}
```

Key behavior:
- On open: `GET /api/admin/event-types/:id/notifications`
- Renders 5 cards (confirmation, cancellation, reminder1, reminder2, followUp)
- Timing dropdowns with correct options per type
- "Save" button calls `PUT /api/admin/event-types/:id/notifications`
- "Preview" calls `POST .../preview` with current draft values
- Success toast after save

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/notifications/
git commit -m "feat: add NotificationConfigPanel and TemplatePreviewModal"
git push
```

---

### Task 12: Frontend — Wire into EventTypesPage

**Files:**
- Modify: `frontend/src/pages/admin/EventTypesPage.tsx`

- [ ] **Step 1: Add notification button and panel**

In the EventTypesPage, add a "Notifications" icon/button to each event type row. On click, opens `NotificationConfigPanel` as a slide-over drawer or modal.

Add state:
```typescript
const [notifEventTypeId, setNotifEventTypeId] = useState<string | null>(null);
```

Add to each event type row:
```typescript
<button onClick={() => setNotifEventTypeId(et.id)} title={t('notifications.configure')}>
  {/* Bell icon */}
</button>
```

Render the panel:
```typescript
{notifEventTypeId && (
  <NotificationConfigPanel
    eventTypeId={notifEventTypeId}
    isOpen={!!notifEventTypeId}
    onClose={() => setNotifEventTypeId(null)}
  />
)}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/admin/EventTypesPage.tsx
git commit -m "feat: wire notification config panel into EventTypesPage"
git push
```

---

### Task 13: Documentation

**Files:**
- Create: `docs/docs/features/notifications.md`

- [ ] **Step 1: Write feature documentation**

Document:
- What notification types are available
- How to enable/configure per EventType
- Template variables
- Timing options
- Default behavior (all off)

- [ ] **Step 2: Update sidebars.ts if needed**

Add the new page to the docs sidebar.

- [ ] **Step 3: Commit**

```bash
git add docs/
git commit -m "docs: add notification system feature documentation"
git push
```

---

### Task 14: Final verification

- [ ] **Step 1: Run full test suite**

```bash
cd /Users/hziech/calendfree && npx vitest run
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit -p backend/tsconfig.json
npx tsc --noEmit -p frontend/tsconfig.json
```

- [ ] **Step 3: Manual smoke test**

1. Create/open an EventType
2. Click notification bell icon
3. Enable "Confirmation", save
4. Verify the preview works
5. Create a test booking → confirm notification job is scheduled
