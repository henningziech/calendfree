# Routing Forms Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign routing forms so visitors answer a dropdown question and get routed to the right event type, a custom message, or an external URL — with a user-friendly option-mapping builder in the admin UI.

**Architecture:** Replace the existing RoutingRule model with RoutingOption (direct option→target mapping). Rewrite admin CRUD endpoints with per-route auth (any user can create). Add a public RoutingPage for visitors and a RoutingFormDetailPage builder for admins. Pre-fill name/email from routing form to booking page via query params.

**Tech Stack:** Fastify (endpoints), Prisma (ORM), Zod (validation), React + Tailwind (UI), React Router

**Spec:** `docs/superpowers/specs/2026-03-17-routing-forms.md`

---

## Chunk 1: Backend (Schema + Endpoints)

### Task 1: Update Prisma Schema

**Files:**
- Modify: `backend/prisma/schema.prisma`

- [ ] **Step 1: Replace RoutingRule with RoutingOption and update RoutingForm**

Find the Routing Forms section (around line 390). Replace entirely with:

```prisma
// ──────────────────────────────────────────────
// Routing Forms
// ──────────────────────────────────────────────

model RoutingForm {
  id              String   @id @default(uuid())
  title           String
  slug            String
  companyId       String
  createdByUserId String
  active          Boolean  @default(true)
  description     String?
  question        String   @default("Wofür interessieren Sie sich?")
  collectName     Boolean  @default(false)
  collectEmail    Boolean  @default(false)
  fallbackType    String   @default("MESSAGE")
  fallbackValue   String   @default("Bitte kontaktieren Sie uns direkt.")
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  company   Company        @relation(fields: [companyId], references: [id], onDelete: Cascade)
  createdBy User           @relation("routingForms", fields: [createdByUserId], references: [id], onDelete: Cascade)
  options   RoutingOption[]

  @@unique([companyId, slug])
}

model RoutingOption {
  id            String @id @default(uuid())
  routingFormId String
  label         String
  targetType    String
  targetValue   String
  order         Int    @default(0)

  routingForm RoutingForm @relation(fields: [routingFormId], references: [id], onDelete: Cascade)
}
```

- [ ] **Step 2: Add reverse relation on User model**

Find the User model (around line 30). Add this line after the existing relations (e.g. after `vacations VacationPeriod[]`):

```prisma
  routingForms  RoutingForm[] @relation("routingForms")
```

- [ ] **Step 3: Remove the routingForms relation from Company model if it references RoutingRule**

The Company model already has `routingForms RoutingForm[]` — keep it. No change needed.

- [ ] **Step 4: Run migration**

```bash
cd backend && npx prisma migrate dev --name replace-routing-rule-with-routing-option
```

This will drop the `RoutingRule` table and create `RoutingOption`. Accept the data loss warning (no production data).

- [ ] **Step 5: Commit**

```bash
git add backend/prisma/
git commit -m "feat: replace RoutingRule with RoutingOption in Prisma schema"
git push
```

---

### Task 2: Add Zod Schemas

**Files:**
- Modify: `shared/src/schemas/admin.ts`

- [ ] **Step 1: Add routing form schemas at the end of the file**

```typescript
// Routing Forms
export const RoutingTargetType = z.enum(['EVENT_TYPE', 'MESSAGE', 'URL']);
export type RoutingTargetType = z.infer<typeof RoutingTargetType>;

export const RoutingOptionSchema = z.object({
  label: z.string().min(1).max(200),
  targetType: RoutingTargetType,
  targetValue: z.string().min(1).max(2000),
  order: z.number().int().min(0),
});
export type RoutingOption = z.infer<typeof RoutingOptionSchema>;

export const CreateRoutingFormSchema = z.object({
  title: z.string().min(1).max(200),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  description: z.string().max(1000).optional(),
  question: z.string().min(1).max(500).default('Wofür interessieren Sie sich?'),
  collectName: z.boolean().default(false),
  collectEmail: z.boolean().default(false),
  fallbackType: RoutingTargetType.default('MESSAGE'),
  fallbackValue: z.string().max(2000).default('Bitte kontaktieren Sie uns direkt.'),
  options: z.array(RoutingOptionSchema).min(1, 'At least one option is required'),
});
export type CreateRoutingForm = z.infer<typeof CreateRoutingFormSchema>;

export const UpdateRoutingFormSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/).optional(),
  description: z.string().max(1000).nullable().optional(),
  question: z.string().min(1).max(500).optional(),
  collectName: z.boolean().optional(),
  collectEmail: z.boolean().optional(),
  active: z.boolean().optional(),
  fallbackType: RoutingTargetType.optional(),
  fallbackValue: z.string().max(2000).optional(),
  options: z.array(RoutingOptionSchema).min(1).optional(),
});
export type UpdateRoutingForm = z.infer<typeof UpdateRoutingFormSchema>;

export const ResolveRoutingFormSchema = z.object({
  optionId: z.string().uuid(),
  name: z.string().optional(),
  email: z.string().email().optional(),
});
export type ResolveRoutingForm = z.infer<typeof ResolveRoutingFormSchema>;
```

