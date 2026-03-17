# Team Pages Redesign Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Simplify MyTeamsPage to a card list, consolidate all team management into TeamDetailPage, and add team ownership (MEMBER/OWNER roles) so team owners can manage without admin rights.

**Architecture:** Add `TeamRole` enum + `role` field to `TeamMembership`. Add self-service endpoints for role changes. Simplify MyTeamsPage to clickable cards. Rebuild TeamDetailPage with member management, inline name editing, and team deletion. Backend enforces last-owner protection.

**Tech Stack:** Prisma (schema migration), Zod (validation), Fastify (endpoints), React + Tailwind (UI)

**Spec:** `docs/superpowers/specs/2026-03-17-team-pages-redesign.md`

---

## Chunk 1: Backend — Schema + Endpoints

### Task 1: Add TeamRole to Prisma Schema

**Files:**
- Modify: `backend/prisma/schema.prisma`

- [ ] **Step 1: Add TeamRole enum and role field**

Add the enum after the existing `RoundRobinMode` enum:

```prisma
enum TeamRole {
  MEMBER
  OWNER
}
```

Add the `role` field to the `TeamMembership` model (after the `weight` field):

```prisma
  role  TeamRole @default(MEMBER)
```

- [ ] **Step 2: Run migration**

```bash
cd /Users/hziech/calendfree
npx prisma migrate dev --name add_team_role --schema backend/prisma/schema.prisma
npx prisma generate --schema backend/prisma/schema.prisma
```

- [ ] **Step 3: Commit**

```bash
git add backend/prisma/
git commit -m "feat: add TeamRole enum and role field to TeamMembership"
git push
```

### Task 2: Update Zod Schemas

**Files:**
- Modify: `shared/src/schemas/admin.ts`

- [ ] **Step 1: Remove roundRobinMode from CreateTeamSchema**

Find `CreateTeamSchema` (around line 15-18). Change from:
```typescript
export const CreateTeamSchema = z.object({
  name: z.string().min(1).max(255),
  roundRobinMode: z.enum(['SEQUENTIAL', 'LEAST_BUSY', 'WEIGHTED']).default('SEQUENTIAL'),
});
```

To:
```typescript
export const CreateTeamSchema = z.object({
  name: z.string().min(1).max(255),
});
```

- [ ] **Step 2: Add UpdateTeamMemberRoleSchema**

Add after the existing `UpdateTeamMemberSchema`:

```typescript
export const UpdateTeamMemberRoleSchema = z.object({
  role: z.enum(['MEMBER', 'OWNER']),
});
export type UpdateTeamMemberRole = z.infer<typeof UpdateTeamMemberRoleSchema>;
```

- [ ] **Step 3: Commit**

```bash
git add shared/src/schemas/admin.ts
git commit -m "feat: remove roundRobinMode from CreateTeamSchema, add UpdateTeamMemberRoleSchema"
git push
```

### Task 3: Update Backend Team Routes

**Files:**
- Modify: `backend/src/routes/admin/teams.ts`

- [ ] **Step 1: Update team creation (POST, around line 13-28)**

Remove `roundRobinMode` from the destructured body. The `RoundRobinConfig` should still be created with a default `SEQUENTIAL` mode. Auto-set creator as OWNER:

Change the membership creation from:
```typescript
await prisma.teamMembership.create({
  data: { teamId: team.id, userId: user.id, weight: 100 },
});
```
To:
```typescript
await prisma.teamMembership.create({
  data: { teamId: team.id, userId: user.id, weight: 100, role: 'OWNER' },
});
```

- [ ] **Step 2: Add canManageTeam helper function**

At the top of the route file (after imports), add:

```typescript
/** Check if user can manage a team (is Owner or Company/Org Admin). */
async function canManageTeam(userId: string, userRole: string, teamId: string): Promise<boolean> {
  if (userRole === 'ORG_ADMIN' || userRole === 'COMPANY_ADMIN') return true;
  const membership = await prisma.teamMembership.findUnique({
    where: { userId_teamId: { userId, teamId } },
  });
  return membership?.role === 'OWNER';
}
```

- [ ] **Step 3: Add role update endpoint**

Add after the existing member weight update endpoint (around line 161):

