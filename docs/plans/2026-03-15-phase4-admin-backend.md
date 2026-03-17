# Calendfree Phase 4: Admin Backend — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement all admin CRUD APIs: Organization, Company, Team, User management, Event Types, Branding, Availability config, and API Key generation. These endpoints power the admin panel (Phase 6).

**Architecture:** RESTful routes organized by resource. All admin routes require authentication + RBAC. Tenant isolation via middleware ensures data scoping. Shared Zod schemas validate all request bodies.

**Tech Stack:** Fastify routes, Prisma, Zod validation, crypto (API key generation)

---

## Chunk 1: Organization & Company APIs

### Task 1: Add Admin Schemas to Shared Package

**Files:**
- Create: `shared/src/schemas/admin.ts`
- Modify: `shared/src/index.ts`

- [ ] **Step 1: Create admin schemas**

```typescript
// shared/src/schemas/admin.ts
import { z } from 'zod';
import { SlugSchema, BrandingConfigSchema } from './organization.js';
import { RoleSchema } from './auth.js';

// Company management
export const UpdateCompanySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  slug: SlugSchema.optional(),
  customDomain: z.string().max(255).nullable().optional(),
});
export type UpdateCompany = z.infer<typeof UpdateCompanySchema>;

// Team management
export const CreateTeamSchema = z.object({
  name: z.string().min(1).max(255),
  roundRobinMode: z.enum(['SEQUENTIAL', 'LEAST_BUSY', 'WEIGHTED']).default('SEQUENTIAL'),
});
export type CreateTeam = z.infer<typeof CreateTeamSchema>;

export const UpdateTeamSchema = z.object({
  name: z.string().min(1).max(255).optional(),
});
export type UpdateTeam = z.infer<typeof UpdateTeamSchema>;

export const AddTeamMemberSchema = z.object({
  userId: z.string().uuid(),
  weight: z.number().int().min(1).max(100).default(100),
});
export type AddTeamMember = z.infer<typeof AddTeamMemberSchema>;

export const UpdateTeamMemberSchema = z.object({
  weight: z.number().int().min(1).max(100),
});
export type UpdateTeamMember = z.infer<typeof UpdateTeamMemberSchema>;

export const UpdateRoundRobinSchema = z.object({
  mode: z.enum(['SEQUENTIAL', 'LEAST_BUSY', 'WEIGHTED']),
});
export type UpdateRoundRobin = z.infer<typeof UpdateRoundRobinSchema>;

// User / membership management
export const InviteUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(255),
  role: RoleSchema.default('USER'),
});
export type InviteUser = z.infer<typeof InviteUserSchema>;

export const UpdateMembershipRoleSchema = z.object({
  role: RoleSchema,
});
export type UpdateMembershipRole = z.infer<typeof UpdateMembershipRoleSchema>;

// Event type management
export const CreateEventTypeSchema = z.object({
  title: z.string().min(1).max(255),
  slug: SlugSchema,
  description: z.string().max(2000).optional(),
  duration: z.number().int().min(5).max(480).default(30),
  bufferBefore: z.number().int().min(0).max(120).default(0),
  bufferAfter: z.number().int().min(0).max(120).default(0),
  minNotice: z.number().int().min(0).max(720).default(4),
  maxAdvance: z.number().int().min(1).max(365).default(60),
  autoMeetLink: z.boolean().default(true),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  teamId: z.string().uuid().nullable().optional(),
  formFields: z.array(z.object({
    label: z.string().min(1).max(255),
    type: z.enum(['text', 'email', 'phone', 'select', 'textarea']).default('text'),
    required: z.boolean().default(false),
    options: z.array(z.string()).default([]),
  })).default([]),
});
export type CreateEventType = z.infer<typeof CreateEventTypeSchema>;

export const UpdateEventTypeSchema = CreateEventTypeSchema.partial().omit({ slug: true, formFields: true });
export type UpdateEventType = z.infer<typeof UpdateEventTypeSchema>;

// Availability
export const UpdateAvailabilitySchema = z.object({
  weeklySchedule: z.record(z.array(z.object({
    start: z.string().regex(/^\d{2}:\d{2}$/),
    end: z.string().regex(/^\d{2}:\d{2}$/),
  }))).optional(),
  maxPerDay: z.number().int().min(1).max(50).nullable().optional(),
  maxPerWeek: z.number().int().min(1).max(200).nullable().optional(),
});
export type UpdateAvailability = z.infer<typeof UpdateAvailabilitySchema>;

// API Key
export const CreateApiKeySchema = z.object({
  name: z.string().min(1).max(255),
  expiresAt: z.string().datetime().nullable().optional(),
});
export type CreateApiKey = z.infer<typeof CreateApiKeySchema>;
```

