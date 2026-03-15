// backend/src/routes/admin/users.ts
import type { FastifyInstance } from 'fastify';
import { prisma } from '../../db.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { InviteUserSchema, UpdateMembershipRoleSchema, UpdateAvailabilitySchema, UpdateBookingNotesSchema } from '@calendfree/shared';
import { logAudit } from '../../services/audit-log.js';
import { cancelBookingNotifications } from '../../jobs/notification-jobs.js';
import { config } from '../../config.js';

export async function userRoutes(app: FastifyInstance) {
  /** GET /api/admin/companies/:companyId/users — List company members */
  app.get('/api/admin/companies/:companyId/users', { preHandler: [requireRole('USER', 'COMPANY_ADMIN', 'ORG_ADMIN')] }, async (request) => {
    const { companyId } = request.params as { companyId: string };
    const memberships = await prisma.companyMembership.findMany({
      where: { companyId },
      include: {
        user: {
          include: { googleTokens: { select: { connected: true } } },
        },
      },
    });
    return memberships.map((m) => ({
      id: m.user.id,
      name: m.user.name,
      email: m.user.email,
      avatarUrl: m.user.avatarUrl,
      slug: m.user.slug,
      timezone: m.user.timezone,
      role: m.role,
      googleConnected: m.user.googleTokens?.connected ?? false,
    }));
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
        teamMemberships: { include: { team: { select: { id: true, name: true } } } },
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

  /** GET /api/me/bookings — Get own bookings */
  app.get('/api/me/bookings', { preHandler: [requireAuth] }, async (request) => {
    const user = request.session.user!;
    const bookings = await prisma.booking.findMany({
      where: { assignedUserId: user.id },
      include: {
        eventType: { select: { title: true, slug: true, duration: true, teamId: true, company: { select: { slug: true } } } },
        formData: { select: { name: true, email: true, data: true } },
      },
      orderBy: { startTime: 'desc' },
      take: 50,
    });
    return bookings;
  });

  /** GET /api/me/bookings/team — Get bookings for all teams the user is in */
  app.get('/api/me/bookings/team', { preHandler: [requireAuth] }, async (request) => {
    const user = request.session.user!;

    const teamMemberships = await prisma.teamMembership.findMany({
      where: { userId: user.id },
      select: { teamId: true },
    });
    const teamIds = teamMemberships.map((m) => m.teamId);

    if (teamIds.length === 0) return [];

    const bookings = await prisma.booking.findMany({
      where: {
        eventType: { teamId: { in: teamIds } },
        assignedUserId: { not: user.id },
      },
      include: {
        eventType: { select: { title: true, slug: true, duration: true, teamId: true, team: { select: { name: true } }, company: { select: { slug: true } } } },
        formData: { select: { name: true, email: true, data: true } },
        assignedUser: { select: { name: true, email: true } },
      },
      orderBy: { startTime: 'desc' },
      take: 100,
    });

    return bookings;
  });

  /** PATCH /api/me/bookings/:id/notes — Update internal notes (own or team booking) */
  app.patch('/api/me/bookings/:id/notes', { preHandler: [requireAuth] }, async (request, reply) => {
    const user = request.session.user!;
    const { id } = request.params as { id: string };
    const { notes } = UpdateBookingNotesSchema.parse(request.body);

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: { eventType: { select: { teamId: true } } },
    });

    if (!booking) {
      return reply.status(404).send({ error: 'Booking not found' });
    }

    let hasAccess = booking.assignedUserId === user.id;
    if (!hasAccess && booking.eventType.teamId) {
      const membership = await prisma.teamMembership.findUnique({
        where: { userId_teamId: { userId: user.id, teamId: booking.eventType.teamId } },
      });
      hasAccess = !!membership;
    }

    if (!hasAccess) {
      return reply.status(403).send({ error: 'Access denied' });
    }

    const updated = await prisma.booking.update({
      where: { id },
      data: { internalNotes: notes || null },
    });

    return { success: true, internalNotes: updated.internalNotes };
  });

  /** POST /api/me/bookings/:id/cancel — Cancel booking (own or team) */
  app.post('/api/me/bookings/:id/cancel', { preHandler: [requireAuth] }, async (request, reply) => {
    const user = request.session.user!;
    const { id } = request.params as { id: string };

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: { eventType: { select: { teamId: true } } },
    });

    if (!booking) {
      return reply.status(404).send({ error: 'Booking not found' });
    }

    if (booking.status === 'CANCELLED') {
      return reply.status(400).send({ error: 'Booking already cancelled' });
    }

    let hasAccess = booking.assignedUserId === user.id;
    if (!hasAccess && booking.eventType.teamId) {
      const membership = await prisma.teamMembership.findUnique({
        where: { userId_teamId: { userId: user.id, teamId: booking.eventType.teamId } },
      });
      hasAccess = !!membership;
    }

    if (!hasAccess) {
      return reply.status(403).send({ error: 'Access denied' });
    }

    if (booking.calendarEventId) {
      try {
        const { deleteCalendarEvent } = await import('../../services/calendar.js');
        await deleteCalendarEvent(booking.assignedUserId, booking.calendarEventId!);
      } catch (err) {
        app.log.error(err, 'Failed to delete calendar event');
      }
    }

    await prisma.booking.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    logAudit({
      userId: user.id,
      action: 'BOOKING_CANCELLED',
      details: { bookingId: id, cancelledBy: user.email },
    });

    if (config.NODE_ENV !== 'test') {
      try { await cancelBookingNotifications(id); } catch (err) { app.log.error(err, 'Failed to send cancellation notification'); }
    }

    return { success: true };
  });

  /** PATCH /api/me/timezone — Update own timezone */
  app.patch('/api/me/timezone', { preHandler: [requireAuth] }, async (request) => {
    const user = request.session.user!;
    const { timezone } = request.body as { timezone: string };
    return prisma.user.update({ where: { id: user.id }, data: { timezone } });
  });
}
