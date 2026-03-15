import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getEventTypes, createEventType, toggleEventType, deleteEventType } from '../../api/admin';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ErrorMessage } from '../../components/ui/ErrorMessage';

export function EventTypesPage() {
  const { user } = useAuth();
  const [eventTypes, setEventTypes] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: '', slug: '', duration: 30 });

  const companyId = user?.activeCompanyId;

  const load = async () => {
    if (!companyId) return;
    setIsLoading(true);
    try {
      setEventTypes(await getEventTypes(companyId));
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
      await createEventType(companyId, form);
      setShowCreate(false);
      setForm({ title: '', slug: '', duration: 30 });
      load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (isLoading) return <LoadingSpinner />;

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Event Types</h1>
        <button onClick={() => setShowCreate(true)} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          + Neuer Event Type
        </button>
      </div>

      {error && <ErrorMessage message={error} />}

      {showCreate && (
        <form onSubmit={handleCreate} className="mt-4 space-y-3 rounded-lg border bg-white p-4">
          <div className="flex gap-3">
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Titel" required className="flex-1 rounded-md border px-3 py-2 text-sm" />
            <input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="slug" required className="flex-1 rounded-md border px-3 py-2 text-sm" />
            <input type="number" value={form.duration} onChange={(e) => setForm({ ...form, duration: +e.target.value })} min={5} max={480} className="w-24 rounded-md border px-3 py-2 text-sm" />
          </div>
          <div className="flex gap-3">
            <button type="submit" className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white">Erstellen</button>
            <button type="button" onClick={() => setShowCreate(false)} className="rounded-md bg-gray-100 px-4 py-2 text-sm">Abbrechen</button>
          </div>
        </form>
      )}

      <div className="mt-4 space-y-2">
        {eventTypes.map((et) => (
          <div key={et.id} className="flex items-center justify-between rounded-lg border bg-white p-4">
            <div className="flex items-center gap-3">
              <div className="h-3 w-3 rounded-full" style={{ backgroundColor: et.color || '#2563EB' }} />
              <div>
                <h3 className="font-medium text-gray-900">{et.title}</h3>
                <p className="text-sm text-gray-500">/{et.slug} · {et.duration}min · {et._count?.bookings ?? 0} Buchungen</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => toggleEventType(et.id).then(load)}
                className={`rounded-full px-3 py-1 text-xs font-medium ${et.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}
              >
                {et.active ? 'Aktiv' : 'Inaktiv'}
              </button>
              <button onClick={() => { if (confirm(`"${et.title}" löschen?`)) deleteEventType(et.id).then(load); }} className="text-sm text-red-600">Löschen</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
