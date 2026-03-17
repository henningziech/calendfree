import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';

export function AdminDashboard() {
  const { user } = useAuth();
  const { t } = useTranslation('admin');

  return (
    <div>
      <h1 className="text-2xl font-bold text-[#1E293B]">{t('dashboard.title')}</h1>
      <p className="mt-2 text-[#64748B]">
        {t('dashboard.welcome', { name: user?.name, role: user?.activeRole?.replace('_', ' ') })}
      </p>
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { label: t('dashboard.companies'), href: '/admin/companies', desc: t('dashboard.companiesDesc'), accent: '#0B8ECA' },
          { label: t('dashboard.teams'), href: '/admin/teams', desc: t('dashboard.teamsDesc'), accent: '#14B8A6' },
          { label: t('dashboard.eventTypes'), href: '/admin/event-types', desc: t('dashboard.eventTypesDesc'), accent: '#F59E0B' },
        ].map((card) => (
          <a
            key={card.href}
            href={card.href}
            className="group rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-sm transition-all duration-200 hover:shadow-md hover:border-[#0B8ECA]/30"
          >
            <div className="mb-3 h-1 w-10 rounded-full" style={{ backgroundColor: card.accent }} />
            <h3 className="font-semibold text-[#1E293B]">{card.label}</h3>
            <p className="mt-1 text-sm text-[#64748B]">{card.desc}</p>
          </a>
        ))}
      </div>
    </div>
  );
}
