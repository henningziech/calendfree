// backend/src/routes/admin/routing-forms.ts
import type { FastifyInstance } from 'fastify';
import { prisma } from '../../db.js';
import { requireRole } from '../../middleware/auth.js';

export async function routingFormAdminRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireRole('COMPANY_ADMIN', 'ORG_ADMIN'));

  /** POST /api/admin/companies/:companyId/routing-forms */
  app.post('/api/admin/companies/:companyId/routing-forms', async (request, reply) => {
    const { companyId } = request.params as { companyId: string };
    const { title, slug, rules } = request.body as {
      title: string; slug: string;
      rules?: Array<{ field: string; operator: string; value: string; targetSlug: string; order?: number }>;
    };

    const form = await prisma.routingForm.create({
      data: {
        title, slug, companyId,
        rules: rules ? { create: rules.map((r, i) => ({ ...r, order: r.order ?? i })) } : undefined,
      },
      include: { rules: { orderBy: { order: 'asc' } } },
    });
    return reply.status(201).send(form);
  });

  /** GET /api/admin/companies/:companyId/routing-forms */
  app.get('/api/admin/companies/:companyId/routing-forms', async (request) => {
    const { companyId } = request.params as { companyId: string };
    return prisma.routingForm.findMany({
      where: { companyId },
      include: { rules: { orderBy: { order: 'asc' } } },
    });
  });

  /** GET /api/admin/routing-forms/:id */
  app.get('/api/admin/routing-forms/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const form = await prisma.routingForm.findUnique({
      where: { id },
      include: { rules: { orderBy: { order: 'asc' } } },
    });
    if (!form) return reply.status(404).send({ error: 'Routing form not found' });
    return form;
  });

  /** DELETE /api/admin/routing-forms/:id */
  app.delete('/api/admin/routing-forms/:id', async (request) => {
    const { id } = request.params as { id: string };
    await prisma.routingForm.delete({ where: { id } });
    return { success: true };
  });
}
