# Self-Service Status & Vacations Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users set their own availability status and manage multiple vacation periods from the Profile tab, blocking bookings during those periods.

**Architecture:** Add a self-service status endpoint (`PATCH /api/me/status`), a `VacationPeriod` Prisma model for multiple date ranges, and extend the ProfileTab in AccountSettingsPage with status toggle + vacation management UI. The slot generation service already filters ABSENT users — vacation periods integrate by checking if the current slot date falls within any active vacation.

**Tech Stack:** Prisma (new VacationPeriod model), Fastify (new endpoint), React (ProfileTab UI), Zod validation

---

## File Map

| File | Change | Responsibility |
|------|--------|----------------|
| `backend/prisma/schema.prisma` | Add model | `VacationPeriod` with startDate, endDate, label |
| `shared/src/schemas/admin.ts` | Add schemas | Self-service status + vacation CRUD validation |
| `backend/src/routes/admin/users.ts` | Add endpoints | `PATCH /api/me/status`, vacation CRUD under `/api/me/vacations` |
| `backend/src/services/availability.ts` | Modify | Check vacation periods in slot generation |
| `frontend/src/api/admin.ts` | Add functions | API calls for status + vacations |
| `frontend/src/pages/dashboard/AccountSettingsPage.tsx` | Modify | Interactive ProfileTab with status toggle + vacation list |

---

## Chunk 1: Backend

### Task 1: Add VacationPeriod Model

**Files:**
- Modify: `backend/prisma/schema.prisma`

- [ ] **Step 1: Add VacationPeriod model**

Add after the AvailabilityConfig model:

```prisma
model VacationPeriod {
  id        String   @id @default(uuid())
  userId    String
  /// Start date of vacation (inclusive)
  startDate DateTime @db.Date
  /// End date of vacation (inclusive)
  endDate   DateTime @db.Date
  /// Optional label (e.g. "Sommerurlaub", "Krank")
  label     String?
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, startDate, endDate])
}
```

Add the relation to the User model:

```prisma
  vacations VacationPeriod[]
```

- [ ] **Step 2: Run migration**

```bash
npx prisma migrate dev --name add_vacation_periods --schema backend/prisma/schema.prisma
npx prisma generate --schema backend/prisma/schema.prisma
```

- [ ] **Step 3: Commit**

```bash
git add backend/prisma/
git commit -m "feat: add VacationPeriod model for multi-period vacations"
git push
```

### Task 2: Add Zod Schemas

**Files:**
- Modify: `shared/src/schemas/admin.ts`

- [ ] **Step 1: Add schemas at the end of the file**

```typescript
// Self-service status
export const UpdateMyStatusSchema = z.object({
  status: z.enum(['AVAILABLE', 'ABSENT']),
  absentUntil: z.string().datetime().nullable().optional(),
});
export type UpdateMyStatus = z.infer<typeof UpdateMyStatusSchema>;

// Vacation periods
export const CreateVacationSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  label: z.string().max(255).nullable().optional(),
}).refine((data) => data.startDate <= data.endDate, {
  message: 'startDate must be before or equal to endDate',
  path: ['endDate'],
});
export type CreateVacation = z.infer<typeof CreateVacationSchema>;
```

- [ ] **Step 2: Commit**

```bash
git add shared/src/schemas/admin.ts
git commit -m "feat: add Zod schemas for self-service status and vacations"
git push
```

### Task 3: Add Self-Service Endpoints

**Files:**
- Modify: `backend/src/routes/admin/users.ts`

- [ ] **Step 1: Add PATCH /api/me/status endpoint**

Add after the existing `PATCH /api/me/availability` handler:

```typescript
/** Self-service status update — users can set their own availability status. */
app.patch('/api/me/status', { preHandler: [requireAuth] }, async (request) => {
  const user = request.session.user!;
  const body = UpdateMyStatusSchema.parse(request.body);

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      status: body.status,
      absentUntil: body.status === 'ABSENT' && body.absentUntil
        ? new Date(body.absentUntil)
        : null,
    },
    select: { status: true, absentUntil: true },
  });

  return updated;
});
```

Import `UpdateMyStatusSchema` and `CreateVacationSchema` from shared schemas.

- [ ] **Step 2: Add vacation CRUD endpoints**

