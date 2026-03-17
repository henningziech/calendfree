# Calendfree Phase 7: Advanced Features — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement remaining MVP features: Routing Forms (question-based flow to correct event type), HubSpot integration (async CRM sync), Analytics dashboard (booking stats), Embed Widget (iframe/popup for external sites), and Custom Domain support (Caddy config).

**Architecture:** Each feature is a self-contained module. Routing Forms are a new route + Prisma models (already in schema). HubSpot is an async pg-boss job. Analytics aggregates booking data. Embed is a standalone JS file. Custom domains are managed via backend API + Caddy config generation.

**Tech Stack:** Fastify routes, Prisma, pg-boss, Recharts (analytics charts), Caddy API

---

## Chunk 1: Routing Forms

### Task 1: Routing Form Backend

**Files:**
- Create: `backend/src/routes/admin/routing-forms.ts`
- Create: `backend/src/routes/routing.ts`
- Create: `backend/src/__tests__/routing-forms.test.ts`
- Modify: `backend/src/app.ts`

- [ ] **Step 1: Create admin routing form routes**

```typescript
// backend/src/routes/admin/routing-forms.ts
import type { FastifyInstance } from 'fastify';
import { prisma } from '../../db.js';
import { requireRole } from '../../middleware/auth.js';

export async function routingFormAdminRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireRole('COMPANY_ADMIN', 'ORG_ADMIN'));

  /** POST /api/admin/companies/:companyId/routing-forms */
  app.post('/api/admin/companies/:companyId/routing-forms', async (request, reply) => {
    const { companyId } = request.params as { companyId: string };
    const { title, slug, rules } = request.body as {
      title: string; slug: string;
      rules?: Array<{ field: string; operator: string; value: string; targetSlug: string; order?: number }>;
    };

    const form = await prisma.routingForm.create({
      data: {
        title, slug, companyId,
        rules: rules ? { create: rules.map((r, i) => ({ ...r, order: r.order ?? i })) } : undefined,
      },
      include: { rules: { orderBy: { order: 'asc' } } },
    });
    return reply.status(201).send(form);
  });

  /** GET /api/admin/companies/:companyId/routing-forms */
  app.get('/api/admin/companies/:companyId/routing-forms', async (request) => {
    const { companyId } = request.params as { companyId: string };
    return prisma.routingForm.findMany({
      where: { companyId },
      include: { rules: { orderBy: { order: 'asc' } } },
    });
  });

  /** GET /api/admin/routing-forms/:id */
  app.get('/api/admin/routing-forms/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const form = await prisma.routingForm.findUnique({
      where: { id },
      include: { rules: { orderBy: { order: 'asc' } } },
    });
    if (!form) return reply.status(404).send({ error: 'Routing form not found' });
    return form;
  });

  /** DELETE /api/admin/routing-forms/:id */
  app.delete('/api/admin/routing-forms/:id', async (request) => {
    const { id } = request.params as { id: string };
    await prisma.routingForm.delete({ where: { id } });
    return { success: true };
  });
}
```

- [ ] **Step 2: Create public routing endpoint**

