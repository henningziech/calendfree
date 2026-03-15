import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router';
import { getTeamDetail, getTeamBookings, type TeamBookingsParams } from '../../api/admin';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { BookingCard } from '../../components/bookings/BookingCard';
import { BookingDetailModal } from '../../components/bookings/BookingDetailModal';
import type { Booking } from '../../components/bookings/types';

export function TeamDetailPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const [team, setTeam] = useState<any>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);

  // Filters
  const [page, setPage] = useState(1);
  const [showPast, setShowPast] = useState(false);
  const [filterUserId, setFilterUserId] = useState('');

  const loadTeam = useCallback(async () => {
    if (!teamId) return;
    setIsLoading(true);
    try {
      setTeam(await getTeamDetail(teamId));
    } catch (err: any) {
      setError(err.status === 403 ? 'Kein Zugriff auf dieses Team.' : 'Team nicht gefunden.');
    } finally {
      setIsLoading(false);
    }
  }, [teamId]);

  const loadBookings = useCallback(async () => {
    if (!teamId) return;
    setBookingsLoading(true);
    try {
      const params: TeamBookingsParams = {
        page,
        status: showPast ? 'all' : 'upcoming',
      };
      if (filterUserId) params.userId = filterUserId;
      const data = await getTeamBookings(teamId, params);
      setBookings(data.bookings);
      setTotalPages(data.totalPages);
      setTotal(data.total);
    } catch {
      setBookings([]);
    } finally {
      setBookingsLoading(false);
    }
  }, [teamId, page, showPast, filterUserId]);

  useEffect(() => { loadTeam(); }, [loadTeam]);
  useEffect(() => { loadBookings(); }, [loadBookings]);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [showPast, filterUserId]);

  const handleNotesUpdated = (id: string, notes: string | null) => {
    setBookings((prev) => prev.map((b) => b.id === id ? { ...b, internalNotes: notes } : b));
    if (selectedBooking?.id === id) setSelectedBooking((prev) => prev ? { ...prev, internalNotes: notes } : prev);
  };

  const handleCancelled = (id: string) => {
    setBookings((prev) => prev.map((b) => b.id === id ? { ...b, status: 'CANCELLED' } : b));
  };

  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} />;
  if (!team) return null;

  return (
    <div>
      {/* Back link */}
      <Link to="/dashboard/teams" className="text-sm font-medium text-[#0B8ECA] hover:text-[#0874A6] transition-colors">
        ← Zurück zur Übersicht
      </Link>

      {/* Header */}
      <div className="mt-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-[#1E293B]">{team.name}</h1>
          <span className="rounded-full bg-[#0B8ECA]/10 px-2.5 py-0.5 text-xs font-medium text-[#0B8ECA]">
            {team.rrConfig?.mode?.replace('_', ' ') ?? 'SEQUENTIAL'}
          </span>
        </div>
        {/* Members */}
        <div className="mt-3 flex flex-wrap gap-2">
          {team.memberships?.map((m: any) => (
            <span key={m.user?.id} className="inline-flex items-center gap-1 rounded-full bg-[#F8FAFC] px-3 py-1 text-xs text-[#1E293B] ring-1 ring-[#E2E8F0]">
              {m.user?.name}
              {team.rrConfig?.mode === 'WEIGHTED' && <span className="text-[#64748B]">({m.weight}%)</span>}
            </span>
          ))}
        </div>
      </div>

      {/* Event Types */}
      <div className="mt-8">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[#64748B] mb-3">
          Buchungsseiten ({team.eventTypes?.length ?? 0})
        </h2>
        {team.eventTypes?.length > 0 ? (
          <div className="space-y-2">
            {team.eventTypes.map((et: any) => (
              <div key={et.id} className="flex items-center justify-between rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-sm">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-[#1E293B]">{et.title}</h3>
                  <span className="text-xs text-[#64748B]">{et.duration} Min</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${et.active ? 'bg-teal-100 text-teal-700' : 'bg-[#F8FAFC] text-[#64748B]'}`}>
                    {et.active ? 'Aktiv' : 'Inaktiv'}
                  </span>
                </div>
                <button
                  onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/${team.company?.slug ?? ''}/${et.slug}`); }}
                  className="rounded-lg bg-[#F8FAFC] px-3 py-1.5 text-xs font-medium text-[#1E293B] ring-1 ring-[#E2E8F0] transition-colors hover:bg-[#E2E8F0]"
                >
                  URL kopieren
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[#64748B]">Keine Buchungsseiten für dieses Team.</p>
        )}
      </div>

      {/* Bookings */}
      <div className="mt-8">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[#64748B] mb-3">
          Gebuchte Termine ({total})
        </h2>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4 mb-4">
          <label className="flex items-center gap-2 text-sm text-[#1E293B]">
            <input
              type="checkbox"
              checked={showPast}
              onChange={(e) => setShowPast(e.target.checked)}
              className="rounded border-[#E2E8F0] text-[#0B8ECA] focus:ring-[#0B8ECA]/20"
            />
            Auch vergangene anzeigen
          </label>
          <select
            value={filterUserId}
            onChange={(e) => setFilterUserId(e.target.value)}
            className="rounded-xl border border-[#E2E8F0] px-3 py-1.5 text-sm focus:border-[#0B8ECA] focus:outline-none"
          >
            <option value="">Alle Teammitglieder</option>
            {team.memberships?.map((m: any) => (
              <option key={m.user?.id} value={m.user?.id}>{m.user?.name}</option>
            ))}
          </select>
        </div>

        {/* Booking List */}
        {bookingsLoading ? (
          <LoadingSpinner text="Termine werden geladen..." />
        ) : bookings.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-[#E2E8F0] bg-[#F8FAFC] p-8 text-center">
            <p className="text-sm text-[#64748B]">
              {showPast ? 'Keine Termine gefunden.' : 'Keine kommenden Termine.'}
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {bookings.map((b) => (
                <BookingCard
                  key={b.id}
                  booking={b}
                  onClick={() => setSelectedBooking(b)}
                  showAssignee
                />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="rounded-xl border border-[#E2E8F0] px-4 py-2 text-sm font-medium text-[#1E293B] hover:bg-[#F8FAFC] disabled:opacity-50 transition-colors"
                >
                  ← Zurück
                </button>
                <span className="text-sm text-[#64748B]">
                  Seite {page} von {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="rounded-xl border border-[#E2E8F0] px-4 py-2 text-sm font-medium text-[#1E293B] hover:bg-[#F8FAFC] disabled:opacity-50 transition-colors"
                >
                  Weiter →
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Detail Modal */}
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
