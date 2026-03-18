import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  getNotificationConfig,
  updateNotificationConfig,
  previewNotification,
} from '../../api/admin';
import NotificationTypeCard from './NotificationTypeCard';
import TemplatePreviewModal from './TemplatePreviewModal';

/** Props for the notification configuration slide-over panel. */
export interface NotificationConfigPanelProps {
  eventTypeId: string;
  isOpen: boolean;
  onClose: () => void;
}

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
 * Slide-over panel for configuring notification settings for an event type.
 * Loads the current config on open, renders five NotificationTypeCard components,
 * and provides save and preview functionality.
 */
export function NotificationConfigPanel({
  eventTypeId,
  isOpen,
  onClose,
}: NotificationConfigPanelProps) {
  const { t } = useTranslation('admin');
  const [config, setConfig] = useState<NotificationConfigState>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');

  // Preview modal state
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewSubject, setPreviewSubject] = useState('');
  const [previewHtml, setPreviewHtml] = useState('');

  /** Load notification config when panel opens. */
  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    getNotificationConfig(eventTypeId)
      .then((data) => {
        if (!cancelled) {
          setConfig({ ...DEFAULT_CONFIG, ...data });
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message || 'Failed to load notification config');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, eventTypeId]);

  /** Save the current configuration. */
  const handleSave = useCallback(async () => {
    setSaveState('saving');
    setError(null);
    try {
      await updateNotificationConfig(eventTypeId, config);
      setSaveState('saved');
      setTimeout(() => setSaveState('idle'), 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to save notification config');
      setSaveState('idle');
    }
  }, [eventTypeId, config]);

  /** Request a rendered preview for a notification type. */
  const handlePreview = useCallback(
    async (type: NotificationType) => {
      const subject = config[`${type}Subject` as keyof NotificationConfigState] as string | null;
      const body = config[`${type}Body` as keyof NotificationConfigState] as string | null;
      try {
        const result = await previewNotification(eventTypeId, { type, subject, body });
        setPreviewSubject(result.subject);
        setPreviewHtml(result.htmlBody);
        setPreviewOpen(true);
      } catch (err: any) {
        setError(err.message || 'Failed to generate preview');
      }
    },
    [eventTypeId, config],
  );

  /** Update a field in the config state. */
  const updateField = <K extends keyof NotificationConfigState>(
    key: K,
    value: NotificationConfigState[K],
  ) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />

      {/* Slide-over panel */}
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col bg-gray-50 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            {t('notifications.title')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
            </div>
          )}

          {error && (
            <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {!loading && (
            <div className="space-y-4">
              {NOTIFICATION_TYPES.map((type) => (
                <NotificationTypeCard
                  key={type}
                  type={type}
                  enabled={config[`${type}Enabled` as keyof NotificationConfigState] as boolean}
                  timing={
                    TIMING_OPTIONS[type]
                      ? (config[`${type}Timing` as keyof NotificationConfigState] as string)
                      : undefined
                  }
                  timingOptions={TIMING_OPTIONS[type]}
                  subject={config[`${type}Subject` as keyof NotificationConfigState] as string | null}
                  body={config[`${type}Body` as keyof NotificationConfigState] as string | null}
                  onToggle={(enabled) =>
                    updateField(`${type}Enabled` as keyof NotificationConfigState, enabled as any)
                  }
                  onTimingChange={
                    TIMING_OPTIONS[type]
                      ? (timing) =>
                          updateField(`${type}Timing` as keyof NotificationConfigState, timing as any)
                      : undefined
                  }
                  onSubjectChange={(subject) =>
                    updateField(`${type}Subject` as keyof NotificationConfigState, subject as any)
                  }
                  onBodyChange={(body) =>
                    updateField(`${type}Body` as keyof NotificationConfigState, body as any)
                  }
                  onPreview={() => handlePreview(type)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {!loading && (
          <div className="border-t border-gray-200 bg-white px-6 py-4">
            <button
              type="button"
              onClick={handleSave}
              disabled={saveState === 'saving'}
              className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
            >
              {saveState === 'saving'
                ? t('notifications.saving')
                : saveState === 'saved'
                  ? t('notifications.saved')
                  : t('notifications.save')}
            </button>
          </div>
        )}
      </div>

      {/* Preview modal */}
      <TemplatePreviewModal
        isOpen={previewOpen}
        onClose={() => setPreviewOpen(false)}
        subject={previewSubject}
        htmlBody={previewHtml}
      />
    </>
  );
}
