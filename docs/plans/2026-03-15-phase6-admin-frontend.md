# Calendfree Phase 6: Admin Frontend — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the admin panel frontend: authentication flow (Google OAuth login), navigation/layout, and dashboards for Org-Admin (companies), Company-Admin (teams, event types, users, branding), and User (bookings, availability, API keys, personal booking page).

**Architecture:** Auth context wraps admin routes. Protected routes redirect to login. Sidebar navigation adapts to user role. Each admin section is a page that fetches its own data via the API client. Reusable table/form components keep pages focused.

**Tech Stack:** React 19, React Router v7, Tailwind CSS

---

## Chunk 1: Auth Context & Admin Layout

### Task 1: Create Auth Context & Admin API Client

**Files:**
- Create: `frontend/src/api/auth.ts`
- Create: `frontend/src/api/admin.ts`
- Create: `frontend/src/context/AuthContext.tsx`

- [ ] **Step 1: Create auth API**

```typescript
// frontend/src/api/auth.ts
import { apiRequest } from './client';

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  organizationId: string;
  activeCompanyId: string | null;
  activeRole: 'ORG_ADMIN' | 'COMPANY_ADMIN' | 'USER' | null;
}

export async function getCurrentUser(): Promise<SessionUser> {
  return apiRequest('/auth/me');
}

export async function logout(): Promise<void> {
  await apiRequest('/auth/logout', { method: 'POST' });
}

export function getLoginUrl(): string {
  return '/api/auth/google';
}
```

- [ ] **Step 2: Create admin API**

```typescript
// frontend/src/api/admin.ts
import { apiRequest } from './client';

// Organization
export async function getOrganization() {
  return apiRequest<any>('/admin/org');
}

export async function updateOrgBranding(branding: any) {
  return apiRequest('/admin/org/branding', { method: 'PUT', body: JSON.stringify(branding) });
}

// Companies
export async function getCompanies() {
  return apiRequest<any[]>('/admin/companies');
}

export async function createCompany(data: { name: string; slug: string }) {
  return apiRequest('/admin/companies', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateCompany(id: string, data: any) {
  return apiRequest(`/admin/companies/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}

export async function deleteCompany(id: string) {
  return apiRequest(`/admin/companies/${id}`, { method: 'DELETE' });
}

// Teams
export async function getTeams(companyId: string) {
  return apiRequest<any[]>(`/admin/companies/${companyId}/teams`);
}

export async function createTeam(companyId: string, data: { name: string; roundRobinMode?: string }) {
  return apiRequest(`/admin/companies/${companyId}/teams`, { method: 'POST', body: JSON.stringify(data) });
}

export async function deleteTeam(id: string) {
  return apiRequest(`/admin/teams/${id}`, { method: 'DELETE' });
}

export async function updateRoundRobin(teamId: string, mode: string) {
  return apiRequest(`/admin/teams/${teamId}/round-robin`, { method: 'PUT', body: JSON.stringify({ mode }) });
}

export async function addTeamMember(teamId: string, userId: string, weight: number = 100) {
  return apiRequest(`/admin/teams/${teamId}/members`, { method: 'POST', body: JSON.stringify({ userId, weight }) });
}

export async function removeTeamMember(teamId: string, userId: string) {
  return apiRequest(`/admin/teams/${teamId}/members/${userId}`, { method: 'DELETE' });
}

// Users
export async function getCompanyUsers(companyId: string) {
  return apiRequest<any[]>(`/admin/companies/${companyId}/users`);
}

export async function inviteUser(companyId: string, data: { email: string; name: string; role: string }) {
  return apiRequest(`/admin/companies/${companyId}/users`, { method: 'POST', body: JSON.stringify(data) });
}

export async function removeUser(companyId: string, userId: string) {
  return apiRequest(`/admin/companies/${companyId}/users/${userId}`, { method: 'DELETE' });
}

// Event Types
export async function getEventTypes(companyId: string) {
  return apiRequest<any[]>(`/admin/companies/${companyId}/event-types`);
}

export async function createEventType(companyId: string, data: any) {
  return apiRequest(`/admin/companies/${companyId}/event-types`, { method: 'POST', body: JSON.stringify(data) });
}

