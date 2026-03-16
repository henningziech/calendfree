# Calendly-Style UI Redesign

## Context

The Calendfree UI currently uses a two-section sidebar (Admin + Mein Bereich) with emoji icons and an inline event type creation form. The user wants a more professional, Calendly-inspired UI with a flatter navigation structure, a Create dropdown with event type categories, a proper Availability page with schedules and holidays, and support for Group event types (1 host, multiple invitees per slot).

## Scope

### 1. Sidebar Restructure

**Current:** Two-section sidebar with Admin and "Mein Bereich" sections, emoji icons.

**New:** Flat Calendly-style structure with German labels.

```
[Calendfree Logo]

[+ Erstellen]          ← outlined button, opens dropdown

Terminplanung          → /dashboard/my-event-types
Termine                → /dashboard
Verfügbarkeit          → /dashboard/availability
Teams                  → /dashboard/teams

--- (spacer) ---

Analytik               → /admin/analytics        (admin only)
Admin-Bereich          → /admin                   (admin only)

--- (divider) ---
[User Avatar] Name     ← profile/logout
```

**+ Erstellen Dropdown** (appears below button on click):

| Option | Label | Description | Route Target |
|--------|-------|-------------|--------------|
| Persönlicher Planer | 1 Host → 1 Teilnehmer | Einzelgespräche, 1:1 Interviews | `/dashboard/my-event-types?create=personal` |
| Team-Planer | Rotierende Hosts → 1 Teilnehmer | Round Robin, Verteilung im Team | `/dashboard/my-event-types?create=team` |
| Gruppe | 1 Host → Mehrere Teilnehmer | Workshops, Schulungen, Webinare | `/dashboard/my-event-types?create=group` |

Clicking an option navigates to MyEventTypesPage with a query param that pre-selects the event type category and opens the creation form.

**Files to modify:**
- `frontend/src/components/layout/Sidebar.tsx` — complete rewrite of navigation structure

### 2. Availability Page Redesign

The existing `AvailabilityPage.tsx` has basic weekly schedule + booking limits. Redesign into two tabs matching Calendly's layout.

#### Tab 1: Zeitplan (Schedules)

