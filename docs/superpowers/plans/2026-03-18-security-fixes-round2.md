# Security & Correctness Fixes — Round 2

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all CRITICAL and HIGH findings from the security and code quality reviews: cross-tenant IDOR in event types and teams, open registration, OAuth CSRF, booking access org scoping, API key company context, round-robin bug, and booking race condition.

**Architecture:** Apply the same org-filter pattern used in users.ts/company.ts to event-types.ts and teams.ts. Add `allowedDomains` to the Organization model for registration restriction. Add OAuth state parameter validation. Fix the round-robin sequential lookup key. Wrap 1:1 booking creation in a serializable transaction.

**Tech Stack:** Fastify, Prisma, PostgreSQL, Zod, Vitest

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `backend/src/routes/admin/event-types.ts` | Modify | Add org filters to all 6 endpoints |
| `backend/src/routes/admin/teams.ts` | Modify | Add org filters to all endpoints |
| `backend/src/services/google-auth.ts` | Modify | Add domain restriction for new users |
| `backend/src/routes/auth.ts` | Modify | Add OAuth state parameter CSRF protection |
| `backend/src/routes/admin/users.ts` | Modify | Add org scoping to `checkBookingAccess` |
| `backend/src/middleware/api-key.ts` | Modify | Use `companyId` from API key or header |
| `backend/src/services/round-robin.ts` | Modify | Fix `rrConfig.id` → `teamId` bug |
| `backend/src/routes/booking.ts` | Modify | Wrap 1:1 booking in serializable transaction |
| `backend/prisma/schema.prisma` | Modify | Add `allowedDomains` to Organization, `companyId` to ApiKey |

---

### Task 1: Add org filter to all event type endpoints

**Files:**
- Modify: `backend/src/routes/admin/event-types.ts`

All 6 endpoints need org isolation. The pattern: for `:companyId` params, verify the company belongs to the user's org. For `:id` params, verify the event type's company belongs to the user's org.

- [ ] **Step 1: Fix POST /api/admin/companies/:companyId/event-types (line 26)**

Add org check. Replace:
```typescript
  }, async (request, reply) => {
    const { companyId } = request.params as { companyId: string };
    const body = CreateEventTypeSchema.parse(request.body);
```

With:
```typescript
  }, async (request, reply) => {
    const { companyId } = request.params as { companyId: string };
    const user = request.session.user!;

    const company = await prisma.company.findFirst({
      where: { id: companyId, organizationId: user.organizationId },
    });
    if (!company) return reply.status(404).send({ error: 'Company not found' });

    const body = CreateEventTypeSchema.parse(request.body);
```

- [ ] **Step 2: Fix GET /api/admin/companies/:companyId/event-types (line 60)**

Change handler from `async (request)` to `async (request, reply)` and add org check:
```typescript
  }, async (request, reply) => {
    const { companyId } = request.params as { companyId: string };
    const user = request.session.user!;

    const company = await prisma.company.findFirst({
      where: { id: companyId, organizationId: user.organizationId },
    });
    if (!company) return reply.status(404).send({ error: 'Company not found' });

    return prisma.eventType.findMany({
      where: { companyId },
```

- [ ] **Step 3: Fix GET /api/admin/event-types/:id (line 84)**

Replace `findUnique` with `findFirst` + org filter:
```typescript
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = request.session.user!;
    const eventType = await prisma.eventType.findFirst({
      where: { id, company: { organizationId: user.organizationId } },
      include: {
        team: { select: { id: true, name: true } },
        user: { select: { id: true, name: true } },
        formFields: { orderBy: { order: 'asc' } },
      },
    });
    if (!eventType) return reply.status(404).send({ error: 'Event type not found' });
    return eventType;
  });
```

- [ ] **Step 4: Fix PATCH /api/admin/event-types/:id (line 110)**

Replace:
```typescript
  }, async (request) => {
    const { id } = request.params as { id: string };
    const body = UpdateEventTypeSchema.parse(request.body);
    return prisma.eventType.update({ where: { id }, data: body });
  });
```

With:
```typescript
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = request.session.user!;
    const body = UpdateEventTypeSchema.parse(request.body);

    const eventType = await prisma.eventType.findFirst({
      where: { id, company: { organizationId: user.organizationId } },
    });
    if (!eventType) return reply.status(404).send({ error: 'Event type not found' });

    return prisma.eventType.update({ where: { id }, data: body });
  });
```

