import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getEventTypes, createEventType, toggleEventType, deleteEventType, getTeams } from '../../api/admin';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ErrorMessage } from '../../components/ui/ErrorMessage';

export function MyEventTypesPage() {
  const { user } = useAuth();
  const [eventTypes, setEventTypes] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    title: '',
    slug: '',
    duration: 30,
    bufferBefore: 0,
    bufferAfter: 15,
    minNotice: 4,
    maxAdvance: 60,
    autoMeetLink: true,
    teamId: '' as string | null,
    color: '#2563EB',
  });

  const companyId = user?.activeCompanyId;

  const load = async () => {
    if (!companyId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const [et, t] = await Promise.all([
        getEventTypes(companyId),
        getTeams(companyId),
      ]);
      setEventTypes(et);
      setTeams(t);
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
      await createEventType(companyId, {
        ...form,
        teamId: form.teamId || null,
      });
      setShowCreate(false);
      setForm({ title: '', slug: '', duration: 30, bufferBefore: 0, bufferAfter: 15, minNotice: 4, maxAdvance: 60, autoMeetLink: true, teamId: null, color: '#2563EB' });
      load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const generateSlug = (title: string) => {
    return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  };

  if (isLoading) return <LoadingSpinner />;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Buchungsseiten</h1>
          <p className="mt-1 text-sm text-gray-500">Erstellen und verwalten Sie Ihre Event Types mit Slots, Puffer und Einstellungen.</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          + Neuer Event Type
        </button>
      </div>

      {error && <ErrorMessage message={error} />}

      {showCreate && (
        <form onSubmit={handleCreate} className="mt-4 space-y-4 rounded-lg border bg-white p-6">
          <h3 className="font-medium text-gray-900">Neuen Event Type erstellen</h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Titel *</label>
              <input
                value={form.title}
                onChange={(e) => { setForm({ ...form, title: e.target.value, slug: generateSlug(e.target.value) }); }}
                placeholder="z.B. 30min Erstgespräch"
                required
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Slug *</label>
              <input
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
                placeholder="z.B. erstgespraech"
                required
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Dauer (Min)</label>
              <input type="number" value={form.duration} onChange={(e) => setForm({ ...form, duration: +e.target.value })} min={5} max={480} className="mt-1 w-full rounded-md border px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Puffer vorher (Min)</label>
              <input type="number" value={form.bufferBefore} onChange={(e) => setForm({ ...form, bufferBefore: +e.target.value })} min={0} max={120} className="mt-1 w-full rounded-md border px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Puffer nachher (Min)</label>
              <input type="number" value={form.bufferAfter} onChange={(e) => setForm({ ...form, bufferAfter: +e.target.value })} min={0} max={120} className="mt-1 w-full rounded-md border px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Farbe</label>
              <input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="mt-1 h-9 w-full rounded-md border" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Min. Vorlauf (Std)</label>
              <input type="number" value={form.minNotice} onChange={(e) => setForm({ ...form, minNotice: +e.target.value })} min={0} max={720} className="mt-1 w-full rounded-md border px-3 py-2 text-sm" />
              <p className="mt-1 text-xs text-gray-400">Frühestens X Stunden im Voraus buchbar</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Max. Vorlauf (Tage)</label>
              <input type="number" value={form.maxAdvance} onChange={(e) => setForm({ ...form, maxAdvance: +e.target.value })} min={1} max={365} className="mt-1 w-full rounded-md border px-3 py-2 text-sm" />
              <p className="mt-1 text-xs text-gray-400">Wie weit im Voraus buchbar</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Team (Round-Robin)</label>
              <select value={form.teamId ?? ''} onChange={(e) => setForm({ ...form, teamId: e.target.value || null })} className="mt-1 w-full rounded-md border px-3 py-2 text-sm">
                <option value="">Kein Team (persönlich)</option>
                {teams.map((t: any) => (
                  <option key={t.id} value={t.id}>{t.name} ({t.rrConfig?.mode})</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input type="checkbox" id="autoMeet" checked={form.autoMeetLink} onChange={(e) => setForm({ ...form, autoMeetLink: e.target.checked })} />
            <label htmlFor="autoMeet" className="text-sm text-gray-700">Google Meet Link automatisch erstellen</label>
          </div>

          <div className="flex gap-3">
            <button type="submit" className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700">Erstellen</button>
            <button type="button" onClick={() => setShowCreate(false)} className="rounded-md bg-gray-100 px-4 py-2 text-sm">Abbrechen</button>
          </div>
        </form>
      )}

      <div className="mt-6 space-y-3">
        {eventTypes.map((et: any) => (
          <div key={et.id} className="rounded-lg border bg-white p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-4 w-4 rounded-full" style={{ backgroundColor: et.color || '#2563EB' }} />
                <div>
                  <h3 className="font-medium text-gray-900">{et.title}</h3>
                  <p className="text-sm text-gray-500">
                    /{et.slug} · {et.duration}min
                    {et.bufferBefore > 0 && ` · ${et.bufferBefore}min Puffer vorher`}
                    {et.bufferAfter > 0 && ` · ${et.bufferAfter}min Puffer nachher`}
                    · {et._count?.bookings ?? 0} Buchungen
                  </p>
                  <p className="text-xs text-gray-400">
                    {et.team ? `Team: ${et.team.name}` : 'Persönliche Buchungsseite'}
                    {et.autoMeetLink && ' · Meet Link'}
                    · Min. {et.minNotice}h Vorlauf · Max. {et.maxAdvance} Tage
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => toggleEventType(et.id).then(load)}
                  className={`rounded-full px-3 py-1 text-xs font-medium ${et.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}
                >
                  {et.active ? 'Aktiv' : 'Inaktiv'}
                </button>
                <button onClick={() => { if (confirm(`"${et.title}" löschen?`)) deleteEventType(et.id).then(load); }} className="text-sm text-red-600">
                  Löschen
                </button>
              </div>
            </div>
          </div>
        ))}
        {eventTypes.length === 0 && (
          <div className="rounded-lg border border-dashed bg-gray-50 p-8 text-center">
            <p className="text-gray-500">Noch keine Event Types vorhanden.</p>
            <button onClick={() => setShowCreate(true)} className="mt-3 text-sm text-blue-600 hover:underline">
              Ersten Event Type erstellen
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
