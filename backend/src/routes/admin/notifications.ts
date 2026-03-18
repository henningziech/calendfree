// backend/src/routes/admin/notifications.ts
import type { FastifyInstance } from 'fastify';
import { z } from 'zod/v4';
import { prisma } from '../../db.js';
import { requireRole } from '../../middleware/auth.js';
import { UpdateNotificationConfigSchema, PreviewNotificationSchema } from '@calendfree/shared';
import { renderNotificationEmail } from '../../services/templates.js';

const ErrorResponse = z.object({ error: z.string() });

const NOTIFICATION_TYPE_TO_TEMPLATE: Record<string, string> = {
  confirmation: 'booking-confirmation',
  cancellation: 'booking-cancellation',
  reminder1: 'booking-reminder',
  reminder2: 'booking-reminder',
  followUp: 'booking-followup',
};

const DEFAULT_CONFIG = {
  confirmationEnabled: false,
  confirmationSubject: null,
  confirmationBody: null,
  cancellationEnabled: false,
  cancellationSubject: null,
  cancellationBody: null,
  reminder1Enabled: false,
  reminder1Timing: '24h',
  reminder1Subject: null,
  reminder1Body: null,
  reminder2Enabled: false,
  reminder2Timing: '1h',
  reminder2Subject: null,
  reminder2Body: null,
  followUpEnabled: false,
  followUpTiming: '30min',
  followUpSubject: null,
  followUpBody: null,
};

/**
 * Routes for managing per-EventType notification configuration.
 */
export async function notificationRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireRole('USER', 'COMPANY_ADMIN', 'ORG_ADMIN'));

  const ParamsSchema = z.object({
    id: z.string().describe('Event type ID'),
  });

  /**
   * Finds event type with org isolation check. Returns null if not found or not in user's org.
   */
  async function findEventTypeWithOrgCheck(id: string, organizationId: string) {
    return prisma.eventType.findFirst({
      where: {
        id,
        company: { organizationId },
      },
      include: {
        company: {
          include: { branding: true },
        },
        notificationConfig: true,
      },
    });
  }

  /** GET /api/admin/event-types/:id/notifications — Get notification config */
  app.get('/api/admin/event-types/:id/notifications', {
    schema: {
      summary: 'Get notification config',
      description: 'Returns the notification configuration for an event type. Returns defaults if none configured.',
      tags: ['Notifications'],
      security: [{ session: [] }, { apiKey: [] }],
      params: ParamsSchema,
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = request.session.user!;

    const eventType = await findEventTypeWithOrgCheck(id, user.organizationId);
    if (!eventType) return reply.status(404).send({ error: 'Event type not found' });

    const config = eventType.notificationConfig ?? DEFAULT_CONFIG;
    return config;
  });

  /** PUT /api/admin/event-types/:id/notifications — Update notification config */
  app.put('/api/admin/event-types/:id/notifications', {
    schema: {
      summary: 'Update notification config',
      description: 'Creates or updates the notification configuration for an event type.',
      tags: ['Notifications'],
      security: [{ session: [] }, { apiKey: [] }],
      params: ParamsSchema,
      body: UpdateNotificationConfigSchema,
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = request.session.user!;

    const eventType = await findEventTypeWithOrgCheck(id, user.organizationId);
    if (!eventType) return reply.status(404).send({ error: 'Event type not found' });

    const body = UpdateNotificationConfigSchema.parse(request.body);

    const config = await prisma.notificationConfig.upsert({
      where: { eventTypeId: id },
      create: { eventTypeId: id, ...body },
      update: body,
    });

    return config;
  });

  /** POST /api/admin/event-types/:id/notifications/preview — Preview notification email */
  app.post('/api/admin/event-types/:id/notifications/preview', {
    schema: {
      summary: 'Preview notification email',
      description: 'Renders a preview of a notification email using sample data and company branding.',
      tags: ['Notifications'],
      security: [{ session: [] }, { apiKey: [] }],
      params: ParamsSchema,
      body: PreviewNotificationSchema,
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = request.session.user!;

    const eventType = await findEventTypeWithOrgCheck(id, user.organizationId);
    if (!eventType) return reply.status(404).send({ error: 'Event type not found' });

    const { type, subject: customSubject, body: customBody } = PreviewNotificationSchema.parse(request.body);

    const templateName = NOTIFICATION_TYPE_TO_TEMPLATE[type];
    if (!templateName) return reply.status(400).send({ error: 'Invalid notification type' });

    const language = eventType.company?.language ?? 'de';

    const sampleVars = {
      customerName: 'Max Mustermann',
      customerEmail: 'max@example.com',
      consultantName: user.name ?? 'Team Member',
      consultantEmail: user.email ?? 'team@example.com',
      eventTypeTitle: eventType.title,
      dateTime: language === 'en' ? 'March 20, 2026, 2:00 PM' : '20. März 2026, 14:00 Uhr',
      duration: eventType.duration,
      meetLink: 'https://meet.google.com/sample-link',
      cancelUrl: 'https://example.com/cancel/sample-id',
      rescheduleUrl: 'https://example.com/reschedule/sample-id',
      companyName: eventType.company?.name ?? 'Calendfree',
    };

    const companyBranding = eventType.company?.branding;
    const branding = {
      logoUrl: companyBranding?.logoUrl ?? null,
      primaryColor: companyBranding?.primaryColor ?? null,
      companyName: eventType.company?.name ?? 'Calendfree',
    };

    const result = renderNotificationEmail({
      type: templateName as Parameters<typeof renderNotificationEmail>[0]['type'],
      customSubject: customSubject ?? null,
      customBody: customBody ?? null,
      vars: sampleVars,
      branding,
      language,
    });

    return { subject: result.subject, htmlBody: result.htmlBody };
  });
}
