// backend/src/routes/booking.ts
import type { FastifyInstance } from 'fastify';
import { z } from 'zod/v4';
import { randomBytes } from 'node:crypto';
import { addMinutes } from 'date-fns';
import { prisma } from '../db.js';
import { Prisma } from '@prisma/client';
import { config } from '../config.js';
import { getAvailableSlots } from '../services/availability.js';
import { assignUser } from '../services/round-robin.js';
import { createCalendarEvent } from '../services/calendar.js';
import { logAudit } from '../services/audit-log.js';
import { scheduleBookingNotifications, cancelBookingNotifications } from '../jobs/notification-jobs.js';
import { queueHubSpotSync } from '../jobs/hubspot-jobs.js';

const ErrorResponse = z.object({ error: z.string() });

export async function bookingRoutes(app: FastifyInstance) {
  /**
   * GET /api/booking/:companySlug/:eventTypeSlug/slots
   * Public endpoint — returns available time slots for a date range.
   */
  app.get('/api/booking/:companySlug/:eventTypeSlug/slots', {
    schema: {
      summary: 'Get available time slots',
      description: 'Returns available booking slots for an event type. If a specific date is provided, returns slots for that day; otherwise returns slots for the next 7 days.',
      tags: ['Bookings'],
      security: [],
      params: z.object({
        companySlug: z.string().describe('Company URL slug'),
        eventTypeSlug: z.string().describe('Event type URL slug'),
      }),
      querystring: z.object({
        date: z.string().optional().describe('Date in YYYY-MM-DD format'),
        timezone: z.string().optional().describe('IANA timezone (defaults to Europe/Berlin)'),
      }),
    },
  }, async (request, reply) => {
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
        ...(eventType.showRemainingSpots && s.remainingSpots !== undefined
          ? { remainingSpots: s.remainingSpots }
          : {}),
      })),
    };
  });

  /**
   * POST /api/booking/:companySlug/:eventTypeSlug
   * Public endpoint — create a booking.
   */
  app.post('/api/booking/:companySlug/:eventTypeSlug', {
    schema: {
      summary: 'Create a booking',
      description: 'Books a time slot for the specified event type. Assigns a consultant via round-robin for team events or directly for personal event types.',
      tags: ['Bookings'],
      security: [],
      params: z.object({
        companySlug: z.string().describe('Company URL slug'),
        eventTypeSlug: z.string().describe('Event type URL slug'),
      }),
      body: z.object({
        startTime: z.string().describe('Desired start time (ISO 8601)'),
        timezone: z.string().optional().describe('Customer IANA timezone (defaults to Europe/Berlin)'),
        name: z.string().describe('Customer full name'),
        email: z.string().describe('Customer email address'),
        comment: z.string().optional().describe('Optional comment from the customer'),
        formData: z.record(z.string(), z.string()).optional().describe('Additional form field values'),
      }),
    },
  }, async (request, reply) => {
    const { companySlug, eventTypeSlug } = request.params as {
      companySlug: string;
      eventTypeSlug: string;
    };
    const body = request.body as {
      startTime: string;
      timezone?: string;
      name: string;
      email: string;
      comment?: string;
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

    // GROUP event type — concurrency-safe booking with max invitees
    if (eventType.eventCategory === 'GROUP') {
      const maxInvitees = eventType.maxInvitees;

      let booking;
      try {
        booking = await prisma.$transaction(async (tx) => {
          // Count existing bookings for this exact slot
          const existingCount = await tx.booking.count({
            where: {
              eventTypeId: eventType.id,
              startTime: new Date(body.startTime),
              status: { in: ['CONFIRMED', 'PENDING_CALENDAR_SYNC'] },
            },
          });

          if (maxInvitees && existingCount >= maxInvitees) {
            throw new Error('SLOT_FULL');
          }

          // Create booking assigned to the event type's userId (the host)
          return tx.booking.create({
            data: {
              eventTypeId: eventType.id,
              assignedUserId: eventType.userId!,
              startTime,
              endTime,
              customerTimezone,
              bookingToken: randomBytes(32).toString('hex'),
              tokenExpiresAt: new Date(startTime),
              formData: {
                create: {
                  name: body.name,
                  email: body.email,
                  data: { ...body.formData, ...(body.comment ? { _comment: body.comment } : {}) },
                },
              },
            },
            include: {
              formData: true,
              assignedUser: { select: { name: true, email: true } },
            },
          });
        }, {
          isolationLevel: 'Serializable',
          maxWait: 5000,
          timeout: 10000,
        });
      } catch (err: any) {
        if (err.message === 'SLOT_FULL') {
          return reply.status(409).send({ error: 'This time slot is fully booked' });
        }
        throw err;
      }

      // Create Google Calendar event (non-blocking on failure)
      let meetLink: string | null = null;
      try {
        const calEvent = await createCalendarEvent({
          userId: eventType.userId!,
          summary: `${eventType.title} — ${body.name}`,
          description: `Booked via Calendfree\n\nCustomer: ${body.name} (${body.email})${body.comment ? `\n\nKommentar: ${body.comment}` : ''}`,
          startTime,
          endTime,
          attendeeEmail: body.email,
          attendeeName: body.name,
          autoMeetLink: eventType.autoMeetLink,
        });

        meetLink = calEvent.meetLink;
        await prisma.booking.update({
          where: { id: booking.id },
          data: { calendarEventId: calEvent.eventId, meetLink: calEvent.meetLink },
        });
      } catch (err) {
        app.log.error(err, 'Failed to create calendar event for GROUP booking, marking as pending');
        await prisma.booking.update({
          where: { id: booking.id },
          data: { status: 'PENDING_CALENDAR_SYNC' },
        });
      }

      logAudit({
        userId: eventType.userId!,
        action: 'BOOKING_CREATED',
        details: { bookingId: booking.id, customerEmail: body.email, eventCategory: 'GROUP' },
      });

      // Schedule notification emails (non-blocking on failure)
      if (config.NODE_ENV !== 'test') {
        try {
          await scheduleBookingNotifications({
            bookingId: booking.id,
            eventTypeId: eventType.id,
            startTime,
            endTime,
          });
        } catch (err) {
          app.log.error(err, 'Failed to schedule notifications');
        }

        try { await queueHubSpotSync(booking.id); } catch (err) { app.log.error(err, 'Failed to queue HubSpot sync'); }
      }

      const baseUrl = config.FRONTEND_URL;

      return reply.status(201).send({
        id: booking.id,
        startTime: booking.startTime.toISOString(),
        endTime: booking.endTime.toISOString(),
        assignedUser: {
          name: booking.assignedUser.name,
          email: booking.assignedUser.email,
        },
        meetLink,
        cancelUrl: `${baseUrl}/manage/${booking.bookingToken}/cancel`,
        rescheduleUrl: `${baseUrl}/manage/${booking.bookingToken}/reschedule`,
      });
    }

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

      const assignment = await assignUser(eventType.teamId, matchingSlot.availableUserIds, eventType.roundRobinMode);
      assignedUserId = assignment.userId;
    } else {
      return reply.status(400).send({ error: 'Event type has no team or user' });
    }

    // Generate secure booking token
    const bookingToken = randomBytes(32).toString('hex');

    // Create booking in DB with conflict check (prevents double-booking)
    let booking;
    try {
      booking = await prisma.$transaction(async (tx) => {
        // Re-check for conflicting bookings inside the transaction
        const conflicting = await tx.booking.count({
          where: {
            assignedUserId,
            status: { in: ['CONFIRMED', 'PENDING_CALENDAR_SYNC'] },
            startTime: { lt: endTime },
            endTime: { gt: startTime },
          },
        });
        if (conflicting > 0) {
          throw new Error('SLOT_TAKEN');
        }

        return tx.booking.create({
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
                data: { ...body.formData, ...(body.comment ? { _comment: body.comment } : {}) },
              },
            },
          },
          include: {
            assignedUser: { select: { name: true, email: true } },
          },
        });
      }, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 5000,
      });
    } catch (err: any) {
      if (err.message === 'SLOT_TAKEN' || err.code === 'P2034') {
        return reply.status(409).send({ error: 'Slot is no longer available' });
      }
      throw err;
    }

    // Create Google Calendar event (non-blocking on failure)
    let meetLink: string | null = null;
    try {
      const calEvent = await createCalendarEvent({
        userId: assignedUserId,
        summary: `${eventType.title} — ${body.name}`,
        description: `Booked via Calendfree\n\nCustomer: ${body.name} (${body.email})${body.comment ? `\n\nKommentar: ${body.comment}` : ''}`,
        startTime,
        endTime,
        attendeeEmail: body.email,
        attendeeName: body.name,
        autoMeetLink: eventType.autoMeetLink,
      });

      meetLink = calEvent.meetLink;
      await prisma.booking.update({
        where: { id: booking.id },
        data: { calendarEventId: calEvent.eventId, meetLink: calEvent.meetLink },
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

    // Schedule notification emails (non-blocking on failure)
    if (config.NODE_ENV !== 'test') {
      try {
        await scheduleBookingNotifications({
          bookingId: booking.id,
          eventTypeId: eventType.id,
          startTime,
          endTime,
        });
      } catch (err) {
        app.log.error(err, 'Failed to schedule notifications');
      }

      try { await queueHubSpotSync(booking.id); } catch (err) { app.log.error(err, 'Failed to queue HubSpot sync'); }
    }

    const baseUrl = config.FRONTEND_URL;

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
   * GET /api/booking/:bookingToken
   * Public endpoint — get booking details + company branding via token.
   */
  app.get('/api/booking/:bookingToken', {
    schema: {
      summary: 'Get booking details',
      description: 'Retrieves booking details including event type, assigned consultant, customer info, and company branding by booking token.',
      tags: ['Bookings'],
      security: [],
      params: z.object({
        bookingToken: z.string().describe('Unique booking token'),
      }),
    },
  }, async (request, reply) => {
    const { bookingToken } = request.params as { bookingToken: string };

    const booking = await prisma.booking.findUnique({
      where: { bookingToken },
      include: {
        eventType: {
          include: {
            company: {
              include: {
                branding: true,
                organization: { include: { branding: true } },
              },
            },
          },
        },
        assignedUser: { select: { name: true, email: true } },
        formData: { select: { name: true, email: true } },
      },
    });

    if (!booking) {
      return reply.status(404).send({ error: 'Booking not found' });
    }

    const company = booking.eventType.company;
    const branding = company?.branding ?? company?.organization?.branding;

    return {
      id: booking.id,
      startTime: booking.startTime.toISOString(),
      endTime: booking.endTime.toISOString(),
      status: booking.status,
      eventType: {
        title: booking.eventType.title,
        duration: booking.eventType.duration,
      },
      assignedUser: booking.assignedUser,
      customer: booking.formData ? {
        name: booking.formData.name,
        email: booking.formData.email,
      } : null,
      company: company ? {
        name: company.name,
        slug: company.slug,
      } : null,
      branding: branding ? {
        primaryColor: branding.primaryColor,
        accentColor: branding.accentColor,
        backgroundColor: branding.backgroundColor,
        textColor: branding.textColor,
        logoUrl: branding.logoUrl,
        fontFamily: branding.fontFamily,
        showPoweredBy: branding.showPoweredBy,
        footerText: branding.footerText,
      } : null,
    };
  });

  /**
   * POST /api/booking/:bookingToken/cancel
   * Public endpoint — cancel a booking via token.
   */
  app.post('/api/booking/:bookingToken/cancel', {
    schema: {
      summary: 'Cancel a booking',
      description: 'Cancels an existing booking via its token. Removes the associated calendar event and sends cancellation notifications.',
      tags: ['Bookings'],
      security: [],
      params: z.object({
        bookingToken: z.string().describe('Unique booking token'),
      }),
    },
  }, async (request, reply) => {
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

    // Send cancellation notification (non-blocking on failure)
    if (config.NODE_ENV !== 'test') {
      try {
        await cancelBookingNotifications(booking.id);
      } catch (err) {
        app.log.error(err, 'Failed to send cancellation notification');
      }
    }

    return { success: true, message: 'Booking cancelled' };
  });

  /** GET /api/booking/:companySlug/info — Public company info (branding) */
  app.get('/api/booking/:companySlug/info', {
    schema: {
      summary: 'Get company info and branding',
      description: 'Returns public company information and branding settings for the booking page. Falls back to organization-level branding if no company branding is set.',
      tags: ['Bookings'],
      security: [],
      params: z.object({
        companySlug: z.string().describe('Company URL slug'),
      }),
    },
  }, async (request, reply) => {
    const { companySlug } = request.params as { companySlug: string };
    const company = await prisma.company.findFirst({
      where: { slug: companySlug },
      include: {
        branding: true,
        organization: { include: { branding: true } },
      },
    });
    if (!company) return reply.status(404).send({ error: 'Company not found' });

    // Use company branding, fall back to org branding
    const branding = company.branding ?? company.organization.branding;

    return {
      name: company.name,
      slug: company.slug,
      language: company.language,
      branding: branding ? {
        primaryColor: branding.primaryColor,
        accentColor: branding.accentColor,
        backgroundColor: branding.backgroundColor,
        textColor: branding.textColor,
        logoUrl: branding.logoUrl,
        fontFamily: branding.fontFamily,
        showPoweredBy: branding.showPoweredBy,
        footerText: branding.footerText,
      } : null,
    };
  });

  /** GET /api/booking/:companySlug/:eventTypeSlug/info — Public event type info */
  app.get('/api/booking/:companySlug/:eventTypeSlug/info', {
    schema: {
      summary: 'Get event type info',
      description: 'Returns public event type details including title, duration, form fields, and team name for the booking page.',
      tags: ['Bookings'],
      security: [],
      params: z.object({
        companySlug: z.string().describe('Company URL slug'),
        eventTypeSlug: z.string().describe('Event type URL slug'),
      }),
    },
  }, async (request, reply) => {
    const { companySlug, eventTypeSlug } = request.params as { companySlug: string; eventTypeSlug: string };

    const company = await prisma.company.findFirst({ where: { slug: companySlug } });
    if (!company) return reply.status(404).send({ error: 'Company not found' });

    const eventType = await prisma.eventType.findFirst({
      where: { companyId: company.id, slug: eventTypeSlug, active: true },
      include: {
        formFields: { orderBy: { order: 'asc' } },
        team: { select: { name: true } },
      },
    });
    if (!eventType) return reply.status(404).send({ error: 'Event type not found' });

    return {
      title: eventType.title,
      slug: eventType.slug,
      description: eventType.description,
      duration: eventType.duration,
      color: eventType.color,
      teamName: eventType.team?.name ?? null,
      formFields: eventType.formFields,
      allowComment: eventType.allowComment,
    };
  });
}
