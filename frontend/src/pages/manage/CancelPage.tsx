import { useState, useEffect } from 'react';
import { useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { cancelBooking } from '../../api/booking';
import { getBookingByToken, type BrandingConfig } from '../../api/branding';
import { BrandedLayout } from '../../components/layout/BrandedLayout';
import { ErrorMessage } from '../../components/ui/ErrorMessage';

export function CancelPage() {
  const { token } = useParams<{ token: string }>();
  const { t, i18n } = useTranslation('booking');
  const [status, setStatus] = useState<'loading' | 'confirm' | 'cancelling' | 'done' | 'error'>('loading');
  const [error, setError] = useState('');
  const [branding, setBranding] = useState<BrandingConfig | null>(null);
  const [companyName, setCompanyName] = useState<string | undefined>();

  useEffect(() => {
    if (!token) return;
    getBookingByToken(token)
      .then((info) => {
        setBranding(info.branding);
        setCompanyName(info.company?.name);
        if (info.company?.language) {
          i18n.changeLanguage(info.company.language);
        }
        setStatus('confirm');
      })
      .catch(() => {
        setStatus('confirm');
      });
  }, [token, i18n]);

  const handleCancel = async () => {
    if (!token) return;
    setStatus('cancelling');
    try {
      await cancelBooking(token);
      setStatus('done');
    } catch (err: any) {
      setError(err.message || t('cancel.failedMessage'));
      setStatus('error');
    }
  };

  if (status === 'loading') {
    return (
      <BrandedLayout>
        <div className="text-center py-12">
          <p className="text-[#64748B]">{t('cancel.loading')}</p>
        </div>
      </BrandedLayout>
    );
  }

  return (
    <BrandedLayout branding={branding} companyName={companyName}>
      <div className="space-y-6 text-center">
        {status === 'confirm' && (
          <>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#F59E0B]/10">
              <svg className="h-8 w-8 text-[#F59E0B]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text, #1E293B)' }}>{t('cancel.title')}</h1>
            <p className="text-[#64748B]">{t('cancel.confirm')}</p>
            <div className="flex justify-center gap-3">
              <button
                onClick={handleCancel}
                className="rounded-xl bg-[#EF4444] px-6 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-red-600 hover:shadow-md"
              >
                {t('cancel.confirmButton')}
              </button>
              <button
                onClick={() => window.history.back()}
                className="rounded-xl bg-[#F8FAFC] px-6 py-2.5 text-sm font-medium text-[#64748B] ring-1 ring-[#E2E8F0] transition-all hover:bg-[#E2E8F0]"
              >
                {t('cancel.cancelButton')}
              </button>
            </div>
          </>
        )}

        {status === 'cancelling' && <p className="text-[#64748B]">{t('cancel.cancelling')}</p>}

        {status === 'done' && (
          <>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full" style={{ backgroundColor: 'rgba(var(--color-accent-rgb, 20, 184, 166), 0.1)' }}>
              <svg className="h-8 w-8" style={{ color: 'var(--color-accent, #14B8A6)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text, #1E293B)' }}>{t('cancel.doneTitle')}</h1>
            <p className="text-[#64748B]">{t('cancel.doneMessage')}</p>
          </>
        )}

        {status === 'error' && <ErrorMessage message={error} onRetry={handleCancel} />}
      </div>
    </BrandedLayout>
  );
}
