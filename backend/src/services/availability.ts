// backend/src/services/availability.ts
import { prisma } from '../db.js';
import { getFreeBusy } from './calendar.js';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import {
  addMinutes, addDays, isAfter, isBefore,
  areIntervalsOverlapping, eachDayOfInterval, getDay,
} from 'date-fns';

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;

interface TimeWindow {
  start: string; // "09:00"
  end: string;   // "17:00"
}

/** Default bookable hours if none configured on the event type: Mo-Fr 9-17 */
const DEFAULT_BOOKABLE_HOURS: Record<string, TimeWindow[]> = {
  monday: [{ start: '09:00', end: '17:00' }],
  tuesday: [{ start: '09:00', end: '17:00' }],
  wednesday: [{ start: '09:00', end: '17:00' }],
  thursday: [{ start: '09:00', end: '17:00' }],
  friday: [{ start: '09:00', end: '17:00' }],
};

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
  remainingSpots?: number;
}

/**
 * Compute available booking slots for a set of users within a date range.
 *
 * Logic:
 * 1. Start with the bookable hours defined on the EventType (or default Mo-Fr 9-17)
 * 2. For each user, subtract Google Calendar busy times (the REAL availability)
 * 3. Subtract existing Calendfree bookings + buffers
 * 4. Apply booking limits (max per day)
 * 5. Apply min notice + max advance window
 */