```typescript
// backend/src/routes/routing.ts
import type { FastifyInstance } from 'fastify';
import { prisma } from '../db.js';

export async function routingRoutes(app: FastifyInstance) {
  /** GET /api/routing/:companySlug/:formSlug — Get routing form for display */
  app.get('/api/routing/:companySlug/:formSlug', async (request, reply) => {
    const { companySlug, formSlug } = request.params as { companySlug: string; formSlug: string };

    const company = await prisma.company.findFirst({ where: { slug: companySlug } });
    if (!company) return reply.status(404).send({ error: 'Company not found' });

    const form = await prisma.routingForm.findFirst({
      where: { companyId: company.id, slug: formSlug, active: true },
      include: { rules: { orderBy: { order: 'asc' } } },
    });
    if (!form) return reply.status(404).send({ error: 'Routing form not found' });

    // Return form with unique field names for the UI to render as questions
    const fields = [...new Set(form.rules.map((r) => r.field))];

    return {
      title: form.title,
      fields: fields.map((f) => ({
        name: f,
        options: form.rules.filter((r) => r.field === f).map((r) => ({
          value: r.value,
          label: r.value,
        })),
      })),
    };
  });

  /** POST /api/routing/:companySlug/:formSlug/resolve — Evaluate answers and return target */
  app.post('/api/routing/:companySlug/:formSlug/resolve', async (request, reply) => {
    const { companySlug, formSlug } = request.params as { companySlug: string; formSlug: string };
    const answers = request.body as Record<string, string>;

    const company = await prisma.company.findFirst({ where: { slug: companySlug } });
    if (!company) return reply.status(404).send({ error: 'Company not found' });

    const form = await prisma.routingForm.findFirst({
      where: { companyId: company.id, slug: formSlug, active: true },
      include: { rules: { orderBy: { order: 'asc' } } },
    });
    if (!form) return reply.status(404).send({ error: 'Routing form not found' });

    // Evaluate rules in order
    for (const rule of form.rules) {
      const answer = answers[rule.field];
      if (!answer) continue;

      let match = false;
      switch (rule.operator) {
        case 'equals': match = answer === rule.value; break;
        case 'contains': match = answer.toLowerCase().includes(rule.value.toLowerCase()); break;
        case 'regex': match = new RegExp(rule.value, 'i').test(answer); break;
      }

      if (match) {
        return { redirect: `/${companySlug}/${rule.targetSlug}` };
      }
    }

    return reply.status(404).send({ error: 'No matching rule found' });
  });
}
```

- [ ] **Step 3: Register routes, write test, commit + push**

Register `routingFormAdminRoutes` and `routingRoutes` in app.ts.

```typescript
// backend/src/__tests__/routing-forms.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../app.js';
import type { FastifyInstance } from 'fastify';

describe('Routing forms', () => {
  let app: FastifyInstance;
  beforeAll(async () => { app = await buildApp(); });
  afterAll(async () => { await app.close(); });

  it('GET /api/routing/:company/:form returns 404 for unknown', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/routing/nonexistent/test' });
    expect(res.statusCode).toBe(404);
  });

  it('POST /api/admin/companies/:id/routing-forms requires auth', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/admin/companies/fake/routing-forms', payload: { title: 'T', slug: 's' } });
    expect(res.statusCode).toBe(401);
  });
});
```

Commit: "feat: add routing forms with admin CRUD and public evaluation engine" + push

---

## Chunk 2: HubSpot Integration

### Task 2: HubSpot Service & Jobs

**Files:**
- Create: `backend/src/services/hubspot.ts`
- Create: `backend/src/jobs/hubspot-jobs.ts`
- Create: `backend/src/routes/admin/hubspot.ts`
- Create: `backend/src/__tests__/hubspot.test.ts`
- Modify: `backend/src/app.ts`
- Modify: `backend/src/routes/booking.ts`

- [ ] **Step 1: Create HubSpot service**

