import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { getTeamDetail, getTeamBookings, deleteTeam, removeTeamMember, updateTeamName, updateTeamMemberRole, type TeamBookingsParams } from '../../api/admin';
import { apiRequest } from '../../api/client';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { BookingCard } from '../../components/bookings/BookingCard';
import type { Booking } from '../../components/bookings/types';

export function TeamDetailPage() {
  const { t } = useTranslation(['dashboard', 'common']);
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
      setError(err.status === 403 ? t('dashboard:teams.accessDenied') : t('dashboard:teams.notFound'));
    } finally {
      setIsLoading(false);
    }
  }, [teamId, t]);

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
    if (!confirm(t('dashboard:teams.confirmDelete'))) return;
    await deleteTeam(teamId!);
    navigate('/dashboard/teams');
  };

  const handleToggleRole = async (memberId: string, currentRole: string) => {
    try {
      await updateTeamMemberRole(teamId!, memberId, currentRole === 'OWNER' ? 'MEMBER' : 'OWNER');
      loadTeam();
    } catch (err: any) {
      alert(err.message || t('dashboard:teams.roleChangeError'));
    }
  };

  const handleRemoveMember = async (memberId: string, memberName: string) => {
    if (!confirm(t('dashboard:teams.confirmRemove', { name: memberName }))) return;
    try {
      await removeTeamMember(teamId!, memberId);
      loadTeam();
    } catch (err: any) {
      alert(err.message || t('dashboard:teams.removeError'));
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
      alert(err.message || t('dashboard:teams.inviteError'));
    }
  };

  const handleJoin = async () => {
    await apiRequest(`/admin/teams/${teamId}/join`, { method: 'POST' });
    loadTeam();
  };

  const handleLeave = async () => {
    if (!confirm(t('dashboard:teams.confirmLeave'))) return;
    try {
      await apiRequest(`/admin/teams/${teamId}/leave`, { method: 'POST' });
      navigate('/dashboard/teams');
    } catch (err: any) {
      alert(err.message || t('dashboard:teams.leaveError'));
    }
  };

  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} />;
  if (!team) return null;

  return (
    <div>
      {/* Back link */}
      <Link to="/dashboard/teams" className="text-sm font-medium text-[#0B8ECA] hover:text-[#0874A6] transition-colors">
        {t('dashboard:teams.backToTeams')}
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
                {t('common:save')}
              </button>
              <button
                onClick={() => setEditing(false)}
                className="rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-sm font-medium text-[#64748B] hover:bg-[#F8FAFC] transition-colors"
              >
                {t('common:cancel')}
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
            {t('dashboard:teams.deleteTeam')}
          </button>
        )}
      </div>

      {/* Members Section */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[#64748B]">
            {t('dashboard:teams.members_heading', { count: team.memberships?.length ?? 0 })}
          </h2>
          <div className="flex items-center gap-2">
            {!isMember() && (
              <button
                onClick={handleJoin}
                className="rounded-lg bg-[#0B8ECA] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#0874A6] transition-colors"
              >
                {t('dashboard:teams.join')}
              </button>
            )}
            {canManage() && (
              <button
                onClick={() => setShowInvite(!showInvite)}
                className="rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-xs font-medium text-[#1E293B] hover:bg-[#F8FAFC] transition-colors"
              >
                {t('dashboard:teams.inviteMember')}
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
              placeholder={t('dashboard:teams.emailPlaceholder')}
              className="flex-1 rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-sm focus:border-[#0B8ECA] focus:outline-none"
              autoFocus
            />
            <button
              onClick={handleInvite}
              className="rounded-lg bg-[#0B8ECA] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#0874A6] transition-colors"
            >
              {t('dashboard:teams.invite')}
            </button>
          </div>
        )}

        {/* Invite success */}
        {inviteSuccess && (
          <div className="mb-4 rounded-lg bg-[#14B8A6]/10 px-4 py-2 text-sm text-[#14B8A6]">
            {t('dashboard:teams.inviteSuccess')}
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
                    <p className="text-sm font-medium text-[#1E293B]">{memberUser?.name || t('dashboard:teams.unnamed')}</p>
                    <p className="text-xs text-[#64748B]">{memberUser?.email}</p>
                  </div>
                  {/* Role badge */}
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    m.role === 'OWNER'
                      ? 'bg-[#14B8A6]/10 text-[#14B8A6]'
                      : 'bg-[#64748B]/10 text-[#64748B]'
                  }`}>
                    {m.role === 'OWNER' ? t('dashboard:teams.owner') : t('dashboard:teams.member')}
                  </span>
                </div>
                {/* Actions */}
                {canManage() && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleRole(memberUser.id, m.role)}
                      className="rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-xs font-medium text-[#1E293B] hover:bg-[#F8FAFC] transition-colors"
                    >
                      {m.role === 'OWNER' ? t('dashboard:teams.removeOwner') : t('dashboard:teams.makeOwner')}
                    </button>
                    {memberUser?.id !== user?.id && (
                      <button
                        onClick={() => handleRemoveMember(memberUser.id, memberUser.name || memberUser.email)}
                        className="text-xs font-medium text-[#EF4444] hover:text-[#DC2626] transition-colors"
                      >
                        {t('dashboard:teams.remove')}
                      </button>
                    )}
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
            {t('dashboard:teams.leaveTeam')}
          </button>
        )}
      </div>

      {/* Event Types */}
      <div className="mt-8">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[#64748B] mb-3">
          {t('dashboard:teams.eventTypesHeading', { count: team.eventTypes?.length ?? 0 })}
        </h2>
        {team.eventTypes?.length > 0 ? (
          <div className="space-y-2">
            {team.eventTypes.map((et: any) => (
              <div key={et.id} className="flex items-center justify-between rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-sm">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-[#1E293B]">{et.title}</h3>
                  <span className="text-xs text-[#64748B]">{et.duration} {t('dashboard:eventTypes.minutes')}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${et.active ? 'bg-teal-100 text-teal-700' : 'bg-[#F8FAFC] text-[#64748B]'}`}>
                    {et.active ? t('common:active') : t('common:inactive')}
                  </span>
                </div>
                <button
                  onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/${team.company?.slug ?? ''}/${et.slug}`); }}
                  className="rounded-lg bg-[#F8FAFC] px-3 py-1.5 text-xs font-medium text-[#1E293B] ring-1 ring-[#E2E8F0] transition-colors hover:bg-[#E2E8F0]"
                >
                  {t('dashboard:teams.copyUrl')}
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[#64748B]">{t('dashboard:teams.noEventTypes')}</p>
        )}
      </div>

      {/* Bookings */}
      <div className="mt-8">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[#64748B] mb-3">
          {t('dashboard:teams.bookedAppointments', { count: total })}
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
            {t('dashboard:teams.showPast')}
          </label>
          <select
            value={filterUserId}
            onChange={(e) => setFilterUserId(e.target.value)}
            className="rounded-xl border border-[#E2E8F0] px-3 py-1.5 text-sm focus:border-[#0B8ECA] focus:outline-none"
          >
            <option value="">{t('dashboard:teams.allMembers')}</option>
            {team.memberships?.map((m: any) => (
              <option key={m.user?.id} value={m.user?.id}>{m.user?.name}</option>
            ))}
          </select>
        </div>

        {/* Booking List */}
        {bookingsLoading ? (
          <LoadingSpinner text={t('dashboard:teams.loadingBookings')} />
        ) : bookings.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-[#E2E8F0] bg-[#F8FAFC] p-8 text-center">
            <p className="text-sm text-[#64748B]">
              {showPast ? t('dashboard:teams.noBookingsFound') : t('dashboard:teams.noUpcomingBookings')}
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
                  {t('dashboard:availability.previousPage')}
                </button>
                <span className="text-sm text-[#64748B]">
                  {t('dashboard:availability.pageOf', { page, total: totalPages })}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="rounded-xl border border-[#E2E8F0] px-4 py-2 text-sm font-medium text-[#1E293B] hover:bg-[#F8FAFC] disabled:opacity-50 transition-colors"
                >
                  {t('dashboard:availability.nextPage')}
                </button>
              </div>
            )}
          </>
        )}
      </div>

    </div>
  );
}
