import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router';
import {
  getCompanyDetail,
  updateCompanyBranding,
  uploadCompanyLogo,
  deleteCompanyLogo,
} from '../../api/admin';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ErrorMessage } from '../../components/ui/ErrorMessage';

const DEFAULTS = {
  primaryColor: '#0B8ECA',
  accentColor: '#14B8A6',
  backgroundColor: '#F8FAFC',
  textColor: '#1E293B',
};

export function CompanyBrandingPage() {
  const { companyId } = useParams<{ companyId: string }>();

  const [company, setCompany] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Branding form state
  const [primaryColor, setPrimaryColor] = useState(DEFAULTS.primaryColor);
  const [accentColor, setAccentColor] = useState(DEFAULTS.accentColor);
  const [backgroundColor, setBackgroundColor] = useState(DEFAULTS.backgroundColor);
  const [textColor, setTextColor] = useState(DEFAULTS.textColor);
  const [showPoweredBy, setShowPoweredBy] = useState(true);
  const [footerText, setFooterText] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!companyId) return;
    setIsLoading(true);
    try {
      const detail = await getCompanyDetail(companyId);
      setCompany(detail);
      const b = (detail as any).branding;
      if (b) {
        setPrimaryColor(b.primaryColor || DEFAULTS.primaryColor);
        setAccentColor(b.accentColor || DEFAULTS.accentColor);
        setBackgroundColor(b.backgroundColor || DEFAULTS.backgroundColor);
        setTextColor(b.textColor || DEFAULTS.textColor);
        setShowPoweredBy(b.showPoweredBy ?? true);
        setFooterText(b.footerText || '');
        setLogoUrl(b.logoUrl || null);
      }
    } catch (err: any) {
      setError(err.status === 404 ? 'Company nicht gefunden.' : 'Fehler beim Laden.');
    } finally {
      setIsLoading(false);
    }
  }, [companyId]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!companyId) return;
    setIsSaving(true);
    setSaveSuccess(false);
    setError(null);
    try {
      await updateCompanyBranding(companyId, {
        primaryColor,
        accentColor,
        backgroundColor,
        textColor,
        showPoweredBy,
        footerText: footerText || null,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message ?? 'Fehler beim Speichern.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogoUpload = async (file: File) => {
    if (!companyId) return;
    setIsUploadingLogo(true);
    setError(null);
    try {
      const result = await uploadCompanyLogo(companyId, file);
      setLogoUrl(result.logoUrl);
    } catch (err: any) {
      setError(err.message ?? 'Logo-Upload fehlgeschlagen.');
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleLogoDelete = async () => {
    if (!companyId) return;
    setError(null);
    try {
      await deleteCompanyLogo(companyId);
      setLogoUrl(null);
    } catch (err: any) {
      setError(err.message ?? 'Logo konnte nicht entfernt werden.');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleLogoUpload(file);
  };

  if (isLoading) return <LoadingSpinner />;
  if (error && !company) return <ErrorMessage message={error} />;
  if (!company) return null;

  return (
    <div>
      <Link to={`/admin/companies/${companyId}`} className="text-sm text-[#0B8ECA] hover:underline">
        &larr; Zurück zu {company.name}
      </Link>

      <h1 className="mt-4 text-2xl font-bold text-[#1E293B]">Branding — {company.name}</h1>

      {error && <div className="mt-4"><ErrorMessage message={error} /></div>}

      <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-5">
        {/* Left: Form */}
        <div className="lg:col-span-3 space-y-6">
          {/* Logo */}
          <div className="rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-[#1E293B] mb-4">Logo</h2>
            {logoUrl && (
              <div className="mb-4 flex items-center gap-4">
                <img src={logoUrl} alt="Logo" className="h-12 rounded" />
                <button
                  onClick={handleLogoDelete}
                  className="text-sm text-[#EF4444] hover:underline"
                >
                  Entfernen
                </button>
              </div>
            )}
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
              className="cursor-pointer rounded-xl border-2 border-dashed border-[#E2E8F0] bg-[#F8FAFC] p-8 text-center transition-colors hover:border-[#0B8ECA]/50"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleLogoUpload(file);
                  e.target.value = '';
                }}
              />
              {isUploadingLogo ? (
                <p className="text-sm text-[#64748B]">Wird hochgeladen...</p>
              ) : (
                <>
                  <p className="text-sm font-medium text-[#1E293B]">Logo hochladen</p>
                  <p className="mt-1 text-xs text-[#64748B]">PNG, JPEG, GIF oder WebP — max. 2 MB</p>
                </>
              )}
            </div>
          </div>

          {/* Colors */}
          <div className="rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-[#1E293B] mb-4">Farben</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <ColorInput label="Primary" value={primaryColor} onChange={setPrimaryColor} defaultValue={DEFAULTS.primaryColor} description="Buttons, Links, aktive Elemente" />
              <ColorInput label="Accent" value={accentColor} onChange={setAccentColor} defaultValue={DEFAULTS.accentColor} description="Sekundäre Aktionen, Gradient" />
              <ColorInput label="Hintergrund" value={backgroundColor} onChange={setBackgroundColor} defaultValue={DEFAULTS.backgroundColor} description="Seitenhintergrund" />
              <ColorInput label="Text" value={textColor} onChange={setTextColor} defaultValue={DEFAULTS.textColor} description="Haupttextfarbe" />
            </div>
          </div>

          {/* Footer */}
          <div className="rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-[#1E293B] mb-4">Footer</h2>
            <label className="flex items-center gap-3 mb-4">
              <input
                type="checkbox"
                checked={showPoweredBy}
                onChange={(e) => setShowPoweredBy(e.target.checked)}
                className="h-4 w-4 rounded border-[#E2E8F0] text-[#0B8ECA] focus:ring-[#0B8ECA]"
              />
              <span className="text-sm font-medium text-[#1E293B]">„Powered by Calendfree" anzeigen</span>
            </label>
            {!showPoweredBy && (
              <div>
                <label className="block text-sm font-medium text-[#1E293B] mb-1">Eigener Footer-Text</label>
                <textarea
                  value={footerText}
                  onChange={(e) => setFooterText(e.target.value)}
                  maxLength={200}
                  rows={2}
                  placeholder="z.B. © 2026 Ihre Firma"
                  className="w-full rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm focus:border-[#0B8ECA] focus:outline-none resize-none"
                />
                <p className="mt-1 text-xs text-[#64748B]">{footerText.length}/200 Zeichen</p>
              </div>
            )}
          </div>

          {/* Save */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="rounded-xl bg-[#0B8ECA] px-6 py-2.5 text-sm font-medium text-white disabled:opacity-50"
            >
              {isSaving ? 'Wird gespeichert...' : 'Branding speichern'}
            </button>
            {saveSuccess && (
              <span className="text-sm font-medium text-[#14B8A6]">Gespeichert!</span>
            )}
          </div>
        </div>

        {/* Right: Live Preview */}
        <div className="lg:col-span-2">
          <div className="sticky top-6">
            <h2 className="text-lg font-semibold text-[#1E293B] mb-4">Vorschau</h2>
            <div
              className="rounded-xl border border-[#E2E8F0] overflow-hidden shadow-sm"
              style={{ backgroundColor }}
            >
              <div className="p-6" style={{ color: textColor }}>
                {/* Logo preview */}
                <div className="mb-4 flex justify-center">
                  {logoUrl ? (
                    <img src={logoUrl} alt="Logo" className="h-8" />
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded bg-[#E2E8F0]" />
                      <span className="text-sm font-bold" style={{ color: textColor }}>Calendfree</span>
                    </div>
                  )}
                </div>

                {/* Mock booking card */}
                <div className="mb-3">
                  <h3 className="text-base font-bold" style={{ color: textColor }}>Erstgespräch</h3>
                  <p className="text-xs" style={{ color: textColor, opacity: 0.6 }}>30 Minuten</p>
                </div>

                {/* Mock date button */}
                <div className="mb-2 rounded-lg px-3 py-2 text-xs font-medium text-white" style={{ backgroundColor: primaryColor }}>
                  Montag, 17. März 2026
                </div>
                <div className="mb-4 rounded-lg px-3 py-2 text-xs ring-1 ring-[#E2E8F0] bg-white" style={{ color: textColor }}>
                  Dienstag, 18. März 2026
                </div>

                {/* Mock submit button */}
                <div
                  className="rounded-lg py-2 text-center text-xs font-semibold text-white"
                  style={{ backgroundImage: `linear-gradient(to right, ${primaryColor}, ${accentColor})` }}
                >
                  Termin buchen
                </div>

                {/* Footer preview */}
                {showPoweredBy ? (
                  <p className="mt-4 text-center text-[10px]" style={{ color: textColor, opacity: 0.5 }}>
                    {company.name} — Powered by <span style={{ color: primaryColor }}>Calendfree</span>
                  </p>
                ) : footerText ? (
                  <p className="mt-4 text-center text-[10px]" style={{ color: textColor, opacity: 0.5 }}>
                    {footerText}
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ColorInput({
  label,
  value,
  onChange,
  defaultValue,
  description,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  defaultValue: string;
  description: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-[#1E293B] mb-1">{label}</label>
      <p className="text-xs text-[#64748B] mb-2">{description}</p>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-12 cursor-pointer rounded border border-[#E2E8F0] p-0.5"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => {
            if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) onChange(e.target.value);
          }}
          className="w-24 rounded-lg border border-[#E2E8F0] px-2 py-1.5 text-sm font-mono focus:border-[#0B8ECA] focus:outline-none"
        />
        {value !== defaultValue && (
          <button
            onClick={() => onChange(defaultValue)}
            className="text-xs text-[#64748B] hover:text-[#1E293B] whitespace-nowrap"
          >
            Reset ({defaultValue})
          </button>
        )}
      </div>
    </div>
  );
}
