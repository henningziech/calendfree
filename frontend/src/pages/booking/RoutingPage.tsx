import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import { apiRequest } from '../../api/client';
import { getCompanyBranding, type BrandingConfig } from '../../api/branding';
import { BrandedLayout } from '../../components/layout/BrandedLayout';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';

interface RoutingFormData {
  title: string;
  description: string | null;
  question: string;
  collectName: boolean;
  collectEmail: boolean;
  options: Array<{ id: string; label: string }>;
}

export function RoutingPage() {
  const { companySlug, formSlug } = useParams<{ companySlug: string; formSlug: string }>();
  const navigate = useNavigate();
  const [form, setForm] = useState<RoutingFormData | null>(null);
  const [branding, setBranding] = useState<BrandingConfig | null>(null);
  const [companyName, setCompanyName] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedOptionId, setSelectedOptionId] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!companySlug || !formSlug) return;
    setIsLoading(true);
    Promise.all([
      apiRequest<RoutingFormData>(`/routing/${companySlug}/${formSlug}`),
      getCompanyBranding(companySlug),
    ])
      .then(([formData, companyInfo]) => {
        setForm(formData);
        setBranding(companyInfo.branding);
        setCompanyName(companyInfo.name);
      })
      .catch((err) => {
        if (err.status === 404) {
          setError('Dieses Formular ist nicht mehr verfügbar.');
        } else {
          setError('Formular konnte nicht geladen werden.');
        }
      })
      .finally(() => setIsLoading(false));
  }, [companySlug, formSlug]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOptionId || !companySlug || !formSlug) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const result = await apiRequest<{ type: string; value: string; prefill?: { name?: string; email?: string } }>(
        `/routing/${companySlug}/${formSlug}/resolve`,
        {
          method: 'POST',
          body: JSON.stringify({
            optionId: selectedOptionId,
            ...(name ? { name } : {}),
            ...(email ? { email } : {}),
          }),
        }
      );

      switch (result.type) {
        case 'EVENT_TYPE': {
          const params = new URLSearchParams();
          if (result.prefill?.name) params.set('name', result.prefill.name);
          if (result.prefill?.email) params.set('email', result.prefill.email);
          const qs = params.toString();
          navigate(`/${companySlug}/${result.value}${qs ? `?${qs}` : ''}`);
          break;
        }
        case 'MESSAGE':
          setMessage(result.value);
          break;
        case 'URL':
          window.location.href = result.value;
          break;
      }
    } catch (err: any) {
      setError(err.message || 'Ein Fehler ist aufgetreten.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <BrandedLayout branding={branding} companyName={companyName}>
        <LoadingSpinner />
      </BrandedLayout>
    );
  }

  if (error && !form) {
    return (
      <BrandedLayout branding={branding} companyName={companyName}>
        <div className="mx-auto max-w-md text-center py-16">
          <p className="text-lg text-[#64748B]">{error}</p>
        </div>
      </BrandedLayout>
    );
  }

  if (message) {
    return (
      <BrandedLayout branding={branding} companyName={companyName}>
        <div className="mx-auto max-w-md py-16">
          <div className="rounded-xl border border-[#E2E8F0] bg-white p-8 shadow-sm text-center">
            <div className="text-4xl mb-4">💬</div>
            <p className="text-[#1E293B] whitespace-pre-wrap">{message}</p>
          </div>
        </div>
      </BrandedLayout>
    );
  }

  return (
    <BrandedLayout branding={branding} companyName={companyName}>
      <div className="mx-auto max-w-md py-8">
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-8 shadow-sm">
          <h1 className="text-xl font-bold text-[#1E293B]">{form?.title}</h1>
          {form?.description && <p className="mt-2 text-sm text-[#64748B]">{form.description}</p>}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {form?.collectName && (
              <div>
                <label className="block text-sm font-medium text-[#1E293B]">Name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm focus:border-[#0B8ECA] focus:outline-none"
                />
              </div>
            )}

            {form?.collectEmail && (
              <div>
                <label className="block text-sm font-medium text-[#1E293B]">E-Mail</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm focus:border-[#0B8ECA] focus:outline-none"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-[#1E293B]">{form?.question}</label>
              <select
                value={selectedOptionId}
                onChange={(e) => setSelectedOptionId(e.target.value)}
                required
                className="mt-1 w-full rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm focus:border-[#0B8ECA] focus:outline-none"
              >
                <option value="">— Bitte wählen —</option>
                {form?.options.map((opt) => (
                  <option key={opt.id} value={opt.id}>{opt.label}</option>
                ))}
              </select>
            </div>

            {error && <p className="text-sm text-[#EF4444]">{error}</p>}

            <button
              type="submit"
              disabled={isSubmitting || !selectedOptionId}
              className="w-full rounded-xl bg-gradient-to-r from-[#0B8ECA] to-[#14B8A6] px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:shadow-md disabled:opacity-50"
            >
              {isSubmitting ? 'Wird verarbeitet...' : 'Weiter'}
            </button>
          </form>
        </div>
      </div>
    </BrandedLayout>
  );
}