```typescript
/** Update team member role (MEMBER/OWNER). Owner/Admin only. */
app.patch('/api/admin/teams/:teamId/members/:userId/role', { preHandler: [requireAuth] }, async (request, reply) => {
  const { teamId, userId: targetUserId } = request.params as { teamId: string; userId: string };
  const user = request.session.user!;

  if (!(await canManageTeam(user.id, user.activeRole ?? 'USER', teamId))) {
    return reply.status(403).send({ error: 'Not authorized' });
  }

  const body = UpdateTeamMemberRoleSchema.parse(request.body);

  // Last-owner protection: cannot demote last owner
  if (body.role === 'MEMBER') {
    const ownerCount = await prisma.teamMembership.count({
      where: { teamId, role: 'OWNER' },
    });
    const target = await prisma.teamMembership.findUnique({
      where: { userId_teamId: { userId: targetUserId, teamId } },
    });
    if (target?.role === 'OWNER' && ownerCount <= 1) {
      return reply.status(400).send({ error: 'Cannot demote the last owner' });
    }
  }

  return prisma.teamMembership.update({
    where: { userId_teamId: { userId: targetUserId, teamId } },
    data: { role: body.role },
  });
});
```

Import `UpdateTeamMemberRoleSchema` from shared schemas at the top.

- [ ] **Step 4: Add last-owner protection to leave and remove endpoints**

In the **leave endpoint** (POST `/teams/:id/leave`, around line 188-195), before deleting the membership:

```typescript
// Last-owner protection
const membership = await prisma.teamMembership.findUnique({
  where: { userId_teamId: { userId: user.id, teamId: id } },
});
if (membership?.role === 'OWNER') {
  const ownerCount = await prisma.teamMembership.count({ where: { teamId: id, role: 'OWNER' } });
  if (ownerCount <= 1) {
    return reply.status(400).send({ error: 'Cannot leave as the last owner. Transfer ownership first.' });
  }
}
```

In the **remove member endpoint** (DELETE `/teams/:teamId/members/:userId`, around line 164-170), add the same protection + permission check:

```typescript
// Permission check
const user = request.session.user!;
if (!(await canManageTeam(user.id, user.activeRole ?? 'USER', teamId))) {
  return reply.status(403).send({ error: 'Not authorized' });
}

// Last-owner protection
const target = await prisma.teamMembership.findUnique({
  where: { userId_teamId: { userId, teamId } },
});
if (target?.role === 'OWNER') {
  const ownerCount = await prisma.teamMembership.count({ where: { teamId, role: 'OWNER' } });
  if (ownerCount <= 1) {
    return reply.status(400).send({ error: 'Cannot remove the last owner' });
  }
}
```

- [ ] **Step 5: Add permission check to team update and delete endpoints**

For PATCH `/teams/:id` (around line 119) and DELETE `/teams/:id` (around line 127), add `canManageTeam` check at the start of each handler.

- [ ] **Step 6: Include role in team API responses**

In GET endpoints (list teams, get team detail), ensure `role` is included in the membership `select`/`include`. The existing queries use `include: { memberships: { include: { user: true } } }` — since `role` is a scalar field on TeamMembership, Prisma includes it by default. Verify this is the case.

- [ ] **Step 7: Rebuild shared package and commit**

```bash
cd /Users/hziech/calendfree/shared && npm run build && cd ..
git add backend/src/routes/admin/teams.ts shared/src/schemas/admin.ts
git commit -m "feat: add team ownership endpoints with last-owner protection"
git push
```

---

## Chunk 2: Frontend

### Task 4: Add Frontend API Functions

**Files:**
- Modify: `frontend/src/api/admin.ts`

- [ ] **Step 1: Add new API functions**

```typescript
export async function updateTeamName(teamId: string, name: string) {
  return apiRequest(`/admin/teams/${teamId}`, {
    method: 'PATCH',
    body: JSON.stringify({ name }),
  });
}

export async function updateTeamMemberRole(teamId: string, userId: string, role: 'MEMBER' | 'OWNER') {
  return apiRequest(`/admin/teams/${teamId}/members/${userId}/role`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/api/admin.ts
git commit -m "feat: add updateTeamName and updateTeamMemberRole API functions"
git push
```

