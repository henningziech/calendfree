import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { config } from './config.js';
import sessionPlugin from './plugins/session.js';
import { redis } from './redis.js';
import { prisma } from './db.js';
import { authRoutes } from './routes/auth.js';
import { bookingRoutes } from './routes/booking.js';
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

  // Security
  await app.register(helmet, {
    contentSecurityPolicy: config.NODE_ENV === 'production',
  });

  // CORS
  await app.register(cors, {
    origin: config.FRONTEND_URL,
    credentials: true,
  });

  // Rate limiting
  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });

  // Session management (Redis-backed)
  await app.register(sessionPlugin);

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
  });
  await app.register(swaggerUi, { routePrefix: '/api/docs' });

  // Tenant context (decorates request with organizationId/companyId)
  await app.register(tenantPlugin);

  // Auth routes
  await app.register(authRoutes);

  // Booking routes (public)
  await app.register(bookingRoutes);

  // Health check
  app.get('/api/health', async () => {
    const dbOk = await prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false);
    const redisOk = await redis.ping().then(() => true).catch(() => false);
    return {
      status: dbOk && redisOk ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      services: { database: dbOk, redis: redisOk },
    };
  });

  // Start job queue (only in non-test environments)
  if (config.NODE_ENV !== 'test') {
    app.addHook('onReady', async () => {
      await startJobQueue();
      await registerNotificationHandlers();
      app.log.info('pg-boss job queue started');
      app.log.info('Notification job handlers registered');
    });

    app.addHook('onClose', async () => {
      await stopJobQueue();
    });
  }

  return app;
}