- [ ] **Step 2: Rebuild shared package**

```bash
cd shared && npm run build
```

- [ ] **Step 3: Commit**

```bash
git add shared/src/schemas/admin.ts
git commit -m "feat: add routing form Zod schemas"
git push
```

---

### Task 3: Rewrite Admin CRUD Endpoints

**Files:**
- Modify: `backend/src/routes/admin/routing-forms.ts`

- [ ] **Step 1: Rewrite the file entirely**

```typescript
// backend/src/routes/admin/routing-forms.ts
import type { FastifyInstance } from 'fastify';
import { prisma } from '../../db.js';
import { requireAuth } from '../../middleware/auth.js';
import { CreateRoutingFormSchema, UpdateRoutingFormSchema } from '@calendfree/shared';

export async function routingFormAdminRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);

  /** GET /api/admin/routing-forms — List all for active company */
  app.get('/api/admin/routing-forms', async (request, reply) => {
    const user = request.session.user!;
    if (!user.activeCompanyId) return reply.status(400).send({ error: 'No active company' });

    return prisma.routingForm.findMany({
      where: { companyId: user.activeCompanyId },
      include: { _count: { select: { options: true } } },
      orderBy: { createdAt: 'desc' },
    });
  });

  /** POST /api/admin/routing-forms — Create */
  app.post('/api/admin/routing-forms', async (request, reply) => {
    const user = request.session.user!;
    if (!user.activeCompanyId) return reply.status(400).send({ error: 'No active company' });

    const data = CreateRoutingFormSchema.parse(request.body);
    const { options, ...formData } = data;

    try {
      const form = await prisma.routingForm.create({
        data: {
          ...formData,
          companyId: user.activeCompanyId,
          createdByUserId: user.id,
          options: { create: options },
        },
        include: { options: { orderBy: { order: 'asc' } } },
      });
      return reply.status(201).send(form);
    } catch (err: any) {
      if (err.code === 'P2002') {
        return reply.status(409).send({ error: 'Ein Routing Form mit diesem Slug existiert bereits.' });
      }
      throw err;
    }
  });

  /** GET /api/admin/routing-forms/:id — Get with options */
  app.get('/api/admin/routing-forms/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = request.session.user!;

    const form = await prisma.routingForm.findFirst({
      where: { id, companyId: user.activeCompanyId! },
      include: {
        options: { orderBy: { order: 'asc' } },
        company: { select: { slug: true } },
      },
    });
    if (!form) return reply.status(404).send({ error: 'Routing form not found' });
    return form;
  });

  /** PATCH /api/admin/routing-forms/:id — Update */
  app.patch('/api/admin/routing-forms/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = request.session.user!;

    const form = await prisma.routingForm.findFirst({
      where: { id, companyId: user.activeCompanyId! },
    });
    if (!form) return reply.status(404).send({ error: 'Routing form not found' });

    // Only creator, COMPANY_ADMIN, or ORG_ADMIN can edit
    if (form.createdByUserId !== user.id && user.activeRole !== 'COMPANY_ADMIN' && user.activeRole !== 'ORG_ADMIN') {
      return reply.status(403).send({ error: 'Not authorized to edit this form' });
    }

    const data = UpdateRoutingFormSchema.parse(request.body);
    const { options, ...formData } = data;

    const updated = await prisma.$transaction(async (tx) => {
      if (options) {
        await tx.routingOption.deleteMany({ where: { routingFormId: id } });
        await tx.routingOption.createMany({
          data: options.map((o) => ({ ...o, routingFormId: id })),
        });
      }
      return tx.routingForm.update({
        where: { id },
        data: formData,
        include: { options: { orderBy: { order: 'asc' } } },
      });
    });

    return updated;
  });

  /** DELETE /api/admin/routing-forms/:id — Delete */
  app.delete('/api/admin/routing-forms/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = request.session.user!;

    const form = await prisma.routingForm.findFirst({
      where: { id, companyId: user.activeCompanyId! },
    });
    if (!form) return reply.status(404).send({ error: 'Routing form not found' });

    if (form.createdByUserId !== user.id && user.activeRole !== 'COMPANY_ADMIN' && user.activeRole !== 'ORG_ADMIN') {
      return reply.status(403).send({ error: 'Not authorized to delete this form' });
    }

    await prisma.routingForm.delete({ where: { id } });
    return { success: true };
  });
}
```

- [ ] **Step 2: Verify the import in `backend/src/app.ts`**

