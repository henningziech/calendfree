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
