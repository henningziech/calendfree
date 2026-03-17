import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import { useAuth } from '../../context/AuthContext';
import { getTeamDetail, getTeamBookings, deleteTeam, removeTeamMember, updateTeamName, updateTeamMemberRole, type TeamBookingsParams } from '../../api/admin';
import { apiRequest } from '../../api/client';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { BookingCard } from '../../components/bookings/BookingCard';
import type { Booking } from '../../components/bookings/types';

export function TeamDetailPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [team, setTeam] = useState<any>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [page, setPage] = useState(1);
  const [showPast, setShowPast] = useState(false);
  const [filterUserId, setFilterUserId] = useState('');

  // Editing state
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');

  // Invite state
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState(false);

  const canManage = () => {
    const role = user?.activeRole ?? 'USER';
    if (role === 'ORG_ADMIN' || role === 'COMPANY_ADMIN') return true;
    return team?.memberships?.some((m: any) => m.userId === user?.id && m.role === 'OWNER');
  };

  const isMember = () => team?.memberships?.some((m: any) => m.userId === user?.id);

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

  const handleRename = async () => {
    if (!editName.trim()) return;
    await updateTeamName(teamId!, editName.trim());
    setEditing(false);
    loadTeam();
  };

  const handleDelete = async () => {
    if (!confirm('Team wirklich löschen? Alle zugehörigen Event-Typen verlieren die Team-Zuordnung.')) return;
    await deleteTeam(teamId!);
    navigate('/dashboard/teams');
  };

  const handleToggleRole = async (memberId: string, currentRole: string) => {
    try {
      await updateTeamMemberRole(teamId!, memberId, currentRole === 'OWNER' ? 'MEMBER' : 'OWNER');
      loadTeam();
    } catch (err: any) {
      alert(err.message || 'Fehler beim Ändern der Rolle');
    }
  };

  const handleRemoveMember = async (memberId: string, memberName: string) => {
    if (!confirm(`${memberName} wirklich aus dem Team entfernen?`)) return;
    try {
      await removeTeamMember(teamId!, memberId);
      loadTeam();
    } catch (err: any) {
      alert(err.message || 'Fehler beim Entfernen');
    }
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    try {
      await apiRequest(`/admin/teams/${teamId}/invite`, {
        method: 'POST',
        body: JSON.stringify({ email: inviteEmail.trim() }),
      });
      setInviteEmail('');
      setInviteSuccess(true);
      setTimeout(() => setInviteSuccess(false), 3000);
      loadTeam();
    } catch (err: any) {
      alert(err.message || 'Fehler beim Einladen');
    }
  };

  const handleJoin = async () => {
    await apiRequest(`/admin/teams/${teamId}/join`, { method: 'POST' });
    loadTeam();
  };

  const handleLeave = async () => {
    if (!confirm('Team wirklich verlassen?')) return;
    try {
      await apiRequest(`/admin/teams/${teamId}/leave`, { method: 'POST' });
      navigate('/dashboard/teams');
    } catch (err: any) {
      alert(err.message || 'Fehler');
    }
  };

  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} />;
  if (!team) return null;

  return (
    <div>
      {/* Back link */}
      <Link to="/dashboard/teams" className="text-sm font-medium text-[#0B8ECA] hover:text-[#0874A6] transition-colors">
        &larr; Zurück zu Teams
      </Link>

      {/* Header */}
      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {editing ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') setEditing(false); }}
                className="rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-2xl font-bold text-[#1E293B] focus:border-[#0B8ECA] focus:outline-none"
                autoFocus
              />
              <button
                onClick={handleRename}
                className="rounded-lg bg-[#0B8ECA] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#0874A6] transition-colors"
              >
                Speichern
              </button>
              <button
                onClick={() => setEditing(false)}
                className="rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-sm font-medium text-[#64748B] hover:bg-[#F8FAFC] transition-colors"
              >
                Abbrechen
              </button>
            </div>
          ) : (
            <h1
              className={`text-2xl font-bold text-[#1E293B] ${canManage() ? 'cursor-pointer hover:text-[#0B8ECA] transition-colors' : ''}`}
              onClick={() => {
                if (canManage()) {
                  setEditName(team.name);
                  setEditing(true);
                }
              }}
            >
              {team.name}
            </h1>
          )}
        </div>
        {canManage() && !editing && (
          <button
            onClick={handleDelete}
            className="rounded-lg border border-[#EF4444]/20 px-4 py-2 text-sm font-medium text-[#EF4444] hover:bg-[#EF4444]/5 transition-colors"
          >
            Team löschen
          </button>
        )}
      </div>

      {/* Members Section */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[#64748B]">
            Mitglieder ({team.memberships?.length ?? 0})
          </h2>
          <div className="flex items-center gap-2">
            {!isMember() && (
              <button
                onClick={handleJoin}
                className="rounded-lg bg-[#0B8ECA] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#0874A6] transition-colors"
              >
                Beitreten
              </button>
            )}
            {canManage() && (
              <button
                onClick={() => setShowInvite(!showInvite)}
                className="rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-xs font-medium text-[#1E293B] hover:bg-[#F8FAFC] transition-colors"
              >
                Mitglied einladen
              </button>
            )}
          </div>
        </div>

        {/* Invite form */}
        {showInvite && (
          <div className="mb-4 flex items-center gap-2">
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleInvite(); }}
              placeholder="E-Mail-Adresse"
              className="flex-1 rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-sm focus:border-[#0B8ECA] focus:outline-none"
              autoFocus
            />
            <button
              onClick={handleInvite}
              className="rounded-lg bg-[#0B8ECA] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#0874A6] transition-colors"
            >
              Einladen
            </button>
          </div>
        )}

        {/* Invite success */}
        {inviteSuccess && (
          <div className="mb-4 rounded-lg bg-[#14B8A6]/10 px-4 py-2 text-sm text-[#14B8A6]">
            Einladung erfolgreich gesendet!
          </div>
        )}

        {/* Member list */}
        <div className="space-y-2">
          {team.memberships?.map((m: any) => {
            const memberUser = m.user;
            const initials = (memberUser?.name || memberUser?.email || '?')
              .split(' ')
              .map((w: string) => w[0])
              .join('')
              .slice(0, 2)
              .toUpperCase();

            return (
              <div key={memberUser?.id} className="flex items-center justify-between rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  {/* Avatar */}
                  {memberUser?.picture ? (
                    <img
                      src={memberUser.picture}
                      alt={memberUser.name}
                      className="h-8 w-8 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0B8ECA] text-xs font-semibold text-white">
                      {initials}
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-medium text-[#1E293B]">{memberUser?.name || 'Unbenannt'}</p>
                    <p className="text-xs text-[#64748B]">{memberUser?.email}</p>
                  </div>
                  {/* Role badge */}
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    m.role === 'OWNER'
                      ? 'bg-[#14B8A6]/10 text-[#14B8A6]'
                      : 'bg-[#64748B]/10 text-[#64748B]'
                  }`}>
                    {m.role === 'OWNER' ? 'Owner' : 'Mitglied'}
                  </span>
                </div>
                {/* Actions */}
                {canManage() && memberUser?.id !== user?.id && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleRole(memberUser.id, m.role)}
                      className="rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-xs font-medium text-[#1E293B] hover:bg-[#F8FAFC] transition-colors"
                    >
                      {m.role === 'OWNER' ? 'Owner entfernen' : 'Zum Owner machen'}
                    </button>
                    <button
                      onClick={() => handleRemoveMember(memberUser.id, memberUser.name || memberUser.email)}
                      className="text-xs font-medium text-[#EF4444] hover:text-[#DC2626] transition-colors"
                    >
                      Entfernen
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Leave button */}
        {isMember() && (
          <button
            onClick={handleLeave}
            className="mt-4 rounded-lg border border-[#E2E8F0] px-4 py-2 text-sm font-medium text-[#64748B] hover:bg-[#F8FAFC] transition-colors"
          >
            Team verlassen
          </button>
        )}
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
                  onClick={() => navigate(`/dashboard/bookings/${b.id}`)}
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
                  &larr; Zurück
                </button>
                <span className="text-sm text-[#64748B]">
                  Seite {page} von {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="rounded-xl border border-[#E2E8F0] px-4 py-2 text-sm font-medium text-[#1E293B] hover:bg-[#F8FAFC] disabled:opacity-50 transition-colors"
                >
                  Weiter &rarr;
                </button>
              </div>
            )}
          </>
        )}
      </div>

    </div>
  );
}