- [ ] **Step 5: Fix DELETE /api/admin/event-types/:id (line 127)**

Replace:
```typescript
  }, async (request) => {
    const { id } = request.params as { id: string };
    await prisma.eventType.delete({ where: { id } });
    return { success: true };
  });
```

With:
```typescript
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = request.session.user!;

    const eventType = await prisma.eventType.findFirst({
      where: { id, company: { organizationId: user.organizationId } },
    });
    if (!eventType) return reply.status(404).send({ error: 'Event type not found' });

    await prisma.eventType.delete({ where: { id } });
    return { success: true };
  });
```

- [ ] **Step 6: Fix PATCH /api/admin/event-types/:id/toggle (line 144)**

Replace:
```typescript
  }, async (request) => {
    const { id } = request.params as { id: string };
    const current = await prisma.eventType.findUniqueOrThrow({ where: { id } });
    return prisma.eventType.update({ where: { id }, data: { active: !current.active } });
  });
```

With:
```typescript
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = request.session.user!;

    const current = await prisma.eventType.findFirst({
      where: { id, company: { organizationId: user.organizationId } },
    });
    if (!current) return reply.status(404).send({ error: 'Event type not found' });

    return prisma.eventType.update({ where: { id }, data: { active: !current.active } });
  });
```

- [ ] **Step 7: Run tests and commit**

Run: `cd /Users/hziech/calendfree && npx vitest run backend/src/__tests__/admin-users.test.ts`

```bash
git add backend/src/routes/admin/event-types.ts
git commit -m "fix: add org isolation to all event type endpoints"
git push
```

---

### Task 2: Add org filter to all team endpoints

**Files:**
- Modify: `backend/src/routes/admin/teams.ts`

Many endpoints here. The pattern:
- For `:companyId` params: verify company belongs to user's org
- For `:id` / `:teamId` params: verify the team's company belongs to user's org via `company: { organizationId }`
- Update `canManageTeam` to also check org ownership

- [ ] **Step 1: Update canManageTeam to accept organizationId and check org ownership**

Replace:
```typescript
async function canManageTeam(userId: string, userRole: string, teamId: string): Promise<boolean> {
  if (userRole === 'ORG_ADMIN' || userRole === 'COMPANY_ADMIN') return true;
  const membership = await prisma.teamMembership.findUnique({
    where: { userId_teamId: { userId, teamId } },
  });
  return membership?.role === 'OWNER';
}
```

With:
```typescript
async function canManageTeam(userId: string, userRole: string, teamId: string, organizationId: string): Promise<{ allowed: boolean; team: any }> {
  const team = await prisma.team.findFirst({
    where: { id: teamId, company: { organizationId } },
  });
  if (!team) return { allowed: false, team: null };

  if (userRole === 'ORG_ADMIN' || userRole === 'COMPANY_ADMIN') return { allowed: true, team };
  const membership = await prisma.teamMembership.findUnique({
    where: { userId_teamId: { userId, teamId } },
  });
  return { allowed: membership?.role === 'OWNER', team };
}
```

- [ ] **Step 2: Fix POST /api/admin/companies/:companyId/teams (line 46)**

Add org check after getting user:
```typescript
  }, async (request, reply) => {
    const { companyId } = request.params as { companyId: string };
    const user = request.session.user!;

    const company = await prisma.company.findFirst({
      where: { id: companyId, organizationId: user.organizationId },
    });
    if (!company) return reply.status(404).send({ error: 'Company not found' });

    const body = CreateTeamSchema.parse(request.body);
```

- [ ] **Step 3: Fix GET /api/admin/companies/:companyId/teams (line 78)**

Change to `async (request, reply)` and add org check:
```typescript
  }, async (request, reply) => {
    const { companyId } = request.params as { companyId: string };
    const user = request.session.user!;

    const company = await prisma.company.findFirst({
      where: { id: companyId, organizationId: user.organizationId },
    });
    if (!company) return reply.status(404).send({ error: 'Company not found' });

    return prisma.team.findMany({
      where: { companyId },
```

