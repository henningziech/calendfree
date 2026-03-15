import { useLocation, Link } from 'react-router';
import { BrandedLayout } from '../../components/layout/BrandedLayout';
import type { BookingResponse } from '../../api/booking';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';

export function ConfirmationPage() {
  const location = useLocation();
  const booking = location.state?.booking as BookingResponse | undefined;

  if (!booking) {
    return (
      <BrandedLayout>
        <div className="text-center py-12">
          <p className="text-gray-500">Keine Buchungsdaten gefunden.</p>
          <Link to="/" className="mt-4 text-blue-600 hover:underline">Zurück zur Startseite</Link>
        </div>
      </BrandedLayout>
    );
  }

  return (
    <BrandedLayout>
      <div className="space-y-6 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
          <svg className="h-8 w-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <div>
          <h1 className="text-2xl font-bold text-gray-900">Termin bestätigt!</h1>
          <p className="mt-2 text-gray-600">Sie erhalten in Kürze eine Bestätigungsmail.</p>
        </div>

        <div className="rounded-lg bg-gray-50 p-6 text-left">
          <dl className="space-y-3">
            <div>
              <dt className="text-sm text-gray-500">Wann</dt>
              <dd className="font-medium">
                {format(parseISO(booking.startTime), "EEEE, d. MMMM yyyy 'um' HH:mm 'Uhr'", { locale: de })}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">Mit</dt>
              <dd className="font-medium">{booking.assignedUser.name}</dd>
            </div>
            {booking.meetLink && (
              <div>
                <dt className="text-sm text-gray-500">Meeting-Link</dt>
                <dd>
                  <a href={booking.meetLink} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                    Google Meet beitreten
                  </a>
                </dd>
              </div>
            )}
          </dl>
        </div>

        <div className="flex justify-center gap-4 text-sm">
          <a href={booking.rescheduleUrl} className="text-blue-600 hover:underline">Termin verschieben</a>
          <span className="text-gray-300">|</span>
          <a href={booking.cancelUrl} className="text-red-600 hover:underline">Termin absagen</a>
        </div>
      </div>
    </BrandedLayout>
  );
}
