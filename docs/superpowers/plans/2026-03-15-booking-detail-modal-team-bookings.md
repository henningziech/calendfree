# Booking Detail Modal & Team Bookings Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make bookings clickable with a detail modal (internal notes, cancel, reschedule, meet link) and add a "Teamtermine" tab showing bookings for all teams the user belongs to — editable by all team members.

**Architecture:** Add `internalNotes` field to Booking model. Add 3 new backend endpoints (GET team bookings, PATCH notes, POST cancel-as-user). Create a reusable Modal component. Rewrite UserDashboard with tabs and clickable booking cards that open a detail modal.

**Tech Stack:** Prisma migration, Fastify routes, React (useState/useEffect), Tailwind CSS

---

## File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| Modify | `backend/prisma/schema.prisma` | Add `internalNotes` to Booking model |
| Create | `backend/prisma/migrations/xxx_add_internal_notes/` | Migration (auto-generated) |
| Modify | `backend/src/routes/admin/users.ts` | Add 3 new endpoints under `/api/me/bookings/...` |
| Modify | `shared/src/schemas/booking.ts` | Add Zod schema for notes update |
| Modify | `frontend/src/api/booking.ts` | Add authenticated booking management functions |
| Create | `frontend/src/components/ui/Modal.tsx` | Reusable modal/dialog component |
| Create | `frontend/src/components/bookings/BookingCard.tsx` | Clickable booking card component |
| Create | `frontend/src/components/bookings/BookingDetailModal.tsx` | Booking detail modal with notes, cancel |
| Modify | `frontend/src/pages/dashboard/UserDashboard.tsx` | Rewrite: tabs + import card/modal components |

---

## Chunk 1: Backend — Schema & Endpoints

### Task 1: Add `internalNotes` to Booking model + migration

**Files:**
- Modify: `backend/prisma/schema.prisma:264-289` (Booking model)

- [ ] **Step 1: Add internalNotes field to schema**

In `backend/prisma/schema.prisma`, add to the Booking model (after `version` field, before `createdAt`):

```prisma
  /// Internal notes by consultant (not visible to customer)
  internalNotes  String?
```

- [ ] **Step 2: Generate and run migration**

```bash
cd /Users/hziech/calendfree/backend
npx prisma migrate dev --name add_booking_internal_notes
```

Expected: Migration created and applied, Prisma client regenerated.