```typescript
// backend/src/services/hubspot.ts
import { config } from '../config.js';

interface HubSpotConfig {
  apiKey: string;
  portalId?: string;
}

/** Find or create a HubSpot contact by email. */
export async function upsertContact(
  hsConfig: HubSpotConfig,
  data: { email: string; name: string },
): Promise<{ contactId: string }> {
  // Search for existing contact
  const searchRes = await fetch('https://api.hubapi.com/crm/v3/objects/contacts/search', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${hsConfig.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      filterGroups: [{ filters: [{ propertyName: 'email', operator: 'EQ', value: data.email }] }],
    }),
  });

  const searchData = await searchRes.json();
  if (searchData.results?.length > 0) {
    return { contactId: searchData.results[0].id };
  }

  // Create new contact
  const [firstName, ...lastParts] = data.name.split(' ');
  const lastName = lastParts.join(' ') || '';

  const createRes = await fetch('https://api.hubapi.com/crm/v3/objects/contacts', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${hsConfig.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: { email: data.email, firstname: firstName, lastname: lastName },
    }),
  });

  const createData = await createRes.json();
  return { contactId: createData.id };
}

/** Create a meeting activity in HubSpot. */
export async function createMeeting(
  hsConfig: HubSpotConfig,
  data: { contactId: string; title: string; startTime: Date; endTime: Date; meetLink?: string | null },
): Promise<void> {
  await fetch('https://api.hubapi.com/crm/v3/objects/meetings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${hsConfig.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: {
        hs_meeting_title: data.title,
        hs_meeting_start_time: data.startTime.toISOString(),
        hs_meeting_end_time: data.endTime.toISOString(),
        hs_meeting_location: data.meetLink ?? '',
      },
      associations: [{
        to: { id: data.contactId },
        types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 200 }],
      }],
    }),
  });
}
```

- [ ] **Step 2: Create HubSpot job handler**

```typescript
// backend/src/jobs/hubspot-jobs.ts
import { getQueue } from './queue.js';
import { prisma } from '../db.js';
import { upsertContact, createMeeting } from '../services/hubspot.js';
import { decrypt } from '../utils/encryption.js';

export const HUBSPOT_JOB = 'hubspot-sync';

export async function registerHubSpotHandlers(): Promise<void> {
  const queue = getQueue();

  await queue.work(HUBSPOT_JOB, async (job) => {
    const { bookingId } = job.data;

    const booking = await prisma.booking.findUniqueOrThrow({
      where: { id: bookingId },
      include: {
        formData: true,
        eventType: { include: { company: true } },
      },
    });

    if (!booking.formData) return;

    // Check if company has HubSpot configured (stored as encrypted JSON in company metadata)
    // For now, check for a simple env var. Full per-company config will be in settings.
    const hubspotKey = process.env.HUBSPOT_API_KEY;
    if (!hubspotKey) return;

    const hsConfig = { apiKey: hubspotKey };

    const { contactId } = await upsertContact(hsConfig, {
      email: booking.formData.email,
      name: booking.formData.name,
    });

    await createMeeting(hsConfig, {
      contactId,
      title: `${booking.eventType.title} — ${booking.formData.name}`,
      startTime: booking.startTime,
      endTime: booking.endTime,
    });
  });
}

/** Queue a HubSpot sync job for a booking. */
export async function queueHubSpotSync(bookingId: string): Promise<void> {
  const queue = getQueue();
  await queue.send(HUBSPOT_JOB, { bookingId });
}
```

- [ ] **Step 3: Create HubSpot admin route (simple config)**

```typescript
// backend/src/routes/admin/hubspot.ts
import type { FastifyInstance } from 'fastify';
import { requireRole } from '../../middleware/auth.js';

export async function hubspotRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireRole('COMPANY_ADMIN', 'ORG_ADMIN'));

  /** GET /api/admin/hubspot/status — Check HubSpot configuration status */
  app.get('/api/admin/hubspot/status', async () => {
    const configured = !!process.env.HUBSPOT_API_KEY;
    return { configured, message: configured ? 'HubSpot ist verbunden' : 'HUBSPOT_API_KEY nicht konfiguriert' };
  });
}
```

- [ ] **Step 4: Register handlers and routes, integrate with booking**

Register `hubspotRoutes` in app.ts. Register `registerHubSpotHandlers` in the onReady hook.

In `backend/src/routes/booking.ts`, after notification scheduling, add:
```typescript
import { queueHubSpotSync } from '../jobs/hubspot-jobs.js';

// After scheduleBookingNotifications:
try { await queueHubSpotSync(booking.id); } catch (err) { app.log.error(err, 'Failed to queue HubSpot sync'); }
```

- [ ] **Step 5: Write test, commit + push**

