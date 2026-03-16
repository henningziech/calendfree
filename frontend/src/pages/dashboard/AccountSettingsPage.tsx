import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router';
import { getMyProfile } from '../../api/admin';
import { ApiKeysTab } from './ApiKeysPage';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';

/** Account settings page with Profile and API Keys tabs */
export function AccountSettingsPage() {
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') === 'apikeys' ? 'apikeys' : 'profile';
  const [activeTab, setActiveTab] = useState<'profile' | 'apikeys'>(initialTab);

  return (
    <div>
      <h1 className="text-2xl font-bold text-[#1E293B]">Einstellungen</h1>

      <div className="mt-4 flex gap-6 border-b-2 border-[#E2E8F0]">
        <button
          onClick={() => setActiveTab('profile')}
          className={`pb-3 text-sm font-medium transition-colors ${
            activeTab === 'profile'
              ? 'border-b-2 border-[#0B8ECA] text-[#0B8ECA] -mb-[2px]'
              : 'text-[#64748B] hover:text-[#1E293B]'
          }`}
        >Profil</button>
        <button
          onClick={() => setActiveTab('apikeys')}
          className={`pb-3 text-sm font-medium transition-colors ${
            activeTab === 'apikeys'
              ? 'border-b-2 border-[#0B8ECA] text-[#0B8ECA] -mb-[2px]'
              : 'text-[#64748B] hover:text-[#1E293B]'
          }`}
        >API Keys</button>
      </div>

      <div className="mt-6">
        {activeTab === 'profile' ? <ProfileTab /> : <ApiKeysTab />}
      </div>
    </div>
  );
}

/** Profile tab — displays read-only user info sourced from Google Workspace */
function ProfileTab() {
  const [profile, setProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getMyProfile().then(setProfile).finally(() => setIsLoading(false));
  }, []);

  if (isLoading) return <LoadingSpinner />;
  if (!profile) return <p className="text-[#64748B]">Profil konnte nicht geladen werden.</p>;

  return (
    <div className="space-y-4">
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
            <label className="block text-xs font-medium text-[#64748B]">Zeitzone</label>
            <p className="text-sm text-[#1E293B]">{profile.timezone ?? 'Europe/Berlin'}</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#64748B]">Status</label>
            <p className="text-sm text-[#1E293B]">{profile.status === 'ABSENT' ? 'Abwesend' : 'Verfügbar'}</p>
          </div>
        </div>
        <p className="mt-4 text-xs text-[#94A3B8]">Profildaten werden über Google Workspace verwaltet.</p>
      </div>
    </div>
  );
}