- [ ] **Step 2: Export from shared index**

Add to `shared/src/index.ts`:
```typescript
export * from './schemas/admin.js';
```

- [ ] **Step 3: Build shared, commit + push**

```bash
cd /Users/hziech/calendfree && npm run build -w shared && git add shared/ && git commit -m "feat: add admin Zod schemas for teams, event types, availability, and API keys" && git push
```

---

### Task 2: Organization & Company Routes

**Files:**
- Create: `backend/src/routes/admin/organization.ts`
- Create: `backend/src/routes/admin/company.ts`
- Create: `backend/src/__tests__/admin-org.test.ts`
- Modify: `backend/src/app.ts`

- [ ] **Step 1: Create organization routes**

```typescript
// backend/src/routes/admin/organization.ts
import type { FastifyInstance } from 'fastify';
import { prisma } from '../../db.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { BrandingConfigSchema } from '@calendfree/shared';

export async function organizationRoutes(app: FastifyInstance) {
  // All org routes require ORG_ADMIN
  app.addHook('preHandler', requireRole('ORG_ADMIN'));

  /** GET /api/admin/org — Get current organization details */
  app.get('/api/admin/org', async (request) => {
    const user = request.session.user!;
    const org = await prisma.organization.findUniqueOrThrow({
      where: { id: user.organizationId },
      include: { branding: true, companies: { select: { id: true, name: true, slug: true } } },
    });
    return org;
  });

  /** PUT /api/admin/org/branding — Update organization branding */
  app.put('/api/admin/org/branding', async (request, reply) => {
    const user = request.session.user!;
    const body = BrandingConfigSchema.parse(request.body);

    const branding = await prisma.brandingConfig.upsert({
      where: { organizationId: user.organizationId },
      update: body,
      create: { ...body, organizationId: user.organizationId },
    });
    return branding;
  });
}
```

- [ ] **Step 2: Create company routes**

