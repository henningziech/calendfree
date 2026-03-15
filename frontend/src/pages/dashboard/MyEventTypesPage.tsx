import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getEventTypes, createEventType, updateEventType, toggleEventType, deleteEventType, getTeams } from '../../api/admin';
import { getCompanies } from '../../api/admin';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ErrorMessage } from '../../components/ui/ErrorMessage';

export function MyEventTypesPage() {
  const { user } = useAuth();
  const [eventTypes, setEventTypes] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [companySlug, setCompanySlug] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: '',
    slug: '',
    description: '',
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
    if (!companyId) { setIsLoading(false); return; }
    setIsLoading(true);
    try {
      const [et, t, companies] = await Promise.all([
        getEventTypes(companyId),
        getTeams(companyId),
        getCompanies(),
      ]);
      setEventTypes(et);
      setTeams(t);
      const company = companies.find((c: any) => c.id === companyId);
      if (company) setCompanySlug(company.slug);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, [companyId]);

  const resetForm = () => {
    setForm({ title: '', slug: '', description: '', duration: 30, bufferBefore: 0, bufferAfter: 15, minNotice: 4, maxAdvance: 60, autoMeetLink: true, teamId: null, color: '#2563EB' });
    setEditingId(null);
    setShowCreate(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    try {
      if (editingId) {
        // Update existing
        const { slug, ...updateData } = form;
        await updateEventType(editingId, { ...updateData, teamId: updateData.teamId || null });
      } else {
        // Create new
        await createEventType(companyId, { ...form, teamId: form.teamId || null });
      }
      resetForm();
      load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const startEdit = (et: any) => {
    setForm({
      title: et.title,
      slug: et.slug,
      description: et.description ?? '',
      duration: et.duration,
      bufferBefore: et.bufferBefore,
      bufferAfter: et.bufferAfter,
      minNotice: et.minNotice,
      maxAdvance: et.maxAdvance,
      autoMeetLink: et.autoMeetLink,
      teamId: et.teamId,
      color: et.color ?? '#2563EB',
    });
    setEditingId(et.id);
    setShowCreate(true);
  };

  const generateSlug = (title: string) => {
    return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  };

  const getBookingUrl = (slug: string) => {
    const base = window.location.origin;
    return `${base}/${companySlug}/${slug}`;
  };

  const copyLink = (id: string, slug: string) => {
    navigator.clipboard.writeText(getBookingUrl(slug));
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (isLoading) return <LoadingSpinner />;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Meine Buchungsseiten</h1>
          <p className="mt-1 text-sm text-gray-500">Erstellen Sie Event Types und teilen Sie den Buchungslink mit Kunden.</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          + Neuer Event Type
        </button>
      </div>

      {error && <ErrorMessage message={error} />}

      {showCreate && (
        <form onSubmit={handleSubmit} className="mt-4 space-y-5 rounded-lg border bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900">{editingId ? 'Event Type bearbeiten' : 'Neuen Event Type erstellen'}</h3>

          {/* Basic info */}
          <div className="space-y-4">
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
                <label className="block text-sm font-medium text-gray-700">URL-Slug *</label>
                <div className="mt-1 flex items-center gap-1">
                  <span className="text-xs text-gray-400">/{companySlug}/</span>
                  <input
                    value={form.slug}
                    onChange={(e) => setForm({ ...form, slug: e.target.value })}
                    placeholder="erstgespraech"
                    required
                    className="flex-1 rounded-md border px-3 py-2 text-sm"
                  />
                </div>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Beschreibung</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Kurze Beschreibung für die Buchungsseite..."
                rows={2}
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              />
            </div>
          </div>

          {/* Scheduling settings */}
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-3">Termineinstellungen</h4>
            <div className="grid grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600">Dauer</label>
                <div className="mt-1 flex items-center gap-1">
                  <input type="number" value={form.duration} onChange={(e) => setForm({ ...form, duration: +e.target.value })} min={5} max={480} className="w-full rounded-md border px-3 py-2 text-sm" />
                  <span className="text-xs text-gray-400">Min</span>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600">Puffer davor</label>
                <div className="mt-1 flex items-center gap-1">
                  <input type="number" value={form.bufferBefore} onChange={(e) => setForm({ ...form, bufferBefore: +e.target.value })} min={0} max={120} className="w-full rounded-md border px-3 py-2 text-sm" />
                  <span className="text-xs text-gray-400">Min</span>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600">Puffer danach</label>
                <div className="mt-1 flex items-center gap-1">
                  <input type="number" value={form.bufferAfter} onChange={(e) => setForm({ ...form, bufferAfter: +e.target.value })} min={0} max={120} className="w-full rounded-md border px-3 py-2 text-sm" />
                  <span className="text-xs text-gray-400">Min</span>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600">Farbe</label>
                <input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="mt-1 h-[38px] w-full rounded-md border cursor-pointer" />
              </div>
            </div>
          </div>

          {/* Booking window */}
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-3">Buchungsfenster</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600">Mindestvorlaufzeit</label>
                <div className="mt-1 flex items-center gap-1">
                  <input type="number" value={form.minNotice} onChange={(e) => setForm({ ...form, minNotice: +e.target.value })} min={0} max={720} className="w-full rounded-md border px-3 py-2 text-sm" />
                  <span className="text-xs text-gray-400 whitespace-nowrap">Stunden</span>
                </div>
                <p className="mt-1 text-xs text-gray-400">Kunden können frühestens X Stunden im Voraus buchen</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600">Buchbar bis</label>
                <div className="mt-1 flex items-center gap-1">
                  <input type="number" value={form.maxAdvance} onChange={(e) => setForm({ ...form, maxAdvance: +e.target.value })} min={1} max={365} className="w-full rounded-md border px-3 py-2 text-sm" />
                  <span className="text-xs text-gray-400 whitespace-nowrap">Tage voraus</span>
                </div>
                <p className="mt-1 text-xs text-gray-400">Wie weit in die Zukunft können Kunden buchen</p>
              </div>
            </div>
          </div>

          {/* Team & features */}
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-3">Zuweisung & Features</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600">Team (Round-Robin)</label>
                <select value={form.teamId ?? ''} onChange={(e) => setForm({ ...form, teamId: e.target.value || null })} className="mt-1 w-full rounded-md border px-3 py-2 text-sm">
                  <option value="">Kein Team — persönliche Buchungsseite</option>
                  {teams.map((t: any) => (
                    <option key={t.id} value={t.id}>{t.name} ({t.rrConfig?.mode?.replace('_', ' ')})</option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-400">
                  {form.teamId ? 'Termine werden per Round-Robin im Team verteilt' : 'Alle Termine werden direkt bei Ihnen gebucht'}
                </p>
              </div>
              <div className="flex items-start gap-3 pt-5">
                <input type="checkbox" id="autoMeet" checked={form.autoMeetLink} onChange={(e) => setForm({ ...form, autoMeetLink: e.target.checked })} className="mt-0.5" />
                <div>
                  <label htmlFor="autoMeet" className="text-sm font-medium text-gray-700">Google Meet Link</label>
                  <p className="text-xs text-gray-400">Automatisch Meet-Link zum Kalender-Event hinzufügen</p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-3 border-t pt-4">
            <button type="submit" className="rounded-md bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700">{editingId ? 'Speichern' : 'Event Type erstellen'}</button>
            <button type="button" onClick={resetForm} className="rounded-md bg-gray-100 px-4 py-2 text-sm text-gray-700">Abbrechen</button>
          </div>
        </form>
      )}

      {/* Event type cards */}
      <div className="mt-6 space-y-4">
        {eventTypes.map((et: any) => (
          <div key={et.id} className="rounded-lg border bg-white shadow-sm overflow-hidden">
            {/* Color bar */}
            <div className="h-1" style={{ backgroundColor: et.color || '#2563EB' }} />

            <div className="p-5">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold text-gray-900">{et.title}</h3>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${et.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {et.active ? 'Aktiv' : 'Inaktiv'}
                    </span>
                  </div>
                  {et.description && <p className="mt-1 text-sm text-gray-500">{et.description}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => startEdit(et)}
                    className="rounded-md bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200"
                  >
                    Bearbeiten
                  </button>
                  <button
                    onClick={() => toggleEventType(et.id).then(load)}
                    className="rounded-md bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200"
                  >
                    {et.active ? 'Deaktivieren' : 'Aktivieren'}
                  </button>
                  <button onClick={() => { if (confirm(`"${et.title}" löschen?`)) deleteEventType(et.id).then(load); }} className="rounded-md bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100">
                    Löschen
                  </button>
                </div>
              </div>

              {/* Booking link */}
              <div className="mt-4 flex items-center gap-2 rounded-md bg-gray-50 px-3 py-2">
                <span className="text-xs text-gray-400">Buchungslink:</span>
                <code className="flex-1 text-sm text-blue-600 truncate">{getBookingUrl(et.slug)}</code>
                <button
                  onClick={() => copyLink(et.id, et.slug)}
                  className="rounded bg-white px-2 py-1 text-xs font-medium text-gray-600 ring-1 ring-gray-200 hover:bg-gray-100"
                >
                  {copiedId === et.id ? 'Kopiert!' : 'Kopieren'}
                </button>
                <a
                  href={getBookingUrl(et.slug)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700"
                >
                  Öffnen
                </a>
              </div>

              {/* Settings grid */}
              <div className="mt-4 grid grid-cols-2 gap-x-8 gap-y-2 text-sm sm:grid-cols-4">
                <div>
                  <span className="text-gray-400">Dauer</span>
                  <p className="font-medium">{et.duration} Min</p>
                </div>
                <div>
                  <span className="text-gray-400">Puffer</span>
                  <p className="font-medium">
                    {et.bufferBefore > 0 || et.bufferAfter > 0
                      ? `${et.bufferBefore}/${et.bufferAfter} Min`
                      : 'Kein Puffer'}
                  </p>
                </div>
                <div>
                  <span className="text-gray-400">Vorlaufzeit</span>
                  <p className="font-medium">Min. {et.minNotice}h</p>
                </div>
                <div>
                  <span className="text-gray-400">Buchbar bis</span>
                  <p className="font-medium">{et.maxAdvance} Tage</p>
                </div>
                <div>
                  <span className="text-gray-400">Zuweisung</span>
                  <p className="font-medium">{et.team ? `Team: ${et.team.name}` : 'Persönlich'}</p>
                </div>
                <div>
                  <span className="text-gray-400">Meet Link</span>
                  <p className="font-medium">{et.autoMeetLink ? 'Automatisch' : 'Aus'}</p>
                </div>
                <div>
                  <span className="text-gray-400">Buchungen</span>
                  <p className="font-medium">{et._count?.bookings ?? 0}</p>
                </div>
              </div>
            </div>
          </div>
        ))}
        {eventTypes.length === 0 && (
          <div className="rounded-lg border-2 border-dashed bg-gray-50 p-12 text-center">
            <div className="text-4xl mb-3">📅</div>
            <h3 className="text-lg font-medium text-gray-900">Noch keine Buchungsseiten</h3>
            <p className="mt-1 text-sm text-gray-500">Erstellen Sie Ihren ersten Event Type und teilen Sie den Link mit Kunden.</p>
            <button onClick={() => setShowCreate(true)} className="mt-4 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
              Ersten Event Type erstellen
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