```typescript
// backend/src/__tests__/hubspot.test.ts
import { describe, it, expect } from 'vitest';

describe('HubSpot integration', () => {
  it('exports service functions', async () => {
    const mod = await import('../services/hubspot.js');
    expect(mod.upsertContact).toBeDefined();
    expect(mod.createMeeting).toBeDefined();
  });

  it('exports job functions', async () => {
    const mod = await import('../jobs/hubspot-jobs.js');
    expect(mod.queueHubSpotSync).toBeDefined();
    expect(mod.registerHubSpotHandlers).toBeDefined();
  });
});
```

Commit: "feat: add HubSpot integration with async contact/meeting sync" + push

---

## Chunk 3: Analytics

### Task 3: Analytics Backend & Frontend

**Files:**
- Create: `backend/src/routes/admin/analytics.ts`
- Create: `backend/src/__tests__/analytics.test.ts`
- Create: `frontend/src/pages/admin/AnalyticsPage.tsx`
- Modify: `backend/src/app.ts`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Install Recharts in frontend**

```bash
cd /Users/hziech/calendfree && npm install -w frontend recharts
```

- [ ] **Step 2: Create analytics API**

```typescript
// backend/src/routes/admin/analytics.ts
import type { FastifyInstance } from 'fastify';
import { prisma } from '../../db.js';
import { requireRole } from '../../middleware/auth.js';

export async function analyticsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireRole('COMPANY_ADMIN', 'ORG_ADMIN'));

  /** GET /api/admin/analytics/overview — Booking stats for active company */
  app.get('/api/admin/analytics/overview', async (request) => {
    const user = request.session.user!;
    const companyId = user.activeCompanyId;

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const baseWhere = companyId
      ? { eventType: { companyId } }
      : { eventType: { company: { organizationId: user.organizationId } } };

    const [total30d, totalWeek, cancelled30d, byStatus, byUser, daily] = await Promise.all([
      // Total bookings last 30 days
      prisma.booking.count({ where: { ...baseWhere, createdAt: { gte: thirtyDaysAgo } } }),
      // Total bookings last 7 days
      prisma.booking.count({ where: { ...baseWhere, createdAt: { gte: sevenDaysAgo } } }),
      // Cancelled last 30 days
      prisma.booking.count({ where: { ...baseWhere, status: 'CANCELLED', createdAt: { gte: thirtyDaysAgo } } }),
      // By status
      prisma.booking.groupBy({
        by: ['status'],
        where: { ...baseWhere, createdAt: { gte: thirtyDaysAgo } },
        _count: { id: true },
      }),
      // By user (top 10)
      prisma.booking.groupBy({
        by: ['assignedUserId'],
        where: { ...baseWhere, createdAt: { gte: thirtyDaysAgo } },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 10,
      }),
      // Daily counts last 30 days
      prisma.$queryRaw<Array<{ date: string; count: bigint }>>`
        SELECT DATE("createdAt") as date, COUNT(*)::bigint as count
        FROM "Booking" b
        JOIN "EventType" et ON b."eventTypeId" = et.id
        WHERE et."companyId" = ${companyId}
        AND b."createdAt" >= ${thirtyDaysAgo}
        GROUP BY DATE("createdAt")
        ORDER BY date ASC
      `.catch(() => []),
    ]);

    // Resolve user names
    const userIds = byUser.map((u) => u.assignedUserId);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u.name]));

    return {
      summary: {
        total30d,
        totalWeek,
        cancelled30d,
        cancelRate: total30d > 0 ? Math.round((cancelled30d / total30d) * 100) : 0,
      },
      byStatus: byStatus.map((s) => ({ status: s.status, count: s._count.id })),
      byUser: byUser.map((u) => ({ userId: u.assignedUserId, name: userMap.get(u.assignedUserId) ?? 'Unknown', count: u._count.id })),
      daily: daily.map((d) => ({ date: String(d.date).slice(0, 10), count: Number(d.count) })),
    };
  });
}
```

