import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import {
  getEventType,
  updateEventType,
  deleteEventType,
  toggleEventType,
  getNotificationConfig,
  updateNotificationConfig,
  previewNotification,
} from '../../api/admin';
import NotificationTypeCard from '../../components/notifications/NotificationTypeCard';
import TemplatePreviewModal from '../../components/notifications/TemplatePreviewModal';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ErrorMessage } from '../../components/ui/ErrorMessage';

type Tab = 'general' | 'formFields' | 'notifications';

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

const DEFAULT_CONFIG: NotificationConfigState = {
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

/**
 * Detail page for a single event type with tabs: General, Form Fields, Notifications.
 */
export function EventTypeDetailPage() {
  const { eventTypeId } = useParams<{ eventTypeId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation(['admin', 'common']);

  const [eventType, setEventType] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('general');

  // General tab form state
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [duration, setDuration] = useState(30);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');

  // Notifications tab state
  const [notifConfig, setNotifConfig] = useState<NotificationConfigState>(DEFAULT_CONFIG);
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifError, setNotifError] = useState<string | null>(null);
  const [notifSaveState, setNotifSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [notifLoaded, setNotifLoaded] = useState(false);

  // Preview modal state
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewSubject, setPreviewSubject] = useState('');
  const [previewHtml, setPreviewHtml] = useState('');

  /** Load event type data. */
  const loadEventType = async () => {
    if (!eventTypeId) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await getEventType(eventTypeId);
      setEventType(data);
      setTitle(data.title);
      setSlug(data.slug);
      setDuration(data.duration);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadEventType();
  }, [eventTypeId]);

  /** Load notification config when switching to notifications tab. */
  useEffect(() => {
    if (activeTab !== 'notifications' || notifLoaded || !eventTypeId) return;

    let cancelled = false;
    setNotifLoading(true);
    setNotifError(null);

    getNotificationConfig(eventTypeId)
      .then((data) => {
        if (!cancelled) {
          setNotifConfig({ ...DEFAULT_CONFIG, ...data });
          setNotifLoaded(true);
        }
      })
      .catch((err) => {
        if (!cancelled) setNotifError(err.message);
      })
      .finally(() => {
        if (!cancelled) setNotifLoading(false);
      });

    return () => { cancelled = true; };
  }, [activeTab, eventTypeId, notifLoaded]);

  /** Save general settings. */
  const handleSaveGeneral = async () => {
    if (!eventTypeId) return;
    setSaveState('saving');
    setError(null);
    try {
      await updateEventType(eventTypeId, { title, slug, duration });
      setSaveState('saved');
      setTimeout(() => setSaveState('idle'), 2000);
    } catch (err: any) {
      setError(err.message);
      setSaveState('idle');
    }
  };

  /** Toggle active state. */
  const handleToggle = async () => {
    if (!eventTypeId) return;
    try {
      await toggleEventType(eventTypeId);
      await loadEventType();
    } catch (err: any) {
      setError(err.message);
    }
  };

  /** Delete event type. */
  const handleDelete = async () => {
    if (!eventTypeId || !eventType) return;
    if (!confirm(t('admin:eventTypeDetail.general.confirmDelete', { title: eventType.title }))) return;
    try {
      await deleteEventType(eventTypeId);
      navigate('/admin/event-types');
    } catch (err: any) {
      setError(err.message);
    }
  };

  /** Save notification config. */
  const handleSaveNotifications = useCallback(async () => {
    if (!eventTypeId) return;
    setNotifSaveState('saving');
    setNotifError(null);
    try {
      await updateNotificationConfig(eventTypeId, notifConfig);
      setNotifSaveState('saved');
      setTimeout(() => setNotifSaveState('idle'), 2000);
    } catch (err: any) {
      setNotifError(err.message);
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
        setNotifError(err.message);
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

  const tabs: { key: Tab; label: string }[] = [
    { key: 'general', label: t('admin:eventTypeDetail.tabs.general') },
    { key: 'formFields', label: t('admin:eventTypeDetail.tabs.formFields') },
    { key: 'notifications', label: t('admin:eventTypeDetail.tabs.notifications') },
  ];

  if (isLoading) return <LoadingSpinner />;

  if (!eventType && !isLoading) {
    return (
      <div>
        <button onClick={() => navigate('/admin/event-types')} className="mb-4 text-sm text-[#64748B] hover:text-[#1E293B]">
          &larr; {t('admin:eventTypeDetail.back')}
        </button>
        <ErrorMessage message={error || 'Not found'} />
      </div>
    );
  }

  return (
    <div>
      {/* Back link */}
      <button
        onClick={() => navigate('/admin/event-types')}
        className="mb-4 text-sm text-[#64748B] hover:text-[#1E293B] transition-colors"
      >
        &larr; {t('admin:eventTypeDetail.back')}
      </button>

      {/* Page title + active badge */}
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold text-[#1E293B]">{eventType.title}</h1>
        <button
          onClick={handleToggle}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            eventType.active ? 'bg-emerald-100 text-emerald-700' : 'bg-[#F8FAFC] text-[#64748B]'
          }`}
        >
          {eventType.active ? t('common:active') : t('common:inactive')}
        </button>
      </div>

      {error && <ErrorMessage message={error} />}

      {/* Tab bar */}
      <div className="flex border-b border-[#E2E8F0] mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'border-b-2 border-[#0B8ECA] text-[#0B8ECA]'
                : 'text-[#64748B] hover:text-[#1E293B]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'general' && (
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-sm space-y-5">
          {/* Title */}
          <div>
            <label className="mb-1 block text-sm font-medium text-[#1E293B]">
              {t('admin:eventTypeDetail.general.title')}
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm focus:border-[#0B8ECA] focus:ring-2 focus:ring-[#0B8ECA]/20 focus:outline-none"
            />
          </div>

          {/* Slug */}
          <div>
            <label className="mb-1 block text-sm font-medium text-[#1E293B]">
              {t('admin:eventTypeDetail.general.slug')}
            </label>
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className="w-full rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm focus:border-[#0B8ECA] focus:ring-2 focus:ring-[#0B8ECA]/20 focus:outline-none"
            />
          </div>

          {/* Duration */}
          <div>
            <label className="mb-1 block text-sm font-medium text-[#1E293B]">
              {t('admin:eventTypeDetail.general.duration')}
            </label>
            <input
              type="number"
              value={duration}
              onChange={(e) => setDuration(+e.target.value)}
              min={5}
              max={480}
              className="w-32 rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm focus:border-[#0B8ECA] focus:ring-2 focus:ring-[#0B8ECA]/20 focus:outline-none"
            />
          </div>

          {/* Team (read-only) */}
          <div>
            <label className="mb-1 block text-sm font-medium text-[#1E293B]">
              {t('admin:eventTypeDetail.general.team')}
            </label>
            <p className="text-sm text-[#64748B]">
              {eventType.team ? eventType.team.name : t('admin:eventTypeDetail.general.noTeam')}
            </p>
          </div>

          {/* Round-robin mode (if team-assigned) */}
          {eventType.team && (
            <div>
              <label className="mb-1 block text-sm font-medium text-[#1E293B]">
                {t('admin:eventTypeDetail.general.roundRobin')}
              </label>
              <p className="text-sm text-[#64748B]">{eventType.team.roundRobinMode}</p>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={handleSaveGeneral}
              disabled={saveState === 'saving'}
              className="rounded-xl bg-[#0B8ECA] px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-[#0874A6] hover:shadow-md disabled:opacity-50"
            >
              {saveState === 'saving'
                ? t('admin:eventTypeDetail.general.save') + '...'
                : saveState === 'saved'
                  ? t('admin:eventTypeDetail.general.saved')
                  : t('admin:eventTypeDetail.general.save')}
            </button>
            <button
              onClick={handleDelete}
              className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-[#EF4444] ring-1 ring-[#E2E8F0] transition-colors hover:bg-red-50"
            >
              {t('admin:eventTypeDetail.general.delete')}
            </button>
          </div>
        </div>
      )}

      {activeTab === 'formFields' && (
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-[#1E293B] mb-4">
            {t('admin:eventTypeDetail.formFields.title')}
          </h2>
          {(!eventType.formFields || eventType.formFields.length === 0) ? (
            <p className="text-sm text-[#64748B]">{t('admin:eventTypeDetail.formFields.noFields')}</p>
          ) : (
            <div className="space-y-3">
              {eventType.formFields.map((field: any, idx: number) => (
                <div
                  key={field.id || idx}
                  className="flex items-center justify-between rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3"
                >
                  <div>
                    <span className="font-medium text-[#1E293B]">{field.label}</span>
                    {field.placeholder && (
                      <span className="ml-2 text-xs text-[#94A3B8]">
                        {t('admin:eventTypeDetail.formFields.placeholder')}: {field.placeholder}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-md bg-[#E2E8F0] px-2 py-0.5 text-xs font-medium text-[#64748B]">
                      {field.type}
                    </span>
                    {field.required && (
                      <span className="rounded-md bg-[#0B8ECA]/10 px-2 py-0.5 text-xs font-medium text-[#0B8ECA]">
                        {t('admin:eventTypeDetail.formFields.required')}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'notifications' && (
        <div className="space-y-4">
          {notifLoading && (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#0B8ECA] border-t-transparent" />
            </div>
          )}

          {notifError && (
            <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{notifError}</div>
          )}

          {!notifLoading && (
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

              <button
                type="button"
                onClick={handleSaveNotifications}
                disabled={notifSaveState === 'saving'}
                className="rounded-xl bg-[#0B8ECA] px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-[#0874A6] hover:shadow-md disabled:opacity-50"
              >
                {notifSaveState === 'saving'
                  ? t('admin:notifications.saving')
                  : notifSaveState === 'saved'
                    ? t('admin:notifications.saved')
                    : t('admin:notifications.save')}
              </button>
            </>
          )}
        </div>
      )}

      {/* Preview modal */}
      <TemplatePreviewModal
        isOpen={previewOpen}
        onClose={() => setPreviewOpen(false)}
        subject={previewSubject}
        htmlBody={previewHtml}
      />
    </div>
  );
}
