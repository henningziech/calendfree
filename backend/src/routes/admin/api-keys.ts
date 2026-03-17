// backend/src/routes/admin/api-keys.ts
import type { FastifyInstance } from 'fastify';
import { z } from 'zod/v4';
import { randomBytes, createHash } from 'node:crypto';
import { prisma } from '../../db.js';
import { requireAuth } from '../../middleware/auth.js';
import { CreateApiKeySchema } from '@calendfree/shared';
import { logAudit } from '../../services/audit-log.js';

const ErrorResponse = z.object({ error: z.string() });

/** Generate a prefixed API key and its SHA-256 hash. */
function generateApiKey(): { key: string; hash: string; prefix: string } {
  const raw = randomBytes(32).toString('hex');
  const key = `cf_live_${raw}`;
  const hash = createHash('sha256').update(key).digest('hex');
  const prefix = key.slice(0, 16);
  return { key, hash, prefix };
}

export async function apiKeyRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);

  /** GET /api/me/api-keys — List user's API keys */
  app.get('/api/me/api-keys', {
    schema: {
      summary: 'List API keys',
      description: 'Returns all API keys for the authenticated user, excluding the key hash.',
      tags: ['API Keys'],
      security: [{ session: [] }, { apiKey: [] }],
      response: {
        200: z.array(z.object({
          id: z.string(),
          name: z.string(),
          keyPrefix: z.string(),
          active: z.boolean(),
          expiresAt: z.string().nullable(),
          lastUsedAt: z.string().nullable(),
          createdAt: z.string(),
        })),
      },
    },
  }, async (request) => {
    const user = request.session.user!;
    return prisma.apiKey.findMany({
      where: { userId: user.id },
      select: { id: true, name: true, keyPrefix: true, active: true, expiresAt: true, lastUsedAt: true, createdAt: true },
    });
  });

  /** POST /api/me/api-keys — Create API key */
  app.post('/api/me/api-keys', {
    schema: {
      summary: 'Create API key',
      description: 'Creates a new API key. The full key is returned only once in the response and is never stored.',
      tags: ['API Keys'],
      security: [{ session: [] }, { apiKey: [] }],
      body: CreateApiKeySchema,
      response: {
        201: z.object({
          id: z.string(),
          name: z.string(),
          key: z.string().describe('Full API key (shown only once)'),
          keyPrefix: z.string(),
          expiresAt: z.string().nullable(),
          createdAt: z.string(),
        }),
      },
    },
  }, async (request, reply) => {
    const user = request.session.user!;
    const body = CreateApiKeySchema.parse(request.body);
    const { key, hash, prefix } = generateApiKey();

    const apiKey = await prisma.apiKey.create({
      data: {
        userId: user.id,
        name: body.name,
        keyHash: hash,
        keyPrefix: prefix,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
      },
    });

    logAudit({ userId: user.id, action: 'API_KEY_CREATED', details: { keyId: apiKey.id, name: body.name }, ipAddress: request.ip });

    // Return the full key ONLY on creation (never stored in DB)
    return reply.status(201).send({
      id: apiKey.id,
      name: apiKey.name,
      key, // Only time the full key is shown
      keyPrefix: apiKey.keyPrefix,
      expiresAt: apiKey.expiresAt,
      createdAt: apiKey.createdAt,
    });
  });

  /** DELETE /api/me/api-keys/:id — Revoke API key */
  app.delete('/api/me/api-keys/:id', {
    schema: {
      summary: 'Revoke API key',
      description: 'Permanently deletes an API key, revoking its access.',
      tags: ['API Keys'],
      security: [{ session: [] }, { apiKey: [] }],
      params: z.object({
        id: z.string().describe('API key ID'),
      }),
      response: {
        200: z.object({ success: z.boolean() }),
        404: ErrorResponse,
      },
    },
  }, async (request, reply) => {
    const user = request.session.user!;
    const { id } = request.params as { id: string };

    const result = await prisma.apiKey.deleteMany({ where: { id, userId: user.id } });
    if (result.count === 0) return reply.status(404).send({ error: 'API key not found' });

    logAudit({ userId: user.id, action: 'API_KEY_REVOKED', details: { keyId: id }, ipAddress: request.ip });
    return { success: true };
  });
}