- [ ] **Step 3: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations/
git commit -m "feat: add internalNotes field to Booking model"
git push
```

---

### Task 2: Extend GET /api/me/bookings to include internalNotes and formData.data

**Files:**
- Modify: `backend/src/routes/admin/users.ts:98-111`

- [ ] **Step 1: Update the existing GET /api/me/bookings query**

In `backend/src/routes/admin/users.ts`, update the `/api/me/bookings` endpoint's Prisma query to include `internalNotes` in the select and expand `formData` to include the `data` JSON field:

Change the existing include from:
```typescript
include: {
  eventType: { select: { title: true, slug: true, duration: true, company: { select: { slug: true } } } },
  formData: { select: { name: true, email: true } },
},
```

To:
```typescript
include: {
  eventType: { select: { title: true, slug: true, duration: true, teamId: true, company: { select: { slug: true } } } },
  formData: { select: { name: true, email: true, data: true } },
},
```

Note: `internalNotes` is already on the Booking model itself so it's included by default. We also add `teamId` to know if it's a team booking, and `formData.data` to access the comment (`_comment` key).

- [ ] **Step 2: Verify the endpoint still works**

```bash
curl -s http://localhost:3001/api/me/bookings -H "Cookie: <session>" | jq '.[0] | keys'
```

Expected: Response includes `internalNotes` field (null for existing bookings).

- [ ] **Step 3: Commit**

```bash
git add backend/src/routes/admin/users.ts
git commit -m "feat: include internalNotes and teamId in booking response"
git push
```

---

### Task 3: Add GET /api/me/bookings/team endpoint

**Files:**
- Modify: `backend/src/routes/admin/users.ts`

- [ ] **Step 1: Add team bookings endpoint**

Add a new route in `backend/src/routes/admin/users.ts` after the existing `/api/me/bookings` route:

```typescript
/** GET /api/me/bookings/team — Get bookings for all teams the user is in */
app.get('/api/me/bookings/team', { preHandler: [requireAuth] }, async (request) => {
  const user = request.session.user!;

  // Find all teams the user belongs to
  const teamMemberships = await prisma.teamMembership.findMany({
    where: { userId: user.id },
    select: { teamId: true },
  });
  const teamIds = teamMemberships.map((m) => m.teamId);

  if (teamIds.length === 0) return [];

  // Find all bookings for event types belonging to these teams,
  // excluding the user's own bookings (those are in /api/me/bookings)
  const bookings = await prisma.booking.findMany({
    where: {
      eventType: { teamId: { in: teamIds } },
      assignedUserId: { not: user.id },
    },
    include: {
      eventType: { select: { title: true, slug: true, duration: true, teamId: true, team: { select: { name: true } }, company: { select: { slug: true } } } },
      formData: { select: { name: true, email: true, data: true } },
      assignedUser: { select: { name: true, email: true } },
    },
    orderBy: { startTime: 'desc' },
    take: 100,
  });

  return bookings;
});
```

Key design decisions:
- Returns bookings from ALL teams the user is in
- Excludes user's own bookings (those appear in "Meine Termine")
- Includes `assignedUser` so team members see who the booking is assigned to
- Includes `team.name` for display

- [ ] **Step 2: Verify endpoint**

```bash
curl -s http://localhost:3001/api/me/bookings/team -H "Cookie: <session>" | jq 'length'
```

Expected: Returns array (possibly empty if user is not in any team or no team bookings exist).

- [ ] **Step 3: Commit**

```bash
git add backend/src/routes/admin/users.ts
git commit -m "feat: add GET /api/me/bookings/team endpoint"
git push
```

---

### Task 4: Add Zod schema + PATCH /api/me/bookings/:id/notes endpoint

**Files:**
- Modify: `shared/src/schemas/booking.ts`
- Modify: `backend/src/routes/admin/users.ts`

- [ ] **Step 1a: Add Zod schema for notes update**

In `shared/src/schemas/booking.ts`, add at the end:

```typescript
export const UpdateBookingNotesSchema = z.object({
  notes: z.string().max(5000),
});
export type UpdateBookingNotes = z.infer<typeof UpdateBookingNotesSchema>;
```

- [ ] **Step 1b: Add notes update endpoint**

In `backend/src/routes/admin/users.ts`, add the import at the top:

```typescript
import { UpdateBookingNotesSchema } from '@calendfree/shared';
```

Add a new route:

```typescript
/** PATCH /api/me/bookings/:id/notes — Update internal notes (own or team booking) */
app.patch('/api/me/bookings/:id/notes', { preHandler: [requireAuth] }, async (request, reply) => {
  const user = request.session.user!;
  const { id } = request.params as { id: string };
  const { notes } = UpdateBookingNotesSchema.parse(request.body);

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: { eventType: { select: { teamId: true } } },
  });

  if (!booking) {
    return reply.status(404).send({ error: 'Booking not found' });
  }

  // Access check: own booking OR team member of the booking's team
  let hasAccess = booking.assignedUserId === user.id;

  if (!hasAccess && booking.eventType.teamId) {
    const membership = await prisma.teamMembership.findUnique({
      where: { userId_teamId: { userId: user.id, teamId: booking.eventType.teamId } },
    });
    hasAccess = !!membership;
  }

  if (!hasAccess) {
    return reply.status(403).send({ error: 'Access denied' });
  }

  const updated = await prisma.booking.update({
    where: { id },
    data: { internalNotes: notes || null },
  });

  return { success: true, internalNotes: updated.internalNotes };
});
```

Key design: Team members can edit notes on any booking belonging to their team's event types.

- [ ] **Step 2: Verify endpoint**

Test with a known booking ID:
```bash
curl -X PATCH http://localhost:3001/api/me/bookings/<BOOKING_ID>/notes \
  -H "Cookie: <session>" \
  -H "Content-Type: application/json" \
  -d '{"notes": "Test note"}'
