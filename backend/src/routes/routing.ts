// backend/src/routes/routing.ts
import type { FastifyInstance } from 'fastify';
import { z } from 'zod/v4';
import { prisma } from '../db.js';
import { ResolveRoutingFormSchema } from '@calendfree/shared';

const ErrorResponse = z.object({ error: z.string() });

export async function routingRoutes(app: FastifyInstance) {
  /** GET /api/routing/:companySlug/:formSlug — Get routing form for display */
  app.get('/api/routing/:companySlug/:formSlug', {
    schema: {
      summary: 'Get routing form',
      description: 'Returns a public routing form for display, including its options.',
      tags: ['Routing Forms'],
      security: [],
      params: z.object({
        companySlug: z.string().describe('Company URL slug'),
        formSlug: z.string().describe('Routing form URL slug'),
      }),
      response: {
        200: z.object({
          title: z.string(),
          description: z.string().nullable(),
          question: z.string(),
          collectName: z.boolean(),
          collectEmail: z.boolean(),
          options: z.array(z.object({
            id: z.string(),
            label: z.string(),
          })),
        }),
        404: ErrorResponse,
      },
    },
  }, async (request, reply) => {
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
  app.post('/api/routing/:companySlug/:formSlug/resolve', {
    schema: {
      summary: 'Resolve routing form',
      description: 'Evaluates the selected option and returns the routing target (event type or URL). Falls back to the form default if no matching option is found.',
      tags: ['Routing Forms'],
      security: [],
      params: z.object({
        companySlug: z.string().describe('Company URL slug'),
        formSlug: z.string().describe('Routing form URL slug'),
      }),
      body: ResolveRoutingFormSchema,
      response: {
        200: z.object({
          type: z.string().describe('Target type (EVENT_TYPE or URL)'),
          value: z.string().describe('Target value (event type slug or URL)'),
          prefill: z.record(z.string(), z.string()).optional().describe('Pre-filled form data'),
        }),
        404: ErrorResponse,
      },
    },
  }, async (request, reply) => {
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
