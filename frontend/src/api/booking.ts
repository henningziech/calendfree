import { apiRequest } from './client';

export interface TimeSlot {
  start: string;
  end: string;
}

export interface BookingResponse {
  id: string;
  startTime: string;
  endTime: string;
  assignedUser: { name: string; email: string };
  meetLink: string | null;
  cancelUrl: string;
  rescheduleUrl: string;
}

/** Fetch available time slots for an event type. */
export async function getSlots(
  companySlug: string,
  eventTypeSlug: string,
  date?: string,
  timezone?: string,
): Promise<{ slots: TimeSlot[] }> {
  const params = new URLSearchParams();
  if (date) params.set('date', date);
  if (timezone) params.set('timezone', timezone);
  const qs = params.toString();
  return apiRequest(`/booking/${companySlug}/${eventTypeSlug}/slots${qs ? `?${qs}` : ''}`);
}

/** Create a booking. */
export async function createBooking(
  companySlug: string,
  eventTypeSlug: string,
  data: {
    startTime: string;
    timezone: string;
    name: string;
    email: string;
    comment?: string;
    formData?: Record<string, string>;
  },
): Promise<BookingResponse> {
  return apiRequest(`/booking/${companySlug}/${eventTypeSlug}`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/** Cancel a booking via token. */
export async function cancelBooking(token: string): Promise<{ success: boolean; message: string }> {
  return apiRequest(`/booking/${token}/cancel`, { method: 'POST' });
}
