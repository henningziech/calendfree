import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router';
import { getSlots, createBooking, type TimeSlot } from '../../api/booking';
import { SlotPicker } from '../../components/calendar/SlotPicker';
import { BookingForm } from '../../components/forms/BookingForm';
import { BrandedLayout } from '../../components/layout/BrandedLayout';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';

export function BookingPage() {
  const { companySlug, eventTypeSlug } = useParams<{ companySlug: string; eventTypeSlug: string }>();
  const navigate = useNavigate();

  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const loadSlots = useCallback(async () => {
    if (!companySlug || !eventTypeSlug) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await getSlots(companySlug, eventTypeSlug, undefined, timezone);
      setSlots(data.slots);
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

  useEffect(() => { loadSlots(); }, [loadSlots]);

  const handleBooking = async (formData: { name: string; email: string }) => {
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
        loadSlots();
      } else {
        setError('Buchung fehlgeschlagen. Bitte versuchen Sie es erneut.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <BrandedLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{eventTypeSlug?.replace(/-/g, ' ')}</h1>
          <p className="mt-1 text-sm text-gray-500">Wählen Sie einen passenden Termin</p>
        </div>

        {error && <ErrorMessage message={error} onRetry={error.includes('geladen') ? loadSlots : undefined} />}

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
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              ← Anderen Termin wählen
            </button>
            <BookingForm
              onSubmit={handleBooking}
              isSubmitting={isSubmitting}
              eventTypeTitle={eventTypeSlug?.replace(/-/g, ' ') ?? ''}
              selectedTime={format(parseISO(selectedSlot.start), "EEEE, d. MMMM yyyy 'um' HH:mm 'Uhr'", { locale: de })}
            />
          </div>
        )}
      </div>
    </BrandedLayout>
  );
}