- [ ] **Step 4: Fix GET /api/admin/teams/:id (line 99)**

Replace `findUnique` with `findFirst` + org filter:
```typescript
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = request.session.user!;
    const team = await prisma.team.findFirst({
      where: { id, company: { organizationId: user.organizationId } },
      include: {
        rrConfig: true,
        memberships: { include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } } },
        eventTypes: { select: { id: true, title: true, slug: true, active: true, duration: true } },
        company: { select: { slug: true } },
      },
    });
    if (!team) return reply.status(404).send({ error: 'Team not found' });
    return team;
  });
```

- [ ] **Step 5: Fix GET /api/admin/teams/:id/bookings (line 129)**

Add org check to team lookup before membership check:
```typescript
    const { id } = request.params as { id: string };
    const user = request.session.user!;
    // ... query params parsing stays the same ...

    // Verify team belongs to user's org
    const team = await prisma.team.findFirst({
      where: { id, company: { organizationId: user.organizationId } },
    });
    if (!team) return reply.status(404).send({ error: 'Team not found' });

    // Access check: must be a team member
    const membership = await prisma.teamMembership.findUnique({
```

- [ ] **Step 6: Update all canManageTeam callers**

Every call to `canManageTeam` must now pass `user.organizationId` and handle the new return shape. There are 4 callers:
- PATCH teams/:id (line 200): `const { allowed, team } = await canManageTeam(user.id, user.activeRole ?? 'USER', id, user.organizationId); if (!allowed) return reply.status(team ? 403 : 404).send({ error: team ? 'Not authorized' : 'Team not found' });`
- DELETE teams/:id (line 220): same pattern
- PATCH teams/:teamId/members/:userId/role (line 300): same pattern with `teamId`
- DELETE teams/:teamId/members/:userId (line 335): same pattern with `teamId`

- [ ] **Step 7: Fix PUT /api/admin/teams/:id/round-robin (line 237)**

Add org check:
```typescript
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = request.session.user!;

    const team = await prisma.team.findFirst({
      where: { id, company: { organizationId: user.organizationId } },
    });
    if (!team) return reply.status(404).send({ error: 'Team not found' });

    const body = UpdateRoundRobinSchema.parse(request.body);
    return prisma.roundRobinConfig.update({
      where: { teamId: id },
```

- [ ] **Step 8: Fix POST /api/admin/teams/:id/members (line 256)**

Add org check:
```typescript
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = request.session.user!;

    const team = await prisma.team.findFirst({
      where: { id, company: { organizationId: user.organizationId } },
    });
    if (!team) return reply.status(404).send({ error: 'Team not found' });

    const body = AddTeamMemberSchema.parse(request.body);
```

- [ ] **Step 9: Fix PATCH /api/admin/teams/:teamId/members/:userId weight (line 276)**

Add org check:
```typescript
  }, async (request, reply) => {
    const { teamId, userId } = request.params as { teamId: string; userId: string };
    const user = request.session.user!;

    const team = await prisma.team.findFirst({
      where: { id: teamId, company: { organizationId: user.organizationId } },
    });
    if (!team) return reply.status(404).send({ error: 'Team not found' });

    const body = UpdateTeamMemberSchema.parse(request.body);
```

- [ ] **Step 10: Fix POST /api/admin/teams/:id/join (line 364)**

Add org check:
```typescript
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = request.session.user!;

    const team = await prisma.team.findFirst({
      where: { id, company: { organizationId: user.organizationId } },
    });
    if (!team) return reply.status(404).send({ error: 'Team not found' });

    try {
```

- [ ] **Step 11: Fix POST /api/admin/teams/:id/leave (line 387)**

Add org check:
```typescript
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = request.session.user!;

    const team = await prisma.team.findFirst({
      where: { id, company: { organizationId: user.organizationId } },
    });
    if (!team) return reply.status(404).send({ error: 'Team not found' });

    // Last-owner protection
```

- [ ] **Step 12: Fix POST /api/admin/teams/:id/invite (line 421)**

Add org check:
```typescript
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = request.session.user!;

    const team = await prisma.team.findFirst({
      where: { id, company: { organizationId: user.organizationId } },
    });
    if (!team) return reply.status(404).send({ error: 'Team not found' });

    const { email, weight } = request.body as { email: string; weight?: number };
```

