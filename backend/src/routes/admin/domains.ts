// backend/src/routes/admin/domains.ts
import type { FastifyInstance } from 'fastify';
import { z } from 'zod/v4';
import { prisma } from '../../db.js';
import { requireRole } from '../../middleware/auth.js';
import dns from 'node:dns/promises';

const ErrorResponse = z.object({ error: z.string() });

export async function domainRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireRole('COMPANY_ADMIN', 'ORG_ADMIN'));

  /** GET /api/admin/companies/:id/domain — Get custom domain config */
  app.get('/api/admin/companies/:id/domain', {
    schema: {
      summary: 'Get custom domain',
      description: 'Returns the custom domain configuration for a company.',
      tags: ['Companies'],
      security: [{ session: [] }],
      params: z.object({
        id: z.string().describe('Company ID'),
      }),
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = request.session.user!;
    const company = await prisma.company.findFirst({
      where: { id, organizationId: user.organizationId },
      select: { customDomain: true },
    });
    if (!company) return reply.status(404).send({ error: 'Company not found' });
    return { customDomain: company.customDomain };
  });

  /** PUT /api/admin/companies/:id/domain — Set custom domain */
  app.put('/api/admin/companies/:id/domain', {
    schema: {
      summary: 'Set custom domain',
      description: 'Sets or removes the custom domain for a company. Verifies DNS CNAME before accepting.',
      tags: ['Companies'],
      security: [{ session: [] }],
      params: z.object({
        id: z.string().describe('Company ID'),
      }),
      body: z.object({
        domain: z.string().nullable().describe('Custom domain to set, or null to remove'),
      }),
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = request.session.user!;
    const { domain } = request.body as { domain: string | null };

    // Verify company belongs to the requesting user's organization
    const company = await prisma.company.findFirst({
      where: { id, organizationId: user.organizationId },
    });
    if (!company) return reply.status(404).send({ error: 'Company not found' });

    if (domain) {
      // Verify DNS CNAME
      try {
        const records = await dns.resolveCname(domain);
        const backendHost = new URL(process.env.BACKEND_URL || 'http://localhost:3001').hostname;
        if (!records.some((r) => r.includes(backendHost) || r.includes('calendfree'))) {
          return reply.status(400).send({
            error: `DNS CNAME für ${domain} zeigt nicht auf den Calendfree Server. Bitte CNAME auf ${backendHost} setzen.`,
          });
        }
      } catch {
        return reply.status(400).send({ error: `DNS-Lookup für ${domain} fehlgeschlagen. Domain nicht konfiguriert.` });
      }
    }

    await prisma.company.update({ where: { id }, data: { customDomain: domain } });
    return { success: true, customDomain: domain };
  });
}
