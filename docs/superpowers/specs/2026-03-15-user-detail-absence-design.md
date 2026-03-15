# User Detail Page & Absence Status — Design Spec

## Goal

Add a user detail page for org/company admins with role management, absence status toggle, membership overview, upcoming bookings, and user deletion. Absent users are excluded from all team booking availability and round-robin assignment.

## Scope

1. **User Detail Page** — new route `/admin/users/:userId`
2. **Absence Status** — new `status` and `absentUntil` fields on User model
3. **Availability Filtering** — absent users excluded from slot calculation and round-robin
4. **Help Tooltips** — `(?)` icon with hover explanation on each section/action
5. **Settings Placeholder** — "Personio Abwesenheitssync" greyed-out entry

---

## 1. Schema Changes

New fields on the **User** model:

```prisma
enum UserStatus {
  AVAILABLE
  ABSENT
}

model User {
  // ... existing fields ...
  status      UserStatus @default(AVAILABLE)
  absentUntil DateTime?
}
```

Migration adds both fields with default `AVAILABLE` for existing users.

---

## 2. User Detail Page

### Route

`/admin/users/:userId` — accessible to `ORG_ADMIN` and `COMPANY_ADMIN`.

### Navigation

User names in the existing `UsersPage` become clickable links to the detail page. A "← Zurück zur Übersicht" link at the top navigates back.

### Page Sections

**Header:**
- User name (h1), email, avatar (if available)
- Status badge: green "Verfügbar" or red "Abwesend"
- Google Calendar connection status

**Status Section:**
- Toggle switch: Verfügbar / Abwesend
- When Abwesend: optional date picker "Abwesend bis"
- `(?)` tooltip on toggle: "Abwesende User werden in Team-Buchungsseiten nicht berücksichtigt (Round-Robin, Verfügbarkeit)."
- `(?)` tooltip on date field: "Optional. Wird das Datum erreicht, wechselt der Status automatisch zurück auf Verfügbar."

**Role Section:**
- Current role displayed with dropdown to change (USER / COMPANY_ADMIN / ORG_ADMIN)
- When changing to COMPANY_ADMIN: additional dropdown to select which company
- `(?)` tooltip: "ORG_ADMIN: Kann alle Firmen verwalten. COMPANY_ADMIN: Kann eine bestimmte Firma verwalten. USER: Standardrolle."

**Memberships Section:**
- List of companies the user belongs to (with role per company)
- List of teams the user belongs to (with team name)

**Upcoming Bookings Section:**
- List of upcoming confirmed bookings using existing `BookingCard` component
- Clickable → opens existing `BookingDetailModal`

**Danger Zone:**
- "User löschen" button (red, at bottom)
- Confirmation dialog before deletion
- `(?)` tooltip: "Entfernt den User und alle seine Mitgliedschaften. Bestehende Buchungen bleiben erhalten."

### Help Tooltip Component

A small reusable `HelpTooltip` component: a `(?)` circle icon that shows a tooltip on hover. Used across all sections.

```
[?]  ← 16px circle, gray, on hover shows tooltip text
```

---

## 3. Backend Endpoints

### New Endpoints

**GET /api/admin/users/:id** — Full user detail
- Returns: user fields, status, absentUntil, companyMemberships (with company name + role), teamMemberships (with team name), googleTokens connection status
- Auth: `ORG_ADMIN` or `COMPANY_ADMIN`

**PATCH /api/admin/users/:id/status** — Update absence status
- Body: `{ status: "AVAILABLE" | "ABSENT", absentUntil?: string }`
- Auth: `ORG_ADMIN` or `COMPANY_ADMIN`

**PATCH /api/admin/users/:id/role** — Update user role (existing endpoint, may need adjustment)
- Body: `{ companyId: string, role: "USER" | "COMPANY_ADMIN" | "ORG_ADMIN" }`

**GET /api/admin/users/:id/bookings** — Upcoming bookings for a user
- Returns upcoming confirmed bookings with eventType, formData, assignedUser
- Auth: `ORG_ADMIN` or `COMPANY_ADMIN`

**DELETE /api/admin/users/:id** — Delete user
- Deletes user and all memberships
- Bookings remain (assignedUser relation uses onDelete: Cascade — need to verify behavior)
- Auth: `ORG_ADMIN` only

### Modified Endpoints

**GET /api/admin/companies/:companyId/users** — Add `status` and `absentUntil` to response mapping.

---

## 4. Absence Filtering Logic

### Slot Calculation (`availability.ts`)

In `getAvailableSlots()`, before computing slots, filter out absent users:

```typescript
// Filter out absent users (check absentUntil auto-reset too)
const now = new Date();
const activeUserIds = [];
for (const uid of userIds) {
  const user = await prisma.user.findUnique({ where: { id: uid }, select: { status: true, absentUntil: true } });
  if (!user) continue;
  // Auto-reset if absentUntil has passed
  if (user.status === 'ABSENT' && user.absentUntil && user.absentUntil <= now) {
    await prisma.user.update({ where: { id: uid }, data: { status: 'AVAILABLE', absentUntil: null } });
    activeUserIds.push(uid);
  } else if (user.status === 'AVAILABLE') {
    activeUserIds.push(uid);
  }
  // ABSENT without expired absentUntil → skip
}
```

This means:
- **Team booking pages:** Absent users won't appear in available slots
- **Personal booking pages:** If the user is absent, no slots are returned (empty list)
- **Round-robin:** Only active users are passed to `assignUser()`

### Booking Creation (`booking.ts`)

The POST create booking route already calls `getAvailableSlots()` to verify the slot is still available before assigning. Since absent users are filtered there, they won't be in `matchingSlot.availableUserIds`, so they can't be assigned.

No additional changes needed in the booking route itself.

---

## 5. Settings Placeholder

On the existing Settings page (`/admin/settings`), add a greyed-out card:

```
🔗 Personio Abwesenheitssync
Automatischer Abgleich mit Personio-Abwesenheiten.
[Geplant]
```

With `(?)` tooltip: "Automatischer Abgleich mit Personio-Abwesenheiten. Geplantes Feature."

Styled as disabled/muted — no click action.

---

## 6. File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| Modify | `backend/prisma/schema.prisma` | Add `UserStatus` enum, `status`, `absentUntil` to User |
| Create | `backend/prisma/migrations/xxx/` | Auto-generated migration |
| Modify | `backend/src/routes/admin/users.ts` | New endpoints (detail, status, bookings, delete), modify list response |
| Modify | `backend/src/services/availability.ts` | Filter absent users before slot calculation |
| Create | `frontend/src/components/ui/HelpTooltip.tsx` | Reusable `(?)` tooltip component |
| Create | `frontend/src/pages/admin/UserDetailPage.tsx` | User detail page |
| Modify | `frontend/src/pages/admin/UsersPage.tsx` | Make names clickable |
| Modify | `frontend/src/pages/admin/SettingsPage.tsx` | Add Personio placeholder |
| Modify | `frontend/src/App.tsx` | Add `/admin/users/:userId` route |
| Modify | `frontend/src/api/admin.ts` | Add API functions |

---

## Out of Scope

- Personio integration (future feature, placeholder only)
- Absence calendar view
- Self-service absence (only admin can set)
- Notification when user is set to absent