- [ ] **Step 13: Run tests and commit**

Run: `cd /Users/hziech/calendfree && npx vitest run backend/src/__tests__/admin-teams.test.ts`

```bash
git add backend/src/routes/admin/teams.ts
git commit -m "fix: add org isolation to all team endpoints"
git push
```

---

### Task 3: Add domain restriction for new user registration

**Files:**
- Modify: `backend/prisma/schema.prisma` — add `allowedDomains` to Organization
- Modify: `backend/src/services/google-auth.ts` — check domain on registration

- [ ] **Step 1: Add allowedDomains to Organization model**

In `backend/prisma/schema.prisma`, add to the Organization model:

```prisma
model Organization {
  id             String   @id @default(uuid())
  name           String
  slug           String   @unique
  allowedDomains String[] @default([])
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  companies Company[]
  users     User[]
  branding  BrandingConfig? @relation("OrgBranding")
}
```

- [ ] **Step 2: Create and run migration**

```bash
cd /Users/hziech/calendfree && npx prisma migrate dev --name add-allowed-domains
```

- [ ] **Step 3: Add domain check in google-auth.ts**

In `backend/src/services/google-auth.ts`, after finding the org (line 52-55), add domain validation:

Replace:
```typescript
  if (!user) {
    const org = await prisma.organization.findFirst();
    if (!org) {
      throw new Error('No organization exists. Please run the seed script first.');
    }

    // Check if this is the first user in the org → make them ORG_ADMIN
```

With:
```typescript
  if (!user) {
    const org = await prisma.organization.findFirst();
    if (!org) {
      throw new Error('No organization exists. Please run the seed script first.');
    }

    // Check email domain restriction (skip if no domains configured = allow all)
    if (org.allowedDomains.length > 0) {
      const emailDomain = email.split('@')[1]?.toLowerCase();
      if (!emailDomain || !org.allowedDomains.includes(emailDomain)) {
        throw new Error('REGISTRATION_NOT_ALLOWED');
      }
    }

    // Check if this is the first user in the org → make them ORG_ADMIN
```

- [ ] **Step 4: Handle the error in auth.ts callback**

In `backend/src/routes/auth.ts`, the catch block at line 80-83 already redirects to login with error. Update it to distinguish registration errors:

Replace:
```typescript
    } catch (err) {
      app.log.error(err, 'OAuth callback failed');
      return reply.redirect(`${config.FRONTEND_URL}/login?error=oauth_failed`);
    }
```

With:
```typescript
    } catch (err: any) {
      if (err.message === 'REGISTRATION_NOT_ALLOWED') {
        return reply.redirect(`${config.FRONTEND_URL}/login?error=registration_not_allowed`);
      }
      app.log.error(err, 'OAuth callback failed');
      return reply.redirect(`${config.FRONTEND_URL}/login?error=oauth_failed`);
    }
```

- [ ] **Step 5: Run tests and commit**

```bash
cd /Users/hziech/calendfree && npx vitest run
git add backend/prisma/ backend/src/services/google-auth.ts backend/src/routes/auth.ts
git commit -m "feat: add email domain restriction for new user registration"
git push
```

---

### Task 4: Add OAuth CSRF protection with state parameter

**Files:**
- Modify: `backend/src/routes/auth.ts`

- [ ] **Step 1: Generate and validate state parameter**

In `backend/src/routes/auth.ts`, update the `/api/auth/google` handler (line 41-44):

Replace:
```typescript
  }, async (request, reply) => {
    const url = getAuthUrl();
    return reply.redirect(url);
  });
```

With:
```typescript
  }, async (request, reply) => {
    const state = crypto.randomUUID();
    request.session.oauthState = state;
    const url = getAuthUrl(state);
    return reply.redirect(url);
  });
```

Add `import crypto from 'node:crypto';` at the top if not already imported (check first — Fastify may already use it).

- [ ] **Step 2: Validate state in callback**

In the callback handler (line 58-84), after checking for error/code, add state validation:

Replace:
```typescript
    if (error || !code) {
      app.log.warn({ error }, 'OAuth callback error');
      return reply.redirect(`${config.FRONTEND_URL}/login?error=oauth_failed`);
    }

    try {
```

