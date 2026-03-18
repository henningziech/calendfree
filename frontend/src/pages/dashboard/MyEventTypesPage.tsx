import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { getEventTypes, toggleEventType, deleteEventType, getCompanies } from '../../api/admin';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ErrorMessage } from '../../components/ui/ErrorMessage';

export function MyEventTypesPage() {
  const { t } = useTranslation(['dashboard', 'common']);
  const { user } = useAuth();
  const navigate = useNavigate();
  const [eventTypes, setEventTypes] = useState<any[]>([]);
  const [companySlug, setCompanySlug] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const companyId = user?.activeCompanyId;

  const load = async () => {
    if (!companyId) { setIsLoading(false); return; }
    setIsLoading(true);
    try {
      const [et, companies] = await Promise.all([
        getEventTypes(companyId),
        getCompanies(),
      ]);
      setEventTypes(et);
      const company = companies.find((c: any) => c.id === companyId);
      if (company) setCompanySlug(company.slug);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, [companyId]);

  const getBookingUrl = (slug: string) => {
    const base = window.location.origin;
    return `${base}/${companySlug}/${slug}`;
  };

  const copyLink = (id: string, slug: string) => {
    navigator.clipboard.writeText(getBookingUrl(slug));
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (isLoading) return <LoadingSpinner />;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1E293B]">{t('dashboard:eventTypes.title')}</h1>
          <p className="mt-1 text-sm text-[#64748B]">{t('dashboard:eventTypes.subtitle')}</p>
        </div>
        <button onClick={() => navigate('/dashboard/my-event-types/new')} className="rounded-xl bg-[#0B8ECA] px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-[#0874A6] hover:shadow-md">
          {t('dashboard:eventTypes.newEventType')}
        </button>
      </div>

      {error && <ErrorMessage message={error} />}

      {/* Event type cards */}
      <div className="mt-6 space-y-4">
        {eventTypes.map((et: any) => (
          <div key={et.id} className="rounded-xl border border-[#E2E8F0] bg-white shadow-sm overflow-hidden transition-all hover:shadow-md">
            {/* Gradient top bar */}
            <div className="h-1.5 bg-gradient-to-r" style={{ backgroundImage: `linear-gradient(to right, ${et.color || '#0B8ECA'}, ${et.color || '#0B8ECA'}80)` }} />

            <div className="p-5">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold text-[#1E293B]">{et.title}</h3>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${et.active ? 'bg-emerald-100 text-emerald-700' : 'bg-[#F8FAFC] text-[#64748B]'}`}>
                      {et.active ? t('common:active') : t('common:inactive')}
                    </span>
                  </div>
                  {et.description && <p className="mt-1 text-sm text-[#64748B]">{et.description}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => navigate(`/dashboard/my-event-types/${et.id}`)}
                    className="rounded-xl bg-[#F8FAFC] px-3 py-1.5 text-xs font-medium text-[#1E293B] ring-1 ring-[#E2E8F0] transition-colors hover:bg-[#E2E8F0]"
                  >
                    {t('common:edit')}
                  </button>
                  <button
                    onClick={() => toggleEventType(et.id).then(load)}
                    className="rounded-xl bg-[#F8FAFC] px-3 py-1.5 text-xs font-medium text-[#1E293B] ring-1 ring-[#E2E8F0] transition-colors hover:bg-[#E2E8F0]"
                  >
                    {et.active ? t('dashboard:eventTypes.deactivate') : t('dashboard:eventTypes.activate')}
                  </button>
                  <button onClick={() => { if (confirm(t('dashboard:eventTypes.confirmDelete', { title: et.title }))) deleteEventType(et.id).then(load); }} className="rounded-xl bg-red-50 px-3 py-1.5 text-xs font-medium text-[#EF4444] ring-1 ring-red-200 transition-colors hover:bg-red-100">
                    {t('common:delete')}
                  </button>
                </div>
              </div>

              {/* Booking link */}
              <div className="mt-4 flex items-center gap-2 rounded-xl bg-[#F8FAFC] px-3 py-2 ring-1 ring-[#E2E8F0]">
                <span className="text-xs text-[#64748B]">{t('dashboard:eventTypes.bookingLink')}</span>
                <code className="flex-1 text-sm text-[#0B8ECA] truncate">{getBookingUrl(et.slug)}</code>
                <button
                  onClick={() => copyLink(et.id, et.slug)}
                  className="rounded-lg bg-white px-2.5 py-1 text-xs font-medium text-[#1E293B] ring-1 ring-[#E2E8F0] transition-colors hover:bg-[#E2E8F0]"
                >
                  {copiedId === et.id ? t('dashboard:eventTypes.copied') : t('dashboard:eventTypes.copy')}
                </button>
                <a
                  href={getBookingUrl(et.slug)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg bg-[#0B8ECA] px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-[#0874A6]"
                >
                  {t('dashboard:eventTypes.open')}
                </a>
              </div>

              {/* Settings grid */}
              <div className="mt-4 grid grid-cols-2 gap-x-8 gap-y-2 text-sm sm:grid-cols-4">
                <div>
                  <span className="text-[#64748B]">{t('dashboard:eventTypes.duration')}</span>
                  <p className="font-medium text-[#1E293B]">{et.duration} {t('dashboard:eventTypes.minutes')}</p>
                </div>
                <div>
                  <span className="text-[#64748B]">{t('dashboard:eventTypes.bufferBefore').split(' ')[0]}</span>
                  <p className="font-medium text-[#1E293B]">
                    {et.bufferBefore > 0 || et.bufferAfter > 0
                      ? t('dashboard:eventTypes.bufferDisplay', { before: et.bufferBefore, after: et.bufferAfter })
                      : t('dashboard:eventTypes.noBuffer')}
                  </p>
                </div>
                <div>
                  <span className="text-[#64748B]">{t('dashboard:eventTypes.leadTime')}</span>
                  <p className="font-medium text-[#1E293B]">{t('dashboard:eventTypes.minNoticeDisplay', { hours: et.minNotice })}</p>
                </div>
                <div>
                  <span className="text-[#64748B]">{t('dashboard:eventTypes.bookableUntil')}</span>
                  <p className="font-medium text-[#1E293B]">{t('dashboard:eventTypes.daysDisplay', { days: et.maxAdvance })}</p>
                </div>
                <div>
                  <span className="text-[#64748B]">{t('dashboard:eventTypes.assignment')}</span>
                  <p className="font-medium text-[#1E293B]">{et.team ? t('dashboard:eventTypes.teamAssignment', { name: et.team.name, mode: et.roundRobinMode?.replace('_', ' ') }) : t('dashboard:eventTypes.personal')}</p>
                </div>
                <div>
                  <span className="text-[#64748B]">{t('dashboard:eventTypes.meetLink')}</span>
                  <p className="font-medium text-[#1E293B]">{et.autoMeetLink ? t('dashboard:eventTypes.automatic') : t('dashboard:eventTypes.off')}</p>
                </div>
                <div>
                  <span className="text-[#64748B]">{t('dashboard:eventTypes.bookableHours')}</span>
                  <p className="font-medium text-[#1E293B]">{et.bookableHours ? t('dashboard:eventTypes.customHours') : t('dashboard:eventTypes.defaultHoursShort')}</p>
                </div>
                <div>
                  <span className="text-[#64748B]">{t('dashboard:eventTypes.bookingsCount')}</span>
                  <p className="font-medium text-[#1E293B]">{et._count?.bookings ?? 0}</p>
                </div>
              </div>
            </div>
          </div>
        ))}
        {eventTypes.length === 0 && (
          <div className="rounded-xl border-2 border-dashed border-[#E2E8F0] bg-[#F8FAFC] p-12 text-center">
            <div className="text-4xl mb-3">📅</div>
            <h3 className="text-lg font-medium text-[#1E293B]">{t('dashboard:eventTypes.noEventTypes')}</h3>
            <p className="mt-1 text-sm text-[#64748B]">{t('dashboard:eventTypes.noEventTypesHint')}</p>
            <button onClick={() => navigate('/dashboard/my-event-types/new')} className="mt-4 rounded-xl bg-[#0B8ECA] px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-[#0874A6] hover:shadow-md">
              {t('dashboard:eventTypes.createFirst')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
