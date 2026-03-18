import { useTranslation } from 'react-i18next';

/** Props for the email template preview modal. */
export interface TemplatePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  subject: string;
  htmlBody: string;
}

/**
 * Modal dialog that renders an email preview using an isolated iframe.
 * Uses srcDoc on the iframe to ensure style isolation from the host app.
 */
export default function TemplatePreviewModal({
  isOpen,
  onClose,
  subject,
  htmlBody,
}: TemplatePreviewModalProps) {
  const { t } = useTranslation('admin');

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="relative mx-4 flex max-h-[80vh] w-full max-w-2xl flex-col rounded-xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h3 className="text-lg font-semibold text-gray-900">{subject}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label={t('notifications.close', 'Close')}
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

        {/* Email preview iframe */}
        <div className="flex-1 overflow-hidden p-6">
          <iframe
            srcDoc={htmlBody}
            title={t('notifications.preview')}
            className="h-[60vh] w-full rounded-md border border-gray-200"
            sandbox="allow-same-origin"
          />
        </div>
      </div>
    </div>
  );
}