- **Schedule selector** with "Arbeitszeiten (Standard)" dropdown (future: multiple named schedules)
- **List/Calendar toggle** (initially only List view)
- **"Active on: X event types"** indicator (counts event types where `bookableHours` is null, meaning they fall back to the user's schedule; event types with custom `bookableHours` are excluded from this count)
- **Weekly hours**: Day circles (S M D M D F S) with time ranges per day
  - Each day: toggle available/unavailable, add/remove time ranges, copy to other days
  - Default: Mo-Fr 09:00-17:00, Sa/So unavailable
- **Date-specific hours**: Placeholder section for future implementation (UI only, shows "+ Stunden" button)
- **Timezone selector** at bottom

#### Tab 2: Erweiterte Einstellungen (Advanced Settings)

- **Termin-Limits (Meeting Limits)**
  - "+ Termin-Limit hinzufügen" button
  - Options: Max per day, Max per week (uses existing maxPerDay/maxPerWeek fields)
  - The existing hardcoded 8-per-day limit in `availability.ts:152` should use the user's AvailabilityConfig instead

- **Feiertage (Holidays)**
  - Country selector dropdown (default: Deutschland)
  - List of holidays fetched from Google Calendar API (`de.german#holiday@group.v.calendar.google.com`)
  - Each holiday: name, next date, toggle on/off
  - Toggled-on holidays block availability for that date
  - Info banner: "Feiertage werden automatisch über den Google Kalender abgerufen"

**Backend: Holidays Integration**

New API endpoint: `GET /api/holidays?country=de&year=2026` (authenticated, requires logged-in user)
- Fetches public holidays from Google Calendar API using calendar ID `{country_code}.{language_code}#holiday@group.v.calendar.google.com`
- Uses the logged-in user's Google OAuth token (via existing `getAccessToken(userId)`)
- Returns: `[{ name: string, date: string (ISO), countryCode: string }]`
- Cached in Redis with key `holidays:{country}:{year}`, TTL 30 days

**Data model changes:**

```prisma
model AvailabilityConfig {
  // ... existing fields
  blockedHolidays    Json?    // Array of holiday dates where user is unavailable: ["2026-12-25", "2026-01-01"]
                              // Stored as allowlist: dates in this array BLOCK availability.
                              // When user toggles a holiday ON in the UI, the date is added here.
  holidayCountry     String?  @default("de")  // Country code for holiday calendar
}
```

**Holidays API authentication:** Use the requesting user's existing Google OAuth token (already stored via Google Workspace integration) to fetch the public holiday calendar. No additional API key needed.

**Slot generation change:** In `availability.ts`:
- Fetch each user's `AvailabilityConfig` (batch query up front, not per-user in the loop)
- Check if a slot's date falls in the user's `blockedHolidays` array → skip that slot
- Replace the hardcoded `dayBookings.length >= 8` with `AvailabilityConfig.maxPerDay` (falling back to 8 if not set)

**Files to modify:**
- `frontend/src/pages/dashboard/AvailabilityPage.tsx` — complete redesign with tabs
- `backend/src/routes/admin/users.ts` — add holidays fields to availability update
- `backend/src/services/availability.ts` — integrate holiday blocking + use AvailabilityConfig.maxPerDay instead of hardcoded 8
- `backend/src/routes/booking.ts` — new holidays endpoint
- `shared/src/schemas/admin.ts` — extend UpdateAvailabilitySchema with holiday fields
- `backend/prisma/schema.prisma` — add holiday fields to AvailabilityConfig

### 3. Group Event Type

A Group event type allows 1 host to accept multiple invitees per time slot.

**Data model changes:**

```prisma
model EventType {
  // ... existing fields
  eventCategory       EventCategory  @default(PERSONAL)
  maxInvitees          Int?           // null = unlimited, set for GROUP type
  showRemainingSpots   Boolean        @default(false)
}

enum EventCategory {
  PERSONAL    // 1 host, 1 invitee — userId must be set, teamId null
  TEAM        // rotating hosts (round robin), 1 invitee — teamId must be set
  GROUP       // 1 host, multiple invitees — userId must be set, teamId null
}
```

**Validation rules for eventCategory consistency:**
- `PERSONAL`: `userId` required, `teamId` must be null, `roundRobinMode` ignored
- `TEAM`: `teamId` required, `userId` null (assigned via round-robin), `roundRobinMode` applies
- `GROUP`: `userId` required (the host), `teamId` must be null, `maxInvitees` required (≥ 2)
- These rules are enforced in both the Zod schema and the backend route handler

**Booking logic changes:**
- When checking slot availability for GROUP event types: a slot is available until the number of CONFIRMED/PENDING_CALENDAR_SYNC bookings for that slot reaches `maxInvitees`
- The public booking page shows remaining spots if `showRemainingSpots` is true
- Multiple bookings can exist for the same (eventTypeId, startTime, endTime) — currently the system creates one booking per slot; for GROUP, it creates one booking per invitee per slot
- **Concurrency control for GROUP bookings:** Use a Prisma transaction with `SELECT FOR UPDATE` on the event type row (similar to the existing round-robin pattern in `round-robin.ts`). Inside the transaction: count existing bookings for the slot, verify count < maxInvitees, then create the booking. Retry up to 3 times on serialization failure.

**Slot endpoint changes:**
- For GROUP event types, `getAvailableSlots()` counts existing bookings per slot and only returns slots where `bookingCount < maxInvitees`
- Optionally include `remainingSpots` in the slot response if `showRemainingSpots` is true

**Frontend changes:**
- `MyEventTypesPage.tsx`: Add eventCategory field, show maxInvitees + showRemainingSpots fields when category is GROUP
- `BookingPage.tsx`: Show remaining spots badge if configured
- `SlotPicker.tsx`: Display remaining spots count per slot

**Files to modify:**
- `backend/prisma/schema.prisma` — EventCategory enum, new fields on EventType
- `shared/src/schemas/admin.ts` — extend CreateEventTypeSchema with eventCategory, maxInvitees, showRemainingSpots
- `backend/src/services/availability.ts` — group slot counting logic
- `backend/src/routes/booking.ts` — allow multiple bookings per slot for GROUP, spots endpoint
- `frontend/src/pages/dashboard/MyEventTypesPage.tsx` — category selection, group fields
- `frontend/src/pages/booking/BookingPage.tsx` — remaining spots display
- `frontend/src/components/calendar/SlotPicker.tsx` — spots count per slot

### 4. API Keys → Account Settings

Move API Keys from sidebar navigation into Account Settings as a tab.

**Implementation:**
- Create new `AccountSettingsPage.tsx` with tabs: "Profil" (existing profile data) and "API Keys" (move content from existing `ApiKeysPage.tsx`)
- Route: `/dashboard/settings` (or reuse existing profile section)
- Remove "API Keys" from sidebar, add settings access via user avatar menu

**Files to modify:**
- `frontend/src/pages/dashboard/ApiKeysPage.tsx` — extract API keys component
- `frontend/src/pages/dashboard/AccountSettingsPage.tsx` — new page with tabs
- `frontend/src/App.tsx` — update routing
- `frontend/src/components/layout/Sidebar.tsx` — remove API Keys link, add settings to user menu

## Implementation Order

1. **Sidebar restructure** — new navigation, + Erstellen dropdown
2. **Availability page redesign** — tabs, Calendly-style weekly schedule
3. **Holidays integration** — Google Calendar API, backend endpoint, slot blocking
4. **Group event type** — schema, booking logic, frontend
5. **API Keys migration** — Account Settings page

## Verification

1. **Sidebar**: All menu items navigate correctly, + Erstellen dropdown shows 3 options, admin items only visible to admins
2. **Availability**: Zeitplan tab saves/loads weekly schedule, Advanced settings tab saves limits and holiday preferences
3. **Holidays**: Endpoint returns German holidays, toggled holidays block slots in availability
4. **Group**: Can create GROUP event type with maxInvitees, multiple invitees can book same slot, remaining spots shown correctly
5. **API Keys**: Accessible via Account Settings, no longer in sidebar
6. **E2E**: Create a group event type → book as 2 different customers → verify slot fills up → verify slot disappears when full