```typescript
// backend/src/routes/admin/company.ts
import type { FastifyInstance } from 'fastify';
import { prisma } from '../../db.js';
import { requireRole } from '../../middleware/auth.js';
import { CreateCompanySchema, UpdateCompanySchema, BrandingConfigSchema } from '@calendfree/shared';

export async function companyRoutes(app: FastifyInstance) {
  /** POST /api/admin/companies — Create company (ORG_ADMIN only) */
  app.post('/api/admin/companies', { preHandler: [requireRole('ORG_ADMIN')] }, async (request, reply) => {
    const user = request.session.user!;
    const body = CreateCompanySchema.parse(request.body);

    const company = await prisma.company.create({
      data: { ...body, organizationId: user.organizationId },
    });
    return reply.status(201).send(company);
  });

  /** GET /api/admin/companies — List companies */
  app.get('/api/admin/companies', { preHandler: [requireRole('COMPANY_ADMIN', 'ORG_ADMIN')] }, async (request) => {
    const user = request.session.user!;

    // ORG_ADMIN sees all companies, COMPANY_ADMIN sees only their own
    if (user.activeRole === 'ORG_ADMIN') {
      return prisma.company.findMany({
        where: { organizationId: user.organizationId },
        include: { branding: true },
      });
    }

    const memberships = await prisma.companyMembership.findMany({
      where: { userId: user.id },
      include: { company: { include: { branding: true } } },
    });
    return memberships.map((m) => m.company);
  });

  /** GET /api/admin/companies/:id — Get company details */
  app.get('/api/admin/companies/:id', { preHandler: [requireRole('COMPANY_ADMIN', 'ORG_ADMIN')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = request.session.user!;

    const company = await prisma.company.findFirst({
      where: { id, organizationId: user.organizationId },
      include: { branding: true, teams: true },
    });
    if (!company) return reply.status(404).send({ error: 'Company not found' });
    return company;
  });

  /** PATCH /api/admin/companies/:id — Update company */
  app.patch('/api/admin/companies/:id', { preHandler: [requireRole('COMPANY_ADMIN', 'ORG_ADMIN')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = request.session.user!;
    const body = UpdateCompanySchema.parse(request.body);

    const company = await prisma.company.updateMany({
      where: { id, organizationId: user.organizationId },
      data: body,
    });
    if (company.count === 0) return reply.status(404).send({ error: 'Company not found' });

    return prisma.company.findUnique({ where: { id } });
  });

  /** DELETE /api/admin/companies/:id — Delete company (ORG_ADMIN only) */
  app.delete('/api/admin/companies/:id', { preHandler: [requireRole('ORG_ADMIN')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = request.session.user!;

    const result = await prisma.company.deleteMany({
      where: { id, organizationId: user.organizationId },
    });
    if (result.count === 0) return reply.status(404).send({ error: 'Company not found' });
    return { success: true };
  });

  /** PUT /api/admin/companies/:id/branding — Update company branding */
  app.put('/api/admin/companies/:id/branding', { preHandler: [requireRole('COMPANY_ADMIN', 'ORG_ADMIN')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = BrandingConfigSchema.parse(request.body);

    const branding = await prisma.brandingConfig.upsert({
      where: { companyId: id },
      update: body,
      create: { ...body, companyId: id },
    });
    return branding;
  });
}
```

- [ ] **Step 3: Register routes in app.ts**

Add to `backend/src/app.ts`:
```typescript
import { organizationRoutes } from './routes/admin/organization.js';
import { companyRoutes } from './routes/admin/company.js';

// After other route registrations:
await app.register(organizationRoutes);
await app.register(companyRoutes);
```

- [ ] **Step 4: Write tests**

```typescript
// backend/src/__tests__/admin-org.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../app.js';
import type { FastifyInstance } from 'fastify';

describe('Admin organization routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => { app = await buildApp(); });
  afterAll(async () => { await app.close(); });

  it('GET /api/admin/org requires auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/org' });
    expect(res.statusCode).toBe(401);
  });

  it('GET /api/admin/companies requires auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/companies' });
    expect(res.statusCode).toBe(401);
  });

  it('POST /api/admin/companies requires auth', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/companies',
      payload: { name: 'Test', slug: 'test' },
    });
    expect(res.statusCode).toBe(401);
  });
});
```

- [ ] **Step 5: Run tests, commit + push**

```bash
cd /Users/hziech/calendfree && npm run test -w backend && git add backend/src/routes/admin/ backend/src/__tests__/admin-org.test.ts backend/src/app.ts && git commit -m "feat: add organization and company admin CRUD APIs" && git push
```

---

## Chunk 2: Team & User Management APIs

### Task 3: Team Management Routes

**Files:**
- Create: `backend/src/routes/admin/teams.ts`
- Create: `backend/src/__tests__/admin-teams.test.ts`
- Modify: `backend/src/app.ts`

- [ ] **Step 1: Create team routes**

