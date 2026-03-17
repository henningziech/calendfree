import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '../../context/AuthContext';
import { getTeams, createTeam } from '../../api/admin';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ErrorMessage } from '../../components/ui/ErrorMessage';

export function TeamsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [teams, setTeams] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');

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
    if (!companyId || !newName.trim()) return;
    try {
      const team = await createTeam(companyId, { name: newName.trim() });
      setNewName('');
      setShowCreate(false);
      navigate(`/dashboard/teams/${team.id}`);
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
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="rounded-xl bg-gradient-to-r from-[#0B8ECA] to-[#14B8A6] px-4 py-2 text-sm font-medium text-white shadow-sm hover:shadow-md"
        >
          + Neues Team
        </button>
      </div>

      {error && <ErrorMessage message={error} />}

      {showCreate && (
        <form onSubmit={handleCreate} className="mt-4 rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-sm">
          <label className="block text-sm font-medium text-[#1E293B]">Teamname</label>
          <div className="mt-1 flex gap-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="z.B. Vertrieb, Support"
              className="flex-1 rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm focus:border-[#0B8ECA] focus:outline-none"
              autoFocus
            />
            <button type="submit" className="rounded-xl bg-[#0B8ECA] px-4 py-2 text-sm font-medium text-white">
              Erstellen
            </button>
            <button type="button" onClick={() => setShowCreate(false)} className="rounded-xl border border-[#E2E8F0] px-4 py-2 text-sm text-[#64748B]">
              Abbrechen
            </button>
          </div>
        </form>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {teams.map((team: any) => (
          <Link
            key={team.id}
            to={`/dashboard/teams/${team.id}`}
            className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-sm transition-all hover:border-[#0B8ECA]/30 hover:shadow-md"
          >
            <h3 className="font-semibold text-[#1E293B]">{team.name}</h3>
            <p className="mt-2 text-sm text-[#64748B]">
              {team.memberships?.length ?? 0} Mitglieder · {team._count?.eventTypes ?? team.eventTypes?.length ?? 0} Event-Typen
            </p>
            {team.memberships?.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {team.memberships.slice(0, 5).map((m: any) => (
                  <span key={m.user?.id} className="rounded-full bg-[#F8FAFC] px-2 py-0.5 text-xs text-[#64748B] ring-1 ring-[#E2E8F0]">
                    {m.user?.name}
                  </span>
                ))}
                {team.memberships.length > 5 && (
                  <span className="rounded-full bg-[#F8FAFC] px-2 py-0.5 text-xs text-[#94A3B8] ring-1 ring-[#E2E8F0]">
                    +{team.memberships.length - 5}
                  </span>
                )}
              </div>
            )}
          </Link>
        ))}
      </div>

      {teams.length === 0 && !showCreate && (
        <div className="mt-12 text-center">
          <p className="text-lg text-[#64748B]">Keine Teams vorhanden</p>
          <p className="text-sm text-[#94A3B8]">Erstelle ein Team, um Termine im Round-Robin-Verfahren zu verteilen.</p>
        </div>
      )}
    </div>
  );
}
