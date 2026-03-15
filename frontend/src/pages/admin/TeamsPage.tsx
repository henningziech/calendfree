import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getTeams, createTeam, deleteTeam, updateRoundRobin } from '../../api/admin';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ErrorMessage } from '../../components/ui/ErrorMessage';

export function TeamsPage() {
  const { user } = useAuth();
  const [teams, setTeams] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newMode, setNewMode] = useState('SEQUENTIAL');

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
      await createTeam(companyId, { name: newName, roundRobinMode: newMode });
      setShowCreate(false);
      setNewName('');
      load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleModeChange = async (teamId: string, mode: string) => {
    try {
      await updateRoundRobin(teamId, mode);
      load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (isLoading) return <LoadingSpinner />;
  if (!companyId) return <p className="text-[#64748B]">Bitte wählen Sie zuerst eine Company aus.</p>;

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#1E293B]">Teams</h1>
        <button onClick={() => setShowCreate(true)} className="rounded-xl bg-[#0B8ECA] px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-[#0874A6] hover:shadow-md">
          + Neues Team
        </button>
      </div>

      {error && <ErrorMessage message={error} />}

      {showCreate && (
        <form onSubmit={handleCreate} className="mt-4 flex gap-3 rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-sm">
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Team-Name" required className="flex-1 rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm focus:border-[#0B8ECA] focus:ring-2 focus:ring-[#0B8ECA]/20 focus:outline-none" />
          <select value={newMode} onChange={(e) => setNewMode(e.target.value)} className="rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm focus:border-[#0B8ECA] focus:ring-2 focus:ring-[#0B8ECA]/20 focus:outline-none">
            <option value="SEQUENTIAL">Sequential</option>
            <option value="LEAST_BUSY">Least Busy</option>
            <option value="WEIGHTED">Weighted</option>
          </select>
          <button type="submit" className="rounded-xl bg-[#0B8ECA] px-4 py-2 text-sm font-medium text-white hover:bg-[#0874A6]">Erstellen</button>
          <button type="button" onClick={() => setShowCreate(false)} className="rounded-xl bg-[#F8FAFC] px-4 py-2 text-sm text-[#64748B] ring-1 ring-[#E2E8F0] hover:bg-[#E2E8F0]">Abbrechen</button>
        </form>
      )}

      <div className="mt-4 space-y-3">
        {teams.map((t) => (
          <div key={t.id} className="rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-sm transition-all hover:shadow-md">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-8 w-1 rounded-full bg-[#14B8A6]" />
                <div>
                  <h3 className="font-medium text-[#1E293B]">{t.name}</h3>
                  <p className="text-sm text-[#64748B]">
                    {t.memberships?.length ?? 0} Mitglieder · {t._count?.eventTypes ?? 0} Event Types
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <select
                  value={t.rrConfig?.mode ?? 'SEQUENTIAL'}
                  onChange={(e) => handleModeChange(t.id, e.target.value)}
                  className="rounded-xl border border-[#E2E8F0] px-2 py-1 text-sm focus:border-[#0B8ECA] focus:outline-none"
                >
                  <option value="SEQUENTIAL">Sequential</option>
                  <option value="LEAST_BUSY">Least Busy</option>
                  <option value="WEIGHTED">Weighted</option>
                </select>
                <button onClick={() => { if (confirm(`Team "${t.name}" löschen?`)) deleteTeam(t.id).then(load); }} className="text-sm font-medium text-[#EF4444] transition-colors hover:text-red-600">
                  Löschen
                </button>
              </div>
            </div>
            {t.memberships?.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {t.memberships.map((m: any) => (
                  <span key={m.user.id} className="rounded-full bg-[#F8FAFC] px-3 py-1 text-xs text-[#1E293B] ring-1 ring-[#E2E8F0]">
                    {m.user.name} {t.rrConfig?.mode === 'WEIGHTED' ? `(${m.weight}%)` : ''}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
        {teams.length === 0 && <p className="text-[#64748B] text-sm">Keine Teams vorhanden.</p>}
      </div>
    </div>
  );
}
