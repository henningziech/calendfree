# Team Pages Redesign

## Context

The current MyTeamsPage shows too much inline — member lists, invite fields, round-robin dropdowns, join/leave buttons — all crammed into team cards. The round-robin mode dropdown is incorrectly placed at team creation (RR mode belongs to the EventType/Terminplaner, not the Team). The TeamDetailPage exists but is underused. This redesign simplifies the overview into clickable cards and consolidates all team management into the detail page. Additionally, a team ownership concept is introduced so team creators and designated owners can manage their teams without needing company admin rights.

## Scope

### 1. Data Model: Team Ownership

Add a `role` field to `TeamMembership`:

```prisma
enum TeamRole {
  MEMBER
  OWNER
}

model TeamMembership {
  // ... existing fields (userId, teamId, weight)
  role  TeamRole @default(MEMBER)
}
```

- Creator is automatically assigned `OWNER` role when creating a team
- Multiple members can be OWNER
- Permission model: OWNER + COMPANY_ADMIN + ORG_ADMIN can manage the team (rename, delete, remove members, promote to owner)
- **Last-owner protection:** Cannot leave, remove, or demote the last OWNER of a team. The team must always have at least one OWNER. This is enforced in the backend on all relevant endpoints (leave, remove member, change role).
- Joining a team (via join or invite) always assigns `MEMBER` role.
- API responses for teams must include the `role` field in membership data so the frontend can render role badges and conditional management UI.

### RoundRobinConfig Clarification

The `RoundRobinConfig` model and the `roundRobinMode` field on `EventType` both exist. The **authoritative source for round-robin assignment is `EventType.roundRobinMode`** (the `assignUser` function in `round-robin.ts` already uses the EventType's mode). The `RoundRobinConfig` model stores operational state (`lastAssignedIndex`) needed for SEQUENTIAL mode — it stays but no longer needs a `mode` field set at team creation.

**Changes:**
- `CreateTeamSchema`: Remove `roundRobinMode` (no longer set at team level)
- Team creation endpoint: Still create `RoundRobinConfig` with default `SEQUENTIAL` mode (needed for `lastAssignedIndex` tracking), but don't expose mode selection to users at team creation
- The existing `PUT /api/admin/teams/:id/round-robin` endpoint stays for now (may be used by admin pages) but is not exposed in the user-facing team UI
- No data migration needed — existing teams keep their RoundRobinConfig, EventType.roundRobinMode remains authoritative

### 2. MyTeamsPage — Simplified Overview

**Remove:**
- Round-robin mode dropdown from team creation form
- Inline member lists, invite fields, join/leave buttons
- Per-team action buttons

**Keep/Add:**
- Simple team cards: team name, member count, click → `/dashboard/teams/:teamId`
- "+ Neues Team" button with only a name input (no RR dropdown)
- "Mitglied" badge if user is part of the team

### 3. TeamDetailPage — Full Management

**Header section:**
- Team name (click-to-edit with save/cancel for Owner/Admin)
- "Team löschen" button (Owner/Admin only, with confirmation)

**Members section:**
- List of members: avatar, name, role badge (Owner/Mitglied), weight
- "Mitglied einladen" button → inline email input
- Per-member actions (Owner/Admin only):
  - "Entfernen" — remove from team
  - "Zum Owner machen" / "Owner entfernen" — toggle owner role
- "Beitreten" button (if not a member)
- "Team verlassen" button (if a member, but not the last owner)

**Event Types section** (existing, keep as-is):
- List of team event types with title, duration, active badge, copy URL

**Bookings section** (existing, keep as-is):
- Filter by member, upcoming/past toggle, pagination

### 4. Backend Changes

**New/modified endpoints:**
- `POST /api/admin/companies/:companyId/teams` — remove `roundRobinMode` from creation, auto-set creator as OWNER
- `PATCH /api/admin/teams/:id` — update team name (Owner/Admin only)
- `PATCH /api/admin/teams/:teamId/members/:userId/role` — change member role (Owner/Admin only). Uses new `UpdateTeamMemberRoleSchema` with `z.enum(['MEMBER', 'OWNER'])` (NOT the existing `UpdateMembershipRoleSchema` which validates user roles).
- Existing delete/remove endpoints: add Owner permission check alongside Admin
- All management endpoints verify the team belongs to the user's company (tenant isolation)

**Permission logic:**
```
canManageTeam(user, team) =
  user.role in [ORG_ADMIN, COMPANY_ADMIN]
  OR user has OWNER role in team.memberships
```

### Files to modify

**Backend:**
- `backend/prisma/schema.prisma` — TeamRole enum, role field on TeamMembership
- `backend/src/routes/admin/teams.ts` (or wherever team routes live) — permission checks, new role endpoint
- `shared/src/schemas/admin.ts` — remove roundRobinMode from CreateTeamSchema, add `UpdateTeamMemberRoleSchema`

**Frontend:**
- `frontend/src/pages/dashboard/MyTeamsPage.tsx` — simplify to card list
- `frontend/src/pages/dashboard/TeamDetailPage.tsx` — add member management, inline name editing, delete team
- `frontend/src/api/admin.ts` — add updateTeamName, updateMemberRole API functions

## Verification

1. **Team creation**: Only name field, no RR dropdown, creator becomes OWNER
2. **MyTeamsPage**: Clean card list, click navigates to detail
3. **TeamDetailPage**: Shows members with roles, invite works, remove works (Owner/Admin)
4. **Ownership**: Owner can rename, delete, manage members. Non-owner members cannot.
5. **Admin override**: COMPANY_ADMIN/ORG_ADMIN can do everything regardless of ownership
6. **No regression**: Existing team bookings, event types, round-robin assignment still work
