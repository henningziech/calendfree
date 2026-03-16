import { useState, useRef, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router';
import { useAuth } from '../../context/AuthContext';

interface NavItem {
  to: string;
  label: string;
  end?: boolean;
}

const CREATE_OPTIONS = [
  {
    key: 'personal',
    label: 'Persönlicher Planer',
    subtitle: '1 Host → 1 Teilnehmer',
    description: 'Einzelgespräche, 1:1 Interviews',
  },
  {
    key: 'team',
    label: 'Team-Planer',
    subtitle: 'Rotierende Hosts → 1 Teilnehmer',
    description: 'Round Robin, Verteilung im Team',
  },
  {
    key: 'group',
    label: 'Gruppe',
    subtitle: '1 Host → Mehrere Teilnehmer',
    description: 'Workshops, Schulungen, Webinare',
  },
];

const MAIN_NAV: NavItem[] = [
  { to: '/dashboard/my-event-types', label: 'Terminplanung' },
  { to: '/dashboard', label: 'Termine', end: true },
  { to: '/dashboard/availability', label: 'Verfügbarkeit' },
  { to: '/dashboard/teams', label: 'Teams' },
];

const ADMIN_NAV: NavItem[] = [
  { to: '/admin/analytics', label: 'Analytik' },
  { to: '/admin', label: 'Admin-Bereich', end: true },
];

export function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  if (!user) return null;

  const role = user.activeRole ?? 'USER';
  const isAdmin = role === 'ORG_ADMIN' || role === 'COMPANY_ADMIN';

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setCreateOpen(false);
      }
    }
    if (createOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [createOpen]);

  const handleCreate = (key: string) => {
    setCreateOpen(false);
    navigate(`/dashboard/my-event-types?create=${key}`);
  };

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center rounded-xl px-3 py-2.5 text-sm transition-all duration-200 ${
      isActive
        ? 'bg-[#0B8ECA]/10 text-[#0B8ECA] font-medium'
        : 'text-[#1E293B] hover:bg-[#F8FAFC]'
    }`;

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-[#E2E8F0] bg-white">
      {/* Gradient accent line */}
      <div className="h-1 bg-gradient-to-r from-[#0B8ECA] via-[#14B8A6] to-[#F59E0B]" />

      {/* Logo */}
      <div className="border-b border-[#E2E8F0] p-4">
        <div className="flex items-center gap-2.5">
          <img src="/logo-mini.png" alt="Calendfree" className="h-8 w-8 rounded-lg" />
          <h1 className="text-lg font-bold text-[#1E293B]">Calendfree</h1>
        </div>
      </div>

      {/* Create button + dropdown */}
      <div className="relative p-3" ref={dropdownRef}>
        <button
          onClick={() => setCreateOpen(!createOpen)}
          className="w-full rounded-xl border-2 border-[#0B8ECA] px-4 py-2.5 text-sm font-semibold text-[#0B8ECA] transition-all hover:bg-[#0B8ECA]/5"
        >
          + Erstellen
        </button>

        {createOpen && (
          <div className="absolute left-3 right-3 top-full z-50 mt-1 rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-lg">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#64748B]">
              Event-Typen
            </p>
            <div className="space-y-1">
              {CREATE_OPTIONS.map((opt, i) => (
                <div key={opt.key}>
                  {i > 0 && <div className="my-1 border-t border-[#F1F5F9]" />}
                  <button
                    onClick={() => handleCreate(opt.key)}
                    className="w-full rounded-lg p-3 text-left transition-colors hover:bg-[#F8FAFC]"
                  >
                    <div className="font-semibold text-[#0B8ECA]">{opt.label}</div>
                    <div className="text-sm text-[#64748B]">{opt.subtitle}</div>
                    <div className="text-xs text-[#94A3B8]">{opt.description}</div>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Main navigation */}
      <nav className="flex-1 overflow-y-auto px-3">
        <ul className="space-y-1">
          {MAIN_NAV.map((item) => (
            <li key={item.to}>
              <NavLink to={item.to} end={item.end} className={navLinkClass}>
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>

        {/* Admin section */}
        {isAdmin && (
          <div className="mt-auto pt-4">
            <div className="border-t border-[#E2E8F0] pt-3">
              <ul className="space-y-1">
                {ADMIN_NAV.map((item) => (
                  <li key={item.to}>
                    <NavLink to={item.to} end={item.end} className={navLinkClass}>
                      {item.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </nav>

      {/* User footer */}
      <div className="border-t border-[#E2E8F0] p-4">
        <div className="flex items-center gap-3">
          {user.avatarUrl ? (
            <img src={user.avatarUrl} alt="" className="h-8 w-8 rounded-full ring-2 ring-[#E2E8F0]" />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0B8ECA] text-xs font-semibold text-white">
              {user.name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-[#1E293B]">{user.name}</p>
            <p className="truncate text-xs text-[#64748B]">{user.email}</p>
          </div>
          <button
            onClick={() => navigate('/dashboard/settings')}
            className="rounded-lg p-1.5 text-[#64748B] transition-colors hover:bg-[#F8FAFC] hover:text-[#1E293B]"
            title="Einstellungen"
          >
            ⚙
          </button>
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
