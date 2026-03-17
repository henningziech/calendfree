import { type ReactNode, useEffect } from 'react';
import type { BrandingConfig } from '../../api/branding';

/** Convert hex color to "r, g, b" string for use in rgba(). */
function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r}, ${g}, ${b}`;
}

const DEFAULTS = {
  primaryColor: '#0B8ECA',
  accentColor: '#14B8A6',
  backgroundColor: '#F8FAFC',
  textColor: '#1E293B',
};

export function BrandedLayout({
  children,
  branding,
  companyName,
}: {
  children: ReactNode;
  branding?: BrandingConfig | null;
  companyName?: string;
}) {
  const primary = branding?.primaryColor || DEFAULTS.primaryColor;
  const accent = branding?.accentColor || DEFAULTS.accentColor;
  const bg = branding?.backgroundColor || DEFAULTS.backgroundColor;
  const text = branding?.textColor || DEFAULTS.textColor;

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--color-primary', primary);
    root.style.setProperty('--color-accent', accent);
    root.style.setProperty('--color-bg', bg);
    root.style.setProperty('--color-text', text);
    root.style.setProperty('--color-primary-rgb', hexToRgb(primary));
    root.style.setProperty('--color-accent-rgb', hexToRgb(accent));
    root.style.setProperty('--color-bg-rgb', hexToRgb(bg));
    root.style.setProperty('--color-text-rgb', hexToRgb(text));

    return () => {
      root.style.removeProperty('--color-primary');
      root.style.removeProperty('--color-accent');
      root.style.removeProperty('--color-bg');
      root.style.removeProperty('--color-text');
      root.style.removeProperty('--color-primary-rgb');
      root.style.removeProperty('--color-accent-rgb');
      root.style.removeProperty('--color-bg-rgb');
      root.style.removeProperty('--color-text-rgb');
    };
  }, [primary, accent, bg, text]);

  const showPoweredBy = branding?.showPoweredBy ?? true;
  const footerText = branding?.footerText;

  return (
    <div className="min-h-screen" style={{ backgroundColor: bg, color: text }}>
      <div className="mx-auto max-w-2xl px-4 py-8">
        {branding?.logoUrl ? (
          <div className="mb-6 flex justify-center">
            <img src={branding.logoUrl} alt={companyName} className="h-20" />
          </div>
        ) : (
          <div className="mb-6 flex items-center justify-center gap-2.5">
            <img src="/logo-mini.png" alt="Calendfree" className="h-8 w-8 rounded-lg" />
            <span className="text-lg font-bold" style={{ color: text }}>Calendfree</span>
          </div>
        )}
        {children}
        {footerText ? (
          <footer className="mt-12 text-center text-xs text-[#64748B]">
            {footerText}
          </footer>
        ) : showPoweredBy ? (
          <footer className="mt-12 text-center text-xs text-[#64748B]">
            {companyName && <span>{companyName} — </span>}
            Powered by <span className="font-medium" style={{ color: primary }}>Calendfree</span>
          </footer>
        ) : null}
      </div>
    </div>
  );
}
