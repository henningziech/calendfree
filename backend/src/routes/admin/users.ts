// backend/src/routes/admin/users.ts
import type { FastifyInstance } from 'fastify';
import { prisma } from '../../db.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { InviteUserSchema, UpdateMembershipRoleSchema, UpdateAvailabilitySchema, UpdateBookingNotesSchema, CreateBookingCommentSchema, UpdateBookingCommentSchema, UpdateBookingStatusSchema, UpdateMyStatusSchema, CreateVacationSchema } from '@calendfree/shared';
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
      status: m.user.status,
      absentUntil: m.user.absentUntil,
      lastLoginAt: m.user.lastLoginAt,
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

  /** GET /api/admin/users/:id — Full user detail */
  app.get('/api/admin/users/:id', { preHandler: [requireRole('COMPANY_ADMIN', 'ORG_ADMIN')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        googleTokens: { select: { connected: true } },
        companyMemberships: { include: { company: { select: { id: true, name: true, slug: true } } } },
        teamMemberships: { include: { team: { select: { id: true, name: true } } } },
      },
    });
    if (!user) return reply.status(404).send({ error: 'User not found' });
    return user;
  });

  /** PATCH /api/admin/users/:id/status — Update user absence status */
  app.patch('/api/admin/users/:id/status', { preHandler: [requireRole('COMPANY_ADMIN', 'ORG_ADMIN')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { status, absentUntil } = request.body as { status: 'AVAILABLE' | 'ABSENT'; absentUntil?: string };

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return reply.status(404).send({ error: 'User not found' });

    const updated = await prisma.user.update({
      where: { id },
      data: {
        status,
        absentUntil: status === 'ABSENT' && absentUntil ? new Date(absentUntil) : null,
      },
    });

    return { success: true, status: updated.status, absentUntil: updated.absentUntil };
  });

  /** GET /api/admin/users/:id/bookings — Upcoming bookings for a user */
  app.get('/api/admin/users/:id/bookings', { preHandler: [requireRole('COMPANY_ADMIN', 'ORG_ADMIN')] }, async (request) => {
    const { id } = request.params as { id: string };
    const bookings = await prisma.booking.findMany({
      where: {
        assignedUserId: id,
        status: 'CONFIRMED',
        startTime: { gte: new Date() },
      },
      include: {
        eventType: { select: { title: true, slug: true, duration: true, teamId: true, team: { select: { name: true } }, company: { select: { slug: true } } } },
        formData: { select: { name: true, email: true, data: true } },
      },
      orderBy: { startTime: 'asc' },
      take: 50,
    });
    return bookings;
  });

  /** DELETE /api/admin/users/:id — Delete user (ORG_ADMIN only) */
  app.delete('/api/admin/users/:id', { preHandler: [requireRole('ORG_ADMIN')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const requestingUser = request.session.user!;

    if (id === requestingUser.id) {
      return reply.status(400).send({ error: 'Cannot delete yourself' });
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return reply.status(404).send({ error: 'User not found' });

    await prisma.user.delete({ where: { id } });

    logAudit({
      userId: requestingUser.id,
      action: 'SETTINGS_CHANGED',
      details: { action: 'USER_DELETED', deletedUserId: id, deletedUserEmail: user.email },
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

  /** Self-service status update — users can set their own availability status. */
  app.patch('/api/me/status', { preHandler: [requireAuth] }, async (request) => {
    const user = request.session.user!;
    const body = UpdateMyStatusSchema.parse(request.body);

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        status: body.status,
        absentUntil: body.status === 'ABSENT' && body.absentUntil
          ? new Date(body.absentUntil)
          : null,
      },
      select: { status: true, absentUntil: true },
    });

    return updated;
  });

  /** List my vacations (future + current only). */
  app.get('/api/me/vacations', { preHandler: [requireAuth] }, async (request) => {
    const user = request.session.user!;
    return prisma.vacationPeriod.findMany({
      where: { userId: user.id, endDate: { gte: new Date() } },
      orderBy: { startDate: 'asc' },
    });
  });

  /** Create a vacation period. */
  app.post('/api/me/vacations', { preHandler: [requireAuth] }, async (request) => {
    const user = request.session.user!;
    const body = CreateVacationSchema.parse(request.body);

    return prisma.vacationPeriod.create({
      data: {
        userId: user.id,
        startDate: new Date(body.startDate),
        endDate: new Date(body.endDate),
        label: body.label ?? null,
      },
    });
  });

  /** Delete a vacation period. */
  app.delete('/api/me/vacations/:id', { preHandler: [requireAuth] }, async (request, reply) => {
    const user = request.session.user!;
    const { id } = request.params as { id: string };

    const vacation = await prisma.vacationPeriod.findFirst({
      where: { id, userId: user.id },
    });
    if (!vacation) return reply.status(404).send({ error: 'Not found' });

    await prisma.vacationPeriod.delete({ where: { id } });
    return { success: true };
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
      where: {
        userId: user.id,
        team: { companyId: user.activeCompanyId },
      },
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

  /** Helper: Check if user has access to a booking (owner or team member) */
  async function checkBookingAccess(userId: string, bookingId: string) {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { eventType: { select: { teamId: true } } },
    });
    if (!booking) return { booking: null as any, hasAccess: false };

    let hasAccess = booking.assignedUserId === userId;
    if (!hasAccess && booking.eventType.teamId) {
      const membership = await prisma.teamMembership.findUnique({
        where: { userId_teamId: { userId, teamId: booking.eventType.teamId } },
      });
      hasAccess = !!membership;
    }
    return { booking, hasAccess };
  }

  /** GET /api/me/bookings/:bookingId — Single booking with comments */
  app.get('/api/me/bookings/:bookingId', { preHandler: [requireAuth] }, async (request, reply) => {
    const user = request.session.user!;
    const { bookingId } = request.params as { bookingId: string };

    const { booking, hasAccess } = await checkBookingAccess(user.id, bookingId);
    if (!booking) return reply.status(404).send({ error: 'Booking not found' });
    if (!hasAccess) return reply.status(403).send({ error: 'Access denied' });

    const full = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        eventType: { select: { title: true, slug: true, duration: true, teamId: true, team: { select: { name: true } }, company: { select: { slug: true } } } },
        formData: { select: { name: true, email: true, data: true } },
        assignedUser: { select: { id: true, name: true, email: true, avatarUrl: true } },
        comments: {
          include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    return full;
  });

  /** PATCH /api/me/bookings/:bookingId/status — Change booking status */
  app.patch('/api/me/bookings/:bookingId/status', { preHandler: [requireAuth] }, async (request, reply) => {
    const user = request.session.user!;
    const { bookingId } = request.params as { bookingId: string };
    const { status } = UpdateBookingStatusSchema.parse(request.body);

    const { booking, hasAccess } = await checkBookingAccess(user.id, bookingId);
    if (!booking) return reply.status(404).send({ error: 'Booking not found' });
    if (!hasAccess) return reply.status(403).send({ error: 'Access denied' });

    const updated = await prisma.booking.update({
      where: { id: bookingId },
      data: { status },
    });

    return { success: true, status: updated.status };
  });

  /** POST /api/me/bookings/:bookingId/comments — Create comment */
  app.post('/api/me/bookings/:bookingId/comments', { preHandler: [requireAuth] }, async (request, reply) => {
    const user = request.session.user!;
    const { bookingId } = request.params as { bookingId: string };
    const { content } = CreateBookingCommentSchema.parse(request.body);

    const { booking, hasAccess } = await checkBookingAccess(user.id, bookingId);
    if (!booking) return reply.status(404).send({ error: 'Booking not found' });
    if (!hasAccess) return reply.status(403).send({ error: 'Access denied' });

    const comment = await prisma.bookingComment.create({
      data: { bookingId, userId: user.id, content },
      include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
    });

    return reply.status(201).send(comment);
  });

  /** PATCH /api/me/bookings/:bookingId/comments/:commentId — Edit own comment */
  app.patch('/api/me/bookings/:bookingId/comments/:commentId', { preHandler: [requireAuth] }, async (request, reply) => {
    const user = request.session.user!;
    const { commentId } = request.params as { bookingId: string; commentId: string };
    const { content } = UpdateBookingCommentSchema.parse(request.body);

    const comment = await prisma.bookingComment.findUnique({ where: { id: commentId } });
    if (!comment) return reply.status(404).send({ error: 'Comment not found' });
    if (comment.userId !== user.id) return reply.status(403).send({ error: 'Can only edit own comments' });

    const updated = await prisma.bookingComment.update({
      where: { id: commentId },
      data: { content },
      include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
    });

    return updated;
  });

  /** DELETE /api/me/bookings/:bookingId/comments/:commentId — Delete own comment */
  app.delete('/api/me/bookings/:bookingId/comments/:commentId', { preHandler: [requireAuth] }, async (request, reply) => {
    const user = request.session.user!;
    const { commentId } = request.params as { bookingId: string; commentId: string };

    const comment = await prisma.bookingComment.findUnique({ where: { id: commentId } });
    if (!comment) return reply.status(404).send({ error: 'Comment not found' });
    if (comment.userId !== user.id) return reply.status(403).send({ error: 'Can only delete own comments' });

    await prisma.bookingComment.delete({ where: { id: commentId } });
    return { success: true };
  });

  /** PATCH /api/me/timezone — Update own timezone */
  app.patch('/api/me/timezone', { preHandler: [requireAuth] }, async (request) => {
    const user = request.session.user!;
    const { timezone } = request.body as { timezone: string };
    return prisma.user.update({ where: { id: user.id }, data: { timezone } });
  });
}
