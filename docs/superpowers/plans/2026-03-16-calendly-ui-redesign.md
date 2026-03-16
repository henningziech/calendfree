# Calendly-Style UI Redesign — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the Calendfree UI to match Calendly's navigation, add an Availability page with holidays, support Group event types, and move API Keys to Account Settings.

**Architecture:** Incremental approach — 5 independent tasks that build on each other. Each produces a committable, testable state. Frontend-heavy changes with targeted backend additions for holidays API and Group booking logic.

**Tech Stack:** React 19, React Router, Tailwind CSS, Fastify 5, Prisma ORM, PostgreSQL, Redis, Google Calendar API, Zod

**Spec:** `docs/superpowers/specs/2026-03-16-calendly-ui-redesign.md`

---

## Chunk 1: Sidebar + Create Dropdown

### Task 1: Rewrite Sidebar Component

**Files:**
- Modify: `frontend/src/components/layout/Sidebar.tsx`

- [ ] **Step 1: Rewrite Sidebar.tsx with new Calendly-style structure**

Replace the entire Sidebar component. The new structure:
- Logo header with "Calendfree" text
- `+ Erstellen` outlined button that toggles a dropdown
- Flat nav items: Terminplanung, Termine, Verfügbarkeit, Teams
- Bottom section (admin-only): Analytik, Admin-Bereich
- User footer with avatar, name, settings gear icon, logout

```tsx
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
```

- [ ] **Step 2: Verify sidebar renders correctly**

