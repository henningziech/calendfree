# Team Detail Page & Demo Data — Design Spec

## Goal

Add a dedicated team detail page at `/dashboard/teams/:teamId` showing the team's event types and paginated bookings with filters. Additionally, seed the database with demo data (2 teams, 5 users).

## Scope

Two independent deliverables:
1. **Team Detail Page** — new route, backend endpoint, frontend page
2. **Demo Data Seed** — Prisma seed script for development/testing

---

## 1. Team Detail Page

### Route

`/dashboard/teams/:teamId` — new route in `App.tsx`, accessible to all authenticated users who are members of the team.

### Navigation

The existing team cards in `MyTeamsPage` become clickable. Clicking a team navigates to its detail page via React Router. A "← Zurück zur Übersicht" link at the top of the detail page navigates back.

### Page Layout (TeamDetailPage)

**Header Section:**
- Team name (h1)
- Round-Robin mode badge (SEQUENTIAL / LEAST_BUSY / WEIGHTED)
- Member chips (name pills, showing weight for WEIGHTED mode)
- "Team verlassen" button (if member)

**Event Types Section:**
- Section heading "Buchungsseiten"
- Cards for each EventType belonging to this team
- Each card shows: title, duration, active/inactive badge, booking URL with copy button
- Empty state if no event types exist for the team

**Bookings Section:**
- Section heading "Gebuchte Termine"
- **Filters (inline, above the list):**
  - Toggle/Checkbox "Auch vergangene anzeigen" — default OFF (only upcoming shown)
  - Dropdown "Teammitglied" — options: "Alle" (default) + each team member by name
- Paginated booking list (15 per page)
- Each booking rendered using the existing `BookingCard` component (from `components/bookings/BookingCard.tsx`)
- Clicking a booking opens the existing `BookingDetailModal`
- **Pagination bar** below the list: "Seite X von Y", Previous/Next buttons
- Empty state when no bookings match the filters

### Backend Endpoint

```
GET /api/admin/teams/:id/bookings
```

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | number | 1 | Page number (1-based) |
| `limit` | number | 15 | Items per page (max 50) |
| `status` | string | `upcoming` | `upcoming` (startTime > now, CONFIRMED) or `all` |
| `userId` | string | — | Filter by assigned user ID |

**Response:**
```json
{
  "bookings": [
    {
      "id": "...",
      "startTime": "...",
      "endTime": "...",
      "status": "CONFIRMED",
      "internalNotes": null,
      "bookingToken": "...",
      "calendarEventId": null,
      "eventType": { "title": "...", "slug": "...", "duration": 30, "teamId": "...", "team": { "name": "..." }, "company": { "slug": "..." } },
      "formData": { "name": "...", "email": "...", "data": {} },
      "assignedUser": { "name": "...", "email": "..." }
    }
  ],
  "total": 42,
  "page": 1,
  "totalPages": 3
}
```

**Access Control:** Requires `requireAuth`. Verifies the requesting user is a member of the team via `TeamMembership` lookup. Returns 403 if not a member.

**Location:** Add to `backend/src/routes/admin/teams.ts` alongside existing team routes.

### Existing Team Detail Endpoint

`GET /api/admin/teams/:id` already exists and returns team details with members, event types count, and round-robin config. The new bookings endpoint complements it — the frontend fetches both in parallel.

### Frontend API Functions

Add to `frontend/src/api/admin.ts`:
- `getTeamDetail(teamId)` — calls existing `GET /api/admin/teams/:id`
- `getTeamBookings(teamId, params)` — calls new bookings endpoint

### File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `frontend/src/pages/dashboard/TeamDetailPage.tsx` | Team detail page component |
| Modify | `frontend/src/pages/dashboard/MyTeamsPage.tsx` | Make team cards clickable (Link) |
| Modify | `frontend/src/App.tsx` | Add `/dashboard/teams/:teamId` route |
| Modify | `frontend/src/api/admin.ts` | Add `getTeamDetail`, `getTeamBookings` |
| Modify | `backend/src/routes/admin/teams.ts` | Add `GET /api/admin/teams/:id/bookings` |

---

## 2. Demo Data Seed Script

### Purpose

Populate the database with realistic test data for development and demo purposes.

### Data to Create

**Company:** Uses existing "Seibert Group GmbH" (looked up by slug `seibert-group-gmbh`). If not found, creates it.

**5 Users** (with CompanyMembership):
| Name | Email | Role |
|------|-------|------|
| Anna Schmidt | anna.schmidt@seibert.group | USER |
| Ben Weber | ben.weber@seibert.group | USER |
| Clara Fischer | clara.fischer@seibert.group | USER |
| David Müller | david.mueller@seibert.group | USER |
| Eva Braun | eva.braun@seibert.group | USER |

**Team 1: "AppCare Support"**
- Members: Anna, Ben, Clara (3 members)
- Round-Robin: SEQUENTIAL
- EventType: "AppCare Beratungstermin" (30 min, active)

**Team 2: "Sales Engineering"**
- Members: David, Eva (2 members)
- Round-Robin: LEAST_BUSY
- EventType: "Sales Demo" (45 min, active)

**Test Bookings** (5-8 bookings spread across both teams):
- Mix of upcoming and past dates
- Mix of statuses (CONFIRMED, CANCELLED, COMPLETED)
- Realistic customer names and emails

### Implementation

Prisma seed script at `backend/prisma/seed.ts`, registered in `package.json` under `prisma.seed`. Idempotent — uses `upsert` where possible so it can be re-run safely.

Run with: `npx prisma db seed`

### File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `backend/prisma/seed.ts` | Seed script |
| Modify | `backend/package.json` | Add `prisma.seed` config |

---

## Out of Scope

- Editing team settings from the detail page (already exists in team list)
- Creating new event types from the team detail page
- Reschedule functionality (not yet built)
- Real Google Calendar events for demo bookings (seed data only, no calendar sync)
