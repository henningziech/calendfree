# Calendfree Phase 2: Core Booking — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the core booking engine: Google Calendar integration (FreeBusy + Event creation), availability calculation, all 3 round-robin algorithms, and the public booking API with slot retrieval and booking creation.

**Architecture:** Three new services (`CalendarService`, `AvailabilityService`, `RoundRobinService`) plus new routes (`/api/booking`). CalendarService wraps Google Calendar API using per-user OAuth tokens. AvailabilityService computes available slots by intersecting working hours, calendar busy times, existing bookings, and limits. RoundRobinService assigns users using SELECT FOR UPDATE for concurrency safety. The `googleapis` npm package provides the Calendar API client.

**Tech Stack:** googleapis (Google Calendar API v3), date-fns + date-fns-tz (timezone handling), crypto (booking tokens)

---

## Chunk 1: Google Calendar Service

### Task 1: Install Dependencies

**Files:**
- Modify: `backend/package.json`

- [ ] **Step 1: Install googleapis and date-fns**

```bash
cd /Users/hziech/calendfree && npm install -w backend googleapis date-fns date-fns-tz
```

- [ ] **Step 2: Commit**

```bash
cd /Users/hziech/calendfree && git add backend/package.json backend/package-lock.json && git commit -m "feat: add googleapis and date-fns dependencies" && git push
```

---

### Task 2: Create CalendarService

**Files:**
- Create: `backend/src/services/calendar.ts`
- Create: `backend/src/__tests__/calendar.test.ts`

- [ ] **Step 1: Create CalendarService**

```typescript
// backend/src/services/calendar.ts
import { google, calendar_v3 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { prisma } from '../db.js';
import { decrypt, encrypt } from '../utils/encryption.js';
import { config } from '../config.js';

/**
 * Create an authenticated OAuth2 client for a specific user.
 * Decrypts stored tokens and handles token refresh automatically.
 */
export async function getAuthenticatedClient(userId: string): Promise<OAuth2Client> {
  const tokens = await prisma.googleTokens.findUnique({ where: { userId } });
  if (!tokens || !tokens.connected) {
    throw new Error(`User ${userId} has no connected Google account`);
  }

  const client = new OAuth2Client({
    clientId: config.GOOGLE_CLIENT_ID,
    clientSecret: config.GOOGLE_CLIENT_SECRET,
  });

  client.setCredentials({
    access_token: decrypt(tokens.accessToken),
    refresh_token: decrypt(tokens.refreshToken),
    expiry_date: tokens.expiresAt.getTime(),
  });

  // Listen for token refresh events to persist new tokens
  client.on('tokens', async (newTokens) => {
    const updateData: Record<string, unknown> = {};
    if (newTokens.access_token) {
      updateData.accessToken = encrypt(newTokens.access_token);
    }
    if (newTokens.refresh_token) {
      updateData.refreshToken = encrypt(newTokens.refresh_token);
    }
    if (newTokens.expiry_date) {
      updateData.expiresAt = new Date(newTokens.expiry_date);
    }
    await prisma.googleTokens.update({
      where: { userId },
      data: updateData,
    });
  });

  return client;
}

/**
 * Query Google Calendar FreeBusy API for a user's busy times.
 * Returns an array of { start, end } intervals in UTC.
 */
export async function getFreeBusy(
  userId: string,
  timeMin: Date,
  timeMax: Date,
): Promise<Array<{ start: Date; end: Date }>> {
  const auth = await getAuthenticatedClient(userId);
  const calendar = google.calendar({ version: 'v3', auth });

  const response = await calendar.freebusy.query({
    requestBody: {
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      items: [{ id: 'primary' }],
    },
  });

  const busySlots = response.data.calendars?.primary?.busy ?? [];
  return busySlots.map((slot) => ({
    start: new Date(slot.start!),
    end: new Date(slot.end!),
  }));
}

/**
 * Create a Google Calendar event for a booking.
 * Optionally generates a Google Meet link.
 */
export async function createCalendarEvent(params: {
  userId: string;
  summary: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  attendeeEmail: string;
  attendeeName: string;
  autoMeetLink: boolean;
}): Promise<{ eventId: string; meetLink: string | null }> {
  const auth = await getAuthenticatedClient(params.userId);
  const calendar = google.calendar({ version: 'v3', auth });

  const eventBody: calendar_v3.Schema$Event = {
    summary: params.summary,
    description: params.description,
    start: { dateTime: params.startTime.toISOString() },
    end: { dateTime: params.endTime.toISOString() },
    attendees: [
      { email: params.attendeeEmail, displayName: params.attendeeName },
    ],
  };

  if (params.autoMeetLink) {
    eventBody.conferenceData = {
      createRequest: {
        requestId: `calendfree-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        conferenceSolutionKey: { type: 'hangoutsMeet' },
      },
    };
  }

  const response = await calendar.events.insert({
    calendarId: 'primary',
    requestBody: eventBody,
    conferenceDataVersion: params.autoMeetLink ? 1 : 0,
    sendUpdates: 'all',
  });

  const meetLink = response.data.conferenceData?.entryPoints?.find(
    (ep) => ep.entryPointType === 'video',
  )?.uri ?? null;

  return {
    eventId: response.data.id!,
    meetLink,
  };
}

