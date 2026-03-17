// backend/src/routes/admin/teams.ts
import type { FastifyInstance } from 'fastify';
import { prisma } from '../../db.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { CreateTeamSchema, UpdateTeamSchema, AddTeamMemberSchema, UpdateTeamMemberSchema, UpdateTeamMemberRoleSchema, UpdateRoundRobinSchema } from '@calendfree/shared';

/** Check if user can manage a team (is Owner or Company/Org Admin). */
async function canManageTeam(userId: string, userRole: string, teamId: string): Promise<boolean> {
  if (userRole === 'ORG_ADMIN' || userRole === 'COMPANY_ADMIN') return true;
  const membership = await prisma.teamMembership.findUnique({
    where: { userId_teamId: { userId, teamId } },
  });
  return membership?.role === 'OWNER';
}

export async function teamRoutes(app: FastifyInstance) {
  // All authenticated users can view and create teams
  // (RBAC for delete/modify is checked per-endpoint where needed)
  app.addHook('preHandler', requireRole('USER', 'COMPANY_ADMIN', 'ORG_ADMIN'));

  /** POST /api/admin/companies/:companyId/teams — Create team */
  app.post('/api/admin/companies/:companyId/teams', async (request, reply) => {
    const { companyId } = request.params as { companyId: string };
    const user = request.session.user!;
    const body = CreateTeamSchema.parse(request.body);

    const team = await prisma.team.create({
      data: {
        name: body.name,
        companyId,
        rrConfig: {
          create: { mode: 'SEQUENTIAL' },
        },
        memberships: {
          create: { userId: user.id, weight: 100, role: 'OWNER' },
        },
      },
      include: { rrConfig: true },
    });
    return reply.status(201).send(team);
  });

  /** GET /api/admin/companies/:companyId/teams — List teams */
  app.get('/api/admin/companies/:companyId/teams', async (request) => {
    const { companyId } = request.params as { companyId: string };
    return prisma.team.findMany({
      where: { companyId },
      include: {
        rrConfig: true,
        memberships: { include: { user: { select: { id: true, name: true, email: true } } } },
        _count: { select: { eventTypes: true } },
      },
    });
  });

  /** GET /api/admin/teams/:id — Get team details */
  app.get('/api/admin/teams/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const team = await prisma.team.findUnique({
      where: { id },
      include: {
        rrConfig: true,
        memberships: { include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } } },
        eventTypes: { select: { id: true, title: true, slug: true, active: true, duration: true } },
      company: { select: { slug: true } },
      },
    });
    if (!team) return reply.status(404).send({ error: 'Team not found' });
    return team;
  });

  /** GET /api/admin/teams/:id/bookings — Paginated team bookings with filters */
  app.get('/api/admin/teams/:id/bookings', async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = request.session.user!;
    const { page = '1', limit = '15', status = 'upcoming', userId } = request.query as {
      page?: string;
      limit?: string;
      status?: string;
      userId?: string;
    };

    // Access check: must be a team member
    const membership = await prisma.teamMembership.findUnique({
      where: { userId_teamId: { userId: user.id, teamId: id } },
    });
    if (!membership) {
      return reply.status(403).send({ error: 'Not a member of this team' });
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 15));
    const skip = (pageNum - 1) * limitNum;

    const where: any = {
      eventType: { teamId: id },
    };

    if (status === 'upcoming') {
      where.startTime = { gte: new Date() };
      where.status = 'CONFIRMED';
    }

    if (userId) {
      where.assignedUserId = userId;
    }

    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        include: {
          eventType: { select: { title: true, slug: true, duration: true, teamId: true, team: { select: { name: true } }, company: { select: { slug: true } } } },
          formData: { select: { name: true, email: true, data: true } },
          assignedUser: { select: { name: true, email: true } },
        },
        orderBy: { startTime: status === 'upcoming' ? 'asc' : 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.booking.count({ where }),
    ]);

    return {
      bookings,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum),
    };
  });

  /** PATCH /api/admin/teams/:id — Update team */
  app.patch('/api/admin/teams/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = request.session.user!;
    if (!(await canManageTeam(user.id, user.activeRole ?? 'USER', id))) {
      return reply.status(403).send({ error: 'Not authorized' });
    }
    const body = UpdateTeamSchema.parse(request.body);
    const team = await prisma.team.update({ where: { id }, data: body });
    return team;
  });

  /** DELETE /api/admin/teams/:id — Delete team */
  app.delete('/api/admin/teams/:id', async (request, reply) => {
    const { id } = (request.params as { id: string });
    const user = request.session.user!;
    if (!(await canManageTeam(user.id, user.activeRole ?? 'USER', id))) {
      return reply.status(403).send({ error: 'Not authorized' });
    }
    await prisma.team.delete({ where: { id } });
    return { success: true };
  });

  /** PUT /api/admin/teams/:id/round-robin — Update round-robin config */
  app.put('/api/admin/teams/:id/round-robin', async (request) => {
    const { id } = request.params as { id: string };
    const body = UpdateRoundRobinSchema.parse(request.body);
    return prisma.roundRobinConfig.update({
      where: { teamId: id },
      data: { mode: body.mode, lastAssignedIndex: 0 },
    });
  });

  /** POST /api/admin/teams/:id/members — Add team member */
  app.post('/api/admin/teams/:id/members', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = AddTeamMemberSchema.parse(request.body);
    const membership = await prisma.teamMembership.create({
      data: { teamId: id, userId: body.userId, weight: body.weight },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    return reply.status(201).send(membership);
  });

  /** PATCH /api/admin/teams/:teamId/members/:userId — Update member weight */
  app.patch('/api/admin/teams/:teamId/members/:userId', async (request) => {
    const { teamId, userId } = request.params as { teamId: string; userId: string };
    const body = UpdateTeamMemberSchema.parse(request.body);
    return prisma.teamMembership.update({
      where: { userId_teamId: { userId, teamId } },
      data: { weight: body.weight },
    });
  });

  /** PATCH /api/admin/teams/:teamId/members/:userId/role — Update team member role (MEMBER/OWNER). Owner/Admin only. */
  app.patch('/api/admin/teams/:teamId/members/:userId/role', { preHandler: [requireAuth] }, async (request, reply) => {
    const { teamId, userId: targetUserId } = request.params as { teamId: string; userId: string };
    const user = request.session.user!;

    if (!(await canManageTeam(user.id, user.activeRole ?? 'USER', teamId))) {
      return reply.status(403).send({ error: 'Not authorized' });
    }

    const body = UpdateTeamMemberRoleSchema.parse(request.body);

    // Last-owner protection
    if (body.role === 'MEMBER') {
      const ownerCount = await prisma.teamMembership.count({ where: { teamId, role: 'OWNER' } });
      const target = await prisma.teamMembership.findUnique({
        where: { userId_teamId: { userId: targetUserId, teamId } },
      });
      if (target?.role === 'OWNER' && ownerCount <= 1) {
        return reply.status(400).send({ error: 'Cannot demote the last owner' });
      }
    }

    return prisma.teamMembership.update({
      where: { userId_teamId: { userId: targetUserId, teamId } },
      data: { role: body.role },
    });
  });

  /** DELETE /api/admin/teams/:teamId/members/:userId — Remove team member */
  app.delete('/api/admin/teams/:teamId/members/:userId', async (request, reply) => {
    const { teamId, userId } = request.params as { teamId: string; userId: string };
    const user = request.session.user!;
    if (!(await canManageTeam(user.id, user.activeRole ?? 'USER', teamId))) {
      return reply.status(403).send({ error: 'Not authorized' });
    }

    const target = await prisma.teamMembership.findUnique({
      where: { userId_teamId: { userId, teamId } },
    });
    if (target?.role === 'OWNER') {
      const ownerCount = await prisma.teamMembership.count({ where: { teamId, role: 'OWNER' } });
      if (ownerCount <= 1) {
        return reply.status(400).send({ error: 'Cannot remove the last owner' });
      }
    }

    await prisma.teamMembership.delete({
      where: { userId_teamId: { userId, teamId } },
    });
    return { success: true };
  });

  /** POST /api/admin/teams/:id/join — Join team (self) */
  app.post('/api/admin/teams/:id/join', async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = request.session.user!;
    try {
      const membership = await prisma.teamMembership.create({
        data: { teamId: id, userId: user.id, weight: 100 },
        include: { user: { select: { id: true, name: true, email: true } } },
      });
      return reply.status(201).send(membership);
    } catch {
      return reply.status(409).send({ error: 'Bereits Mitglied in diesem Team' });
    }
  });

  /** POST /api/admin/teams/:id/leave — Leave team (self) */
  app.post('/api/admin/teams/:id/leave', async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = request.session.user!;

    // Last-owner protection
    const membership = await prisma.teamMembership.findUnique({
      where: { userId_teamId: { userId: user.id, teamId: id } },
    });
    if (membership?.role === 'OWNER') {
      const ownerCount = await prisma.teamMembership.count({ where: { teamId: id, role: 'OWNER' } });
      if (ownerCount <= 1) {
        return reply.status(400).send({ error: 'Cannot leave as the last owner. Transfer ownership first.' });
      }
    }

    await prisma.teamMembership.delete({
      where: { userId_teamId: { userId: user.id, teamId: id } },
    });
    return { success: true };
  });

  /** POST /api/admin/teams/:id/invite — Invite user to team by email */
  app.post('/api/admin/teams/:id/invite', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { email, weight } = request.body as { email: string; weight?: number };

    const targetUser = await prisma.user.findUnique({ where: { email } });
    if (!targetUser) {
      return reply.status(404).send({ error: `Kein User mit E-Mail ${email} gefunden` });
    }

    try {
      const membership = await prisma.teamMembership.create({
        data: { teamId: id, userId: targetUser.id, weight: weight ?? 100 },
        include: { user: { select: { id: true, name: true, email: true } } },
      });
      return reply.status(201).send(membership);
    } catch {
      return reply.status(409).send({ error: 'User ist bereits Mitglied in diesem Team' });
    }
  });
}
