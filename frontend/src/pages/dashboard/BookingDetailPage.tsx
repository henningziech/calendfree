import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { getBookingDetail, updateBookingNotes, updateBookingStatus, cancelBookingAsUser, createBookingComment, updateBookingComment, deleteBookingComment } from '../../api/booking';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { HelpTooltip } from '../../components/ui/HelpTooltip';
import { CommentList } from '../../components/bookings/CommentList';
import { statusColor, statusTranslationKey } from '../../components/bookings/types';
import { format, parseISO, isPast } from 'date-fns';
import { getDateLocale } from '../../utils/dateLocale';

export function BookingDetailPage() {
  const { t } = useTranslation(['dashboard', 'common']);
  const { bookingId } = useParams<{ bookingId: string }>();
  const { user } = useAuth();
  const [booking, setBooking] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);

  const load = useCallback(async () => {
    if (!bookingId) return;
    setIsLoading(true);
    try {
      const data = await getBookingDetail(bookingId);
      setBooking(data);
      setNotes(data.internalNotes ?? '');
    } catch (err: any) {
      setError(err.status === 403 ? t('dashboard:bookingDetail.accessDenied') : t('dashboard:bookingDetail.notFound'));
    } finally {
      setIsLoading(false);
    }
  }, [bookingId, t]);

  useEffect(() => { load(); }, [load]);

  const handleSaveNotes = async () => {
    if (!bookingId) return;
    setIsSavingNotes(true);
    try {
      await updateBookingNotes(bookingId, notes);
      setBooking((prev: any) => prev ? { ...prev, internalNotes: notes || null } : prev);
      setNotesSaved(true);
      setTimeout(() => setNotesSaved(false), 2000);
    } catch {
      setError(t('dashboard:bookingDetail.notesError'));
    } finally {
      setIsSavingNotes(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!bookingId) return;
    try {
      await updateBookingStatus(bookingId, newStatus);
      setBooking((prev: any) => prev ? { ...prev, status: newStatus } : prev);
    } catch {
      setError(t('dashboard:bookingDetail.statusError'));
    }
  };

  const handleCancel = async () => {
    if (!bookingId) return;
    if (!confirm(t('dashboard:bookingDetail.confirmCancel'))) return;
    try {
      await cancelBookingAsUser(bookingId);
      setBooking((prev: any) => prev ? { ...prev, status: 'CANCELLED' } : prev);
    } catch {
      setError(t('dashboard:bookingDetail.cancelError'));
    }
  };

  const handleAddComment = async (content: string) => {
    if (!bookingId) return;
    const comment = await createBookingComment(bookingId, content);
    setBooking((prev: any) => prev ? { ...prev, comments: [...(prev.comments ?? []), comment] } : prev);
  };

  const handleEditComment = async (commentId: string, content: string) => {
    if (!bookingId) return;
    const updated = await updateBookingComment(bookingId, commentId, content);
    setBooking((prev: any) => prev ? {
      ...prev,
      comments: prev.comments.map((c: any) => c.id === commentId ? updated : c),
    } : prev);
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!bookingId) return;
    await deleteBookingComment(bookingId, commentId);
    setBooking((prev: any) => prev ? {
      ...prev,
      comments: prev.comments.filter((c: any) => c.id !== commentId),
    } : prev);
  };

  if (isLoading) return <LoadingSpinner />;
  if (error && !booking) return <ErrorMessage message={error} />;
  if (!booking) return null;

  const color = statusColor[booking.status] ?? 'bg-[#F8FAFC] text-[#64748B]';
  const statusText = statusTranslationKey[booking.status]
    ? t(`dashboard:${statusTranslationKey[booking.status]}`)
    : booking.status;
  const comment = booking.formData?.data?._comment;
  const isUpcoming = !isPast(parseISO(booking.startTime)) && booking.status === 'CONFIRMED';

  return (
    <div>
      <Link to="/dashboard" className="text-sm font-medium text-[#0B8ECA] hover:text-[#0874A6] transition-colors">
        {t('dashboard:bookingDetail.backToOverview')}
      </Link>

      {error && <div className="mt-4"><ErrorMessage message={error} /></div>}

      {/* Header */}
      <div className="mt-4 flex items-center gap-3">
        <h1 className="text-2xl font-bold text-[#1E293B]">{booking.eventType.title}</h1>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${color}`}>{statusText}</span>
      </div>

      {/* Info Card */}
      <div className="mt-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] p-5 space-y-2">
        <p className="text-sm font-medium text-[#1E293B]">
          {format(parseISO(booking.startTime), "EEEE, d. MMMM yyyy", { locale: getDateLocale() })}
        </p>
        <p className="text-sm text-[#64748B]">
          {format(parseISO(booking.startTime), "HH:mm", { locale: getDateLocale() })} – {format(parseISO(booking.endTime), "HH:mm 'Uhr'", { locale: getDateLocale() })} ({t('dashboard:bookings.duration', { duration: booking.eventType.duration })})
        </p>
        {booking.assignedUser && (
          <p className="text-sm text-[#64748B]">
            {t('dashboard:bookingDetail.assigned', { name: booking.assignedUser.name, email: booking.assignedUser.email })}
          </p>
        )}
        {booking.eventType.team && (
          <p className="text-xs text-[#64748B]">{t('dashboard:bookingDetail.team', { name: booking.eventType.team.name })}</p>
        )}
      </div>

      {/* Customer Info */}
      {booking.formData && (
        <div className="mt-4 rounded-xl border border-[#E2E8F0] bg-white p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[#64748B] mb-2">{t('dashboard:bookingDetail.customer')}</h2>
          <p className="text-sm font-medium text-[#1E293B]">{booking.formData.name}</p>
          <a href={`mailto:${booking.formData.email}`} className="text-sm text-[#0B8ECA] hover:underline">{booking.formData.email}</a>
          {comment && (
            <div className="mt-3 rounded-lg bg-amber-50 border border-amber-100 p-3">
              <p className="text-xs font-medium text-amber-700 mb-0.5">{t('dashboard:bookingDetail.customerComment')}</p>
              <p className="text-sm text-amber-900">{comment}</p>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="mt-4 flex flex-wrap gap-2">
        {isUpcoming && (
          <>
            <button
              onClick={() => handleStatusChange('COMPLETED')}
              className="rounded-xl bg-teal-50 px-4 py-2 text-sm font-medium text-teal-700 ring-1 ring-teal-200 hover:bg-teal-100 transition-colors"
            >
              {t('dashboard:bookingDetail.markCompleted')}
            </button>
            <button
              onClick={() => handleStatusChange('NO_SHOW')}
              className="rounded-xl bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700 ring-1 ring-amber-200 hover:bg-amber-100 transition-colors"
            >
              {t('dashboard:bookingDetail.noShow')}
            </button>
            <button
              onClick={handleCancel}
              className="rounded-xl bg-red-50 px-4 py-2 text-sm font-medium text-red-700 ring-1 ring-red-200 hover:bg-red-100 transition-colors"
            >
              {t('dashboard:bookingDetail.cancelBooking')}
            </button>
          </>
        )}
        {booking.eventType.company?.slug && (
          <button
            onClick={() => navigator.clipboard.writeText(`${window.location.origin}/${booking.eventType.company.slug}/${booking.eventType.slug}`)}
            className="rounded-xl bg-[#F8FAFC] px-4 py-2 text-sm font-medium text-[#1E293B] ring-1 ring-[#E2E8F0] hover:bg-[#E2E8F0] transition-colors"
          >
            {t('dashboard:bookingDetail.copyBookingUrl')}
          </button>
        )}
      </div>

      {/* Internal Notes */}
      <div className="mt-6 rounded-xl border border-[#E2E8F0] bg-white p-5">
        <div className="flex items-center gap-2 mb-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[#64748B]">{t('dashboard:bookingDetail.internalNotes')}</h2>
          <HelpTooltip text={t('dashboard:bookingDetail.internalNotesHelp')} />
        </div>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="w-full rounded-xl border border-[#E2E8F0] px-4 py-2.5 text-sm shadow-sm transition-all focus:border-[#0B8ECA] focus:ring-2 focus:ring-[#0B8ECA]/20 focus:outline-none resize-none"
          placeholder={t('dashboard:bookingDetail.notesPlaceholder')}
        />
        <div className="mt-2 flex items-center gap-2">
          <button
            onClick={handleSaveNotes}
            disabled={isSavingNotes}
            className="rounded-lg bg-[#0B8ECA] px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-[#0874A6] disabled:opacity-50 transition-colors"
          >
            {isSavingNotes ? t('dashboard:bookingDetail.saving') : t('common:save')}
          </button>
          {notesSaved && <span className="text-xs text-teal-600">{t('dashboard:bookingDetail.saved')}</span>}
        </div>
      </div>

      {/* Comments */}
      <div className="mt-6 rounded-xl border border-[#E2E8F0] bg-white p-5">
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[#64748B]">
            {t('dashboard:bookingDetail.comments', { count: booking.comments?.length ?? 0 })}
          </h2>
          <HelpTooltip text={t('dashboard:bookingDetail.commentsHelp')} />
        </div>
        <CommentList
          comments={booking.comments ?? []}
          currentUserId={user?.id ?? ''}
          onAdd={handleAddComment}
          onEdit={handleEditComment}
          onDelete={handleDeleteComment}
        />
      </div>
    </div>
  );
}