### Task 5: Simplify MyTeamsPage

**Files:**
- Modify: `frontend/src/pages/dashboard/MyTeamsPage.tsx`

- [ ] **Step 1: Rewrite to simple card list**

Replace the entire component. The new version:

- Header: "Teams" title + "+ Neues Team" button
- Create form: only name input (no RR dropdown), submit creates team and navigates to detail
- Team cards: simple cards with team name, member count, "Mitglied" badge if user is member
- Each card is a clickable link to `/dashboard/teams/:teamId`
- No inline member lists, no invite forms, no join/leave buttons, no RR badges

```tsx
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '../../context/AuthContext';
import { getTeams, createTeam } from '../../api/admin';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ErrorMessage } from '../../components/ui/ErrorMessage';

export function MyTeamsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [teams, setTeams] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');

  const companyId = user?.companyMemberships?.[0]?.companyId;

  const load = async () => {
    if (!companyId) return;
    setIsLoading(true);
    try {
      setTeams(await getTeams(companyId));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, [companyId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId || !newName.trim()) return;
    try {
      const team = await createTeam(companyId, { name: newName.trim() });
      setNewName('');
      setShowCreate(false);
      navigate(`/dashboard/teams/${team.id}`);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const isMember = (team: any) =>
    team.memberships?.some((m: any) => m.userId === user?.id);

  if (isLoading) return <LoadingSpinner />;

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#1E293B]">Teams</h1>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="rounded-xl bg-gradient-to-r from-[#0B8ECA] to-[#14B8A6] px-4 py-2 text-sm font-medium text-white shadow-sm hover:shadow-md"
        >
          + Neues Team
        </button>
      </div>

      {error && <ErrorMessage message={error} />}

      {showCreate && (
        <form onSubmit={handleCreate} className="mt-4 rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-sm">
          <label className="block text-sm font-medium text-[#1E293B]">Teamname</label>
          <div className="mt-1 flex gap-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="z.B. Vertrieb, Support"
              className="flex-1 rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm focus:border-[#0B8ECA] focus:outline-none"
              autoFocus
            />
            <button type="submit" className="rounded-xl bg-[#0B8ECA] px-4 py-2 text-sm font-medium text-white">
              Erstellen
            </button>
            <button type="button" onClick={() => setShowCreate(false)} className="rounded-xl border border-[#E2E8F0] px-4 py-2 text-sm text-[#64748B]">
              Abbrechen
            </button>
          </div>
        </form>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {teams.map((team: any) => (
          <Link
            key={team.id}
            to={`/dashboard/teams/${team.id}`}
            className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-sm transition-all hover:border-[#0B8ECA]/30 hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-[#1E293B]">{team.name}</h3>
              {isMember(team) && (
                <span className="rounded-full bg-[#0B8ECA]/10 px-2 py-0.5 text-xs font-medium text-[#0B8ECA]">
                  Mitglied
                </span>
              )}
            </div>
            <p className="mt-2 text-sm text-[#64748B]">
              {team.memberships?.length ?? 0} Mitglieder · {team._count?.eventTypes ?? team.eventTypes?.length ?? 0} Event-Typen
            </p>
          </Link>
        ))}
      </div>

      {!isLoading && teams.length === 0 && !showCreate && (
        <div className="mt-12 text-center">
          <p className="text-lg text-[#64748B]">Noch keine Teams vorhanden</p>
          <p className="text-sm text-[#94A3B8]">Erstelle ein Team, um Termine im Round-Robin-Verfahren zu verteilen.</p>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/dashboard/MyTeamsPage.tsx
git commit -m "feat: simplify MyTeamsPage to clean card list"
git push
```

### Task 6: Rebuild TeamDetailPage with Member Management

**Files:**
- Modify: `frontend/src/pages/dashboard/TeamDetailPage.tsx`

- [ ] **Step 1: Rewrite TeamDetailPage**

The new page should have these sections:

**Header:**
- Back link to `/dashboard/teams`
- Team name — click-to-edit for Owner/Admin (shows input + save/cancel on click)
- "Team löschen" button (Owner/Admin only, with `confirm()` dialog)