The `routingFormAdminRoutes` is already registered in `app.ts` (line ~117). No change needed — the function signature is the same.

- [ ] **Step 3: Commit**

```bash
git add backend/src/routes/admin/routing-forms.ts
git commit -m "feat: rewrite routing form admin endpoints with per-route auth and RoutingOption"
git push
```

---

### Task 4: Rewrite Public Routing Endpoints

**Files:**
- Modify: `backend/src/routes/routing.ts`

- [ ] **Step 1: Rewrite the file**

```typescript
// backend/src/routes/routing.ts
import type { FastifyInstance } from 'fastify';
import { prisma } from '../db.js';
import { ResolveRoutingFormSchema } from '@calendfree/shared';

export async function routingRoutes(app: FastifyInstance) {
  /** GET /api/routing/:companySlug/:formSlug — Get routing form for display */
  app.get('/api/routing/:companySlug/:formSlug', async (request, reply) => {
    const { companySlug, formSlug } = request.params as { companySlug: string; formSlug: string };

    const company = await prisma.company.findFirst({ where: { slug: companySlug } });
    if (!company) return reply.status(404).send({ error: 'Company not found' });

    const form = await prisma.routingForm.findFirst({
      where: { companyId: company.id, slug: formSlug, active: true },
      include: { options: { orderBy: { order: 'asc' } } },
    });
    if (!form) return reply.status(404).send({ error: 'Routing form not found' });

    return {
      title: form.title,
      description: form.description,
      question: form.question,
      collectName: form.collectName,
      collectEmail: form.collectEmail,
      options: form.options.map((o) => ({ id: o.id, label: o.label })),
    };
  });

  /** POST /api/routing/:companySlug/:formSlug/resolve — Evaluate answer */
  app.post('/api/routing/:companySlug/:formSlug/resolve', async (request, reply) => {
    const { companySlug, formSlug } = request.params as { companySlug: string; formSlug: string };
    const body = ResolveRoutingFormSchema.parse(request.body);

    const company = await prisma.company.findFirst({ where: { slug: companySlug } });
    if (!company) return reply.status(404).send({ error: 'Company not found' });

    const form = await prisma.routingForm.findFirst({
      where: { companyId: company.id, slug: formSlug, active: true },
      include: { options: true },
    });
    if (!form) return reply.status(404).send({ error: 'Routing form not found' });

    const option = form.options.find((o) => o.id === body.optionId);

    const targetType = option?.targetType ?? form.fallbackType;
    const targetValue = option?.targetValue ?? form.fallbackValue;

    const prefill: Record<string, string> = {};
    if (body.name) prefill.name = body.name;
    if (body.email) prefill.email = body.email;

    return {
      type: targetType,
      value: targetValue,
      prefill: Object.keys(prefill).length > 0 ? prefill : undefined,
    };
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/routes/routing.ts
git commit -m "feat: rewrite public routing endpoints for RoutingOption model"
git push
```

---

## Chunk 2: Frontend

### Task 5: Add Frontend API Functions

**Files:**
- Modify: `frontend/src/api/admin.ts`

- [ ] **Step 1: Add routing form API functions at the end of the file**

```typescript
// Routing Forms
export async function getRoutingForms() {
  return apiRequest<any[]>('/admin/routing-forms');
}

export async function createRoutingForm(data: any) {
  return apiRequest('/admin/routing-forms', { method: 'POST', body: JSON.stringify(data) });
}

export async function getRoutingForm(id: string) {
  return apiRequest(`/admin/routing-forms/${id}`);
}

export async function updateRoutingForm(id: string, data: any) {
  return apiRequest(`/admin/routing-forms/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}

export async function deleteRoutingForm(id: string) {
  return apiRequest(`/admin/routing-forms/${id}`, { method: 'DELETE' });
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/api/admin.ts
git commit -m "feat: add routing form CRUD API functions"
git push
```

---

### Task 6: Move and Redesign RoutingFormsPage

**Files:**
- Create: `frontend/src/pages/dashboard/RoutingFormsPage.tsx` (move from admin)
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Create the new RoutingFormsPage**

Create `frontend/src/pages/dashboard/RoutingFormsPage.tsx`:

```tsx
import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { getRoutingForms, createRoutingForm, deleteRoutingForm } from '../../api/admin';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ErrorMessage } from '../../components/ui/ErrorMessage';

