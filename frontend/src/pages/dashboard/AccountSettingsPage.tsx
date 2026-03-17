import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { getMyProfile, updateMyStatus, getMyVacations, createVacation, deleteVacation } from '../../api/admin';
import { ApiKeysTab } from './ApiKeysPage';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { formatDateLocalized } from '../../utils/dateLocale';

/** Account settings page with Profile and API Keys tabs */
export function AccountSettingsPage() {
  const { t } = useTranslation('dashboard');
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') === 'apikeys' ? 'apikeys' : 'profile';
  const [activeTab, setActiveTab] = useState<'profile' | 'apikeys'>(initialTab);

  return (
    <div>
      <h1 className="text-2xl font-bold text-[#1E293B]">{t('settings.title')}</h1>

      <div className="mt-4 flex gap-6 border-b-2 border-[#E2E8F0]">
        <button
          onClick={() => setActiveTab('profile')}
          className={`pb-3 text-sm font-medium transition-colors ${
            activeTab === 'profile'
              ? 'border-b-2 border-[#0B8ECA] text-[#0B8ECA] -mb-[2px]'
              : 'text-[#64748B] hover:text-[#1E293B]'
          }`}
        >{t('settings.tabProfile')}</button>
        <button
          onClick={() => setActiveTab('apikeys')}
          className={`pb-3 text-sm font-medium transition-colors ${
            activeTab === 'apikeys'
              ? 'border-b-2 border-[#0B8ECA] text-[#0B8ECA] -mb-[2px]'
              : 'text-[#64748B] hover:text-[#1E293B]'
          }`}
        >{t('settings.tabApiKeys')}</button>
      </div>

      <div className="mt-6">
        {activeTab === 'profile' ? <ProfileTab /> : <ApiKeysTab />}
      </div>
    </div>
  );
}

