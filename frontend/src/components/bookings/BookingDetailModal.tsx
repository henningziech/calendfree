import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { updateBookingNotes, cancelBookingAsUser } from '../../api/booking';
import { Modal } from '../ui/Modal';
import { format, parseISO, isPast } from 'date-fns';
import { getDateLocale } from '../../utils/dateLocale';
import type { Booking } from './types';
import { statusColor, statusTranslationKey } from './types';

interface BookingDetailModalProps {
  booking: Booking | null;
  open: boolean;
  onClose: () => void;
  onNotesUpdated: (id: string, notes: string | null) => void;
  onCancelled: (id: string) => void;
}

export function BookingDetailModal({ booking, open, onClose, onNotesUpdated, onCancelled }: BookingDetailModalProps) {
  const { t } = useTranslation('dashboard');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    if (booking) setNotes(booking.internalNotes ?? '');
    setSaveMessage(null);
  }, [booking]);

  if (!booking) return null;

  const color = statusColor[booking.status] ?? 'bg-[#F8FAFC] text-[#64748B]';
  const statusText = statusTranslationKey[booking.status]
    ? t(statusTranslationKey[booking.status])
    : booking.status;
  const comment = booking.formData?.data?._comment;
  const isUpcoming = !isPast(parseISO(booking.startTime)) && booking.status === 'CONFIRMED';

  const handleSaveNotes = async () => {
    setIsSaving(true);
    setSaveMessage(null);
    try {
      await updateBookingNotes(booking.id, notes);
      onNotesUpdated(booking.id, notes || null);
      setSaveMessage(t('bookingModal.saved'));
      setTimeout(() => setSaveMessage(null), 2000);
    } catch {
      setSaveMessage(t('bookingModal.saveError'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm(t('bookingModal.confirmCancel'))) return;
    setIsCancelling(true);
    try {
      await cancelBookingAsUser(booking.id);
      onCancelled(booking.id);
      onClose();
    } catch {
      alert(t('bookingModal.cancelError'));
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={booking.eventType.title}>
      <div className="space-y-4">
        {/* Status + Time */}
        <div className="rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] p-4 space-y-2">
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${color}`}>{statusText}</span>
            {booking.eventType.team && (
              <span className="text-xs text-[#64748B]">{t('bookingDetail.team', { name: booking.eventType.team.name })}</span>
            )}
          </div>
          <p className="text-sm font-medium text-[#1E293B]">
            {format(parseISO(booking.startTime), "EEEE, d. MMMM yyyy", { locale: getDateLocale() })}
          </p>
          <p className="text-sm text-[#64748B]">
            {format(parseISO(booking.startTime), "HH:mm", { locale: getDateLocale() })} – {format(parseISO(booking.endTime), "HH:mm 'Uhr'", { locale: getDateLocale() })} ({t('bookings.duration', { duration: booking.eventType.duration })})
          </p>
          {booking.assignedUser && (
            <p className="text-xs text-[#0B8ECA]">{t('bookingDetail.assigned', { name: booking.assignedUser.name, email: booking.assignedUser.email })}</p>
          )}
        </div>

        {/* Customer Info */}
        {booking.formData && (
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#64748B] mb-1">{t('bookingDetail.customer')}</h3>
            <p className="text-sm text-[#1E293B]">{booking.formData.name}</p>
            <a href={`mailto:${booking.formData.email}`} className="text-sm text-[#0B8ECA] hover:underline">{booking.formData.email}</a>
            {comment && (
              <div className="mt-2 rounded-lg bg-amber-50 border border-amber-100 p-3">
                <p className="text-xs font-medium text-amber-700 mb-0.5">{t('bookingDetail.customerComment')}</p>
                <p className="text-sm text-amber-900">{comment}</p>
              </div>
            )}
          </div>
        )}

        {/* Internal Notes */}
        <div>
          <label htmlFor="internal-notes" className="text-xs font-semibold uppercase tracking-wider text-[#64748B]">
            {t('bookingModal.internalNotes')}
          </label>
          <textarea
            id="internal-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="mt-1 block w-full rounded-xl border border-[#E2E8F0] px-4 py-2.5 text-sm shadow-sm transition-all focus:border-[#0B8ECA] focus:ring-2 focus:ring-[#0B8ECA]/20 focus:outline-none resize-none"
            placeholder={t('bookingModal.notesPlaceholder')}
          />
          <div className="mt-2 flex items-center gap-2">
            <button
              onClick={handleSaveNotes}
              disabled={isSaving}
              className="rounded-lg bg-[#0B8ECA] px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-[#0874A6] disabled:opacity-50 transition-colors"
            >
              {isSaving ? t('bookingDetail.saving') : t('bookingModal.saveNotes')}
            </button>
            {saveMessage && (
              <span className={`text-xs ${saveMessage === t('bookingModal.saved') ? 'text-teal-600' : 'text-red-600'}`}>
                {saveMessage}
              </span>
            )}
          </div>
        </div>

        {/* Action buttons */}
        {isUpcoming && (
          <div className="flex gap-2 pt-2 border-t border-[#E2E8F0]">
            <button
              onClick={handleCancel}
              disabled={isCancelling}
              className="flex-1 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50 transition-colors"
            >
              {isCancelling ? t('bookingModal.cancelling') : t('bookingModal.cancel')}
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}
