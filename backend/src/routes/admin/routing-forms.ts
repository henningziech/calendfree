// backend/src/routes/admin/routing-forms.ts
import type { FastifyInstance } from 'fastify';
import { z } from 'zod/v4';
import { prisma } from '../../db.js';
import { requireAuth } from '../../middleware/auth.js';
import { CreateRoutingFormSchema, UpdateRoutingFormSchema } from '@calendfree/shared';

const ErrorResponse = z.object({ error: z.string() });

export async function routingFormAdminRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);

  /** GET /api/admin/routing-forms — List all for active company */
  app.get('/api/admin/routing-forms', {
    schema: {
      summary: 'List routing forms',
      description: 'Returns all routing forms for the active company, including option counts.',
      tags: ['Routing Forms'],
      security: [{ session: [] }, { apiKey: [] }],
      response: {
        400: ErrorResponse,
      },
    },
  }, async (request, reply) => {
    const user = request.session.user!;
    if (!user.activeCompanyId) return reply.status(400).send({ error: 'No active company' });

    return prisma.routingForm.findMany({
      where: { companyId: user.activeCompanyId },
      include: { _count: { select: { options: true } } },
      orderBy: { createdAt: 'desc' },
    });
  });

  /** POST /api/admin/routing-forms — Create */
  app.post('/api/admin/routing-forms', {
    schema: {
      summary: 'Create routing form',
      description: 'Creates a new routing form with options for the active company.',
      tags: ['Routing Forms'],
      security: [{ session: [] }, { apiKey: [] }],
      body: CreateRoutingFormSchema,
      response: {
        201: z.object({
          id: z.string(),
          title: z.string(),
          slug: z.string(),
        }).passthrough(),
        400: ErrorResponse,
        409: ErrorResponse,
      },
    },
  }, async (request, reply) => {
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
  app.get('/api/admin/routing-forms/:id', {
    schema: {
      summary: 'Get routing form',
      description: 'Returns a routing form with its options and company slug.',
      tags: ['Routing Forms'],
      security: [{ session: [] }, { apiKey: [] }],
      params: z.object({
        id: z.string().describe('Routing form ID'),
      }),
      response: {
        400: ErrorResponse,
        404: ErrorResponse,
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = request.session.user!;
    if (!user.activeCompanyId) return reply.status(400).send({ error: 'No active company' });

    const form = await prisma.routingForm.findFirst({
      where: { id, companyId: user.activeCompanyId },
      include: {
        options: { orderBy: { order: 'asc' } },
        company: { select: { slug: true } },
      },
    });
    if (!form) return reply.status(404).send({ error: 'Routing form not found' });
    return form;
  });

  /** PATCH /api/admin/routing-forms/:id — Update */
  app.patch('/api/admin/routing-forms/:id', {
    schema: {
      summary: 'Update routing form',
      description: 'Updates a routing form and optionally replaces its options. Only the creator, COMPANY_ADMIN, or ORG_ADMIN can edit.',
      tags: ['Routing Forms'],
      security: [{ session: [] }, { apiKey: [] }],
      params: z.object({
        id: z.string().describe('Routing form ID'),
      }),
      body: UpdateRoutingFormSchema,
      response: {
        400: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = request.session.user!;
    if (!user.activeCompanyId) return reply.status(400).send({ error: 'No active company' });

    const form = await prisma.routingForm.findFirst({
      where: { id, companyId: user.activeCompanyId },
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
  app.delete('/api/admin/routing-forms/:id', {
    schema: {
      summary: 'Delete routing form',
      description: 'Permanently deletes a routing form and its options. Only the creator, COMPANY_ADMIN, or ORG_ADMIN can delete.',
      tags: ['Routing Forms'],
      security: [{ session: [] }, { apiKey: [] }],
      params: z.object({
        id: z.string().describe('Routing form ID'),
      }),
      response: {
        200: z.object({ success: z.boolean() }),
        400: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = request.session.user!;
    if (!user.activeCompanyId) return reply.status(400).send({ error: 'No active company' });

    const form = await prisma.routingForm.findFirst({
      where: { id, companyId: user.activeCompanyId },
    });
    if (!form) return reply.status(404).send({ error: 'Routing form not found' });

    if (form.createdByUserId !== user.id && user.activeRole !== 'COMPANY_ADMIN' && user.activeRole !== 'ORG_ADMIN') {
      return reply.status(403).send({ error: 'Not authorized to delete this form' });
    }

    await prisma.routingForm.delete({ where: { id } });
    return { success: true };
  });
}
