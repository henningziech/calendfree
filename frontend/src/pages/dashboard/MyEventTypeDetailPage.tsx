import { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import {
  getEventType,
  createEventType,
  updateEventType,
  getTeams,
  getCompanies,
  getNotificationConfig,
  updateNotificationConfig,
  previewNotification,
} from '../../api/admin';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import NotificationTypeCard from '../../components/notifications/NotificationTypeCard';
import TemplatePreviewModal from '../../components/notifications/TemplatePreviewModal';

/** Notification types rendered as cards, in display order. */
const NOTIFICATION_TYPES = [
  'confirmation',
  'cancellation',
  'reminder1',
  'reminder2',
  'followUp',
] as const;

type NotificationType = (typeof NOTIFICATION_TYPES)[number];

/** Timing dropdown options per notification type. */
const TIMING_OPTIONS: Partial<Record<NotificationType, string[]>> = {
  reminder1: ['48h', '24h', '12h', '6h', '2h'],
  reminder2: ['4h', '2h', '1h', '30min', '15min'],
  followUp: ['30min', '1h', '2h', '6h', '24h'],
};

interface NotificationConfigState {
  confirmationEnabled: boolean;
  confirmationSubject: string | null;
  confirmationBody: string | null;
  cancellationEnabled: boolean;
  cancellationSubject: string | null;
  cancellationBody: string | null;
  reminder1Enabled: boolean;
  reminder1Timing: string;
  reminder1Subject: string | null;
  reminder1Body: string | null;
  reminder2Enabled: boolean;
  reminder2Timing: string;
  reminder2Subject: string | null;
  reminder2Body: string | null;
  followUpEnabled: boolean;
  followUpTiming: string;
  followUpSubject: string | null;
  followUpBody: string | null;
}

const DEFAULT_NOTIF_CONFIG: NotificationConfigState = {
  confirmationEnabled: false,
  confirmationSubject: null,
  confirmationBody: null,
  cancellationEnabled: false,
  cancellationSubject: null,
  cancellationBody: null,
  reminder1Enabled: false,
  reminder1Timing: '24h',
  reminder1Subject: null,
  reminder1Body: null,
  reminder2Enabled: false,
  reminder2Timing: '1h',
  reminder2Subject: null,
  reminder2Body: null,
  followUpEnabled: false,
  followUpTiming: '30min',
  followUpSubject: null,
  followUpBody: null,
};

type Tab = 'general' | 'notifications';

/**
 * Dedicated create/edit page for a single event type.
 * Supports three tabs: General, Notifications, and Settings.
 */
export function MyEventTypeDetailPage() {
  const { t } = useTranslation(['dashboard', 'common', 'admin']);
  const { user } = useAuth();
  const navigate = useNavigate();
  const { eventTypeId } = useParams<{ eventTypeId: string }>();
  const [searchParams] = useSearchParams();

  const isCreateMode = !eventTypeId;
  const companyId = user?.activeCompanyId;

  const [activeTab, setActiveTab] = useState<Tab>('general');
  const [isLoading, setIsLoading] = useState(!isCreateMode);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [teams, setTeams] = useState<any[]>([]);
  const [companySlug, setCompanySlug] = useState<string>('');

  // Form state
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
    bookableHours: null as Record<string, Array<{ start: string; end: string }>> | null,
    allowComment: false,
    eventCategory: 'PERSONAL' as 'PERSONAL' | 'TEAM' | 'GROUP',
    maxInvitees: 2,
    showRemainingSpots: false,
  });

  // Notification state
  const [notifConfig, setNotifConfig] = useState<NotificationConfigState>(DEFAULT_NOTIF_CONFIG);
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifSaveState, setNotifSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewSubject, setPreviewSubject] = useState('');
  const [previewHtml, setPreviewHtml] = useState('');

  /** Generate URL-safe slug from title. */
  const generateSlug = (title: string) => {
    return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  };

  /** Load teams and company slug. */
  useEffect(() => {
    if (!companyId) return;
    Promise.all([getTeams(companyId), getCompanies()]).then(([t, companies]) => {
      setTeams(t);
      const company = companies.find((c: any) => c.id === companyId);
      if (company) setCompanySlug(company.slug);
    });
  }, [companyId]);

  /** Set category from query param in create mode. */
  useEffect(() => {
    if (isCreateMode) {
      const category = searchParams.get('category')?.toUpperCase() as 'PERSONAL' | 'TEAM' | 'GROUP' | undefined;
      if (category && ['PERSONAL', 'TEAM', 'GROUP'].includes(category)) {
        setForm((prev) => ({
          ...prev,
          eventCategory: category,
          teamId: category === 'TEAM' ? (teams.length > 0 ? teams[0].id : '') : null,
        }));
      }
    }
  }, [isCreateMode, searchParams, teams]);

  /** Load existing event type in edit mode. */
  useEffect(() => {
    if (!eventTypeId) return;
    setIsLoading(true);
    getEventType(eventTypeId)
      .then((et: any) => {
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
      })
      .catch((err: any) => setError(err.message))
      .finally(() => setIsLoading(false));
  }, [eventTypeId]);

  /** Load notification config when switching to notifications tab. */
  useEffect(() => {
    if (activeTab !== 'notifications' || !eventTypeId) return;
    setNotifLoading(true);
    getNotificationConfig(eventTypeId)
      .then((data) => setNotifConfig({ ...DEFAULT_NOTIF_CONFIG, ...data }))
      .catch((err: any) => setError(err.message))
      .finally(() => setNotifLoading(false));
  }, [activeTab, eventTypeId]);

  /** Save the event type (create or update). */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    setIsSaving(true);
    setError(null);
    try {
      if (eventTypeId) {
        const { slug, ...updateData } = form;
        await updateEventType(eventTypeId, {
          ...updateData,
          teamId: updateData.teamId || null,
          eventCategory: updateData.eventCategory,
          ...(updateData.eventCategory === 'GROUP' ? {
            maxInvitees: updateData.maxInvitees,
            showRemainingSpots: updateData.showRemainingSpots,
          } : {}),
        });
        navigate('/dashboard/my-event-types');
      } else {
        const created: any = await createEventType(companyId, {
          ...form,
          teamId: form.teamId || null,
          eventCategory: form.eventCategory,
          ...(form.eventCategory === 'GROUP' ? {
            maxInvitees: form.maxInvitees,
            showRemainingSpots: form.showRemainingSpots,
          } : {}),
        });
        navigate(`/dashboard/my-event-types/${created.id}`);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  /** Save notification config. */
  const handleNotifSave = useCallback(async () => {
    if (!eventTypeId) return;
    setNotifSaveState('saving');
    setError(null);
    try {
      await updateNotificationConfig(eventTypeId, notifConfig);
      setNotifSaveState('saved');
      setTimeout(() => setNotifSaveState('idle'), 2000);
    } catch (err: any) {
      setError(err.message);
      setNotifSaveState('idle');
    }
  }, [eventTypeId, notifConfig]);

  /** Request a rendered preview for a notification type. */
  const handlePreview = useCallback(
    async (type: NotificationType) => {
      if (!eventTypeId) return;
      const subject = notifConfig[`${type}Subject` as keyof NotificationConfigState] as string | null;
      const body = notifConfig[`${type}Body` as keyof NotificationConfigState] as string | null;
      try {
        const result = await previewNotification(eventTypeId, { type, subject, body });
        setPreviewSubject(result.subject);
        setPreviewHtml(result.htmlBody);
        setPreviewOpen(true);
      } catch (err: any) {
        setError(err.message);
      }
    },
    [eventTypeId, notifConfig],
  );

  /** Update a field in the notification config state. */
  const updateNotifField = <K extends keyof NotificationConfigState>(
    key: K,
    value: NotificationConfigState[K],
  ) => {
    setNotifConfig((prev) => ({ ...prev, [key]: value }));
  };

  if (isLoading) return <LoadingSpinner />;

  const tabs: { key: Tab; label: string }[] = [
    { key: 'general', label: t('dashboard:eventTypeDetail.tabs.general') },
    { key: 'notifications', label: t('dashboard:eventTypeDetail.tabs.notifications') },
  ];

  return (
    <div>
      {/* Back link and title */}
      <button
        onClick={() => navigate('/dashboard/my-event-types')}
        className="mb-4 text-sm text-[#64748B] hover:text-[#1E293B] transition-colors"
      >
        &larr; {t('dashboard:eventTypeDetail.back')}
      </button>
      <h1 className="text-2xl font-bold text-[#1E293B] mb-6">
        {isCreateMode ? t('dashboard:eventTypeDetail.newTitle') : t('dashboard:eventTypeDetail.editTitle')}
      </h1>

      {error && <ErrorMessage message={error} />}

      {/* Tabs */}
      <div className="border-b border-[#E2E8F0] mb-6">
        <div className="flex gap-6">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-[#0B8ECA] text-[#0B8ECA]'
                  : 'border-transparent text-[#64748B] hover:text-[#1E293B]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Create mode hint for notifications */}
      {activeTab === 'notifications' && isCreateMode && (
        <div className="rounded-xl bg-[#F8FAFC] p-6 text-sm text-[#64748B]">
          {t('dashboard:eventTypeDetail.notificationsDisabled')}
        </div>
      )}

      {/* Tab: General */}
      {activeTab === 'general' && (
        <form onSubmit={handleSubmit} className="space-y-5 rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
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
                  onChange={(e) => { setForm({ ...form, title: e.target.value, slug: isCreateMode ? generateSlug(e.target.value) : form.slug }); }}
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
                    disabled={!isCreateMode}
                    className="flex-1 rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm focus:border-[#0B8ECA] focus:ring-2 focus:ring-[#0B8ECA]/20 focus:outline-none disabled:bg-[#F8FAFC] disabled:text-[#94A3B8]"
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
                          <span className="text-[#64748B]">&ndash;</span>
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
            <button type="submit" disabled={isSaving} className="rounded-xl bg-gradient-to-r from-[#0B8ECA] to-[#14B8A6] px-6 py-2 text-sm font-medium text-white shadow-sm transition-all hover:shadow-md disabled:opacity-50">
              {isSaving ? t('common:saving') : eventTypeId ? t('common:save') : t('dashboard:eventTypes.createButton')}
            </button>
            <button type="button" onClick={() => navigate('/dashboard/my-event-types')} className="rounded-xl bg-[#F8FAFC] px-4 py-2 text-sm text-[#64748B] ring-1 ring-[#E2E8F0] hover:bg-[#E2E8F0]">{t('common:cancel')}</button>
          </div>
        </form>
      )}

      {/* Tab: Notifications */}
      {activeTab === 'notifications' && !isCreateMode && (
        <div className="space-y-4">
          {notifLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
            </div>
          ) : (
            <>
              <div className="space-y-4">
                {NOTIFICATION_TYPES.map((type) => (
                  <NotificationTypeCard
                    key={type}
                    type={type}
                    enabled={notifConfig[`${type}Enabled` as keyof NotificationConfigState] as boolean}
                    timing={
                      TIMING_OPTIONS[type]
                        ? (notifConfig[`${type}Timing` as keyof NotificationConfigState] as string)
                        : undefined
                    }
                    timingOptions={TIMING_OPTIONS[type]}
                    subject={notifConfig[`${type}Subject` as keyof NotificationConfigState] as string | null}
                    body={notifConfig[`${type}Body` as keyof NotificationConfigState] as string | null}
                    onToggle={(enabled) =>
                      updateNotifField(`${type}Enabled` as keyof NotificationConfigState, enabled as any)
                    }
                    onTimingChange={
                      TIMING_OPTIONS[type]
                        ? (timing) =>
                            updateNotifField(`${type}Timing` as keyof NotificationConfigState, timing as any)
                        : undefined
                    }
                    onSubjectChange={(subject) =>
                      updateNotifField(`${type}Subject` as keyof NotificationConfigState, subject as any)
                    }
                    onBodyChange={(body) =>
                      updateNotifField(`${type}Body` as keyof NotificationConfigState, body as any)
                    }
                    onPreview={() => handlePreview(type)}
                  />
                ))}
              </div>
              <div className="border-t border-[#E2E8F0] pt-4">
                <button
                  type="button"
                  onClick={handleNotifSave}
                  disabled={notifSaveState === 'saving'}
                  className="rounded-xl bg-gradient-to-r from-[#0B8ECA] to-[#14B8A6] px-6 py-2 text-sm font-medium text-white shadow-sm transition-all hover:shadow-md disabled:opacity-50"
                >
                  {notifSaveState === 'saving'
                    ? t('admin:notifications.saving')
                    : notifSaveState === 'saved'
                      ? t('admin:notifications.saved')
                      : t('admin:notifications.save')}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Preview modal for notifications */}
      <TemplatePreviewModal
        isOpen={previewOpen}
        onClose={() => setPreviewOpen(false)}
        subject={previewSubject}
        htmlBody={previewHtml}
      />
    </div>
  );
}