```typescript
// backend/src/routes/admin/teams.ts
import type { FastifyInstance } from 'fastify';
import { prisma } from '../../db.js';
import { requireRole } from '../../middleware/auth.js';
import { CreateTeamSchema, UpdateTeamSchema, AddTeamMemberSchema, UpdateTeamMemberSchema, UpdateRoundRobinSchema } from '@calendfree/shared';

export async function teamRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireRole('COMPANY_ADMIN', 'ORG_ADMIN'));

  /** POST /api/admin/companies/:companyId/teams — Create team */
  app.post('/api/admin/companies/:companyId/teams', async (request, reply) => {
    const { companyId } = request.params as { companyId: string };
    const body = CreateTeamSchema.parse(request.body);

    const team = await prisma.team.create({
      data: {
        name: body.name,
        companyId,
        rrConfig: {
          create: { mode: body.roundRobinMode },
        },
      },
      include: { rrConfig: true },
    });
    return reply.status(201).send(team);
  });

  /** GET /api/admin/companies/:companyId/teams — List teams */
  app.get('/api/admin/companies/:companyId/teams', async (request) => {
    const { companyId } = request.params as { companyId: string };
    return prisma.team.findMany({
      where: { companyId },
      include: {
        rrConfig: true,
        memberships: { include: { user: { select: { id: true, name: true, email: true } } } },
        _count: { select: { eventTypes: true } },
      },
    });
  });

  /** GET /api/admin/teams/:id — Get team details */
  app.get('/api/admin/teams/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const team = await prisma.team.findUnique({
      where: { id },
      include: {
        rrConfig: true,
        memberships: { include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } } },
        eventTypes: { select: { id: true, title: true, slug: true, active: true } },
      },
    });
    if (!team) return reply.status(404).send({ error: 'Team not found' });
    return team;
  });

  /** PATCH /api/admin/teams/:id — Update team */
  app.patch('/api/admin/teams/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = UpdateTeamSchema.parse(request.body);
    const team = await prisma.team.update({ where: { id }, data: body });
    return team;
  });

  /** DELETE /api/admin/teams/:id — Delete team */
  app.delete('/api/admin/teams/:id', async (request, reply) => {
    await prisma.team.delete({ where: { id: (request.params as { id: string }).id } });
    return { success: true };
  });

  /** PUT /api/admin/teams/:id/round-robin — Update round-robin config */
  app.put('/api/admin/teams/:id/round-robin', async (request) => {
    const { id } = request.params as { id: string };
    const body = UpdateRoundRobinSchema.parse(request.body);
    return prisma.roundRobinConfig.update({
      where: { teamId: id },
      data: { mode: body.mode, lastAssignedIndex: 0 },
    });
  });

  /** POST /api/admin/teams/:id/members — Add team member */
  app.post('/api/admin/teams/:id/members', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = AddTeamMemberSchema.parse(request.body);
    const membership = await prisma.teamMembership.create({
      data: { teamId: id, userId: body.userId, weight: body.weight },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    return reply.status(201).send(membership);
  });

  /** PATCH /api/admin/teams/:teamId/members/:userId — Update member weight */
  app.patch('/api/admin/teams/:teamId/members/:userId', async (request) => {
    const { teamId, userId } = request.params as { teamId: string; userId: string };
    const body = UpdateTeamMemberSchema.parse(request.body);
    return prisma.teamMembership.update({
      where: { userId_teamId: { userId, teamId } },
      data: { weight: body.weight },
    });
  });

  /** DELETE /api/admin/teams/:teamId/members/:userId — Remove team member */
  app.delete('/api/admin/teams/:teamId/members/:userId', async (request) => {
    const { teamId, userId } = request.params as { teamId: string; userId: string };
    await prisma.teamMembership.delete({
      where: { userId_teamId: { userId, teamId } },
    });
    return { success: true };
  });
}
```

- [ ] **Step 2: Register in app.ts, write test, commit + push**

