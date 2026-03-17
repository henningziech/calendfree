// backend/src/routes/routing.ts
import type { FastifyInstance } from 'fastify';
import { prisma } from '../db.js';
import { ResolveRoutingFormSchema } from '@calendfree/shared';

export async function routingRoutes(app: FastifyInstance) {
  /** GET /api/routing/:companySlug/:formSlug — Get routing form for display */
  app.get('/api/routing/:companySlug/:formSlug', async (request, reply) => {
    const { companySlug, formSlug } = request.params as { companySlug: string; formSlug: string };

    const company = await prisma.company.findFirst({ where: { slug: companySlug } });
    if (!company) return reply.status(404).send({ error: 'Company not found' });

    const form = await prisma.routingForm.findFirst({
      where: { companyId: company.id, slug: formSlug, active: true },
      include: { options: { orderBy: { order: 'asc' } } },
    });
    if (!form) return reply.status(404).send({ error: 'Routing form not found' });

    return {
      title: form.title,
      description: form.description,
      question: form.question,
      collectName: form.collectName,
      collectEmail: form.collectEmail,
      options: form.options.map((o) => ({ id: o.id, label: o.label })),
    };
  });

  /** POST /api/routing/:companySlug/:formSlug/resolve — Evaluate answer */
  app.post('/api/routing/:companySlug/:formSlug/resolve', async (request, reply) => {
    const { companySlug, formSlug } = request.params as { companySlug: string; formSlug: string };
    const body = ResolveRoutingFormSchema.parse(request.body);

    const company = await prisma.company.findFirst({ where: { slug: companySlug } });
    if (!company) return reply.status(404).send({ error: 'Company not found' });

    const form = await prisma.routingForm.findFirst({
      where: { companyId: company.id, slug: formSlug, active: true },
      include: { options: true },
    });
    if (!form) return reply.status(404).send({ error: 'Routing form not found' });

    const option = form.options.find((o) => o.id === body.optionId);

    const targetType = option?.targetType ?? form.fallbackType;
    const targetValue = option?.targetValue ?? form.fallbackValue;

    const prefill: Record<string, string> = {};
    if (body.name) prefill.name = body.name;
    if (body.email) prefill.email = body.email;

    return {
      type: targetType,
      value: targetValue,
      prefill: Object.keys(prefill).length > 0 ? prefill : undefined,
    };
  });
}