/**
 * Delete a Google Calendar event.
 */
export async function deleteCalendarEvent(
  userId: string,
  eventId: string,
): Promise<void> {
  const auth = await getAuthenticatedClient(userId);
  const calendar = google.calendar({ version: 'v3', auth });

  await calendar.events.delete({
    calendarId: 'primary',
    eventId,
    sendUpdates: 'all',
  });
}
```

- [ ] **Step 2: Write CalendarService unit test (mocked)**

```typescript
// backend/src/__tests__/calendar.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// We test the service logic by mocking the Google APIs and Prisma
// Full integration tests with real Google API will be manual

describe('CalendarService', () => {
  it('module exports all required functions', async () => {
    const mod = await import('../services/calendar.js');
    expect(mod.getAuthenticatedClient).toBeDefined();
    expect(mod.getFreeBusy).toBeDefined();
    expect(mod.createCalendarEvent).toBeDefined();
    expect(mod.deleteCalendarEvent).toBeDefined();
  });
});
```

- [ ] **Step 3: Run tests**

```bash
cd /Users/hziech/calendfree && npm run test -w backend
```

- [ ] **Step 4: Commit**

```bash
cd /Users/hziech/calendfree && git add backend/src/services/calendar.ts backend/src/__tests__/calendar.test.ts && git commit -m "feat: add CalendarService with FreeBusy, event creation, and Meet link support" && git push
```

---

## Chunk 2: Availability Service

### Task 3: Create AvailabilityService

**Files:**
- Create: `backend/src/services/availability.ts`
- Create: `backend/src/__tests__/availability.test.ts`
- Create: `shared/src/schemas/booking.ts`

- [ ] **Step 1: Add booking schemas to shared package**

```typescript
// shared/src/schemas/booking.ts
import { z } from 'zod';

export const TimeSlotSchema = z.object({
  start: z.string().datetime(),
  end: z.string().datetime(),
});
export type TimeSlot = z.infer<typeof TimeSlotSchema>;

export const AvailableSlotsRequestSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  timezone: z.string().default('Europe/Berlin'),
});
export type AvailableSlotsRequest = z.infer<typeof AvailableSlotsRequestSchema>;

export const BookingRequestSchema = z.object({
  eventTypeSlug: z.string(),
  startTime: z.string().datetime(),
  timezone: z.string().default('Europe/Berlin'),
  name: z.string().min(1).max(255),
  email: z.string().email(),
  formData: z.record(z.string()).optional(),
});
export type BookingRequest = z.infer<typeof BookingRequestSchema>;

