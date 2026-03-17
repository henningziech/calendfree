// backend/src/routes/admin/hubspot.ts
import type { FastifyInstance } from 'fastify';
import { z } from 'zod/v4';
import { requireRole } from '../../middleware/auth.js';

export async function hubspotRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireRole('COMPANY_ADMIN', 'ORG_ADMIN'));

  /** GET /api/admin/hubspot/status — Check HubSpot configuration status */
  app.get('/api/admin/hubspot/status', {
    schema: {
      summary: 'Get HubSpot integration status',
      description: 'Checks whether the HubSpot API key is configured for the environment.',
      tags: ['Integrations'],
      security: [{ session: [] }],
      response: {
        200: z.object({
          configured: z.boolean().describe('Whether HubSpot API key is set'),
          message: z.string().describe('Human-readable status message'),
        }),
      },
    },
  }, async () => {
    const configured = !!process.env.HUBSPOT_API_KEY;
    return { configured, message: configured ? 'HubSpot ist verbunden' : 'HUBSPOT_API_KEY nicht konfiguriert' };
  });
}
