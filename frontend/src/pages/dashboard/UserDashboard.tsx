import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getMyBookings, getTeamBookings } from '../../api/booking';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { BookingCard } from '../../components/bookings/BookingCard';
import { BookingDetailModal } from '../../components/bookings/BookingDetailModal';
import type { Booking } from '../../components/bookings/types';
import { parseISO, isPast } from 'date-fns';

export function UserDashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'mine' | 'team'>('mine');
  const [myBookings, setMyBookings] = useState<Booking[]>([]);
  const [teamBookings, setTeamBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [hasTeamMemberships, setHasTeamMemberships] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [mine, team] = await Promise.all([
        getMyBookings(),
        getTeamBookings().catch(() => []),
      ]);
      setMyBookings(mine);
      setTeamBookings(team);
      setHasTeamMemberships(team.length > 0);
    } catch {
      // silently fail, empty state shown
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleNotesUpdated = (id: string, notes: string | null) => {
    const update = (list: Booking[]) => list.map((b) => b.id === id ? { ...b, internalNotes: notes } : b);
    setMyBookings(update);
    setTeamBookings(update);
    if (selectedBooking?.id === id) setSelectedBooking((prev) => prev ? { ...prev, internalNotes: notes } : prev);
  };

  const handleCancelled = (id: string) => {
    const update = (list: Booking[]) => list.map((b) => b.id === id ? { ...b, status: 'CANCELLED' } : b);
    setMyBookings(update);
    setTeamBookings(update);
  };

  if (isLoading) return <LoadingSpinner />;

  const currentBookings = activeTab === 'mine' ? myBookings : teamBookings;
  const upcoming = currentBookings.filter((b) => !isPast(parseISO(b.startTime)) && b.status === 'CONFIRMED');
  const past = currentBookings.filter((b) => isPast(parseISO(b.startTime)) || b.status !== 'CONFIRMED');

  return (
    <div>
      <h1 className="text-2xl font-bold text-[#1E293B]">Meine Termine</h1>
      <p className="mt-2 text-[#64748B]">Willkommen, {user?.name}.</p>

      {/* Tabs */}
      {hasTeamMemberships && (
        <div className="mt-4 flex gap-1 rounded-xl bg-[#F1F5F9] p-1">
          <button
            onClick={() => setActiveTab('mine')}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
              activeTab === 'mine'
                ? 'bg-white text-[#1E293B] shadow-sm'
                : 'text-[#64748B] hover:text-[#1E293B]'
            }`}
          >
            Meine Termine ({myBookings.length})
          </button>
          <button
            onClick={() => setActiveTab('team')}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
              activeTab === 'team'
                ? 'bg-white text-[#1E293B] shadow-sm'
                : 'text-[#64748B] hover:text-[#1E293B]'
            }`}
          >
            Teamtermine ({teamBookings.length})
          </button>
        </div>
      )}

      {/* Booking List */}
      {currentBookings.length === 0 ? (
        <div className="mt-6 rounded-xl border-2 border-dashed border-[#E2E8F0] bg-[#F8FAFC] p-12 text-center">
          <div className="text-4xl mb-3">📅</div>
          <h3 className="text-lg font-medium text-[#1E293B]">
            {activeTab === 'mine' ? 'Noch keine Termine' : 'Keine Teamtermine'}
          </h3>
          <p className="mt-1 text-sm text-[#64748B]">
            {activeTab === 'mine'
              ? 'Sobald Kunden Termine bei Ihnen buchen, erscheinen sie hier.'
              : 'Sobald Teamkollegen Buchungen erhalten, erscheinen sie hier.'}
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          {upcoming.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[#64748B] mb-3">
                Kommende Termine ({upcoming.length})
              </h2>
              <div className="space-y-2">
                {upcoming.map((b) => (
                  <BookingCard
                    key={b.id}
                    booking={b}
                    onClick={() => setSelectedBooking(b)}
                    showAssignee={activeTab === 'team'}
                  />
                ))}
              </div>
            </div>
          )}

          {past.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[#64748B] mb-3">
                Vergangene / Andere ({past.length})
              </h2>
              <div className="space-y-2">
                {past.map((b) => (
                  <BookingCard
                    key={b.id}
                    booking={b}
                    onClick={() => setSelectedBooking(b)}
                    showAssignee={activeTab === 'team'}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

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
