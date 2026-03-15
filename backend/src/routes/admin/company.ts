// backend/src/routes/admin/company.ts
import type { FastifyInstance } from 'fastify';
import { prisma } from '../../db.js';
import { requireRole } from '../../middleware/auth.js';
import { CreateCompanySchema, UpdateCompanySchema, BrandingConfigSchema } from '@calendfree/shared';

export async function companyRoutes(app: FastifyInstance) {
  /** POST /api/admin/companies — Create company (ORG_ADMIN only) */
  app.post('/api/admin/companies', { preHandler: [requireRole('ORG_ADMIN')] }, async (request, reply) => {
    const user = request.session.user!;
    const body = CreateCompanySchema.parse(request.body);

    const company = await prisma.company.create({
      data: { ...body, organizationId: user.organizationId },
    });
    return reply.status(201).send(company);
  });

  /** GET /api/admin/companies — List companies */
  app.get('/api/admin/companies', { preHandler: [requireRole('COMPANY_ADMIN', 'ORG_ADMIN')] }, async (request) => {
    const user = request.session.user!;

    // ORG_ADMIN sees all companies, COMPANY_ADMIN sees only their own
    if (user.activeRole === 'ORG_ADMIN') {
      return prisma.company.findMany({
        where: { organizationId: user.organizationId },
        include: { branding: true },
      });
    }

    const memberships = await prisma.companyMembership.findMany({
      where: { userId: user.id },
      include: { company: { include: { branding: true } } },
    });
    return memberships.map((m) => m.company);
  });

  /** GET /api/admin/companies/:id — Get company details */
  app.get('/api/admin/companies/:id', { preHandler: [requireRole('COMPANY_ADMIN', 'ORG_ADMIN')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = request.session.user!;

    const company = await prisma.company.findFirst({
      where: { id, organizationId: user.organizationId },
      include: { branding: true, teams: true },
    });
    if (!company) return reply.status(404).send({ error: 'Company not found' });
    return company;
  });

  /** PATCH /api/admin/companies/:id — Update company */
  app.patch('/api/admin/companies/:id', { preHandler: [requireRole('COMPANY_ADMIN', 'ORG_ADMIN')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = request.session.user!;
    const body = UpdateCompanySchema.parse(request.body);

    const company = await prisma.company.updateMany({
      where: { id, organizationId: user.organizationId },
      data: body,
    });
    if (company.count === 0) return reply.status(404).send({ error: 'Company not found' });

    return prisma.company.findUnique({ where: { id } });
  });

  /** DELETE /api/admin/companies/:id — Delete company (ORG_ADMIN only) */
  app.delete('/api/admin/companies/:id', { preHandler: [requireRole('ORG_ADMIN')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = request.session.user!;

    const result = await prisma.company.deleteMany({
      where: { id, organizationId: user.organizationId },
    });
    if (result.count === 0) return reply.status(404).send({ error: 'Company not found' });
    return { success: true };
  });

  /** PUT /api/admin/companies/:id/branding — Update company branding */
  app.put('/api/admin/companies/:id/branding', { preHandler: [requireRole('COMPANY_ADMIN', 'ORG_ADMIN')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = BrandingConfigSchema.parse(request.body);

    const branding = await prisma.brandingConfig.upsert({
      where: { companyId: id },
      update: body,
      create: { ...body, companyId: id },
    });
    return branding;
  });
}