/** Profile tab with status toggle and vacation management */
function ProfileTab() {
  const { t } = useTranslation(['dashboard', 'common']);
  const [profile, setProfile] = useState<any>(null);
  const [vacations, setVacations] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [addingVacation, setAddingVacation] = useState(false);
  const [newVacStart, setNewVacStart] = useState('');
  const [newVacEnd, setNewVacEnd] = useState('');
  const [newVacLabel, setNewVacLabel] = useState('');
  const [absentUntil, setAbsentUntil] = useState('');

  const todayStr = new Date().toISOString().split('T')[0];

  const load = async () => {
    setIsLoading(true);
    try {
      const [p, v] = await Promise.all([getMyProfile(), getMyVacations()]);
      setProfile(p);
      setVacations(v);
      setAbsentUntil(p.absentUntil ? new Date(p.absentUntil).toISOString().split('T')[0] : '');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleStatusChange = async (newStatus: 'AVAILABLE' | 'ABSENT') => {
    await updateMyStatus(newStatus, newStatus === 'ABSENT' && absentUntil ? new Date(absentUntil).toISOString() : null);
    setProfile((p: any) => ({ ...p, status: newStatus, absentUntil: newStatus === 'AVAILABLE' ? null : p.absentUntil }));
  };

  const handleAbsentUntilChange = async (dateStr: string) => {
    setAbsentUntil(dateStr);
    if (profile.status === 'ABSENT') {
      await updateMyStatus('ABSENT', dateStr ? new Date(dateStr).toISOString() : null);
    }
  };

  const handleAddVacation = async () => {
    if (!newVacStart || !newVacEnd) return;
    await createVacation({ startDate: newVacStart, endDate: newVacEnd, label: newVacLabel || null });
    setAddingVacation(false);
    setNewVacStart('');
    setNewVacEnd('');
    setNewVacLabel('');
    const v = await getMyVacations();
    setVacations(v);
  };

  const handleDeleteVacation = async (id: string) => {
    await deleteVacation(id);
    setVacations((prev) => prev.filter((v) => v.id !== id));
  };

  if (isLoading) return <LoadingSpinner />;
  if (!profile) return <p className="text-[#64748B]">{t('dashboard:settings.profileError')}</p>;

  const sortedVacations = [...vacations].sort((a, b) => a.startDate.localeCompare(b.startDate));

  return (
    <div className="space-y-4">
      {/* Profile info */}
      <div className="rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
        <div className="flex items-center gap-4">
          {profile.avatarUrl ? (
            <img src={profile.avatarUrl} alt="" className="h-16 w-16 rounded-full ring-2 ring-[#E2E8F0]" />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#0B8ECA] text-xl font-semibold text-white">
              {profile.name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
            </div>
          )}
          <div>
            <h2 className="text-lg font-semibold text-[#1E293B]">{profile.name}</h2>
            <p className="text-sm text-[#64748B]">{profile.email}</p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-[#64748B]">{t('dashboard:settings.timezone')}</label>
            <p className="text-sm text-[#1E293B]">{profile.timezone ?? 'Europe/Berlin'}</p>
          </div>
        </div>
      </div>

      {/* Status */}
      <div className="rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
        <h3 className="text-base font-semibold text-[#1E293B]">{t('dashboard:settings.status')}</h3>
        <div className="mt-3 flex items-center gap-3">
          <button
            onClick={() => handleStatusChange('AVAILABLE')}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
              profile.status !== 'ABSENT'
                ? 'bg-[#14B8A6]/10 text-[#14B8A6]'
                : 'border border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFC]'
            }`}
          >
            {t('common:available')}
          </button>
          <button
            onClick={() => handleStatusChange('ABSENT')}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
              profile.status === 'ABSENT'
                ? 'bg-[#EF4444]/10 text-[#EF4444]'
                : 'border border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFC]'
            }`}
          >
            {t('common:absent')}
          </button>
        </div>
        {profile.status === 'ABSENT' && (
          <div className="mt-3 flex items-center gap-2">
            <label className="text-sm text-[#64748B]">{t('dashboard:settings.absentUntil')}</label>
            <input
              type="date"
              value={absentUntil}
              min={todayStr}
              onChange={(e) => handleAbsentUntilChange(e.target.value)}
              className="rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm focus:border-[#0B8ECA] focus:outline-none"
            />
          </div>
        )}
      </div>

      {/* Vacations */}
      <div className="rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-[#1E293B]">{t('dashboard:settings.vacations')}</h3>
            <p className="mt-0.5 text-xs text-[#94A3B8]">{t('dashboard:settings.vacationsHint')}</p>
          </div>
          {!addingVacation && (
            <button
              onClick={() => setAddingVacation(true)}
              className="rounded-xl bg-[#0B8ECA] px-3 py-1.5 text-sm font-medium text-white"
            >
              {t('dashboard:settings.addVacation')}
            </button>
          )}
        </div>

        {addingVacation && (
          <div className="mt-4 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-xs font-medium text-[#64748B]">{t('dashboard:settings.from')}</label>
                <input
                  type="date"
                  value={newVacStart}
                  min={todayStr}
                  onChange={(e) => setNewVacStart(e.target.value)}
                  className="mt-1 rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm focus:border-[#0B8ECA] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#64748B]">{t('dashboard:settings.to')}</label>
                <input
                  type="date"
                  value={newVacEnd}
                  min={newVacStart || todayStr}
                  onChange={(e) => setNewVacEnd(e.target.value)}
                  className="mt-1 rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm focus:border-[#0B8ECA] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#64748B]">{t('dashboard:settings.label')}</label>
                <input
                  type="text"
                  value={newVacLabel}
                  onChange={(e) => setNewVacLabel(e.target.value)}
                  placeholder={t('dashboard:settings.labelPlaceholder')}
                  className="mt-1 rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm focus:border-[#0B8ECA] focus:outline-none"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleAddVacation}
                  className="rounded-xl bg-[#0B8ECA] px-3 py-1.5 text-sm font-medium text-white"
                >
                  {t('common:add')}
                </button>
                <button
                  onClick={() => { setAddingVacation(false); setNewVacStart(''); setNewVacEnd(''); setNewVacLabel(''); }}
                  className="rounded-xl border border-[#E2E8F0] px-3 py-1.5 text-sm text-[#64748B]"
                >
                  {t('common:cancel')}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="mt-4">
          {sortedVacations.length === 0 ? (
            <p className="text-sm text-[#94A3B8]">{t('dashboard:settings.noVacations')}</p>
          ) : (
            <ul className="divide-y divide-[#E2E8F0]">
              {sortedVacations.map((vac) => (
                <li key={vac.id} className="flex items-center justify-between py-3">
                  <div>
                    <span className="text-sm text-[#1E293B]">
                      {formatDateLocalized(vac.startDate)} – {formatDateLocalized(vac.endDate)}
                    </span>
                    {vac.label && (
                      <span className="ml-2 text-sm text-[#64748B]">({vac.label})</span>
                    )}
                  </div>
                  <button
                    onClick={() => handleDeleteVacation(vac.id)}
                    className="text-sm text-[#EF4444] hover:underline"
                  >
                    {t('common:delete')}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