export async function updateEventType(id: string, data: any) {
  return apiRequest(`/admin/event-types/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}

export async function toggleEventType(id: string) {
  return apiRequest(`/admin/event-types/${id}/toggle`, { method: 'PATCH' });
}

export async function deleteEventType(id: string) {
  return apiRequest(`/admin/event-types/${id}`, { method: 'DELETE' });
}

// User profile
export async function getMyProfile() {
  return apiRequest<any>('/me');
}

export async function updateMyAvailability(data: any) {
  return apiRequest('/me/availability', { method: 'PATCH', body: JSON.stringify(data) });
}

export async function updateMyTimezone(timezone: string) {
  return apiRequest('/me/timezone', { method: 'PATCH', body: JSON.stringify({ timezone }) });
}

// API Keys
export async function getMyApiKeys() {
  return apiRequest<any[]>('/me/api-keys');
}

export async function createApiKey(name: string) {
  return apiRequest('/me/api-keys', { method: 'POST', body: JSON.stringify({ name }) });
}

export async function deleteApiKey(id: string) {
  return apiRequest(`/me/api-keys/${id}`, { method: 'DELETE' });
}
```

- [ ] **Step 3: Create AuthContext**

```tsx
// frontend/src/context/AuthContext.tsx
import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { getCurrentUser, logout as apiLogout, type SessionUser } from '../api/auth';

interface AuthContextType {
  user: SessionUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = async () => {
    try {
      const u = await getCurrentUser();
      setUser(u);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  const logout = async () => {
    await apiLogout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, isAuthenticated: !!user, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
```

- [ ] **Step 4: Commit + push**

```bash
cd /Users/hziech/calendfree && git add frontend/src/api/auth.ts frontend/src/api/admin.ts frontend/src/context/ && git commit -m "feat: add auth context, admin API client, and session management" && git push
```

---

### Task 2: Create Admin Layout & Navigation

**Files:**
- Create: `frontend/src/components/layout/AdminLayout.tsx`
- Create: `frontend/src/components/layout/Sidebar.tsx`
- Create: `frontend/src/pages/LoginPage.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Create Sidebar**

```tsx
// frontend/src/components/layout/Sidebar.tsx
import { NavLink } from 'react-router';
import { useAuth } from '../../context/AuthContext';

const navItems = {
  ORG_ADMIN: [
    { to: '/admin', label: 'Dashboard', icon: '🏠' },
    { to: '/admin/companies', label: 'Companies', icon: '🏢' },
    { to: '/admin/teams', label: 'Teams', icon: '👥' },
    { to: '/admin/event-types', label: 'Event Types', icon: '📅' },
    { to: '/admin/users', label: 'Users', icon: '👤' },
    { to: '/admin/settings', label: 'Einstellungen', icon: '⚙️' },
  ],
  COMPANY_ADMIN: [
    { to: '/admin', label: 'Dashboard', icon: '🏠' },
    { to: '/admin/teams', label: 'Teams', icon: '👥' },
    { to: '/admin/event-types', label: 'Event Types', icon: '📅' },
    { to: '/admin/users', label: 'Users', icon: '👤' },
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
```

- [ ] **Step 2: Create AdminLayout**

```tsx
// frontend/src/components/layout/AdminLayout.tsx
import { Navigate, Outlet } from 'react-router';
import { useAuth } from '../../context/AuthContext';
import { Sidebar } from './Sidebar';
import { LoadingSpinner } from '../ui/LoadingSpinner';

export function AdminLayout() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingSpinner text="Anmeldung wird geprüft..." />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-gray-50 p-6">
        <Outlet />
      </main>
    </div>
  );
}
```

- [ ] **Step 3: Create LoginPage**

```tsx
// frontend/src/pages/LoginPage.tsx
import { getLoginUrl } from '../api/auth';
import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router';

export function LoginPage() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return null;
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm space-y-6 text-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Calendfree</h1>
          <p className="mt-2 text-gray-600">Melden Sie sich an, um fortzufahren</p>
        </div>
        <a
          href={getLoginUrl()}
          className="inline-flex w-full items-center justify-center gap-3 rounded-md bg-white px-4 py-3 text-sm font-medium text-gray-700 shadow ring-1 ring-gray-300 hover:bg-gray-50"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Mit Google anmelden
        </a>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Update App.tsx with admin routes**

```tsx
// frontend/src/App.tsx
import { BrowserRouter, Routes, Route } from 'react-router';
import { AuthProvider } from './context/AuthContext';
import { AdminLayout } from './components/layout/AdminLayout';
import { BookingPage } from './pages/booking/BookingPage';
import { ConfirmationPage } from './pages/booking/ConfirmationPage';
import { CancelPage } from './pages/manage/CancelPage';
import { ReschedulePage } from './pages/manage/ReschedulePage';
import { NotFoundPage } from './pages/NotFoundPage';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { CompaniesPage } from './pages/admin/CompaniesPage';
import { TeamsPage } from './pages/admin/TeamsPage';
import { EventTypesPage } from './pages/admin/EventTypesPage';
import { UsersPage } from './pages/admin/UsersPage';
import { SettingsPage } from './pages/admin/SettingsPage';
import { UserDashboard } from './pages/dashboard/UserDashboard';
import { AvailabilityPage } from './pages/dashboard/AvailabilityPage';
import { ApiKeysPage } from './pages/dashboard/ApiKeysPage';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/manage/:token/cancel" element={<CancelPage />} />
          <Route path="/manage/:token/reschedule" element={<ReschedulePage />} />

          {/* Admin (protected) */}
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminDashboard />} />
            <Route path="companies" element={<CompaniesPage />} />
            <Route path="teams" element={<TeamsPage />} />
            <Route path="event-types" element={<EventTypesPage />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>

          {/* User dashboard (protected) */}
          <Route path="/dashboard" element={<AdminLayout />}>
            <Route index element={<UserDashboard />} />
            <Route path="availability" element={<AvailabilityPage />} />
            <Route path="api-keys" element={<ApiKeysPage />} />
          </Route>

          {/* Booking (public, must be last due to catch-all slug pattern) */}
          <Route path="/:companySlug/:eventTypeSlug" element={<BookingPage />} />
          <Route path="/:companySlug/:eventTypeSlug/confirmed" element={<ConfirmationPage />} />

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
```

- [ ] **Step 5: Create all placeholder admin/dashboard pages**

Create minimal placeholder components for all admin pages so the build succeeds. Each file exports a simple component with the page title.

- [ ] **Step 6: Verify frontend builds, commit + push**

```bash
cd /Users/hziech/calendfree && npm run build -w frontend && git add frontend/ && git commit -m "feat: add admin layout with sidebar, auth context, login page, and protected routes" && git push
```

---

## Chunk 2: Admin Pages

### Task 3: Company & Team Admin Pages

**Files:**
- Replace: `frontend/src/pages/admin/AdminDashboard.tsx`
- Replace: `frontend/src/pages/admin/CompaniesPage.tsx`
- Replace: `frontend/src/pages/admin/TeamsPage.tsx`

- [ ] **Step 1: Create AdminDashboard**

```tsx
// frontend/src/pages/admin/AdminDashboard.tsx
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
```

- [ ] **Step 2: Create CompaniesPage**

```tsx
// frontend/src/pages/admin/CompaniesPage.tsx
import { useState, useEffect } from 'react';
import { getCompanies, createCompany, deleteCompany } from '../../api/admin';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ErrorMessage } from '../../components/ui/ErrorMessage';

export function CompaniesPage() {
  const [companies, setCompanies] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newSlug, setNewSlug] = useState('');

  const load = async () => {
    setIsLoading(true);
    try {
      const data = await getCompanies();
      setCompanies(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createCompany({ name: newName, slug: newSlug });
      setShowCreate(false);
      setNewName('');
      setNewSlug('');
      load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Company "${name}" wirklich löschen?`)) return;
    try {
      await deleteCompany(id);
      load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (isLoading) return <LoadingSpinner />;

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Companies</h1>
        <button onClick={() => setShowCreate(true)} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          + Neue Company
        </button>
      </div>

      {error && <ErrorMessage message={error} />}

      {showCreate && (
        <form onSubmit={handleCreate} className="mt-4 flex gap-3 rounded-lg border bg-white p-4">
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Name" required className="flex-1 rounded-md border px-3 py-2 text-sm" />
          <input value={newSlug} onChange={(e) => setNewSlug(e.target.value)} placeholder="slug" required className="flex-1 rounded-md border px-3 py-2 text-sm" />
          <button type="submit" className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white">Erstellen</button>
          <button type="button" onClick={() => setShowCreate(false)} className="rounded-md bg-gray-100 px-4 py-2 text-sm">Abbrechen</button>
        </form>
      )}

      <div className="mt-4 space-y-2">
        {companies.map((c) => (
          <div key={c.id} className="flex items-center justify-between rounded-lg border bg-white p-4">
            <div>
              <h3 className="font-medium text-gray-900">{c.name}</h3>
              <p className="text-sm text-gray-500">/{c.slug}</p>
            </div>
            <button onClick={() => handleDelete(c.id, c.name)} className="text-sm text-red-600 hover:text-red-800">Löschen</button>
          </div>
        ))}
        {companies.length === 0 && <p className="text-gray-500 text-sm">Keine Companies vorhanden.</p>}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create TeamsPage**

```tsx
// frontend/src/pages/admin/TeamsPage.tsx
import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getTeams, createTeam, deleteTeam, updateRoundRobin } from '../../api/admin';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ErrorMessage } from '../../components/ui/ErrorMessage';

export function TeamsPage() {
  const { user } = useAuth();
  const [teams, setTeams] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newMode, setNewMode] = useState('SEQUENTIAL');

  const companyId = user?.activeCompanyId;

  const load = async () => {
    if (!companyId) return;
    setIsLoading(true);
    try {
      setTeams(await getTeams(companyId));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, [companyId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    try {
      await createTeam(companyId, { name: newName, roundRobinMode: newMode });
      setShowCreate(false);
      setNewName('');
      load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleModeChange = async (teamId: string, mode: string) => {
    try {
      await updateRoundRobin(teamId, mode);
      load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (isLoading) return <LoadingSpinner />;
  if (!companyId) return <p className="text-gray-500">Bitte wählen Sie zuerst eine Company aus.</p>;

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Teams</h1>
        <button onClick={() => setShowCreate(true)} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          + Neues Team
        </button>
      </div>

      {error && <ErrorMessage message={error} />}

      {showCreate && (
        <form onSubmit={handleCreate} className="mt-4 flex gap-3 rounded-lg border bg-white p-4">
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Team-Name" required className="flex-1 rounded-md border px-3 py-2 text-sm" />
          <select value={newMode} onChange={(e) => setNewMode(e.target.value)} className="rounded-md border px-3 py-2 text-sm">
            <option value="SEQUENTIAL">Sequential</option>
            <option value="LEAST_BUSY">Least Busy</option>
            <option value="WEIGHTED">Weighted</option>
          </select>
          <button type="submit" className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white">Erstellen</button>
          <button type="button" onClick={() => setShowCreate(false)} className="rounded-md bg-gray-100 px-4 py-2 text-sm">Abbrechen</button>
        </form>
      )}

      <div className="mt-4 space-y-3">
        {teams.map((t) => (
          <div key={t.id} className="rounded-lg border bg-white p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-gray-900">{t.name}</h3>
                <p className="text-sm text-gray-500">
                  {t.memberships?.length ?? 0} Mitglieder · {t._count?.eventTypes ?? 0} Event Types
                </p>
              </div>
              <div className="flex items-center gap-3">
                <select
                  value={t.rrConfig?.mode ?? 'SEQUENTIAL'}
                  onChange={(e) => handleModeChange(t.id, e.target.value)}
                  className="rounded-md border px-2 py-1 text-sm"
                >
                  <option value="SEQUENTIAL">Sequential</option>
                  <option value="LEAST_BUSY">Least Busy</option>
                  <option value="WEIGHTED">Weighted</option>
                </select>
                <button onClick={() => { if (confirm(`Team "${t.name}" löschen?`)) deleteTeam(t.id).then(load); }} className="text-sm text-red-600 hover:text-red-800">
                  Löschen
                </button>
              </div>
            </div>
            {t.memberships?.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {t.memberships.map((m: any) => (
                  <span key={m.user.id} className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700">
                    {m.user.name} {t.rrConfig?.mode === 'WEIGHTED' ? `(${m.weight}%)` : ''}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
        {teams.length === 0 && <p className="text-gray-500 text-sm">Keine Teams vorhanden.</p>}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Commit + push**

```bash
cd /Users/hziech/calendfree && npm run build -w frontend && git add frontend/ && git commit -m "feat: add admin dashboard, companies, and teams pages" && git push
```

---

### Task 4: Event Types, Users & Settings Pages

**Files:**
- Replace: `frontend/src/pages/admin/EventTypesPage.tsx`
- Replace: `frontend/src/pages/admin/UsersPage.tsx`
- Replace: `frontend/src/pages/admin/SettingsPage.tsx`

- [ ] **Step 1: Create EventTypesPage**

```tsx
// frontend/src/pages/admin/EventTypesPage.tsx
import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getEventTypes, createEventType, toggleEventType, deleteEventType } from '../../api/admin';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ErrorMessage } from '../../components/ui/ErrorMessage';