**Members section:**
- "Mitglieder" heading with member count
- "Mitglied einladen" button → inline email input with invite button
- "Beitreten" button (if current user is not a member)
- Member list table/cards:
  - Avatar (or initials), name, email
  - Role badge: "Owner" (teal) or "Mitglied" (gray)
  - Weight display (if team uses weighted RR)
  - Actions (Owner/Admin only):
    - "Zum Owner machen" / "Owner entfernen" button
    - "Entfernen" button (with confirm)
- "Team verlassen" button at bottom (if member, with last-owner warning)

**Event Types section** (keep existing):
- List of team event types

**Bookings section** (keep existing):
- Filters, BookingCard list, pagination

**Permission helper:**
```typescript
const canManage = () => {
  const role = user?.activeRole ?? 'USER';
  if (role === 'ORG_ADMIN' || role === 'COMPANY_ADMIN') return true;
  const myMembership = team.memberships?.find((m: any) => m.userId === user?.id);
  return myMembership?.role === 'OWNER';
};
```

**Key imports to add:**
```typescript
import { updateTeamName, updateTeamMemberRole, deleteTeam, removeTeamMember } from '../../api/admin';
```

**Key handlers:**
```typescript
const handleRename = async () => {
  await updateTeamName(teamId!, editName);
  setEditing(false);
  loadTeam();
};

const handleDelete = async () => {
  if (!confirm('Team wirklich löschen? Alle zugehörigen Event-Typen verlieren die Team-Zuordnung.')) return;
  await deleteTeam(teamId!);
  navigate('/dashboard/teams');
};

const handleToggleRole = async (memberId: string, currentRole: string) => {
  const newRole = currentRole === 'OWNER' ? 'MEMBER' : 'OWNER';
  try {
    await updateTeamMemberRole(teamId!, memberId, newRole);
    loadTeam();
  } catch (err: any) {
    alert(err.message || 'Fehler beim Ändern der Rolle');
  }
};

const handleRemoveMember = async (memberId: string, memberName: string) => {
  if (!confirm(`${memberName} wirklich aus dem Team entfernen?`)) return;
  try {
    await removeTeamMember(teamId!, memberId);
    loadTeam();
  } catch (err: any) {
    alert(err.message || 'Fehler beim Entfernen');
  }
};

const handleInvite = async () => {
  if (!inviteEmail.trim()) return;
  await apiRequest(`/admin/teams/${teamId}/invite`, {
    method: 'POST',
    body: JSON.stringify({ email: inviteEmail }),
  });
  setInviteEmail('');
  setInviteSuccess(true);
  setTimeout(() => setInviteSuccess(false), 3000);
  loadTeam();
};

const handleJoin = async () => {
  await apiRequest(`/admin/teams/${teamId}/join`, { method: 'POST' });
  loadTeam();
};

const handleLeave = async () => {
  if (!confirm('Team wirklich verlassen?')) return;
  try {
    await apiRequest(`/admin/teams/${teamId}/leave`, { method: 'POST' });
    navigate('/dashboard/teams');
  } catch (err: any) {
    alert(err.message || 'Fehler');
  }
};
```

- [ ] **Step 2: Verify**

1. Navigate to `/dashboard/teams` → see clean card list
2. Click a team → see detail page with members, event types, bookings
3. As owner: rename team, invite member, remove member, toggle role
4. As non-owner: only see members, join/leave
5. Try removing last owner → should get error
6. Try leaving as last owner → should get error
7. Delete team → navigates back to list

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/dashboard/TeamDetailPage.tsx
git commit -m "feat: rebuild TeamDetailPage with member management and ownership"
git push
```

---

## Verification

- [ ] **Team creation**: Only name field, creator becomes OWNER
- [ ] **MyTeamsPage**: Clean cards, click navigates to detail
- [ ] **TeamDetailPage**: Members with roles, invite, remove, role toggle
- [ ] **Ownership**: Owner can rename, delete, manage. Non-owner cannot.
- [ ] **Last-owner protection**: Cannot leave/remove/demote last owner
- [ ] **Admin override**: COMPANY_ADMIN/ORG_ADMIN can do everything
- [ ] **No regression**: Existing bookings, event types, round-robin still work
