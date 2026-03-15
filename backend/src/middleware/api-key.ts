// backend/src/middleware/api-key.ts
import type { FastifyRequest, FastifyReply } from 'fastify';
import { createHash } from 'node:crypto';
import { prisma } from '../db.js';

/**
 * Authenticate a request via API key (Bearer token).
 * If an API key is present and valid, populates request.session.user.
 * Falls through to session auth if no API key is present.
 */
export async function apiKeyAuth(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer cf_live_')) return; // No API key, let session auth handle it

  const key = authHeader.slice(7); // Remove "Bearer "
  const hash = createHash('sha256').update(key).digest('hex');

  const apiKey = await prisma.apiKey.findUnique({
    where: { keyHash: hash },
    include: {
      user: {
        include: {
          companyMemberships: { orderBy: { createdAt: 'asc' }, take: 1 },
        },
      },
    },
  });

  if (!apiKey || !apiKey.active) {
    return reply.status(401).send({ error: 'Invalid or inactive API key' });
  }

  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
    return reply.status(401).send({ error: 'API key expired' });
  }

  // Update last used timestamp (fire and forget)
  prisma.apiKey.update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } }).catch(() => {});

  // Populate session-like user context
  const membership = apiKey.user.companyMemberships[0];
  request.session.user = {
    id: apiKey.user.id,
    email: apiKey.user.email,
    name: apiKey.user.name,
    avatarUrl: apiKey.user.avatarUrl,
    organizationId: apiKey.user.organizationId,
    activeCompanyId: membership?.companyId ?? null,
    activeRole: membership?.role ?? null,
  };
}
