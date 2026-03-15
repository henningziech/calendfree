import { NavLink } from 'react-router';
import { useAuth } from '../../context/AuthContext';

const navItems = {
  ORG_ADMIN: [
    { to: '/admin', label: 'Dashboard', icon: '🏠' },
    { to: '/admin/companies', label: 'Companies', icon: '🏢' },
    { to: '/admin/teams', label: 'Teams', icon: '👥' },
    { to: '/admin/event-types', label: 'Event Types', icon: '📅' },
    { to: '/admin/users', label: 'Users', icon: '👤' },
    { to: '/admin/analytics', label: 'Analytics', icon: '📊' },
    { to: '/admin/settings', label: 'Einstellungen', icon: '⚙️' },
  ],
  COMPANY_ADMIN: [
    { to: '/admin', label: 'Dashboard', icon: '🏠' },
    { to: '/admin/teams', label: 'Teams', icon: '👥' },
    { to: '/admin/event-types', label: 'Event Types', icon: '📅' },
    { to: '/admin/users', label: 'Users', icon: '👤' },
    { to: '/admin/analytics', label: 'Analytics', icon: '📊' },
    { to: '/admin/settings', label: 'Einstellungen', icon: '⚙️' },
  ],
  USER: [
    { to: '/dashboard', label: 'Meine Termine', icon: '📅' },
    { to: '/dashboard/availability', label: 'Verfügbarkeit', icon: '🕐' },
    { to: '/dashboard/api-keys', label: 'API Keys', icon: '🔑' },
  ],
};

export function Sidebar() {
  const { user, logout } = useAuth();
  if (!user) return null;

  const role = user.activeRole ?? 'USER';
  const items = navItems[role] ?? navItems.USER;

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-gray-200 bg-white">
      <div className="border-b border-gray-200 p-4">
        <h1 className="text-xl font-bold text-gray-900">Calendfree</h1>
        <p className="mt-1 text-xs text-gray-500">{role.replace('_', ' ')}</p>
      </div>

      <nav className="flex-1 overflow-y-auto p-3">
        <ul className="space-y-1">
          {items.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.to === '/admin' || item.to === '/dashboard'}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-md px-3 py-2 text-sm transition ${
                    isActive ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700 hover:bg-gray-50'
                  }`
                }
              >
                <span>{item.icon}</span>
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="border-t border-gray-200 p-4">
        <div className="flex items-center gap-3">
          {user.avatarUrl && (
            <img src={user.avatarUrl} alt="" className="h-8 w-8 rounded-full" />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-gray-900">{user.name}</p>
            <p className="truncate text-xs text-gray-500">{user.email}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="mt-3 w-full rounded-md bg-gray-100 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-200"
        >
          Abmelden
        </button>
      </div>
    </aside>
  );
}
