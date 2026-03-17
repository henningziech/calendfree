# User Detail Page & Absence Status Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a user detail page for admins with role management, absence toggle (with optional end date), membership overview, upcoming bookings, user deletion, and help tooltips. Absent users are excluded from team booking availability and round-robin.

**Architecture:** New `UserStatus` enum + `absentUntil` field on User model. Absence filtering in `availability.ts` before slot calculation (auto-resets expired absences). New admin endpoints for user detail, status update, bookings, and deletion. New frontend page with reusable HelpTooltip component.

**Tech Stack:** Prisma migration, Fastify routes, React, Tailwind CSS

---

## File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| Modify | `backend/prisma/schema.prisma` | Add `UserStatus` enum, `status`, `absentUntil` to User |
| Create | `backend/prisma/migrations/xxx/` | Auto-generated migration |
| Modify | `backend/src/routes/admin/users.ts` | Add detail, status, bookings, delete endpoints; extend list response |
| Modify | `backend/src/services/availability.ts` | Filter absent users before slot calculation |
| Modify | `frontend/src/api/admin.ts` | Add user detail/status/delete API functions |
| Create | `frontend/src/components/ui/HelpTooltip.tsx` | Reusable `(?)` hover tooltip |
| Create | `frontend/src/pages/admin/UserDetailPage.tsx` | User detail page |
| Modify | `frontend/src/pages/admin/UsersPage.tsx` | Make names clickable, show status dot |
| Modify | `frontend/src/pages/admin/SettingsPage.tsx` | Add Personio placeholder |
| Modify | `frontend/src/App.tsx` | Add `/admin/users/:userId` route |

---

## Chunk 1: Backend — Schema, Endpoints, Availability Filter

### Task 1: Add UserStatus enum + fields to User model + migration

**Files:**
- Modify: `backend/prisma/schema.prisma`

- [ ] **Step 1: Add enum and fields**

In `backend/prisma/schema.prisma`, add the enum after the existing enums (after `AuditAction`):

```prisma
enum UserStatus {
  AVAILABLE
  ABSENT
}
```

Add to the User model (after `timezone` field):

```prisma
  status      UserStatus @default(AVAILABLE)
  /// Optional end date for absence — status auto-resets to AVAILABLE when reached
  absentUntil DateTime?
```

- [ ] **Step 2: Generate and run migration**

```bash
cd /Users/hziech/calendfree/backend
npx prisma migrate dev --name add_user_status
```

