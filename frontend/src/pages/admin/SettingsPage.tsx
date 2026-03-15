import { HelpTooltip } from '../../components/ui/HelpTooltip';

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

      {/* Personio Sync */}
      <div className="mt-4 rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-sm opacity-60">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#8B5CF6]/10">
              <svg className="h-5 w-5 text-[#8B5CF6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-1">
                <p className="text-sm font-medium text-[#1E293B]">Personio Abwesenheitssync</p>
                <HelpTooltip text="Automatischer Abgleich mit Personio-Abwesenheiten. Geplantes Feature." />
              </div>
              <p className="text-xs text-[#64748B]">Automatischer Abgleich mit Personio-Abwesenheiten</p>
            </div>
          </div>
          <span className="rounded-full bg-[#F8FAFC] px-3 py-1 text-xs font-medium text-[#64748B] ring-1 ring-[#E2E8F0]">
            Geplant
          </span>
        </div>
      </div>
    </div>
  );
}
