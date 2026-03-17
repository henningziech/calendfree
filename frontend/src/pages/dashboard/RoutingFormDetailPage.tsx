import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { getRoutingForm, updateRoutingForm } from '../../api/admin';
import { apiRequest } from '../../api/client';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ErrorMessage } from '../../components/ui/ErrorMessage';

interface RoutingOptionRow {
  label: string;
  targetType: 'EVENT_TYPE' | 'MESSAGE' | 'URL';
  targetValue: string;
  order: number;
}

export function RoutingFormDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { t } = useTranslation('routing');
  const [form, setForm] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Editable fields
  const [title, setTitle] = useState('');
  const [editingTitle, setEditingTitle] = useState(false);
  const [description, setDescription] = useState('');
  const [question, setQuestion] = useState('');
  const [collectName, setCollectName] = useState(false);
  const [collectEmail, setCollectEmail] = useState(false);
  const [active, setActive] = useState(true);
  const [options, setOptions] = useState<RoutingOptionRow[]>([]);
  const [fallbackType, setFallbackType] = useState<'EVENT_TYPE' | 'MESSAGE' | 'URL'>('MESSAGE');
  const [fallbackValue, setFallbackValue] = useState('');

  // Event types for dropdown
  const [eventTypes, setEventTypes] = useState<any[]>([]);

  const load = async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      const [formData, etData] = await Promise.all([
        getRoutingForm(id),
        apiRequest<any[]>(`/admin/companies/${user?.activeCompanyId}/event-types`),
      ]);
      setForm(formData);
      setTitle(formData.title);
      setDescription(formData.description || '');
      setQuestion(formData.question);
      setCollectName(formData.collectName);
      setCollectEmail(formData.collectEmail);
      setActive(formData.active);
      setFallbackType(formData.fallbackType);
      setFallbackValue(formData.fallbackValue);
      setOptions(
        formData.options.map((o: any) => ({
          label: o.label,
          targetType: o.targetType,
          targetValue: o.targetValue,
          order: o.order,
        }))
      );
      setEventTypes(etData);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await updateRoutingForm(id!, {
        title,
        description: description || null,
        question,
        collectName,
        collectEmail,
        active,
        fallbackType,
        fallbackValue,
        options: options.map((o, i) => ({ ...o, order: i })),
      });
      setSuccess(t('detail.saved'));
      setTimeout(() => setSuccess(null), 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const addOption = () => {
    setOptions([...options, { label: '', targetType: 'EVENT_TYPE', targetValue: eventTypes[0]?.slug || '', order: options.length }]);
  };

  const removeOption = (index: number) => {
    setOptions(options.filter((_, i) => i !== index));
  };

  const updateOption = (index: number, field: keyof RoutingOptionRow, value: string) => {
    const updated = [...options];
    (updated[index] as any)[field] = value;
    setOptions(updated);
  };

  const moveOption = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === options.length - 1) return;
    const updated = [...options];
    const target = direction === 'up' ? index - 1 : index + 1;
    [updated[index], updated[target]] = [updated[target], updated[index]];
    setOptions(updated);
  };

  const companySlug = form?.company?.slug;

  if (isLoading) return <LoadingSpinner />;
  if (!form) return <ErrorMessage message={t('detail.notFound')} />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link to="/dashboard/routing-forms" className="text-sm font-medium text-[#0B8ECA] hover:text-[#0874A6]">
          {t('detail.backToList')}
        </Link>
        <div className="mt-2 flex items-center gap-4">
          {editingTitle ? (
            <div className="flex items-center gap-2">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="text-2xl font-bold text-[#1E293B] border-b-2 border-[#0B8ECA] focus:outline-none"
                autoFocus
                onBlur={() => setEditingTitle(false)}
                onKeyDown={(e) => e.key === 'Enter' && setEditingTitle(false)}
              />
            </div>
          ) : (
            <h1
              className="text-2xl font-bold text-[#1E293B] cursor-pointer hover:text-[#0B8ECA] transition-colors"
              onClick={() => setEditingTitle(true)}
            >
              {title}
            </h1>
          )}
          <button
            onClick={() => { setActive(!active); }}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${active ? 'bg-[#14B8A6]/10 text-[#14B8A6]' : 'bg-[#64748B]/10 text-[#64748B]'}`}
          >
            {active ? t('detail.active') : t('detail.inactive')}
          </button>
        </div>
      </div>

      {error && <ErrorMessage message={error} />}
      {success && <div className="rounded-xl border border-[#14B8A6]/30 bg-[#14B8A6]/5 p-3 text-sm text-[#14B8A6]">{success}</div>}

      {/* Settings */}
      <div className="rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-[#1E293B]">{t('detail.settings')}</h2>
        <div className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#1E293B]">{t('detail.descriptionLabel')}</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('detail.descriptionPlaceholder')}
              rows={2}
              className="mt-1 w-full rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm focus:border-[#0B8ECA] focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#1E293B]">{t('detail.questionLabel')}</label>
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm focus:border-[#0B8ECA] focus:outline-none"
            />
          </div>
          <div className="flex gap-6">
            <label className="flex items-center gap-2 text-sm text-[#1E293B]">
              <input type="checkbox" checked={collectName} onChange={(e) => setCollectName(e.target.checked)} className="rounded" />
              {t('detail.collectName')}
            </label>
            <label className="flex items-center gap-2 text-sm text-[#1E293B]">
              <input type="checkbox" checked={collectEmail} onChange={(e) => setCollectEmail(e.target.checked)} className="rounded" />
              {t('detail.collectEmail')}
            </label>
          </div>
          <div>
            <label className="block text-sm font-medium text-[#64748B]">{t('detail.slugLabel')}</label>
            <p className="mt-1 text-sm text-[#94A3B8]">/{form.slug}</p>
          </div>
        </div>
      </div>

      {/* Option Mapping Table */}
      <div className="rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-[#1E293B]">{t('detail.options')}</h2>
        <p className="mt-1 text-sm text-[#64748B]">{t('detail.optionsHint')}</p>

        <div className="mt-4 space-y-3">
          {options.map((opt, i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3">
              {/* Reorder buttons */}
              <div className="flex flex-col gap-0.5">
                <button onClick={() => moveOption(i, 'up')} disabled={i === 0} className="text-[#64748B] hover:text-[#1E293B] disabled:opacity-30 text-xs">▲</button>
                <button onClick={() => moveOption(i, 'down')} disabled={i === options.length - 1} className="text-[#64748B] hover:text-[#1E293B] disabled:opacity-30 text-xs">▼</button>
              </div>

              {/* Label */}
              <input
                value={opt.label}
                onChange={(e) => updateOption(i, 'label', e.target.value)}
                placeholder={t('detail.optionLabelPlaceholder')}
                className="w-40 rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-sm focus:border-[#0B8ECA] focus:outline-none"
              />

              <span className="text-[#64748B]">→</span>

              {/* Target type */}
              <select
                value={opt.targetType}
                onChange={(e) => updateOption(i, 'targetType', e.target.value)}
                className="rounded-lg border border-[#E2E8F0] px-2 py-1.5 text-sm focus:border-[#0B8ECA] focus:outline-none"
              >
                <option value="EVENT_TYPE">{t('detail.targetTypeEventType')}</option>
                <option value="MESSAGE">{t('detail.targetTypeMessage')}</option>
                <option value="URL">{t('detail.targetTypeUrl')}</option>
              </select>

              {/* Target value */}
              {opt.targetType === 'EVENT_TYPE' ? (
                <select
                  value={opt.targetValue}
                  onChange={(e) => updateOption(i, 'targetValue', e.target.value)}
                  className="flex-1 rounded-lg border border-[#E2E8F0] px-2 py-1.5 text-sm focus:border-[#0B8ECA] focus:outline-none"
                >
                  <option value="">{t('detail.selectEventType')}</option>
                  {eventTypes.map((et: any) => (
                    <option key={et.id} value={et.slug}>{et.title} ({et.duration} Min)</option>
                  ))}
                </select>
              ) : (
                <input
                  value={opt.targetValue}
                  onChange={(e) => updateOption(i, 'targetValue', e.target.value)}
                  placeholder={opt.targetType === 'URL' ? 'https://...' : t('detail.messagePlaceholder')}
                  className="flex-1 rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-sm focus:border-[#0B8ECA] focus:outline-none"
                />
              )}

              {/* Delete */}
              <button onClick={() => removeOption(i)} className="text-[#EF4444] hover:text-red-600 text-sm font-medium">✕</button>
            </div>
          ))}
        </div>

        <button
          onClick={addOption}
          className="mt-3 rounded-xl border border-dashed border-[#CBD5E1] px-4 py-2 text-sm text-[#64748B] transition-colors hover:border-[#0B8ECA] hover:text-[#0B8ECA]"
        >
          {t('detail.addOption')}
        </button>
      </div>

      {/* Fallback */}
      <div className="rounded-xl border border-[#F59E0B]/30 bg-[#FFFBEB] p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-[#92400E]">{t('detail.fallback')}</h2>
        <p className="mt-1 text-sm text-[#A16207]">{t('detail.fallbackHint')}</p>
        <div className="mt-4 flex items-center gap-3">
          <select
            value={fallbackType}
            onChange={(e) => setFallbackType(e.target.value as any)}
            className="rounded-lg border border-[#E2E8F0] px-2 py-1.5 text-sm focus:border-[#0B8ECA] focus:outline-none"
          >
            <option value="EVENT_TYPE">{t('detail.targetTypeEventType')}</option>
            <option value="MESSAGE">{t('detail.targetTypeMessage')}</option>
            <option value="URL">{t('detail.targetTypeUrl')}</option>
          </select>
          {fallbackType === 'EVENT_TYPE' ? (
            <select
              value={fallbackValue}
              onChange={(e) => setFallbackValue(e.target.value)}
              className="flex-1 rounded-lg border border-[#E2E8F0] px-2 py-1.5 text-sm focus:border-[#0B8ECA] focus:outline-none"
            >
              <option value="">{t('detail.selectEventType')}</option>
              {eventTypes.map((et: any) => (
                <option key={et.id} value={et.slug}>{et.title} ({et.duration} Min)</option>
              ))}
            </select>
          ) : (
            <input
              value={fallbackValue}
              onChange={(e) => setFallbackValue(e.target.value)}
              placeholder={fallbackType === 'URL' ? 'https://...' : t('detail.messagePlaceholder')}
              className="flex-1 rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-sm focus:border-[#0B8ECA] focus:outline-none"
            />
          )}
        </div>
      </div>

      {/* Preview Link */}
      {form.slug && (
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-sm">
          <label className="block text-sm font-medium text-[#64748B]">{t('detail.previewLink')}</label>
          <a
            href={`/${companySlug || ''}/routing/${form.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 text-sm text-[#0B8ECA] underline hover:text-[#0874A6]"
          >
            /{companySlug || '...'}/routing/{form.slug}
          </a>
        </div>
      )}

      {/* Save */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="rounded-xl bg-gradient-to-r from-[#0B8ECA] to-[#14B8A6] px-6 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:shadow-md disabled:opacity-50"
        >
          {isSaving ? t('detail.saving') : t('detail.save')}
        </button>
      </div>
    </div>
  );
}
