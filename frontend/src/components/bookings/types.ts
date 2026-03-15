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

export const statusLabel: Record<string, { text: string; color: string }> = {
  CONFIRMED: { text: 'Bestätigt', color: 'bg-teal-100 text-teal-700' },
  CANCELLED: { text: 'Abgesagt', color: 'bg-red-100 text-red-700' },
  RESCHEDULED: { text: 'Verschoben', color: 'bg-amber-100 text-amber-700' },
  COMPLETED: { text: 'Abgeschlossen', color: 'bg-[#F8FAFC] text-[#64748B]' },
  NO_SHOW: { text: 'No-Show', color: 'bg-red-100 text-red-600' },
  PENDING_CALENDAR_SYNC: { text: 'Sync ausstehend', color: 'bg-amber-100 text-amber-700' },
};