With:
```typescript
    if (error || !code) {
      app.log.warn({ error }, 'OAuth callback error');
      return reply.redirect(`${config.FRONTEND_URL}/login?error=oauth_failed`);
    }

    // Validate OAuth state parameter to prevent CSRF
    const { state } = request.query as { code?: string; error?: string; state?: string };
    if (!state || state !== request.session.oauthState) {
      app.log.warn('OAuth state mismatch — possible CSRF');
      return reply.redirect(`${config.FRONTEND_URL}/login?error=invalid_state`);
    }
    delete request.session.oauthState;

    try {
```

Also update the querystring schema to include `state`:
```typescript
      querystring: z.object({
        code: z.string().optional().describe('Authorization code from Google'),
        error: z.string().optional().describe('Error code if OAuth was denied'),
        state: z.string().optional().describe('OAuth state parameter for CSRF protection'),
      }),
```

- [ ] **Step 3: Extend session type for oauthState**

In `backend/src/plugins/session.ts`, update the session type:

```typescript
declare module '@fastify/session' {
  interface FastifySessionObject {
    user?: SessionUser;
    oauthState?: string;
  }
}
```

- [ ] **Step 4: Run tests and commit**

```bash
cd /Users/hziech/calendfree && npx vitest run backend/src/__tests__/auth.test.ts
git add backend/src/routes/auth.ts backend/src/plugins/session.ts
git commit -m "fix: add OAuth state parameter for CSRF protection"
git push
```

---

### Task 5: Add org scoping to checkBookingAccess helper

**Files:**
- Modify: `backend/src/routes/admin/users.ts` — the `checkBookingAccess` function (line 640)

- [ ] **Step 1: Update checkBookingAccess to accept organizationId**

Replace:
```typescript
  async function checkBookingAccess(userId: string, bookingId: string) {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { eventType: { select: { teamId: true } } },
    });
    if (!booking) return { booking: null as any, hasAccess: false };
```

With:
```typescript
  async function checkBookingAccess(userId: string, bookingId: string, organizationId: string) {
    const booking = await prisma.booking.findFirst({
      where: { id: bookingId, eventType: { company: { organizationId } } },
      include: { eventType: { select: { teamId: true } } },
    });
    if (!booking) return { booking: null as any, hasAccess: false };
```

- [ ] **Step 2: Update all callers of checkBookingAccess**

There are 4 callers in users.ts. Each needs to pass `user.organizationId`:
- Line ~672: `const { booking, hasAccess } = await checkBookingAccess(user.id, bookingId, user.organizationId);`
- Line ~712: same
- Line ~744: same
- Line ~747: same

Search for `checkBookingAccess(user.id,` and add the third argument to each.

- [ ] **Step 3: Run tests and commit**

```bash
cd /Users/hziech/calendfree && npx vitest run backend/src/__tests__/admin-users.test.ts
git add backend/src/routes/admin/users.ts
git commit -m "fix: add org scoping to booking access check"
git push
```

---

### Task 6: Fix round-robin sequential bug

**Files:**
- Modify: `backend/src/services/round-robin.ts` — line 92

- [ ] **Step 1: Fix the teamId lookup**

In `backend/src/services/round-robin.ts`, line 92, the `assignSequential` function uses `rrConfig.id` (the RoundRobinConfig ID) instead of the team ID.

Replace:
```typescript
  const memberships = await tx.teamMembership.findMany({
    where: { teamId: rrConfig.id, userId: { in: availableUserIds } },
    orderBy: { userId: 'asc' },
  });
```

With:
```typescript
  const memberships = await tx.teamMembership.findMany({
    where: { teamId: rrConfig.teamId, userId: { in: availableUserIds } },
    orderBy: { userId: 'asc' },
  });
```

Note: The `rrConfig` type already includes `teamId` from the raw SQL query at line 33-38. But the function signature at line 87 only types `id`, `lastAssignedIndex`, `version`. We also need to update the function signature:

Replace:
```typescript
async function assignSequential(
  tx: Prisma.TransactionClient,
  rrConfig: { id: string; lastAssignedIndex: number; version: number },
  availableUserIds: string[],
```