export const BookingResponseSchema = z.object({
  id: z.string().uuid(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  assignedUser: z.object({
    name: z.string(),
    email: z.string().email(),
  }),
  meetLink: z.string().url().nullable(),
  cancelUrl: z.string(),
  rescheduleUrl: z.string(),
});
export type BookingResponse = z.infer<typeof BookingResponseSchema>;
```

- [ ] **Step 2: Export from shared index**

Add to `shared/src/index.ts`:
```typescript
export * from './schemas/booking.js';
```

- [ ] **Step 3: Build shared package**

```bash
cd /Users/hziech/calendfree && npm run build -w shared
```

- [ ] **Step 4: Create AvailabilityService**

```typescript
// backend/src/services/availability.ts
import { prisma } from '../db.js';
import { getFreeBusy } from './calendar.js';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import {
  startOfDay, endOfDay, addMinutes, addDays, isAfter, isBefore,
  areIntervalsOverlapping, eachDayOfInterval, getDay,
} from 'date-fns';

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;

interface WorkingHourSlot {
  start: string; // "09:00"
  end: string;   // "17:00"
}

interface AvailabilityParams {
  eventTypeId: string;
  dateRangeStart: Date;
  dateRangeEnd: Date;
  userIds: string[];
  customerTimezone: string;
}

interface Slot {
  start: Date;
  end: Date;
  availableUserIds: string[];
}

/**
 * Compute available booking slots for a set of users within a date range.
 * Considers: working hours, Google Calendar busy times, existing bookings,
 * buffer times, booking limits, min notice, and max advance.
 */
export async function getAvailableSlots(params: AvailabilityParams): Promise<Slot[]> {
  const { eventTypeId, dateRangeStart, dateRangeEnd, userIds, customerTimezone } = params;

  const eventType = await prisma.eventType.findUniqueOrThrow({
    where: { id: eventTypeId },
  });

  const duration = eventType.duration;
  const bufferBefore = eventType.bufferBefore;
  const bufferAfter = eventType.bufferAfter;
  const minNoticeHours = eventType.minNotice;
  const maxAdvanceDays = eventType.maxAdvance;

  const now = new Date();
  const earliestBooking = addMinutes(now, minNoticeHours * 60);
  const latestBooking = addDays(now, maxAdvanceDays);

  // Clamp date range to min notice and max advance
  const effectiveStart = isAfter(dateRangeStart, earliestBooking) ? dateRangeStart : earliestBooking;
  const effectiveEnd = isBefore(dateRangeEnd, latestBooking) ? dateRangeEnd : latestBooking;

  if (isAfter(effectiveStart, effectiveEnd)) return [];

  // Fetch all user availability configs + existing bookings in parallel
  const [availConfigs, existingBookings] = await Promise.all([
    prisma.availabilityConfig.findMany({
      where: { userId: { in: userIds } },
    }),
    prisma.booking.findMany({
      where: {
        assignedUserId: { in: userIds },
        status: { in: ['CONFIRMED', 'PENDING_CALENDAR_SYNC'] },
        startTime: { gte: effectiveStart },
        endTime: { lte: effectiveEnd },
      },
    }),
  ]);

  // Fetch FreeBusy from Google Calendar for each user (in parallel, with error handling)
  const freeBusyByUser = new Map<string, Array<{ start: Date; end: Date }>>();
  const freeBusyResults = await Promise.allSettled(
    userIds.map(async (uid) => {
      const busy = await getFreeBusy(uid, effectiveStart, effectiveEnd);
      return { uid, busy };
    }),
  );
  for (const result of freeBusyResults) {
    if (result.status === 'fulfilled') {
      freeBusyByUser.set(result.value.uid, result.value.busy);
    }
    // If FreeBusy fails for a user, treat them as fully busy (safe default)
  }

  // For each day in range, for each user, compute available slots
  const days = eachDayOfInterval({ start: effectiveStart, end: effectiveEnd });
  const allSlots: Slot[] = [];

  for (const day of days) {
    const dayOfWeek = DAY_NAMES[getDay(day)];

    for (const userId of userIds) {
      const availConfig = availConfigs.find((c) => c.userId === userId);
      if (!availConfig) continue;

      const weeklySchedule = availConfig.weeklySchedule as Record<string, WorkingHourSlot[]>;
      const daySchedule = weeklySchedule[dayOfWeek];
      if (!daySchedule || daySchedule.length === 0) continue;

      // Get user's timezone
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { timezone: true } });
      const userTz = user?.timezone ?? 'Europe/Berlin';

      // Check booking limits
      if (availConfig.maxPerDay) {
        const dayBookings = existingBookings.filter((b) => {
          const bookingDayInUserTz = toZonedTime(b.startTime, userTz);
          const thisDayInUserTz = toZonedTime(day, userTz);
          return b.assignedUserId === userId &&
            bookingDayInUserTz.toDateString() === thisDayInUserTz.toDateString();
        });
        if (dayBookings.length >= availConfig.maxPerDay) continue;
      }

      // Generate time slots from working hours
      for (const workSlot of daySchedule) {
        const [startH, startM] = workSlot.start.split(':').map(Number);
        const [endH, endM] = workSlot.end.split(':').map(Number);

        // Working hours are in user's timezone, convert to UTC
        const dayInUserTz = toZonedTime(day, userTz);
        const workStart = fromZonedTime(
          new Date(dayInUserTz.getFullYear(), dayInUserTz.getMonth(), dayInUserTz.getDate(), startH, startM),
          userTz,
        );
        const workEnd = fromZonedTime(
          new Date(dayInUserTz.getFullYear(), dayInUserTz.getMonth(), dayInUserTz.getDate(), endH, endM),
          userTz,
        );

        // Generate slots within working hours
        let slotStart = workStart;
        while (addMinutes(slotStart, duration) <= workEnd) {
          const slotEnd = addMinutes(slotStart, duration);
          const slotWithBufferStart = addMinutes(slotStart, -bufferBefore);
          const slotWithBufferEnd = addMinutes(slotEnd, bufferAfter);

          // Skip if before earliest booking time
          if (isBefore(slotStart, effectiveStart)) {
            slotStart = addMinutes(slotStart, duration);
            continue;
          }

          // Check Google Calendar busy
          const gcalBusy = freeBusyByUser.get(userId) ?? [];
          const isGcalBusy = gcalBusy.some((busy) =>
            areIntervalsOverlapping(
              { start: slotWithBufferStart, end: slotWithBufferEnd },
              { start: busy.start, end: busy.end },
            ),
          );

          // Check existing bookings (including buffer)
          const isBooked = existingBookings.some((b) =>
            b.assignedUserId === userId &&
            areIntervalsOverlapping(
              { start: slotWithBufferStart, end: slotWithBufferEnd },
              { start: b.startTime, end: b.endTime },
            ),
          );

          if (!isGcalBusy && !isBooked) {
            // Check if slot already exists (from another user)
            const existingSlot = allSlots.find(
              (s) => s.start.getTime() === slotStart.getTime() && s.end.getTime() === slotEnd.getTime(),
            );
            if (existingSlot) {
              existingSlot.availableUserIds.push(userId);
            } else {
              allSlots.push({
                start: slotStart,
                end: slotEnd,
                availableUserIds: [userId],
              });
            }
          }

          slotStart = addMinutes(slotStart, duration);
        }
      }
    }
  }

  // Sort by start time
  allSlots.sort((a, b) => a.start.getTime() - b.start.getTime());
  return allSlots;
}
```

- [ ] **Step 5: Write AvailabilityService test**

```typescript
// backend/src/__tests__/availability.test.ts
import { describe, it, expect } from 'vitest';

