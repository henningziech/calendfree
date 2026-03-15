import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import type { Booking } from './types';
import { statusLabel } from './types';

interface BookingCardProps {
  booking: Booking;
  onClick: () => void;
  showAssignee?: boolean;
}

export function BookingCard({ booking, onClick, showAssignee }: BookingCardProps) {
  const st = statusLabel[booking.status] ?? { text: booking.status, color: 'bg-[#F8FAFC] text-[#64748B]' };
  return (
    <button
      onClick={onClick}
      className="w-full text-left flex items-center justify-between rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-sm transition-all hover:shadow-md hover:border-[#0B8ECA]/30 cursor-pointer"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="font-medium text-[#1E293B] truncate">{booking.eventType.title}</h3>
          <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${st.color}`}>{st.text}</span>
        </div>
        <p className="mt-1 text-sm text-[#64748B]">
          {format(parseISO(booking.startTime), "EEEE, d. MMM yyyy 'um' HH:mm 'Uhr'", { locale: de })}
          {' · '}{booking.eventType.duration} Min
        </p>
        {booking.formData && (
          <p className="mt-1 text-sm text-[#64748B]/70 truncate">
            Kunde: {booking.formData.name} ({booking.formData.email})
          </p>
        )}
        {showAssignee && booking.assignedUser && (
          <p className="mt-0.5 text-xs text-[#0B8ECA]">
            Zugewiesen: {booking.assignedUser.name}
          </p>
        )}
      </div>
      <svg className="h-5 w-5 shrink-0 text-[#94A3B8] ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
      </svg>
    </button>
  );
}