```typescript
/** List my vacations (future + current only). */
app.get('/api/me/vacations', { preHandler: [requireAuth] }, async (request) => {
  const user = request.session.user!;
  return prisma.vacationPeriod.findMany({
    where: { userId: user.id, endDate: { gte: new Date() } },
    orderBy: { startDate: 'asc' },
  });
});

/** Create a vacation period. */
app.post('/api/me/vacations', { preHandler: [requireAuth] }, async (request) => {
  const user = request.session.user!;
  const body = CreateVacationSchema.parse(request.body);

  return prisma.vacationPeriod.create({
    data: {
      userId: user.id,
      startDate: new Date(body.startDate),
      endDate: new Date(body.endDate),
      label: body.label ?? null,
    },
  });
});

/** Delete a vacation period. */
app.delete('/api/me/vacations/:id', { preHandler: [requireAuth] }, async (request, reply) => {
  const user = request.session.user!;
  const { id } = request.params as { id: string };

  const vacation = await prisma.vacationPeriod.findFirst({
    where: { id, userId: user.id },
  });
  if (!vacation) return reply.status(404).send({ error: 'Not found' });

  await prisma.vacationPeriod.delete({ where: { id } });
  return { success: true };
});
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/routes/admin/users.ts
git commit -m "feat: add self-service status and vacation CRUD endpoints"
git push
```

### Task 4: Integrate Vacations in Slot Generation

**Files:**
- Modify: `backend/src/services/availability.ts`

- [ ] **Step 1: Fetch vacation periods for active users**

After the `configByUser` batch query (around line 77), add:

```typescript
// Fetch vacation periods for all active users
const vacationPeriods = await prisma.vacationPeriod.findMany({
  where: {
    userId: { in: activeUserIds },
    endDate: { gte: effectiveStart },
    startDate: { lte: effectiveEnd },
  },
});
const vacationsByUser = new Map<string, Array<{ startDate: Date; endDate: Date }>>();
for (const v of vacationPeriods) {
  const list = vacationsByUser.get(v.userId) ?? [];
  list.push({ startDate: v.startDate, endDate: v.endDate });
  vacationsByUser.set(v.userId, list);
}
```

- [ ] **Step 2: Check vacation periods in the day/user loop**

In the per-user loop, after the holiday blocking check and before `dayWindows` resolution, add:

```typescript
// Check if this day falls within a vacation period for this user
const userVacations = vacationsByUser.get(userId) ?? [];
const dayDate = new Date(dayDateStr);
const isOnVacation = userVacations.some((v) =>
  dayDate >= v.startDate && dayDate <= v.endDate
);
if (isOnVacation) continue;
```

Note: `dayDateStr` is already computed earlier in the loop for the holiday check.

- [ ] **Step 3: Commit**

```bash
git add backend/src/services/availability.ts
git commit -m "feat: block slots during vacation periods in availability service"
git push
```

---

## Chunk 2: Frontend

### Task 5: Add Frontend API Functions

**Files:**
- Modify: `frontend/src/api/admin.ts`

- [ ] **Step 1: Add API functions**

```typescript
// Self-service status
export async function updateMyStatus(status: 'AVAILABLE' | 'ABSENT', absentUntil?: string | null) {
  return apiRequest('/me/status', {
    method: 'PATCH',
    body: JSON.stringify({ status, absentUntil }),
  });
}

// Vacations
export async function getMyVacations(): Promise<Array<{ id: string; startDate: string; endDate: string; label: string | null }>> {
  return apiRequest('/me/vacations');
}

export async function createVacation(data: { startDate: string; endDate: string; label?: string | null }) {
  return apiRequest('/me/vacations', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function deleteVacation(id: string) {
  return apiRequest(`/me/vacations/${id}`, { method: 'DELETE' });
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/api/admin.ts
git commit -m "feat: add API functions for self-service status and vacations"
git push
```

### Task 6: Rewrite ProfileTab with Status + Vacations

**Files:**
- Modify: `frontend/src/pages/dashboard/AccountSettingsPage.tsx`

- [ ] **Step 1: Rewrite ProfileTab**

The ProfileTab should show:

**1. Profile info** (read-only): avatar, name, email, timezone — same as now.

**2. Status section:**
- Toggle button: "Verfügbar" (green/teal) / "Abwesend" (red)
- When switching to ABSENT, optional date picker for "Abwesend bis" (auto-reset date)
- Saves immediately on toggle via `updateMyStatus()`

