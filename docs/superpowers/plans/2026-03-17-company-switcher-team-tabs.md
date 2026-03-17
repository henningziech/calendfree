# Company Switcher & Team Tabs Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a company switcher dropdown to the sidebar and split the teams page into "Meine Teams" / "Alle Teams" tabs, so users in multiple companies can switch context.

**Architecture:** Extend the `/api/auth/me` response with `companyMemberships` array. Add `PATCH /api/auth/me/company` to switch active company in the session. Preserve `activeCompanyId` across `/me` refreshes. Frontend gets `switchCompany()` in AuthContext. Sidebar gets a company dropdown. MyTeamsPage gets two tabs.

**Tech Stack:** Fastify (session), Prisma, Zod, React Context, Tailwind CSS

**Spec:** `docs/superpowers/specs/2026-03-17-company-switcher-team-tabs.md`

---

## Chunk 1: Backend

### Task 1: Add Zod Schemas for Company Switch

**Files:**
- Modify: `shared/src/schemas/auth.ts`

- [ ] **Step 1: Add schemas**

After the existing `SessionUserSchema`, add:

```typescript
export const CompanyMembershipItemSchema = z.object({
  companyId: z.string().uuid(),
  companyName: z.string(),
  role: RoleSchema,
});
export type CompanyMembershipItem = z.infer<typeof CompanyMembershipItemSchema>;

export const SwitchCompanySchema = z.object({
  companyId: z.string().uuid(),
});
export type SwitchCompany = z.infer<typeof SwitchCompanySchema>;
```

- [ ] **Step 2: Rebuild shared and commit**

```bash
cd /Users/hziech/calendfree/shared && npm run build && cd ..
git add shared/src/schemas/auth.ts
git commit -m "feat: add SwitchCompanySchema and CompanyMembershipItemSchema"
git push
```

### Task 2: Update /api/auth/me and Add Company Switch Endpoint

**Files:**
- Modify: `backend/src/routes/auth.ts`

- [ ] **Step 1: Update GET /api/auth/me (lines 44-63)**

Replace the current `/me` handler with one that:
1. Fetches memberships WITH company name (`include: { company: { select: { name: true } } }`)
2. Preserves `activeCompanyId` if the user still has a valid membership for it
3. Falls back to `memberships[0]` only if current value is null or invalid
4. Returns `companyMemberships` array in the response

```typescript
app.get('/api/auth/me', async (request, reply) => {
  if (!request.session.user) {
    return reply.status(401).send({ error: 'Not authenticated' });
  }

  const memberships = await prisma.companyMembership.findMany({
    where: { userId: request.session.user.id },
    include: { company: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'asc' },
  });

  // Preserve activeCompanyId if still valid, otherwise fall back to first
  const currentCompanyId = request.session.user.activeCompanyId;
  const currentMembership = currentCompanyId
    ? memberships.find((m) => m.companyId === currentCompanyId)
    : null;
  const activeMembership = currentMembership ?? memberships[0] ?? null;

  request.session.user.activeCompanyId = activeMembership?.companyId ?? null;
  request.session.user.activeRole = activeMembership?.role ?? null;

  return {
    ...request.session.user,
    companyMemberships: memberships.map((m) => ({
      companyId: m.companyId,
      companyName: m.company.name,
      role: m.role,
    })),
  };
});
```

- [ ] **Step 2: Add PATCH /api/auth/me/company endpoint**

Add before the logout handler:

```typescript
/** Switch active company context */
app.patch('/api/auth/me/company', async (request, reply) => {
  if (!request.session.user) {
    return reply.status(401).send({ error: 'Not authenticated' });
  }

  const { companyId } = SwitchCompanySchema.parse(request.body);

  // Validate membership exists and is in the same organization
  const membership = await prisma.companyMembership.findFirst({
    where: {
      userId: request.session.user.id,
      companyId,
      company: { organizationId: request.session.user.organizationId },
    },
  });

  if (!membership) {
    return reply.status(403).send({ error: 'Not a member of this company' });
  }

  request.session.user.activeCompanyId = companyId;
  request.session.user.activeRole = membership.role;

  return request.session.user;
});
```

Import `SwitchCompanySchema` from shared schemas at the top.

- [ ] **Step 3: Commit**

```bash
git add backend/src/routes/auth.ts
git commit -m "feat: preserve activeCompanyId on /me refresh, add company switch endpoint"
git push
```

