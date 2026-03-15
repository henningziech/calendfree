import { BrandedLayout } from '../../components/layout/BrandedLayout';

export function ReschedulePage() {
  return (
    <BrandedLayout>
      <div className="space-y-6 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#0B8ECA]/10">
          <svg className="h-8 w-8 text-[#0B8ECA]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-[#1E293B]">Termin verschieben</h1>
        <p className="text-[#64748B]">
          Wählen Sie einen neuen Termin. Ihr bestehender Termin wird automatisch storniert.
        </p>
        <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
          <p className="text-sm text-[#64748B]">
            Diese Funktion wird in einem zukünftigen Update verfügbar sein.
          </p>
        </div>
      </div>
    </BrandedLayout>
  );
}
