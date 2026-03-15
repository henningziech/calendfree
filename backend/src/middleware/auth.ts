// backend/src/middleware/auth.ts
import type { FastifyRequest, FastifyReply } from 'fastify';
import type { Role } from '@calendfree/shared';

/** Require an authenticated session. */
export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  if (!request.session.user) {
    return reply.status(401).send({ error: 'Authentication required' });
  }
}

/** Require a specific minimum role in the active company. */
export function requireRole(...allowedRoles: Role[]) {
  return async function (request: FastifyRequest, reply: FastifyReply) {
    const user = request.session.user;
    if (!user) {
      return reply.status(401).send({ error: 'Authentication required' });
    }

    // ORG_ADMIN can do anything
    if (user.activeRole === 'ORG_ADMIN') return;

    if (!user.activeRole || !allowedRoles.includes(user.activeRole)) {
      return reply.status(403).send({ error: 'Insufficient permissions' });
    }
  };
}
