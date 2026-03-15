export function SettingsPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-[#1E293B]">Einstellungen</h1>
      <p className="mt-2 text-[#64748B]">Branding, Custom Domain und weitere Einstellungen werden hier verwaltet.</p>
      <div className="mt-6 rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F59E0B]/10">
            <svg className="h-5 w-5 text-[#F59E0B]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-sm text-[#64748B]">Wird in einem zukünftigen Update verfügbar.</p>
        </div>
      </div>
    </div>
  );
}