```

Expected: `{ "success": true, "internalNotes": "Test note" }`

- [ ] **Step 3: Commit**

```bash
git add shared/src/schemas/booking.ts backend/src/routes/admin/users.ts
git commit -m "feat: add PATCH /api/me/bookings/:id/notes endpoint with Zod validation"
git push
```

---

### Task 5: Add POST /api/me/bookings/:id/cancel endpoint

**Files:**
- Modify: `backend/src/routes/admin/users.ts`

- [ ] **Step 1: Add authenticated cancel endpoint**

Add a new route (import `logAudit` and `cancelBookingNotifications` at the top of the file):

```typescript
import { logAudit } from '../../services/audit-log.js';
import { cancelBookingNotifications } from '../../jobs/notification-jobs.js';
import { config } from '../../config.js';
```

Then the route:

```typescript
/** POST /api/me/bookings/:id/cancel — Cancel booking (own or team) */
app.post('/api/me/bookings/:id/cancel', { preHandler: [requireAuth] }, async (request, reply) => {
  const user = request.session.user!;
  const { id } = request.params as { id: string };

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: { eventType: { select: { teamId: true } } },
  });

  if (!booking) {
    return reply.status(404).send({ error: 'Booking not found' });
  }

  if (booking.status === 'CANCELLED') {
    return reply.status(400).send({ error: 'Booking already cancelled' });
  }

  // Access check: own booking OR team member
  let hasAccess = booking.assignedUserId === user.id;
  if (!hasAccess && booking.eventType.teamId) {
    const membership = await prisma.teamMembership.findUnique({
      where: { userId_teamId: { userId: user.id, teamId: booking.eventType.teamId } },
    });
    hasAccess = !!membership;
  }

  if (!hasAccess) {
    return reply.status(403).send({ error: 'Access denied' });
  }

  // Delete calendar event if exists
  if (booking.calendarEventId) {
    try {
      const { deleteCalendarEvent } = await import('../../services/calendar.js');
      await deleteCalendarEvent(booking.assignedUserId, booking.calendarEventId!);
    } catch (err) {
      app.log.error(err, 'Failed to delete calendar event');
    }
  }

  await prisma.booking.update({
    where: { id },
    data: { status: 'CANCELLED' },
  });

  logAudit({
    userId: user.id,
    action: 'BOOKING_CANCELLED',
    details: { bookingId: id, cancelledBy: user.email },
  });

  if (config.NODE_ENV !== 'test') {
    try { await cancelBookingNotifications(id); } catch (err) { app.log.error(err, 'Failed to send cancellation notification'); }
  }

  return { success: true };
});
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/routes/admin/users.ts
git commit -m "feat: add POST /api/me/bookings/:id/cancel endpoint"
git push
```

---

## Chunk 2: Frontend — Modal Component & API Functions

### Task 6: Create reusable Modal component

**Files:**
- Create: `frontend/src/components/ui/Modal.tsx`

- [ ] **Step 1: Create Modal component**

Create `frontend/src/components/ui/Modal.tsx`:

```tsx
import { useEffect, type ReactNode } from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

