import Fastify, { type FastifyInstance } from 'fastify';
import { z } from 'zod/v4';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import {
  serializerCompiler,
  validatorCompiler,
  jsonSchemaTransform,
} from 'fastify-type-provider-zod';
import { config } from './config.js';
import sessionPlugin from './plugins/session.js';
import { redis } from './redis.js';
import { prisma } from './db.js';
import { authRoutes } from './routes/auth.js';
import { bookingRoutes } from './routes/booking.js';
import { organizationRoutes } from './routes/admin/organization.js';
import { companyRoutes } from './routes/admin/company.js';
import { teamRoutes } from './routes/admin/teams.js';
import { userRoutes } from './routes/admin/users.js';
import { eventTypeRoutes } from './routes/admin/event-types.js';
import { apiKeyAuth } from './middleware/api-key.js';
import { apiKeyRoutes } from './routes/admin/api-keys.js';
import { routingFormAdminRoutes } from './routes/admin/routing-forms.js';
import { routingRoutes } from './routes/routing.js';
import { hubspotRoutes } from './routes/admin/hubspot.js';
import { analyticsRoutes } from './routes/admin/analytics.js';
import { domainRoutes } from './routes/admin/domains.js';
import { embedRoutes } from './routes/embed.js';
import { holidayRoutes } from './routes/holidays.js';
import { registerHubSpotHandlers } from './jobs/hubspot-jobs.js';
import tenantPlugin from './middleware/tenant.js';
import { startJobQueue, stopJobQueue } from './jobs/queue.js';
import { registerNotificationHandlers } from './jobs/notification-jobs.js';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: config.LOG_LEVEL,
      transport: config.NODE_ENV === 'development'
        ? { target: 'pino-pretty' }
        : undefined,
    },
    genReqId: () => crypto.randomUUID(),
  });

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  // Security
  await app.register(helmet, {
    contentSecurityPolicy: config.NODE_ENV === 'production',
  });

  // CORS
  await app.register(cors, {
    origin: config.FRONTEND_URL,
    credentials: true,
  });

  // Rate limiting (disabled in development)
  if (config.NODE_ENV !== 'development') {
    await app.register(rateLimit, {
      max: 100,
      timeWindow: '1 minute',
    });
  }

  // Multipart file upload (2MB limit)
  await app.register(multipart, {
    limits: { fileSize: 2 * 1024 * 1024 },
  });

  // Serve uploaded files
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  await app.register(fastifyStatic, {
    root: path.join(__dirname, '..', 'public', 'uploads'),
    prefix: '/uploads/',
    decorateReply: false,
  });

  const isDocgen = config.NODE_ENV === 'docgen';

  if (!isDocgen) {
    // Session management (Redis-backed)
    await app.register(sessionPlugin);
  }

  // Swagger / OpenAPI
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'Calendfree API',
        description: 'Round-Robin Scheduling Platform API',
        version: '0.1.0',
      },
      components: {
        securitySchemes: {
          session: { type: 'apiKey', in: 'cookie', name: 'sessionId' },
          apiKey: { type: 'http', scheme: 'bearer', bearerFormat: 'API Key' },
        },
      },
    },
    transform: jsonSchemaTransform,
  });
  await app.register(swaggerUi, { routePrefix: '/api/docs' });

  if (!isDocgen) {
    // API key authentication (before session check, populates session.user if valid key)
    app.addHook('preHandler', apiKeyAuth);

    // Tenant context (decorates request with organizationId/companyId)
    await app.register(tenantPlugin);
  }

  // Auth routes
  await app.register(authRoutes);

  // Booking routes (public)
  await app.register(bookingRoutes);

  // Admin routes
  await app.register(organizationRoutes);
  await app.register(companyRoutes);
  await app.register(teamRoutes);
  await app.register(userRoutes);
  await app.register(eventTypeRoutes);
  await app.register(apiKeyRoutes);
  await app.register(routingFormAdminRoutes);
  await app.register(hubspotRoutes);
  await app.register(analyticsRoutes);
  await app.register(domainRoutes);

  // Public routing routes
  await app.register(routingRoutes);

  // Embed widget
  await app.register(embedRoutes);

  // Holidays
  await app.register(holidayRoutes);

  // Health check
  app.get('/api/health', {
    schema: {
      tags: ['System'],
      summary: 'Health check',
      operationId: 'getHealth',
      response: {
        200: z.object({
          status: z.enum(['ok', 'degraded']),
          timestamp: z.string(),
          services: z.object({
            database: z.boolean(),
            redis: z.boolean(),
          }),
        }),
      },
    },
  }, async () => {
    const dbOk = await prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false);
    const redisOk = await redis.ping().then(() => true).catch(() => false);
    return {
      status: dbOk && redisOk ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      services: { database: dbOk, redis: redisOk },
    };
  });

  // Start job queue (only in non-test environments)
  if (config.NODE_ENV !== 'test' && !isDocgen) {
    app.addHook('onReady', async () => {
      await startJobQueue();
      await registerNotificationHandlers();
      await registerHubSpotHandlers();
      app.log.info('pg-boss job queue started');
      app.log.info('Notification job handlers registered');
      app.log.info('HubSpot job handlers registered');
    });

    app.addHook('onClose', async () => {
      await stopJobQueue();
    });
  }

  return app;
}
