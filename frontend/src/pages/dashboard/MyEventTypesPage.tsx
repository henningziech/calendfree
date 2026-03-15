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
    roundRobinMode: 'SEQUENTIAL' as string,
    color: '#0B8ECA',
    bookableHours: null as Record<string, Array<{start: string; end: string}>> | null,
    allowComment: false,
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
    setForm({ title: '', slug: '', description: '', duration: 30, bufferBefore: 0, bufferAfter: 15, minNotice: 4, maxAdvance: 60, autoMeetLink: true, teamId: null, roundRobinMode: 'SEQUENTIAL', color: '#0B8ECA', bookableHours: null, allowComment: false });
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
      roundRobinMode: et.roundRobinMode ?? 'SEQUENTIAL',
      color: et.color ?? '#0B8ECA',
      bookableHours: et.bookableHours ?? null,
      allowComment: et.allowComment ?? false,
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
          <h1 className="text-2xl font-bold text-[#1E293B]">Meine Buchungsseiten</h1>
          <p className="mt-1 text-sm text-[#64748B]">Erstellen Sie Event Types und teilen Sie den Buchungslink mit Kunden.</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="rounded-xl bg-[#0B8ECA] px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-[#0874A6] hover:shadow-md">
          + Neuer Event Type
        </button>
      </div>

      {error && <ErrorMessage message={error} />}

      {showCreate && (
        <form onSubmit={handleSubmit} className="mt-4 space-y-5 rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-[#1E293B]">{editingId ? 'Event Type bearbeiten' : 'Neuen Event Type erstellen'}</h3>

          {/* Basic info */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#1E293B]">Titel *</label>
                <input
                  value={form.title}
                  onChange={(e) => { setForm({ ...form, title: e.target.value, slug: generateSlug(e.target.value) }); }}
                  placeholder="z.B. 30min Erstgespräch"
                  required
                  className="mt-1 w-full rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm focus:border-[#0B8ECA] focus:ring-2 focus:ring-[#0B8ECA]/20 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#1E293B]">URL-Slug *</label>
                <div className="mt-1 flex items-center gap-1">
                  <span className="text-xs text-[#64748B]">/{companySlug}/</span>
                  <input
                    value={form.slug}
                    onChange={(e) => setForm({ ...form, slug: e.target.value })}
                    placeholder="erstgespraech"
                    required
                    className="flex-1 rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm focus:border-[#0B8ECA] focus:ring-2 focus:ring-[#0B8ECA]/20 focus:outline-none"
                  />
                </div>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#1E293B]">Beschreibung</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Kurze Beschreibung für die Buchungsseite..."
                rows={2}
                className="mt-1 w-full rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm focus:border-[#0B8ECA] focus:ring-2 focus:ring-[#0B8ECA]/20 focus:outline-none"
              />
            </div>
          </div>

          {/* Scheduling settings */}
          <div>
            <h4 className="text-sm font-semibold text-[#1E293B] mb-3">Termineinstellungen</h4>
            <div className="grid grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-[#64748B]">Dauer</label>
                <div className="mt-1 flex items-center gap-1">
                  <input type="number" value={form.duration} onChange={(e) => setForm({ ...form, duration: +e.target.value })} min={5} max={480} className="w-full rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm focus:border-[#0B8ECA] focus:outline-none" />
                  <span className="text-xs text-[#64748B]">Min</span>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#64748B]">Puffer davor</label>
                <div className="mt-1 flex items-center gap-1">
                  <input type="number" value={form.bufferBefore} onChange={(e) => setForm({ ...form, bufferBefore: +e.target.value })} min={0} max={120} className="w-full rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm focus:border-[#0B8ECA] focus:outline-none" />
                  <span className="text-xs text-[#64748B]">Min</span>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#64748B]">Puffer danach</label>
                <div className="mt-1 flex items-center gap-1">
                  <input type="number" value={form.bufferAfter} onChange={(e) => setForm({ ...form, bufferAfter: +e.target.value })} min={0} max={120} className="w-full rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm focus:border-[#0B8ECA] focus:outline-none" />
                  <span className="text-xs text-[#64748B]">Min</span>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#64748B]">Farbe</label>
                <input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="mt-1 h-[38px] w-full rounded-xl border border-[#E2E8F0] cursor-pointer" />
              </div>
            </div>
          </div>

          {/* Booking window */}
          <div>
            <h4 className="text-sm font-semibold text-[#1E293B] mb-3">Buchungsfenster</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-[#64748B]">Mindestvorlaufzeit</label>
                <div className="mt-1 flex items-center gap-1">
                  <input type="number" value={form.minNotice} onChange={(e) => setForm({ ...form, minNotice: +e.target.value })} min={0} max={720} className="w-full rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm focus:border-[#0B8ECA] focus:outline-none" />
                  <span className="text-xs text-[#64748B] whitespace-nowrap">Stunden</span>
                </div>
                <p className="mt-1 text-xs text-[#64748B]/70">Kunden können frühestens X Stunden im Voraus buchen</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#64748B]">Buchbar bis</label>
                <div className="mt-1 flex items-center gap-1">
                  <input type="number" value={form.maxAdvance} onChange={(e) => setForm({ ...form, maxAdvance: +e.target.value })} min={1} max={365} className="w-full rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm focus:border-[#0B8ECA] focus:outline-none" />
                  <span className="text-xs text-[#64748B] whitespace-nowrap">Tage voraus</span>
                </div>
                <p className="mt-1 text-xs text-[#64748B]/70">Wie weit in die Zukunft können Kunden buchen</p>
              </div>
            </div>
          </div>

          {/* Bookable hours */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-[#1E293B]">Buchbare Zeiten</h4>
              <label className="flex items-center gap-2 text-xs text-[#64748B]">
                <input
                  type="checkbox"
                  checked={form.bookableHours !== null}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setForm({ ...form, bookableHours: {
                        monday: [{ start: '09:00', end: '17:00' }],
                        tuesday: [{ start: '09:00', end: '17:00' }],
                        wednesday: [{ start: '09:00', end: '17:00' }],
                        thursday: [{ start: '09:00', end: '17:00' }],
                        friday: [{ start: '09:00', end: '17:00' }],
                      }});
                    } else {
                      setForm({ ...form, bookableHours: null });
                    }
                  }}
                />
                Eigene Zeiten festlegen
              </label>
            </div>
            {form.bookableHours === null ? (
              <p className="text-xs text-[#64748B] bg-[#F8FAFC] rounded-xl p-3">
                Standard: Mo–Fr 9:00–17:00 Uhr. Nur freie Slots laut Google Kalender werden angezeigt.
              </p>
            ) : (
              <div className="space-y-2">
                {(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const).map((day) => {
                  const labels: Record<string, string> = { monday: 'Montag', tuesday: 'Dienstag', wednesday: 'Mittwoch', thursday: 'Donnerstag', friday: 'Freitag', saturday: 'Samstag', sunday: 'Sonntag' };
                  const slots = form.bookableHours?.[day] ?? [];
                  const hasSlot = slots.length > 0;
                  const start = hasSlot ? slots[0].start : '09:00';
                  const end = hasSlot ? slots[0].end : '17:00';

                  return (
                    <div key={day} className="flex items-center gap-3">
                      <label className="w-24 text-sm text-[#1E293B]">{labels[day]}</label>
                      <input
                        type="checkbox"
                        checked={hasSlot}
                        onChange={(e) => {
                          const newHours = { ...form.bookableHours! };
                          newHours[day] = e.target.checked ? [{ start: '09:00', end: '17:00' }] : [];
                          setForm({ ...form, bookableHours: newHours });
                        }}
                      />
                      {hasSlot && (
                        <>
                          <input
                            type="time"
                            value={start}
                            onChange={(e) => {
                              const newHours = { ...form.bookableHours! };
                              newHours[day] = [{ start: e.target.value, end }];
                              setForm({ ...form, bookableHours: newHours });
                            }}
                            className="rounded-xl border border-[#E2E8F0] px-2 py-1 text-sm focus:border-[#0B8ECA] focus:outline-none"
                          />
                          <span className="text-[#64748B]">–</span>
                          <input
                            type="time"
                            value={end}
                            onChange={(e) => {
                              const newHours = { ...form.bookableHours! };
                              newHours[day] = [{ start, end: e.target.value }];
                              setForm({ ...form, bookableHours: newHours });
                            }}
                            className="rounded-xl border border-[#E2E8F0] px-2 py-1 text-sm focus:border-[#0B8ECA] focus:outline-none"
                          />
                        </>
                      )}
                    </div>
                  );
                })}
                <p className="text-xs text-[#64748B] mt-1">
                  Nur innerhalb dieser Zeiten werden Slots angeboten. Google Kalender filtert zusätzlich belegte Zeiten.
                </p>
              </div>
            )}
          </div>

          {/* Team & features */}
          <div>
            <h4 className="text-sm font-semibold text-[#1E293B] mb-3">Zuweisung & Features</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-[#64748B]">Team</label>
                <select value={form.teamId ?? ''} onChange={(e) => setForm({ ...form, teamId: e.target.value || null })} className="mt-1 w-full rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm focus:border-[#0B8ECA] focus:outline-none">
                  <option value="">Kein Team — persönliche Buchungsseite</option>
                  {teams.map((t: any) => (
                    <option key={t.id} value={t.id}>{t.name} ({t.memberships?.length ?? 0} Mitglieder)</option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-[#64748B]/70">
                  {form.teamId ? 'Termine werden per Round-Robin im Team verteilt' : 'Alle Termine werden direkt bei Ihnen gebucht'}
                </p>
              </div>
              {form.teamId && (
                <div>
                  <label className="block text-xs font-medium text-[#64748B]">Round-Robin Verfahren</label>
                  <select value={form.roundRobinMode} onChange={(e) => setForm({ ...form, roundRobinMode: e.target.value })} className="mt-1 w-full rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm focus:border-[#0B8ECA] focus:outline-none">
                    <option value="SEQUENTIAL">Sequential — der Reihe nach</option>
                    <option value="LEAST_BUSY">Least Busy — wenigste Termine</option>
                    <option value="WEIGHTED">Weighted — nach Gewichtung</option>
                  </select>
                  <p className="mt-1 text-xs text-[#64748B]/70">
                    {form.roundRobinMode === 'SEQUENTIAL' && 'Jedes Teammitglied kommt abwechselnd dran'}
                    {form.roundRobinMode === 'LEAST_BUSY' && 'Wer die wenigsten Termine hat, bekommt den nächsten'}
                    {form.roundRobinMode === 'WEIGHTED' && 'Verteilung nach Gewichtung (Team-Einstellung)'}
                  </p>
                </div>
              )}
              <div className="space-y-3 pt-5">
                <div className="flex items-start gap-3">
                  <input type="checkbox" id="autoMeet" checked={form.autoMeetLink} onChange={(e) => setForm({ ...form, autoMeetLink: e.target.checked })} className="mt-0.5" />
                  <div>
                    <label htmlFor="autoMeet" className="text-sm font-medium text-[#1E293B]">Google Meet Link</label>
                    <p className="text-xs text-[#64748B]">Automatisch Meet-Link zum Kalender-Event hinzufügen</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <input type="checkbox" id="allowComment" checked={form.allowComment} onChange={(e) => setForm({ ...form, allowComment: e.target.checked })} className="mt-0.5" />
                  <div>
                    <label htmlFor="allowComment" className="text-sm font-medium text-[#1E293B]">Kommentar vom Kunden erlauben</label>
                    <p className="text-xs text-[#64748B]">Kunden können bei der Buchung eine Nachricht hinterlassen</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-3 border-t border-[#E2E8F0] pt-4">
            <button type="submit" className="rounded-xl bg-gradient-to-r from-[#0B8ECA] to-[#14B8A6] px-6 py-2 text-sm font-medium text-white shadow-sm transition-all hover:shadow-md">{editingId ? 'Speichern' : 'Event Type erstellen'}</button>
            <button type="button" onClick={resetForm} className="rounded-xl bg-[#F8FAFC] px-4 py-2 text-sm text-[#64748B] ring-1 ring-[#E2E8F0] hover:bg-[#E2E8F0]">Abbrechen</button>
          </div>
        </form>
      )}

      {/* Event type cards */}
      <div className="mt-6 space-y-4">
        {eventTypes.map((et: any) => (
          <div key={et.id} className="rounded-xl border border-[#E2E8F0] bg-white shadow-sm overflow-hidden transition-all hover:shadow-md">
            {/* Gradient top bar */}
            <div className="h-1.5 bg-gradient-to-r" style={{ backgroundImage: `linear-gradient(to right, ${et.color || '#0B8ECA'}, ${et.color || '#0B8ECA'}80)` }} />

            <div className="p-5">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold text-[#1E293B]">{et.title}</h3>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${et.active ? 'bg-emerald-100 text-emerald-700' : 'bg-[#F8FAFC] text-[#64748B]'}`}>
                      {et.active ? 'Aktiv' : 'Inaktiv'}
                    </span>
                  </div>
                  {et.description && <p className="mt-1 text-sm text-[#64748B]">{et.description}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => startEdit(et)}
                    className="rounded-xl bg-[#F8FAFC] px-3 py-1.5 text-xs font-medium text-[#1E293B] ring-1 ring-[#E2E8F0] transition-colors hover:bg-[#E2E8F0]"
                  >
                    Bearbeiten
                  </button>
                  <button
                    onClick={() => toggleEventType(et.id).then(load)}
                    className="rounded-xl bg-[#F8FAFC] px-3 py-1.5 text-xs font-medium text-[#1E293B] ring-1 ring-[#E2E8F0] transition-colors hover:bg-[#E2E8F0]"
                  >
                    {et.active ? 'Deaktivieren' : 'Aktivieren'}
                  </button>
                  <button onClick={() => { if (confirm(`"${et.title}" löschen?`)) deleteEventType(et.id).then(load); }} className="rounded-xl bg-red-50 px-3 py-1.5 text-xs font-medium text-[#EF4444] ring-1 ring-red-200 transition-colors hover:bg-red-100">
                    Löschen
                  </button>
                </div>
              </div>

              {/* Booking link */}
              <div className="mt-4 flex items-center gap-2 rounded-xl bg-[#F8FAFC] px-3 py-2 ring-1 ring-[#E2E8F0]">
                <span className="text-xs text-[#64748B]">Buchungslink:</span>
                <code className="flex-1 text-sm text-[#0B8ECA] truncate">{getBookingUrl(et.slug)}</code>
                <button
                  onClick={() => copyLink(et.id, et.slug)}
                  className="rounded-lg bg-white px-2.5 py-1 text-xs font-medium text-[#1E293B] ring-1 ring-[#E2E8F0] transition-colors hover:bg-[#E2E8F0]"
                >
                  {copiedId === et.id ? 'Kopiert!' : 'Kopieren'}
                </button>
                <a
                  href={getBookingUrl(et.slug)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg bg-[#0B8ECA] px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-[#0874A6]"
                >
                  Öffnen
                </a>
              </div>

              {/* Settings grid */}
              <div className="mt-4 grid grid-cols-2 gap-x-8 gap-y-2 text-sm sm:grid-cols-4">
                <div>
                  <span className="text-[#64748B]">Dauer</span>
                  <p className="font-medium text-[#1E293B]">{et.duration} Min</p>
                </div>
                <div>
                  <span className="text-[#64748B]">Puffer</span>
                  <p className="font-medium text-[#1E293B]">
                    {et.bufferBefore > 0 || et.bufferAfter > 0
                      ? `${et.bufferBefore}/${et.bufferAfter} Min`
                      : 'Kein Puffer'}
                  </p>
                </div>
                <div>
                  <span className="text-[#64748B]">Vorlaufzeit</span>
                  <p className="font-medium text-[#1E293B]">Min. {et.minNotice}h</p>
                </div>
                <div>
                  <span className="text-[#64748B]">Buchbar bis</span>
                  <p className="font-medium text-[#1E293B]">{et.maxAdvance} Tage</p>
                </div>
                <div>
                  <span className="text-[#64748B]">Zuweisung</span>
                  <p className="font-medium text-[#1E293B]">{et.team ? `Team: ${et.team.name} (${et.roundRobinMode?.replace('_', ' ')})` : 'Persönlich'}</p>
                </div>
                <div>
                  <span className="text-[#64748B]">Meet Link</span>
                  <p className="font-medium text-[#1E293B]">{et.autoMeetLink ? 'Automatisch' : 'Aus'}</p>
                </div>
                <div>
                  <span className="text-[#64748B]">Buchbare Zeiten</span>
                  <p className="font-medium text-[#1E293B]">{et.bookableHours ? 'Eigene Zeiten' : 'Standard (Mo–Fr 9–17)'}</p>
                </div>
                <div>
                  <span className="text-[#64748B]">Buchungen</span>
                  <p className="font-medium text-[#1E293B]">{et._count?.bookings ?? 0}</p>
                </div>
              </div>
            </div>
          </div>
        ))}
        {eventTypes.length === 0 && (
          <div className="rounded-xl border-2 border-dashed border-[#E2E8F0] bg-[#F8FAFC] p-12 text-center">
            <div className="text-4xl mb-3">📅</div>
            <h3 className="text-lg font-medium text-[#1E293B]">Noch keine Buchungsseiten</h3>
            <p className="mt-1 text-sm text-[#64748B]">Erstellen Sie Ihren ersten Event Type und teilen Sie den Link mit Kunden.</p>
            <button onClick={() => setShowCreate(true)} className="mt-4 rounded-xl bg-[#0B8ECA] px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-[#0874A6] hover:shadow-md">
              Ersten Event Type erstellen
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
