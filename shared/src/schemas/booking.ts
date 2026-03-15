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

export const UpdateBookingNotesSchema = z.object({
  notes: z.string().max(5000),
});
export type UpdateBookingNotes = z.infer<typeof UpdateBookingNotesSchema>;

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