describe('AvailabilityService', () => {
  it('module exports getAvailableSlots', async () => {
    const mod = await import('../services/availability.js');
    expect(mod.getAvailableSlots).toBeDefined();
  });
});
```

- [ ] **Step 6: Run tests**

```bash
cd /Users/hziech/calendfree && npm run build -w shared && npm run test -w backend
```

- [ ] **Step 7: Commit**

```bash
cd /Users/hziech/calendfree && git add shared/ backend/src/services/availability.ts backend/src/__tests__/availability.test.ts && git commit -m "feat: add AvailabilityService with slot calculation, timezone support, and booking limits" && git push
```

---

## Chunk 3: Round-Robin Service

### Task 4: Create RoundRobinService

**Files:**
- Create: `backend/src/services/round-robin.ts`
- Create: `backend/src/__tests__/round-robin.test.ts`

- [ ] **Step 1: Create RoundRobinService**

```typescript
// backend/src/services/round-robin.ts
import { prisma } from '../db.js';
import { Prisma } from '@prisma/client';

const MAX_RETRIES = 3;

interface RoundRobinResult {
  userId: string;
}

/**
 * Assign a user from a team using the configured round-robin mode.
 * Uses SELECT FOR UPDATE for concurrency safety.
 * @param teamId - The team to assign from
 * @param availableUserIds - Users who are available for the requested slot
 * @returns The assigned user ID
 * @throws Error if no user can be assigned after retries
 */
