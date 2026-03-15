import { NavLink } from 'react-router';
import { useAuth } from '../../context/AuthContext';

interface NavItem {
  to: string;
  label: string;
  icon: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

function getNavSections(role: string): NavSection[] {
  const sections: NavSection[] = [];

  // Admin section (ORG_ADMIN and COMPANY_ADMIN)
  if (role === 'ORG_ADMIN' || role === 'COMPANY_ADMIN') {
    const adminItems: NavItem[] = [
      { to: '/admin', label: 'Dashboard', icon: '🏠' },
    ];

    if (role === 'ORG_ADMIN') {
      adminItems.push({ to: '/admin/companies', label: 'Companies', icon: '🏢' });
    }

    adminItems.push(
      { to: '/admin/users', label: 'Users', icon: '👤' },
      { to: '/admin/routing-forms', label: 'Routing Forms', icon: '🔀' },
      { to: '/admin/analytics', label: 'Analytics', icon: '📊' },
      { to: '/admin/settings', label: 'Einstellungen', icon: '⚙️' },
    );

    sections.push({ title: 'Administration', items: adminItems });
  }

  // Personal section (all roles)
  sections.push({
    title: 'Mein Bereich',
    items: [
      { to: '/dashboard', label: 'Meine Termine', icon: '📋' },
      { to: '/dashboard/my-event-types', label: 'Buchungsseiten', icon: '🔗' },
      { to: '/dashboard/teams', label: 'Meine Teams', icon: '👥' },
      { to: '/dashboard/api-keys', label: 'API Keys', icon: '🔑' },
    ],
  });

  return sections;
}

export function Sidebar() {
  const { user, logout } = useAuth();
  if (!user) return null;

  const role = user.activeRole ?? 'USER';
  const sections = getNavSections(role);

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-[#E2E8F0] bg-white">
      {/* Gradient accent line */}
      <div className="h-1 bg-gradient-to-r from-[#0B8ECA] via-[#14B8A6] to-[#F59E0B]" />

      <div className="border-b border-[#E2E8F0] p-4">
        <div className="flex items-center gap-2.5">
          <img src="/logo.jpg" alt="Calendfree" className="h-8 w-8 rounded-lg" />
          <div>
            <h1 className="text-lg font-bold text-[#1E293B]">Calendfree</h1>
            <p className="text-xs text-[#64748B]">{role.replace(/_/g, ' ')}</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto p-3">
        {sections.map((section) => (
          <div key={section.title} className="mb-5">
            <h3 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-[#64748B]">
              {section.title}
            </h3>
            <ul className="space-y-1">
              {section.items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.to === '/admin' || item.to === '/dashboard'}
                    className={({ isActive }) =>
                      `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-200 ${
                        isActive
                          ? 'bg-[#0B8ECA]/10 text-[#0B8ECA] font-medium'
                          : 'text-[#1E293B] hover:bg-[#F8FAFC]'
                      }`
                    }
                  >
                    <span>{item.icon}</span>
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-[#E2E8F0] p-4">
        <div className="flex items-center gap-3">
          {user.avatarUrl && (
            <img src={user.avatarUrl} alt="" className="h-8 w-8 rounded-full ring-2 ring-[#E2E8F0]" />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-[#1E293B]">{user.name}</p>
            <p className="truncate text-xs text-[#64748B]">{user.email}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="mt-3 w-full rounded-xl bg-[#F8FAFC] px-3 py-2 text-sm font-medium text-[#64748B] transition-colors hover:bg-[#E2E8F0] hover:text-[#1E293B]"
        >
          Abmelden
        </button>
      </div>
    </aside>
  );
}
