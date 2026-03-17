// backend/src/routes/admin/teams.ts
import type { FastifyInstance } from 'fastify';
import { z } from 'zod/v4';
import { prisma } from '../../db.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { CreateTeamSchema, UpdateTeamSchema, AddTeamMemberSchema, UpdateTeamMemberSchema, UpdateTeamMemberRoleSchema, UpdateRoundRobinSchema } from '@calendfree/shared';

const ErrorResponse = z.object({ error: z.string() });
const SuccessResponse = z.object({ success: z.boolean() });

const TeamIdParam = z.object({
  id: z.string().describe('Team ID'),
});

const TeamMemberParams = z.object({
  teamId: z.string().describe('Team ID'),
  userId: z.string().describe('User ID'),
});

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
  app.post('/api/admin/companies/:companyId/teams', {
    schema: {
      summary: 'Create a team',
      description: 'Creates a new team within a company. The authenticated user becomes the team owner with default sequential round-robin configuration.',
      tags: ['Teams'],
      security: [{ session: [] }, { apiKey: [] }],
      params: z.object({
        companyId: z.string().describe('Company ID'),
      }),
      body: CreateTeamSchema,
    },
  }, async (request, reply) => {
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
  app.get('/api/admin/companies/:companyId/teams', {
    schema: {
      summary: 'List teams for a company',
      description: 'Returns all teams belonging to a company, including round-robin configuration, member details, and event type counts.',
      tags: ['Teams'],
      security: [{ session: [] }, { apiKey: [] }],
      params: z.object({
        companyId: z.string().describe('Company ID'),
      }),
    },
  }, async (request) => {
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
  app.get('/api/admin/teams/:id', {
    schema: {
      summary: 'Get team details',
      description: 'Returns detailed team information including round-robin config, members with avatars, event types, and company slug.',
      tags: ['Teams'],
      security: [{ session: [] }, { apiKey: [] }],
      params: TeamIdParam,
    },
  }, async (request, reply) => {
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
  app.get('/api/admin/teams/:id/bookings', {
    schema: {
      summary: 'List team bookings',
      description: 'Returns paginated bookings for a team. Supports filtering by status (upcoming/all) and assigned user. Requires team membership.',
      tags: ['Teams'],
      security: [{ session: [] }, { apiKey: [] }],
      params: TeamIdParam,
      querystring: z.object({
        page: z.string().optional().describe('Page number (default: 1)'),
        limit: z.string().optional().describe('Items per page (default: 15, max: 50)'),
        status: z.string().optional().describe('Filter by status: "upcoming" (default) or "all"'),
        userId: z.string().optional().describe('Filter by assigned user ID'),
      }),
    },
  }, async (request, reply) => {
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
  app.patch('/api/admin/teams/:id', {
    schema: {
      summary: 'Update a team',
      description: 'Updates team properties. Requires team owner, company admin, or org admin role.',
      tags: ['Teams'],
      security: [{ session: [] }, { apiKey: [] }],
      params: TeamIdParam,
      body: UpdateTeamSchema,
    },
  }, async (request, reply) => {
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
  app.delete('/api/admin/teams/:id', {
    schema: {
      summary: 'Delete a team',
      description: 'Permanently deletes a team and all associated memberships. Requires team owner, company admin, or org admin role.',
      tags: ['Teams'],
      security: [{ session: [] }, { apiKey: [] }],
      params: TeamIdParam,
    },
  }, async (request, reply) => {
    const { id } = (request.params as { id: string });
    const user = request.session.user!;
    if (!(await canManageTeam(user.id, user.activeRole ?? 'USER', id))) {
      return reply.status(403).send({ error: 'Not authorized' });
    }
    await prisma.team.delete({ where: { id } });
    return { success: true };
  });

  /** PUT /api/admin/teams/:id/round-robin — Update round-robin config */
  app.put('/api/admin/teams/:id/round-robin', {
    schema: {
      summary: 'Update round-robin configuration',
      description: 'Updates the round-robin assignment mode for a team. Resets the assignment index to 0.',
      tags: ['Teams'],
      security: [{ session: [] }, { apiKey: [] }],
      params: TeamIdParam,
      body: UpdateRoundRobinSchema,
    },
  }, async (request) => {
    const { id } = request.params as { id: string };
    const body = UpdateRoundRobinSchema.parse(request.body);
    return prisma.roundRobinConfig.update({
      where: { teamId: id },
      data: { mode: body.mode, lastAssignedIndex: 0 },
    });
  });

  /** POST /api/admin/teams/:id/members — Add team member */
  app.post('/api/admin/teams/:id/members', {
    schema: {
      summary: 'Add a team member',
      description: 'Adds a user as a member of the team with a specified weight for round-robin assignment.',
      tags: ['Teams'],
      security: [{ session: [] }, { apiKey: [] }],
      params: TeamIdParam,
      body: AddTeamMemberSchema,
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = AddTeamMemberSchema.parse(request.body);
    const membership = await prisma.teamMembership.create({
      data: { teamId: id, userId: body.userId, weight: body.weight },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    return reply.status(201).send(membership);
  });

  /** PATCH /api/admin/teams/:teamId/members/:userId — Update member weight */
  app.patch('/api/admin/teams/:teamId/members/:userId', {
    schema: {
      summary: 'Update team member weight',
      description: 'Updates the round-robin weight for a team member. Higher weight increases assignment frequency in weighted mode.',
      tags: ['Teams'],
      security: [{ session: [] }, { apiKey: [] }],
      params: TeamMemberParams,
      body: UpdateTeamMemberSchema,
    },
  }, async (request) => {
    const { teamId, userId } = request.params as { teamId: string; userId: string };
    const body = UpdateTeamMemberSchema.parse(request.body);
    return prisma.teamMembership.update({
      where: { userId_teamId: { userId, teamId } },
      data: { weight: body.weight },
    });
  });

  /** PATCH /api/admin/teams/:teamId/members/:userId/role — Update team member role (MEMBER/OWNER). Owner/Admin only. */
  app.patch('/api/admin/teams/:teamId/members/:userId/role', {
    schema: {
      summary: 'Update team member role',
      description: 'Changes a team member role between MEMBER and OWNER. Cannot demote the last owner. Requires team owner, company admin, or org admin role.',
      tags: ['Teams'],
      security: [{ session: [] }, { apiKey: [] }],
      params: TeamMemberParams,
      body: UpdateTeamMemberRoleSchema,
    },
    preHandler: [requireAuth],
  }, async (request, reply) => {
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
  app.delete('/api/admin/teams/:teamId/members/:userId', {
    schema: {
      summary: 'Remove a team member',
      description: 'Removes a user from the team. Cannot remove the last owner. Requires team owner, company admin, or org admin role.',
      tags: ['Teams'],
      security: [{ session: [] }, { apiKey: [] }],
      params: TeamMemberParams,
    },
  }, async (request, reply) => {
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
  app.post('/api/admin/teams/:id/join', {
    schema: {
      summary: 'Join a team',
      description: 'Adds the authenticated user as a member of the team with default weight. Returns 409 if already a member.',
      tags: ['Teams'],
      security: [{ session: [] }, { apiKey: [] }],
      params: TeamIdParam,
    },
  }, async (request, reply) => {
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
  app.post('/api/admin/teams/:id/leave', {
    schema: {
      summary: 'Leave a team',
      description: 'Removes the authenticated user from the team. Cannot leave if the user is the last owner.',
      tags: ['Teams'],
      security: [{ session: [] }, { apiKey: [] }],
      params: TeamIdParam,
    },
  }, async (request, reply) => {
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
  app.post('/api/admin/teams/:id/invite', {
    schema: {
      summary: 'Invite a user to a team',
      description: 'Adds a user to the team by their email address. Returns 404 if the user is not found, 409 if already a member.',
      tags: ['Teams'],
      security: [{ session: [] }, { apiKey: [] }],
      params: TeamIdParam,
      body: z.object({
        email: z.string().describe('Email address of the user to invite'),
        weight: z.number().optional().describe('Round-robin weight (default: 100)'),
      }),
    },
  }, async (request, reply) => {
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
