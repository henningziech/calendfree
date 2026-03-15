import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router';
import { useAuth } from '../../context/AuthContext';
import { getUserDetail, updateUserStatus, getUserBookings, deleteUser } from '../../api/admin';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { HelpTooltip } from '../../components/ui/HelpTooltip';
import { BookingCard } from '../../components/bookings/BookingCard';
import { BookingDetailModal } from '../../components/bookings/BookingDetailModal';
import type { Booking } from '../../components/bookings/types';

export function UserDetailPage() {
  const { userId } = useParams<{ userId: string }>();
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const [userDetail, setUserDetail] = useState<any>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [isSavingStatus, setIsSavingStatus] = useState(false);
  const [absentUntilInput, setAbsentUntilInput] = useState('');

  const load = useCallback(async () => {
    if (!userId) return;
    setIsLoading(true);
    try {
      const [detail, bk] = await Promise.all([
        getUserDetail(userId),
        getUserBookings(userId),
      ]);
      setUserDetail(detail);
      setBookings(bk);
      setAbsentUntilInput(detail.absentUntil ? detail.absentUntil.split('T')[0] : '');
    } catch (err: any) {
      setError(err.status === 404 ? 'User nicht gefunden.' : 'Fehler beim Laden.');
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const handleStatusToggle = async () => {
    if (!userId || !userDetail) return;
    setIsSavingStatus(true);
    const newStatus = userDetail.status === 'AVAILABLE' ? 'ABSENT' : 'AVAILABLE';
    try {
      await updateUserStatus(
        userId,
        newStatus,
        newStatus === 'ABSENT' && absentUntilInput ? absentUntilInput : undefined,
      );
      setUserDetail({ ...userDetail, status: newStatus, absentUntil: newStatus === 'ABSENT' && absentUntilInput ? absentUntilInput : null });
    } catch {
      setError('Status konnte nicht geändert werden.');
    } finally {
      setIsSavingStatus(false);
    }
  };

  const handleAbsentUntilSave = async () => {
    if (!userId || userDetail?.status !== 'ABSENT') return;
    setIsSavingStatus(true);
    try {
      await updateUserStatus(userId, 'ABSENT', absentUntilInput || undefined);
      setUserDetail({ ...userDetail, absentUntil: absentUntilInput || null });
    } catch {
      setError('Datum konnte nicht gespeichert werden.');
    } finally {
      setIsSavingStatus(false);
    }
  };

  const handleDelete = async () => {
    if (!userId) return;
    if (!confirm(`${userDetail?.name} wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.`)) return;
    try {
      await deleteUser(userId);
      navigate('/admin/users');
    } catch (err: any) {
      setError(err.message ?? 'Fehler beim Löschen.');
    }
  };

  const handleNotesUpdated = (id: string, notes: string | null) => {
    setBookings((prev) => prev.map((b) => b.id === id ? { ...b, internalNotes: notes } : b));
    if (selectedBooking?.id === id) setSelectedBooking((prev) => prev ? { ...prev, internalNotes: notes } : prev);
  };

  const handleCancelled = (id: string) => {
    setBookings((prev) => prev.map((b) => b.id === id ? { ...b, status: 'CANCELLED' } : b));
  };

  if (isLoading) return <LoadingSpinner />;
  if (error && !userDetail) return <ErrorMessage message={error} />;
  if (!userDetail) return null;

  const isAbsent = userDetail.status === 'ABSENT';

  return (
    <div>
      <Link to="/admin/users" className="text-sm font-medium text-[#0B8ECA] hover:text-[#0874A6] transition-colors">
        ← Zurück zur Übersicht
      </Link>

      {error && <div className="mt-4"><ErrorMessage message={error} /></div>}

      {/* Header */}
      <div className="mt-4 flex items-center gap-4">
        {userDetail.avatarUrl && <img src={userDetail.avatarUrl} className="h-14 w-14 rounded-full ring-2 ring-[#E2E8F0]" alt="" />}
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-[#1E293B]">{userDetail.name}</h1>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${isAbsent ? 'bg-red-100 text-red-700' : 'bg-teal-100 text-teal-700'}`}>
              {isAbsent ? 'Abwesend' : 'Verfügbar'}
            </span>
          </div>
          <p className="text-sm text-[#64748B]">{userDetail.email}</p>
          <p className="text-xs text-[#64748B]/70">
            {userDetail.googleTokens?.connected ? 'Google Kalender verbunden' : 'Google nicht verbunden'}
          </p>
        </div>
      </div>

      {/* Status Section */}
      <div className="mt-6 rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-sm font-semibold text-[#1E293B]">Verfügbarkeitsstatus</h2>
          <HelpTooltip text="Abwesende User werden in Team-Buchungsseiten nicht berücksichtigt (Round-Robin, Verfügbarkeit)." />
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <button
            onClick={handleStatusToggle}
            disabled={isSavingStatus}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition-all ${
              isAbsent
                ? 'bg-teal-50 text-teal-700 ring-1 ring-teal-200 hover:bg-teal-100'
                : 'bg-red-50 text-red-700 ring-1 ring-red-200 hover:bg-red-100'
            } disabled:opacity-50`}
          >
            {isSavingStatus ? 'Wird gespeichert...' : isAbsent ? 'Auf Verfügbar setzen' : 'Auf Abwesend setzen'}
          </button>

          {isAbsent && (
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1 text-sm text-[#64748B]">
                Abwesend bis
                <HelpTooltip text="Optional. Wird das Datum erreicht, wechselt der Status automatisch zurück auf Verfügbar." />
              </label>
              <input
                type="date"
                value={absentUntilInput}
                onChange={(e) => setAbsentUntilInput(e.target.value)}
                className="rounded-xl border border-[#E2E8F0] px-3 py-1.5 text-sm focus:border-[#0B8ECA] focus:outline-none"
              />
              <button
                onClick={handleAbsentUntilSave}
                disabled={isSavingStatus}
                className="rounded-lg bg-[#0B8ECA] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#0874A6] disabled:opacity-50"
              >
                Speichern
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Memberships */}
      <div className="mt-6 rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-[#1E293B] mb-3">Mitgliedschaften</h2>

        {userDetail.companyMemberships?.length > 0 && (
          <div className="mb-3">
            <p className="text-xs font-medium text-[#64748B] mb-1.5">Companies</p>
            <div className="flex flex-wrap gap-2">
              {userDetail.companyMemberships.map((cm: any) => (
                <span key={cm.company.id} className="inline-flex items-center gap-1.5 rounded-full bg-[#F8FAFC] px-3 py-1 text-xs text-[#1E293B] ring-1 ring-[#E2E8F0]">
                  {cm.company.name}
                  <span className="text-[#0B8ECA]">{cm.role}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {userDetail.teamMemberships?.length > 0 && (
          <div>
            <p className="text-xs font-medium text-[#64748B] mb-1.5">Teams</p>
            <div className="flex flex-wrap gap-2">
              {userDetail.teamMemberships.map((tm: any) => (
                <span key={tm.team.id} className="rounded-full bg-[#F8FAFC] px-3 py-1 text-xs text-[#1E293B] ring-1 ring-[#E2E8F0]">
                  {tm.team.name}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Upcoming Bookings */}
      <div className="mt-6">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[#64748B] mb-3">
          Kommende Termine ({bookings.length})
        </h2>
        {bookings.length === 0 ? (
          <p className="text-sm text-[#64748B]">Keine kommenden Termine.</p>
        ) : (
          <div className="space-y-2">
            {bookings.map((b) => (
              <BookingCard key={b.id} booking={b} onClick={() => setSelectedBooking(b)} />
            ))}
          </div>
        )}
      </div>

      {/* Danger Zone */}
      {currentUser?.activeRole === 'ORG_ADMIN' && userId !== currentUser?.id && (
        <div className="mt-8 rounded-xl border border-red-200 bg-red-50/50 p-5">
          <div className="flex items-center gap-2 mb-2">
            <h2 className="text-sm font-semibold text-red-700">Danger Zone</h2>
            <HelpTooltip text="Entfernt den User und alle seine Mitgliedschaften. Bestehende Buchungen bleiben erhalten." />
          </div>
          <button
            onClick={handleDelete}
            className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors"
          >
            User löschen
          </button>
        </div>
      )}

      {/* Booking Detail Modal */}
      <BookingDetailModal
        booking={selectedBooking}
        open={!!selectedBooking}
        onClose={() => setSelectedBooking(null)}
        onNotesUpdated={handleNotesUpdated}
        onCancelled={handleCancelled}
      />
    </div>
  );
}
