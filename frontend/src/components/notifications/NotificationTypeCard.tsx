import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

/** Props for a single notification type configuration card. */
export interface NotificationTypeCardProps {
  type: 'confirmation' | 'cancellation' | 'reminder1' | 'reminder2' | 'followUp';
  enabled: boolean;
  timing?: string;
  timingOptions?: string[];
  subject: string | null;
  body: string | null;
  onToggle: (enabled: boolean) => void;
  onTimingChange?: (timing: string) => void;
  onSubjectChange: (subject: string | null) => void;
  onBodyChange: (body: string | null) => void;
  onPreview: () => void;
}

const BASE_TEMPLATE_VARIABLES = [
  'customerName',
  'customerEmail',
  'eventTypeTitle',
  'consultantName',
  'consultantEmail',
  'dateTime',
  'duration',
  'meetLink',
  'cancelUrl',
  'rescheduleUrl',
  'companyName',
];

/**
 * Collapsible card for configuring a single notification type.
 * Shows a toggle, optional timing dropdown, and an expandable template editor.
 */
export default function NotificationTypeCard({
  type,
  enabled,
  timing,
  timingOptions,
  subject,
  body,
  onToggle,
  onTimingChange,
  onSubjectChange,
  onBodyChange,
  onPreview,
}: NotificationTypeCardProps) {
  const { t } = useTranslation('admin');
  const [expanded, setExpanded] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const variables =
    type === 'reminder1' || type === 'reminder2'
      ? [...BASE_TEMPLATE_VARIABLES, 'reminderText']
      : BASE_TEMPLATE_VARIABLES;

  /** Insert a template variable at the current cursor position in the body textarea. */
  const insertVariable = (variableName: string) => {
    const textarea = bodyRef.current;
    if (!textarea) return;

    const tag = `{{${variableName}}}`;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const current = body ?? '';
    const newValue = current.substring(0, start) + tag + current.substring(end);

    onBodyChange(newValue);

    // Restore cursor position after React re-render
    requestAnimationFrame(() => {
      textarea.focus();
      const cursorPos = start + tag.length;
      textarea.setSelectionRange(cursorPos, cursorPos);
    });
  };

  const handleResetToDefault = () => {
    onSubjectChange(null);
    onBodyChange(null);
  };

  return (
    <div className="rounded-xl border border-[#E2E8F0] bg-white p-4">
      {/* Header row */}
      <div className="flex items-center gap-3">
        {/* Toggle */}
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={() => onToggle(!enabled)}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
            enabled ? 'bg-blue-600' : 'bg-gray-200'
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform ${
              enabled ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>

        {/* Title */}
        <span className="font-medium text-gray-900">
          {t(`notifications.${type}`)}
        </span>

        <div className="ml-auto flex items-center gap-2">
          {/* Timing dropdown */}
          {timingOptions && timingOptions.length > 0 && (
            <select
              value={timing ?? timingOptions[0]}
              onChange={(e) => onTimingChange?.(e.target.value)}
              disabled={!enabled}
              className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
            >
              {timingOptions.map((opt) => {
                const timingPrefix =
                  type === 'followUp'
                    ? t('notifications.timingPrefix.followUp')
                    : t('notifications.timingPrefix.reminder');
                return (
                  <option key={opt} value={opt}>
                    {t(`notifications.timingOptions.${opt}`)} {timingPrefix}
                  </option>
                );
              })}
            </select>
          )}

          {/* Preview button */}
          <button
            type="button"
            onClick={onPreview}
            disabled={!enabled}
            className="rounded-md border border-gray-300 px-3 py-1 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('notifications.preview')}
          </button>
        </div>
      </div>

      {/* Content area (disabled when toggle is off) */}
      <div className={!enabled ? 'opacity-50 pointer-events-none' : ''}>
        {/* Edit toggle */}
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="mt-3 flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
        >
          <span
            className={`inline-block transition-transform ${expanded ? 'rotate-90' : ''}`}
          >
            &#9654;
          </span>
          {t('notifications.edit')}
        </button>

        {/* Expandable editor */}
        {expanded && (
          <div className="mt-3 space-y-3">
            {/* Subject */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {t('notifications.subject')}
              </label>
              <input
                type="text"
                value={subject ?? ''}
                onChange={(e) =>
                  onSubjectChange(e.target.value || null)
                }
                placeholder={t('notifications.subjectPlaceholder')}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Body */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {t('notifications.body')}
              </label>
              <textarea
                ref={bodyRef}
                value={body ?? ''}
                onChange={(e) =>
                  onBodyChange(e.target.value || null)
                }
                placeholder={t('notifications.bodyPlaceholder')}
                rows={5}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Variable chips */}
            <div>
              <span className="mb-1 block text-xs font-medium text-gray-500">
                {t('notifications.variables')}
              </span>
              <div className="flex flex-wrap gap-1">
                {variables.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => insertVariable(v)}
                    className="inline-flex items-center rounded px-2 py-0.5 text-xs bg-[#F1F5F9] text-[#64748B] cursor-pointer hover:bg-[#E2E8F0]"
                  >
                    {`{{${v}}}`}
                  </button>
                ))}
              </div>
            </div>

            {/* Reset to default */}
            <button
              type="button"
              onClick={handleResetToDefault}
              className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
            >
              {t('notifications.resetToDefault')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