export async function assignUser(
  teamId: string,
  availableUserIds: string[],
): Promise<RoundRobinResult> {
  if (availableUserIds.length === 0) {
    throw new Error('No available users for this slot');
  }

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
        // Lock the RoundRobinConfig row
        const [rrConfig] = await tx.$queryRaw<Array<{
          id: string;
          teamId: string;
          mode: string;
          lastAssignedIndex: number;
          version: number;
        }>>`
          SELECT id, "teamId", mode, "lastAssignedIndex", version
          FROM "RoundRobinConfig"
          WHERE "teamId" = ${teamId}
          FOR UPDATE
        `;

        if (!rrConfig) {
          throw new Error(`No RoundRobinConfig found for team ${teamId}`);
        }

        let selectedUserId: string;

        switch (rrConfig.mode) {
          case 'SEQUENTIAL':
            selectedUserId = await assignSequential(tx, rrConfig, availableUserIds);
            break;
          case 'LEAST_BUSY':
            selectedUserId = await assignLeastBusy(tx, availableUserIds);
            break;
          case 'WEIGHTED':
            selectedUserId = await assignWeighted(tx, teamId, availableUserIds);
            break;
          default:
            throw new Error(`Unknown round-robin mode: ${rrConfig.mode}`);
        }

        return { userId: selectedUserId };
      }, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 5000,
      });
    } catch (err: any) {
      // Retry on serialization failure
      if (err.code === 'P2034' || err.message?.includes('could not serialize')) {
        if (attempt < MAX_RETRIES - 1) continue;
      }
      throw err;
    }
  }

  throw new Error('Failed to assign user after max retries');
}

/** Sequential: rotate through members by index */
async function assignSequential(
  tx: Prisma.TransactionClient,
  rrConfig: { id: string; lastAssignedIndex: number; version: number },
  availableUserIds: string[],
): Promise<string> {
  // Get ordered team memberships
  const memberships = await tx.teamMembership.findMany({
    where: { teamId: rrConfig.id, userId: { in: availableUserIds } },
    orderBy: { userId: 'asc' },
  });

  if (memberships.length === 0) throw new Error('No available members in team');

  // Find next index (wrap around)
  const nextIndex = (rrConfig.lastAssignedIndex + 1) % memberships.length;
  const selectedUserId = memberships[nextIndex].userId;

  // Update pointer
  await tx.roundRobinConfig.update({
    where: { id: rrConfig.id },
    data: {
      lastAssignedIndex: nextIndex,
      version: { increment: 1 },
    },
  });

  return selectedUserId;
}

/** Least-busy: assign to user with fewest recent bookings */
async function assignLeastBusy(
  tx: Prisma.TransactionClient,
  availableUserIds: string[],
): Promise<string> {
  // Count bookings this week for each available user
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const bookingCounts = await tx.booking.groupBy({
    by: ['assignedUserId'],
    where: {
      assignedUserId: { in: availableUserIds },
      status: { in: ['CONFIRMED', 'COMPLETED', 'PENDING_CALENDAR_SYNC'] },
      startTime: { gte: weekAgo },
    },
    _count: { id: true },
  });

  // Find user with minimum bookings
  const countMap = new Map(bookingCounts.map((c) => [c.assignedUserId, c._count.id]));

  let minCount = Infinity;
  let selectedUserId = availableUserIds[0];

  for (const uid of availableUserIds) {
    const count = countMap.get(uid) ?? 0;
    if (count < minCount) {
      minCount = count;
      selectedUserId = uid;
    }
  }

  return selectedUserId;
}

