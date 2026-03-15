import type { FastifyInstance } from 'fastify';
import { getAuthUrl, handleCallback } from '../services/google-auth.js';
import { config } from '../config.js';
import { logAudit } from '../services/audit-log.js';
import { prisma } from '../db.js';

export async function authRoutes(app: FastifyInstance) {
  /** Redirect to Google OAuth consent screen */
  app.get('/api/auth/google', async (request, reply) => {
    const url = getAuthUrl();
    return reply.redirect(url);
  });

  /** Google OAuth callback — exchanges code for tokens, creates session */
  app.get('/api/auth/google/callback', async (request, reply) => {
    const { code, error } = request.query as { code?: string; error?: string };

    if (error || !code) {
      app.log.warn({ error }, 'OAuth callback error');
      return reply.redirect(`${config.FRONTEND_URL}/login?error=oauth_failed`);
    }

    try {
      const sessionUser = await handleCallback(code);
      request.session.user = sessionUser;

      // Update lastLoginAt
      await prisma.user.update({ where: { id: sessionUser.id }, data: { lastLoginAt: new Date() } });

      logAudit({
        userId: sessionUser.id,
        action: 'USER_LOGIN',
        ipAddress: request.ip,
      });

      return reply.redirect(`${config.FRONTEND_URL}/dashboard`);
    } catch (err) {
      app.log.error(err, 'OAuth callback failed');
      return reply.redirect(`${config.FRONTEND_URL}/login?error=oauth_failed`);
    }
  });

  /** Get current session user — refreshes role/company from DB */
  app.get('/api/auth/me', async (request, reply) => {
    if (!request.session.user) {
      return reply.status(401).send({ error: 'Not authenticated' });
    }

    // Refresh membership data from DB (in case roles changed since login)
    const { prisma } = await import('../db.js');
    const memberships = await prisma.companyMembership.findMany({
      where: { userId: request.session.user.id },
      orderBy: { createdAt: 'asc' },
    });

    const activeMembership = memberships[0] ?? null;

    // Update session with fresh data
    request.session.user.activeCompanyId = activeMembership?.companyId ?? null;
    request.session.user.activeRole = activeMembership?.role ?? null;

    return request.session.user;
  });

  /** Logout — destroy session */
  app.post('/api/auth/logout', async (request, reply) => {
    logAudit({
      userId: request.session.user?.id,
      action: 'USER_LOGOUT',
      ipAddress: request.ip,
    });

    await request.session.destroy();
    return { success: true };
  });
}
