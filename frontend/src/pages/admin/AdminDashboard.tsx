import { useAuth } from '../../context/AuthContext';

export function AdminDashboard() {
  const { user } = useAuth();

  return (
    <div>
      <h1 className="text-2xl font-bold text-[#1E293B]">Dashboard</h1>
      <p className="mt-2 text-[#64748B]">
        Willkommen, {user?.name}. Rolle: {user?.activeRole?.replace('_', ' ')}.
      </p>
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { label: 'Companies', href: '/admin/companies', desc: 'Firmen verwalten', accent: '#0B8ECA' },
          { label: 'Teams', href: '/admin/teams', desc: 'Teams & Round-Robin', accent: '#14B8A6' },
          { label: 'Event Types', href: '/admin/event-types', desc: 'Terminarten verwalten', accent: '#F59E0B' },
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
