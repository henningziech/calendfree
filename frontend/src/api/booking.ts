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

// ── Authenticated booking management (user dashboard) ──

/** Fetch current user's bookings. */
export async function getMyBookings() {
  return apiRequest<any[]>('/me/bookings');
}

/** Fetch bookings for all teams the user belongs to. */
export async function getTeamBookings() {
  return apiRequest<any[]>('/me/bookings/team');
}

/** Update internal notes on a booking. */
export async function updateBookingNotes(bookingId: string, notes: string) {
  return apiRequest(`/me/bookings/${bookingId}/notes`, {
    method: 'PATCH',
    body: JSON.stringify({ notes }),
  });
}

/** Cancel a booking as an authenticated user. */
export async function cancelBookingAsUser(bookingId: string) {
  return apiRequest(`/me/bookings/${bookingId}/cancel`, { method: 'POST' });
}

/** Fetch single booking with comments. */
export async function getBookingDetail(bookingId: string) {
  return apiRequest<any>(`/me/bookings/${bookingId}`);
}

/** Change booking status (COMPLETED, NO_SHOW). */
export async function updateBookingStatus(bookingId: string, status: string) {
  return apiRequest(`/me/bookings/${bookingId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

/** Create a comment on a booking. */
export async function createBookingComment(bookingId: string, content: string) {
  return apiRequest<any>(`/me/bookings/${bookingId}/comments`, {
    method: 'POST',
    body: JSON.stringify({ content }),
  });
}

/** Edit own comment. */
export async function updateBookingComment(bookingId: string, commentId: string, content: string) {
  return apiRequest<any>(`/me/bookings/${bookingId}/comments/${commentId}`, {
    method: 'PATCH',
    body: JSON.stringify({ content }),
  });
}

/** Delete own comment. */
export async function deleteBookingComment(bookingId: string, commentId: string) {
  return apiRequest(`/me/bookings/${bookingId}/comments/${commentId}`, { method: 'DELETE' });
}