```tsx
<div className="rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
  <h3 className="font-semibold text-[#1E293B]">Status</h3>
  <div className="mt-3 flex items-center gap-4">
    <button
      onClick={() => handleStatusChange(profile.status === 'AVAILABLE' ? 'ABSENT' : 'AVAILABLE')}
      className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
        profile.status === 'AVAILABLE'
          ? 'bg-[#14B8A6]/10 text-[#14B8A6]'
          : 'bg-[#EF4444]/10 text-[#EF4444]'
      }`}
    >
      {profile.status === 'AVAILABLE' ? 'Verfügbar' : 'Abwesend'}
    </button>
    {profile.status === 'ABSENT' && (
      <div className="flex items-center gap-2">
        <label className="text-sm text-[#64748B]">bis</label>
        <input
          type="date"
          value={absentUntil}
          onChange={(e) => handleAbsentUntilChange(e.target.value)}
          min={todayStr}
          className="rounded-xl border border-[#E2E8F0] px-3 py-1.5 text-sm"
        />
      </div>
    )}
  </div>
</div>
```

**3. Vacations section:**
- List of future vacation periods, sorted by start date
- Each entry: date range (formatted), optional label, delete button
- "+ Urlaub hinzufügen" button opens inline form with: start date, end date, optional label
- Form validates end >= start

```tsx
<div className="rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
  <div className="flex items-center justify-between">
    <div>
      <h3 className="font-semibold text-[#1E293B]">Urlaub & Abwesenheiten</h3>
      <p className="text-sm text-[#64748B]">Zeiträume in denen keine Termine gebucht werden können</p>
    </div>
    <button onClick={() => setAddingVacation(true)} className="rounded-xl border border-[#0B8ECA] px-3 py-1.5 text-sm font-medium text-[#0B8ECA]">
      + Urlaub hinzufügen
    </button>
  </div>

  {/* Add form */}
  {addingVacation && (
    <div className="mt-4 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-4">
      <div className="flex gap-4">
        <div>
          <label className="block text-xs text-[#64748B]">Von</label>
          <input type="date" min={todayStr} ... />
        </div>
        <div>
          <label className="block text-xs text-[#64748B]">Bis</label>
          <input type="date" min={newVacStart || todayStr} ... />
        </div>
        <div>
          <label className="block text-xs text-[#64748B]">Bezeichnung (optional)</label>
          <input type="text" placeholder="z.B. Sommerurlaub" ... />
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <button onClick={handleAddVacation} className="rounded-xl bg-[#0B8ECA] px-3 py-1.5 text-sm text-white">Hinzufügen</button>
        <button onClick={() => setAddingVacation(false)} className="rounded-xl border border-[#E2E8F0] px-3 py-1.5 text-sm text-[#64748B]">Abbrechen</button>
      </div>
    </div>
  )}

  {/* Vacation list */}
  {vacations.map((v) => (
    <div key={v.id} className="mt-3 flex items-center justify-between border-t border-[#F1F5F9] pt-3">
      <div>
        <p className="text-sm font-medium text-[#1E293B]">
          {formatDateDE(v.startDate)} – {formatDateDE(v.endDate)}
        </p>
        {v.label && <p className="text-xs text-[#64748B]">{v.label}</p>}
      </div>
      <button onClick={() => handleDeleteVacation(v.id)} className="text-sm text-[#EF4444] hover:underline">Löschen</button>
    </div>
  ))}

  {vacations.length === 0 && !addingVacation && (
    <p className="mt-4 text-sm text-[#94A3B8]">Keine Urlaube eingetragen.</p>
  )}
</div>
```

**Key behaviors:**
- Status toggle saves immediately (no "Speichern" button needed)
- Vacation add/delete also saves immediately via API
- Vacations load on mount via `getMyVacations()`
- Profile data loads via `getMyProfile()`

- [ ] **Step 2: Verify**

1. Open /dashboard/settings
2. Toggle status → verify it saves (API call + badge changes)
3. Set "abwesend bis" date → verify it saves
4. Add vacation → verify it appears in list
5. Delete vacation → verify it disappears
6. Book a slot during vacation → verify it's not available

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/dashboard/AccountSettingsPage.tsx
git commit -m "feat: add self-service status toggle and vacation management to profile"
git push
```

---

## Verification

- [ ] **Status toggle**: User can switch between Verfügbar/Abwesend, change persists on reload
- [ ] **Absent until**: Setting an "abwesend bis" date auto-resets status (existing backend logic handles this)
- [ ] **Vacation CRUD**: Can add, list, and delete vacation periods
- [ ] **Slot blocking**: Slots during vacation periods are not shown on public booking page
- [ ] **No regression**: Admin status change still works, existing absence logic unchanged
