import { BrandedLayout } from '../../components/layout/BrandedLayout';

export function ReschedulePage() {
  return (
    <BrandedLayout>
      <div className="space-y-6 text-center">
        <h1 className="text-2xl font-bold text-gray-900">Termin verschieben</h1>
        <p className="text-gray-600">
          Wählen Sie einen neuen Termin. Ihr bestehender Termin wird automatisch storniert.
        </p>
        <p className="text-sm text-gray-400">
          Diese Funktion wird in einem zukünftigen Update verfügbar sein.
        </p>
      </div>
    </BrandedLayout>
  );
}
