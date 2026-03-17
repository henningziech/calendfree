import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { getRoutingForms, createRoutingForm, deleteRoutingForm } from '../../api/admin';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ErrorMessage } from '../../components/ui/ErrorMessage';

export function RoutingFormsPage() {
  const { t } = useTranslation('routing');
  const [forms, setForms] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newSlug, setNewSlug] = useState('');

  const load = async () => {
    setIsLoading(true);
    try {
      setForms(await getRoutingForms());
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newSlug.trim()) return;
    try {
      await createRoutingForm({
        title: newTitle.trim(),
        slug: newSlug.trim(),
        question: t('list.defaultQuestion'),
        options: [{ label: t('list.defaultOptionLabel'), targetType: 'MESSAGE', targetValue: t('list.defaultOptionMessage'), order: 0 }],
      });
      setNewTitle('');
      setNewSlug('');
      setShowCreate(false);
      load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(t('list.confirmDelete'))) return;
    try {
      await deleteRoutingForm(id);
      load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (isLoading) return <LoadingSpinner />;

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#1E293B]">{t('list.title')}</h1>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="rounded-xl bg-gradient-to-r from-[#0B8ECA] to-[#14B8A6] px-4 py-2 text-sm font-medium text-white shadow-sm hover:shadow-md"
        >
          {t('list.create')}
        </button>
      </div>
      <p className="mt-2 text-sm text-[#64748B]">{t('list.subtitle')}</p>

      {error && <ErrorMessage message={error} />}

      {showCreate && (
        <form onSubmit={handleCreate} className="mt-4 rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-sm">
          <div className="flex gap-3">
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder={t('list.titlePlaceholder')}
              required
              className="flex-1 rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm focus:border-[#0B8ECA] focus:outline-none"
              autoFocus
            />
            <input
              value={newSlug}
              onChange={(e) => setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
              placeholder={t('list.slugPlaceholder')}
              required
              className="flex-1 rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm focus:border-[#0B8ECA] focus:outline-none"
            />
            <button type="submit" className="rounded-xl bg-[#0B8ECA] px-4 py-2 text-sm font-medium text-white">{t('list.createButton')}</button>
            <button type="button" onClick={() => setShowCreate(false)} className="rounded-xl border border-[#E2E8F0] px-4 py-2 text-sm text-[#64748B]">{t('list.cancel')}</button>
          </div>
        </form>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {forms.map((f: any) => (
          <Link
            key={f.id}
            to={`/dashboard/routing-forms/${f.id}`}
            className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-sm transition-all hover:border-[#0B8ECA]/30 hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-[#1E293B]">{f.title}</h3>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${f.active ? 'bg-[#14B8A6]/10 text-[#14B8A6]' : 'bg-[#64748B]/10 text-[#64748B]'}`}>
                {f.active ? t('list.active') : t('list.inactive')}
              </span>
            </div>
            <p className="mt-2 text-sm text-[#64748B]">
              /{f.slug} · {t('list.options_other', { count: f._count?.options ?? 0 })}
            </p>
            <button
              onClick={(e) => handleDelete(e, f.id)}
              className="mt-3 text-xs font-medium text-[#EF4444] transition-colors hover:text-red-600"
            >
              {t('list.delete')}
            </button>
          </Link>
        ))}
      </div>

      {!isLoading && forms.length === 0 && !showCreate && (
        <div className="mt-12 text-center">
          <p className="text-lg text-[#64748B]">{t('list.noForms')}</p>
          <p className="text-sm text-[#94A3B8]">{t('list.noFormsHint')}</p>
        </div>
      )}
    </div>
  );
}
