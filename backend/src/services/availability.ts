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

  const now = new Date();
  const earliestBooking = addMinutes(now, minNoticeHours * 60);
  const latestBooking = addDays(now, maxAdvanceDays);

  const effectiveStart = isAfter(dateRangeStart, earliestBooking) ? dateRangeStart : earliestBooking;
  const effectiveEnd = isBefore(dateRangeEnd, latestBooking) ? dateRangeEnd : latestBooking;

  if (isAfter(effectiveStart, effectiveEnd)) return [];

  // Fetch existing Calendfree bookings in parallel with Google Calendar
  const existingBookings = await prisma.booking.findMany({
    where: {
      assignedUserId: { in: userIds },
      status: { in: ['CONFIRMED', 'PENDING_CALENDAR_SYNC'] },
      startTime: { gte: effectiveStart },
      endTime: { lte: effectiveEnd },
    },
  });

  // Fetch Google Calendar events for each user (the REAL source of truth)
  const freeBusyByUser = new Map<string, Array<{ start: Date; end: Date }>>();
  const freeBusyResults = await Promise.allSettled(
    userIds.map(async (uid) => {
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
      failedUserIds.push(userIds[i]);
    }
  }

  // Only include users whose calendar we could read
  const eligibleUserIds = userIds.filter((uid) => !failedUserIds.includes(uid));

  // For each day, generate slots within the bookable hours, then filter by calendar
  const days = eachDayOfInterval({ start: effectiveStart, end: effectiveEnd });
  const allSlots: Slot[] = [];

  // We use Europe/Berlin as the reference timezone for bookable hours
  // (since the event type creator sets these in their own timezone)
  const bookableHoursTz = 'Europe/Berlin';

  for (const day of days) {
    const dayOfWeek = DAY_NAMES[getDay(day)];
    const dayWindows = bookableHours[dayOfWeek];
    if (!dayWindows || dayWindows.length === 0) continue;

    for (const userId of eligibleUserIds) {
      // Check booking limits per day
      const dayBookings = existingBookings.filter((b) => {
        const bDay = toZonedTime(b.startTime, bookableHoursTz);
        const thisDay = toZonedTime(day, bookableHoursTz);
        return b.assignedUserId === userId && bDay.toDateString() === thisDay.toDateString();
      });

      // Simple limit: max 8 bookings per day (can be made configurable later)
      if (dayBookings.length >= 8) continue;

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
            const existingSlot = allSlots.find(
              (s) => s.start.getTime() === slotStart.getTime() && s.end.getTime() === slotEnd.getTime(),
            );
            if (existingSlot) {
              existingSlot.availableUserIds.push(userId);
            } else {
              allSlots.push({ start: slotStart, end: slotEnd, availableUserIds: [userId] });
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
