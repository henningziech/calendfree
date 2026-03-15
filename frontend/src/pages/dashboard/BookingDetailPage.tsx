import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router';
import { useAuth } from '../../context/AuthContext';
import { getBookingDetail, updateBookingNotes, updateBookingStatus, cancelBookingAsUser, createBookingComment, updateBookingComment, deleteBookingComment } from '../../api/booking';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { HelpTooltip } from '../../components/ui/HelpTooltip';
import { CommentList } from '../../components/bookings/CommentList';
import { format, parseISO, isPast } from 'date-fns';
import { de } from 'date-fns/locale';

const statusLabel: Record<string, { text: string; color: string }> = {
  CONFIRMED: { text: 'Bestätigt', color: 'bg-teal-100 text-teal-700' },
  CANCELLED: { text: 'Abgesagt', color: 'bg-red-100 text-red-700' },
  RESCHEDULED: { text: 'Verschoben', color: 'bg-amber-100 text-amber-700' },
  COMPLETED: { text: 'Abgeschlossen', color: 'bg-[#F8FAFC] text-[#64748B]' },
  NO_SHOW: { text: 'No-Show', color: 'bg-red-100 text-red-600' },
  PENDING_CALENDAR_SYNC: { text: 'Sync ausstehend', color: 'bg-amber-100 text-amber-700' },
};

export function BookingDetailPage() {
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
      setError(err.status === 403 ? 'Kein Zugriff auf diesen Termin.' : 'Termin nicht gefunden.');
    } finally {
      setIsLoading(false);
    }
  }, [bookingId]);

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
      setError('Notizen konnten nicht gespeichert werden.');
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
      setError('Status konnte nicht geändert werden.');
    }
  };

  const handleCancel = async () => {
    if (!bookingId) return;
    if (!confirm('Termin wirklich absagen? Der Google Calendar Eintrag wird gelöscht.')) return;
    try {
      await cancelBookingAsUser(bookingId);
      setBooking((prev: any) => prev ? { ...prev, status: 'CANCELLED' } : prev);
    } catch {
      setError('Fehler beim Absagen.');
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

  const st = statusLabel[booking.status] ?? { text: booking.status, color: 'bg-[#F8FAFC] text-[#64748B]' };
  const comment = booking.formData?.data?._comment;
  const isUpcoming = !isPast(parseISO(booking.startTime)) && booking.status === 'CONFIRMED';

  return (
    <div>
      <Link to="/dashboard" className="text-sm font-medium text-[#0B8ECA] hover:text-[#0874A6] transition-colors">
        ← Zurück zur Übersicht
      </Link>

      {error && <div className="mt-4"><ErrorMessage message={error} /></div>}

      {/* Header */}
      <div className="mt-4 flex items-center gap-3">
        <h1 className="text-2xl font-bold text-[#1E293B]">{booking.eventType.title}</h1>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${st.color}`}>{st.text}</span>
      </div>

      {/* Info Card */}
      <div className="mt-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] p-5 space-y-2">
        <p className="text-sm font-medium text-[#1E293B]">
          {format(parseISO(booking.startTime), "EEEE, d. MMMM yyyy", { locale: de })}
        </p>
        <p className="text-sm text-[#64748B]">
          {format(parseISO(booking.startTime), "HH:mm", { locale: de })} – {format(parseISO(booking.endTime), "HH:mm 'Uhr'", { locale: de })} ({booking.eventType.duration} Min)
        </p>
        {booking.assignedUser && (
          <p className="text-sm text-[#64748B]">
            Zugewiesen: <span className="text-[#0B8ECA]">{booking.assignedUser.name}</span> ({booking.assignedUser.email})
          </p>
        )}
        {booking.eventType.team && (
          <p className="text-xs text-[#64748B]">Team: {booking.eventType.team.name}</p>
        )}
      </div>

      {/* Customer Info */}
      {booking.formData && (
        <div className="mt-4 rounded-xl border border-[#E2E8F0] bg-white p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[#64748B] mb-2">Kunde</h2>
          <p className="text-sm font-medium text-[#1E293B]">{booking.formData.name}</p>
          <a href={`mailto:${booking.formData.email}`} className="text-sm text-[#0B8ECA] hover:underline">{booking.formData.email}</a>
          {comment && (
            <div className="mt-3 rounded-lg bg-amber-50 border border-amber-100 p-3">
              <p className="text-xs font-medium text-amber-700 mb-0.5">Kommentar vom Kunden:</p>
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
              Als abgeschlossen markieren
            </button>
            <button
              onClick={() => handleStatusChange('NO_SHOW')}
              className="rounded-xl bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700 ring-1 ring-amber-200 hover:bg-amber-100 transition-colors"
            >
              No-Show
            </button>
            <button
              onClick={handleCancel}
              className="rounded-xl bg-red-50 px-4 py-2 text-sm font-medium text-red-700 ring-1 ring-red-200 hover:bg-red-100 transition-colors"
            >
              Absagen
            </button>
          </>
        )}
        {booking.eventType.company?.slug && (
          <button
            onClick={() => navigator.clipboard.writeText(`${window.location.origin}/${booking.eventType.company.slug}/${booking.eventType.slug}`)}
            className="rounded-xl bg-[#F8FAFC] px-4 py-2 text-sm font-medium text-[#1E293B] ring-1 ring-[#E2E8F0] hover:bg-[#E2E8F0] transition-colors"
          >
            Buchungsseiten-URL kopieren
          </button>
        )}
      </div>

      {/* Internal Notes */}
      <div className="mt-6 rounded-xl border border-[#E2E8F0] bg-white p-5">
        <div className="flex items-center gap-2 mb-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[#64748B]">Interne Notizen</h2>
          <HelpTooltip text="Private Notizen, nur für Sie sichtbar. Für Team-Kommunikation nutzen Sie die Kommentare unten." />
        </div>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="w-full rounded-xl border border-[#E2E8F0] px-4 py-2.5 text-sm shadow-sm transition-all focus:border-[#0B8ECA] focus:ring-2 focus:ring-[#0B8ECA]/20 focus:outline-none resize-none"
          placeholder="Notizen zum Termin..."
        />
        <div className="mt-2 flex items-center gap-2">
          <button
            onClick={handleSaveNotes}
            disabled={isSavingNotes}
            className="rounded-lg bg-[#0B8ECA] px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-[#0874A6] disabled:opacity-50 transition-colors"
          >
            {isSavingNotes ? 'Speichert...' : 'Speichern'}
          </button>
          {notesSaved && <span className="text-xs text-teal-600">Gespeichert</span>}
        </div>
      </div>

      {/* Comments */}
      <div className="mt-6 rounded-xl border border-[#E2E8F0] bg-white p-5">
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[#64748B]">
            Kommentare ({booking.comments?.length ?? 0})
          </h2>
          <HelpTooltip text="Kommentare sind für alle Teammitglieder sichtbar, die Zugriff auf diesen Termin haben." />
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
