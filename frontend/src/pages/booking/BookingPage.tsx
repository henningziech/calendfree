import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { getSlots, createBooking, type TimeSlot } from '../../api/booking';
import { apiRequest } from '../../api/client';
import { getCompanyBranding, type BrandingConfig } from '../../api/branding';
import { SlotPicker } from '../../components/calendar/SlotPicker';
import { BookingForm } from '../../components/forms/BookingForm';
import { BrandedLayout } from '../../components/layout/BrandedLayout';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { format, parseISO } from 'date-fns';
import { getDateLocale } from '../../utils/dateLocale';

interface EventTypeInfo {
  title: string;
  description: string | null;
  duration: number;
  allowComment: boolean;
}

export function BookingPage() {
  const { companySlug, eventTypeSlug } = useParams<{ companySlug: string; eventTypeSlug: string }>();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation('booking');

  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [eventInfo, setEventInfo] = useState<EventTypeInfo | null>(null);
  const [branding, setBranding] = useState<BrandingConfig | null>(null);
  const [companyName, setCompanyName] = useState<string>('');
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const [searchParams] = useSearchParams();
  const prefillName = searchParams.get('name') || '';
  const prefillEmail = searchParams.get('email') || '';

  const loadData = useCallback(async () => {
    if (!companySlug || !eventTypeSlug) return;
    setIsLoading(true);
    setError(null);
    try {
      const [slotsData, info, companyInfo] = await Promise.all([
        getSlots(companySlug, eventTypeSlug, undefined, timezone),
        apiRequest<EventTypeInfo>(`/booking/${companySlug}/${eventTypeSlug}/info`),
        getCompanyBranding(companySlug),
      ]);
      setSlots(slotsData.slots);
      setEventInfo(info);
      setBranding(companyInfo.branding);
      setCompanyName(companyInfo.name);
      if (companyInfo.language) {
        i18n.changeLanguage(companyInfo.language);
      }
    } catch (err: any) {
      if (err.status === 404) {
        setError(t('booking.notFound'));
      } else {
        setError(t('booking.loadError'));
      }
    } finally {
      setIsLoading(false);
    }
  }, [companySlug, eventTypeSlug, timezone, i18n, t]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleBooking = async (formData: { name: string; email: string; comment?: string }) => {
    if (!selectedSlot || !companySlug || !eventTypeSlug) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const booking = await createBooking(companySlug, eventTypeSlug, {
        startTime: selectedSlot.start,
        timezone,
        ...formData,
      });
      navigate(`/${companySlug}/${eventTypeSlug}/confirmed`, {
        state: { booking, branding, companyName },
      });
    } catch (err: any) {
      if (err.status === 409) {
        setError(t('booking.slotUnavailable'));
        setSelectedSlot(null);
        loadData();
      } else {
        setError(t('booking.bookingFailed'));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const title = eventInfo?.title ?? eventTypeSlug?.replace(/-/g, ' ') ?? '';

  return (
    <BrandedLayout branding={branding} companyName={companyName}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text, #1E293B)' }}>{title}</h1>
          {eventInfo?.description && (
            <p className="mt-1 text-sm text-[#64748B]">{eventInfo.description}</p>
          )}
          {!eventInfo?.description && (
            <p className="mt-1 text-sm text-[#64748B]">{t('booking.selectAppointment')}</p>
          )}
          {eventInfo && (
            <p className="mt-1 text-xs text-[#64748B]/70">{t('booking.minutes', { count: eventInfo.duration })}</p>
          )}
        </div>

        {error && <ErrorMessage message={error} onRetry={error === t('booking.loadError') ? loadData : undefined} />}

        {isLoading ? (
          <LoadingSpinner text={t('booking.loadingSlots')} />
        ) : !selectedSlot ? (
          <SlotPicker
            slots={slots}
            selectedSlot={selectedSlot}
            onSelectSlot={setSelectedSlot}
            timezone={timezone}
          />
        ) : (
          <div className="space-y-4">
            <button
              onClick={() => setSelectedSlot(null)}
              className="text-sm font-medium transition-colors"
              style={{ color: 'var(--color-primary, #0B8ECA)' }}
            >
              {t('booking.changeSlot')}
            </button>
            <BookingForm
              onSubmit={handleBooking}
              isSubmitting={isSubmitting}
              eventTypeTitle={title}
              selectedTime={format(parseISO(selectedSlot.start), "EEEE, d. MMMM yyyy 'um' HH:mm 'Uhr'", { locale: getDateLocale() })}
              allowComment={eventInfo?.allowComment}
              initialName={prefillName}
              initialEmail={prefillEmail}
            />
          </div>
        )}
      </div>
    </BrandedLayout>
  );
}