export function EventTypesPage() {
  const { user } = useAuth();
  const [eventTypes, setEventTypes] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: '', slug: '', duration: 30 });

  const companyId = user?.activeCompanyId;

  const load = async () => {
    if (!companyId) return;
    setIsLoading(true);
    try {
      setEventTypes(await getEventTypes(companyId));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, [companyId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    try {
      await createEventType(companyId, form);
      setShowCreate(false);
      setForm({ title: '', slug: '', duration: 30 });
      load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (isLoading) return <LoadingSpinner />;

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Event Types</h1>
        <button onClick={() => setShowCreate(true)} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          + Neuer Event Type
        </button>
      </div>

      {error && <ErrorMessage message={error} />}

      {showCreate && (
        <form onSubmit={handleCreate} className="mt-4 space-y-3 rounded-lg border bg-white p-4">
          <div className="flex gap-3">
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Titel" required className="flex-1 rounded-md border px-3 py-2 text-sm" />
            <input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="slug" required className="flex-1 rounded-md border px-3 py-2 text-sm" />
            <input type="number" value={form.duration} onChange={(e) => setForm({ ...form, duration: +e.target.value })} min={5} max={480} className="w-24 rounded-md border px-3 py-2 text-sm" />
          </div>
          <div className="flex gap-3">
            <button type="submit" className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white">Erstellen</button>
            <button type="button" onClick={() => setShowCreate(false)} className="rounded-md bg-gray-100 px-4 py-2 text-sm">Abbrechen</button>
          </div>
        </form>
      )}

      <div className="mt-4 space-y-2">
        {eventTypes.map((et) => (
          <div key={et.id} className="flex items-center justify-between rounded-lg border bg-white p-4">
            <div className="flex items-center gap-3">
              <div className="h-3 w-3 rounded-full" style={{ backgroundColor: et.color || '#2563EB' }} />
              <div>
                <h3 className="font-medium text-gray-900">{et.title}</h3>
                <p className="text-sm text-gray-500">/{et.slug} · {et.duration}min · {et._count?.bookings ?? 0} Buchungen</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => toggleEventType(et.id).then(load)}
                className={`rounded-full px-3 py-1 text-xs font-medium ${et.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}
              >
                {et.active ? 'Aktiv' : 'Inaktiv'}
              </button>
              <button onClick={() => { if (confirm(`"${et.title}" löschen?`)) deleteEventType(et.id).then(load); }} className="text-sm text-red-600">Löschen</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create UsersPage**

```tsx
// frontend/src/pages/admin/UsersPage.tsx
import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getCompanyUsers, inviteUser, removeUser } from '../../api/admin';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ErrorMessage } from '../../components/ui/ErrorMessage';

export function UsersPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [form, setForm] = useState({ email: '', name: '', role: 'USER' });

  const companyId = user?.activeCompanyId;

  const load = async () => {
    if (!companyId) return;
    setIsLoading(true);
    try {
      setUsers(await getCompanyUsers(companyId));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, [companyId]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    try {
      await inviteUser(companyId, form);
      setShowInvite(false);
      setForm({ email: '', name: '', role: 'USER' });
      load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (isLoading) return <LoadingSpinner />;

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Users</h1>
        <button onClick={() => setShowInvite(true)} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          + User einladen
        </button>
      </div>

      {error && <ErrorMessage message={error} />}

      {showInvite && (
        <form onSubmit={handleInvite} className="mt-4 flex gap-3 rounded-lg border bg-white p-4">
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Name" required className="flex-1 rounded-md border px-3 py-2 text-sm" />
          <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="E-Mail" type="email" required className="flex-1 rounded-md border px-3 py-2 text-sm" />
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="rounded-md border px-3 py-2 text-sm">
            <option value="USER">User</option>
            <option value="COMPANY_ADMIN">Company Admin</option>
            <option value="ORG_ADMIN">Org Admin</option>
          </select>
          <button type="submit" className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white">Einladen</button>
          <button type="button" onClick={() => setShowInvite(false)} className="rounded-md bg-gray-100 px-4 py-2 text-sm">Abbrechen</button>
        </form>
      )}

      <div className="mt-4 space-y-2">
        {users.map((u) => (
          <div key={u.id} className="flex items-center justify-between rounded-lg border bg-white p-4">
            <div className="flex items-center gap-3">
              {u.avatarUrl && <img src={u.avatarUrl} className="h-8 w-8 rounded-full" alt="" />}
              <div>
                <h3 className="font-medium text-gray-900">{u.name}</h3>
                <p className="text-sm text-gray-500">{u.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-gray-100 px-3 py-1 text-xs">{u.role}</span>
              <span className={`h-2 w-2 rounded-full ${u.googleConnected ? 'bg-green-500' : 'bg-gray-300'}`} title={u.googleConnected ? 'Google verbunden' : 'Nicht verbunden'} />
              <button onClick={() => { if (confirm(`${u.name} entfernen?`)) removeUser(companyId!, u.id).then(load); }} className="text-sm text-red-600">Entfernen</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create SettingsPage (placeholder)**

```tsx
// frontend/src/pages/admin/SettingsPage.tsx
export function SettingsPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Einstellungen</h1>
      <p className="mt-2 text-gray-600">Branding, Custom Domain und weitere Einstellungen werden hier verwaltet.</p>
      <p className="mt-4 text-sm text-gray-400">Wird in einem zukünftigen Update verfügbar.</p>
    </div>
  );
}
```

- [ ] **Step 4: Build + commit + push**

```bash
cd /Users/hziech/calendfree && npm run build -w frontend && git add frontend/ && git commit -m "feat: add event types, users, and settings admin pages" && git push
```

---

### Task 5: User Dashboard Pages

**Files:**
- Replace: `frontend/src/pages/dashboard/UserDashboard.tsx`
- Replace: `frontend/src/pages/dashboard/AvailabilityPage.tsx`
- Replace: `frontend/src/pages/dashboard/ApiKeysPage.tsx`

- [ ] **Step 1: Create UserDashboard**

```tsx
// frontend/src/pages/dashboard/UserDashboard.tsx
import { useAuth } from '../../context/AuthContext';

export function UserDashboard() {
  const { user } = useAuth();

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Meine Termine</h1>
      <p className="mt-2 text-gray-600">Willkommen, {user?.name}.</p>
      <div className="mt-6 rounded-lg border bg-white p-8 text-center text-gray-500">
        Ihre kommenden und vergangenen Termine erscheinen hier.
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create AvailabilityPage**

```tsx
// frontend/src/pages/dashboard/AvailabilityPage.tsx
import { useState, useEffect } from 'react';
import { getMyProfile, updateMyAvailability, updateMyTimezone } from '../../api/admin';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ErrorMessage } from '../../components/ui/ErrorMessage';

const DAYS = [
  { key: 'monday', label: 'Montag' },
  { key: 'tuesday', label: 'Dienstag' },
  { key: 'wednesday', label: 'Mittwoch' },
  { key: 'thursday', label: 'Donnerstag' },
  { key: 'friday', label: 'Freitag' },
  { key: 'saturday', label: 'Samstag' },
  { key: 'sunday', label: 'Sonntag' },
];

export function AvailabilityPage() {
  const [profile, setProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const load = async () => {
    setIsLoading(true);
    try {
      setProfile(await getMyProfile());
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    if (!profile?.availability) return;
    setIsSaving(true);
    try {
      await updateMyAvailability({
        weeklySchedule: profile.availability.weeklySchedule,
        maxPerDay: profile.availability.maxPerDay,
        maxPerWeek: profile.availability.maxPerWeek,
      });
      await updateMyTimezone(profile.timezone);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return <LoadingSpinner />;
  if (!profile) return <ErrorMessage message="Profil konnte nicht geladen werden" onRetry={load} />;

  const schedule = profile.availability?.weeklySchedule ?? {};

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Verfügbarkeit</h1>
        <button onClick={handleSave} disabled={isSaving} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
          {isSaving ? 'Speichern...' : 'Speichern'}
        </button>
      </div>

      {error && <ErrorMessage message={error} />}

      <div className="mt-6 space-y-4">
        <div className="rounded-lg border bg-white p-4">
          <label className="block text-sm font-medium text-gray-700">Timezone</label>
          <select
            value={profile.timezone}
            onChange={(e) => setProfile({ ...profile, timezone: e.target.value })}
            className="mt-1 rounded-md border px-3 py-2 text-sm"
          >
            {['Europe/Berlin', 'Europe/London', 'America/New_York', 'America/Los_Angeles', 'Asia/Tokyo'].map((tz) => (
              <option key={tz} value={tz}>{tz}</option>
            ))}
          </select>
        </div>

        <div className="rounded-lg border bg-white p-4">
          <h3 className="font-medium text-gray-900">Arbeitszeiten</h3>
          <div className="mt-3 space-y-2">
            {DAYS.map((day) => {
              const slots = schedule[day.key] ?? [];
              const hasSlot = slots.length > 0;
              const start = hasSlot ? slots[0].start : '09:00';
              const end = hasSlot ? slots[0].end : '17:00';

              return (
                <div key={day.key} className="flex items-center gap-3">
                  <label className="w-28 text-sm text-gray-700">{day.label}</label>
                  <input
                    type="checkbox"
                    checked={hasSlot}
                    onChange={(e) => {
                      const newSchedule = { ...schedule };
                      newSchedule[day.key] = e.target.checked ? [{ start: '09:00', end: '17:00' }] : [];
                      setProfile({
                        ...profile,
                        availability: { ...profile.availability, weeklySchedule: newSchedule },
                      });
                    }}
                  />
                  {hasSlot && (
                    <>
                      <input
                        type="time"
                        value={start}
                        onChange={(e) => {
                          const newSchedule = { ...schedule };
                          newSchedule[day.key] = [{ start: e.target.value, end }];
                          setProfile({ ...profile, availability: { ...profile.availability, weeklySchedule: newSchedule } });
                        }}
                        className="rounded-md border px-2 py-1 text-sm"
                      />
                      <span className="text-gray-400">–</span>
                      <input
                        type="time"
                        value={end}
                        onChange={(e) => {
                          const newSchedule = { ...schedule };
                          newSchedule[day.key] = [{ start, end: e.target.value }];
                          setProfile({ ...profile, availability: { ...profile.availability, weeklySchedule: newSchedule } });
                        }}
                        className="rounded-md border px-2 py-1 text-sm"
                      />
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-lg border bg-white p-4">
          <h3 className="font-medium text-gray-900">Limits</h3>
          <div className="mt-3 flex gap-6">
            <div>
              <label className="block text-sm text-gray-600">Max. pro Tag</label>
              <input
                type="number"
                value={profile.availability?.maxPerDay ?? 8}
                onChange={(e) => setProfile({ ...profile, availability: { ...profile.availability, maxPerDay: +e.target.value || null } })}
                min={1} max={50}
                className="mt-1 w-20 rounded-md border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600">Max. pro Woche</label>
              <input
                type="number"
                value={profile.availability?.maxPerWeek ?? 30}
                onChange={(e) => setProfile({ ...profile, availability: { ...profile.availability, maxPerWeek: +e.target.value || null } })}
                min={1} max={200}
                className="mt-1 w-20 rounded-md border px-3 py-2 text-sm"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create ApiKeysPage**

```tsx
// frontend/src/pages/dashboard/ApiKeysPage.tsx
import { useState, useEffect } from 'react';
import { getMyApiKeys, createApiKey, deleteApiKey } from '../../api/admin';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ErrorMessage } from '../../components/ui/ErrorMessage';

export function ApiKeysPage() {
  const [keys, setKeys] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newKeyName, setNewKeyName] = useState('');
  const [createdKey, setCreatedKey] = useState<string | null>(null);

  const load = async () => {
    setIsLoading(true);
    try {
      setKeys(await getMyApiKeys());
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const result = await createApiKey(newKeyName) as any;
      setCreatedKey(result.key);
      setNewKeyName('');
      load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('API Key wirklich löschen?')) return;
    try {
      await deleteApiKey(id);
      load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (isLoading) return <LoadingSpinner />;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">API Keys</h1>
      <p className="mt-2 text-sm text-gray-600">Erstellen Sie API Keys für programmatischen Zugriff auf Ihre Termine.</p>

      {error && <ErrorMessage message={error} />}

      {createdKey && (
        <div className="mt-4 rounded-lg border border-green-300 bg-green-50 p-4">
          <p className="text-sm font-medium text-green-800">Neuer API Key erstellt! Kopieren Sie ihn jetzt — er wird nicht erneut angezeigt.</p>
          <code className="mt-2 block break-all rounded bg-white p-3 text-sm font-mono">{createdKey}</code>
          <button onClick={() => { navigator.clipboard.writeText(createdKey); }} className="mt-2 text-sm text-green-700 hover:underline">
            Kopieren
          </button>
        </div>
      )}

      <form onSubmit={handleCreate} className="mt-4 flex gap-3">
        <input value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)} placeholder="Key-Name (z.B. 'n8n Integration')" required className="flex-1 rounded-md border px-3 py-2 text-sm" />
        <button type="submit" className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700">Erstellen</button>
      </form>

      <div className="mt-6 space-y-2">
        {keys.map((k) => (
          <div key={k.id} className="flex items-center justify-between rounded-lg border bg-white p-4">
            <div>
              <h3 className="font-medium text-gray-900">{k.name}</h3>
              <p className="text-sm text-gray-500">
                {k.keyPrefix}... · Erstellt: {new Date(k.createdAt).toLocaleDateString('de-DE')}
                {k.lastUsedAt && ` · Zuletzt: ${new Date(k.lastUsedAt).toLocaleDateString('de-DE')}`}
              </p>
            </div>
            <button onClick={() => handleDelete(k.id)} className="text-sm text-red-600 hover:text-red-800">Löschen</button>
          </div>
        ))}
        {keys.length === 0 && <p className="text-gray-500 text-sm">Keine API Keys vorhanden.</p>}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Build + commit + push**

```bash
cd /Users/hziech/calendfree && npm run build -w frontend && git add frontend/ && git commit -m "feat: add user dashboard with availability settings and API key management" && git push
```

---

## Verification Checklist

1. **`npm run build -w frontend`** — builds without errors
2. **`npm run test -w backend`** — all backend tests still pass
3. **Login flow**: /login shows Google login button → redirects to Google → callback creates session → redirect to /dashboard
4. **AdminLayout**: sidebar shows role-appropriate navigation, redirects to /login if unauthenticated
5. **Admin pages**: Companies CRUD, Teams CRUD with RR mode selector, Event Types with toggle, Users with invite
6. **User pages**: Dashboard, Availability editor (weekly schedule + limits + timezone), API Keys (create/copy/delete)
7. **Role-based nav**: ORG_ADMIN sees all admin items, COMPANY_ADMIN sees teams/events/users, USER sees dashboard items