Register `teamRoutes` in app.ts. Write test verifying auth required on team endpoints.

```typescript
// backend/src/__tests__/admin-teams.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../app.js';
import type { FastifyInstance } from 'fastify';

describe('Admin team routes', () => {
  let app: FastifyInstance;
  beforeAll(async () => { app = await buildApp(); });
  afterAll(async () => { await app.close(); });

  it('POST /api/admin/companies/:id/teams requires auth', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/admin/companies/fake-id/teams', payload: { name: 'Test' } });
    expect(res.statusCode).toBe(401);
  });

  it('GET /api/admin/teams/:id requires auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/teams/fake-id' });
    expect(res.statusCode).toBe(401);
  });
});
```

```bash
cd /Users/hziech/calendfree && npm run test -w backend && git add backend/ && git commit -m "feat: add team management admin APIs with round-robin config and member management" && git push
```

---

### Task 4: User Management & Event Type Routes

**Files:**
- Create: `backend/src/routes/admin/users.ts`
- Create: `backend/src/routes/admin/event-types.ts`
- Create: `backend/src/__tests__/admin-users.test.ts`
- Modify: `backend/src/app.ts`

- [ ] **Step 1: Create user management routes**

```typescript
// backend/src/routes/admin/users.ts
import type { FastifyInstance } from 'fastify';
import { prisma } from '../../db.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { InviteUserSchema, UpdateMembershipRoleSchema, UpdateAvailabilitySchema } from '@calendfree/shared';

export async function userRoutes(app: FastifyInstance) {
  /** GET /api/admin/companies/:companyId/users — List company members */
  app.get('/api/admin/companies/:companyId/users', { preHandler: [requireRole('COMPANY_ADMIN', 'ORG_ADMIN')] }, async (request) => {
    const { companyId } = request.params as { companyId: string };
    const memberships = await prisma.companyMembership.findMany({
      where: { companyId },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatarUrl: true, slug: true, timezone: true },
          include: { googleTokens: { select: { connected: true } } },
        },
      },
    });
    return memberships.map((m) => ({ ...m.user, role: m.role, googleConnected: m.user.googleTokens?.connected ?? false }));
  });

  /** POST /api/admin/companies/:companyId/users — Invite user to company */
  app.post('/api/admin/companies/:companyId/users', { preHandler: [requireRole('COMPANY_ADMIN', 'ORG_ADMIN')] }, async (request, reply) => {
    const { companyId } = request.params as { companyId: string };
    const user = request.session.user!;
    const body = InviteUserSchema.parse(request.body);

    // Find or create user
    let targetUser = await prisma.user.findUnique({ where: { email: body.email } });
    if (!targetUser) {
      targetUser = await prisma.user.create({
        data: { email: body.email, name: body.name, organizationId: user.organizationId },
      });
    }

    // Create membership
    const membership = await prisma.companyMembership.create({
      data: { userId: targetUser.id, companyId, role: body.role },
    });
    return reply.status(201).send({ ...targetUser, role: membership.role });
  });

  /** PATCH /api/admin/companies/:companyId/users/:userId/role — Update user role */
  app.patch('/api/admin/companies/:companyId/users/:userId/role', { preHandler: [requireRole('ORG_ADMIN')] }, async (request) => {
    const { companyId, userId } = request.params as { companyId: string; userId: string };
    const body = UpdateMembershipRoleSchema.parse(request.body);
    return prisma.companyMembership.update({
      where: { userId_companyId: { userId, companyId } },
      data: { role: body.role },
    });
  });

  /** DELETE /api/admin/companies/:companyId/users/:userId — Remove user from company */
  app.delete('/api/admin/companies/:companyId/users/:userId', { preHandler: [requireRole('COMPANY_ADMIN', 'ORG_ADMIN')] }, async (request) => {
    const { companyId, userId } = request.params as { companyId: string; userId: string };
    await prisma.companyMembership.delete({
      where: { userId_companyId: { userId, companyId } },
    });
    return { success: true };
  });

  /** GET /api/me — Get current user profile */
  app.get('/api/me', { preHandler: [requireAuth] }, async (request) => {
    const user = request.session.user!;
    const fullUser = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      include: {
        availability: true,
        googleTokens: { select: { connected: true, scopes: true } },
        companyMemberships: { include: { company: { select: { id: true, name: true, slug: true } } } },
      },
    });
    return fullUser;
  });

  /** PATCH /api/me/availability — Update own availability */
  app.patch('/api/me/availability', { preHandler: [requireAuth] }, async (request) => {
    const user = request.session.user!;
    const body = UpdateAvailabilitySchema.parse(request.body);

    return prisma.availabilityConfig.upsert({
      where: { userId: user.id },
      update: body,
      create: { userId: user.id, ...body },
    });
  });

  /** PATCH /api/me/timezone — Update own timezone */
  app.patch('/api/me/timezone', { preHandler: [requireAuth] }, async (request) => {
    const user = request.session.user!;
    const { timezone } = request.body as { timezone: string };
    return prisma.user.update({ where: { id: user.id }, data: { timezone } });
  });
}
```

