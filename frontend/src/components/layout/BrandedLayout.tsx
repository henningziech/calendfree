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
      root.style.setProperty('--color-primary', branding.primaryColor || '#2563EB');
      root.style.setProperty('--color-accent', branding.accentColor || '#7C3AED');
    }
  }, [branding]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-2xl px-4 py-8">
        {branding?.logoUrl && (
          <div className="mb-6 flex justify-center">
            <img src={branding.logoUrl} alt={companyName} className="h-10" />
          </div>
        )}
        {children}
        <footer className="mt-12 text-center text-xs text-gray-400">
          {companyName && <span>{companyName} — </span>}
          Powered by Calendfree
        </footer>
      </div>
    </div>
  );
}
