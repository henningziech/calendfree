import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { getEventTypes, createEventType, updateEventType, toggleEventType, deleteEventType, getTeams } from '../../api/admin';
import { getCompanies } from '../../api/admin';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { NotificationConfigPanel } from '../../components/notifications/NotificationConfigPanel';

export function MyEventTypesPage() {
  const { t } = useTranslation(['dashboard', 'common', 'admin']);
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [eventTypes, setEventTypes] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [companySlug, setCompanySlug] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [notifEventTypeId, setNotifEventTypeId] = useState<string | null>(null);
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
    eventCategory: 'PERSONAL' as 'PERSONAL' | 'TEAM' | 'GROUP',
    maxInvitees: 2,
    showRemainingSpots: false,
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

  useEffect(() => {
    const createParam = searchParams.get('create');
    if (createParam) {
      setShowCreate(true);
      const category = createParam.toUpperCase() as 'PERSONAL' | 'TEAM' | 'GROUP';
      setForm((prev: any) => ({
        ...prev,
        eventCategory: category,
        teamId: category === 'TEAM' ? (teams.length > 0 ? teams[0].id : '') : null,
      }));
      // Clear the query param
      setSearchParams({}, { replace: true });
    }
  }, [searchParams]);

  const resetForm = () => {
    setForm({ title: '', slug: '', description: '', duration: 30, bufferBefore: 0, bufferAfter: 15, minNotice: 4, maxAdvance: 60, autoMeetLink: true, teamId: null, roundRobinMode: 'SEQUENTIAL', color: '#0B8ECA', bookableHours: null, allowComment: false, eventCategory: 'PERSONAL', maxInvitees: 2, showRemainingSpots: false });
    setEditingId(null);
    setShowCreate(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    try {
      if (editingId) {
        const { slug, ...updateData } = form;
        await updateEventType(editingId, {
          ...updateData,
          teamId: updateData.teamId || null,
          eventCategory: updateData.eventCategory,
          ...(updateData.eventCategory === 'GROUP' ? {
            maxInvitees: updateData.maxInvitees,
            showRemainingSpots: updateData.showRemainingSpots,
          } : {}),
        });
      } else {
        await createEventType(companyId, {
          ...form,
          teamId: form.teamId || null,
          eventCategory: form.eventCategory,
          ...(form.eventCategory === 'GROUP' ? {
            maxInvitees: form.maxInvitees,
            showRemainingSpots: form.showRemainingSpots,
          } : {}),
        });
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
      eventCategory: et.eventCategory ?? 'PERSONAL',
      maxInvitees: et.maxInvitees ?? 2,
      showRemainingSpots: et.showRemainingSpots ?? false,
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
          <h1 className="text-2xl font-bold text-[#1E293B]">{t('dashboard:eventTypes.title')}</h1>
          <p className="mt-1 text-sm text-[#64748B]">{t('dashboard:eventTypes.subtitle')}</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="rounded-xl bg-[#0B8ECA] px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-[#0874A6] hover:shadow-md">
          {t('dashboard:eventTypes.newEventType')}
        </button>
      </div>

      {error && <ErrorMessage message={error} />}

      {showCreate && (
        <form onSubmit={handleSubmit} className="mt-4 space-y-5 rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-[#1E293B]">{editingId ? t('dashboard:eventTypes.editTitle') : t('dashboard:eventTypes.createTitle')}</h3>

          {/* Event Category indicator */}
          <div className="mb-4 rounded-lg bg-[#F8FAFC] px-3 py-2 text-sm text-[#64748B]">
            {form.eventCategory === 'PERSONAL' && t('dashboard:eventTypes.categoryPersonal')}
            {form.eventCategory === 'TEAM' && t('dashboard:eventTypes.categoryTeam')}
            {form.eventCategory === 'GROUP' && t('dashboard:eventTypes.categoryGroup')}
          </div>

          {/* Basic info */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#1E293B]">{t('dashboard:eventTypes.fieldTitle')}</label>
                <input
                  value={form.title}
                  onChange={(e) => { setForm({ ...form, title: e.target.value, slug: generateSlug(e.target.value) }); }}
                  placeholder={t('dashboard:eventTypes.titlePlaceholder')}
                  required
                  className="mt-1 w-full rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm focus:border-[#0B8ECA] focus:ring-2 focus:ring-[#0B8ECA]/20 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#1E293B]">{t('dashboard:eventTypes.fieldSlug')}</label>
                <div className="mt-1 flex items-center gap-1">
                  <span className="text-xs text-[#64748B]">/{companySlug}/</span>
                  <input
                    value={form.slug}
                    onChange={(e) => setForm({ ...form, slug: e.target.value })}
                    placeholder={t('dashboard:eventTypes.slugPlaceholder')}
                    required
                    className="flex-1 rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm focus:border-[#0B8ECA] focus:ring-2 focus:ring-[#0B8ECA]/20 focus:outline-none"
                  />
                </div>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#1E293B]">{t('dashboard:eventTypes.fieldDescription')}</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder={t('dashboard:eventTypes.descriptionPlaceholder')}
                rows={2}
                className="mt-1 w-full rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm focus:border-[#0B8ECA] focus:ring-2 focus:ring-[#0B8ECA]/20 focus:outline-none"
              />
            </div>
          </div>

          {/* Scheduling settings */}
          <div>
            <h4 className="text-sm font-semibold text-[#1E293B] mb-3">{t('dashboard:eventTypes.schedulingSettings')}</h4>
            <div className="grid grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-[#64748B]">{t('dashboard:eventTypes.duration')}</label>
                <div className="mt-1 flex items-center gap-1">
                  <input type="number" value={form.duration} onChange={(e) => setForm({ ...form, duration: +e.target.value })} min={5} max={480} className="w-full rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm focus:border-[#0B8ECA] focus:outline-none" />
                  <span className="text-xs text-[#64748B]">{t('dashboard:eventTypes.minutes')}</span>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#64748B]">{t('dashboard:eventTypes.bufferBefore')}</label>
                <div className="mt-1 flex items-center gap-1">
                  <input type="number" value={form.bufferBefore} onChange={(e) => setForm({ ...form, bufferBefore: +e.target.value })} min={0} max={120} className="w-full rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm focus:border-[#0B8ECA] focus:outline-none" />
                  <span className="text-xs text-[#64748B]">{t('dashboard:eventTypes.minutes')}</span>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#64748B]">{t('dashboard:eventTypes.bufferAfter')}</label>
                <div className="mt-1 flex items-center gap-1">
                  <input type="number" value={form.bufferAfter} onChange={(e) => setForm({ ...form, bufferAfter: +e.target.value })} min={0} max={120} className="w-full rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm focus:border-[#0B8ECA] focus:outline-none" />
                  <span className="text-xs text-[#64748B]">{t('dashboard:eventTypes.minutes')}</span>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#64748B]">{t('dashboard:eventTypes.color')}</label>
                <input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="mt-1 h-[38px] w-full rounded-xl border border-[#E2E8F0] cursor-pointer" />
              </div>
            </div>
          </div>

          {/* Booking window */}
          <div>
            <h4 className="text-sm font-semibold text-[#1E293B] mb-3">{t('dashboard:eventTypes.bookingWindow')}</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-[#64748B]">{t('dashboard:eventTypes.minNotice')}</label>
                <div className="mt-1 flex items-center gap-1">
                  <input type="number" value={form.minNotice} onChange={(e) => setForm({ ...form, minNotice: +e.target.value })} min={0} max={720} className="w-full rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm focus:border-[#0B8ECA] focus:outline-none" />
                  <span className="text-xs text-[#64748B] whitespace-nowrap">{t('dashboard:eventTypes.hours')}</span>
                </div>
                <p className="mt-1 text-xs text-[#64748B]/70">{t('dashboard:eventTypes.minNoticeHelp')}</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#64748B]">{t('dashboard:eventTypes.bookableUntil')}</label>
                <div className="mt-1 flex items-center gap-1">
                  <input type="number" value={form.maxAdvance} onChange={(e) => setForm({ ...form, maxAdvance: +e.target.value })} min={1} max={365} className="w-full rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm focus:border-[#0B8ECA] focus:outline-none" />
                  <span className="text-xs text-[#64748B] whitespace-nowrap">{t('dashboard:eventTypes.daysAhead')}</span>
                </div>
                <p className="mt-1 text-xs text-[#64748B]/70">{t('dashboard:eventTypes.bookableUntilHelp')}</p>
              </div>
            </div>
          </div>

          {/* Bookable hours */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-[#1E293B]">{t('dashboard:eventTypes.bookableHours')}</h4>
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
                {t('dashboard:eventTypes.setCustomHours')}
              </label>
            </div>
            {form.bookableHours === null ? (
              <p className="text-xs text-[#64748B] bg-[#F8FAFC] rounded-xl p-3">
                {t('dashboard:eventTypes.defaultHours')}
              </p>
            ) : (
              <div className="space-y-2">
                {(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const).map((day) => {
                  const slots = form.bookableHours?.[day] ?? [];
                  const hasSlot = slots.length > 0;
                  const start = hasSlot ? slots[0].start : '09:00';
                  const end = hasSlot ? slots[0].end : '17:00';

                  return (
                    <div key={day} className="flex items-center gap-3">
                      <label className="w-24 text-sm text-[#1E293B]">{t(`dashboard:eventTypes.days.${day}`)}</label>
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
                  {t('dashboard:eventTypes.customHoursHelp')}
                </p>
              </div>
            )}
          </div>

          {/* Team & features */}
          <div>
            <h4 className="text-sm font-semibold text-[#1E293B] mb-3">{t('dashboard:eventTypes.assignmentFeatures')}</h4>
            <div className="grid grid-cols-2 gap-4">
              {form.eventCategory !== 'GROUP' && (
              <div>
                <label className="block text-xs font-medium text-[#64748B]">{t('dashboard:eventTypes.team')}</label>
                <select value={form.teamId ?? ''} onChange={(e) => setForm({ ...form, teamId: e.target.value || null })} required={form.eventCategory === 'TEAM'} className="mt-1 w-full rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm focus:border-[#0B8ECA] focus:outline-none">
                  <option value="">{t('dashboard:eventTypes.noTeam')}</option>
                  {teams.map((tm: any) => (
                    <option key={tm.id} value={tm.id}>{tm.name} ({t('dashboard:eventTypes.members', { count: tm.memberships?.length ?? 0 })})</option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-[#64748B]/70">
                  {form.teamId ? t('dashboard:eventTypes.teamAssigned') : t('dashboard:eventTypes.personalAssigned')}
                </p>
              </div>
              )}
              {form.eventCategory !== 'GROUP' && form.teamId && (
                <div>
                  <label className="block text-xs font-medium text-[#64748B]">{t('dashboard:eventTypes.roundRobinMode')}</label>
                  <select value={form.roundRobinMode} onChange={(e) => setForm({ ...form, roundRobinMode: e.target.value })} className="mt-1 w-full rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm focus:border-[#0B8ECA] focus:outline-none">
                    <option value="SEQUENTIAL">{t('dashboard:eventTypes.sequential')}</option>
                    <option value="LEAST_BUSY">{t('dashboard:eventTypes.leastBusy')}</option>
                    <option value="WEIGHTED">{t('dashboard:eventTypes.weighted')}</option>
                  </select>
                  <p className="mt-1 text-xs text-[#64748B]/70">
                    {form.roundRobinMode === 'SEQUENTIAL' && t('dashboard:eventTypes.sequentialHelp')}
                    {form.roundRobinMode === 'LEAST_BUSY' && t('dashboard:eventTypes.leastBusyHelp')}
                    {form.roundRobinMode === 'WEIGHTED' && t('dashboard:eventTypes.weightedHelp')}
                  </p>
                </div>
              )}
              <div className="space-y-3 pt-5">
                <div className="flex items-start gap-3">
                  <input type="checkbox" id="autoMeet" checked={form.autoMeetLink} onChange={(e) => setForm({ ...form, autoMeetLink: e.target.checked })} className="mt-0.5" />
                  <div>
                    <label htmlFor="autoMeet" className="text-sm font-medium text-[#1E293B]">{t('dashboard:eventTypes.googleMeetLink')}</label>
                    <p className="text-xs text-[#64748B]">{t('dashboard:eventTypes.autoMeetHelp')}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <input type="checkbox" id="allowComment" checked={form.allowComment} onChange={(e) => setForm({ ...form, allowComment: e.target.checked })} className="mt-0.5" />
                  <div>
                    <label htmlFor="allowComment" className="text-sm font-medium text-[#1E293B]">{t('dashboard:eventTypes.allowComment')}</label>
                    <p className="text-xs text-[#64748B]">{t('dashboard:eventTypes.allowCommentHelp')}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* GROUP-specific fields */}
          {form.eventCategory === 'GROUP' && (
            <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-sm">
              <h4 className="font-semibold text-[#1E293B]">{t('dashboard:eventTypes.participantLimit')}</h4>
              <p className="text-sm text-[#64748B]">{t('dashboard:eventTypes.maxParticipants')}</p>
              <input
                type="number"
                value={form.maxInvitees ?? 2}
                onChange={(e) => setForm({ ...form, maxInvitees: +e.target.value || 2 })}
                min={2} max={1000}
                className="mt-2 w-24 rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm focus:border-[#0B8ECA] focus:outline-none"
              />
              <label className="mt-3 flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.showRemainingSpots ?? false}
                  onChange={(e) => setForm({ ...form, showRemainingSpots: e.target.checked })}
                />
                <span className="text-sm text-[#64748B]">{t('dashboard:eventTypes.showRemainingSpots')}</span>
              </label>
            </div>
          )}

          <div className="flex gap-3 border-t border-[#E2E8F0] pt-4">
            <button type="submit" className="rounded-xl bg-gradient-to-r from-[#0B8ECA] to-[#14B8A6] px-6 py-2 text-sm font-medium text-white shadow-sm transition-all hover:shadow-md">{editingId ? t('common:save') : t('dashboard:eventTypes.createButton')}</button>
            <button type="button" onClick={resetForm} className="rounded-xl bg-[#F8FAFC] px-4 py-2 text-sm text-[#64748B] ring-1 ring-[#E2E8F0] hover:bg-[#E2E8F0]">{t('common:cancel')}</button>
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
                      {et.active ? t('common:active') : t('common:inactive')}
                    </span>
                  </div>
                  {et.description && <p className="mt-1 text-sm text-[#64748B]">{et.description}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setNotifEventTypeId(et.id)}
                    className="rounded-xl bg-[#F8FAFC] px-3 py-1.5 text-xs font-medium text-[#1E293B] ring-1 ring-[#E2E8F0] transition-colors hover:bg-[#E2E8F0] flex items-center gap-1"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-3.5 w-3.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
                    </svg>
                    {t('admin:notifications.configure')}
                  </button>
                  <button
                    onClick={() => startEdit(et)}
                    className="rounded-xl bg-[#F8FAFC] px-3 py-1.5 text-xs font-medium text-[#1E293B] ring-1 ring-[#E2E8F0] transition-colors hover:bg-[#E2E8F0]"
                  >
                    {t('common:edit')}
                  </button>
                  <button
                    onClick={() => toggleEventType(et.id).then(load)}
                    className="rounded-xl bg-[#F8FAFC] px-3 py-1.5 text-xs font-medium text-[#1E293B] ring-1 ring-[#E2E8F0] transition-colors hover:bg-[#E2E8F0]"
                  >
                    {et.active ? t('dashboard:eventTypes.deactivate') : t('dashboard:eventTypes.activate')}
                  </button>
                  <button onClick={() => { if (confirm(t('dashboard:eventTypes.confirmDelete', { title: et.title }))) deleteEventType(et.id).then(load); }} className="rounded-xl bg-red-50 px-3 py-1.5 text-xs font-medium text-[#EF4444] ring-1 ring-red-200 transition-colors hover:bg-red-100">
                    {t('common:delete')}
                  </button>
                </div>
              </div>

              {/* Booking link */}
              <div className="mt-4 flex items-center gap-2 rounded-xl bg-[#F8FAFC] px-3 py-2 ring-1 ring-[#E2E8F0]">
                <span className="text-xs text-[#64748B]">{t('dashboard:eventTypes.bookingLink')}</span>
                <code className="flex-1 text-sm text-[#0B8ECA] truncate">{getBookingUrl(et.slug)}</code>
                <button
                  onClick={() => copyLink(et.id, et.slug)}
                  className="rounded-lg bg-white px-2.5 py-1 text-xs font-medium text-[#1E293B] ring-1 ring-[#E2E8F0] transition-colors hover:bg-[#E2E8F0]"
                >
                  {copiedId === et.id ? t('dashboard:eventTypes.copied') : t('dashboard:eventTypes.copy')}
                </button>
                <a
                  href={getBookingUrl(et.slug)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg bg-[#0B8ECA] px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-[#0874A6]"
                >
                  {t('dashboard:eventTypes.open')}
                </a>
              </div>

              {/* Settings grid */}
              <div className="mt-4 grid grid-cols-2 gap-x-8 gap-y-2 text-sm sm:grid-cols-4">
                <div>
                  <span className="text-[#64748B]">{t('dashboard:eventTypes.duration')}</span>
                  <p className="font-medium text-[#1E293B]">{et.duration} {t('dashboard:eventTypes.minutes')}</p>
                </div>
                <div>
                  <span className="text-[#64748B]">{t('dashboard:eventTypes.bufferBefore').split(' ')[0]}</span>
                  <p className="font-medium text-[#1E293B]">
                    {et.bufferBefore > 0 || et.bufferAfter > 0
                      ? t('dashboard:eventTypes.bufferDisplay', { before: et.bufferBefore, after: et.bufferAfter })
                      : t('dashboard:eventTypes.noBuffer')}
                  </p>
                </div>
                <div>
                  <span className="text-[#64748B]">{t('dashboard:eventTypes.leadTime')}</span>
                  <p className="font-medium text-[#1E293B]">{t('dashboard:eventTypes.minNoticeDisplay', { hours: et.minNotice })}</p>
                </div>
                <div>
                  <span className="text-[#64748B]">{t('dashboard:eventTypes.bookableUntil')}</span>
                  <p className="font-medium text-[#1E293B]">{t('dashboard:eventTypes.daysDisplay', { days: et.maxAdvance })}</p>
                </div>
                <div>
                  <span className="text-[#64748B]">{t('dashboard:eventTypes.assignment')}</span>
                  <p className="font-medium text-[#1E293B]">{et.team ? t('dashboard:eventTypes.teamAssignment', { name: et.team.name, mode: et.roundRobinMode?.replace('_', ' ') }) : t('dashboard:eventTypes.personal')}</p>
                </div>
                <div>
                  <span className="text-[#64748B]">{t('dashboard:eventTypes.meetLink')}</span>
                  <p className="font-medium text-[#1E293B]">{et.autoMeetLink ? t('dashboard:eventTypes.automatic') : t('dashboard:eventTypes.off')}</p>
                </div>
                <div>
                  <span className="text-[#64748B]">{t('dashboard:eventTypes.bookableHours')}</span>
                  <p className="font-medium text-[#1E293B]">{et.bookableHours ? t('dashboard:eventTypes.customHours') : t('dashboard:eventTypes.defaultHoursShort')}</p>
                </div>
                <div>
                  <span className="text-[#64748B]">{t('dashboard:eventTypes.bookingsCount')}</span>
                  <p className="font-medium text-[#1E293B]">{et._count?.bookings ?? 0}</p>
                </div>
              </div>
            </div>
          </div>
        ))}
        {eventTypes.length === 0 && (
          <div className="rounded-xl border-2 border-dashed border-[#E2E8F0] bg-[#F8FAFC] p-12 text-center">
            <div className="text-4xl mb-3">📅</div>
            <h3 className="text-lg font-medium text-[#1E293B]">{t('dashboard:eventTypes.noEventTypes')}</h3>
            <p className="mt-1 text-sm text-[#64748B]">{t('dashboard:eventTypes.noEventTypesHint')}</p>
            <button onClick={() => setShowCreate(true)} className="mt-4 rounded-xl bg-[#0B8ECA] px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-[#0874A6] hover:shadow-md">
              {t('dashboard:eventTypes.createFirst')}
            </button>
          </div>
        )}
      </div>

      {notifEventTypeId && (
        <NotificationConfigPanel
          eventTypeId={notifEventTypeId}
          isOpen={!!notifEventTypeId}
          onClose={() => setNotifEventTypeId(null)}
        />
      )}
    </div>
  );
}