- [ ] **Step 2: Create event type routes**

```typescript
// backend/src/routes/admin/event-types.ts
import type { FastifyInstance } from 'fastify';
import { prisma } from '../../db.js';
import { requireRole } from '../../middleware/auth.js';
import { CreateEventTypeSchema, UpdateEventTypeSchema } from '@calendfree/shared';

export async function eventTypeRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireRole('COMPANY_ADMIN', 'ORG_ADMIN'));

  /** POST /api/admin/companies/:companyId/event-types — Create event type */
  app.post('/api/admin/companies/:companyId/event-types', async (request, reply) => {
    const { companyId } = request.params as { companyId: string };
    const body = CreateEventTypeSchema.parse(request.body);

    const { formFields, ...eventTypeData } = body;

    const eventType = await prisma.eventType.create({
      data: {
        ...eventTypeData,
        companyId,
        formFields: {
          create: formFields.map((f, i) => ({ ...f, order: i })),
        },
      },
      include: { formFields: true },
    });
    return reply.status(201).send(eventType);
  });

  /** GET /api/admin/companies/:companyId/event-types — List event types */
  app.get('/api/admin/companies/:companyId/event-types', async (request) => {
    const { companyId } = request.params as { companyId: string };
    return prisma.eventType.findMany({
      where: { companyId },
      include: {
        team: { select: { id: true, name: true } },
        user: { select: { id: true, name: true } },
        formFields: { orderBy: { order: 'asc' } },
        _count: { select: { bookings: true } },
      },
    });
  });

  /** GET /api/admin/event-types/:id — Get event type details */
  app.get('/api/admin/event-types/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const eventType = await prisma.eventType.findUnique({
      where: { id },
      include: {
        team: { select: { id: true, name: true } },
        user: { select: { id: true, name: true } },
        formFields: { orderBy: { order: 'asc' } },
      },
    });
    if (!eventType) return reply.status(404).send({ error: 'Event type not found' });
    return eventType;
  });

  /** PATCH /api/admin/event-types/:id — Update event type */
  app.patch('/api/admin/event-types/:id', async (request) => {
    const { id } = request.params as { id: string };
    const body = UpdateEventTypeSchema.parse(request.body);
    return prisma.eventType.update({ where: { id }, data: body });
  });

  /** DELETE /api/admin/event-types/:id — Delete event type */
  app.delete('/api/admin/event-types/:id', async (request) => {
    const { id } = request.params as { id: string };
    await prisma.eventType.delete({ where: { id } });
    return { success: true };
  });

  /** PATCH /api/admin/event-types/:id/toggle — Activate/deactivate */
  app.patch('/api/admin/event-types/:id/toggle', async (request) => {
    const { id } = request.params as { id: string };
    const current = await prisma.eventType.findUniqueOrThrow({ where: { id } });
    return prisma.eventType.update({ where: { id }, data: { active: !current.active } });
  });
}
```

