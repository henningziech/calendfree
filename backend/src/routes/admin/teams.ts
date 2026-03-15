// backend/src/routes/admin/teams.ts
import type { FastifyInstance } from 'fastify';
import { prisma } from '../../db.js';
import { requireRole } from '../../middleware/auth.js';
import { CreateTeamSchema, UpdateTeamSchema, AddTeamMemberSchema, UpdateTeamMemberSchema, UpdateRoundRobinSchema } from '@calendfree/shared';

export async function teamRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireRole('COMPANY_ADMIN', 'ORG_ADMIN'));

  /** POST /api/admin/companies/:companyId/teams — Create team */
  app.post('/api/admin/companies/:companyId/teams', async (request, reply) => {
    const { companyId } = request.params as { companyId: string };
    const body = CreateTeamSchema.parse(request.body);

    const team = await prisma.team.create({
      data: {
        name: body.name,
        companyId,
        rrConfig: {
          create: { mode: body.roundRobinMode },
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
        eventTypes: { select: { id: true, title: true, slug: true, active: true } },
      },
    });
    if (!team) return reply.status(404).send({ error: 'Team not found' });
    return team;
  });

  /** PATCH /api/admin/teams/:id — Update team */
  app.patch('/api/admin/teams/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = UpdateTeamSchema.parse(request.body);
    const team = await prisma.team.update({ where: { id }, data: body });
    return team;
  });

  /** DELETE /api/admin/teams/:id — Delete team */
  app.delete('/api/admin/teams/:id', async (request, reply) => {
    await prisma.team.delete({ where: { id: (request.params as { id: string }).id } });
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

  /** DELETE /api/admin/teams/:teamId/members/:userId — Remove team member */
  app.delete('/api/admin/teams/:teamId/members/:userId', async (request) => {
    const { teamId, userId } = request.params as { teamId: string; userId: string };
    await prisma.teamMembership.delete({
      where: { userId_teamId: { userId, teamId } },
    });
    return { success: true };
  });
}
