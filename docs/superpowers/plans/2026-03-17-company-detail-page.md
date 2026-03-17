# Company Detail Page Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a CompanyDetailPage where admins can edit company info, manage members, view teams, and see recent bookings.

**Architecture:** Add a company bookings endpoint and enhance the existing GET company detail endpoint on the backend. Create a new CompanyDetailPage frontend component with 4 sections (info, members, teams, bookings). Update CompaniesPage to use clickable cards.

**Tech Stack:** Fastify (endpoints), Prisma (queries), React + Tailwind (UI)

**Spec:** `docs/superpowers/specs/2026-03-17-company-detail-page.md`

---

## Chunk 1: Backend

### Task 1: Update GET Company Detail + Add Bookings Endpoint

**Files:**
- Modify: `backend/src/routes/admin/company.ts`

- [ ] **Step 1: Update GET /api/admin/companies/:id to include team member counts and COMPANY_ADMIN access check**

Find the GET handler (lines 39-49). Replace with:

```typescript
app.get('/api/admin/companies/:id', { preHandler: [requireRole('COMPANY_ADMIN', 'ORG_ADMIN')] }, async (request, reply) => {
  const { id } = request.params as { id: string };
  const user = request.session.user!;

  // COMPANY_ADMIN can only view their own company
  if (user.activeRole === 'COMPANY_ADMIN') {
    const membership = await prisma.companyMembership.findFirst({
      where: { userId: user.id, companyId: id },
    });
    if (!membership) return reply.status(403).send({ error: 'Not authorized' });
  }

  const company = await prisma.company.findFirst({
    where: { id, organizationId: user.organizationId },
    include: {
      branding: true,
      teams: {
        include: {
          _count: { select: { memberships: true } },
        },
      },
    },
  });
  if (!company) return reply.status(404).send({ error: 'Company not found' });
  return company;
});
```

- [ ] **Step 2: Add GET /api/admin/companies/:companyId/bookings endpoint**

Add before the DELETE handler (around line 66):

```typescript
/** GET /api/admin/companies/:companyId/bookings — Recent bookings for a company */
app.get('/api/admin/companies/:companyId/bookings', { preHandler: [requireRole('COMPANY_ADMIN', 'ORG_ADMIN')] }, async (request, reply) => {
  const { companyId } = request.params as { companyId: string };
  const user = request.session.user!;

  // COMPANY_ADMIN can only view their own company
  if (user.activeRole === 'COMPANY_ADMIN') {
    const membership = await prisma.companyMembership.findFirst({
      where: { userId: user.id, companyId },
    });
    if (!membership) return reply.status(403).send({ error: 'Not authorized' });
  }

  const bookings = await prisma.booking.findMany({
    where: {
      eventType: { companyId },
    },
    include: {
      eventType: { select: { title: true, slug: true, duration: true, teamId: true, team: { select: { name: true } }, company: { select: { slug: true } } } },
      formData: { select: { name: true, email: true, data: true } },
      assignedUser: { select: { name: true, email: true } },
    },
    orderBy: { startTime: 'desc' },
    take: 20,
  });

  return bookings;
});
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/routes/admin/company.ts
git commit -m "feat: enhance company detail endpoint and add company bookings endpoint"
git push
```

---

## Chunk 2: Frontend

### Task 2: Add Frontend API Functions

**Files:**
- Modify: `frontend/src/api/admin.ts`

- [ ] **Step 1: Add getCompanyDetail and getCompanyBookings**

```typescript
export async function getCompanyDetail(id: string) {
  return apiRequest(`/admin/companies/${id}`);
}

export async function getCompanyBookings(companyId: string) {
  return apiRequest(`/admin/companies/${companyId}/bookings`);
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/api/admin.ts
git commit -m "feat: add getCompanyDetail and getCompanyBookings API functions"
git push
```

### Task 3: Make CompaniesPage Cards Clickable

**Files:**
- Modify: `frontend/src/pages/admin/CompaniesPage.tsx`

- [ ] **Step 1: Update company cards to be clickable links**

Read the file first. Add `Link` import from `react-router`. Change each company card/row to be wrapped in a `<Link to={/admin/companies/${c.id}}>` that navigates to the detail page. Keep the delete button functional (use `e.preventDefault()` + `e.stopPropagation()` on the delete click handler).

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/admin/CompaniesPage.tsx
git commit -m "feat: make company cards clickable links to detail page"
git push
```

### Task 4: Create CompanyDetailPage

**Files:**
- Create: `frontend/src/pages/admin/CompanyDetailPage.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Create CompanyDetailPage.tsx**

