import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '../../context/AuthContext';
import { getTeams, createTeam } from '../../api/admin';
import { apiRequest } from '../../api/client';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ErrorMessage } from '../../components/ui/ErrorMessage';

export function MyTeamsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [teams, setTeams] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [tab, setTab] = useState<'mine' | 'all'>('mine');

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

  const isMember = (team: any) =>
    team.memberships?.some((m: any) => m.userId === user?.id);

  const handleJoin = async (teamId: string) => {
    try {
      await apiRequest(`/admin/teams/${teamId}/join`, { method: 'POST' });
      load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const filteredTeams = tab === 'mine'
    ? teams.filter((t: any) => isMember(t))
    : teams;

  if (isLoading) return <LoadingSpinner />;

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

      {/* Tabs */}
      <div className="mt-4 flex gap-6 border-b-2 border-[#E2E8F0]">
        <button
          onClick={() => setTab('mine')}
          className={`pb-3 text-sm font-medium transition-colors ${
            tab === 'mine'
              ? 'border-b-2 border-[#0B8ECA] text-[#0B8ECA] -mb-[2px]'
              : 'text-[#64748B] hover:text-[#1E293B]'
          }`}
        >
          Meine Teams
        </button>
        <button
          onClick={() => setTab('all')}
          className={`pb-3 text-sm font-medium transition-colors ${
            tab === 'all'
              ? 'border-b-2 border-[#0B8ECA] text-[#0B8ECA] -mb-[2px]'
              : 'text-[#64748B] hover:text-[#1E293B]'
          }`}
        >
          Alle Teams
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
        {filteredTeams.map((team: any) => (
          <Link
            key={team.id}
            to={`/dashboard/teams/${team.id}`}
            className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-sm transition-all hover:border-[#0B8ECA]/30 hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-[#1E293B]">{team.name}</h3>
              {isMember(team) ? (
                <span className="rounded-full bg-[#0B8ECA]/10 px-2 py-0.5 text-xs font-medium text-[#0B8ECA]">
                  Mitglied
                </span>
              ) : tab === 'all' ? (
                <button
                  onClick={(e) => { e.preventDefault(); handleJoin(team.id); }}
                  className="rounded-full bg-[#14B8A6]/10 px-2 py-0.5 text-xs font-medium text-[#14B8A6] hover:bg-[#14B8A6]/20 transition-colors"
                >
                  Beitreten
                </button>
              ) : null}
            </div>
            <p className="mt-2 text-sm text-[#64748B]">
              {team.memberships?.length ?? 0} Mitglieder · {team._count?.eventTypes ?? team.eventTypes?.length ?? 0} Event-Typen
            </p>
          </Link>
        ))}
      </div>

      {!isLoading && filteredTeams.length === 0 && !showCreate && (
        <div className="mt-12 text-center">
          {tab === 'mine' ? (
            <>
              <p className="text-lg text-[#64748B]">Du bist noch keinem Team beigetreten</p>
              <p className="text-sm text-[#94A3B8]">Wechsle zum Tab "Alle Teams", um einem Team beizutreten.</p>
            </>
          ) : (
            <>
              <p className="text-lg text-[#64748B]">Keine Teams in dieser Firma vorhanden</p>
              <p className="text-sm text-[#94A3B8]">Erstelle ein Team, um Termine im Round-Robin-Verfahren zu verteilen.</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
