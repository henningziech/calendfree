// backend/src/routes/admin/organization.ts
import type { FastifyInstance } from 'fastify';
import { prisma } from '../../db.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { BrandingConfigSchema } from '@calendfree/shared';

export async function organizationRoutes(app: FastifyInstance) {
  // All org routes require ORG_ADMIN
  app.addHook('preHandler', requireRole('ORG_ADMIN'));

  /** GET /api/admin/org — Get current organization details */
  app.get('/api/admin/org', async (request) => {
    const user = request.session.user!;
    const org = await prisma.organization.findUniqueOrThrow({
      where: { id: user.organizationId },
      include: { branding: true, companies: { select: { id: true, name: true, slug: true } } },
    });
    return org;
  });

  /** PUT /api/admin/org/branding — Update organization branding */
  app.put('/api/admin/org/branding', async (request, reply) => {
    const user = request.session.user!;
    const body = BrandingConfigSchema.parse(request.body);

    const branding = await prisma.brandingConfig.upsert({
      where: { organizationId: user.organizationId },
      update: body,
      create: { ...body, organizationId: user.organizationId },
    });
    return branding;
  });
}
