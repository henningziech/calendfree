import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { getEventTypes, createEventType, toggleEventType, deleteEventType } from '../../api/admin';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { NotificationConfigPanel } from '../../components/notifications/NotificationConfigPanel';

export function EventTypesPage() {
  const { user } = useAuth();
  const { t } = useTranslation(['admin', 'common']);
  const [eventTypes, setEventTypes] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [notifEventTypeId, setNotifEventTypeId] = useState<string | null>(null);
  const [form, setForm] = useState({ title: '', slug: '', duration: 30 });

  const companyId = user?.activeCompanyId;

  const load = async () => {
    if (!companyId) { setIsLoading(false); return; }
    setIsLoading(true);
    try {
      setEventTypes(await getEventTypes(companyId));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, [companyId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    try {
      await createEventType(companyId, form);
      setShowCreate(false);
      setForm({ title: '', slug: '', duration: 30 });
      load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (isLoading) return <LoadingSpinner />;

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#1E293B]">{t('admin:eventTypes.title')}</h1>
        <button onClick={() => setShowCreate(true)} className="rounded-xl bg-[#0B8ECA] px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-[#0874A6] hover:shadow-md">
          {t('admin:eventTypes.create')}
        </button>
      </div>

      {error && <ErrorMessage message={error} />}

      {showCreate && (
        <form onSubmit={handleCreate} className="mt-4 space-y-3 rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-sm">
          <div className="flex gap-3">
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder={t('admin:eventTypes.titlePlaceholder')} required className="flex-1 rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm focus:border-[#0B8ECA] focus:ring-2 focus:ring-[#0B8ECA]/20 focus:outline-none" />
            <input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder={t('admin:eventTypes.slugPlaceholder')} required className="flex-1 rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm focus:border-[#0B8ECA] focus:ring-2 focus:ring-[#0B8ECA]/20 focus:outline-none" />
            <input type="number" value={form.duration} onChange={(e) => setForm({ ...form, duration: +e.target.value })} min={5} max={480} className="w-24 rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm focus:border-[#0B8ECA] focus:ring-2 focus:ring-[#0B8ECA]/20 focus:outline-none" />
          </div>
          <div className="flex gap-3">
            <button type="submit" className="rounded-xl bg-[#0B8ECA] px-4 py-2 text-sm font-medium text-white hover:bg-[#0874A6]">{t('admin:eventTypes.createButton')}</button>
            <button type="button" onClick={() => setShowCreate(false)} className="rounded-xl bg-[#F8FAFC] px-4 py-2 text-sm text-[#64748B] ring-1 ring-[#E2E8F0] hover:bg-[#E2E8F0]">{t('common:cancel')}</button>
          </div>
        </form>
      )}

      <div className="mt-4 space-y-2">
        {eventTypes.map((et) => (
          <div key={et.id} className="flex items-center justify-between rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-sm transition-all hover:shadow-md">
            <div className="flex items-center gap-3">
              <div className="h-3 w-3 rounded-full" style={{ backgroundColor: et.color || '#0B8ECA' }} />
              <div>
                <h3 className="font-medium text-[#1E293B]">{et.title}</h3>
                <p className="text-sm text-[#64748B]">/{et.slug} · {et.duration}min · {t('admin:eventTypes.bookings_other', { count: et._count?.bookings ?? 0 })}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setNotifEventTypeId(et.id)}
                title={t('notifications.configure')}
                className="rounded-lg p-1.5 text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#1E293B]"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-4 w-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
                </svg>
              </button>
              <button
                onClick={() => toggleEventType(et.id).then(load)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${et.active ? 'bg-emerald-100 text-emerald-700' : 'bg-[#F8FAFC] text-[#64748B]'}`}
              >
                {et.active ? t('common:active') : t('common:inactive')}
              </button>
              <button onClick={() => { if (confirm(t('admin:eventTypes.confirmDelete', { title: et.title }))) deleteEventType(et.id).then(load); }} className="text-sm font-medium text-[#EF4444] transition-colors hover:text-red-600">{t('common:delete')}</button>
            </div>
          </div>
        ))}
      </div>

      {notifEventTypeId && (
        <NotificationConfigPanel
          eventTypeId={notifEventTypeId}
          isOpen={!!notifEventTypeId}
          onClose={() => setNotifEventTypeId(null)}
        />
      )}
    </div>
  );
}
