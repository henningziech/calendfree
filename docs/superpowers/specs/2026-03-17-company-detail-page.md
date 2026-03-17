# Company Detail Page

## Context

The admin CompaniesPage currently only lists companies with name/slug and allows create/delete. There is no detail page to view or edit a company. The backend already has most CRUD endpoints (`GET/PATCH /admin/companies/:id`, branding, teams, users). This adds a CompanyDetailPage accessible by clicking a company in the list.

## Scope

### 1. CompanyDetailPage

**Route:** `/admin/companies/:companyId`

**Permissions:**
- ORG_ADMIN: can view and edit all companies
- COMPANY_ADMIN: can view and edit only their own company (backend access check on `GET /admin/companies/:id` should verify company membership for COMPANY_ADMIN — add if missing)
- Regular USER: no access (admin routes require admin role)

**Sections:**

#### A) Header
- Back link "← Zurück zu Companies"
- Company name as h1 (click-to-edit for authorized users, same pattern as TeamDetailPage)

#### B) Firmendaten (Company Info)
- Editable fields: Name, Slug, Custom Domain
- Single save button for all fields
- Uses `PATCH /admin/companies/:id` (existing endpoint)

#### C) Mitglieder (Members)
- List of all CompanyMembership records for this company (from `getCompanyUsers(companyId)` — already exists)
- Each row: avatar, name, email, role badge (ORG_ADMIN/COMPANY_ADMIN/USER)
- Role dropdown to change member role — ORG_ADMIN only (uses `PATCH /admin/companies/:companyId/users/:userId/role`, existing endpoint restricted to ORG_ADMIN)
- "Mitglied einladen" button with email input (uses existing `inviteUser(companyId, data)`)
- Remove member button with confirmation (uses existing `removeUser(companyId, userId)`)

#### D) Teams
- List of teams in the company (from `getTeams(companyId)` — already exists)
- Each team: name, member count
- Clickable → `/dashboard/teams/:teamId` (reuses existing TeamDetailPage across layout boundaries — acceptable since both layouts use AdminLayout)
- No inline management (that's on TeamDetailPage)

#### E) Termine (Recent Bookings)
- Last 20 bookings across all event types in the company
- Each booking: BookingCard component (clickable → `/dashboard/bookings/:bookingId`)
- Requires new backend endpoint: `GET /api/admin/companies/:companyId/bookings`

### 2. Backend Changes

**New endpoint:** `GET /api/admin/companies/:companyId/bookings`
- Returns recent bookings where `eventType.companyId = companyId`
- Includes: eventType (title, slug, duration, team name), formData (name, email), assignedUser (name, email)
- Ordered by `startTime DESC`, limited to 20
- Requires ORG_ADMIN or COMPANY_ADMIN role

**Modify:** `GET /api/admin/companies/:id`
- Include team member counts in response: `teams: { include: { _count: { select: { memberships: true } } } }`
- Add COMPANY_ADMIN access check: verify the user has a membership in the requested company (ORG_ADMIN bypasses this check)

### 3. CompaniesPage Update

- Company cards become clickable links to `/admin/companies/:companyId`
- Keep create/delete functionality on the list page

### 4. Frontend API

**Already exists (no changes needed):**
- `getCompanyUsers(companyId)` — fetches company members
- `updateCompany(id, data)` — PATCH company fields
- `inviteUser(companyId, data)` — invite by email
- `removeUser(companyId, userId)` — remove member

**Add:**
- `getCompanyDetail(id)` → `GET /admin/companies/:id` (with teams + member counts)
- `getCompanyBookings(companyId)` → `GET /admin/companies/:companyId/bookings`

### Files to modify

**Backend:**
- `backend/src/routes/admin/company.ts` — add bookings endpoint, update GET/:id include, add COMPANY_ADMIN access check

**Frontend:**
- `frontend/src/pages/admin/CompanyDetailPage.tsx` — new page
- `frontend/src/pages/admin/CompaniesPage.tsx` — make cards clickable
- `frontend/src/App.tsx` — add route `/admin/companies/:companyId`
- `frontend/src/api/admin.ts` — add `getCompanyDetail`, `getCompanyBookings`

## Verification

1. **CompaniesPage**: Click on company → navigates to detail page
2. **Company info**: Can edit name, slug, custom domain and save
3. **Members**: Shows all members with roles, ORG_ADMIN can change roles, can invite/remove
4. **Teams**: Lists teams with member counts, click navigates to TeamDetailPage
5. **Bookings**: Shows last 20 bookings
6. **Permissions**: COMPANY_ADMIN can only access their own company's detail page