export function RoutingFormsPage() {
  const [forms, setForms] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newSlug, setNewSlug] = useState('');

  const load = async () => {
    setIsLoading(true);
    try {
      setForms(await getRoutingForms());
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newSlug.trim()) return;
    try {
      await createRoutingForm({
        title: newTitle.trim(),
        slug: newSlug.trim(),
        question: 'Wofür interessieren Sie sich?',
        options: [{ label: 'Option 1', targetType: 'MESSAGE', targetValue: 'Bitte kontaktieren Sie uns direkt.', order: 0 }],
      });
      setNewTitle('');
      setNewSlug('');
      setShowCreate(false);
      load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm('Routing Form wirklich löschen?')) return;
    try {
      await deleteRoutingForm(id);
      load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (isLoading) return <LoadingSpinner />;

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#1E293B]">Routing Forms</h1>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="rounded-xl bg-gradient-to-r from-[#0B8ECA] to-[#14B8A6] px-4 py-2 text-sm font-medium text-white shadow-sm hover:shadow-md"
        >
          + Neues Routing Form
        </button>
      </div>
      <p className="mt-2 text-sm text-[#64748B]">Leiten Sie Besucher basierend auf ihren Antworten zum passenden Terminplaner.</p>

      {error && <ErrorMessage message={error} />}

      {showCreate && (
        <form onSubmit={handleCreate} className="mt-4 rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-sm">
          <div className="flex gap-3">
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Titel (z.B. Themenwahl)"
              required
              className="flex-1 rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm focus:border-[#0B8ECA] focus:outline-none"
              autoFocus
            />
            <input
              value={newSlug}
              onChange={(e) => setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
              placeholder="slug (z.B. start)"
              required
              className="flex-1 rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm focus:border-[#0B8ECA] focus:outline-none"
            />
            <button type="submit" className="rounded-xl bg-[#0B8ECA] px-4 py-2 text-sm font-medium text-white">Erstellen</button>
            <button type="button" onClick={() => setShowCreate(false)} className="rounded-xl border border-[#E2E8F0] px-4 py-2 text-sm text-[#64748B]">Abbrechen</button>
          </div>
        </form>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {forms.map((f: any) => (
          <Link
            key={f.id}
            to={`/dashboard/routing-forms/${f.id}`}
            className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-sm transition-all hover:border-[#0B8ECA]/30 hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-[#1E293B]">{f.title}</h3>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${f.active ? 'bg-[#14B8A6]/10 text-[#14B8A6]' : 'bg-[#64748B]/10 text-[#64748B]'}`}>
                {f.active ? 'Aktiv' : 'Inaktiv'}
              </span>
            </div>
            <p className="mt-2 text-sm text-[#64748B]">
              /{f.slug} · {f._count?.options ?? 0} Optionen
            </p>
            <button
              onClick={(e) => handleDelete(e, f.id)}
              className="mt-3 text-xs font-medium text-[#EF4444] transition-colors hover:text-red-600"
            >
              Löschen
            </button>
          </Link>
        ))}
      </div>

      {!isLoading && forms.length === 0 && !showCreate && (
        <div className="mt-12 text-center">
          <p className="text-lg text-[#64748B]">Keine Routing Forms vorhanden</p>
          <p className="text-sm text-[#94A3B8]">Erstellen Sie ein Routing Form, um Besucher zum passenden Terminplaner zu leiten.</p>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Update App.tsx routes**

Read `frontend/src/App.tsx`. Make these changes:

1. Change the import from `import { RoutingFormsPage } from './pages/admin/RoutingFormsPage';` to `import { RoutingFormsPage } from './pages/dashboard/RoutingFormsPage';`
2. Remove `<Route path="routing-forms" element={<RoutingFormsPage />} />` from the admin section
3. Add inside the dashboard routes (after the `settings` route):
```tsx
<Route path="routing-forms" element={<RoutingFormsPage />} />
<Route path="routing-forms/:id" element={<RoutingFormDetailPage />} />
```
4. Add import at top: `import { RoutingFormDetailPage } from './pages/dashboard/RoutingFormDetailPage';`

- [ ] **Step 3: Delete the old admin page**

```bash
rm frontend/src/pages/admin/RoutingFormsPage.tsx
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/dashboard/RoutingFormsPage.tsx frontend/src/App.tsx
git rm frontend/src/pages/admin/RoutingFormsPage.tsx
git commit -m "feat: move RoutingFormsPage to dashboard with card grid design"
git push
```

---

### Task 7: Create RoutingFormDetailPage

**Files:**
- Create: `frontend/src/pages/dashboard/RoutingFormDetailPage.tsx`

- [ ] **Step 1: Create the detail/builder page**

Create `frontend/src/pages/dashboard/RoutingFormDetailPage.tsx`:

```tsx
import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router';
import { useAuth } from '../../context/AuthContext';
import { getRoutingForm, updateRoutingForm } from '../../api/admin';
import { apiRequest } from '../../api/client';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ErrorMessage } from '../../components/ui/ErrorMessage';

interface RoutingOptionRow {
  label: string;
  targetType: 'EVENT_TYPE' | 'MESSAGE' | 'URL';
  targetValue: string;
  order: number;
}

export function RoutingFormDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [form, setForm] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Editable fields
  const [title, setTitle] = useState('');
  const [editingTitle, setEditingTitle] = useState(false);
  const [description, setDescription] = useState('');
  const [question, setQuestion] = useState('');
  const [collectName, setCollectName] = useState(false);
  const [collectEmail, setCollectEmail] = useState(false);
  const [active, setActive] = useState(true);
  const [options, setOptions] = useState<RoutingOptionRow[]>([]);
  const [fallbackType, setFallbackType] = useState<'EVENT_TYPE' | 'MESSAGE' | 'URL'>('MESSAGE');
  const [fallbackValue, setFallbackValue] = useState('');

  // Event types for dropdown
  const [eventTypes, setEventTypes] = useState<any[]>([]);

  const load = async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      const [formData, etData] = await Promise.all([
        getRoutingForm(id),
        apiRequest<any[]>(`/admin/companies/${user?.activeCompanyId}/event-types`),
      ]);
      setForm(formData);
      setTitle(formData.title);
      setDescription(formData.description || '');
      setQuestion(formData.question);
      setCollectName(formData.collectName);
      setCollectEmail(formData.collectEmail);
      setActive(formData.active);
      setFallbackType(formData.fallbackType);
      setFallbackValue(formData.fallbackValue);
      setOptions(
        formData.options.map((o: any) => ({
          label: o.label,
          targetType: o.targetType,
          targetValue: o.targetValue,
          order: o.order,
        }))
      );
      setEventTypes(etData);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await updateRoutingForm(id!, {
        title,
        description: description || null,
        question,
        collectName,
        collectEmail,
        active,
        fallbackType,
        fallbackValue,
        options: options.map((o, i) => ({ ...o, order: i })),
      });
      setSuccess('Gespeichert!');
      setTimeout(() => setSuccess(null), 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const addOption = () => {
    setOptions([...options, { label: '', targetType: 'EVENT_TYPE', targetValue: eventTypes[0]?.slug || '', order: options.length }]);
  };

  const removeOption = (index: number) => {
    setOptions(options.filter((_, i) => i !== index));
  };

  const updateOption = (index: number, field: keyof RoutingOptionRow, value: string) => {
    const updated = [...options];
    (updated[index] as any)[field] = value;
    setOptions(updated);
  };

  const moveOption = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === options.length - 1) return;
    const updated = [...options];
    const target = direction === 'up' ? index - 1 : index + 1;
    [updated[index], updated[target]] = [updated[target], updated[index]];
    setOptions(updated);
  };

  const companySlug = form?.company?.slug;

  if (isLoading) return <LoadingSpinner />;
  if (!form) return <ErrorMessage message="Routing Form nicht gefunden." />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link to="/dashboard/routing-forms" className="text-sm font-medium text-[#0B8ECA] hover:text-[#0874A6]">
          ← Zurück zu Routing Forms
        </Link>
        <div className="mt-2 flex items-center gap-4">
          {editingTitle ? (
            <div className="flex items-center gap-2">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="text-2xl font-bold text-[#1E293B] border-b-2 border-[#0B8ECA] focus:outline-none"
                autoFocus
                onBlur={() => setEditingTitle(false)}
                onKeyDown={(e) => e.key === 'Enter' && setEditingTitle(false)}
              />
            </div>
          ) : (
            <h1
              className="text-2xl font-bold text-[#1E293B] cursor-pointer hover:text-[#0B8ECA] transition-colors"
              onClick={() => setEditingTitle(true)}
            >
              {title}
            </h1>
          )}
          <button
            onClick={() => { setActive(!active); }}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${active ? 'bg-[#14B8A6]/10 text-[#14B8A6]' : 'bg-[#64748B]/10 text-[#64748B]'}`}
          >
            {active ? 'Aktiv' : 'Inaktiv'}
          </button>
        </div>
      </div>

      {error && <ErrorMessage message={error} />}
      {success && <div className="rounded-xl border border-[#14B8A6]/30 bg-[#14B8A6]/5 p-3 text-sm text-[#14B8A6]">{success}</div>}

      {/* Settings */}
      <div className="rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-[#1E293B]">Einstellungen</h2>
        <div className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#1E293B]">Beschreibung (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Wählen Sie Ihr Thema und wir verbinden Sie mit dem richtigen Ansprechpartner."
              rows={2}
              className="mt-1 w-full rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm focus:border-[#0B8ECA] focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#1E293B]">Frage</label>
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm focus:border-[#0B8ECA] focus:outline-none"
            />
          </div>
          <div className="flex gap-6">
            <label className="flex items-center gap-2 text-sm text-[#1E293B]">
              <input type="checkbox" checked={collectName} onChange={(e) => setCollectName(e.target.checked)} className="rounded" />
              Name abfragen
            </label>
            <label className="flex items-center gap-2 text-sm text-[#1E293B]">
              <input type="checkbox" checked={collectEmail} onChange={(e) => setCollectEmail(e.target.checked)} className="rounded" />
              E-Mail abfragen
            </label>
          </div>
          <div>
            <label className="block text-sm font-medium text-[#64748B]">Slug</label>
            <p className="mt-1 text-sm text-[#94A3B8]">/{form.slug}</p>
          </div>
        </div>
      </div>

      {/* Option Mapping Table */}
      <div className="rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-[#1E293B]">Optionen</h2>
        <p className="mt-1 text-sm text-[#64748B]">Jede Dropdown-Option wird einem Ziel zugeordnet.</p>

        <div className="mt-4 space-y-3">
          {options.map((opt, i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3">
              {/* Reorder buttons */}
              <div className="flex flex-col gap-0.5">
                <button onClick={() => moveOption(i, 'up')} disabled={i === 0} className="text-[#64748B] hover:text-[#1E293B] disabled:opacity-30 text-xs">▲</button>
                <button onClick={() => moveOption(i, 'down')} disabled={i === options.length - 1} className="text-[#64748B] hover:text-[#1E293B] disabled:opacity-30 text-xs">▼</button>
              </div>

              {/* Label */}
              <input
                value={opt.label}
                onChange={(e) => updateOption(i, 'label', e.target.value)}
                placeholder="Option Label"
                className="w-40 rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-sm focus:border-[#0B8ECA] focus:outline-none"
              />

              <span className="text-[#64748B]">→</span>

              {/* Target type */}
              <select
                value={opt.targetType}
                onChange={(e) => updateOption(i, 'targetType', e.target.value)}
                className="rounded-lg border border-[#E2E8F0] px-2 py-1.5 text-sm focus:border-[#0B8ECA] focus:outline-none"
              >
                <option value="EVENT_TYPE">Event Type</option>
                <option value="MESSAGE">Nachricht</option>
                <option value="URL">Externe URL</option>
              </select>

              {/* Target value */}
              {opt.targetType === 'EVENT_TYPE' ? (
                <select
                  value={opt.targetValue}
                  onChange={(e) => updateOption(i, 'targetValue', e.target.value)}
                  className="flex-1 rounded-lg border border-[#E2E8F0] px-2 py-1.5 text-sm focus:border-[#0B8ECA] focus:outline-none"
                >
                  <option value="">— Event Type wählen —</option>
                  {eventTypes.map((et: any) => (
                    <option key={et.id} value={et.slug}>{et.title} ({et.duration} Min)</option>
                  ))}
                </select>
              ) : (
                <input
                  value={opt.targetValue}
                  onChange={(e) => updateOption(i, 'targetValue', e.target.value)}
                  placeholder={opt.targetType === 'URL' ? 'https://...' : 'Nachricht...'}
                  className="flex-1 rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-sm focus:border-[#0B8ECA] focus:outline-none"
                />
              )}

              {/* Delete */}
              <button onClick={() => removeOption(i)} className="text-[#EF4444] hover:text-red-600 text-sm font-medium">✕</button>
            </div>
          ))}
        </div>

        <button
          onClick={addOption}
          className="mt-3 rounded-xl border border-dashed border-[#CBD5E1] px-4 py-2 text-sm text-[#64748B] transition-colors hover:border-[#0B8ECA] hover:text-[#0B8ECA]"
        >
          + Option hinzufügen
        </button>
      </div>

      {/* Fallback */}
      <div className="rounded-xl border border-[#F59E0B]/30 bg-[#FFFBEB] p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-[#92400E]">Fallback</h2>
        <p className="mt-1 text-sm text-[#A16207]">Was passiert, wenn keine Option passt.</p>
        <div className="mt-4 flex items-center gap-3">
          <select
            value={fallbackType}
            onChange={(e) => setFallbackType(e.target.value as any)}
            className="rounded-lg border border-[#E2E8F0] px-2 py-1.5 text-sm focus:border-[#0B8ECA] focus:outline-none"
          >
            <option value="EVENT_TYPE">Event Type</option>
            <option value="MESSAGE">Nachricht</option>
            <option value="URL">Externe URL</option>
          </select>
          {fallbackType === 'EVENT_TYPE' ? (
            <select
              value={fallbackValue}
              onChange={(e) => setFallbackValue(e.target.value)}
              className="flex-1 rounded-lg border border-[#E2E8F0] px-2 py-1.5 text-sm focus:border-[#0B8ECA] focus:outline-none"
            >
              <option value="">— Event Type wählen —</option>
              {eventTypes.map((et: any) => (
                <option key={et.id} value={et.slug}>{et.title} ({et.duration} Min)</option>
              ))}
            </select>
          ) : (
            <input
              value={fallbackValue}
              onChange={(e) => setFallbackValue(e.target.value)}
              placeholder={fallbackType === 'URL' ? 'https://...' : 'Nachricht...'}
              className="flex-1 rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-sm focus:border-[#0B8ECA] focus:outline-none"
            />
          )}
        </div>
      </div>

      {/* Vorschau Link */}
      {form.slug && (
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-sm">
          <label className="block text-sm font-medium text-[#64748B]">Vorschau-Link</label>
          <a
            href={`/${companySlug || ''}/routing/${form.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 text-sm text-[#0B8ECA] underline hover:text-[#0874A6]"
          >
            /{companySlug || '...'}/routing/{form.slug}
          </a>
        </div>
      )}

      {/* Save */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="rounded-xl bg-gradient-to-r from-[#0B8ECA] to-[#14B8A6] px-6 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:shadow-md disabled:opacity-50"
        >
          {isSaving ? 'Speichern...' : 'Speichern'}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/dashboard/RoutingFormDetailPage.tsx
git commit -m "feat: add RoutingFormDetailPage with option-mapping builder"
git push
```

---

### Task 8: Add Sidebar Navigation + Public RoutingPage

**Files:**
- Modify: `frontend/src/components/layout/Sidebar.tsx`
- Create: `frontend/src/pages/booking/RoutingPage.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/pages/booking/BookingPage.tsx`

- [ ] **Step 1: Add "Routing" to sidebar MAIN_NAV**

In `frontend/src/components/layout/Sidebar.tsx`, find the `MAIN_NAV` array and add after the "Teams" entry:

```typescript
{ to: '/dashboard/routing-forms', label: 'Routing' },
```

- [ ] **Step 2: Create the public RoutingPage**

Create `frontend/src/pages/booking/RoutingPage.tsx`:

```tsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import { apiRequest } from '../../api/client';
import { BrandedLayout } from '../../components/layout/BrandedLayout';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';

interface RoutingFormData {
  title: string;
  description: string | null;
  question: string;
  collectName: boolean;
  collectEmail: boolean;
  options: Array<{ id: string; label: string }>;
}

export function RoutingPage() {
  const { companySlug, formSlug } = useParams<{ companySlug: string; formSlug: string }>();
  const navigate = useNavigate();
  const [form, setForm] = useState<RoutingFormData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedOptionId, setSelectedOptionId] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!companySlug || !formSlug) return;
    setIsLoading(true);
    apiRequest<RoutingFormData>(`/routing/${companySlug}/${formSlug}`)
      .then(setForm)
      .catch((err) => {
        if (err.status === 404) {
          setError('Dieses Formular ist nicht mehr verfügbar.');
        } else {
          setError('Formular konnte nicht geladen werden.');
        }
      })
      .finally(() => setIsLoading(false));
  }, [companySlug, formSlug]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOptionId || !companySlug || !formSlug) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const result = await apiRequest<{ type: string; value: string; prefill?: { name?: string; email?: string } }>(
        `/routing/${companySlug}/${formSlug}/resolve`,
        {
          method: 'POST',
          body: JSON.stringify({
            optionId: selectedOptionId,
            ...(name ? { name } : {}),
            ...(email ? { email } : {}),
          }),
        }
      );

      switch (result.type) {
        case 'EVENT_TYPE': {
          const params = new URLSearchParams();
          if (result.prefill?.name) params.set('name', result.prefill.name);
          if (result.prefill?.email) params.set('email', result.prefill.email);
          const qs = params.toString();
          navigate(`/${companySlug}/${result.value}${qs ? `?${qs}` : ''}`);
          break;
        }
        case 'MESSAGE':
          setMessage(result.value);
          break;
        case 'URL':
          window.location.href = result.value;
          break;
      }
    } catch (err: any) {
      setError(err.message || 'Ein Fehler ist aufgetreten.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <BrandedLayout companySlug={companySlug!}>
        <LoadingSpinner />
      </BrandedLayout>
    );
  }

  if (error && !form) {
    return (
      <BrandedLayout companySlug={companySlug!}>
        <div className="mx-auto max-w-md text-center py-16">
          <p className="text-lg text-[#64748B]">{error}</p>
        </div>
      </BrandedLayout>
    );
  }

  if (message) {
    return (
      <BrandedLayout companySlug={companySlug!}>
        <div className="mx-auto max-w-md py-16">
          <div className="rounded-xl border border-[#E2E8F0] bg-white p-8 shadow-sm text-center">
            <div className="text-4xl mb-4">💬</div>
            <p className="text-[#1E293B] whitespace-pre-wrap">{message}</p>
          </div>
        </div>
      </BrandedLayout>
    );
  }

  return (
    <BrandedLayout companySlug={companySlug!}>
      <div className="mx-auto max-w-md py-8">
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-8 shadow-sm">
          <h1 className="text-xl font-bold text-[#1E293B]">{form?.title}</h1>
          {form?.description && <p className="mt-2 text-sm text-[#64748B]">{form.description}</p>}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {form?.collectName && (
              <div>
                <label className="block text-sm font-medium text-[#1E293B]">Name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm focus:border-[#0B8ECA] focus:outline-none"
                />
              </div>
            )}

            {form?.collectEmail && (
              <div>
                <label className="block text-sm font-medium text-[#1E293B]">E-Mail</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm focus:border-[#0B8ECA] focus:outline-none"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-[#1E293B]">{form?.question}</label>
              <select
                value={selectedOptionId}
                onChange={(e) => setSelectedOptionId(e.target.value)}
                required
                className="mt-1 w-full rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm focus:border-[#0B8ECA] focus:outline-none"
              >
                <option value="">— Bitte wählen —</option>
                {form?.options.map((opt) => (
                  <option key={opt.id} value={opt.id}>{opt.label}</option>
                ))}
              </select>
            </div>

            {error && <p className="text-sm text-[#EF4444]">{error}</p>}

            <button
              type="submit"
              disabled={isSubmitting || !selectedOptionId}
              className="w-full rounded-xl bg-gradient-to-r from-[#0B8ECA] to-[#14B8A6] px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:shadow-md disabled:opacity-50"
            >
              {isSubmitting ? 'Wird verarbeitet...' : 'Weiter'}
            </button>
          </form>
        </div>
      </div>
    </BrandedLayout>
  );
}
```

- [ ] **Step 3: Add public routing route in App.tsx**

Add BEFORE the catch-all booking routes (`/:companySlug/:eventTypeSlug`):

```tsx
import { RoutingPage } from './pages/booking/RoutingPage';
```

```tsx
{/* Routing forms (public, must be before catch-all booking routes) */}
<Route path="/:companySlug/routing/:formSlug" element={<RoutingPage />} />
```

- [ ] **Step 4: Add pre-fill support to BookingPage**

In `frontend/src/pages/booking/BookingPage.tsx`:

1. Add `useSearchParams` to the import from `react-router`:
```tsx
import { useParams, useNavigate, useSearchParams } from 'react-router';
```

2. Inside the component, after the existing state declarations, add:
```tsx
const [searchParams] = useSearchParams();
const prefillName = searchParams.get('name') || '';
const prefillEmail = searchParams.get('email') || '';
```

3. Pass these as props to the `<BookingForm>` component:
```tsx
<BookingForm
  onSubmit={handleBooking}
  isSubmitting={isSubmitting}
  eventTypeTitle={title}
  selectedTime={...}
  allowComment={eventInfo?.allowComment}
  initialName={prefillName}
  initialEmail={prefillEmail}
/>
```

4. In `frontend/src/components/forms/BookingForm.tsx`, add the props and use them as initial state:

Add to `BookingFormProps`:
```tsx
initialName?: string;
initialEmail?: string;
```

Update the destructuring and state:
```tsx
export function BookingForm({ onSubmit, isSubmitting, eventTypeTitle, selectedTime, allowComment, initialName, initialEmail }: BookingFormProps) {
  const [name, setName] = useState(initialName || '');
  const [email, setEmail] = useState(initialEmail || '');
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/layout/Sidebar.tsx frontend/src/pages/booking/RoutingPage.tsx frontend/src/App.tsx frontend/src/pages/booking/BookingPage.tsx frontend/src/components/forms/BookingForm.tsx
git commit -m "feat: add public RoutingPage, sidebar nav, and booking pre-fill support"
git push
```

---

## Verification

- [ ] **RoutingFormsPage**: Cards show title, slug, option count, active badge; clickable to detail
- [ ] **Create**: Inline form creates new routing form with default question and placeholder option
- [ ] **RoutingFormDetailPage**: Shows settings, option-mapping table, fallback, preview link
- [ ] **Edit options**: Add/remove/reorder options, change target type/value, save persists
- [ ] **Active toggle**: Toggling and saving makes form active/inactive
- [ ] **Public RoutingPage**: Branded page with dropdown, name/email fields
- [ ] **Route to Event Type**: Selecting option → "Weiter" → redirects to booking page
- [ ] **Pre-fill**: Name/email from routing form appear in booking form
- [ ] **Route to Message**: Shows styled message card
- [ ] **Route to URL**: Redirects to external URL
- [ ] **Inactive form**: Public page shows "nicht mehr verfügbar"
- [ ] **Permissions**: Any user can create/list, only creator/admin can edit/delete
- [ ] **Sidebar**: "Routing" nav item visible and functional
