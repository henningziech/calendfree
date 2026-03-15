// backend/src/routes/admin/domains.ts
import type { FastifyInstance } from 'fastify';
import { prisma } from '../../db.js';
import { requireRole } from '../../middleware/auth.js';
import dns from 'node:dns/promises';

export async function domainRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireRole('COMPANY_ADMIN', 'ORG_ADMIN'));

  /** GET /api/admin/companies/:id/domain — Get custom domain config */
  app.get('/api/admin/companies/:id/domain', async (request, reply) => {
    const { id } = request.params as { id: string };
    const company = await prisma.company.findUnique({ where: { id }, select: { customDomain: true } });
    if (!company) return reply.status(404).send({ error: 'Company not found' });
    return { customDomain: company.customDomain };
  });

  /** PUT /api/admin/companies/:id/domain — Set custom domain */
  app.put('/api/admin/companies/:id/domain', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { domain } = request.body as { domain: string | null };

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
