import { useState } from 'react';
import { useParams } from 'react-router';
import { cancelBooking } from '../../api/booking';
import { BrandedLayout } from '../../components/layout/BrandedLayout';
import { ErrorMessage } from '../../components/ui/ErrorMessage';

export function CancelPage() {
  const { token } = useParams<{ token: string }>();
  const [status, setStatus] = useState<'confirm' | 'loading' | 'done' | 'error'>('confirm');
  const [error, setError] = useState('');

  const handleCancel = async () => {
    if (!token) return;
    setStatus('loading');
    try {
      await cancelBooking(token);
      setStatus('done');
    } catch (err: any) {
      setError(err.message || 'Stornierung fehlgeschlagen.');
      setStatus('error');
    }
  };

  return (
    <BrandedLayout>
      <div className="space-y-6 text-center">
        {status === 'confirm' && (
          <>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#F59E0B]/10">
              <svg className="h-8 w-8 text-[#F59E0B]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-[#1E293B]">Termin absagen?</h1>
            <p className="text-[#64748B]">Möchten Sie diesen Termin wirklich absagen?</p>
            <div className="flex justify-center gap-3">
              <button
                onClick={handleCancel}
                className="rounded-xl bg-[#EF4444] px-6 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-red-600 hover:shadow-md"
              >
                Ja, absagen
              </button>
              <button
                onClick={() => window.history.back()}
                className="rounded-xl bg-[#F8FAFC] px-6 py-2.5 text-sm font-medium text-[#64748B] ring-1 ring-[#E2E8F0] transition-all hover:bg-[#E2E8F0] hover:text-[#1E293B]"
              >
                Abbrechen
              </button>
            </div>
          </>
        )}

        {status === 'loading' && <p className="text-[#64748B]">Wird storniert...</p>}

        {status === 'done' && (
          <>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#14B8A6]/10">
              <svg className="h-8 w-8 text-[#14B8A6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-[#1E293B]">Termin abgesagt</h1>
            <p className="text-[#64748B]">Ihr Termin wurde erfolgreich storniert.</p>
          </>
        )}

        {status === 'error' && <ErrorMessage message={error} onRetry={handleCancel} />}
      </div>
    </BrandedLayout>
  );
}
