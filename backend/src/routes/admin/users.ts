// backend/src/routes/admin/users.ts
import type { FastifyInstance } from 'fastify';
import { prisma } from '../../db.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { InviteUserSchema, UpdateMembershipRoleSchema, UpdateAvailabilitySchema } from '@calendfree/shared';

export async function userRoutes(app: FastifyInstance) {
  /** GET /api/admin/companies/:companyId/users — List company members */
  app.get('/api/admin/companies/:companyId/users', { preHandler: [requireRole('COMPANY_ADMIN', 'ORG_ADMIN')] }, async (request) => {
    const { companyId } = request.params as { companyId: string };
    const memberships = await prisma.companyMembership.findMany({
      where: { companyId },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatarUrl: true, slug: true, timezone: true },
          include: { googleTokens: { select: { connected: true } } },
        },
      },
    });
    return memberships.map((m) => ({ ...m.user, role: m.role, googleConnected: m.user.googleTokens?.connected ?? false }));
  });

  /** POST /api/admin/companies/:companyId/users — Invite user to company */
  app.post('/api/admin/companies/:companyId/users', { preHandler: [requireRole('COMPANY_ADMIN', 'ORG_ADMIN')] }, async (request, reply) => {
    const { companyId } = request.params as { companyId: string };
    const user = request.session.user!;
    const body = InviteUserSchema.parse(request.body);

    // Find or create user
    let targetUser = await prisma.user.findUnique({ where: { email: body.email } });
    if (!targetUser) {
      targetUser = await prisma.user.create({
        data: { email: body.email, name: body.name, organizationId: user.organizationId },
      });
    }

    // Create membership
    const membership = await prisma.companyMembership.create({
      data: { userId: targetUser.id, companyId, role: body.role },
    });
    return reply.status(201).send({ ...targetUser, role: membership.role });
  });

  /** PATCH /api/admin/companies/:companyId/users/:userId/role — Update user role */
  app.patch('/api/admin/companies/:companyId/users/:userId/role', { preHandler: [requireRole('ORG_ADMIN')] }, async (request) => {
    const { companyId, userId } = request.params as { companyId: string; userId: string };
    const body = UpdateMembershipRoleSchema.parse(request.body);
    return prisma.companyMembership.update({
      where: { userId_companyId: { userId, companyId } },
      data: { role: body.role },
    });
  });

  /** DELETE /api/admin/companies/:companyId/users/:userId — Remove user from company */
  app.delete('/api/admin/companies/:companyId/users/:userId', { preHandler: [requireRole('COMPANY_ADMIN', 'ORG_ADMIN')] }, async (request) => {
    const { companyId, userId } = request.params as { companyId: string; userId: string };
    await prisma.companyMembership.delete({
      where: { userId_companyId: { userId, companyId } },
    });
    return { success: true };
  });

  /** GET /api/me — Get current user profile */
  app.get('/api/me', { preHandler: [requireAuth] }, async (request) => {
    const user = request.session.user!;
    const fullUser = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      include: {
        availability: true,
        googleTokens: { select: { connected: true, scopes: true } },
        companyMemberships: { include: { company: { select: { id: true, name: true, slug: true } } } },
      },
    });
    return fullUser;
  });

  /** PATCH /api/me/availability — Update own availability */
  app.patch('/api/me/availability', { preHandler: [requireAuth] }, async (request) => {
    const user = request.session.user!;
    const body = UpdateAvailabilitySchema.parse(request.body);

    return prisma.availabilityConfig.upsert({
      where: { userId: user.id },
      update: body,
      create: { userId: user.id, ...body },
    });
  });

  /** PATCH /api/me/timezone — Update own timezone */
  app.patch('/api/me/timezone', { preHandler: [requireAuth] }, async (request) => {
    const user = request.session.user!;
    const { timezone } = request.body as { timezone: string };
    return prisma.user.update({ where: { id: user.id }, data: { timezone } });
  });
}
