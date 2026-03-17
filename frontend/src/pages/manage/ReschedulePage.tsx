import { useState, useEffect } from 'react';
import { useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { getBookingByToken, type BrandingConfig } from '../../api/branding';
import { BrandedLayout } from '../../components/layout/BrandedLayout';

export function ReschedulePage() {
  const { token } = useParams<{ token: string }>();
  const { t, i18n } = useTranslation('booking');
  const [branding, setBranding] = useState<BrandingConfig | null>(null);
  const [companyName, setCompanyName] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!token) { setIsLoading(false); return; }
    getBookingByToken(token)
      .then((info) => {
        setBranding(info.branding);
        setCompanyName(info.company?.name);
        if (info.company?.language) {
          i18n.changeLanguage(info.company.language);
        }
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [token, i18n]);

  if (isLoading) {
    return (
      <BrandedLayout>
        <div className="text-center py-12">
          <p className="text-[#64748B]">{t('reschedule.loading')}</p>
        </div>
      </BrandedLayout>
    );
  }

  return (
    <BrandedLayout branding={branding} companyName={companyName}>
      <div className="space-y-6 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full" style={{ backgroundColor: 'rgba(var(--color-primary-rgb, 11, 142, 202), 0.1)' }}>
          <svg className="h-8 w-8" style={{ color: 'var(--color-primary, #0B8ECA)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text, #1E293B)' }}>{t('reschedule.title')}</h1>
        <p className="text-[#64748B]">
          {t('reschedule.subtitle')}
        </p>
        <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
          <p className="text-sm text-[#64748B]">
            {t('reschedule.comingSoon')}
          </p>
        </div>
      </div>
    </BrandedLayout>
  );
}
