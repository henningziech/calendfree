// backend/src/routes/admin/event-types.ts
import type { FastifyInstance } from 'fastify';
import { z } from 'zod/v4';
import { prisma } from '../../db.js';
import { requireRole } from '../../middleware/auth.js';
import { CreateEventTypeSchema, UpdateEventTypeSchema } from '@calendfree/shared';

const ErrorResponse = z.object({ error: z.string() });

export async function eventTypeRoutes(app: FastifyInstance) {
  // All authenticated users can manage event types
  app.addHook('preHandler', requireRole('USER', 'COMPANY_ADMIN', 'ORG_ADMIN'));

  /** POST /api/admin/companies/:companyId/event-types — Create event type */
  app.post('/api/admin/companies/:companyId/event-types', {
    schema: {
      summary: 'Create event type',
      description: 'Creates a new event type for a company. If no team is assigned, the event type is personal and assigned to the creating user.',
      tags: ['Event Types'],
      security: [{ session: [] }, { apiKey: [] }],
      params: z.object({
        companyId: z.string().describe('Company ID'),
      }),
      body: CreateEventTypeSchema,
      response: {
        201: z.object({
          id: z.string(),
          title: z.string(),
          slug: z.string(),
          duration: z.number(),
          active: z.boolean(),
        }).passthrough(),
        400: ErrorResponse,
      },
    },
  }, async (request, reply) => {
    const { companyId } = request.params as { companyId: string };
    const body = CreateEventTypeSchema.parse(request.body);

    const { formFields, ...eventTypeData } = body;

    // If no team assigned, this is a personal event type — assign to creating user
    const userId = eventTypeData.teamId ? null : request.session.user!.id;

    const eventType = await prisma.eventType.create({
      data: {
        ...eventTypeData,
        companyId,
        userId,
        formFields: {
          create: formFields.map((f, i) => ({ ...f, order: i })),
        },
      },
      include: { formFields: true },
    });
    return reply.status(201).send(eventType);
  });

  /** GET /api/admin/companies/:companyId/event-types — List event types */
  app.get('/api/admin/companies/:companyId/event-types', {
    schema: {
      summary: 'List event types',
      description: 'Returns all event types for a company, including associated team/user and booking counts.',
      tags: ['Event Types'],
      security: [{ session: [] }, { apiKey: [] }],
      params: z.object({
        companyId: z.string().describe('Company ID'),
      }),
    },
  }, async (request) => {
    const { companyId } = request.params as { companyId: string };
    return prisma.eventType.findMany({
      where: { companyId },
      include: {
        team: { select: { id: true, name: true } },
        user: { select: { id: true, name: true } },
        formFields: { orderBy: { order: 'asc' } },
        _count: { select: { bookings: true } },
      },
    });
  });

  /** GET /api/admin/event-types/:id — Get event type details */
  app.get('/api/admin/event-types/:id', {
    schema: {
      summary: 'Get event type details',
      description: 'Returns a single event type with its team, user, and form fields.',
      tags: ['Event Types'],
      security: [{ session: [] }, { apiKey: [] }],
      params: z.object({
        id: z.string().describe('Event type ID'),
      }),
      response: {
        404: ErrorResponse,
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const eventType = await prisma.eventType.findUnique({
      where: { id },
      include: {
        team: { select: { id: true, name: true } },
        user: { select: { id: true, name: true } },
        formFields: { orderBy: { order: 'asc' } },
      },
    });
    if (!eventType) return reply.status(404).send({ error: 'Event type not found' });
    return eventType;
  });

  /** PATCH /api/admin/event-types/:id — Update event type */
  app.patch('/api/admin/event-types/:id', {
    schema: {
      summary: 'Update event type',
      description: 'Updates an existing event type with the provided fields.',
      tags: ['Event Types'],
      security: [{ session: [] }, { apiKey: [] }],
      params: z.object({
        id: z.string().describe('Event type ID'),
      }),
      body: UpdateEventTypeSchema,
    },
  }, async (request) => {
    const { id } = request.params as { id: string };
    const body = UpdateEventTypeSchema.parse(request.body);
    return prisma.eventType.update({ where: { id }, data: body });
  });

  /** DELETE /api/admin/event-types/:id — Delete event type */
  app.delete('/api/admin/event-types/:id', {
    schema: {
      summary: 'Delete event type',
      description: 'Permanently deletes an event type.',
      tags: ['Event Types'],
      security: [{ session: [] }, { apiKey: [] }],
      params: z.object({
        id: z.string().describe('Event type ID'),
      }),
      response: {
        200: z.object({ success: z.boolean() }),
      },
    },
  }, async (request) => {
    const { id } = request.params as { id: string };
    await prisma.eventType.delete({ where: { id } });
    return { success: true };
  });

  /** PATCH /api/admin/event-types/:id/toggle — Activate/deactivate */
  app.patch('/api/admin/event-types/:id/toggle', {
    schema: {
      summary: 'Toggle event type active status',
      description: 'Toggles the active/inactive state of an event type.',
      tags: ['Event Types'],
      security: [{ session: [] }, { apiKey: [] }],
      params: z.object({
        id: z.string().describe('Event type ID'),
      }),
    },
  }, async (request) => {
    const { id } = request.params as { id: string };
    const current = await prisma.eventType.findUniqueOrThrow({ where: { id } });
    return prisma.eventType.update({ where: { id }, data: { active: !current.active } });
  });
}
