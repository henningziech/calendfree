import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../api/client';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { format, parseISO, isPast } from 'date-fns';
import { de } from 'date-fns/locale';

interface Booking {
  id: string;
  startTime: string;
  endTime: string;
  status: string;
  bookingToken: string;
  calendarEventId: string | null;
  eventType: { title: string; slug: string; duration: number; company: { slug: string } | null };
  formData: { name: string; email: string } | null;
}

export function UserDashboard() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    apiRequest<Booking[]>('/me/bookings')
      .then(setBookings)
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) return <LoadingSpinner />;

  const upcoming = bookings.filter((b) => !isPast(parseISO(b.startTime)) && b.status === 'CONFIRMED');
  const past = bookings.filter((b) => isPast(parseISO(b.startTime)) || b.status !== 'CONFIRMED');

  const statusLabel: Record<string, { text: string; color: string }> = {
    CONFIRMED: { text: 'Bestätigt', color: 'bg-green-100 text-green-700' },
    CANCELLED: { text: 'Abgesagt', color: 'bg-red-100 text-red-700' },
    RESCHEDULED: { text: 'Verschoben', color: 'bg-yellow-100 text-yellow-700' },
    COMPLETED: { text: 'Abgeschlossen', color: 'bg-gray-100 text-gray-600' },
    NO_SHOW: { text: 'No-Show', color: 'bg-red-100 text-red-600' },
    PENDING_CALENDAR_SYNC: { text: 'Sync ausstehend', color: 'bg-yellow-100 text-yellow-700' },
  };

  const BookingCard = ({ booking }: { booking: Booking }) => {
    const st = statusLabel[booking.status] ?? { text: booking.status, color: 'bg-gray-100 text-gray-600' };
    return (
      <div className="flex items-center justify-between rounded-lg border bg-white p-4">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-gray-900">{booking.eventType.title}</h3>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${st.color}`}>{st.text}</span>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            {format(parseISO(booking.startTime), "EEEE, d. MMM yyyy 'um' HH:mm 'Uhr'", { locale: de })}
            {' · '}{booking.eventType.duration} Min
          </p>
          {booking.formData && (
            <p className="mt-1 text-sm text-gray-400">
              Kunde: {booking.formData.name} ({booking.formData.email})
            </p>
          )}
        </div>
        {booking.status === 'CONFIRMED' && !isPast(parseISO(booking.startTime)) && booking.calendarEventId && (
          <span className="text-xs text-green-600">Im Kalender</span>
        )}
      </div>
    );
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Meine Termine</h1>
      <p className="mt-2 text-gray-600">Willkommen, {user?.name}.</p>

      {bookings.length === 0 ? (
        <div className="mt-6 rounded-lg border-2 border-dashed bg-gray-50 p-12 text-center">
          <div className="text-4xl mb-3">📅</div>
          <h3 className="text-lg font-medium text-gray-900">Noch keine Termine</h3>
          <p className="mt-1 text-sm text-gray-500">Sobald Kunden Termine bei Ihnen buchen, erscheinen sie hier.</p>
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          {upcoming.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-3">
                Kommende Termine ({upcoming.length})
              </h2>
              <div className="space-y-2">
                {upcoming.map((b) => <BookingCard key={b.id} booking={b} />)}
              </div>
            </div>
          )}

          {past.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-3">
                Vergangene / Andere ({past.length})
              </h2>
              <div className="space-y-2">
                {past.map((b) => <BookingCard key={b.id} booking={b} />)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
