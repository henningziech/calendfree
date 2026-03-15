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
            <h1 className="text-2xl font-bold text-gray-900">Termin absagen?</h1>
            <p className="text-gray-600">Möchten Sie diesen Termin wirklich absagen?</p>
            <div className="flex justify-center gap-4">
              <button
                onClick={handleCancel}
                className="rounded-md bg-red-600 px-6 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                Ja, absagen
              </button>
              <button
                onClick={() => window.history.back()}
                className="rounded-md bg-gray-100 px-6 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
              >
                Abbrechen
              </button>
            </div>
          </>
        )}

        {status === 'loading' && <p className="text-gray-500">Wird storniert...</p>}

        {status === 'done' && (
          <>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <svg className="h-8 w-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Termin abgesagt</h1>
            <p className="text-gray-600">Ihr Termin wurde erfolgreich storniert.</p>
          </>
        )}

        {status === 'error' && <ErrorMessage message={error} onRetry={handleCancel} />}
      </div>
    </BrandedLayout>
  );
}
