import type { FastifyInstance } from 'fastify';
import { getAuthUrl, handleCallback } from '../services/google-auth.js';
import { config } from '../config.js';
import { logAudit } from '../services/audit-log.js';
import { prisma } from '../db.js';
import { SwitchCompanySchema } from '@calendfree/shared';

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

    const memberships = await prisma.companyMembership.findMany({
      where: { userId: request.session.user.id },
      include: { company: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'asc' },
    });

    // Preserve activeCompanyId if still valid, otherwise fall back to first
    const currentCompanyId = request.session.user.activeCompanyId;
    const currentMembership = currentCompanyId
      ? memberships.find((m) => m.companyId === currentCompanyId)
      : null;
    const activeMembership = currentMembership ?? memberships[0] ?? null;

    request.session.user.activeCompanyId = activeMembership?.companyId ?? null;
    request.session.user.activeRole = activeMembership?.role ?? null;

    return {
      ...request.session.user,
      companyMemberships: memberships.map((m) => ({
        companyId: m.companyId,
        companyName: m.company.name,
        role: m.role,
      })),
    };
  });

  /** Switch active company context */
  app.patch('/api/auth/me/company', async (request, reply) => {
    if (!request.session.user) {
      return reply.status(401).send({ error: 'Not authenticated' });
    }

    const { companyId } = SwitchCompanySchema.parse(request.body);

    // Validate membership exists and is in the same organization
    const membership = await prisma.companyMembership.findFirst({
      where: {
        userId: request.session.user.id,
        companyId,
        company: { organizationId: request.session.user.organizationId },
      },
    });

    if (!membership) {
      return reply.status(403).send({ error: 'Not a member of this company' });
    }

    request.session.user.activeCompanyId = companyId;
    request.session.user.activeRole = membership.role;

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
