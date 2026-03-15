import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getTeams, createTeam } from '../../api/admin';
import { apiRequest } from '../../api/client';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ErrorMessage } from '../../components/ui/ErrorMessage';

export function MyTeamsPage() {
  const { user } = useAuth();
  const [teams, setTeams] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newMode, setNewMode] = useState('SEQUENTIAL');
  const [inviteEmail, setInviteEmail] = useState<Record<string, string>>({});
  const [inviteMsg, setInviteMsg] = useState<Record<string, string>>({});

  const companyId = user?.activeCompanyId;

  const load = async () => {
    if (!companyId) { setIsLoading(false); return; }
    setIsLoading(true);
    try {
      setTeams(await getTeams(companyId));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, [companyId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    try {
      const team = await createTeam(companyId, { name: newName, roundRobinMode: newMode }) as any;
      // Auto-join the team
      await apiRequest(`/admin/teams/${team.id}/join`, { method: 'POST' });
      setShowCreate(false);
      setNewName('');
      load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleJoin = async (teamId: string) => {
    try {
      await apiRequest(`/admin/teams/${teamId}/join`, { method: 'POST' });
      load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleLeave = async (teamId: string) => {
    if (!confirm('Team wirklich verlassen?')) return;
    try {
      await apiRequest(`/admin/teams/${teamId}/leave`, { method: 'POST' });
      load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleInvite = async (teamId: string) => {
    const email = inviteEmail[teamId];
    if (!email) return;
    try {
      await apiRequest(`/admin/teams/${teamId}/invite`, { method: 'POST', body: JSON.stringify({ email }) });
      setInviteEmail({ ...inviteEmail, [teamId]: '' });
      setInviteMsg({ ...inviteMsg, [teamId]: 'Eingeladen!' });
      setTimeout(() => setInviteMsg({ ...inviteMsg, [teamId]: '' }), 2000);
      load();
    } catch (err: any) {
      setInviteMsg({ ...inviteMsg, [teamId]: err.message });
    }
  };

  const isMember = (team: any) => {
    return team.memberships?.some((m: any) => m.user?.id === user?.id || m.userId === user?.id);
  };

  if (isLoading) return <LoadingSpinner />;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1E293B]">Meine Teams</h1>
          <p className="mt-1 text-sm text-[#64748B]">Treten Sie Teams bei, laden Sie Kollegen ein und verwalten Sie die Round-Robin-Verteilung.</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="rounded-xl bg-[#0B8ECA] px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-[#0874A6] hover:shadow-md">
          + Neues Team
        </button>
      </div>

      {error && <ErrorMessage message={error} />}

      {showCreate && (
        <form onSubmit={handleCreate} className="mt-4 space-y-3 rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-sm">
          <h3 className="font-medium text-[#1E293B]">Neues Team erstellen</h3>
          <div className="flex gap-3">
            <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Team-Name" required className="flex-1 rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm focus:border-[#0B8ECA] focus:ring-2 focus:ring-[#0B8ECA]/20 focus:outline-none" />
            <select value={newMode} onChange={(e) => setNewMode(e.target.value)} className="rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm focus:border-[#0B8ECA] focus:outline-none">
              <option value="SEQUENTIAL">Sequential (der Reihe nach)</option>
              <option value="LEAST_BUSY">Least Busy (wenigste Termine)</option>
              <option value="WEIGHTED">Weighted (gewichtet)</option>
            </select>
          </div>
          <p className="text-xs text-[#64748B]">Sie werden automatisch als erstes Mitglied hinzugefügt.</p>
          <div className="flex gap-3">
            <button type="submit" className="rounded-xl bg-[#0B8ECA] px-4 py-2 text-sm font-medium text-white hover:bg-[#0874A6]">Erstellen</button>
            <button type="button" onClick={() => setShowCreate(false)} className="rounded-xl bg-[#F8FAFC] px-4 py-2 text-sm text-[#64748B] ring-1 ring-[#E2E8F0] hover:bg-[#E2E8F0]">Abbrechen</button>
          </div>
        </form>
      )}

      <div className="mt-6 space-y-4">
        {teams.map((t: any) => {
          const memberOfTeam = isMember(t);
          return (
            <div key={t.id} className="rounded-xl border border-[#E2E8F0] bg-white shadow-sm overflow-hidden transition-all hover:shadow-md">
              <div className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold text-[#1E293B]">{t.name}</h3>
                      <span className="rounded-full bg-[#0B8ECA]/10 px-2.5 py-0.5 text-xs font-medium text-[#0B8ECA]">
                        {t.rrConfig?.mode?.replace('_', ' ') ?? 'SEQUENTIAL'}
                      </span>
                      {memberOfTeam && (
                        <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                          Mitglied
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-[#64748B]">
                      {t.memberships?.length ?? 0} Mitglieder · {t._count?.eventTypes ?? 0} Event Types
                    </p>
                  </div>
                  <div>
                    {memberOfTeam ? (
                      <button onClick={() => handleLeave(t.id)} className="rounded-xl bg-red-50 px-3 py-1.5 text-xs font-medium text-[#EF4444] ring-1 ring-red-200 transition-colors hover:bg-red-100">
                        Team verlassen
                      </button>
                    ) : (
                      <button onClick={() => handleJoin(t.id)} className="rounded-xl bg-[#0B8ECA] px-3 py-1.5 text-xs font-medium text-white shadow-sm transition-all hover:bg-[#0874A6] hover:shadow-md">
                        Beitreten
                      </button>
                    )}
                  </div>
                </div>

                {/* Members */}
                {t.memberships?.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {t.memberships.map((m: any) => (
                      <span key={m.user?.id ?? m.userId} className="inline-flex items-center gap-1 rounded-full bg-[#F8FAFC] px-3 py-1 text-xs text-[#1E293B] ring-1 ring-[#E2E8F0]">
                        {m.user?.name ?? 'Unknown'}
                        {t.rrConfig?.mode === 'WEIGHTED' && <span className="text-[#64748B]">({m.weight}%)</span>}
                      </span>
                    ))}
                  </div>
                )}

                {/* Invite */}
                {memberOfTeam && (
                  <div className="mt-3 flex items-center gap-2">
                    <input
                      value={inviteEmail[t.id] ?? ''}
                      onChange={(e) => setInviteEmail({ ...inviteEmail, [t.id]: e.target.value })}
                      placeholder="kollege@seibert.group einladen..."
                      type="email"
                      className="flex-1 rounded-xl border border-[#E2E8F0] px-3 py-1.5 text-sm focus:border-[#0B8ECA] focus:ring-2 focus:ring-[#0B8ECA]/20 focus:outline-none"
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleInvite(t.id); } }}
                    />
                    <button onClick={() => handleInvite(t.id)} className="rounded-xl bg-[#F8FAFC] px-3 py-1.5 text-xs font-medium text-[#1E293B] ring-1 ring-[#E2E8F0] transition-colors hover:bg-[#E2E8F0]">
                      Einladen
                    </button>
                    {inviteMsg[t.id] && <span className="text-xs text-[#10B981]">{inviteMsg[t.id]}</span>}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {teams.length === 0 && (
          <div className="rounded-xl border-2 border-dashed border-[#E2E8F0] bg-[#F8FAFC] p-12 text-center">
            <div className="text-4xl mb-3">👥</div>
            <h3 className="text-lg font-medium text-[#1E293B]">Noch keine Teams</h3>
            <p className="mt-1 text-sm text-[#64748B]">Erstellen Sie ein Team für Round-Robin-Terminverteilung.</p>
            <button onClick={() => setShowCreate(true)} className="mt-4 rounded-xl bg-[#0B8ECA] px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-[#0874A6] hover:shadow-md">
              Erstes Team erstellen
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
