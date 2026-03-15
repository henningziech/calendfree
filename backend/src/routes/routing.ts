// backend/src/routes/routing.ts
import type { FastifyInstance } from 'fastify';
import { prisma } from '../db.js';

export async function routingRoutes(app: FastifyInstance) {
  /** GET /api/routing/:companySlug/:formSlug — Get routing form for display */
  app.get('/api/routing/:companySlug/:formSlug', async (request, reply) => {
    const { companySlug, formSlug } = request.params as { companySlug: string; formSlug: string };

    const company = await prisma.company.findFirst({ where: { slug: companySlug } });
    if (!company) return reply.status(404).send({ error: 'Company not found' });

    const form = await prisma.routingForm.findFirst({
      where: { companyId: company.id, slug: formSlug, active: true },
      include: { rules: { orderBy: { order: 'asc' } } },
    });
    if (!form) return reply.status(404).send({ error: 'Routing form not found' });

    // Return form with unique field names for the UI to render as questions
    const fields = [...new Set(form.rules.map((r) => r.field))];

    return {
      title: form.title,
      fields: fields.map((f) => ({
        name: f,
        options: form.rules.filter((r) => r.field === f).map((r) => ({
          value: r.value,
          label: r.value,
        })),
      })),
    };
  });

  /** POST /api/routing/:companySlug/:formSlug/resolve — Evaluate answers and return target */
  app.post('/api/routing/:companySlug/:formSlug/resolve', async (request, reply) => {
    const { companySlug, formSlug } = request.params as { companySlug: string; formSlug: string };
    const answers = request.body as Record<string, string>;

    const company = await prisma.company.findFirst({ where: { slug: companySlug } });
    if (!company) return reply.status(404).send({ error: 'Company not found' });

    const form = await prisma.routingForm.findFirst({
      where: { companyId: company.id, slug: formSlug, active: true },
      include: { rules: { orderBy: { order: 'asc' } } },
    });
    if (!form) return reply.status(404).send({ error: 'Routing form not found' });

    // Evaluate rules in order
    for (const rule of form.rules) {
      const answer = answers[rule.field];
      if (!answer) continue;

      let match = false;
      switch (rule.operator) {
        case 'equals': match = answer === rule.value; break;
        case 'contains': match = answer.toLowerCase().includes(rule.value.toLowerCase()); break;
        case 'regex': match = new RegExp(rule.value, 'i').test(answer); break;
      }

      if (match) {
        return { redirect: `/${companySlug}/${rule.targetSlug}` };
      }
    }

    return reply.status(404).send({ error: 'No matching rule found' });
  });
}