Run: `npm run dev -w frontend`
Open http://localhost:5174 and verify:
- Logo + Calendfree title shows
- "+ Erstellen" button is visible
- Clicking it shows dropdown with 3 options
- Main nav items link correctly
- Admin items only visible for admin users
- Clicking a create option navigates to `/dashboard/my-event-types?create=<key>`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/layout/Sidebar.tsx
git commit -m "feat: restructure sidebar to Calendly-style flat navigation"
git push
```

---

## Chunk 2: Availability Page Redesign

### Task 2: Extend Prisma Schema for Holidays

**Files:**
- Modify: `backend/prisma/schema.prisma` (lines 335-346, AvailabilityConfig model)

- [ ] **Step 1: Add holiday fields to AvailabilityConfig**

Add two new fields after `maxPerWeek`:

```prisma
model AvailabilityConfig {
  id     String @id @default(uuid())
  userId String @unique
  /// Weekly schedule as JSON: { "monday": [{"start": "09:00", "end": "17:00"}], ... }
  weeklySchedule Json @default("{\"monday\":[{\"start\":\"09:00\",\"end\":\"17:00\"}],\"tuesday\":[{\"start\":\"09:00\",\"end\":\"17:00\"}],\"wednesday\":[{\"start\":\"09:00\",\"end\":\"17:00\"}],\"thursday\":[{\"start\":\"09:00\",\"end\":\"17:00\"}],\"friday\":[{\"start\":\"09:00\",\"end\":\"17:00\"}]}")
  /// Max bookings per day
  maxPerDay  Int? @default(8)
  /// Max bookings per week
  maxPerWeek Int? @default(30)
  /// Array of holiday date strings (ISO) that block availability: ["2026-12-25", "2027-01-01"]
  blockedHolidays Json?
  /// Country code for holiday calendar (e.g. "de" for Germany)
  holidayCountry  String? @default("de")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

- [ ] **Step 2: Run migration**

```bash
npm run db:migrate -- --name add_holiday_fields
npm run db:generate
```

- [ ] **Step 3: Commit**

```bash
git add backend/prisma/
git commit -m "feat: add blockedHolidays and holidayCountry to AvailabilityConfig"
git push
```

### Task 3: Extend Zod Schema for Availability

**Files:**
- Modify: `shared/src/schemas/admin.ts` (lines 87-96, UpdateAvailabilitySchema)

- [ ] **Step 1: Add holiday fields to UpdateAvailabilitySchema**

Replace the UpdateAvailabilitySchema (lines 88-96):

```typescript
export const UpdateAvailabilitySchema = z.object({
  weeklySchedule: z.record(z.array(z.object({
    start: z.string().regex(/^\d{2}:\d{2}$/),
    end: z.string().regex(/^\d{2}:\d{2}$/),
  }))).optional(),
  maxPerDay: z.number().int().min(1).max(50).nullable().optional(),
  maxPerWeek: z.number().int().min(1).max(200).nullable().optional(),
  blockedHolidays: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).nullable().optional(),
  holidayCountry: z.string().min(2).max(5).nullable().optional(),
});
```

- [ ] **Step 2: Commit**

```bash
git add shared/src/schemas/admin.ts
git commit -m "feat: extend UpdateAvailabilitySchema with holiday fields"
git push
```

### Task 4: Add Holidays API Endpoint

**Files:**
- Create: `backend/src/routes/holidays.ts`
- Modify: `backend/src/app.ts` (register route)

- [ ] **Step 0: Export getAccessToken from calendar.ts**

In `backend/src/services/calendar.ts`, line 12, add `export` keyword:

```typescript
// Change from:
async function getAccessToken(userId: string): Promise<string> {
// To:
export async function getAccessToken(userId: string): Promise<string> {
```

- [ ] **Step 1: Create holidays route**

Create `backend/src/routes/holidays.ts`:

```typescript
// backend/src/routes/holidays.ts
import type { FastifyInstance } from 'fastify';
import { getAccessToken } from '../services/calendar.js';
import { redis } from '../redis.js';

interface HolidayEvent {
  name: string;
  date: string;
  countryCode: string;
}

const COUNTRY_CALENDAR_MAP: Record<string, string> = {
  de: 'de.german',
  at: 'de.austrian',
  ch: 'de.ch',
  us: 'en.usa',
  gb: 'en.uk',
};

/**
 * Fetch public holidays from Google Calendar for a given country and year.
 */
export async function holidayRoutes(app: FastifyInstance) {
  app.get('/api/holidays', async (request, reply) => {
    const userId = (request as any).session?.userId;
    if (!userId) return reply.status(401).send({ error: 'Unauthorized' });

    const { country = 'de', year } = request.query as { country?: string; year?: string };
    const targetYear = year ? parseInt(year, 10) : new Date().getFullYear();

    if (isNaN(targetYear) || targetYear < 2020 || targetYear > 2100) {
      return reply.status(400).send({ error: 'Invalid year' });
    }

    const cacheKey = `holidays:${country}:${targetYear}`;

    // Check Redis cache first
    const cached = await redis.get(cacheKey);
    if (cached) {
      return reply.send(JSON.parse(cached));
    }

    const calendarPrefix = COUNTRY_CALENDAR_MAP[country];
    if (!calendarPrefix) {
      return reply.status(400).send({ error: `Unsupported country: ${country}` });
    }

    const calendarId = `${calendarPrefix}%23holiday%40group.v.calendar.google.com`;
    const timeMin = `${targetYear}-01-01T00:00:00Z`;
    const timeMax = `${targetYear}-12-31T23:59:59Z`;

    try {
      const accessToken = await getAccessToken(userId);
      const url = `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime&maxResults=50`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!res.ok) {
        const body = await res.text();
        app.log.error(`Google Calendar holidays fetch failed: ${res.status} ${body}`);
        return reply.status(502).send({ error: 'Failed to fetch holidays from Google Calendar' });
      }

      const data = await res.json() as { items?: Array<{ summary: string; start: { date?: string; dateTime?: string } }> };
      const holidays: HolidayEvent[] = (data.items ?? [])
        .filter((item) => item.start?.date) // All-day events only
        .map((item) => ({
          name: item.summary,
          date: item.start.date!,
          countryCode: country,
        }));

      // Cache for 30 days
      await redis.set(cacheKey, JSON.stringify(holidays), 'EX', 30 * 24 * 60 * 60);

      return reply.send(holidays);
    } catch (err: any) {
      app.log.error(`Holiday fetch error: ${err.message}`);
      return reply.status(500).send({ error: 'Failed to fetch holidays' });
    }
  });
}
```

- [ ] **Step 2: Register route in app.ts**

Add to `backend/src/app.ts` alongside other route registrations:

```typescript
import { holidayRoutes } from './routes/holidays.js';
// ... in the app setup:
app.register(holidayRoutes);
```

- [ ] **Step 3: Add frontend API function**

Add to `frontend/src/api/admin.ts`:

```typescript
export async function getHolidays(country: string = 'de', year?: number): Promise<Array<{ name: string; date: string; countryCode: string }>> {
  const params = new URLSearchParams({ country });
  if (year) params.set('year', String(year));
  const res = await fetch(`/api/holidays?${params}`, { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to fetch holidays');
  return res.json();
}
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/routes/holidays.ts backend/src/app.ts frontend/src/api/admin.ts
git commit -m "feat: add holidays API endpoint with Google Calendar integration"
git push
```

**Note on Task 5 (removed):** The backend availability route (`PATCH /api/me/availability`) uses `...body` spread in its Prisma upsert. Since the Zod schema (Task 3) and Prisma schema (Task 2) both include the new fields, the route handler automatically accepts and persists `blockedHolidays` and `holidayCountry` — no code changes needed.

### Task 5: Rewrite Availability Page with Tabs

**Files:**
- Modify: `frontend/src/pages/dashboard/AvailabilityPage.tsx` (complete rewrite)

- [ ] **Step 1: Rewrite AvailabilityPage.tsx**

Replace the entire file with the new two-tab design. Key structure:

```tsx
import { useState, useEffect } from 'react';
import { getMyProfile, updateMyAvailability, updateMyTimezone, getHolidays } from '../../api/admin';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ErrorMessage } from '../../components/ui/ErrorMessage';

const DAYS = [
  { key: 'sunday', label: 'S', fullLabel: 'Sonntag' },
  { key: 'monday', label: 'M', fullLabel: 'Montag' },
  { key: 'tuesday', label: 'D', fullLabel: 'Dienstag' },
  { key: 'wednesday', label: 'M', fullLabel: 'Mittwoch' },
  { key: 'thursday', label: 'D', fullLabel: 'Donnerstag' },
  { key: 'friday', label: 'F', fullLabel: 'Freitag' },
  { key: 'saturday', label: 'S', fullLabel: 'Samstag' },
];

const TIMEZONES = [
  { value: 'Europe/Berlin', label: 'Mitteleuropäische Zeit' },
  { value: 'Europe/London', label: 'Westeuropäische Zeit' },
  { value: 'America/New_York', label: 'Eastern Time' },
  { value: 'America/Los_Angeles', label: 'Pacific Time' },
  { value: 'Asia/Tokyo', label: 'Japan Standard Time' },
];

export function AvailabilityPage() {
  const [activeTab, setActiveTab] = useState<'schedules' | 'advanced'>('schedules');
  const [profile, setProfile] = useState<any>(null);
  const [holidays, setHolidays] = useState<Array<{ name: string; date: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setIsLoading(true);
    try {
      const [profileData, holidayData] = await Promise.all([
        getMyProfile(),
        getHolidays('de', new Date().getFullYear()),
      ]);
      setProfile(profileData);
      setHolidays(holidayData);
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
        blockedHolidays: profile.availability.blockedHolidays ?? [],
        holidayCountry: profile.availability.holidayCountry ?? 'de',
      });
      await updateMyTimezone(profile.timezone);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // ... schedule state helpers (update weekly schedule, toggle day, add/remove time range, copy day)

  if (isLoading) return <LoadingSpinner />;
  if (!profile) return <ErrorMessage message="Profil konnte nicht geladen werden" onRetry={load} />;

  const schedule = profile.availability?.weeklySchedule ?? {};
  const blockedHolidays: string[] = profile.availability?.blockedHolidays ?? [];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#1E293B]">Verfügbarkeit</h1>
        <button onClick={handleSave} disabled={isSaving}
          className="rounded-xl bg-gradient-to-r from-[#0B8ECA] to-[#14B8A6] px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:shadow-md disabled:opacity-50">
          {isSaving ? 'Speichern...' : 'Speichern'}
        </button>
      </div>

      {/* Tabs */}
      <div className="mt-4 flex gap-6 border-b-2 border-[#E2E8F0]">
        <button
          onClick={() => setActiveTab('schedules')}
          className={`pb-3 text-sm font-medium transition-colors ${
            activeTab === 'schedules'
              ? 'border-b-2 border-[#0B8ECA] text-[#0B8ECA] -mb-[2px]'
              : 'text-[#64748B] hover:text-[#1E293B]'
          }`}
        >Zeitplan</button>
        <button
          onClick={() => setActiveTab('advanced')}
          className={`pb-3 text-sm font-medium transition-colors ${
            activeTab === 'advanced'
              ? 'border-b-2 border-[#0B8ECA] text-[#0B8ECA] -mb-[2px]'
              : 'text-[#64748B] hover:text-[#1E293B]'
          }`}
        >Erweiterte Einstellungen</button>
      </div>

      {error && <ErrorMessage message={error} />}

      {/* Tab content */}
      {activeTab === 'schedules' ? (
        <SchedulesTab
          schedule={schedule}
          timezone={profile.timezone}
          onScheduleChange={(newSchedule) => setProfile({
            ...profile,
            availability: { ...profile.availability, weeklySchedule: newSchedule },
          })}
          onTimezoneChange={(tz) => setProfile({ ...profile, timezone: tz })}
        />
      ) : (
        <AdvancedSettingsTab
          maxPerDay={profile.availability?.maxPerDay}
          maxPerWeek={profile.availability?.maxPerWeek}
          blockedHolidays={blockedHolidays}
          holidays={holidays}
          onMaxPerDayChange={(v) => setProfile({
            ...profile,
            availability: { ...profile.availability, maxPerDay: v },
          })}
          onMaxPerWeekChange={(v) => setProfile({
            ...profile,
            availability: { ...profile.availability, maxPerWeek: v },
          })}
          onBlockedHolidaysChange={(bh) => setProfile({
            ...profile,
            availability: { ...profile.availability, blockedHolidays: bh },
          })}
        />
      )}
    </div>
  );
}
```

The `SchedulesTab` component renders the Calendly-style day circles with time ranges per day (add/remove/copy). Each day shows a colored circle (blue for unavailable, active color for available), time inputs, X to remove, + to add another time range, and copy icon to copy to other days.

The `AdvancedSettingsTab` component renders Meeting Limits (expandable section with max per day/week inputs) and Holidays (country selector, list of holidays with toggle switches, info banner about Google Calendar source).

- [ ] **Step 2: Verify the page**

Open http://localhost:5174/dashboard/availability and verify:
- Two tabs show ("Zeitplan" and "Erweiterte Einstellungen")
- Zeitplan tab: day circles render, can toggle days on/off, time inputs work, copy button works
- Advanced tab: meeting limits show, holidays load from API, toggles work
- Save button persists changes

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/dashboard/AvailabilityPage.tsx
git commit -m "feat: redesign Availability page with Calendly-style tabs"
git push
```

---

## Chunk 3: Integrate Holidays in Slot Generation

### Task 6: Update Availability Service for Holidays + Configurable Limits

**Files:**
- Modify: `backend/src/services/availability.ts` (lines 50-216)

- [ ] **Step 1: Batch-fetch AvailabilityConfig at start of getAvailableSlots**

After fetching `usersWithStatus` (line 56-59), add a batch query for AvailabilityConfig:

```typescript
// After line 74 (after activeUserIds is populated):
const availabilityConfigs = await prisma.availabilityConfig.findMany({
  where: { userId: { in: activeUserIds } },
});
const configByUser = new Map(availabilityConfigs.map((c) => [c.userId, c]));
```

- [ ] **Step 2: Replace hardcoded daily limit with configurable value**

Replace line 152 (`if (dayBookings.length >= 8) continue;`):

```typescript
const userConfig = configByUser.get(userId);
const maxPerDay = userConfig?.maxPerDay ?? 8;
if (dayBookings.length >= maxPerDay) continue;
```

- [ ] **Step 3: Add holiday blocking check**

After the daily limit check (after the line from step 2), add:

```typescript
// Check if this day is a blocked holiday for this user
const blockedHolidays = (userConfig?.blockedHolidays as string[] | null) ?? [];
const dayInTz = toZonedTime(day, bookableHoursTz);
const dayDateStr = `${dayInTz.getFullYear()}-${String(dayInTz.getMonth() + 1).padStart(2, '0')}-${String(dayInTz.getDate()).padStart(2, '0')}`;
if (blockedHolidays.includes(dayDateStr)) continue;
```

Note: put this BEFORE the `for (const window of dayWindows)` loop so we skip the entire day.

- [ ] **Step 4: Verify slot generation respects holidays**

Test by:
1. Set a blocked holiday for today via API
2. Query slots for today
3. Verify the day returns no slots

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/availability.ts
git commit -m "feat: integrate holiday blocking and configurable daily limits in slot generation"
git push
```

---

## Chunk 4: Group Event Type

### Task 7: Extend Prisma Schema for Group Events

**Files:**
- Modify: `backend/prisma/schema.prisma`

- [ ] **Step 1: Add EventCategory enum and group fields to EventType**

Add after the existing `RoundRobinMode` enum:

```prisma
enum EventCategory {
  PERSONAL
  TEAM
  GROUP
}
```

Add to the EventType model (after `allowComment` field, line 238):

```prisma
  /// Event category: PERSONAL (1:1), TEAM (round-robin), GROUP (1 host, many invitees)
  eventCategory    EventCategory @default(PERSONAL)
  /// Max invitees per slot (GROUP event types only)
  maxInvitees      Int?
  /// Show remaining spots on public booking page
  showRemainingSpots Boolean @default(false)
```

- [ ] **Step 2: Run migration**

```bash
npm run db:migrate -- --name add_event_category_and_group_fields
npm run db:generate
```

- [ ] **Step 3: Commit**

```bash
git add backend/prisma/
git commit -m "feat: add EventCategory enum and group fields to EventType schema"
git push
```

### Task 8: Extend Zod Schema for Group Events + Validation Rules

**Files:**
- Modify: `shared/src/schemas/admin.ts` (CreateEventTypeSchema, lines 56-81)

- [ ] **Step 1: Add group fields to CreateEventTypeSchema**

Add after the `allowComment` field (line 74):

```typescript
  eventCategory: z.enum(['PERSONAL', 'TEAM', 'GROUP']).default('PERSONAL'),
  maxInvitees: z.number().int().min(2).max(1000).nullable().optional(),
  showRemainingSpots: z.boolean().default(false),
```

Also update the `UpdateEventTypeSchema` (line 84) to include the new fields — since it's `CreateEventTypeSchema.partial().omit(...)`, they'll automatically be included.

- [ ] **Step 2: Add validation superRefine for eventCategory consistency**

Add after `CreateEventTypeSchema` definition:

```typescript
export const CreateEventTypeSchema = z.object({
  // ... existing + new fields
}).superRefine((data, ctx) => {
  if (data.eventCategory === 'GROUP' && (data.maxInvitees === null || data.maxInvitees === undefined)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'maxInvitees is required for GROUP event types (min 2)',
      path: ['maxInvitees'],
    });
  }
  if (data.eventCategory === 'GROUP' && data.teamId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'GROUP event types cannot have a teamId',
      path: ['teamId'],
    });
  }
  if (data.eventCategory === 'TEAM' && !data.teamId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'TEAM event types require a teamId',
      path: ['teamId'],
    });
  }
});
```

- [ ] **Step 3: Update backend event-types route to persist new fields**

In `backend/src/routes/admin/event-types.ts`, the POST handler creates event types via `prisma.eventType.create()`. Add `eventCategory`, `maxInvitees`, `showRemainingSpots` to the `data` object from the parsed body.

- [ ] **Step 4: Commit**

```bash
git add shared/src/schemas/admin.ts backend/src/routes/admin/event-types.ts
git commit -m "feat: extend CreateEventTypeSchema with eventCategory, group fields, and validation"
git push
```

### Task 9: Update Slot Generation for Group Events

**Files:**
- Modify: `backend/src/services/availability.ts`

- [ ] **Step 1: Modify getAvailableSlots to support GROUP event types**

After fetching the eventType (line 76-78), add group booking count logic:

```typescript
const isGroup = eventType.eventCategory === 'GROUP';
const maxInvitees = eventType.maxInvitees;

// For GROUP events, fetch all bookings for this event type in the range
// (not per-user, since multiple invitees share a slot)
let groupBookingCounts: Map<string, number> | undefined;
if (isGroup) {
  const groupBookings = await prisma.booking.findMany({
    where: {
      eventTypeId: eventTypeId,
      status: { in: ['CONFIRMED', 'PENDING_CALENDAR_SYNC'] },
      startTime: { gte: effectiveStart },
      endTime: { lte: effectiveEnd },
    },
    select: { startTime: true },
  });
  groupBookingCounts = new Map();
  for (const b of groupBookings) {
    const key = b.startTime.toISOString();
    groupBookingCounts.set(key, (groupBookingCounts.get(key) ?? 0) + 1);
  }
}
```

Then, in the slot generation loop, after determining a slot is available (line 197, `if (!isGcalBusy && !isBooked)`), add:

```typescript
if (!isGcalBusy && !isBooked) {
  // For GROUP events, check if slot is full
  if (isGroup && maxInvitees && groupBookingCounts) {
    const count = groupBookingCounts.get(slotStart.toISOString()) ?? 0;
    if (count >= maxInvitees) {
      slotStart = addMinutes(slotStart, duration);
      continue;
    }
  }
  // ... existing slot push logic
}
```

- [ ] **Step 2: Add remainingSpots to slot response**

Extend the Slot interface:

```typescript
interface Slot {
  start: Date;
  end: Date;
  availableUserIds: string[];
  remainingSpots?: number;
}
```

When pushing a GROUP slot, add the remaining count:

```typescript
if (isGroup && maxInvitees && groupBookingCounts) {
  const count = groupBookingCounts.get(slotStart.toISOString()) ?? 0;
  newSlot.remainingSpots = maxInvitees - count;
}
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/services/availability.ts
git commit -m "feat: support GROUP event types in slot generation with remaining spots"
git push
```

### Task 10: Update Booking Route for Group Events

**Files:**
- Modify: `backend/src/routes/booking.ts`

- [ ] **Step 1: Allow multiple bookings per slot for GROUP events**

In the POST booking handler, add concurrency control for GROUP events. After finding the event type, before creating the booking:

```typescript
if (eventType.eventCategory === 'GROUP') {
  // Use transaction with serializable isolation to prevent overbooking
  const maxInvitees = eventType.maxInvitees!;

  const booking = await prisma.$transaction(async (tx) => {
    // Count existing bookings for this exact slot
    const existingCount = await tx.booking.count({
      where: {
        eventTypeId: eventType.id,
        startTime: new Date(startTime),
        status: { in: ['CONFIRMED', 'PENDING_CALENDAR_SYNC'] },
      },
    });

    if (maxInvitees && existingCount >= maxInvitees) {
      throw new Error('SLOT_FULL');
    }

    // Create booking assigned to the event type's userId (the host)
    return tx.booking.create({
      data: {
        eventTypeId: eventType.id,
        assignedUserId: eventType.userId!,
        startTime: new Date(startTime),
        endTime: addMinutes(new Date(startTime), eventType.duration),
        customerTimezone: timezone,
        bookingToken: randomBytes(32).toString('hex'),
        tokenExpiresAt: addMinutes(new Date(), 60 * 24 * 7),
        // ... other fields (formData, internalNotes, etc.)
      },
    });
  }, {
    isolationLevel: 'Serializable',
    maxWait: 5000,
    timeout: 10000,
  });
}
```

Handle the `SLOT_FULL` error by returning 409 Conflict.

- [ ] **Step 2: Include remainingSpots in slot endpoint response**

In the GET slots handler, pass through the `remainingSpots` field and include `showRemainingSpots` flag:

```typescript
const slots = await getAvailableSlots(params);
return reply.send({
  slots: slots.map((s) => ({
    start: s.start.toISOString(),
    end: s.end.toISOString(),
    ...(eventType.showRemainingSpots && s.remainingSpots !== undefined
      ? { remainingSpots: s.remainingSpots }
      : {}),
  })),
});
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/routes/booking.ts
git commit -m "feat: support GROUP event type bookings with concurrency control"
git push
```

### Task 11: Update MyEventTypesPage for Group Events

**Files:**
- Modify: `frontend/src/pages/dashboard/MyEventTypesPage.tsx`

- [ ] **Step 1: Read the `create` query param and pre-select event category**

At the top of the component, read the URL param:

```typescript
import { useSearchParams } from 'react-router';

// Inside the component:
const [searchParams, setSearchParams] = useSearchParams();
const createParam = searchParams.get('create');

// When createParam changes, open create form with pre-selected category:
useEffect(() => {
  if (createParam) {
    setIsCreating(true);
    setForm((prev) => ({
      ...prev,
      eventCategory: createParam.toUpperCase() as 'PERSONAL' | 'TEAM' | 'GROUP',
      teamId: createParam === 'team' ? '' : null,
    }));
    // Clear the query param to avoid re-triggering
    setSearchParams({}, { replace: true });
  }
}, [createParam]);
```

- [ ] **Step 2: Add eventCategory, maxInvitees, showRemainingSpots to the form state and UI**

In the create/edit form, add an `eventCategory` selector (shown as read-only label since it's pre-set from the create dropdown) and conditionally show GROUP-specific fields:

```tsx
{/* Event Category indicator */}
<div className="mb-4 rounded-lg bg-[#F8FAFC] px-3 py-2 text-sm text-[#64748B]">
  {form.eventCategory === 'PERSONAL' && 'Persönlicher Planer — 1 Host → 1 Teilnehmer'}
  {form.eventCategory === 'TEAM' && 'Team-Planer — Rotierende Hosts → 1 Teilnehmer'}
  {form.eventCategory === 'GROUP' && 'Gruppe — 1 Host → Mehrere Teilnehmer'}
</div>

{/* GROUP-specific fields */}
{form.eventCategory === 'GROUP' && (
  <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-sm">
    <h4 className="font-semibold text-[#1E293B]">Teilnehmer-Limit</h4>
    <p className="text-sm text-[#64748B]">Max. Teilnehmer pro Termin</p>
    <input
      type="number"
      value={form.maxInvitees ?? 2}
      onChange={(e) => setForm({ ...form, maxInvitees: +e.target.value || 2 })}
      min={2} max={1000}
      className="mt-2 w-24 rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm"
    />
    <label className="mt-3 flex items-center gap-2">
      <input
        type="checkbox"
        checked={form.showRemainingSpots ?? false}
        onChange={(e) => setForm({ ...form, showRemainingSpots: e.target.checked })}
      />
      <span className="text-sm text-[#64748B]">Verbleibende Plätze auf Buchungsseite anzeigen</span>
    </label>
  </div>
)}
```

- [ ] **Step 3: Send new fields in create/update API calls**

Include `eventCategory`, `maxInvitees`, `showRemainingSpots` in the payload sent to `createEventType()` and `updateEventType()`.

- [ ] **Step 4: Verify**

1. Click "+ Erstellen" → "Gruppe" in sidebar
2. Verify redirected to event types page with group form pre-selected
3. Verify maxInvitees and showRemainingSpots fields appear
4. Create a group event type with maxInvitees=3
5. Visit the public booking page and verify slots show remaining spots

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/dashboard/MyEventTypesPage.tsx
git commit -m "feat: add GROUP event type support to MyEventTypesPage"
git push
```

### Task 12: Display Remaining Spots on Public Booking Page

**Files:**
- Modify: `frontend/src/pages/booking/BookingPage.tsx`
- Modify: `frontend/src/components/calendar/SlotPicker.tsx`

- [ ] **Step 1: Pass remainingSpots through to SlotPicker**

In `BookingPage.tsx`, the slots response from the API is passed to `SlotPicker`. After Task 10 Step 2, the API may include `remainingSpots` per slot. Pass this through to the SlotPicker component.

- [ ] **Step 2: Display remaining spots badge in SlotPicker**

In `SlotPicker.tsx`, for each slot button, conditionally show a remaining spots badge:

```tsx
{slot.remainingSpots !== undefined && (
  <span className="ml-2 rounded-full bg-[#FEF3C7] px-2 py-0.5 text-xs font-medium text-[#92400E]">
    {slot.remainingSpots} {slot.remainingSpots === 1 ? 'Platz' : 'Plätze'} frei
  </span>
)}
```

- [ ] **Step 3: Verify**

1. Create a GROUP event type with `showRemainingSpots: true` and `maxInvitees: 5`
2. Visit the public booking page
3. Verify slots show "5 Plätze frei" badge
4. Book one slot, refresh, verify badge shows "4 Plätze frei"

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/booking/BookingPage.tsx frontend/src/components/calendar/SlotPicker.tsx
git commit -m "feat: display remaining spots on public booking page for GROUP events"
git push
```

---

## Chunk 5: Account Settings + API Keys Migration

### Task 13: Create Account Settings Page

**Files:**
- Create: `frontend/src/pages/dashboard/AccountSettingsPage.tsx`
- Modify: `frontend/src/App.tsx` (add route)

- [ ] **Step 1: Create AccountSettingsPage.tsx**

Two-tab page: "Profil" (user info from getMyProfile) and "API Keys" (content extracted from ApiKeysPage).

```tsx
import { useState } from 'react';
import { ApiKeysTab } from './ApiKeysPage';

export function AccountSettingsPage() {
  const [activeTab, setActiveTab] = useState<'profile' | 'apikeys'>('profile');

  return (
    <div>
      <h1 className="text-2xl font-bold text-[#1E293B]">Einstellungen</h1>

      <div className="mt-4 flex gap-6 border-b-2 border-[#E2E8F0]">
        <button
          onClick={() => setActiveTab('profile')}
          className={`pb-3 text-sm font-medium transition-colors ${
            activeTab === 'profile'
              ? 'border-b-2 border-[#0B8ECA] text-[#0B8ECA] -mb-[2px]'
              : 'text-[#64748B] hover:text-[#1E293B]'
          }`}
        >Profil</button>
        <button
          onClick={() => setActiveTab('apikeys')}
          className={`pb-3 text-sm font-medium transition-colors ${
            activeTab === 'apikeys'
              ? 'border-b-2 border-[#0B8ECA] text-[#0B8ECA] -mb-[2px]'
              : 'text-[#64748B] hover:text-[#1E293B]'
          }`}
        >API Keys</button>
      </div>

      <div className="mt-6">
        {activeTab === 'profile' ? <ProfileTab /> : <ApiKeysTab />}
      </div>
    </div>
  );
}

function ProfileTab() {
  // Display user name, email, avatar, timezone from getMyProfile()
  // Read-only for now (Google-managed fields)
  return <div>/* ... profile display ... */</div>;
}
```

- [ ] **Step 2: Refactor ApiKeysPage to export a reusable tab component**

In `ApiKeysPage.tsx`, rename the main component to `ApiKeysTab` and export it. Add a wrapper `ApiKeysPage` that redirects to `/dashboard/settings?tab=apikeys` for backwards compatibility:

```tsx
// Export the inner content as a tab (remove the <h1> heading and intro <p> since
// the parent AccountSettingsPage provides the page context)
export function ApiKeysTab() {
  // ... existing ApiKeysPage content without <h1> and page-level wrapper
}

// Keep the page for backwards compatibility (redirect to settings)
export function ApiKeysPage() {
  return <Navigate to="/dashboard/settings?tab=apikeys" replace />;
}
```

- [ ] **Step 3: Add route in App.tsx**

Add after the `api-keys` route:

```tsx
<Route path="settings" element={<AccountSettingsPage />} />
```

Import `AccountSettingsPage` at the top.

- [ ] **Step 4: Verify**

1. Navigate to `/dashboard/settings`
2. See "Profil" and "API Keys" tabs
3. API Keys tab shows existing keys
4. Navigating to `/dashboard/api-keys` redirects to settings

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/dashboard/AccountSettingsPage.tsx frontend/src/pages/dashboard/ApiKeysPage.tsx frontend/src/App.tsx
git commit -m "feat: add Account Settings page with API Keys tab"
git push
```

---

## Intentionally Deferred

- **Schedule selector dropdown** ("Arbeitszeiten (Standard)") — multiple named schedules is a future feature
- **List/Calendar toggle** on Zeitplan tab — initially only List view
- **"Active on: X event types" indicator** — counts event types using default schedule; add in a follow-up
- **Admin sub-navigation** — Companies, Users, Routing Forms, Settings are now accessed via the Admin dashboard page (`/admin`) rather than direct sidebar links

## Final Verification

After all tasks are complete:

- [ ] **Sidebar**: All 4 main nav items + 2 admin items work, Create dropdown shows 3 options, Create options navigate correctly
- [ ] **Availability**: Both tabs load/save, weekly schedule with day circles works, holidays load from Google Calendar, holiday toggles persist
- [ ] **Group Events**: Can create GROUP event type, multiple invitees can book same slot, slot disappears when full, remaining spots show on booking page
- [ ] **Account Settings**: API Keys accessible via settings page, gear icon in sidebar navigates there
- [ ] **Slot Generation**: Blocked holidays are respected, configurable daily limits work
