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
    if (!companyId) return;
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
  if (!companyId) return <p className="text-gray-500">Bitte wählen Sie zuerst eine Company aus.</p>;

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Teams</h1>
        <button onClick={() => setShowCreate(true)} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          + Neues Team
        </button>
      </div>

      {error && <ErrorMessage message={error} />}

      {showCreate && (
        <form onSubmit={handleCreate} className="mt-4 flex gap-3 rounded-lg border bg-white p-4">
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Team-Name" required className="flex-1 rounded-md border px-3 py-2 text-sm" />
          <select value={newMode} onChange={(e) => setNewMode(e.target.value)} className="rounded-md border px-3 py-2 text-sm">
            <option value="SEQUENTIAL">Sequential</option>
            <option value="LEAST_BUSY">Least Busy</option>
            <option value="WEIGHTED">Weighted</option>
          </select>
          <button type="submit" className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white">Erstellen</button>
          <button type="button" onClick={() => setShowCreate(false)} className="rounded-md bg-gray-100 px-4 py-2 text-sm">Abbrechen</button>
        </form>
      )}

      <div className="mt-4 space-y-3">
        {teams.map((t) => (
          <div key={t.id} className="rounded-lg border bg-white p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-gray-900">{t.name}</h3>
                <p className="text-sm text-gray-500">
                  {t.memberships?.length ?? 0} Mitglieder · {t._count?.eventTypes ?? 0} Event Types
                </p>
              </div>
              <div className="flex items-center gap-3">
                <select
                  value={t.rrConfig?.mode ?? 'SEQUENTIAL'}
                  onChange={(e) => handleModeChange(t.id, e.target.value)}
                  className="rounded-md border px-2 py-1 text-sm"
                >
                  <option value="SEQUENTIAL">Sequential</option>
                  <option value="LEAST_BUSY">Least Busy</option>
                  <option value="WEIGHTED">Weighted</option>
                </select>
                <button onClick={() => { if (confirm(`Team "${t.name}" löschen?`)) deleteTeam(t.id).then(load); }} className="text-sm text-red-600 hover:text-red-800">
                  Löschen
                </button>
              </div>
            </div>
            {t.memberships?.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {t.memberships.map((m: any) => (
                  <span key={m.user.id} className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700">
                    {m.user.name} {t.rrConfig?.mode === 'WEIGHTED' ? `(${m.weight}%)` : ''}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
        {teams.length === 0 && <p className="text-gray-500 text-sm">Keine Teams vorhanden.</p>}
      </div>
    </div>
  );
}