- [ ] **Step 3: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations/
git commit -m "feat: add UserStatus enum with status and absentUntil fields"
git push
```

---

### Task 2: Extend user list response + add new admin endpoints

**Files:**
- Modify: `backend/src/routes/admin/users.ts`

- [ ] **Step 1: Add status to list response**

In the GET `/api/admin/companies/:companyId/users` handler, add `status` and `absentUntil` to the response mapping:

Change the return mapping to include:
```typescript
return memberships.map((m) => ({
  id: m.user.id,
  name: m.user.name,
  email: m.user.email,
  avatarUrl: m.user.avatarUrl,
  slug: m.user.slug,
  timezone: m.user.timezone,
  role: m.role,
  status: m.user.status,
  absentUntil: m.user.absentUntil,
  googleConnected: m.user.googleTokens?.connected ?? false,
}));
```

- [ ] **Step 2: Add GET /api/admin/users/:id endpoint**

Add after the existing DELETE endpoint (after line 72):

```typescript
/** GET /api/admin/users/:id — Full user detail */
app.get('/api/admin/users/:id', { preHandler: [requireRole('COMPANY_ADMIN', 'ORG_ADMIN')] }, async (request, reply) => {
  const { id } = request.params as { id: string };
  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      googleTokens: { select: { connected: true } },
      companyMemberships: { include: { company: { select: { id: true, name: true, slug: true } } } },
      teamMemberships: { include: { team: { select: { id: true, name: true } } } },
    },
  });
  if (!user) return reply.status(404).send({ error: 'User not found' });
  return user;
});
```

- [ ] **Step 3: Add PATCH /api/admin/users/:id/status endpoint**

```typescript
/** PATCH /api/admin/users/:id/status — Update user absence status */
app.patch('/api/admin/users/:id/status', { preHandler: [requireRole('COMPANY_ADMIN', 'ORG_ADMIN')] }, async (request, reply) => {
  const { id } = request.params as { id: string };
  const { status, absentUntil } = request.body as { status: 'AVAILABLE' | 'ABSENT'; absentUntil?: string };

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return reply.status(404).send({ error: 'User not found' });

  const updated = await prisma.user.update({
    where: { id },
    data: {
      status,
      absentUntil: status === 'ABSENT' && absentUntil ? new Date(absentUntil) : null,
    },
  });

  return { success: true, status: updated.status, absentUntil: updated.absentUntil };
});
```

- [ ] **Step 4: Add GET /api/admin/users/:id/bookings endpoint**

```typescript
/** GET /api/admin/users/:id/bookings — Upcoming bookings for a user */
app.get('/api/admin/users/:id/bookings', { preHandler: [requireRole('COMPANY_ADMIN', 'ORG_ADMIN')] }, async (request) => {
  const { id } = request.params as { id: string };
  const bookings = await prisma.booking.findMany({
    where: {
      assignedUserId: id,
      status: 'CONFIRMED',
      startTime: { gte: new Date() },
    },
    include: {
      eventType: { select: { title: true, slug: true, duration: true, teamId: true, team: { select: { name: true } }, company: { select: { slug: true } } } },
      formData: { select: { name: true, email: true, data: true } },
    },
    orderBy: { startTime: 'asc' },
    take: 50,
  });
  return bookings;
});
```

- [ ] **Step 5: Add DELETE /api/admin/users/:id endpoint**

```typescript
/** DELETE /api/admin/users/:id — Delete user (ORG_ADMIN only) */
app.delete('/api/admin/users/:id', { preHandler: [requireRole('ORG_ADMIN')] }, async (request, reply) => {
  const { id } = request.params as { id: string };
  const requestingUser = request.session.user!;

  if (id === requestingUser.id) {
    return reply.status(400).send({ error: 'Cannot delete yourself' });
  }

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return reply.status(404).send({ error: 'User not found' });

  await prisma.user.delete({ where: { id } });

  logAudit({
    userId: requestingUser.id,
    action: 'SETTINGS_CHANGED',
    details: { action: 'USER_DELETED', deletedUserId: id, deletedUserEmail: user.email },
  });

  return { success: true };
});
```

- [ ] **Step 6: Commit**

```bash
git add backend/src/routes/admin/users.ts
git commit -m "feat: add user detail, status, bookings, and delete endpoints"
git push
```

---

### Task 3: Filter absent users in availability calculation

**Files:**
- Modify: `backend/src/services/availability.ts`

- [ ] **Step 1: Add absence filter at the start of getAvailableSlots**

In `backend/src/services/availability.ts`, add the following after line 51 (after destructuring params), before the eventType lookup:

```typescript
// Filter out absent users (auto-reset expired absences)
const now = new Date();
const activeUserIds: string[] = [];
const absentUsers = await prisma.user.findMany({
  where: { id: { in: userIds } },
  select: { id: true, status: true, absentUntil: true },
});

for (const u of absentUsers) {
  if (u.status === 'ABSENT') {
    if (u.absentUntil && u.absentUntil <= now) {
      // Auto-reset expired absence
      await prisma.user.update({ where: { id: u.id }, data: { status: 'AVAILABLE', absentUntil: null } });
      activeUserIds.push(u.id);
    }
    // else: still absent, skip
  } else {
    activeUserIds.push(u.id);
  }
}

