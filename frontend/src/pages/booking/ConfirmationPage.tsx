import { useLocation, Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { BrandedLayout } from '../../components/layout/BrandedLayout';
import type { BookingResponse } from '../../api/booking';
import type { BrandingConfig } from '../../api/branding';
import { format, parseISO } from 'date-fns';
import { getDateLocale } from '../../utils/dateLocale';

export function ConfirmationPage() {
  const location = useLocation();
  const booking = location.state?.booking as BookingResponse | undefined;
  const branding = location.state?.branding as BrandingConfig | undefined;
  const companyName = location.state?.companyName as string | undefined;
  const { t } = useTranslation('booking');

  if (!booking) {
    return (
      <BrandedLayout branding={branding} companyName={companyName}>
        <div className="text-center py-12">
          <p className="text-[#64748B]">{t('confirmation.noData')}</p>
          <Link to="/" className="mt-4 inline-block text-sm font-medium transition-colors" style={{ color: 'var(--color-primary, #0B8ECA)' }}>{t('confirmation.backHome')}</Link>
        </div>
      </BrandedLayout>
    );
  }

  return (
    <BrandedLayout branding={branding} companyName={companyName}>
      <div className="space-y-6 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full" style={{ backgroundColor: 'rgba(var(--color-accent-rgb, 20, 184, 166), 0.1)' }}>
          <svg className="h-8 w-8" style={{ color: 'var(--color-accent, #14B8A6)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text, #1E293B)' }}>{t('confirmation.title')}</h1>
          <p className="mt-2 text-[#64748B]">{t('confirmation.subtitle')}</p>
        </div>

        <div className="rounded-xl border border-[#E2E8F0] bg-white p-6 text-left shadow-sm">
          <dl className="space-y-4">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-[#64748B]">{t('confirmation.when')}</dt>
              <dd className="mt-1 font-medium" style={{ color: 'var(--color-text, #1E293B)' }}>
                {format(parseISO(booking.startTime), "EEEE, d. MMMM yyyy 'um' HH:mm 'Uhr'", { locale: getDateLocale() })}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-[#64748B]">{t('confirmation.with')}</dt>
              <dd className="mt-1 font-medium" style={{ color: 'var(--color-text, #1E293B)' }}>{booking.assignedUser.name}</dd>
            </div>
            {booking.meetLink && (
              <div>
                <dt className="text-xs font-medium uppercase tracking-wider text-[#64748B]">{t('confirmation.meetingLink')}</dt>
                <dd className="mt-2">
                  <a
                    href={booking.meetLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:shadow-md"
                    style={{ backgroundColor: 'var(--color-accent, #14B8A6)' }}
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    {t('confirmation.joinMeet')}
                  </a>
                </dd>
              </div>
            )}
          </dl>
        </div>

        <div className="flex justify-center gap-4 text-sm">
          <a href={booking.rescheduleUrl} className="font-medium transition-colors" style={{ color: 'var(--color-primary, #0B8ECA)' }}>{t('confirmation.reschedule')}</a>
          <span className="text-[#E2E8F0]">|</span>
          <a href={booking.cancelUrl} className="font-medium text-[#EF4444] transition-colors hover:text-red-600">{t('confirmation.cancel')}</a>
        </div>
      </div>
    </BrandedLayout>
  );
}
