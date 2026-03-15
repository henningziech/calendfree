// backend/src/middleware/tenant.ts
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';

// Extend Fastify request type for tenant context
declare module 'fastify' {
  interface FastifyRequest {
    organizationId?: string;
    companyId?: string | null;
  }
}

/** Plugin that decorates request with tenant context fields. */
export default fp(async function tenantPlugin(app: FastifyInstance) {
  app.decorateRequest('organizationId', undefined);
  app.decorateRequest('companyId', undefined);
});

/**
 * PreHandler that extracts organizationId and companyId from the session
 * and attaches them to the request. Use as preHandler on tenant-scoped routes.
 */
export async function tenantIsolation(request: FastifyRequest, reply: FastifyReply) {
  const user = request.session.user;
  if (!user) {
    return reply.status(401).send({ error: 'Authentication required' });
  }

  request.organizationId = user.organizationId;
  request.companyId = user.activeCompanyId;
}