---

## Chunk 2: Frontend

### Task 3: Update Frontend Auth Layer

**Files:**
- Modify: `frontend/src/api/auth.ts`
- Modify: `frontend/src/context/AuthContext.tsx`

- [ ] **Step 1: Extend SessionUser interface and add switchCompany API**

In `frontend/src/api/auth.ts`, update the `SessionUser` interface to add `companyMemberships`:

```typescript
export interface SessionUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  organizationId: string;
  activeCompanyId: string | null;
  activeRole: 'ORG_ADMIN' | 'COMPANY_ADMIN' | 'USER' | null;
  companyMemberships: Array<{
    companyId: string;
    companyName: string;
    role: string;
  }>;
}
```

Add the switch function:

```typescript
export async function switchCompany(companyId: string): Promise<SessionUser> {
  return apiRequest('/auth/me/company', {
    method: 'PATCH',
    body: JSON.stringify({ companyId }),
  });
}
```

- [ ] **Step 2: Add switchCompany to AuthContext**

In `frontend/src/context/AuthContext.tsx`:

Add `switchCompany` to the `AuthContextType` interface:

```typescript
interface AuthContextType {
  user: SessionUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  switchCompany: (companyId: string) => Promise<void>;
}
```

Add the implementation inside `AuthProvider`:

```typescript
const handleSwitchCompany = async (companyId: string) => {
  setIsLoading(true);
  try {
    await switchCompany(companyId);
    await refresh();
  } catch (err) {
    console.error('Failed to switch company:', err);
  }
};
```

Update the Provider value:

```typescript
<AuthContext.Provider value={{ user, isLoading, isAuthenticated: !!user, logout, refresh, switchCompany: handleSwitchCompany }}>
```

Import `switchCompany` from `../api/auth` at the top.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/api/auth.ts frontend/src/context/AuthContext.tsx
git commit -m "feat: add switchCompany to auth layer and context"
git push
```

### Task 4: Add Company Dropdown to Sidebar

**Files:**
- Modify: `frontend/src/components/layout/Sidebar.tsx`

- [ ] **Step 1: Add company dropdown above the Create button**

In the Sidebar component, after the logo section and before the Create button section, add a company selector:

```tsx
{/* Company selector */}
<div className="px-3 pb-1">
  <div className="relative" ref={companyDropdownRef}>
    <button
      onClick={() => setCompanyOpen(!companyOpen)}
      className="flex w-full items-center justify-between rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm transition-all hover:border-[#0B8ECA]/30"
    >
      <div className="min-w-0 flex-1 text-left">
        <p className="truncate font-medium text-[#1E293B]">
          {user.companyMemberships?.find((c) => c.companyId === user.activeCompanyId)?.companyName ?? 'Firma wählen'}
        </p>
      </div>
      <svg className={`ml-2 h-4 w-4 shrink-0 text-[#64748B] transition-transform ${companyOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </button>

    {companyOpen && (
      <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-xl border border-[#E2E8F0] bg-white py-1 shadow-lg">
        {user.companyMemberships?.map((c) => (
          <button
            key={c.companyId}
            onClick={() => handleCompanySwitch(c.companyId)}
            className={`flex w-full items-center justify-between px-3 py-2 text-sm transition-colors hover:bg-[#F8FAFC] ${
              c.companyId === user.activeCompanyId ? 'bg-[#0B8ECA]/5 text-[#0B8ECA]' : 'text-[#1E293B]'
            }`}
          >
            <span className="truncate">{c.companyName}</span>
            <span className={`ml-2 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
              c.role === 'ORG_ADMIN' || c.role === 'COMPANY_ADMIN'
                ? 'bg-[#14B8A6]/10 text-[#14B8A6]'
                : 'bg-[#64748B]/10 text-[#64748B]'
            }`}>
              {c.role === 'ORG_ADMIN' ? 'Org Admin' : c.role === 'COMPANY_ADMIN' ? 'Admin' : 'User'}
            </span>
          </button>
        ))}
      </div>
    )}
  </div>
</div>
```

Add state and handler:

```typescript
const { user, logout, switchCompany } = useAuth();
const [companyOpen, setCompanyOpen] = useState(false);
const companyDropdownRef = useRef<HTMLDivElement>(null);

const handleCompanySwitch = async (companyId: string) => {
  setCompanyOpen(false);
  if (companyId !== user?.activeCompanyId) {
    await switchCompany(companyId);
  }
};
```

