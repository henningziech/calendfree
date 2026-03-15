import { useAuth } from '../../context/AuthContext';

export function AdminDashboard() {
  const { user } = useAuth();

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
      <p className="mt-2 text-gray-600">
        Willkommen, {user?.name}. Rolle: {user?.activeRole?.replace('_', ' ')}.
      </p>
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { label: 'Companies', href: '/admin/companies', desc: 'Firmen verwalten' },
          { label: 'Teams', href: '/admin/teams', desc: 'Teams & Round-Robin' },
          { label: 'Event Types', href: '/admin/event-types', desc: 'Terminarten verwalten' },
        ].map((card) => (
          <a key={card.href} href={card.href} className="rounded-lg border bg-white p-5 shadow-sm hover:shadow-md transition">
            <h3 className="font-semibold text-gray-900">{card.label}</h3>
            <p className="mt-1 text-sm text-gray-500">{card.desc}</p>
          </a>
        ))}
      </div>
    </div>
  );
}
