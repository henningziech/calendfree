# Date-Specific Hours Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users to override their weekly availability schedule for specific dates (e.g., "Am 25. März nur 10:00-14:00 verfügbar" or "Am 28. März nicht verfügbar").

**Architecture:** Add a `dateSpecificHours` JSON field to AvailabilityConfig. The slot generation service checks this field first — if a date-specific entry exists, it overrides the weekly schedule for that day. The frontend adds a date picker + time editor UI in the Zeitplan tab. The API handler already handles new fields transparently via spread.

**Tech Stack:** Prisma (JSON field), Zod validation, React (date picker + time editor), Fastify (no route changes needed)

---

## File Map

| File | Change | Responsibility |
|------|--------|----------------|
| `backend/prisma/schema.prisma` | Add field | `dateSpecificHours Json?` on AvailabilityConfig |
| `shared/src/schemas/admin.ts` | Add field | Zod validation for dateSpecificHours |
| `backend/src/services/availability.ts` | Modify | Check date-specific hours before weekly fallback |
| `frontend/src/pages/dashboard/AvailabilityPage.tsx` | Modify | Replace placeholder with date picker + time editor UI |
| `frontend/src/api/admin.ts` | No change | `updateMyAvailability` already spreads all fields |
| `backend/src/routes/admin/users.ts` | No change | Upsert with `...body` handles new field automatically |

---

## Chunk 1: Backend (Schema + Slot Generation)

### Task 1: Add dateSpecificHours to Prisma Schema

**Files:**
- Modify: `backend/prisma/schema.prisma` (AvailabilityConfig model, around line 355)

- [ ] **Step 1: Add the field**

After the `blockedHolidays` field in the AvailabilityConfig model, add:

```prisma
  /// Date-specific availability overrides as JSON: { "2026-03-25": [{"start":"10:00","end":"14:00"}], "2026-03-26": [] }
  /// Empty array = unavailable that day. Null/missing = use weekly schedule.
  dateSpecificHours Json?
```

- [ ] **Step 2: Run migration**

```bash
cd /Users/hziech/calendfree
npx prisma migrate dev --name add_date_specific_hours --schema backend/prisma/schema.prisma
npx prisma generate --schema backend/prisma/schema.prisma
```

- [ ] **Step 3: Commit**

```bash
git add backend/prisma/
git commit -m "feat: add dateSpecificHours field to AvailabilityConfig"
git push
```

### Task 2: Add dateSpecificHours to Zod Schema

**Files:**
- Modify: `shared/src/schemas/admin.ts` (UpdateAvailabilitySchema)

- [ ] **Step 1: Add the field to UpdateAvailabilitySchema**

Find the `UpdateAvailabilitySchema` definition. Add after the `holidayCountry` field:

```typescript
  dateSpecificHours: z.record(
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    z.array(z.object({
      start: z.string().regex(/^\d{2}:\d{2}$/),
      end: z.string().regex(/^\d{2}:\d{2}$/),
    }))
  ).nullable().optional(),
```

This validates keys as ISO dates (YYYY-MM-DD) and values as arrays of time windows. An empty array `[]` means unavailable that day.

- [ ] **Step 2: Commit**

```bash
git add shared/src/schemas/admin.ts
git commit -m "feat: add dateSpecificHours to UpdateAvailabilitySchema"
git push
```

### Task 3: Integrate date-specific hours in slot generation

**Files:**
- Modify: `backend/src/services/availability.ts`

- [ ] **Step 1: Override weekly hours with date-specific hours**

In the `getAvailableSlots` function, find the section inside the day loop where `dayWindows` is determined (around line 170):

```typescript
const dayOfWeek = DAY_NAMES[getDay(day)];
const dayWindows = bookableHours[dayOfWeek];
if (!dayWindows || dayWindows.length === 0) continue;
```

This currently uses only the EventType's bookable hours. We need to check each user's date-specific hours first. However, since `dayWindows` comes from the EventType (not the user), and date-specific hours are per-user, the override needs to happen inside the user loop.

Restructure: move the `dayWindows` resolution INSIDE the `for (const userId of eligibleUserIds)` loop, and check user's date-specific hours first:

```typescript
for (const day of days) {
  const dayOfWeek = DAY_NAMES[getDay(day)];
  const defaultDayWindows = bookableHours[dayOfWeek];

  for (const userId of eligibleUserIds) {
    // Check for date-specific hours override
    const userConfig = configByUser.get(userId);
    const dayInTz = toZonedTime(day, bookableHoursTz);
    const dayDateStr = `${dayInTz.getFullYear()}-${String(dayInTz.getMonth() + 1).padStart(2, '0')}-${String(dayInTz.getDate()).padStart(2, '0')}`;

    // Date-specific hours override the weekly schedule
    const dateSpecificHours = (userConfig?.dateSpecificHours as Record<string, TimeWindow[]> | null) ?? null;
    let dayWindows: TimeWindow[] | undefined;

    if (dateSpecificHours && dayDateStr in dateSpecificHours) {
      // User has a date-specific override for this day
      dayWindows = dateSpecificHours[dayDateStr];
      if (!dayWindows || dayWindows.length === 0) continue; // Empty = unavailable
    } else {
      // Fall back to weekly schedule from EventType
      dayWindows = defaultDayWindows;
      if (!dayWindows || dayWindows.length === 0) continue;
    }

    // ... existing per-user logic (daily limit check, holiday check, slot generation)
  }
}
```