- [ ] **Step 3: Register routes in app.ts, write test, commit + push**

```typescript
// backend/src/__tests__/admin-users.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../app.js';
import type { FastifyInstance } from 'fastify';

describe('Admin user and event type routes', () => {
  let app: FastifyInstance;
  beforeAll(async () => { app = await buildApp(); });
  afterAll(async () => { await app.close(); });

  it('GET /api/admin/companies/:id/users requires auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/companies/fake/users' });
    expect(res.statusCode).toBe(401);
  });

  it('GET /api/me requires auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/me' });
    expect(res.statusCode).toBe(401);
  });

  it('POST /api/admin/companies/:id/event-types requires auth', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/admin/companies/fake/event-types', payload: { title: 'T', slug: 'ts' } });
    expect(res.statusCode).toBe(401);
  });
});
```

```bash
cd /Users/hziech/calendfree && npm run test -w backend && git add backend/ && git commit -m "feat: add user management, event type, and availability admin APIs" && git push
```

---

## Chunk 3: API Keys

### Task 5: API Key Routes

**Files:**
- Create: `backend/src/routes/admin/api-keys.ts`
- Create: `backend/src/middleware/api-key.ts`
- Create: `backend/src/__tests__/api-keys.test.ts`
- Modify: `backend/src/app.ts`

- [ ] **Step 1: Create API key routes**

```typescript
// backend/src/routes/admin/api-keys.ts
import type { FastifyInstance } from 'fastify';
import { randomBytes, createHash } from 'node:crypto';
import { prisma } from '../../db.js';
import { requireAuth } from '../../middleware/auth.js';
import { CreateApiKeySchema } from '@calendfree/shared';
import { logAudit } from '../../services/audit-log.js';

/** Generate a prefixed API key and its SHA-256 hash. */
function generateApiKey(): { key: string; hash: string; prefix: string } {
  const raw = randomBytes(32).toString('hex');
  const key = `cf_live_${raw}`;
  const hash = createHash('sha256').update(key).digest('hex');
  const prefix = key.slice(0, 16);
  return { key, hash, prefix };
}

export async function apiKeyRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);

  /** GET /api/me/api-keys — List user's API keys */
  app.get('/api/me/api-keys', async (request) => {
    const user = request.session.user!;
    return prisma.apiKey.findMany({
      where: { userId: user.id },
      select: { id: true, name: true, keyPrefix: true, active: true, expiresAt: true, lastUsedAt: true, createdAt: true },
    });
  });

  /** POST /api/me/api-keys — Create API key */
  app.post('/api/me/api-keys', async (request, reply) => {
    const user = request.session.user!;
    const body = CreateApiKeySchema.parse(request.body);
    const { key, hash, prefix } = generateApiKey();

    const apiKey = await prisma.apiKey.create({
      data: {
        userId: user.id,
        name: body.name,
        keyHash: hash,
        keyPrefix: prefix,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
      },
    });

    logAudit({ userId: user.id, action: 'API_KEY_CREATED', details: { keyId: apiKey.id, name: body.name }, ipAddress: request.ip });

    // Return the full key ONLY on creation (never stored in DB)
    return reply.status(201).send({
      id: apiKey.id,
      name: apiKey.name,
      key, // Only time the full key is shown
      keyPrefix: apiKey.keyPrefix,
      expiresAt: apiKey.expiresAt,
      createdAt: apiKey.createdAt,
    });
  });

  /** DELETE /api/me/api-keys/:id — Revoke API key */
  app.delete('/api/me/api-keys/:id', async (request, reply) => {
    const user = request.session.user!;
    const { id } = request.params as { id: string };

    const result = await prisma.apiKey.deleteMany({ where: { id, userId: user.id } });
    if (result.count === 0) return reply.status(404).send({ error: 'API key not found' });

    logAudit({ userId: user.id, action: 'API_KEY_REVOKED', details: { keyId: id }, ipAddress: request.ip });
    return { success: true };
  });
}
```

