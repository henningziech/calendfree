import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router';
import { getSlots, createBooking, type TimeSlot } from '../../api/booking';
import { apiRequest } from '../../api/client';
import { SlotPicker } from '../../components/calendar/SlotPicker';
import { BookingForm } from '../../components/forms/BookingForm';
import { BrandedLayout } from '../../components/layout/BrandedLayout';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';

interface EventTypeInfo {
  title: string;
  description: string | null;
  duration: number;
  allowComment: boolean;
}

export function BookingPage() {
  const { companySlug, eventTypeSlug } = useParams<{ companySlug: string; eventTypeSlug: string }>();
  const navigate = useNavigate();

  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [eventInfo, setEventInfo] = useState<EventTypeInfo | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const loadData = useCallback(async () => {
    if (!companySlug || !eventTypeSlug) return;
    setIsLoading(true);
    setError(null);
    try {
      const [slotsData, info] = await Promise.all([
        getSlots(companySlug, eventTypeSlug, undefined, timezone),
        apiRequest<EventTypeInfo>(`/booking/${companySlug}/${eventTypeSlug}/info`),
      ]);
      setSlots(slotsData.slots);
      setEventInfo(info);
    } catch (err: any) {
      if (err.status === 404) {
        setError('Buchungsseite nicht gefunden.');
      } else {
        setError('Termine konnten nicht geladen werden.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [companySlug, eventTypeSlug, timezone]);

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
        state: { booking },
      });
    } catch (err: any) {
      if (err.status === 409) {
        setError('Dieser Slot ist leider nicht mehr verfügbar. Bitte wählen Sie einen anderen.');
        setSelectedSlot(null);
        loadData();
      } else {
        setError('Buchung fehlgeschlagen. Bitte versuchen Sie es erneut.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const title = eventInfo?.title ?? eventTypeSlug?.replace(/-/g, ' ') ?? '';

  return (
    <BrandedLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-[#1E293B]">{title}</h1>
          {eventInfo?.description && (
            <p className="mt-1 text-sm text-[#64748B]">{eventInfo.description}</p>
          )}
          {!eventInfo?.description && (
            <p className="mt-1 text-sm text-[#64748B]">Wählen Sie einen passenden Termin</p>
          )}
          {eventInfo && (
            <p className="mt-1 text-xs text-[#64748B]/70">{eventInfo.duration} Minuten</p>
          )}
        </div>

        {error && <ErrorMessage message={error} onRetry={error.includes('geladen') ? loadData : undefined} />}

        {isLoading ? (
          <LoadingSpinner text="Verfügbare Termine werden geladen..." />
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
              className="text-sm font-medium text-[#0B8ECA] transition-colors hover:text-[#0874A6]"
            >
              ← Anderen Termin wählen
            </button>
            <BookingForm
              onSubmit={handleBooking}
              isSubmitting={isSubmitting}
              eventTypeTitle={title}
              selectedTime={format(parseISO(selectedSlot.start), "EEEE, d. MMMM yyyy 'um' HH:mm 'Uhr'", { locale: de })}
              allowComment={eventInfo?.allowComment}
            />
          </div>
        )}
      </div>
    </BrandedLayout>
  );
}