IMPORTANT: The current code structure has `dayWindows` check OUTSIDE the user loop. After this change, the check moves INSIDE. The `if (!dayWindows || dayWindows.length === 0) continue;` that was outside the user loop (skipping the entire day) should be removed, since different users might have different date-specific hours for the same day.

However, the default `dayWindows` (from EventType bookable hours) still applies as a baseline. If no user has date-specific hours and the EventType has no hours for that day, we can skip early:

```typescript
for (const day of days) {
  const dayOfWeek = DAY_NAMES[getDay(day)];
  const defaultDayWindows = bookableHours[dayOfWeek];
  // Don't skip here — a user might have date-specific hours even if the default is empty

  for (const userId of eligibleUserIds) {
    // ... resolve dayWindows per user as shown above
  }
}
```

- [ ] **Step 2: Verify the logic**

Test scenarios:
1. User with NO date-specific hours → uses weekly schedule (no change in behavior)
2. User with date-specific hours for today `[{start:"10:00",end:"14:00"}]` → only shows slots 10-14
3. User with empty date-specific hours for today `[]` → no slots for that day
4. User with date-specific hours for a day that's also a blocked holiday → holiday check should still block it (holiday check runs before slot generation)

- [ ] **Step 3: Commit**

```bash
git add backend/src/services/availability.ts
git commit -m "feat: support date-specific hours override in slot generation"
git push
```

---

## Chunk 2: Frontend UI

### Task 4: Implement date-specific hours UI in AvailabilityPage

**Files:**
- Modify: `frontend/src/pages/dashboard/AvailabilityPage.tsx`

- [ ] **Step 1: Replace the placeholder with a working UI**

Find the placeholder section (around lines 278-284):
```jsx
{/* Date-specific hours placeholder */}
<div className="rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-sm">
  <h3 className="text-sm font-semibold text-[#64748B] uppercase tracking-wide">
    Datumsabhängige Stunden
  </h3>
  <button className="mt-3 text-sm text-[#0B8ECA] hover:underline">+ Stunden</button>
</div>
```

Replace with a component that:

**A) Shows existing date-specific entries as a list:**
Each entry shows: date (formatted as "Mo, 25. März 2026"), time ranges, edit button, delete button.

**B) Has a "+ Stunden" button that opens an inline editor:**
- Date input (type="date", min=today)
- Time range editor (same pattern as the weekly hours: start/end inputs, + to add another range)
- "Hinzufügen" button to save, "Abbrechen" to cancel

**C) Stores data in the profile state:**
```typescript
const dateSpecificHours: Record<string, Array<{start: string; end: string}>> =
  profile.availability?.dateSpecificHours ?? {};
```

When adding/editing/deleting, update via `patchAvailability`:
```typescript
patchAvailability({ dateSpecificHours: { ...dateSpecificHours, [date]: timeRanges } });
// To delete:
const { [date]: _, ...rest } = dateSpecificHours;
patchAvailability({ dateSpecificHours: rest });
```

**D) Include dateSpecificHours in the save call:**
In `handleSave()`, add `dateSpecificHours` to the `updateMyAvailability()` payload.

**UI structure:**

```tsx
{/* Date-specific hours */}
<div className="rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-sm">
  <div className="flex items-center justify-between">
    <div>
      <h3 className="font-semibold text-[#1E293B]">Datumsabhängige Stunden</h3>
      <p className="text-sm text-[#64748B]">Passe Verfügbarkeit für bestimmte Tage an</p>
    </div>
    <button onClick={() => setAddingDate(true)} className="rounded-xl border border-[#0B8ECA] px-3 py-1.5 text-sm font-medium text-[#0B8ECA] hover:bg-[#0B8ECA]/5">
      + Stunden
    </button>
  </div>

  {/* Add new date form */}
  {addingDate && (
    <div className="mt-4 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-4">
      <input type="date" min={todayStr} value={newDate} onChange={...} />
      {/* Time range inputs (reuse pattern from weekly hours) */}
      <div className="mt-3 flex gap-2">
        <button onClick={handleAddDate}>Hinzufügen</button>
        <button onClick={() => setAddingDate(false)}>Abbrechen</button>
      </div>
    </div>
  )}

  {/* List of existing date-specific entries */}
  {Object.entries(dateSpecificHours)
    .sort(([a], [b]) => a.localeCompare(b))
    .filter(([date]) => date >= todayStr) // Only show future dates
    .map(([date, slots]) => (
      <div key={date} className="mt-3 flex items-center gap-3 border-t border-[#F1F5F9] pt-3">
        <span className="text-sm font-medium w-40">{formatDate(date)}</span>
        {slots.map((slot, i) => (
          <span key={i} className="text-sm text-[#64748B]">{slot.start} – {slot.end}</span>
        ))}
        <button onClick={() => deleteDate(date)} className="text-[#EF4444] text-sm">✕</button>
      </div>
    ))}
</div>
```

- [ ] **Step 2: Verify the UI**

1. Open /dashboard/availability
2. Click "+ Stunden" — date picker + time inputs appear
3. Select a date, set times, click "Hinzufügen" — entry appears in list
4. Click save — verify data persists (reload page)
5. Delete an entry — verify it's removed

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/dashboard/AvailabilityPage.tsx
git commit -m "feat: implement date-specific hours UI in availability page"
git push
```

---

## Verification

After all tasks:

- [ ] **Backend**: Date-specific hours override weekly schedule in slot generation
- [ ] **Frontend**: Can add, view, and delete date-specific hours
- [ ] **Persistence**: Settings survive save + reload
- [ ] **Slot impact**: Booking page reflects date-specific availability
- [ ] **No regression**: Normal weekly availability still works when no date-specific hours set