- [ ] **Step 3: Create analytics frontend page**

```tsx
// frontend/src/pages/admin/AnalyticsPage.tsx
import { useState, useEffect } from 'react';
import { apiRequest } from '../../api/client';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

interface AnalyticsData {
  summary: { total30d: number; totalWeek: number; cancelled30d: number; cancelRate: number };
  byStatus: Array<{ status: string; count: number }>;
  byUser: Array<{ name: string; count: number }>;
  daily: Array<{ date: string; count: number }>;
}

export function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setIsLoading(true);
    try {
      setData(await apiRequest('/admin/analytics/overview'));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} onRetry={load} />;
  if (!data) return null;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>

      {/* Summary cards */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
        {[
          { label: 'Buchungen (30 Tage)', value: data.summary.total30d },
          { label: 'Buchungen (7 Tage)', value: data.summary.totalWeek },
          { label: 'Stornierungen', value: data.summary.cancelled30d },
          { label: 'Storno-Rate', value: `${data.summary.cancelRate}%` },
        ].map((card) => (
          <div key={card.label} className="rounded-lg border bg-white p-4">
            <p className="text-sm text-gray-500">{card.label}</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Daily chart */}
      <div className="mt-6 rounded-lg border bg-white p-4">
        <h3 className="mb-4 font-medium text-gray-900">Buchungen pro Tag (30 Tage)</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data.daily}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fontSize: 12 }} />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="count" fill="#2563EB" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Top users */}
      <div className="mt-6 rounded-lg border bg-white p-4">
        <h3 className="mb-4 font-medium text-gray-900">Top Consultants (30 Tage)</h3>
        <div className="space-y-2">
          {data.byUser.map((u, i) => (
            <div key={u.name} className="flex items-center gap-3">
              <span className="w-6 text-sm text-gray-400">#{i + 1}</span>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{u.name}</span>
                  <span className="text-sm text-gray-500">{u.count} Buchungen</span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-gray-100">
                  <div
                    className="h-2 rounded-full bg-blue-600"
                    style={{ width: `${(u.count / (data.byUser[0]?.count || 1)) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
          {data.byUser.length === 0 && <p className="text-sm text-gray-500">Noch keine Buchungsdaten.</p>}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Add Analytics route to App.tsx and sidebar**

In `frontend/src/App.tsx`, add:
```tsx
import { AnalyticsPage } from './pages/admin/AnalyticsPage';
// In admin routes:
<Route path="analytics" element={<AnalyticsPage />} />
```

In `frontend/src/components/layout/Sidebar.tsx`, add to ORG_ADMIN and COMPANY_ADMIN nav items:
```tsx
{ to: '/admin/analytics', label: 'Analytics', icon: '📊' },
```

- [ ] **Step 5: Register backend route, write test, build, commit + push**

```typescript
// backend/src/__tests__/analytics.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../app.js';
import type { FastifyInstance } from 'fastify';

describe('Analytics', () => {
  let app: FastifyInstance;
  beforeAll(async () => { app = await buildApp(); });
  afterAll(async () => { await app.close(); });

  it('GET /api/admin/analytics/overview requires auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/analytics/overview' });
    expect(res.statusCode).toBe(401);
  });
});
```

Commit: "feat: add analytics dashboard with booking stats, daily chart, and top consultants" + push

---

## Chunk 4: Embed Widget & Custom Domains

### Task 4: Embed Widget

**Files:**
- Create: `embed/calendfree-embed.js`
- Create: `backend/src/routes/embed.ts`
- Modify: `backend/src/app.ts`

- [ ] **Step 1: Create embed script**

```javascript
// embed/calendfree-embed.js
(function() {
  'use strict';

  const scripts = document.querySelectorAll('script[data-calendfree-company]');

  scripts.forEach(function(script) {
    const company = script.getAttribute('data-calendfree-company');
    const eventType = script.getAttribute('data-calendfree-event-type');
    const mode = script.getAttribute('data-calendfree-mode') || 'popup';
    const baseUrl = script.getAttribute('data-calendfree-url') || script.src.replace('/embed.js', '');
    const bookingUrl = baseUrl + '/' + company + (eventType ? '/' + eventType : '');

    if (mode === 'inline') {
      var iframe = document.createElement('iframe');
      iframe.src = bookingUrl;
      iframe.style.width = '100%';
      iframe.style.minHeight = '600px';
      iframe.style.border = 'none';
      iframe.style.borderRadius = '8px';
      iframe.setAttribute('loading', 'lazy');
      script.parentNode.insertBefore(iframe, script.nextSibling);
    } else {
      // Popup mode: create a button
      var btn = document.createElement('button');
      btn.textContent = script.getAttribute('data-calendfree-text') || 'Termin buchen';
      btn.style.cssText = 'background:#2563EB;color:#fff;border:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:500;cursor:pointer;font-family:sans-serif;';

      btn.addEventListener('click', function() {
        var overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:99999;display:flex;align-items:center;justify-content:center;';

        var modal = document.createElement('div');
        modal.style.cssText = 'background:#fff;border-radius:12px;width:90%;max-width:640px;height:80vh;position:relative;overflow:hidden;';

        var close = document.createElement('button');
        close.textContent = '\u00D7';
        close.style.cssText = 'position:absolute;top:8px;right:12px;background:none;border:none;font-size:24px;cursor:pointer;color:#666;z-index:1;';
        close.addEventListener('click', function() { overlay.remove(); });

        var iframe = document.createElement('iframe');
        iframe.src = bookingUrl;
        iframe.style.cssText = 'width:100%;height:100%;border:none;';

        modal.appendChild(close);
        modal.appendChild(iframe);
        overlay.appendChild(modal);
        overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.remove(); });
        document.body.appendChild(overlay);
      });

      script.parentNode.insertBefore(btn, script.nextSibling);
    }
  });
})();
```

- [ ] **Step 2: Create embed route to serve the script**

```typescript
// backend/src/routes/embed.ts
import type { FastifyInstance } from 'fastify';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function embedRoutes(app: FastifyInstance) {
  let embedScript: string;

  try {
    embedScript = readFileSync(join(__dirname, '../../..', 'embed', 'calendfree-embed.js'), 'utf-8');
  } catch {
    embedScript = '// Embed script not found';
  }

  /** GET /embed.js — Serve the embed widget script */
  app.get('/embed.js', async (request, reply) => {
    reply
      .header('Content-Type', 'application/javascript')
      .header('Cache-Control', 'public, max-age=3600')
      .header('Access-Control-Allow-Origin', '*')
      .send(embedScript);
  });
}
```

- [ ] **Step 3: Register embed route, commit + push**

Commit: "feat: add embed widget with popup and inline modes" + push

---

### Task 5: Custom Domains & README

**Files:**
- Create: `backend/src/routes/admin/domains.ts`
- Create: `README.md`
- Modify: `backend/src/app.ts`

- [ ] **Step 1: Create custom domain admin routes**

```typescript
// backend/src/routes/admin/domains.ts
import type { FastifyInstance } from 'fastify';
import { prisma } from '../../db.js';
import { requireRole } from '../../middleware/auth.js';
import dns from 'node:dns/promises';

export async function domainRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireRole('COMPANY_ADMIN', 'ORG_ADMIN'));

  /** GET /api/admin/companies/:id/domain — Get custom domain config */
  app.get('/api/admin/companies/:id/domain', async (request, reply) => {
    const { id } = request.params as { id: string };
    const company = await prisma.company.findUnique({ where: { id }, select: { customDomain: true } });
    if (!company) return reply.status(404).send({ error: 'Company not found' });
    return { customDomain: company.customDomain };
  });

  /** PUT /api/admin/companies/:id/domain — Set custom domain */
  app.put('/api/admin/companies/:id/domain', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { domain } = request.body as { domain: string | null };

    if (domain) {
      // Verify DNS CNAME
      try {
        const records = await dns.resolveCname(domain);
        const backendHost = new URL(process.env.BACKEND_URL || 'http://localhost:3001').hostname;
        if (!records.some((r) => r.includes(backendHost) || r.includes('calendfree'))) {
          return reply.status(400).send({
            error: `DNS CNAME für ${domain} zeigt nicht auf den Calendfree Server. Bitte CNAME auf ${backendHost} setzen.`,
          });
        }
      } catch {
        return reply.status(400).send({ error: `DNS-Lookup für ${domain} fehlgeschlagen. Domain nicht konfiguriert.` });
      }
    }

    await prisma.company.update({ where: { id }, data: { customDomain: domain } });
    return { success: true, customDomain: domain };
  });
}
```

- [ ] **Step 2: Add domain resolution middleware to booking routes**

Add to the TOP of `backend/src/routes/booking.ts` (before all route handlers):
```typescript
  /** Middleware: resolve company from custom domain Host header */
  app.addHook('preHandler', async (request) => {
    const host = request.headers.host;
    if (!host || host.includes('localhost') || host.includes('calendfree')) return;

    const company = await prisma.company.findFirst({ where: { customDomain: host } });
    if (company) {
      (request as any).resolvedCompanySlug = company.slug;
    }
  });
```

- [ ] **Step 3: Register domain routes**

Register `domainRoutes` in app.ts.

- [ ] **Step 4: Create README.md**

Create `/Users/hziech/calendfree/README.md` — see below for content.

- [ ] **Step 5: Write test, build everything, commit + push**

```typescript
// backend/src/__tests__/domains.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../app.js';
import type { FastifyInstance } from 'fastify';

describe('Custom domains', () => {
  let app: FastifyInstance;
  beforeAll(async () => { app = await buildApp(); });
  afterAll(async () => { await app.close(); });

  it('GET /api/admin/companies/:id/domain requires auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/companies/fake/domain' });
    expect(res.statusCode).toBe(401);
  });
});
```

Final commit: "feat: add custom domain management, embed widget, and README" + push

---

## README.md Content

```markdown
# Calendfree

Open-source Round-Robin Scheduling Platform — a self-hosted Calendly alternative with Google Workspace integration.

## Features

- **Round-Robin Scheduling** — Three modes: Sequential, Least-busy, Weighted
- **Team & Personal Booking Pages** — Share links for team pools or individual consultants
- **Google Calendar Integration** — FreeBusy availability check, auto-create events with Google Meet links
- **Email Notifications** — Confirmation, reminders (24h/1h), follow-ups via Gmail API (sent as the consultant)
- **Multi-Company Support** — Organization → Company → Team → User hierarchy
- **Role-Based Access** — Org-Admin, Company-Admin, User with granular permissions
- **Routing Forms** — Question-based flows that route visitors to the right event type
- **HubSpot Integration** — Async CRM sync (contact upsert + meeting creation)
- **Analytics Dashboard** — Booking stats, daily trends, top consultants, cancellation rates
- **Embed Widget** — Popup or inline iframe for external websites
- **Custom Domains** — Per-company custom domain with auto-TLS
- **API Keys** — Programmatic access for integrations
- **GDPR Compliant** — Data minimization, retention policies, right to deletion

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite, Tailwind CSS, React Router, Recharts |
| Backend | Fastify 5, TypeScript, Prisma ORM |
| Database | PostgreSQL 16 |
| Cache/Sessions | Redis 7 |
| Job Queue | pg-boss |
| Auth | Google OAuth 2.0, Redis sessions, API keys |
| Email | Gmail API (per-user OAuth) |
| Calendar | Google Calendar API v3 |
| Validation | Zod (shared between frontend & backend) |
| Testing | Vitest, Playwright |

## Quick Start

### Prerequisites

- Node.js 22+
- Docker & Docker Compose

### Setup

```bash
# Clone
git clone https://github.com/henningziech/calendfree.git
cd calendfree

# Start infrastructure
docker compose up -d

# Install dependencies
npm install

# Configure environment
cp .env.example backend/.env
# Edit backend/.env with your Google OAuth credentials

# Run database migration
npm run db:migrate

# Seed development data
npx -w backend prisma db seed

# Build shared package
npm run build -w shared

# Start development servers
npm run dev
```

Backend: http://localhost:3001
Frontend: http://localhost:5173
API Docs: http://localhost:3001/api/docs

### Google OAuth Setup

1. Create a project in [Google Cloud Console](https://console.cloud.google.com)
2. Enable Calendar API and Gmail API
3. Create OAuth 2.0 credentials (Web application)
4. Add `http://localhost:3001/api/auth/google/callback` as authorized redirect URI
5. Copy Client ID and Client Secret to `backend/.env`

## Project Structure

```
calendfree/
├── shared/          # Shared Zod schemas & TypeScript types
├── backend/         # Fastify REST API
│   ├── src/
│   │   ├── routes/       # API endpoints
│   │   ├── services/     # Business logic
│   │   ├── middleware/   # Auth, RBAC, tenant isolation
│   │   ├── jobs/         # pg-boss job handlers
│   │   └── utils/        # Encryption, helpers
│   └── prisma/           # Schema & migrations
├── frontend/        # React SPA
│   └── src/
│       ├── pages/        # Route pages
│       ├── components/   # Reusable UI
│       ├── api/          # API client
│       └── context/      # React contexts
├── embed/           # Standalone embed widget script
└── docker-compose.yml
```

## API

Interactive API documentation is available at `/api/docs` (Swagger UI).

### Public Endpoints

| Method | Endpoint | Description |
|--------|---------|-------------|
| GET | `/api/booking/:company/:event/slots` | Available time slots |
| POST | `/api/booking/:company/:event` | Create booking |
| POST | `/api/booking/:token/cancel` | Cancel booking |
| GET | `/api/booking/:company/info` | Company branding |
| GET | `/api/routing/:company/:form` | Routing form |
| POST | `/api/routing/:company/:form/resolve` | Evaluate routing |

### Authenticated Endpoints (Session or API Key)

| Method | Endpoint | Description |
|--------|---------|-------------|
| GET | `/api/me` | Current user profile |
| PATCH | `/api/me/availability` | Update availability |
| GET | `/api/me/api-keys` | List API keys |
| POST | `/api/me/api-keys` | Create API key |

### Admin Endpoints

Full CRUD for organizations, companies, teams, users, event types, routing forms, branding, and analytics.

## Embed Widget

```html
<!-- Popup mode -->
<script
  src="https://your-calendfree.com/embed.js"
  data-calendfree-company="your-company"
  data-calendfree-event-type="consultation"
  data-calendfree-mode="popup"
  data-calendfree-text="Termin buchen">
</script>

<!-- Inline mode -->
<script
  src="https://your-calendfree.com/embed.js"
  data-calendfree-company="your-company"
  data-calendfree-event-type="consultation"
  data-calendfree-mode="inline">
</script>
```

## License

Private — Seibert Group internal use.
```

---

## Verification Checklist

1. **`npm run test -w backend`** — all tests pass
2. **`npm run build -w frontend`** — frontend builds
3. **Routing Forms**: Admin CRUD + public evaluation with equals/contains/regex
4. **HubSpot**: Async sync via pg-boss, contact upsert + meeting creation
5. **Analytics**: Summary stats, daily chart (Recharts), top consultants
6. **Embed Widget**: Popup (modal) and inline (iframe) modes
7. **Custom Domains**: DNS CNAME verification, per-company domain storage
8. **README.md**: Complete with setup guide, API overview, embed docs
