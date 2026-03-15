// backend/src/routes/booking.ts
import type { FastifyInstance } from 'fastify';
import { randomBytes } from 'node:crypto';
import { addMinutes } from 'date-fns';
import { prisma } from '../db.js';
import { getAvailableSlots } from '../services/availability.js';
import { assignUser } from '../services/round-robin.js';
import { createCalendarEvent } from '../services/calendar.js';
import { logAudit } from '../services/audit-log.js';

export async function bookingRoutes(app: FastifyInstance) {
  /**
   * GET /api/booking/:companySlug/:eventTypeSlug/slots
   * Public endpoint — returns available time slots for a date range.
   */
  app.get('/api/booking/:companySlug/:eventTypeSlug/slots', async (request, reply) => {
    const { companySlug, eventTypeSlug } = request.params as {
      companySlug: string;
      eventTypeSlug: string;
    };
    const { date, timezone = 'Europe/Berlin' } = request.query as {
      date?: string;
      timezone?: string;
    };

    // Find company and event type
    const company = await prisma.company.findFirst({
      where: { slug: companySlug },
    });
    if (!company) {
      return reply.status(404).send({ error: 'Company not found' });
    }

    const eventType = await prisma.eventType.findFirst({
      where: { companyId: company.id, slug: eventTypeSlug, active: true },
    });
    if (!eventType) {
      return reply.status(404).send({ error: 'Event type not found' });
    }

    // Determine users: team event type or personal
    let userIds: string[];
    if (eventType.teamId) {
      const memberships = await prisma.teamMembership.findMany({
        where: { teamId: eventType.teamId },
        include: { user: { include: { googleTokens: true } } },
      });
      // Only include users with connected Google accounts
      userIds = memberships
        .filter((m) => m.user.googleTokens?.connected)
        .map((m) => m.userId);
    } else if (eventType.userId) {
      const user = await prisma.user.findUnique({
        where: { id: eventType.userId },
        include: { googleTokens: true },
      });
      if (!user?.googleTokens?.connected) {
        return reply.status(503).send({ error: 'Consultant calendar not available' });
      }
      userIds = [eventType.userId];
    } else {
      return reply.status(400).send({ error: 'Event type has no team or user assigned' });
    }

    if (userIds.length === 0) {
      return reply.send({ slots: [] });
    }

    // If a specific date is provided, return slots for that day
    // Otherwise return slots for the next 7 days
    const now = new Date();
    const dateRangeStart = date ? new Date(`${date}T00:00:00Z`) : now;
    const dateRangeEnd = date
      ? new Date(`${date}T23:59:59Z`)
      : new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const slots = await getAvailableSlots({
      eventTypeId: eventType.id,
      dateRangeStart,
      dateRangeEnd,
      userIds,
      customerTimezone: timezone,
    });

    return {
      slots: slots.map((s) => ({
        start: s.start.toISOString(),
        end: s.end.toISOString(),
      })),
    };
  });

  /**
   * POST /api/booking/:companySlug/:eventTypeSlug
   * Public endpoint — create a booking.
   */
  app.post('/api/booking/:companySlug/:eventTypeSlug', async (request, reply) => {
    const { companySlug, eventTypeSlug } = request.params as {
      companySlug: string;
      eventTypeSlug: string;
    };
    const body = request.body as {
      startTime: string;
      timezone?: string;
      name: string;
      email: string;
      formData?: Record<string, string>;
    };

    // Find company and event type
    const company = await prisma.company.findFirst({
      where: { slug: companySlug },
    });
    if (!company) {
      return reply.status(404).send({ error: 'Company not found' });
    }

    const eventType = await prisma.eventType.findFirst({
      where: { companyId: company.id, slug: eventTypeSlug, active: true },
    });
    if (!eventType) {
      return reply.status(404).send({ error: 'Event type not found' });
    }

    const startTime = new Date(body.startTime);
    const endTime = addMinutes(startTime, eventType.duration);
    const customerTimezone = body.timezone ?? 'Europe/Berlin';

    // Determine assigned user
    let assignedUserId: string;

    if (eventType.userId) {
      // Personal event type — direct assignment
      assignedUserId = eventType.userId;
    } else if (eventType.teamId) {
      // Team event type — round-robin assignment
      // Re-check availability for the specific slot
      const slots = await getAvailableSlots({
        eventTypeId: eventType.id,
        dateRangeStart: startTime,
        dateRangeEnd: endTime,
        userIds: (
          await prisma.teamMembership.findMany({
            where: { teamId: eventType.teamId },
            include: { user: { include: { googleTokens: true } } },
          })
        )
          .filter((m) => m.user.googleTokens?.connected)
          .map((m) => m.userId),
        customerTimezone,
      });

      const matchingSlot = slots.find(
        (s) => s.start.getTime() === startTime.getTime(),
      );

      if (!matchingSlot || matchingSlot.availableUserIds.length === 0) {
        return reply.status(409).send({ error: 'Slot is no longer available' });
      }

      const assignment = await assignUser(eventType.teamId, matchingSlot.availableUserIds);
      assignedUserId = assignment.userId;
    } else {
      return reply.status(400).send({ error: 'Event type has no team or user' });
    }

    // Generate secure booking token
    const bookingToken = randomBytes(32).toString('hex');

    // Create booking in DB
    const booking = await prisma.booking.create({
      data: {
        eventTypeId: eventType.id,
        assignedUserId,
        startTime,
        endTime,
        customerTimezone,
        bookingToken,
        tokenExpiresAt: startTime, // Cancel/reschedule links expire at meeting time
        formData: {
          create: {
            name: body.name,
            email: body.email,
            data: body.formData ?? {},
          },
        },
      },
      include: {
        assignedUser: { select: { name: true, email: true } },
      },
    });

    // Create Google Calendar event (non-blocking on failure)
    let meetLink: string | null = null;
    try {
      const calEvent = await createCalendarEvent({
        userId: assignedUserId,
        summary: `${eventType.title} — ${body.name}`,
        description: `Booked via Calendfree\n\nCustomer: ${body.name} (${body.email})`,
        startTime,
        endTime,
        attendeeEmail: body.email,
        attendeeName: body.name,
        autoMeetLink: eventType.autoMeetLink,
      });

      meetLink = calEvent.meetLink;
      await prisma.booking.update({
        where: { id: booking.id },
        data: { calendarEventId: calEvent.eventId },
      });
    } catch (err) {
      app.log.error(err, 'Failed to create calendar event, marking as pending');
      await prisma.booking.update({
        where: { id: booking.id },
        data: { status: 'PENDING_CALENDAR_SYNC' },
      });
    }

    logAudit({
      userId: assignedUserId,
      action: 'BOOKING_CREATED',
      details: { bookingId: booking.id, customerEmail: body.email },
    });

    const baseUrl = app.listeningOrigin || 'http://localhost:3001';

    return reply.status(201).send({
      id: booking.id,
      startTime: booking.startTime.toISOString(),
      endTime: booking.endTime.toISOString(),
      assignedUser: {
        name: booking.assignedUser.name,
        email: booking.assignedUser.email,
      },
      meetLink,
      cancelUrl: `${baseUrl}/manage/${bookingToken}/cancel`,
      rescheduleUrl: `${baseUrl}/manage/${bookingToken}/reschedule`,
    });
  });

  /**
   * POST /api/booking/:bookingToken/cancel
   * Public endpoint — cancel a booking via token.
   */
  app.post('/api/booking/:bookingToken/cancel', async (request, reply) => {
    const { bookingToken } = request.params as { bookingToken: string };

    const booking = await prisma.booking.findUnique({
      where: { bookingToken },
    });

    if (!booking) {
      return reply.status(404).send({ error: 'Booking not found' });
    }

    if (booking.status === 'CANCELLED') {
      return reply.status(400).send({ error: 'Booking already cancelled' });
    }

    if (booking.tokenExpiresAt && new Date() > booking.tokenExpiresAt) {
      return reply.status(410).send({ error: 'Cancel link has expired' });
    }

    // Delete calendar event if it exists
    if (booking.calendarEventId) {
      try {
        const { deleteCalendarEvent } = await import('../services/calendar.js');
        await deleteCalendarEvent(booking.assignedUserId, booking.calendarEventId);
      } catch (err) {
        app.log.error(err, 'Failed to delete calendar event');
      }
    }

    await prisma.booking.update({
      where: { id: booking.id },
      data: { status: 'CANCELLED' },
    });

    logAudit({
      userId: booking.assignedUserId,
      action: 'BOOKING_CANCELLED',
      details: { bookingId: booking.id },
    });

    return { success: true, message: 'Booking cancelled' };
  });
}