Add outside-click handler for the company dropdown (same pattern as the create dropdown).

- [ ] **Step 2: Verify**

1. Login with a user who has multiple company memberships
2. See company name in sidebar dropdown
3. Click → see all companies with role badges
4. Switch company → page refreshes with new context
5. Single-company user → dropdown shows one option

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/layout/Sidebar.tsx
git commit -m "feat: add company switcher dropdown to sidebar"
git push
```

### Task 5: Add Tabs to MyTeamsPage

**Files:**
- Modify: `frontend/src/pages/dashboard/MyTeamsPage.tsx`

- [ ] **Step 1: Add tabs for "Meine Teams" and "Alle Teams"**

Add a `tab` state and filter logic:

```typescript
const [tab, setTab] = useState<'mine' | 'all'>('mine');

// Filter teams based on active tab
const filteredTeams = tab === 'mine'
  ? teams.filter((t: any) => t.memberships?.some((m: any) => m.userId === user?.id))
  : teams;
```

Add tab UI after the header (between the header div and the create form):

```tsx
{/* Tabs */}
<div className="mt-4 flex gap-6 border-b-2 border-[#E2E8F0]">
  <button
    onClick={() => setTab('mine')}
    className={`pb-3 text-sm font-medium transition-colors ${
      tab === 'mine'
        ? 'border-b-2 border-[#0B8ECA] text-[#0B8ECA] -mb-[2px]'
        : 'text-[#64748B] hover:text-[#1E293B]'
    }`}
  >
    Meine Teams
  </button>
  <button
    onClick={() => setTab('all')}
    className={`pb-3 text-sm font-medium transition-colors ${
      tab === 'all'
        ? 'border-b-2 border-[#0B8ECA] text-[#0B8ECA] -mb-[2px]'
        : 'text-[#64748B] hover:text-[#1E293B]'
    }`}
  >
    Alle Teams
  </button>
</div>
```

Use `filteredTeams` instead of `teams` in the card grid.

On the "Alle Teams" tab, for teams the user is NOT a member of, show a "Beitreten" button instead of the "Mitglied" badge. Clicking "Beitreten" calls `POST /api/admin/teams/:id/join` via `apiRequest`, then reloads the teams list.

```tsx
{isMember(team) ? (
  <span className="rounded-full bg-[#0B8ECA]/10 px-2 py-0.5 text-xs font-medium text-[#0B8ECA]">
    Mitglied
  </span>
) : tab === 'all' ? (
  <button
    onClick={(e) => { e.preventDefault(); handleJoin(team.id); }}
    className="rounded-full bg-[#14B8A6]/10 px-2 py-0.5 text-xs font-medium text-[#14B8A6] hover:bg-[#14B8A6]/20"
  >
    Beitreten
  </button>
) : null}
```

Add `handleJoin`:

```typescript
const handleJoin = async (teamId: string) => {
  try {
    await apiRequest(`/admin/teams/${teamId}/join`, { method: 'POST' });
    load();
  } catch (err: any) {
    setError(err.message);
  }
};
```

Import `apiRequest` from `../../api/client`.

Update empty states per tab:
- "Meine Teams" empty: "Du bist noch keinem Team beigetreten."
- "Alle Teams" empty: "Keine Teams in dieser Firma vorhanden."

- [ ] **Step 2: Verify**

1. "Meine Teams" tab shows only teams user is member of
2. "Alle Teams" tab shows all company teams
3. Non-member teams show "Beitreten" button
4. Clicking "Beitreten" joins and refreshes
5. Switching company (via sidebar) refreshes team list

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/dashboard/MyTeamsPage.tsx
git commit -m "feat: add Meine Teams / Alle Teams tabs to MyTeamsPage"
git push
```

---

## Verification

- [ ] **Company dropdown**: Shows in sidebar, lists all user companies with roles
- [ ] **Company switch**: Changes context, all pages reflect new company
- [ ] **Session preservation**: Refreshing page keeps selected company (not reset to first)
- [ ] **Meine Teams**: Only shows teams user belongs to
- [ ] **Alle Teams**: Shows all company teams with join option
- [ ] **Role update**: Switching to a company where user is admin shows admin nav items
