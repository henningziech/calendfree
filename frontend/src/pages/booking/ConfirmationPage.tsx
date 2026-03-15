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
          <p className="text-[#64748B]">Keine Buchungsdaten gefunden.</p>
          <Link to="/" className="mt-4 inline-block text-sm font-medium text-[#0B8ECA] hover:text-[#0874A6] transition-colors">Zurück zur Startseite</Link>
        </div>
      </BrandedLayout>
    );
  }

  return (
    <BrandedLayout>
      <div className="space-y-6 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#14B8A6]/10">
          <svg className="h-8 w-8 text-[#14B8A6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <div>
          <h1 className="text-2xl font-bold text-[#1E293B]">Termin bestätigt!</h1>
          <p className="mt-2 text-[#64748B]">Sie erhalten in Kürze eine Bestätigungsmail.</p>
        </div>

        <div className="rounded-xl border border-[#E2E8F0] bg-white p-6 text-left shadow-sm">
          <dl className="space-y-4">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-[#64748B]">Wann</dt>
              <dd className="mt-1 font-medium text-[#1E293B]">
                {format(parseISO(booking.startTime), "EEEE, d. MMMM yyyy 'um' HH:mm 'Uhr'", { locale: de })}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-[#64748B]">Mit</dt>
              <dd className="mt-1 font-medium text-[#1E293B]">{booking.assignedUser.name}</dd>
            </div>
            {booking.meetLink && (
              <div>
                <dt className="text-xs font-medium uppercase tracking-wider text-[#64748B]">Meeting-Link</dt>
                <dd className="mt-2">
                  <a
                    href={booking.meetLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl bg-[#14B8A6] px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-[#0D9488] hover:shadow-md"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Google Meet beitreten
                  </a>
                </dd>
              </div>
            )}
          </dl>
        </div>

        <div className="flex justify-center gap-4 text-sm">
          <a href={booking.rescheduleUrl} className="font-medium text-[#0B8ECA] transition-colors hover:text-[#0874A6]">Termin verschieben</a>
          <span className="text-[#E2E8F0]">|</span>
          <a href={booking.cancelUrl} className="font-medium text-[#EF4444] transition-colors hover:text-red-600">Termin absagen</a>
        </div>
      </div>
    </BrandedLayout>
  );
}
