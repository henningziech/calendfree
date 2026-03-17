export interface Booking {
  id: string;
  startTime: string;
  endTime: string;
  status: string;
  internalNotes: string | null;
  bookingToken: string;
  calendarEventId: string | null;
  eventType: {
    title: string;
    slug: string;
    duration: number;
    teamId: string | null;
    team?: { name: string } | null;
    company: { slug: string } | null;
  };
  formData: { name: string; email: string; data: Record<string, any> } | null;
  assignedUser?: { name: string; email: string };
}

/** CSS color classes for each booking status. */
export const statusColor: Record<string, string> = {
  CONFIRMED: 'bg-teal-100 text-teal-700',
  CANCELLED: 'bg-red-100 text-red-700',
  RESCHEDULED: 'bg-amber-100 text-amber-700',
  COMPLETED: 'bg-[#F8FAFC] text-[#64748B]',
  NO_SHOW: 'bg-red-100 text-red-600',
  PENDING_CALENDAR_SYNC: 'bg-amber-100 text-amber-700',
};

/** Translation keys for each booking status. */
export const statusTranslationKey: Record<string, string> = {
  CONFIRMED: 'bookings.status.confirmed',
  CANCELLED: 'bookings.status.cancelled',
  RESCHEDULED: 'bookings.status.rescheduled',
  COMPLETED: 'bookings.status.completed',
  NO_SHOW: 'bookings.status.noShow',
  PENDING_CALENDAR_SYNC: 'bookings.status.pendingSync',
};

/**
 * @deprecated Use statusColor and statusTranslationKey separately with useTranslation('dashboard')
 */
export const statusLabel: Record<string, { text: string; color: string }> = {
  CONFIRMED: { text: 'Bestätigt', color: 'bg-teal-100 text-teal-700' },
  CANCELLED: { text: 'Abgesagt', color: 'bg-red-100 text-red-700' },
  RESCHEDULED: { text: 'Verschoben', color: 'bg-amber-100 text-amber-700' },
  COMPLETED: { text: 'Abgeschlossen', color: 'bg-[#F8FAFC] text-[#64748B]' },
  NO_SHOW: { text: 'No-Show', color: 'bg-red-100 text-red-600' },
  PENDING_CALENDAR_SYNC: { text: 'Sync ausstehend', color: 'bg-amber-100 text-amber-700' },
};
