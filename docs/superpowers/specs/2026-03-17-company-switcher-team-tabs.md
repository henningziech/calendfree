# Company Switcher & Team Tabs

## Context

Users can be members of multiple companies within their organization, but the app currently hardcodes `activeCompanyId` to the oldest company membership with no way to switch. All pages (teams, event types, bookings) are scoped to this company. The user needs a company switcher in the sidebar and a filtered teams view showing "Meine Teams" vs "Alle Teams".

## Scope

### 1. Company Switcher in Sidebar

**Location:** Sidebar, above the "+ Erstellen" button. Always visible.

**UI:**
- Dropdown showing current company name
- On click: lists all companies the user is a member of (from `companyMemberships`)
- Selecting a different company calls the switch endpoint and refreshes the app context
- Shows company name + role badge (Admin/User) per option

**Data flow:**
1. `GET /api/auth/me` returns `companyMemberships: [{ companyId, companyName, role }]` alongside existing fields
2. User selects company → `PATCH /api/auth/me/company` with `{ companyId }`
3. Backend validates membership, updates session `activeCompanyId` and `activeRole`
4. Frontend `AuthContext` calls `refresh()` → all components re-render with new company context

### 2. Backend: Company Switch Endpoint

**New endpoint:** `PATCH /api/auth/me/company`

```typescript
Body: { companyId: string }
```

- Validates user has a CompanyMembership for the given companyId within the same organizationId (tenant isolation)
- Updates session: `activeCompanyId`, `activeRole` (from the membership's role)
- Returns updated session user object
- Request validated via `SwitchCompanySchema` (Zod) in `shared/src/schemas/auth.ts`

### 3. Backend: Include companyMemberships in /api/auth/me

Extend the `GET /api/auth/me` response to include:

```typescript
companyMemberships: [
  { companyId: string, companyName: string, role: string }
]
```

This is fetched from the user's CompanyMembership records with company name joined.

**Critical:** The current `/me` endpoint always resets `activeCompanyId` to `memberships[0]`. This must change: preserve the session's `activeCompanyId` if the user still has a valid membership for that company, and only fall back to `memberships[0]` if the current value is null or invalid.

### 4. Frontend: AuthContext Changes

- `SessionUser` interface gets `companyMemberships` array
- Add `switchCompany(companyId: string)` function to AuthContext
- `switchCompany` sets `isLoading = true`, calls the PATCH endpoint, then calls `refresh()` and clears loading — prevents child components from fetching with stale companyId during the switch

### 5. Team Tabs on MyTeamsPage

**Two tabs:**
- **"Meine Teams"** (default) — teams where the user is a member, filtered by active company
- **"Alle Teams"** — all teams in the active company (user may not be a member of all)

**Backend support:** The existing `GET /api/admin/companies/:companyId/teams` returns all teams. Frontend filters "Meine Teams" client-side by checking `team.memberships.some(m => m.userId === user.id)`.

**"Alle Teams" tab:**
- Shows all company teams as cards (same design as current)
- Teams the user is NOT a member of show a "Beitreten" button instead of "Mitglied" badge (uses existing `POST /api/admin/teams/:id/join` endpoint)
- Clicking a team card navigates to TeamDetailPage as before

### Files to modify

**Shared:**
- `shared/src/schemas/auth.ts` — add `SwitchCompanySchema`, `CompanyMembershipItemSchema`, extend session user type

**Backend:**
- `backend/src/routes/auth.ts` — preserve activeCompanyId on /me refresh, add companyMemberships to response, add PATCH endpoint
- `backend/src/services/google-auth.ts` — no changes needed (already sets activeCompanyId)

**Frontend:**
- `frontend/src/api/auth.ts` — extend SessionUser interface with companyMemberships, add switchCompany API call
- `frontend/src/context/AuthContext.tsx` — add switchCompany to context, expose companyMemberships
- `frontend/src/components/layout/Sidebar.tsx` — add company dropdown above Create button
- `frontend/src/pages/dashboard/MyTeamsPage.tsx` — add tabs (Meine Teams / Alle Teams)

## Verification

1. **Sidebar dropdown**: Shows current company, lists all companies on click
2. **Company switch**: Selecting a different company refreshes all data
3. **Role updates**: Switching company updates `activeRole` (may change admin visibility)
4. **Meine Teams tab**: Only shows teams user is a member of
5. **Alle Teams tab**: Shows all company teams with join option
6. **Single company**: Dropdown still shows (with one option), no errors