Follow the same patterns as TeamDetailPage and AccountSettingsPage. The page has 4 sections:

**A) Header:**
- Back link "← Zurück zu Companies" → `/admin/companies`
- Company name as h1, click-to-edit (input + save/cancel) for authorized users

**B) Firmendaten (Company Info):**
- Card with editable fields: Name, Slug, Custom Domain
- All in one card with a "Speichern" button
- Uses `updateCompany(id, { name, slug, customDomain })`

**C) Mitglieder (Members):**
- Loads via `getCompanyUsers(companyId)` on mount
- Member list: avatar/initials, name, email, role badge
- ORG_ADMIN only: role dropdown (USER/COMPANY_ADMIN/ORG_ADMIN) per member
- "Mitglied einladen" button → inline email+name+role form → `inviteUser(companyId, data)`
- "Entfernen" button per member (with confirm) → `removeUser(companyId, userId)`

**D) Teams:**
- Loads from `company.teams` (included in getCompanyDetail response)
- Card list: team name, member count (`team._count.memberships`), clickable → `/dashboard/teams/:teamId`

**E) Termine (Recent Bookings):**
- Loads via `getCompanyBookings(companyId)` on mount
- BookingCard list (clickable → `/dashboard/bookings/:bookingId`)
- Empty state: "Keine Buchungen vorhanden"

**State management:**
```typescript
const [company, setCompany] = useState<any>(null);
const [members, setMembers] = useState<any[]>([]);
const [bookings, setBookings] = useState<any[]>([]);
const [isLoading, setIsLoading] = useState(true);

// Edit state
const [editing, setEditing] = useState(false);
const [editName, setEditName] = useState('');
const [editSlug, setEditSlug] = useState('');
const [editDomain, setEditDomain] = useState('');

// Invite state
const [showInvite, setShowInvite] = useState(false);
const [inviteEmail, setInviteEmail] = useState('');
const [inviteName, setInviteName] = useState('');
const [inviteRole, setInviteRole] = useState('USER');
```

**Key imports:**
```typescript
import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router';
import { useAuth } from '../../context/AuthContext';
import { getCompanyDetail, getCompanyBookings, getCompanyUsers, updateCompany, inviteUser, removeUser } from '../../api/admin';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { BookingCard } from '../../components/bookings/BookingCard';
```

**Permission check:**
```typescript
const { user } = useAuth();
const isOrgAdmin = user?.activeRole === 'ORG_ADMIN';
```
- Only ORG_ADMIN can change member roles
- Both ORG_ADMIN and COMPANY_ADMIN can edit company info, invite, remove members

**Styling:** Follow existing patterns:
- Cards: `rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-sm`
- Section headers: `text-lg font-semibold text-[#1E293B]`
- Role badges: same pattern as TeamDetailPage (teal for admin, gray for user)
- Inputs: `rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm focus:border-[#0B8ECA] focus:outline-none`

- [ ] **Step 2: Add route in App.tsx**

Add inside the admin routes (after the `companies` route):

```tsx
<Route path="companies/:companyId" element={<CompanyDetailPage />} />
```

Import `CompanyDetailPage` at the top.

- [ ] **Step 3: Verify**

1. Navigate to `/admin/companies` → click a company → see detail page
2. Edit name/slug/domain → save → changes persist
3. View members → invite new member → appears in list
4. Change member role (ORG_ADMIN only) → role updates
5. Remove member → disappears from list
6. Teams section shows teams with member counts, clickable
7. Bookings section shows recent bookings
8. Back link works

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/admin/CompanyDetailPage.tsx frontend/src/App.tsx
git commit -m "feat: add CompanyDetailPage with info editing, members, teams, and bookings"
git push
```

---

## Verification

- [ ] **CompaniesPage**: Cards are clickable, navigate to detail
- [ ] **Company info**: Name, slug, domain editable and saveable
- [ ] **Members**: List with roles, invite, remove, role change (ORG_ADMIN)
- [ ] **Teams**: Displayed with member counts, clickable to TeamDetailPage
- [ ] **Bookings**: Last 20 shown as BookingCards
- [ ] **Permissions**: COMPANY_ADMIN restricted to own company, ORG_ADMIN sees all