export async function getAvailableSlots(params: AvailabilityParams): Promise<Slot[]> {
  const { eventTypeId, dateRangeStart, dateRangeEnd, userIds, customerTimezone } = params;

  // Filter out absent users (auto-reset expired absences)
  const now = new Date();
  const activeUserIds: string[] = [];
  const usersWithStatus = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, status: true, absentUntil: true },
  });

  for (const u of usersWithStatus) {
    if (u.status === 'ABSENT') {
      if (u.absentUntil && u.absentUntil <= now) {
        // Auto-reset expired absence
        await prisma.user.update({ where: { id: u.id }, data: { status: 'AVAILABLE', absentUntil: null } });
        activeUserIds.push(u.id);
      }
      // else: still absent, skip
    } else {
      activeUserIds.push(u.id);
    }
  }

  if (activeUserIds.length === 0) return [];

  // Fetch availability configs for all active users (batch, not per-user)
  const availabilityConfigs = await prisma.availabilityConfig.findMany({
    where: { userId: { in: activeUserIds } },
  });
  const configByUser = new Map(availabilityConfigs.map((c) => [c.userId, c]));

  const eventType = await prisma.eventType.findUniqueOrThrow({
    where: { id: eventTypeId },
  });

  const duration = eventType.duration;
  const bufferBefore = eventType.bufferBefore;
  const bufferAfter = eventType.bufferAfter;
  const minNoticeHours = eventType.minNotice;
  const maxAdvanceDays = eventType.maxAdvance;

  // Bookable hours come from the EventType, not from the User
  const bookableHours = (eventType.bookableHours as Record<string, TimeWindow[]> | null) ?? DEFAULT_BOOKABLE_HOURS;

  const earliestBooking = addMinutes(now, minNoticeHours * 60);
  const latestBooking = addDays(now, maxAdvanceDays);

  const effectiveStart = isAfter(dateRangeStart, earliestBooking) ? dateRangeStart : earliestBooking;
  const effectiveEnd = isBefore(dateRangeEnd, latestBooking) ? dateRangeEnd : latestBooking;

  // Fetch vacation periods for all active users within the date range
  const vacationPeriods = await prisma.vacationPeriod.findMany({
    where: {
      userId: { in: activeUserIds },
      endDate: { gte: effectiveStart },
      startDate: { lte: effectiveEnd },
    },
  });
  const vacationsByUser = new Map<string, Array<{ startDate: Date; endDate: Date }>>();
  for (const v of vacationPeriods) {
    const list = vacationsByUser.get(v.userId) ?? [];
    list.push({ startDate: v.startDate, endDate: v.endDate });
    vacationsByUser.set(v.userId, list);
  }

  if (isAfter(effectiveStart, effectiveEnd)) return [];

  const isGroup = eventType.eventCategory === 'GROUP';
  const maxInvitees = eventType.maxInvitees;

  // For GROUP events, fetch all bookings for this event type in the range
  // (not per-user, since multiple invitees share a slot)
  let groupBookingCounts: Map<string, number> | undefined;
  if (isGroup) {
    const groupBookings = await prisma.booking.findMany({
      where: {
        eventTypeId: eventTypeId,
        status: { in: ['CONFIRMED', 'PENDING_CALENDAR_SYNC'] },
        startTime: { gte: effectiveStart },
        endTime: { lte: effectiveEnd },
      },
      select: { startTime: true },
    });
    groupBookingCounts = new Map();
    for (const b of groupBookings) {
      const key = b.startTime.toISOString();
      groupBookingCounts.set(key, (groupBookingCounts.get(key) ?? 0) + 1);
    }
  }

  // Fetch existing Calendfree bookings in parallel with Google Calendar
  const existingBookings = await prisma.booking.findMany({
    where: {
      assignedUserId: { in: activeUserIds },
      status: { in: ['CONFIRMED', 'PENDING_CALENDAR_SYNC'] },
      startTime: { gte: effectiveStart },
      endTime: { lte: effectiveEnd },
    },
  });

  // Fetch Google Calendar events for each user (the REAL source of truth)
  const freeBusyByUser = new Map<string, Array<{ start: Date; end: Date }>>();
  const freeBusyResults = await Promise.allSettled(
    activeUserIds.map(async (uid) => {
      const busy = await getFreeBusy(uid, effectiveStart, effectiveEnd);
      return { uid, busy };
    }),
  );

  const failedUserIds: string[] = [];
  for (let i = 0; i < freeBusyResults.length; i++) {
    const result = freeBusyResults[i];
    if (result.status === 'fulfilled') {
      freeBusyByUser.set(result.value.uid, result.value.busy);
    } else {
      console.error('Calendar fetch failed for user, excluding:', result.reason?.message ?? result.reason);
      failedUserIds.push(activeUserIds[i]);
    }
  }

  // Only include users whose calendar we could read
  const eligibleUserIds = activeUserIds.filter((uid) => !failedUserIds.includes(uid));

  // For each day, generate slots within the bookable hours, then filter by calendar
  const days = eachDayOfInterval({ start: effectiveStart, end: effectiveEnd });
  const allSlots: Slot[] = [];

  // We use Europe/Berlin as the reference timezone for bookable hours
  // (since the event type creator sets these in their own timezone)
  const bookableHoursTz = 'Europe/Berlin';

  for (const day of days) {
    const dayOfWeek = DAY_NAMES[getDay(day)];
    const defaultDayWindows = bookableHours[dayOfWeek];

    for (const userId of eligibleUserIds) {
      // Check booking limits per day
      const dayBookings = existingBookings.filter((b) => {
        const bDay = toZonedTime(b.startTime, bookableHoursTz);
        const thisDay = toZonedTime(day, bookableHoursTz);
        return b.assignedUserId === userId && bDay.toDateString() === thisDay.toDateString();
      });

      const userConfig = configByUser.get(userId);
      const maxPerDay = userConfig?.maxPerDay ?? 8;
      if (dayBookings.length >= maxPerDay) continue;

      // Check if this day is a blocked holiday for this user
      const blockedHolidays = (userConfig?.blockedHolidays as string[] | null) ?? [];
      const dayInTzForHoliday = toZonedTime(day, bookableHoursTz);
      const dayDateStr = `${dayInTzForHoliday.getFullYear()}-${String(dayInTzForHoliday.getMonth() + 1).padStart(2, '0')}-${String(dayInTzForHoliday.getDate()).padStart(2, '0')}`;
      if (blockedHolidays.includes(dayDateStr)) continue;

      // Check if this day falls within a vacation period for this user
      const userVacations = vacationsByUser.get(userId) ?? [];
      const dayAsDate = new Date(dayDateStr);
      const isOnVacation = userVacations.some((v) =>
        dayAsDate >= v.startDate && dayAsDate <= v.endDate
      );
      if (isOnVacation) continue;

      // Resolve day windows: date-specific override > weekly schedule
      const dateSpecificHours = (userConfig?.dateSpecificHours as Record<string, TimeWindow[]> | null) ?? null;
      let dayWindows: TimeWindow[] | undefined;

      if (dateSpecificHours && dayDateStr in dateSpecificHours) {
        dayWindows = dateSpecificHours[dayDateStr];
        if (!dayWindows || dayWindows.length === 0) continue; // Empty = unavailable
      } else {
        dayWindows = defaultDayWindows;
        if (!dayWindows || dayWindows.length === 0) continue;
      }

      for (const window of dayWindows) {
        const [startH, startM] = window.start.split(':').map(Number);
        const [endH, endM] = window.end.split(':').map(Number);

        const dayInTz = toZonedTime(day, bookableHoursTz);
        const windowStart = fromZonedTime(
          new Date(dayInTz.getFullYear(), dayInTz.getMonth(), dayInTz.getDate(), startH, startM),
          bookableHoursTz,
        );
        const windowEnd = fromZonedTime(
          new Date(dayInTz.getFullYear(), dayInTz.getMonth(), dayInTz.getDate(), endH, endM),
          bookableHoursTz,
        );

        let slotStart = windowStart;
        while (addMinutes(slotStart, duration) <= windowEnd) {
          const slotEnd = addMinutes(slotStart, duration);
          const withBufferStart = addMinutes(slotStart, -bufferBefore);
          const withBufferEnd = addMinutes(slotEnd, bufferAfter);

          if (isBefore(slotStart, effectiveStart)) {
            slotStart = addMinutes(slotStart, duration);
            continue;
          }

          // Check Google Calendar busy times
          const gcalBusy = freeBusyByUser.get(userId) ?? [];
          const isGcalBusy = gcalBusy.some((busy) =>
            areIntervalsOverlapping(
              { start: withBufferStart, end: withBufferEnd },
              { start: busy.start, end: busy.end },
            ),
          );

          // Check existing Calendfree bookings
          const isBooked = existingBookings.some((b) =>
            b.assignedUserId === userId &&
            areIntervalsOverlapping(
              { start: withBufferStart, end: withBufferEnd },
              { start: b.startTime, end: b.endTime },
            ),
          );

          if (!isGcalBusy && !isBooked) {
            // For GROUP events, check if slot is full
            if (isGroup && maxInvitees && groupBookingCounts) {
              const count = groupBookingCounts.get(slotStart.toISOString()) ?? 0;
              if (count >= maxInvitees) {
                slotStart = addMinutes(slotStart, duration);
                continue;
              }
            }

            const existingSlot = allSlots.find(
              (s) => s.start.getTime() === slotStart.getTime() && s.end.getTime() === slotEnd.getTime(),
            );
            if (existingSlot) {
              existingSlot.availableUserIds.push(userId);
            } else {
              const newSlot: Slot = { start: slotStart, end: slotEnd, availableUserIds: [userId] };
              if (isGroup && maxInvitees && groupBookingCounts) {
                const count = groupBookingCounts.get(slotStart.toISOString()) ?? 0;
                newSlot.remainingSpots = maxInvitees - count;
              }
              allSlots.push(newSlot);
            }
          }

          slotStart = addMinutes(slotStart, duration);
        }
      }
    }
  }

  allSlots.sort((a, b) => a.start.getTime() - b.start.getTime());
  return allSlots;
}
