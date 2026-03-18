import { useState, useRef, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';

interface NavItem {
  to: string;
  label: string;
  end?: boolean;
}

export function Sidebar() {
  const { t } = useTranslation(['dashboard', 'common']);
  const { user, logout, switchCompany } = useAuth();
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [companyOpen, setCompanyOpen] = useState(false);
  const companyDropdownRef = useRef<HTMLDivElement>(null);

  const createOptions = [
    {
      key: 'personal',
      label: t('dashboard:sidebar.personalPlanner'),
      subtitle: t('dashboard:sidebar.personalPlannerSubtitle'),
      description: t('dashboard:sidebar.personalPlannerDescription'),
    },
    {
      key: 'team',
      label: t('dashboard:sidebar.teamPlanner'),
      subtitle: t('dashboard:sidebar.teamPlannerSubtitle'),
      description: t('dashboard:sidebar.teamPlannerDescription'),
    },
    {
      key: 'group',
      label: t('dashboard:sidebar.groupPlanner'),
      subtitle: t('dashboard:sidebar.groupPlannerSubtitle'),
      description: t('dashboard:sidebar.groupPlannerDescription'),
    },
  ];

  const mainNav: NavItem[] = [
    { to: '/dashboard/my-event-types', label: t('dashboard:nav.scheduling') },
    { to: '/dashboard', label: t('dashboard:nav.bookings'), end: true },
    { to: '/dashboard/availability', label: t('dashboard:nav.availability') },
    { to: '/dashboard/teams', label: t('dashboard:nav.teams') },
    { to: '/dashboard/routing-forms', label: t('dashboard:nav.routing') },
  ];

  const adminNav: NavItem[] = [
    { to: '/admin/analytics', label: t('dashboard:nav.analytics') },
    { to: '/admin', label: t('dashboard:nav.adminArea'), end: true },
  ];

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

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (companyDropdownRef.current && !companyDropdownRef.current.contains(e.target as Node)) {
        setCompanyOpen(false);
      }
    }
    if (companyOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [companyOpen]);

  const handleCompanySwitch = async (companyId: string) => {
    setCompanyOpen(false);
    if (companyId !== user?.activeCompanyId) {
      await switchCompany(companyId);
    }
  };

  const handleCreate = (key: string) => {
    setCreateOpen(false);
    navigate(`/dashboard/my-event-types/new?category=${key}`);
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

      {/* Company selector */}
      <div className="px-3 pb-1">
        <div className="relative" ref={companyDropdownRef}>
          <button
            onClick={() => setCompanyOpen(!companyOpen)}
            className="flex w-full items-center justify-between rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm transition-all hover:border-[#0B8ECA]/30"
          >
            <p className="min-w-0 flex-1 truncate text-left font-medium text-[#1E293B]">
              {user.companyMemberships?.find((c) => c.companyId === user.activeCompanyId)?.companyName ?? t('dashboard:sidebar.selectCompany')}
            </p>
            <svg className={`ml-2 h-4 w-4 shrink-0 text-[#64748B] transition-transform ${companyOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {companyOpen && (
            <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-xl border border-[#E2E8F0] bg-white py-1 shadow-lg">
              {(user.companyMemberships ?? []).map((c) => (
                <button
                  key={c.companyId}
                  onClick={() => handleCompanySwitch(c.companyId)}
                  className={`flex w-full items-center justify-between px-3 py-2 text-sm transition-colors hover:bg-[#F8FAFC] ${
                    c.companyId === user.activeCompanyId ? 'bg-[#0B8ECA]/5 text-[#0B8ECA]' : 'text-[#1E293B]'
                  }`}
                >
                  <span className="truncate">{c.companyName}</span>
                  <span className={`ml-2 shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                    c.role === 'ORG_ADMIN' || c.role === 'COMPANY_ADMIN'
                      ? 'bg-[#14B8A6]/10 text-[#14B8A6]'
                      : 'bg-[#64748B]/10 text-[#64748B]'
                  }`}>
                    {c.role === 'ORG_ADMIN' ? 'Org Admin' : c.role === 'COMPANY_ADMIN' ? 'Admin' : 'User'}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create button + dropdown */}
      <div className="relative p-3" ref={dropdownRef}>
        <button
          onClick={() => setCreateOpen(!createOpen)}
          className="w-full rounded-xl border-2 border-[#0B8ECA] px-4 py-2.5 text-sm font-semibold text-[#0B8ECA] transition-all hover:bg-[#0B8ECA]/5"
        >
          {t('dashboard:sidebar.create')}
        </button>

        {createOpen && (
          <div className="absolute left-3 right-3 top-full z-50 mt-1 rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-lg">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#64748B]">
              {t('dashboard:sidebar.eventTypes')}
            </p>
            <div className="space-y-1">
              {createOptions.map((opt, i) => (
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
          {mainNav.map((item) => (
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
                {adminNav.map((item) => (
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
            title={t('dashboard:sidebar.settings')}
          >
            ⚙
          </button>
        </div>
        <button
          onClick={logout}
          className="mt-3 w-full rounded-xl bg-[#F8FAFC] px-3 py-2 text-sm font-medium text-[#64748B] transition-colors hover:bg-[#E2E8F0] hover:text-[#1E293B]"
        >
          {t('dashboard:sidebar.logout')}
        </button>
      </div>
    </aside>
  );
}
