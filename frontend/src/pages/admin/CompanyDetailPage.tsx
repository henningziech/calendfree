import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router';
import { useAuth } from '../../context/AuthContext';
import {
  getCompanyDetail,
  getCompanyBookings,
  getCompanyUsers,
  updateCompany,
  inviteUser,
  removeUser,
} from '../../api/admin';
import { apiRequest } from '../../api/client';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { BookingCard } from '../../components/bookings/BookingCard';
import type { Booking } from '../../components/bookings/types';

/**
 * Admin page for viewing and managing a single company's details,
 * including info editing, member management, teams overview, and recent bookings.
 */
export function CompanyDetailPage() {
  const { companyId } = useParams<{ companyId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isOrgAdmin = user?.activeRole === 'ORG_ADMIN';

  const [company, setCompany] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Company info form
  const [editName, setEditName] = useState('');
  const [editSlug, setEditSlug] = useState('');
  const [editDomain, setEditDomain] = useState('');
  const [isSavingInfo, setIsSavingInfo] = useState(false);
  const [infoSuccess, setInfoSuccess] = useState(false);

  // Inline name editing (header)
  const [isEditingName, setIsEditingName] = useState(false);
  const [headerName, setHeaderName] = useState('');

  // Invite form
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState('USER');

  const load = useCallback(async () => {
    if (!companyId) return;
    setIsLoading(true);
    try {
      const [detail, users, bk] = await Promise.all([
        getCompanyDetail(companyId),
        getCompanyUsers(companyId),
        getCompanyBookings(companyId).catch(() => []),
      ]);
      setCompany(detail);
      setMembers(users);
      setBookings(bk as Booking[]);
      setEditName(detail.name ?? '');
      setEditSlug(detail.slug ?? '');
      setEditDomain(detail.customDomain ?? '');
      setHeaderName(detail.name ?? '');
    } catch (err: any) {
      setError(err.status === 404 ? 'Company nicht gefunden.' : 'Fehler beim Laden.');
    } finally {
      setIsLoading(false);
    }
  }, [companyId]);

  useEffect(() => { load(); }, [load]);

  /** Save company info (name, slug, customDomain). */
  const handleSaveInfo = async () => {
    if (!companyId) return;
    setIsSavingInfo(true);
    setInfoSuccess(false);
    try {
      await updateCompany(companyId, {
        name: editName,
        slug: editSlug,
        customDomain: editDomain || null,
      });
      setCompany((prev: any) => ({ ...prev, name: editName, slug: editSlug, customDomain: editDomain || null }));
      setHeaderName(editName);
      setInfoSuccess(true);
      setTimeout(() => setInfoSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message ?? 'Fehler beim Speichern.');
    } finally {
      setIsSavingInfo(false);
    }
  };

  /** Save header name inline edit. */
  const handleSaveHeaderName = async () => {
    if (!companyId || !headerName.trim()) return;
    try {
      await updateCompany(companyId, { name: headerName.trim() });
      setCompany((prev: any) => ({ ...prev, name: headerName.trim() }));
      setEditName(headerName.trim());
      setIsEditingName(false);
    } catch (err: any) {
      setError(err.message ?? 'Fehler beim Speichern des Namens.');
    }
  };

  /** Change a member's role. */
  const handleRoleChange = async (userId: string, newRole: string) => {
    if (!companyId) return;
    try {
      await apiRequest(`/admin/companies/${companyId}/users/${userId}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role: newRole }),
      });
      setMembers((prev) =>
        prev.map((m) => (m.id === userId ? { ...m, role: newRole } : m)),
      );
    } catch {
      setError('Rolle konnte nicht geändert werden.');
    }
  };

  /** Invite a new member. */
  const handleInvite = async () => {
    if (!companyId || !inviteEmail.trim() || !inviteName.trim()) return;
    try {
      await inviteUser(companyId, {
        email: inviteEmail.trim(),
        name: inviteName.trim(),
        role: inviteRole,
      });
      setInviteEmail('');
      setInviteName('');
      setInviteRole('USER');
      setShowInvite(false);
      load();
    } catch (err: any) {
      setError(err.message ?? 'Fehler beim Einladen.');
    }
  };

  /** Remove a member from the company. */
  const handleRemove = async (userId: string) => {
    if (!companyId) return;
    if (!confirm('Mitglied wirklich aus der Company entfernen?')) return;
    try {
      await removeUser(companyId, userId);
      setMembers((prev) => prev.filter((m) => m.id !== userId));
    } catch (err: any) {
      setError(err.message ?? 'Fehler beim Entfernen.');
    }
  };

  /** Get initials from a name string. */
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  /** Get role badge styling. */
  const roleBadge = (role: string) => {
    switch (role) {
      case 'ORG_ADMIN':
        return { label: 'Org Admin', className: 'rounded-full bg-[#14B8A6]/10 px-2 py-0.5 text-xs font-medium text-[#14B8A6]' };
      case 'COMPANY_ADMIN':
        return { label: 'Admin', className: 'rounded-full bg-[#14B8A6]/10 px-2 py-0.5 text-xs font-medium text-[#14B8A6]' };
      default:
        return { label: 'User', className: 'rounded-full bg-[#64748B]/10 px-2 py-0.5 text-xs font-medium text-[#64748B]' };
    }
  };

  if (isLoading) return <LoadingSpinner />;
  if (error && !company) return <ErrorMessage message={error} />;
  if (!company) return null;

  return (
    <div>
      {/* Back link */}
      <Link to="/admin/companies" className="text-sm text-[#0B8ECA] hover:underline">
        &larr; Zur&uuml;ck zu Companies
      </Link>

      {error && <div className="mt-4"><ErrorMessage message={error} /></div>}

      {/* A) Header */}
      <div className="mt-4">
        {isEditingName ? (
          <div className="flex items-center gap-2">
            <input
              value={headerName}
              onChange={(e) => setHeaderName(e.target.value)}
              className="rounded-xl border border-[#E2E8F0] px-3 py-2 text-2xl font-bold text-[#1E293B] focus:border-[#0B8ECA] focus:outline-none"
            />
            <button
              onClick={handleSaveHeaderName}
              className="rounded-xl bg-[#0B8ECA] px-4 py-2 text-sm font-medium text-white"
            >
              Speichern
            </button>
            <button
              onClick={() => { setIsEditingName(false); setHeaderName(company.name); }}
              className="rounded-xl border border-[#E2E8F0] px-3 py-1.5 text-sm text-[#64748B]"
            >
              Abbrechen
            </button>
          </div>
        ) : (
          <h1
            className="text-2xl font-bold text-[#1E293B] cursor-pointer hover:text-[#0B8ECA] transition-colors"
            onClick={() => setIsEditingName(true)}
            title="Klicken zum Bearbeiten"
          >
            {company.name}
          </h1>
        )}
      </div>

      {/* B) Firmendaten */}
      <div className="mt-6 rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-[#1E293B] mb-4">Firmendaten</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#1E293B] mb-1">Name</label>
            <input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm focus:border-[#0B8ECA] focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#1E293B] mb-1">Slug</label>
            <input
              value={editSlug}
              onChange={(e) => setEditSlug(e.target.value)}
              className="w-full rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm focus:border-[#0B8ECA] focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#1E293B] mb-1">Custom Domain</label>
            <input
              value={editDomain}
              onChange={(e) => setEditDomain(e.target.value)}
              placeholder="z.B. booking.example.com"
              className="w-full rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm focus:border-[#0B8ECA] focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleSaveInfo}
              disabled={isSavingInfo}
              className="rounded-xl bg-[#0B8ECA] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {isSavingInfo ? 'Wird gespeichert...' : 'Speichern'}
            </button>
            {infoSuccess && (
              <span className="text-sm text-[#14B8A6] font-medium">Gespeichert!</span>
            )}
          </div>
        </div>
      </div>

      {/* C) Mitglieder */}
      <div className="mt-6 rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-[#1E293B]">Mitglieder</h2>
          <button
            onClick={() => setShowInvite(!showInvite)}
            className="rounded-xl border border-[#0B8ECA] px-3 py-1.5 text-sm font-medium text-[#0B8ECA]"
          >
            Mitglied einladen
          </button>
        </div>

        {/* Invite form */}
        {showInvite && (
          <div className="mb-4 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 space-y-3">
            <div className="flex flex-wrap gap-3">
              <input
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="E-Mail"
                className="flex-1 min-w-[200px] rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm focus:border-[#0B8ECA] focus:outline-none"
              />
              <input
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                placeholder="Name"
                className="flex-1 min-w-[200px] rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm focus:border-[#0B8ECA] focus:outline-none"
              />
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                className="rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm focus:border-[#0B8ECA] focus:outline-none"
              >
                <option value="USER">User</option>
                <option value="COMPANY_ADMIN">Admin</option>
                <option value="ORG_ADMIN">Org Admin</option>
              </select>
            </div>
            <button
              onClick={handleInvite}
              disabled={!inviteEmail.trim() || !inviteName.trim()}
              className="rounded-xl bg-[#0B8ECA] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              Einladen
            </button>
          </div>
        )}

        {/* Member list */}
        <div className="space-y-2">
          {members.map((m) => {
            const badge = roleBadge(m.role);
            return (
              <div
                key={m.id}
                className="flex items-center justify-between rounded-xl bg-[#F8FAFC] px-4 py-3 ring-1 ring-[#E2E8F0]"
              >
                <div className="flex items-center gap-3">
                  {m.avatarUrl ? (
                    <img src={m.avatarUrl} className="h-8 w-8 rounded-full" alt="" />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0B8ECA] text-xs font-semibold text-white">
                      {getInitials(m.name ?? m.email)}
                    </div>
                  )}
                  <div>
                    <span className="text-sm font-medium text-[#1E293B]">{m.name}</span>
                    <p className="text-xs text-[#64748B]">{m.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isOrgAdmin ? (
                    <select
                      value={m.role}
                      onChange={(e) => handleRoleChange(m.id, e.target.value)}
                      className="rounded-lg border border-[#E2E8F0] px-2 py-1 text-xs focus:border-[#0B8ECA] focus:outline-none"
                    >
                      <option value="USER">User</option>
                      <option value="COMPANY_ADMIN">Admin</option>
                      <option value="ORG_ADMIN">Org Admin</option>
                    </select>
                  ) : (
                    <span className={badge.className}>{badge.label}</span>
                  )}
                  <button
                    onClick={() => handleRemove(m.id)}
                    className="text-sm text-[#EF4444] hover:underline"
                  >
                    Entfernen
                  </button>
                </div>
              </div>
            );
          })}
          {members.length === 0 && (
            <p className="text-sm text-[#64748B]">Keine Mitglieder vorhanden.</p>
          )}
        </div>
      </div>

      {/* D) Teams */}
      <div className="mt-6 rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-[#1E293B] mb-4">Teams</h2>
        {company.teams?.length > 0 ? (
          <div className="space-y-2">
            {company.teams.map((team: any) => (
              <Link
                key={team.id}
                to={`/dashboard/teams/${team.id}`}
                className="flex items-center justify-between rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-sm transition-all hover:shadow-md hover:border-[#0B8ECA]/30"
              >
                <div>
                  <h3 className="text-sm font-medium text-[#1E293B]">{team.name}</h3>
                  <p className="text-xs text-[#64748B]">
                    {team._count?.memberships ?? 0} Mitglieder
                  </p>
                </div>
                <svg className="h-5 w-5 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[#64748B]">Keine Teams vorhanden.</p>
        )}
      </div>

      {/* E) Termine */}
      <div className="mt-6 rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-[#1E293B] mb-4">Termine</h2>
        {bookings.length > 0 ? (
          <div className="space-y-2">
            {bookings.map((b) => (
              <BookingCard
                key={b.id}
                booking={b}
                onClick={() => navigate(`/dashboard/bookings/${b.id}`)}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-[#64748B]">Keine Buchungen vorhanden.</p>
        )}
      </div>
    </div>
  );
}
