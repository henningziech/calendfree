// backend/src/routes/admin/hubspot.ts
import type { FastifyInstance } from 'fastify';
import { requireRole } from '../../middleware/auth.js';

export async function hubspotRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireRole('COMPANY_ADMIN', 'ORG_ADMIN'));

  /** GET /api/admin/hubspot/status — Check HubSpot configuration status */
  app.get('/api/admin/hubspot/status', async () => {
    const configured = !!process.env.HUBSPOT_API_KEY;
    return { configured, message: configured ? 'HubSpot ist verbunden' : 'HUBSPOT_API_KEY nicht konfiguriert' };
  });
}
