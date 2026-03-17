// backend/src/routes/admin/routing-forms.ts
import type { FastifyInstance } from 'fastify';
import { prisma } from '../../db.js';
import { requireAuth } from '../../middleware/auth.js';
import { CreateRoutingFormSchema, UpdateRoutingFormSchema } from '@calendfree/shared';

export async function routingFormAdminRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);

  /** GET /api/admin/routing-forms — List all for active company */
  app.get('/api/admin/routing-forms', async (request, reply) => {
    const user = request.session.user!;
    if (!user.activeCompanyId) return reply.status(400).send({ error: 'No active company' });

    return prisma.routingForm.findMany({
      where: { companyId: user.activeCompanyId },
      include: { _count: { select: { options: true } } },
      orderBy: { createdAt: 'desc' },
    });
  });

  /** POST /api/admin/routing-forms — Create */
  app.post('/api/admin/routing-forms', async (request, reply) => {
    const user = request.session.user!;
    if (!user.activeCompanyId) return reply.status(400).send({ error: 'No active company' });

    const data = CreateRoutingFormSchema.parse(request.body);
    const { options, ...formData } = data;

    try {
      const form = await prisma.routingForm.create({
        data: {
          ...formData,
          companyId: user.activeCompanyId,
          createdByUserId: user.id,
          options: { create: options },
        },
        include: { options: { orderBy: { order: 'asc' } } },
      });
      return reply.status(201).send(form);
    } catch (err: any) {
      if (err.code === 'P2002') {
        return reply.status(409).send({ error: 'Ein Routing Form mit diesem Slug existiert bereits.' });
      }
      throw err;
    }
  });

  /** GET /api/admin/routing-forms/:id — Get with options */
  app.get('/api/admin/routing-forms/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = request.session.user!;

    const form = await prisma.routingForm.findFirst({
      where: { id, companyId: user.activeCompanyId! },
      include: {
        options: { orderBy: { order: 'asc' } },
        company: { select: { slug: true } },
      },
    });
    if (!form) return reply.status(404).send({ error: 'Routing form not found' });
    return form;
  });

  /** PATCH /api/admin/routing-forms/:id — Update */
  app.patch('/api/admin/routing-forms/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = request.session.user!;

    const form = await prisma.routingForm.findFirst({
      where: { id, companyId: user.activeCompanyId! },
    });
    if (!form) return reply.status(404).send({ error: 'Routing form not found' });

    // Only creator, COMPANY_ADMIN, or ORG_ADMIN can edit
    if (form.createdByUserId !== user.id && user.activeRole !== 'COMPANY_ADMIN' && user.activeRole !== 'ORG_ADMIN') {
      return reply.status(403).send({ error: 'Not authorized to edit this form' });
    }

    const data = UpdateRoutingFormSchema.parse(request.body);
    const { options, ...formData } = data;

    const updated = await prisma.$transaction(async (tx) => {
      if (options) {
        await tx.routingOption.deleteMany({ where: { routingFormId: id } });
        await tx.routingOption.createMany({
          data: options.map((o) => ({ ...o, routingFormId: id })),
        });
      }
      return tx.routingForm.update({
        where: { id },
        data: formData,
        include: { options: { orderBy: { order: 'asc' } } },
      });
    });

    return updated;
  });

  /** DELETE /api/admin/routing-forms/:id — Delete */
  app.delete('/api/admin/routing-forms/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = request.session.user!;

    const form = await prisma.routingForm.findFirst({
      where: { id, companyId: user.activeCompanyId! },
    });
    if (!form) return reply.status(404).send({ error: 'Routing form not found' });

    if (form.createdByUserId !== user.id && user.activeRole !== 'COMPANY_ADMIN' && user.activeRole !== 'ORG_ADMIN') {
      return reply.status(403).send({ error: 'Not authorized to delete this form' });
    }

    await prisma.routingForm.delete({ where: { id } });
    return { success: true };
  });
}