if (activeUserIds.length === 0) return [];
```

Then replace all subsequent uses of `userIds` with `activeUserIds` in the function. Specifically:
- Line 78 (existingBookings query): change `{ in: userIds }` to `{ in: activeUserIds }`
- Line 88 (freeBusyResults map): change `userIds.map` to `activeUserIds.map`
- Line 101 (failedUserIds push): change `failedUserIds.push(userIds[i])` to `failedUserIds.push(activeUserIds[i])`
- Line 106 (eligibleUserIds filter): change `userIds.filter` to `activeUserIds.filter`

- [ ] **Step 2: Commit**

```bash
git add backend/src/services/availability.ts
git commit -m "feat: filter absent users from availability calculation with auto-reset"
git push
```

---

## Chunk 2: Frontend — HelpTooltip, API, UserDetailPage, Navigation

### Task 4: Create HelpTooltip component

**Files:**
- Create: `frontend/src/components/ui/HelpTooltip.tsx`

- [ ] **Step 1: Create the component**

```tsx
interface HelpTooltipProps {
  text: string;
}

export function HelpTooltip({ text }: HelpTooltipProps) {
  return (
    <span className="group relative inline-flex ml-1.5 cursor-help">
      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#E2E8F0] text-[10px] font-bold text-[#64748B] transition-colors group-hover:bg-[#0B8ECA] group-hover:text-white">
        ?
      </span>
      <span className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-64 -translate-x-1/2 rounded-xl bg-[#1E293B] px-3 py-2 text-xs text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
        {text}
        <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#1E293B]" />
      </span>
    </span>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/ui/HelpTooltip.tsx
git commit -m "feat: add HelpTooltip component"
git push
```

---

### Task 5: Add admin API functions

**Files:**
- Modify: `frontend/src/api/admin.ts`

- [ ] **Step 1: Add user detail/status/bookings/delete functions**

Add at the end of `frontend/src/api/admin.ts`:

```typescript
// User Detail (Admin)
export async function getUserDetail(userId: string) {
  return apiRequest<any>(`/admin/users/${userId}`);
}

export async function updateUserStatus(userId: string, status: 'AVAILABLE' | 'ABSENT', absentUntil?: string) {
  return apiRequest(`/admin/users/${userId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, absentUntil }),
  });
}

export async function getUserBookings(userId: string) {
  return apiRequest<any[]>(`/admin/users/${userId}/bookings`);
}

export async function deleteUser(userId: string) {
  return apiRequest(`/admin/users/${userId}`, { method: 'DELETE' });
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/api/admin.ts
git commit -m "feat: add user detail admin API functions"
git push
```

---

### Task 6: Create UserDetailPage component

**Files:**
- Create: `frontend/src/pages/admin/UserDetailPage.tsx`

- [ ] **Step 1: Create the full component**

```tsx
import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router';
import { useAuth } from '../../context/AuthContext';
import { getUserDetail, updateUserStatus, getUserBookings, deleteUser } from '../../api/admin';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { HelpTooltip } from '../../components/ui/HelpTooltip';
import { BookingCard } from '../../components/bookings/BookingCard';
import { BookingDetailModal } from '../../components/bookings/BookingDetailModal';
import type { Booking } from '../../components/bookings/types';

export function UserDetailPage() {
  const { userId } = useParams<{ userId: string }>();
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const [userDetail, setUserDetail] = useState<any>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [isSavingStatus, setIsSavingStatus] = useState(false);
  const [absentUntilInput, setAbsentUntilInput] = useState('');

  const load = useCallback(async () => {
    if (!userId) return;
    setIsLoading(true);
    try {
      const [detail, bk] = await Promise.all([
        getUserDetail(userId),
        getUserBookings(userId),
      ]);
      setUserDetail(detail);
      setBookings(bk);
      setAbsentUntilInput(detail.absentUntil ? detail.absentUntil.split('T')[0] : '');
    } catch (err: any) {
      setError(err.status === 404 ? 'User nicht gefunden.' : 'Fehler beim Laden.');
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const handleStatusToggle = async () => {
    if (!userId || !userDetail) return;
    setIsSavingStatus(true);
    const newStatus = userDetail.status === 'AVAILABLE' ? 'ABSENT' : 'AVAILABLE';
    try {
      await updateUserStatus(
        userId,
        newStatus,
        newStatus === 'ABSENT' && absentUntilInput ? absentUntilInput : undefined,
      );
      setUserDetail({ ...userDetail, status: newStatus, absentUntil: newStatus === 'ABSENT' && absentUntilInput ? absentUntilInput : null });
    } catch {
      setError('Status konnte nicht geändert werden.');
    } finally {
      setIsSavingStatus(false);
    }
  };

  const handleAbsentUntilSave = async () => {
    if (!userId || userDetail?.status !== 'ABSENT') return;
    setIsSavingStatus(true);
    try {
      await updateUserStatus(userId, 'ABSENT', absentUntilInput || undefined);
      setUserDetail({ ...userDetail, absentUntil: absentUntilInput || null });
    } catch {
      setError('Datum konnte nicht gespeichert werden.');
    } finally {
      setIsSavingStatus(false);
    }
  };

  const handleDelete = async () => {
    if (!userId) return;
    if (!confirm(`${userDetail?.name} wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.`)) return;
    try {
      await deleteUser(userId);
      navigate('/admin/users');
    } catch (err: any) {
      setError(err.message ?? 'Fehler beim Löschen.');
    }
  };

  const handleNotesUpdated = (id: string, notes: string | null) => {
    setBookings((prev) => prev.map((b) => b.id === id ? { ...b, internalNotes: notes } : b));
    if (selectedBooking?.id === id) setSelectedBooking((prev) => prev ? { ...prev, internalNotes: notes } : prev);
  };

  const handleCancelled = (id: string) => {
    setBookings((prev) => prev.map((b) => b.id === id ? { ...b, status: 'CANCELLED' } : b));
  };

  if (isLoading) return <LoadingSpinner />;
  if (error && !userDetail) return <ErrorMessage message={error} />;
  if (!userDetail) return null;

  const isAbsent = userDetail.status === 'ABSENT';

  return (
    <div>
      <Link to="/admin/users" className="text-sm font-medium text-[#0B8ECA] hover:text-[#0874A6] transition-colors">
        ← Zurück zur Übersicht
      </Link>

      {error && <div className="mt-4"><ErrorMessage message={error} /></div>}

      {/* Header */}
      <div className="mt-4 flex items-center gap-4">
        {userDetail.avatarUrl && <img src={userDetail.avatarUrl} className="h-14 w-14 rounded-full ring-2 ring-[#E2E8F0]" alt="" />}
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-[#1E293B]">{userDetail.name}</h1>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${isAbsent ? 'bg-red-100 text-red-700' : 'bg-teal-100 text-teal-700'}`}>
              {isAbsent ? 'Abwesend' : 'Verfügbar'}
            </span>
          </div>
          <p className="text-sm text-[#64748B]">{userDetail.email}</p>
          <p className="text-xs text-[#64748B]/70">
            {userDetail.googleTokens?.connected ? 'Google Kalender verbunden' : 'Google nicht verbunden'}
          </p>
        </div>
      </div>

      {/* Status Section */}
      <div className="mt-6 rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-sm font-semibold text-[#1E293B]">Verfügbarkeitsstatus</h2>
          <HelpTooltip text="Abwesende User werden in Team-Buchungsseiten nicht berücksichtigt (Round-Robin, Verfügbarkeit)." />
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <button
            onClick={handleStatusToggle}
            disabled={isSavingStatus}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition-all ${
              isAbsent
                ? 'bg-teal-50 text-teal-700 ring-1 ring-teal-200 hover:bg-teal-100'
                : 'bg-red-50 text-red-700 ring-1 ring-red-200 hover:bg-red-100'
            } disabled:opacity-50`}
          >
            {isSavingStatus ? 'Wird gespeichert...' : isAbsent ? 'Auf Verfügbar setzen' : 'Auf Abwesend setzen'}
          </button>

          {isAbsent && (
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1 text-sm text-[#64748B]">
                Abwesend bis
                <HelpTooltip text="Optional. Wird das Datum erreicht, wechselt der Status automatisch zurück auf Verfügbar." />
              </label>
              <input
                type="date"
                value={absentUntilInput}
                onChange={(e) => setAbsentUntilInput(e.target.value)}
                className="rounded-xl border border-[#E2E8F0] px-3 py-1.5 text-sm focus:border-[#0B8ECA] focus:outline-none"
              />
              <button
                onClick={handleAbsentUntilSave}
                disabled={isSavingStatus}
                className="rounded-lg bg-[#0B8ECA] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#0874A6] disabled:opacity-50"
              >
                Speichern
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Memberships */}
      <div className="mt-6 rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-[#1E293B] mb-3">Mitgliedschaften</h2>

        {userDetail.companyMemberships?.length > 0 && (
          <div className="mb-3">
            <p className="text-xs font-medium text-[#64748B] mb-1.5">Companies</p>
            <div className="flex flex-wrap gap-2">
              {userDetail.companyMemberships.map((cm: any) => (
                <span key={cm.company.id} className="inline-flex items-center gap-1.5 rounded-full bg-[#F8FAFC] px-3 py-1 text-xs text-[#1E293B] ring-1 ring-[#E2E8F0]">
                  {cm.company.name}
                  <span className="text-[#0B8ECA]">{cm.role}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {userDetail.teamMemberships?.length > 0 && (
          <div>
            <p className="text-xs font-medium text-[#64748B] mb-1.5">Teams</p>
            <div className="flex flex-wrap gap-2">
              {userDetail.teamMemberships.map((tm: any) => (
                <span key={tm.team.id} className="rounded-full bg-[#F8FAFC] px-3 py-1 text-xs text-[#1E293B] ring-1 ring-[#E2E8F0]">
                  {tm.team.name}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Upcoming Bookings */}
      <div className="mt-6">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[#64748B] mb-3">
          Kommende Termine ({bookings.length})
        </h2>
        {bookings.length === 0 ? (
          <p className="text-sm text-[#64748B]">Keine kommenden Termine.</p>
        ) : (
          <div className="space-y-2">
            {bookings.map((b) => (
              <BookingCard key={b.id} booking={b} onClick={() => setSelectedBooking(b)} />
            ))}
          </div>
        )}
      </div>

      {/* Danger Zone */}
      {currentUser?.activeRole === 'ORG_ADMIN' && userId !== currentUser?.id && (
        <div className="mt-8 rounded-xl border border-red-200 bg-red-50/50 p-5">
          <div className="flex items-center gap-2 mb-2">
            <h2 className="text-sm font-semibold text-red-700">Danger Zone</h2>
            <HelpTooltip text="Entfernt den User und alle seine Mitgliedschaften. Bestehende Buchungen bleiben erhalten." />
          </div>
          <button
            onClick={handleDelete}
            className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors"
          >
            User löschen
          </button>
        </div>
      )}

      {/* Booking Detail Modal */}
      <BookingDetailModal
        booking={selectedBooking}
        open={!!selectedBooking}
        onClose={() => setSelectedBooking(null)}
        onNotesUpdated={handleNotesUpdated}
        onCancelled={handleCancelled}
      />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/admin/UserDetailPage.tsx
git commit -m "feat: add UserDetailPage with status, memberships, bookings, delete"
git push
```

---

### Task 7: Make user names clickable + add route + status dot

**Files:**
- Modify: `frontend/src/pages/admin/UsersPage.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Add route in App.tsx**

Add import:
```typescript
import { UserDetailPage } from './pages/admin/UserDetailPage';
```

Add route inside the admin layout (after `<Route path="users" element={<UsersPage />} />`):
```tsx
<Route path="users/:userId" element={<UserDetailPage />} />
```

- [ ] **Step 2: Update UsersPage**

Add import:
```typescript
import { Link } from 'react-router';
```

Replace the user name `<h3>` (line 77):
```tsx
<h3 className="font-medium text-[#1E293B]">{u.name}</h3>
```
With:
```tsx
<Link to={`/admin/users/${u.id}`} className="font-medium text-[#1E293B] hover:text-[#0B8ECA] transition-colors">{u.name}</Link>
```

Add a status dot before the role badge. In the right-side div (line 81-84), add before the role span:
```tsx
<span className={`h-2 w-2 rounded-full ${u.status === 'ABSENT' ? 'bg-[#EF4444]' : 'bg-[#10B981]'}`} title={u.status === 'ABSENT' ? 'Abwesend' : 'Verfügbar'} />
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/App.tsx frontend/src/pages/admin/UsersPage.tsx
git commit -m "feat: make user names clickable, add status dot, add route"
git push
```

---

### Task 8: Add Personio placeholder to Settings page

**Files:**
- Modify: `frontend/src/pages/admin/SettingsPage.tsx`

- [ ] **Step 1: Add Personio sync placeholder**

Replace the entire SettingsPage with:

```tsx
import { HelpTooltip } from '../../components/ui/HelpTooltip';

export function SettingsPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-[#1E293B]">Einstellungen</h1>
      <p className="mt-2 text-[#64748B]">Branding, Custom Domain und weitere Einstellungen werden hier verwaltet.</p>

      <div className="mt-6 rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F59E0B]/10">
            <svg className="h-5 w-5 text-[#F59E0B]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-sm text-[#64748B]">Wird in einem zukünftigen Update verfügbar.</p>
        </div>
      </div>

      {/* Personio Sync */}
      <div className="mt-4 rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-sm opacity-60">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#8B5CF6]/10">
              <svg className="h-5 w-5 text-[#8B5CF6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-1">
                <p className="text-sm font-medium text-[#1E293B]">Personio Abwesenheitssync</p>
                <HelpTooltip text="Automatischer Abgleich mit Personio-Abwesenheiten. Geplantes Feature." />
              </div>
              <p className="text-xs text-[#64748B]">Automatischer Abgleich mit Personio-Abwesenheiten</p>
            </div>
          </div>
          <span className="rounded-full bg-[#F8FAFC] px-3 py-1 text-xs font-medium text-[#64748B] ring-1 ring-[#E2E8F0]">
            Geplant
          </span>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/admin/SettingsPage.tsx
git commit -m "feat: add Personio sync placeholder to Settings page"
git push
```

---

## Summary of Changes

| Layer | What | Why |
|-------|------|-----|
| Schema | `UserStatus` enum + `status`, `absentUntil` on User | Track absence status |
| Backend | GET /admin/users/:id | Full user detail with memberships |
| Backend | PATCH /admin/users/:id/status | Toggle absence with optional end date |
| Backend | GET /admin/users/:id/bookings | Upcoming bookings for admin view |
| Backend | DELETE /admin/users/:id | User deletion (ORG_ADMIN only) |
| Backend | Extend user list response | Include status + absentUntil |
| Backend | availability.ts filter | Exclude absent users, auto-reset expired |
| Frontend | HelpTooltip.tsx | Reusable (?) hover tooltip |
| Frontend | UserDetailPage.tsx | Full admin user detail page |
| Frontend | UsersPage.tsx | Clickable names, status dots |
| Frontend | SettingsPage.tsx | Personio sync placeholder |
| Frontend | App.tsx | /admin/users/:userId route |