export function Modal({ open, onClose, title, children }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 mx-4 w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-[#1E293B]">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-[#64748B] hover:bg-[#F1F5F9] transition-colors">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/ui/Modal.tsx
git commit -m "feat: add reusable Modal component"
git push
```

---

### Task 7: Add authenticated booking API functions to booking.ts

**Files:**
- Modify: `frontend/src/api/booking.ts`

- [ ] **Step 1: Add booking management functions**

Add the following at the end of `frontend/src/api/booking.ts` (this file already has the public booking functions; we add the authenticated user-facing ones here too):

```typescript
// ── Authenticated booking management (user dashboard) ──

/** Fetch current user's bookings. */
export async function getMyBookings() {
  return apiRequest<any[]>('/me/bookings');
}

/** Fetch bookings for all teams the user belongs to. */
export async function getTeamBookings() {
  return apiRequest<any[]>('/me/bookings/team');
}

/** Update internal notes on a booking. */
export async function updateBookingNotes(bookingId: string, notes: string) {
  return apiRequest(`/me/bookings/${bookingId}/notes`, {
    method: 'PATCH',
    body: JSON.stringify({ notes }),
  });
}

/** Cancel a booking as an authenticated user. */
export async function cancelBookingAsUser(bookingId: string) {
  return apiRequest(`/me/bookings/${bookingId}/cancel`, { method: 'POST' });
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/api/booking.ts
git commit -m "feat: add authenticated booking management API functions"
git push
```

---

## Chunk 3: Frontend — Dashboard Rewrite

### Task 8: Create BookingCard component

**Files:**
- Create: `frontend/src/components/bookings/BookingCard.tsx`

- [ ] **Step 1: Create the BookingCard component**

Create `frontend/src/components/bookings/BookingCard.tsx`:

```tsx
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import type { Booking } from './types';
import { statusLabel } from './types';

interface BookingCardProps {
  booking: Booking;
  onClick: () => void;
  showAssignee?: boolean;
}

export function BookingCard({ booking, onClick, showAssignee }: BookingCardProps) {
  const st = statusLabel[booking.status] ?? { text: booking.status, color: 'bg-[#F8FAFC] text-[#64748B]' };
  return (
    <button
      onClick={onClick}
      className="w-full text-left flex items-center justify-between rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-sm transition-all hover:shadow-md hover:border-[#0B8ECA]/30 cursor-pointer"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="font-medium text-[#1E293B] truncate">{booking.eventType.title}</h3>
          <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${st.color}`}>{st.text}</span>
        </div>
        <p className="mt-1 text-sm text-[#64748B]">
          {format(parseISO(booking.startTime), "EEEE, d. MMM yyyy 'um' HH:mm 'Uhr'", { locale: de })}
          {' · '}{booking.eventType.duration} Min
        </p>
        {booking.formData && (
          <p className="mt-1 text-sm text-[#64748B]/70 truncate">
            Kunde: {booking.formData.name} ({booking.formData.email})
          </p>
        )}
        {showAssignee && booking.assignedUser && (
          <p className="mt-0.5 text-xs text-[#0B8ECA]">
            Zugewiesen: {booking.assignedUser.name}
          </p>
        )}
      </div>
      <svg className="h-5 w-5 shrink-0 text-[#94A3B8] ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
      </svg>
    </button>
  );
}
```

- [ ] **Step 2: Create shared types file**

Create `frontend/src/components/bookings/types.ts`:

```typescript
export interface Booking {
  id: string;
  startTime: string;
  endTime: string;
  status: string;
  internalNotes: string | null;
  bookingToken: string;
  calendarEventId: string | null;
  eventType: {
    title: string;
    slug: string;
    duration: number;
    teamId: string | null;
    team?: { name: string } | null;
    company: { slug: string } | null;
  };
  formData: { name: string; email: string; data: Record<string, any> } | null;
  assignedUser?: { name: string; email: string };
}

export const statusLabel: Record<string, { text: string; color: string }> = {
  CONFIRMED: { text: 'Bestätigt', color: 'bg-teal-100 text-teal-700' },
  CANCELLED: { text: 'Abgesagt', color: 'bg-red-100 text-red-700' },
  RESCHEDULED: { text: 'Verschoben', color: 'bg-amber-100 text-amber-700' },
  COMPLETED: { text: 'Abgeschlossen', color: 'bg-[#F8FAFC] text-[#64748B]' },
  NO_SHOW: { text: 'No-Show', color: 'bg-red-100 text-red-600' },
  PENDING_CALENDAR_SYNC: { text: 'Sync ausstehend', color: 'bg-amber-100 text-amber-700' },
};
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/bookings/
git commit -m "feat: add BookingCard component and booking types"
git push
```

---

### Task 9: Create BookingDetailModal component

**Files:**
- Create: `frontend/src/components/bookings/BookingDetailModal.tsx`

- [ ] **Step 1: Create the BookingDetailModal component**

Create `frontend/src/components/bookings/BookingDetailModal.tsx`:

```tsx
import { useState, useEffect } from 'react';
import { updateBookingNotes, cancelBookingAsUser } from '../../api/booking';
import { Modal } from '../ui/Modal';
import { format, parseISO, isPast } from 'date-fns';
import { de } from 'date-fns/locale';
import type { Booking } from './types';
import { statusLabel } from './types';

interface BookingDetailModalProps {
  booking: Booking | null;
  open: boolean;
  onClose: () => void;
  onNotesUpdated: (id: string, notes: string | null) => void;
  onCancelled: (id: string) => void;
}

export function BookingDetailModal({ booking, open, onClose, onNotesUpdated, onCancelled }: BookingDetailModalProps) {
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    if (booking) setNotes(booking.internalNotes ?? '');
    setSaveMessage(null);
  }, [booking]);

  if (!booking) return null;

  const st = statusLabel[booking.status] ?? { text: booking.status, color: 'bg-[#F8FAFC] text-[#64748B]' };
  const comment = booking.formData?.data?._comment;
  const isUpcoming = !isPast(parseISO(booking.startTime)) && booking.status === 'CONFIRMED';

  const handleSaveNotes = async () => {
    setIsSaving(true);
    setSaveMessage(null);
    try {
      await updateBookingNotes(booking.id, notes);
      onNotesUpdated(booking.id, notes || null);
      setSaveMessage('Gespeichert');
      setTimeout(() => setSaveMessage(null), 2000);
    } catch {
      setSaveMessage('Fehler beim Speichern');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm('Termin wirklich absagen? Der Google Calendar Eintrag wird gelöscht.')) return;
    setIsCancelling(true);
    try {
      await cancelBookingAsUser(booking.id);
      onCancelled(booking.id);
      onClose();
    } catch {
      alert('Fehler beim Absagen des Termins.');
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={booking.eventType.title}>
      <div className="space-y-4">
        {/* Status + Time */}
        <div className="rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] p-4 space-y-2">
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${st.color}`}>{st.text}</span>
            {booking.eventType.team && (
              <span className="text-xs text-[#64748B]">Team: {booking.eventType.team.name}</span>
            )}
          </div>
          <p className="text-sm font-medium text-[#1E293B]">
            {format(parseISO(booking.startTime), "EEEE, d. MMMM yyyy", { locale: de })}
          </p>
          <p className="text-sm text-[#64748B]">
            {format(parseISO(booking.startTime), "HH:mm", { locale: de })} – {format(parseISO(booking.endTime), "HH:mm 'Uhr'", { locale: de })} ({booking.eventType.duration} Min)
          </p>
          {booking.assignedUser && (
            <p className="text-xs text-[#0B8ECA]">Zugewiesen: {booking.assignedUser.name} ({booking.assignedUser.email})</p>
          )}
        </div>

        {/* Customer Info */}
        {booking.formData && (
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#64748B] mb-1">Kunde</h3>
            <p className="text-sm text-[#1E293B]">{booking.formData.name}</p>
            <a href={`mailto:${booking.formData.email}`} className="text-sm text-[#0B8ECA] hover:underline">{booking.formData.email}</a>
            {comment && (
              <div className="mt-2 rounded-lg bg-amber-50 border border-amber-100 p-3">
                <p className="text-xs font-medium text-amber-700 mb-0.5">Kommentar vom Kunden:</p>
                <p className="text-sm text-amber-900">{comment}</p>
              </div>
            )}
          </div>
        )}

        {/* Internal Notes */}
        <div>
          <label htmlFor="internal-notes" className="text-xs font-semibold uppercase tracking-wider text-[#64748B]">
            Interne Notizen
          </label>
          <textarea
            id="internal-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="mt-1 block w-full rounded-xl border border-[#E2E8F0] px-4 py-2.5 text-sm shadow-sm transition-all focus:border-[#0B8ECA] focus:ring-2 focus:ring-[#0B8ECA]/20 focus:outline-none resize-none"
            placeholder="Notizen zum Termin (nur intern sichtbar)..."
          />
          <div className="mt-2 flex items-center gap-2">
            <button
              onClick={handleSaveNotes}
              disabled={isSaving}
              className="rounded-lg bg-[#0B8ECA] px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-[#0874A6] disabled:opacity-50 transition-colors"
            >
              {isSaving ? 'Speichert...' : 'Notizen speichern'}
            </button>
            {saveMessage && (
              <span className={`text-xs ${saveMessage === 'Gespeichert' ? 'text-teal-600' : 'text-red-600'}`}>
                {saveMessage}
              </span>
            )}
          </div>
        </div>

        {/* Action buttons */}
        {isUpcoming && (
          <div className="flex gap-2 pt-2 border-t border-[#E2E8F0]">
            <button
              onClick={handleCancel}
              disabled={isCancelling}
              className="flex-1 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50 transition-colors"
            >
              {isCancelling ? 'Wird abgesagt...' : 'Absagen'}
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}
```

Note: The "Im Kalender ansehen" link was removed because the Google Calendar `eid` parameter requires a base64-encoded format that differs from the API event ID we store. This can be added later when we store the `htmlLink` from the Calendar API response.

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/bookings/BookingDetailModal.tsx
git commit -m "feat: add BookingDetailModal component"
git push
```

---

### Task 10: Rewrite UserDashboard with tabs

**Files:**
- Modify: `frontend/src/pages/dashboard/UserDashboard.tsx`

- [ ] **Step 1: Replace the entire UserDashboard.tsx**

```tsx
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getMyBookings, getTeamBookings } from '../../api/booking';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { BookingCard } from '../../components/bookings/BookingCard';
import { BookingDetailModal } from '../../components/bookings/BookingDetailModal';
import type { Booking } from '../../components/bookings/types';
import { parseISO, isPast } from 'date-fns';

export function UserDashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'mine' | 'team'>('mine');
  const [myBookings, setMyBookings] = useState<Booking[]>([]);
  const [teamBookings, setTeamBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [hasTeamMemberships, setHasTeamMemberships] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [mine, team] = await Promise.all([
        getMyBookings(),
        getTeamBookings().catch(() => []),
      ]);
      setMyBookings(mine);
      setTeamBookings(team);
      setHasTeamMemberships(team.length > 0);
    } catch {
      // silently fail, empty state shown
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleNotesUpdated = (id: string, notes: string | null) => {
    const update = (list: Booking[]) => list.map((b) => b.id === id ? { ...b, internalNotes: notes } : b);
    setMyBookings(update);
    setTeamBookings(update);
    if (selectedBooking?.id === id) setSelectedBooking((prev) => prev ? { ...prev, internalNotes: notes } : prev);
  };

  const handleCancelled = (id: string) => {
    const update = (list: Booking[]) => list.map((b) => b.id === id ? { ...b, status: 'CANCELLED' } : b);
    setMyBookings(update);
    setTeamBookings(update);
  };

  if (isLoading) return <LoadingSpinner />;

  const currentBookings = activeTab === 'mine' ? myBookings : teamBookings;
  const upcoming = currentBookings.filter((b) => !isPast(parseISO(b.startTime)) && b.status === 'CONFIRMED');
  const past = currentBookings.filter((b) => isPast(parseISO(b.startTime)) || b.status !== 'CONFIRMED');

  return (
    <div>
      <h1 className="text-2xl font-bold text-[#1E293B]">Meine Termine</h1>
      <p className="mt-2 text-[#64748B]">Willkommen, {user?.name}.</p>

      {/* Tabs */}
      {hasTeamMemberships && (
        <div className="mt-4 flex gap-1 rounded-xl bg-[#F1F5F9] p-1">
          <button
            onClick={() => setActiveTab('mine')}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
              activeTab === 'mine'
                ? 'bg-white text-[#1E293B] shadow-sm'
                : 'text-[#64748B] hover:text-[#1E293B]'
            }`}
          >
            Meine Termine ({myBookings.length})
          </button>
          <button
            onClick={() => setActiveTab('team')}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
              activeTab === 'team'
                ? 'bg-white text-[#1E293B] shadow-sm'
                : 'text-[#64748B] hover:text-[#1E293B]'
            }`}
          >
            Teamtermine ({teamBookings.length})
          </button>
        </div>
      )}

      {/* Booking List */}
      {currentBookings.length === 0 ? (
        <div className="mt-6 rounded-xl border-2 border-dashed border-[#E2E8F0] bg-[#F8FAFC] p-12 text-center">
          <div className="text-4xl mb-3">📅</div>
          <h3 className="text-lg font-medium text-[#1E293B]">
            {activeTab === 'mine' ? 'Noch keine Termine' : 'Keine Teamtermine'}
          </h3>
          <p className="mt-1 text-sm text-[#64748B]">
            {activeTab === 'mine'
              ? 'Sobald Kunden Termine bei Ihnen buchen, erscheinen sie hier.'
              : 'Sobald Teamkollegen Buchungen erhalten, erscheinen sie hier.'}
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          {upcoming.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[#64748B] mb-3">
                Kommende Termine ({upcoming.length})
              </h2>
              <div className="space-y-2">
                {upcoming.map((b) => (
                  <BookingCard
                    key={b.id}
                    booking={b}
                    onClick={() => setSelectedBooking(b)}
                    showAssignee={activeTab === 'team'}
                  />
                ))}
              </div>
            </div>
          )}

          {past.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[#64748B] mb-3">
                Vergangene / Andere ({past.length})
              </h2>
              <div className="space-y-2">
                {past.map((b) => (
                  <BookingCard
                    key={b.id}
                    booking={b}
                    onClick={() => setSelectedBooking(b)}
                    showAssignee={activeTab === 'team'}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Detail Modal */}
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

- [ ] **Step 2: Verify the full component renders correctly**

```bash
cd /Users/hziech/calendfree && npm run dev
```

Open `http://localhost:5173/dashboard` and verify:
- Tab bar appears if user has team bookings
- Booking cards are clickable
- Detail modal opens with all fields
- Notes can be saved
- Cancel button works for upcoming confirmed bookings

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/dashboard/UserDashboard.tsx
git commit -m "feat: rewrite UserDashboard with tabs, clickable cards, and detail modal"
git push
```

---

## Summary of Changes

| Layer | What | Why |
|-------|------|-----|
| Schema | `internalNotes String?` on Booking | Consultants need internal notes per booking |
| Shared | `UpdateBookingNotesSchema` Zod schema | Validate notes update requests |
| Backend | Extend GET /me/bookings | Include internalNotes, teamId, formData.data |
| Backend | GET /me/bookings/team | Team members see each other's bookings |
| Backend | PATCH /me/bookings/:id/notes | Save internal notes (Zod-validated, team-aware access) |
| Backend | POST /me/bookings/:id/cancel | Authenticated cancel with calendar cleanup |
| Frontend | Modal.tsx | Reusable dialog component |
| Frontend | booking.ts additions | API client for authenticated booking endpoints |
| Frontend | BookingCard.tsx | Clickable booking card (< 60 lines) |
| Frontend | BookingDetailModal.tsx | Detail modal with notes + cancel (< 130 lines) |
| Frontend | UserDashboard.tsx rewrite | Tabs + imports card/modal components (< 110 lines) |