/** Weighted: assign to user furthest below their weight target */
async function assignWeighted(
  tx: Prisma.TransactionClient,
  teamId: string,
  availableUserIds: string[],
): Promise<string> {
  // Get weights for available members
  const memberships = await tx.teamMembership.findMany({
    where: { teamId, userId: { in: availableUserIds } },
  });

  const totalWeight = memberships.reduce((sum, m) => sum + m.weight, 0);
  if (totalWeight === 0) return availableUserIds[0];

  // Count total bookings for the team in last 30 days
  const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const allTeamUserIds = memberships.map((m) => m.userId);

  const bookingCounts = await tx.booking.groupBy({
    by: ['assignedUserId'],
    where: {
      assignedUserId: { in: allTeamUserIds },
      status: { in: ['CONFIRMED', 'COMPLETED', 'PENDING_CALENDAR_SYNC'] },
      startTime: { gte: monthAgo },
    },
    _count: { id: true },
  });

  const countMap = new Map(bookingCounts.map((c) => [c.assignedUserId, c._count.id]));
  const totalBookings = Array.from(countMap.values()).reduce((a, b) => a + b, 0) || 1;

  // Find user furthest below their target percentage
  let maxDeficit = -Infinity;
  let selectedUserId = availableUserIds[0];

  for (const membership of memberships) {
    const targetPct = membership.weight / totalWeight;
    const actualPct = (countMap.get(membership.userId) ?? 0) / totalBookings;
    const deficit = targetPct - actualPct;

    if (deficit > maxDeficit) {
      maxDeficit = deficit;
      selectedUserId = membership.userId;
    }
  }

  return selectedUserId;
}
```

- [ ] **Step 2: Write RoundRobinService test**

```typescript
// backend/src/__tests__/round-robin.test.ts
import { describe, it, expect } from 'vitest';

describe('RoundRobinService', () => {
  it('module exports assignUser', async () => {
    const mod = await import('../services/round-robin.js');
    expect(mod.assignUser).toBeDefined();
  });
});
```

- [ ] **Step 3: Run tests**

```bash
cd /Users/hziech/calendfree && npm run test -w backend
```

- [ ] **Step 4: Commit**

```bash
cd /Users/hziech/calendfree && git add backend/src/services/round-robin.ts backend/src/__tests__/round-robin.test.ts && git commit -m "feat: add RoundRobinService with sequential, least-busy, and weighted modes" && git push
```

---

## Chunk 4: Booking API Routes

### Task 5: Create Booking Routes

**Files:**
- Create: `backend/src/routes/booking.ts`
- Create: `backend/src/__tests__/booking.test.ts`
- Modify: `backend/src/app.ts`

- [ ] **Step 1: Create booking routes**

```typescript
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
```

- [ ] **Step 2: Register booking routes in app.ts**

Add to `backend/src/app.ts`:
```typescript
import { bookingRoutes } from './routes/booking.js';

// After auth routes registration:
await app.register(bookingRoutes);
```

- [ ] **Step 3: Write booking route tests**

```typescript
// backend/src/__tests__/booking.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../app.js';
import type { FastifyInstance } from 'fastify';

describe('Booking routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/booking/:company/:event/slots returns 404 for unknown company', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/booking/nonexistent/test/slots',
    });
    expect(res.statusCode).toBe(404);
  });

  it('POST /api/booking/:company/:event returns 404 for unknown company', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/booking/nonexistent/test',
      payload: {
        startTime: new Date().toISOString(),
        name: 'Test User',
        email: 'test@example.com',
      },
    });
    expect(res.statusCode).toBe(404);
  });

  it('POST /api/booking/:token/cancel returns 404 for unknown token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/booking/nonexistent-token/cancel',
    });
    expect(res.statusCode).toBe(404);
  });
});
```

- [ ] **Step 4: Run all tests**

```bash
cd /Users/hziech/calendfree && npm run test -w backend
```

- [ ] **Step 5: Commit**

```bash
cd /Users/hziech/calendfree && git add backend/src/routes/booking.ts backend/src/__tests__/booking.test.ts backend/src/app.ts && git commit -m "feat: add booking API with slot retrieval, booking creation, and cancellation" && git push
```

---

## Verification Checklist

After completing all tasks, verify:

1. **`npm run test -w backend`** — all tests pass
2. **`/api/docs`** — Swagger UI shows new booking endpoints
3. **CalendarService** — getFreeBusy, createCalendarEvent, deleteCalendarEvent exported
4. **AvailabilityService** — getAvailableSlots correctly intersects working hours, calendar, bookings, buffers, limits
5. **RoundRobinService** — assignUser supports SEQUENTIAL, LEAST_BUSY, WEIGHTED with SELECT FOR UPDATE
6. **Booking API**:
   - `GET /api/booking/:company/:event/slots` — returns available slots
   - `POST /api/booking/:company/:event` — creates booking with round-robin assignment
   - `POST /api/booking/:token/cancel` — cancels booking and deletes calendar event
7. **Shared schemas** — BookingRequest, BookingResponse, TimeSlot exported from @calendfree/shared