With:
```typescript
async function assignSequential(
  tx: Prisma.TransactionClient,
  rrConfig: { id: string; teamId: string; lastAssignedIndex: number; version: number },
  availableUserIds: string[],
```

- [ ] **Step 2: Run tests and commit**

```bash
cd /Users/hziech/calendfree && npx vitest run backend/src/__tests__/round-robin.test.ts
git add backend/src/services/round-robin.ts
git commit -m "fix: use teamId instead of config id in sequential round-robin"
git push
```

---

### Task 7: Fix race condition in 1:1 booking creation

**Files:**
- Modify: `backend/src/routes/booking.ts` — lines 292-354

The 1:1 (personal) booking path has no transaction protection. Two concurrent requests can both see the same slot as available and create duplicate bookings.

- [ ] **Step 1: Wrap 1:1 booking creation in a serializable transaction**

In `backend/src/routes/booking.ts`, the section starting at line 292 where `assignedUserId` is determined. The personal event type path (line 295-297) and the booking creation (line 334) are separate, non-atomic operations.

Find the `// Create booking in DB` section (around line 333-354) and wrap it in a transaction that re-checks for conflicts:

Replace:
```typescript
    // Create booking in DB
    const booking = await prisma.booking.create({
      data: {
        eventTypeId: eventType.id,
        assignedUserId,
        startTime,
        endTime,
        customerTimezone,
        bookingToken,
        tokenExpiresAt: startTime,
        formData: {
          create: {
            name: body.name,
            email: body.email,
            data: { ...body.formData, ...(body.comment ? { _comment: body.comment } : {}) },
          },
        },
      },
      include: {
        assignedUser: { select: { name: true, email: true } },
      },
    });
```

With:
```typescript
    // Create booking in DB with conflict check (prevents double-booking)
    const booking = await prisma.$transaction(async (tx) => {
      // Re-check for conflicting bookings inside the transaction
      const conflicting = await tx.booking.count({
        where: {
          assignedUserId,
          status: { in: ['CONFIRMED', 'PENDING_CALENDAR_SYNC'] },
          startTime: { lt: endTime },
          endTime: { gt: startTime },
        },
      });
      if (conflicting > 0) {
        throw new Error('SLOT_TAKEN');
      }

      return tx.booking.create({
        data: {
          eventTypeId: eventType.id,
          assignedUserId,
          startTime,
          endTime,
          customerTimezone,
          bookingToken,
          tokenExpiresAt: startTime,
          formData: {
            create: {
              name: body.name,
              email: body.email,
              data: { ...body.formData, ...(body.comment ? { _comment: body.comment } : {}) },
            },
          },
        },
        include: {
          assignedUser: { select: { name: true, email: true } },
        },
      });
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      timeout: 5000,
    });
```

Also need to import `Prisma` if not already imported. Check at the top of the file.

- [ ] **Step 2: Handle the SLOT_TAKEN error**

Find the catch block for the booking creation (or add one). After the transaction, catch `SLOT_TAKEN`:

The transaction is inside a try/catch already (the calendar event creation follows). Add error handling right after the transaction:

After the new transaction block, before the calendar event creation, add:

This will need to catch the `SLOT_TAKEN` error and return a 409. The simplest approach: wrap the transaction in its own try/catch:

```typescript
    let booking;
    try {
      booking = await prisma.$transaction(async (tx) => {
        // ... conflict check + create ...
      }, { isolationLevel: ... });
    } catch (err: any) {
      if (err.message === 'SLOT_TAKEN' || err.code === 'P2034') {
        return reply.status(409).send({ error: 'Slot is no longer available' });
      }
      throw err;
    }
```

- [ ] **Step 3: Run tests and commit**

```bash
cd /Users/hziech/calendfree && npx vitest run backend/src/__tests__/booking.test.ts
git add backend/src/routes/booking.ts
git commit -m "fix: prevent double-booking with serializable transaction"
git push
```

---

### Task 8: Final verification

- [ ] **Step 1: Run full test suite**

Run: `cd /Users/hziech/calendfree && npx vitest run`

- [ ] **Step 2: TypeScript type check**

Run: `cd /Users/hziech/calendfree && npx tsc --noEmit -p backend/tsconfig.json`

- [ ] **Step 3: Verify all changes are pushed**

```bash
git log --oneline -10
git status
```
