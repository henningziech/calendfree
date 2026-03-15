// backend/src/routes/admin/event-types.ts
import type { FastifyInstance } from 'fastify';
import { prisma } from '../../db.js';
import { requireRole } from '../../middleware/auth.js';
import { CreateEventTypeSchema, UpdateEventTypeSchema } from '@calendfree/shared';

export async function eventTypeRoutes(app: FastifyInstance) {
  // All authenticated users can manage event types
  app.addHook('preHandler', requireRole('USER', 'COMPANY_ADMIN', 'ORG_ADMIN'));

  /** POST /api/admin/companies/:companyId/event-types — Create event type */
  app.post('/api/admin/companies/:companyId/event-types', async (request, reply) => {
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
  app.get('/api/admin/companies/:companyId/event-types', async (request) => {
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
  app.get('/api/admin/event-types/:id', async (request, reply) => {
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
  app.patch('/api/admin/event-types/:id', async (request) => {
    const { id } = request.params as { id: string };
    const body = UpdateEventTypeSchema.parse(request.body);
    return prisma.eventType.update({ where: { id }, data: body });
  });

  /** DELETE /api/admin/event-types/:id — Delete event type */
  app.delete('/api/admin/event-types/:id', async (request) => {
    const { id } = request.params as { id: string };
    await prisma.eventType.delete({ where: { id } });
    return { success: true };
  });

  /** PATCH /api/admin/event-types/:id/toggle — Activate/deactivate */
  app.patch('/api/admin/event-types/:id/toggle', async (request) => {
    const { id } = request.params as { id: string };
    const current = await prisma.eventType.findUniqueOrThrow({ where: { id } });
    return prisma.eventType.update({ where: { id }, data: { active: !current.active } });
  });
}
