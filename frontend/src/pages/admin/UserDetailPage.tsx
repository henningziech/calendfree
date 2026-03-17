import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { getUserDetail, updateUserStatus, getUserBookings, deleteUser, getCompanies, getTeams } from '../../api/admin';
import { apiRequest } from '../../api/client';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { HelpTooltip } from '../../components/ui/HelpTooltip';
import { BookingCard } from '../../components/bookings/BookingCard';
import { BookingDetailModal } from '../../components/bookings/BookingDetailModal';
import { formatDateLocalized } from '../../utils/dateLocale';
import type { Booking } from '../../components/bookings/types';

export function UserDetailPage() {
  const { userId } = useParams<{ userId: string }>();
  const { user: currentUser } = useAuth();
  const { t } = useTranslation(['admin', 'common']);
  const navigate = useNavigate();
  const [userDetail, setUserDetail] = useState<any>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [isSavingStatus, setIsSavingStatus] = useState(false);
  const [absentUntilInput, setAbsentUntilInput] = useState('');
  const [allCompanies, setAllCompanies] = useState<any[]>([]);
  const [allTeams, setAllTeams] = useState<any[]>([]);
  const [addCompanyId, setAddCompanyId] = useState('');
  const [addCompanyRole, setAddCompanyRole] = useState('USER');
  const [addTeamId, setAddTeamId] = useState('');

  const load = useCallback(async () => {
    if (!userId) return;
    setIsLoading(true);
    try {
      const [detail, bk, companies] = await Promise.all([
        getUserDetail(userId),
        getUserBookings(userId),
        getCompanies().catch(() => []),
      ]);
      setUserDetail(detail);
      setBookings(bk);
      setAllCompanies(companies);
      // Load all teams from all companies the user is in
      const companyIds = detail.companyMemberships?.map((cm: any) => cm.company.id) ?? [];
      const teamsArrays = await Promise.all(companyIds.map((cid: string) => getTeams(cid).catch(() => [])));
      setAllTeams(teamsArrays.flat());
      setAbsentUntilInput(detail.absentUntil ? detail.absentUntil.split('T')[0] : '');
    } catch (err: any) {
      setError(err.status === 404 ? t('admin:userDetail.notFound') : t('admin:userDetail.loadError'));
    } finally {
      setIsLoading(false);
    }
  }, [userId, t]);

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
      setError(t('admin:userDetail.statusChangeError'));
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
      setError(t('admin:userDetail.dateChangeError'));
    } finally {
      setIsSavingStatus(false);
    }
  };

  const handleDelete = async () => {
    if (!userId) return;
    if (!confirm(t('admin:userDetail.deleteConfirm', { name: userDetail?.name }))) return;
    try {
      await deleteUser(userId);
      navigate('/admin/users');
    } catch (err: any) {
      setError(err.message ?? t('admin:userDetail.deleteError'));
    }
  };

  const handleRoleChange = async (companyId: string, newRole: string) => {
    if (!userId) return;
    try {
      await apiRequest(`/admin/companies/${companyId}/users/${userId}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role: newRole }),
      });
      load();
    } catch {
      setError(t('admin:userDetail.roleChangeError'));
    }
  };

  const handleAddToCompany = async () => {
    if (!userId || !addCompanyId) return;
    try {
      await apiRequest(`/admin/companies/${addCompanyId}/users`, {
        method: 'POST',
        body: JSON.stringify({ email: userDetail.email, name: userDetail.name, role: addCompanyRole }),
      });
      setAddCompanyId('');
      setAddCompanyRole('USER');
      load();
    } catch (err: any) {
      setError(err.message ?? t('admin:userDetail.addToCompanyError'));
    }
  };

  const handleRemoveFromCompany = async (companyId: string) => {
    if (!userId) return;
    if (!confirm(t('admin:userDetail.removeFromCompanyConfirm'))) return;
    try {
      await apiRequest(`/admin/companies/${companyId}/users/${userId}`, { method: 'DELETE' });
      load();
    } catch {
      setError(t('admin:userDetail.removeFromCompanyError'));
    }
  };

  const handleRemoveFromTeam = async (teamId: string) => {
    if (!userId) return;
    if (!confirm(t('admin:userDetail.removeFromTeamConfirm'))) return;
    try {
      await apiRequest(`/admin/teams/${teamId}/members/${userId}`, { method: 'DELETE' });
      load();
    } catch {
      setError(t('admin:userDetail.removeFromTeamError'));
    }
  };

  const handleAddToTeam = async (teamId: string) => {
    if (!userId) return;
    try {
      await apiRequest(`/admin/teams/${teamId}/members`, {
        method: 'POST',
        body: JSON.stringify({ userId, weight: 100 }),
      });
      load();
    } catch (err: any) {
      setError(err.message ?? t('admin:userDetail.addToTeamError'));
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

  /** Format last login date using locale-aware formatting. */
  const formatLastLogin = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString(undefined, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div>
      <Link to="/admin/users" className="text-sm font-medium text-[#0B8ECA] hover:text-[#0874A6] transition-colors">
        &larr; {t('admin:userDetail.backToOverview')}
      </Link>

      {error && <div className="mt-4"><ErrorMessage message={error} /></div>}

      {/* Header */}
      <div className="mt-4 flex items-center gap-4">
        {userDetail.avatarUrl && <img src={userDetail.avatarUrl} className="h-14 w-14 rounded-full ring-2 ring-[#E2E8F0]" alt="" />}
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-[#1E293B]">{userDetail.name}</h1>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${isAbsent ? 'bg-red-100 text-red-700' : 'bg-teal-100 text-teal-700'}`}>
              {isAbsent ? t('admin:userDetail.absent') : t('admin:userDetail.available')}
            </span>
          </div>
          <p className="text-sm text-[#64748B]">{userDetail.email}</p>
          <p className="text-xs text-[#64748B]/70">
            {userDetail.googleTokens?.connected ? t('admin:userDetail.googleConnected') : t('admin:userDetail.googleNotConnected')}
            {userDetail.lastLoginAt && (
              <> · {t('admin:userDetail.lastLogin', { date: formatLastLogin(userDetail.lastLoginAt) })}</>
            )}
            {!userDetail.lastLoginAt && <> · {t('admin:userDetail.neverLoggedIn')}</>}
          </p>
        </div>
      </div>

      {/* Status Section */}
      <div className="mt-6 rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-sm font-semibold text-[#1E293B]">{t('admin:userDetail.availabilityStatus')}</h2>
          <HelpTooltip text={t('admin:userDetail.availabilityTooltip')} />
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
            {isSavingStatus ? t('admin:userDetail.saving') : isAbsent ? t('admin:userDetail.setAvailable') : t('admin:userDetail.setAbsent')}
          </button>

          {isAbsent && (
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1 text-sm text-[#64748B]">
                {t('admin:userDetail.absentUntil')}
                <HelpTooltip text={t('admin:userDetail.absentUntilTooltip')} />
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
                {t('common:save')}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Company Memberships + Role */}
      <div className="mt-6 rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-sm font-semibold text-[#1E293B]">{t('admin:userDetail.companyMemberships')}</h2>
          <HelpTooltip text={t('admin:userDetail.companyMembershipsTooltip')} />
        </div>

        {userDetail.companyMemberships?.length > 0 && (
          <div className="space-y-2 mb-4">
            {userDetail.companyMemberships.map((cm: any) => (
              <div key={cm.company.id} className="flex items-center justify-between rounded-xl bg-[#F8FAFC] px-4 py-2.5 ring-1 ring-[#E2E8F0]">
                <span className="text-sm text-[#1E293B]">{cm.company.name}</span>
                <div className="flex items-center gap-2">
                  <select
                    value={cm.role}
                    onChange={(e) => handleRoleChange(cm.company.id, e.target.value)}
                    className="rounded-lg border border-[#E2E8F0] px-2 py-1 text-xs focus:border-[#0B8ECA] focus:outline-none"
                  >
                    <option value="USER">USER</option>
                    <option value="COMPANY_ADMIN">COMPANY_ADMIN</option>
                    <option value="ORG_ADMIN">ORG_ADMIN</option>
                  </select>
                  <button
                    onClick={() => handleRemoveFromCompany(cm.company.id)}
                    className="text-xs text-[#EF4444] hover:text-red-600 transition-colors"
                  >
                    {t('admin:userDetail.remove')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add to company */}
        {(() => {
          const memberCompanyIds = new Set(userDetail.companyMemberships?.map((cm: any) => cm.company.id) ?? []);
          const availableCompanies = allCompanies.filter((c: any) => !memberCompanyIds.has(c.id));
          if (availableCompanies.length === 0) return null;
          return (
            <div className="flex items-center gap-2">
              <select
                value={addCompanyId}
                onChange={(e) => setAddCompanyId(e.target.value)}
                className="flex-1 rounded-xl border border-[#E2E8F0] px-3 py-1.5 text-sm focus:border-[#0B8ECA] focus:outline-none"
              >
                <option value="">{t('admin:userDetail.selectCompany')}</option>
                {availableCompanies.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <select
                value={addCompanyRole}
                onChange={(e) => setAddCompanyRole(e.target.value)}
                className="rounded-xl border border-[#E2E8F0] px-2 py-1.5 text-sm focus:border-[#0B8ECA] focus:outline-none"
              >
                <option value="USER">USER</option>
                <option value="COMPANY_ADMIN">COMPANY_ADMIN</option>
                <option value="ORG_ADMIN">ORG_ADMIN</option>
              </select>
              <button
                onClick={handleAddToCompany}
                disabled={!addCompanyId}
                className="rounded-xl bg-[#0B8ECA] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#0874A6] disabled:opacity-50 transition-colors"
              >
                {t('common:add')}
              </button>
            </div>
          );
        })()}
      </div>

      {/* Team Memberships */}
      <div className="mt-4 rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-[#1E293B] mb-3">{t('admin:userDetail.teamsSection')}</h2>

        {userDetail.teamMemberships?.length > 0 ? (
          <div className="space-y-2 mb-4">
            {userDetail.teamMemberships.map((tm: any) => (
              <div key={tm.team.id} className="flex items-center justify-between rounded-xl bg-[#F8FAFC] px-4 py-2.5 ring-1 ring-[#E2E8F0]">
                <span className="text-sm text-[#1E293B]">{tm.team.name}</span>
                <button
                  onClick={() => handleRemoveFromTeam(tm.team.id)}
                  className="text-xs text-[#EF4444] hover:text-red-600 transition-colors"
                >
                  {t('admin:userDetail.remove')}
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[#64748B] mb-4">{t('admin:userDetail.noTeam')}</p>
        )}

        {/* Add to team */}
        {(() => {
          const memberTeamIds = new Set(userDetail.teamMemberships?.map((tm: any) => tm.team.id) ?? []);
          const availableTeams = allTeams.filter((t: any) => !memberTeamIds.has(t.id));
          if (availableTeams.length === 0) return null;
          return (
            <div className="flex items-center gap-2">
              <select
                value={addTeamId}
                onChange={(e) => setAddTeamId(e.target.value)}
                className="flex-1 rounded-xl border border-[#E2E8F0] px-3 py-1.5 text-sm focus:border-[#0B8ECA] focus:outline-none"
              >
                <option value="">{t('admin:userDetail.selectTeam')}</option>
                {availableTeams.map((team: any) => (
                  <option key={team.id} value={team.id}>{team.name}</option>
                ))}
              </select>
              <button
                onClick={() => { if (addTeamId) { handleAddToTeam(addTeamId); setAddTeamId(''); } }}
                disabled={!addTeamId}
                className="rounded-xl bg-[#0B8ECA] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#0874A6] disabled:opacity-50 transition-colors"
              >
                {t('common:add')}
              </button>
            </div>
          );
        })()}
      </div>

      {/* Upcoming Bookings */}
      <div className="mt-6">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[#64748B] mb-3">
          {t('admin:userDetail.upcomingBookings', { count: bookings.length })}
        </h2>
        {bookings.length === 0 ? (
          <p className="text-sm text-[#64748B]">{t('admin:userDetail.noBookings')}</p>
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
            <h2 className="text-sm font-semibold text-red-700">{t('admin:userDetail.dangerZone')}</h2>
            <HelpTooltip text={t('admin:userDetail.dangerTooltip')} />
          </div>
          <button
            onClick={handleDelete}
            className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors"
          >
            {t('admin:userDetail.deleteUser')}
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