- [ ] **Step 2: Create API key auth middleware**

```typescript
// backend/src/middleware/api-key.ts
import type { FastifyRequest, FastifyReply } from 'fastify';
import { createHash } from 'node:crypto';
import { prisma } from '../db.js';

/**
 * Authenticate a request via API key (Bearer token).
 * If an API key is present and valid, populates request.session.user.
 * Falls through to session auth if no API key is present.
 */
export async function apiKeyAuth(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer cf_live_')) return; // No API key, let session auth handle it

  const key = authHeader.slice(7); // Remove "Bearer "
  const hash = createHash('sha256').update(key).digest('hex');

  const apiKey = await prisma.apiKey.findUnique({
    where: { keyHash: hash },
    include: {
      user: {
        include: {
          companyMemberships: { orderBy: { createdAt: 'asc' }, take: 1 },
        },
      },
    },
  });

  if (!apiKey || !apiKey.active) {
    return reply.status(401).send({ error: 'Invalid or inactive API key' });
  }

  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
    return reply.status(401).send({ error: 'API key expired' });
  }

  // Update last used timestamp (fire and forget)
  prisma.apiKey.update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } }).catch(() => {});

  // Populate session-like user context
  const membership = apiKey.user.companyMemberships[0];
  request.session.user = {
    id: apiKey.user.id,
    email: apiKey.user.email,
    name: apiKey.user.name,
    avatarUrl: apiKey.user.avatarUrl,
    organizationId: apiKey.user.organizationId,
    activeCompanyId: membership?.companyId ?? null,
    activeRole: membership?.role ?? null,
  };
}
```

- [ ] **Step 3: Register API key middleware and routes**

In `backend/src/app.ts`, add the API key auth as a global preHandler (before session check):
```typescript
import { apiKeyAuth } from './middleware/api-key.js';
import { apiKeyRoutes } from './routes/admin/api-keys.js';

// Add as global hook after session plugin:
app.addHook('preHandler', apiKeyAuth);

// Register routes:
await app.register(apiKeyRoutes);
```

- [ ] **Step 4: Write tests, run, commit + push**

```typescript
// backend/src/__tests__/api-keys.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../app.js';
import type { FastifyInstance } from 'fastify';

describe('API Key routes', () => {
  let app: FastifyInstance;
  beforeAll(async () => { app = await buildApp(); });
  afterAll(async () => { await app.close(); });

  it('GET /api/me/api-keys requires auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/me/api-keys' });
    expect(res.statusCode).toBe(401);
  });

  it('invalid API key returns 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/me/api-keys',
      headers: { authorization: 'Bearer cf_live_invalid_key_here' },
    });
    expect(res.statusCode).toBe(401);
  });
});
```

```bash
cd /Users/hziech/calendfree && npm run test -w backend && git add backend/ && git commit -m "feat: add API key generation, auth middleware, and management endpoints" && git push
```

---

## Verification Checklist

1. **`npm run test -w backend`** — all tests pass
2. **Org API**: GET /api/admin/org, PUT /api/admin/org/branding
3. **Company API**: CRUD at /api/admin/companies
4. **Team API**: CRUD + member management + round-robin config
5. **User API**: List/invite/remove members, role management
6. **Event Type API**: CRUD + toggle active/inactive
7. **User Profile**: GET /api/me, PATCH /api/me/availability, PATCH /api/me/timezone
8. **API Keys**: Generate (POST), list (GET), revoke (DELETE), auth middleware
9. **All admin routes require authentication**
10. **RBAC enforced** (ORG_ADMIN > COMPANY_ADMIN > USER)
