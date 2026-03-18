// backend/src/routes/admin/users.ts
import type { FastifyInstance } from 'fastify';
import { z } from 'zod/v4';
import { prisma } from '../../db.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { InviteUserSchema, UpdateMembershipRoleSchema, UpdateAvailabilitySchema, UpdateBookingNotesSchema, CreateBookingCommentSchema, UpdateBookingCommentSchema, UpdateBookingStatusSchema, UpdateMyStatusSchema, UpdateMyLanguageSchema, CreateVacationSchema } from '@calendfree/shared';
import { logAudit } from '../../services/audit-log.js';
import { cancelBookingNotifications } from '../../jobs/notification-jobs.js';
import { config } from '../../config.js';

const ErrorResponse = z.object({ error: z.string() });
const SuccessResponse = z.object({ success: z.boolean() });

export async function userRoutes(app: FastifyInstance) {
  /** GET /api/admin/companies/:companyId/users — List company members */
  app.get('/api/admin/companies/:companyId/users', {
    schema: {
      summary: 'List company members',
      description: 'Returns all members of a company with their roles, status, and Google connection state.',
      tags: ['Users'],
      security: [{ session: [] }, { apiKey: [] }],
      params: z.object({
        companyId: z.string().describe('Company ID'),
      }),
    },
    preHandler: [requireRole('USER', 'COMPANY_ADMIN', 'ORG_ADMIN')],
  }, async (request, reply) => {
    const { companyId } = request.params as { companyId: string };
    const user = request.session.user!;

    // Verify company belongs to the requesting user's organization
    const company = await prisma.company.findFirst({
      where: { id: companyId, organizationId: user.organizationId },
    });
    if (!company) return reply.status(404).send({ error: 'Company not found' });

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
  app.post('/api/admin/companies/:companyId/users', {
    schema: {
      summary: 'Invite user to company',
      description: 'Invites a user to a company by email. Creates the user if they do not exist yet.',
      tags: ['Users'],
      security: [{ session: [] }, { apiKey: [] }],
      params: z.object({
        companyId: z.string().describe('Company ID'),
      }),
      body: z.object({
        email: z.string().describe('User email address'),
        name: z.string().describe('User display name'),
        role: z.string().optional().describe('Role to assign (defaults to USER)'),
      }),
    },
    preHandler: [requireRole('COMPANY_ADMIN', 'ORG_ADMIN')],
  }, async (request, reply) => {
    const { companyId } = request.params as { companyId: string };
    const user = request.session.user!;
    const body = InviteUserSchema.parse(request.body);

    // Verify company belongs to the requesting user's organization
    const company = await prisma.company.findFirst({
      where: { id: companyId, organizationId: user.organizationId },
    });
    if (!company) return reply.status(404).send({ error: 'Company not found' });

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
  app.patch('/api/admin/companies/:companyId/users/:userId/role', {
    schema: {
      summary: 'Update user role',
      description: 'Updates the role of a user within a company. Requires ORG_ADMIN privileges.',
      tags: ['Users'],
      security: [{ session: [] }, { apiKey: [] }],
      params: z.object({
        companyId: z.string().describe('Company ID'),
        userId: z.string().describe('User ID'),
      }),
      body: z.object({
        role: z.string().describe('New role (USER, COMPANY_ADMIN, or ORG_ADMIN)'),
      }),
    },
    preHandler: [requireRole('ORG_ADMIN')],
  }, async (request) => {
    const { companyId, userId } = request.params as { companyId: string; userId: string };
    const body = UpdateMembershipRoleSchema.parse(request.body);
    return prisma.companyMembership.update({
      where: { userId_companyId: { userId, companyId } },
      data: { role: body.role },
    });
  });

  /** DELETE /api/admin/companies/:companyId/users/:userId — Remove user from company */
  app.delete('/api/admin/companies/:companyId/users/:userId', {
    schema: {
      summary: 'Remove user from company',
      description: 'Removes a user\'s membership from a company. Does not delete the user account.',
      tags: ['Users'],
      security: [{ session: [] }, { apiKey: [] }],
      params: z.object({
        companyId: z.string().describe('Company ID'),
        userId: z.string().describe('User ID'),
      }),
    },
    preHandler: [requireRole('COMPANY_ADMIN', 'ORG_ADMIN')],
  }, async (request) => {
    const { companyId, userId } = request.params as { companyId: string; userId: string };
    await prisma.companyMembership.delete({
      where: { userId_companyId: { userId, companyId } },
    });
    return { success: true };
  });

  /** GET /api/admin/users/:id — Full user detail */
  app.get('/api/admin/users/:id', {
    schema: {
      summary: 'Get user details',
      description: 'Returns full user details including Google connection status, company memberships, and team memberships.',
      tags: ['Users'],
      security: [{ session: [] }, { apiKey: [] }],
      params: z.object({
        id: z.string().describe('User ID'),
      }),
    },
    preHandler: [requireRole('COMPANY_ADMIN', 'ORG_ADMIN')],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const requestingUser = request.session.user!;
    const user = await prisma.user.findFirst({
      where: { id, organizationId: requestingUser.organizationId },
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
  app.patch('/api/admin/users/:id/status', {
    schema: {
      summary: 'Update user absence status',
      description: 'Sets a user\'s availability status to AVAILABLE or ABSENT with an optional return date.',
      tags: ['Users'],
      security: [{ session: [] }, { apiKey: [] }],
      params: z.object({
        id: z.string().describe('User ID'),
      }),
      body: z.object({
        status: z.enum(['AVAILABLE', 'ABSENT']).describe('New status'),
        absentUntil: z.string().optional().describe('Return date (ISO 8601) when status is ABSENT'),
      }),
    },
    preHandler: [requireRole('COMPANY_ADMIN', 'ORG_ADMIN')],
  }, async (request, reply) => {
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
  app.get('/api/admin/users/:id/bookings', {
    schema: {
      summary: 'Get user bookings',
      description: 'Returns upcoming confirmed bookings assigned to a specific user, limited to 50 results.',
      tags: ['Users'],
      security: [{ session: [] }, { apiKey: [] }],
      params: z.object({
        id: z.string().describe('User ID'),
      }),
    },
    preHandler: [requireRole('COMPANY_ADMIN', 'ORG_ADMIN')],
  }, async (request) => {
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
  app.delete('/api/admin/users/:id', {
    schema: {
      summary: 'Delete user',
      description: 'Permanently deletes a user account. Cannot delete yourself. Requires ORG_ADMIN privileges.',
      tags: ['Users'],
      security: [{ session: [] }, { apiKey: [] }],
      params: z.object({
        id: z.string().describe('User ID'),
      }),
    },
    preHandler: [requireRole('ORG_ADMIN')],
  }, async (request, reply) => {
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
  app.get('/api/me', {
    schema: {
      summary: 'Get current user profile',
      description: 'Returns the authenticated user\'s full profile including availability, Google connection status, company memberships, and team memberships.',
      tags: ['My Account'],
      security: [{ session: [] }, { apiKey: [] }],
    },
    preHandler: [requireAuth],
  }, async (request) => {
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
  app.patch('/api/me/availability', {
    schema: {
      summary: 'Update own availability',
      description: 'Updates the authenticated user\'s availability configuration including weekly schedule, booking limits, and holiday settings.',
      tags: ['My Account'],
      security: [{ session: [] }, { apiKey: [] }],
      body: z.object({
        weeklySchedule: z.record(z.string(), z.array(z.object({
          start: z.string().describe('Start time (HH:MM)'),
          end: z.string().describe('End time (HH:MM)'),
        }))).optional().describe('Bookable hours per weekday'),
        maxPerDay: z.number().nullable().optional().describe('Maximum bookings per day'),
        maxPerWeek: z.number().nullable().optional().describe('Maximum bookings per week'),
        blockedHolidays: z.array(z.string()).nullable().optional().describe('Blocked holiday dates (YYYY-MM-DD)'),
        holidayCountry: z.string().nullable().optional().describe('Country code for automatic holidays'),
        dateSpecificHours: z.record(z.string(), z.array(z.object({
          start: z.string(),
          end: z.string(),
        }))).nullable().optional().describe('Date-specific override hours'),
      }),
    },
    preHandler: [requireAuth],
  }, async (request) => {
    const user = request.session.user!;
    const body = UpdateAvailabilitySchema.parse(request.body);

    return prisma.availabilityConfig.upsert({
      where: { userId: user.id },
      update: body,
      create: { userId: user.id, ...body },
    });
  });

  /** Self-service status update — users can set their own availability status. */
  app.patch('/api/me/status', {
    schema: {
      summary: 'Update own status',
      description: 'Sets the authenticated user\'s availability status to AVAILABLE or ABSENT with an optional return date.',
      tags: ['My Account'],
      security: [{ session: [] }, { apiKey: [] }],
      body: z.object({
        status: z.enum(['AVAILABLE', 'ABSENT']).describe('New status'),
        absentUntil: z.string().nullable().optional().describe('Return date (ISO 8601) when status is ABSENT'),
      }),
    },
    preHandler: [requireAuth],
  }, async (request) => {
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
  app.get('/api/me/vacations', {
    schema: {
      summary: 'List my vacations',
      description: 'Returns all current and future vacation periods for the authenticated user.',
      tags: ['My Account'],
      security: [{ session: [] }, { apiKey: [] }],
    },
    preHandler: [requireAuth],
  }, async (request) => {
    const user = request.session.user!;
    return prisma.vacationPeriod.findMany({
      where: { userId: user.id, endDate: { gte: new Date() } },
      orderBy: { startDate: 'asc' },
    });
  });

  /** Create a vacation period. */
  app.post('/api/me/vacations', {
    schema: {
      summary: 'Create vacation period',
      description: 'Creates a new vacation period for the authenticated user. The user will be excluded from booking assignment during this period.',
      tags: ['My Account'],
      security: [{ session: [] }, { apiKey: [] }],
      body: z.object({
        startDate: z.string().describe('Start date (YYYY-MM-DD)'),
        endDate: z.string().describe('End date (YYYY-MM-DD)'),
        label: z.string().nullable().optional().describe('Optional label for the vacation'),
      }),
    },
    preHandler: [requireAuth],
  }, async (request) => {
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
  app.delete('/api/me/vacations/:id', {
    schema: {
      summary: 'Delete vacation period',
      description: 'Deletes a vacation period owned by the authenticated user.',
      tags: ['My Account'],
      security: [{ session: [] }, { apiKey: [] }],
      params: z.object({
        id: z.string().describe('Vacation period ID'),
      }),
    },
    preHandler: [requireAuth],
  }, async (request, reply) => {
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
  app.get('/api/me/bookings', {
    schema: {
      summary: 'List my bookings',
      description: 'Returns the authenticated user\'s own bookings, ordered by most recent first, limited to 50 results.',
      tags: ['My Account'],
      security: [{ session: [] }, { apiKey: [] }],
    },
    preHandler: [requireAuth],
  }, async (request) => {
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
  app.get('/api/me/bookings/team', {
    schema: {
      summary: 'List team bookings',
      description: 'Returns bookings for all teams the authenticated user belongs to (excluding the user\'s own bookings), limited to 100 results.',
      tags: ['My Account'],
      security: [{ session: [] }, { apiKey: [] }],
    },
    preHandler: [requireAuth],
  }, async (request) => {
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
  app.patch('/api/me/bookings/:id/notes', {
    schema: {
      summary: 'Update booking notes',
      description: 'Updates internal notes on a booking. The user must be the assigned user or a member of the booking\'s team.',
      tags: ['My Account'],
      security: [{ session: [] }, { apiKey: [] }],
      params: z.object({
        id: z.string().describe('Booking ID'),
      }),
      body: z.object({
        notes: z.string().describe('Internal notes content'),
      }),
    },
    preHandler: [requireAuth],
  }, async (request, reply) => {
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
  app.post('/api/me/bookings/:id/cancel', {
    schema: {
      summary: 'Cancel booking',
      description: 'Cancels a booking assigned to the authenticated user or their team. Deletes the associated calendar event and sends cancellation notifications.',
      tags: ['My Account'],
      security: [{ session: [] }, { apiKey: [] }],
      params: z.object({
        id: z.string().describe('Booking ID'),
      }),
    },
    preHandler: [requireAuth],
  }, async (request, reply) => {
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
  app.get('/api/me/bookings/:bookingId', {
    schema: {
      summary: 'Get booking details',
      description: 'Returns a single booking with full details including event type, form data, assigned user, and comments. The user must be the assigned user or a team member.',
      tags: ['My Account'],
      security: [{ session: [] }, { apiKey: [] }],
      params: z.object({
        bookingId: z.string().describe('Booking ID'),
      }),
    },
    preHandler: [requireAuth],
  }, async (request, reply) => {
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
  app.patch('/api/me/bookings/:bookingId/status', {
    schema: {
      summary: 'Update booking status',
      description: 'Changes the status of a booking (e.g. to COMPLETED or NO_SHOW). The user must be the assigned user or a team member.',
      tags: ['My Account'],
      security: [{ session: [] }, { apiKey: [] }],
      params: z.object({
        bookingId: z.string().describe('Booking ID'),
      }),
      body: z.object({
        status: z.enum(['COMPLETED', 'NO_SHOW']).describe('New booking status'),
      }),
    },
    preHandler: [requireAuth],
  }, async (request, reply) => {
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
  app.post('/api/me/bookings/:bookingId/comments', {
    schema: {
      summary: 'Create booking comment',
      description: 'Adds an internal comment to a booking. The user must be the assigned user or a team member.',
      tags: ['My Account'],
      security: [{ session: [] }, { apiKey: [] }],
      params: z.object({
        bookingId: z.string().describe('Booking ID'),
      }),
      body: z.object({
        content: z.string().describe('Comment text'),
      }),
    },
    preHandler: [requireAuth],
  }, async (request, reply) => {
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
  app.patch('/api/me/bookings/:bookingId/comments/:commentId', {
    schema: {
      summary: 'Edit booking comment',
      description: 'Updates a comment on a booking. Only the comment author can edit their own comments.',
      tags: ['My Account'],
      security: [{ session: [] }, { apiKey: [] }],
      params: z.object({
        bookingId: z.string().describe('Booking ID'),
        commentId: z.string().describe('Comment ID'),
      }),
      body: z.object({
        content: z.string().describe('Updated comment text'),
      }),
    },
    preHandler: [requireAuth],
  }, async (request, reply) => {
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
  app.delete('/api/me/bookings/:bookingId/comments/:commentId', {
    schema: {
      summary: 'Delete booking comment',
      description: 'Deletes a comment from a booking. Only the comment author can delete their own comments.',
      tags: ['My Account'],
      security: [{ session: [] }, { apiKey: [] }],
      params: z.object({
        bookingId: z.string().describe('Booking ID'),
        commentId: z.string().describe('Comment ID'),
      }),
    },
    preHandler: [requireAuth],
  }, async (request, reply) => {
    const user = request.session.user!;
    const { commentId } = request.params as { bookingId: string; commentId: string };

    const comment = await prisma.bookingComment.findUnique({ where: { id: commentId } });
    if (!comment) return reply.status(404).send({ error: 'Comment not found' });
    if (comment.userId !== user.id) return reply.status(403).send({ error: 'Can only delete own comments' });

    await prisma.bookingComment.delete({ where: { id: commentId } });
    return { success: true };
  });

  /** PATCH /api/me/timezone — Update own timezone */
  app.patch('/api/me/timezone', {
    schema: {
      summary: 'Update own timezone',
      description: 'Updates the authenticated user\'s timezone setting.',
      tags: ['My Account'],
      security: [{ session: [] }, { apiKey: [] }],
      body: z.object({
        timezone: z.string().describe('IANA timezone identifier (e.g. Europe/Berlin)'),
      }),
    },
    preHandler: [requireAuth],
  }, async (request) => {
    const user = request.session.user!;
    const { timezone } = request.body as { timezone: string };
    return prisma.user.update({ where: { id: user.id }, data: { timezone } });
  });

  /** PATCH /api/me/language — Update own language preference */
  app.patch('/api/me/language', {
    schema: {
      summary: 'Update own language',
      description: 'Updates the authenticated user\'s preferred language for the UI.',
      tags: ['My Account'],
      security: [{ session: [] }, { apiKey: [] }],
      body: z.object({
        language: z.enum(['en', 'de']).describe('Preferred language'),
      }),
    },
    preHandler: [requireAuth],
  }, async (request) => {
    const user = request.session.user!;
    const { language } = UpdateMyLanguageSchema.parse(request.body);
    await prisma.user.update({ where: { id: user.id }, data: { language } });
    request.session.user!.language = language;
    return { success: true, language };
  });
}
