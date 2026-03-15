import { type ReactNode, useEffect } from 'react';
import type { BrandingConfig } from '../../api/branding';

export function BrandedLayout({
  children,
  branding,
  companyName,
}: {
  children: ReactNode;
  branding?: BrandingConfig | null;
  companyName?: string;
}) {
  useEffect(() => {
    if (branding) {
      const root = document.documentElement;
      root.style.setProperty('--color-primary', branding.primaryColor || '#0B8ECA');
      root.style.setProperty('--color-accent', branding.accentColor || '#14B8A6');
    }
  }, [branding]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F8FAFC] via-white to-[#F8FAFC]">
      <div className="mx-auto max-w-2xl px-4 py-8">
        {branding?.logoUrl ? (
          <div className="mb-6 flex justify-center">
            <img src={branding.logoUrl} alt={companyName} className="h-10" />
          </div>
        ) : (
          <div className="mb-6 flex items-center justify-center gap-2.5">
            <img src="/logo.jpg" alt="Calendfree" className="h-8 w-8 rounded-lg" />
            <span className="text-lg font-bold text-[#1E293B]">Calendfree</span>
          </div>
        )}
        {children}
        <footer className="mt-12 text-center text-xs text-[#64748B]">
          {companyName && <span>{companyName} — </span>}
          Powered by <span className="font-medium text-[#0B8ECA]">Calendfree</span>
        </footer>
      </div>
    </div>
  );
}
