# Routing Forms

## Context

Routing Forms let visitors answer screening questions and get automatically routed to the right event type, a custom message, or an external URL. The codebase has a basic `RoutingForm` + `RoutingRule` schema and two public endpoints, but no admin UI, no form builder, and limited functionality. This redesigns routing forms into a complete, user-friendly feature.

**Breaking changes:** This redesign changes the authorization model (from COMPANY_ADMIN/ORG_ADMIN-only to any authenticated user for create/list/view) and replaces the `RoutingRule` model with `RoutingOption`. Existing routing form data will be dropped (no production data exists yet). The existing `requireRole` hook on the admin routing-forms plugin must be removed and replaced with per-route auth checks.

## Scope

### 1. Data Model Redesign

Replace the current `RoutingRule` model. A `RoutingForm` now has:

- **One routing question** (dropdown) with options, each mapped to a target
- **Optional info fields** (name, email) for pre-fill — passed as query params to the booking page
- **A fallback target** — defensive default if resolve is called without a valid option

**RoutingForm** (modify existing):
- `title`, `slug`, `companyId`, `active`, `createdAt`, `updatedAt` — keep as-is
- Add: `createdByUserId` (String) — relation to `User` model (`createdBy User @relation(fields: [createdByUserId], references: [id])`)
- Add: `description` (String?, optional) — shown to visitors above the question
- Add: `question` (String) — the routing question label, e.g. "Wofür interessieren Sie sich?"
- Add: `collectName` (Boolean, default false) — show a name field before the question
- Add: `collectEmail` (Boolean, default false) — show an email field before the question
- Add: `fallbackType` (String: "EVENT_TYPE" | "MESSAGE" | "URL", default "MESSAGE") — defensive fallback
- Add: `fallbackValue` (String, default "Bitte kontaktieren Sie uns direkt.") — fallback target value
- Remove relation to `RoutingRule`; add relation to `RoutingOption`
- Add reverse relation on `User` model: `routingForms RoutingForm[]`

**RoutingOption** (new model, replaces `RoutingRule`):
- `id` (UUID)
- `routingFormId` (String)
- `label` (String) — the dropdown option text, e.g. "Enterprise"
- `targetType` (String: "EVENT_TYPE" | "MESSAGE" | "URL")
- `targetValue` (String) — event type slug, message text, or URL
- `order` (Int) — display order in dropdown
- Relation: `routingForm RoutingForm @relation(fields: [routingFormId], references: [id], onDelete: Cascade)`

Drop the `RoutingRule` model entirely (migration removes it). No data migration needed — no production data exists.

### 2. Zod Validation Schemas

Add to `shared/src/schemas/admin.ts`:

```typescript
const RoutingTargetType = z.enum(['EVENT_TYPE', 'MESSAGE', 'URL']);

const RoutingOptionSchema = z.object({
  label: z.string().min(1).max(200),
  targetType: RoutingTargetType,
  targetValue: z.string().min(1).max(2000),
  order: z.number().int().min(0),
});

const CreateRoutingFormSchema = z.object({
  title: z.string().min(1).max(200),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  description: z.string().max(1000).optional(),
  question: z.string().min(1).max(500),
  collectName: z.boolean().default(false),
  collectEmail: z.boolean().default(false),
  fallbackType: RoutingTargetType.default('MESSAGE'),
  fallbackValue: z.string().max(2000).default('Bitte kontaktieren Sie uns direkt.'),
  options: z.array(RoutingOptionSchema).min(1),
});

const UpdateRoutingFormSchema = CreateRoutingFormSchema.partial().extend({
  active: z.boolean().optional(),
  options: z.array(RoutingOptionSchema).min(1).optional(), // full replace when provided
});

const ResolveRoutingFormSchema = z.object({
  optionId: z.string().uuid(), // RoutingOption.id selected by visitor
  name: z.string().optional(),
  email: z.string().email().optional(),
});
```

### 3. Backend API

**Existing public endpoints** (rewrite in `backend/src/routes/routing.ts`):

`GET /api/routing/:companySlug/:formSlug` — Return form for display:
```json
{
  "title": "Themenwahl",
  "description": "Wählen Sie Ihr Thema...",
  "question": "Wofür interessieren Sie sich?",
  "collectName": true,
  "collectEmail": true,
  "options": [
    { "id": "uuid-1", "label": "Enterprise" },
    { "id": "uuid-2", "label": "Professional" },
    { "id": "uuid-3", "label": "Starter" }
  ]
}
```
- Returns 404 if form not found or inactive
- Options ordered by `order` field

`POST /api/routing/:companySlug/:formSlug/resolve` — Evaluate answer, return target:
- Body: `{ "optionId": "uuid-1", "name": "Max", "email": "max@test.de" }`
- Validates with `ResolveRoutingFormSchema`
- Looks up `RoutingOption` by `optionId` — if found, uses its `targetType`/`targetValue`
- If `optionId` not found in this form: uses form's `fallbackType`/`fallbackValue`
- Response: `{ "type": "EVENT_TYPE", "value": "enterprise-demo", "prefill": { "name": "Max", "email": "max@test.de" } }` or `{ "type": "MESSAGE", "value": "Bitte nutzen Sie..." }` or `{ "type": "URL", "value": "https://..." }`

**New admin endpoints** (new file `backend/src/routes/admin/routing-forms.ts`):

All endpoints use `requireAuth` (not `requireRole`) — any authenticated user can access. Company scoping uses `request.session.user.activeCompanyId`.

`GET /api/admin/routing-forms` — List all routing forms for user's active company
- Returns forms with `_count: { options: true }`
- Ordered by `createdAt DESC`

`POST /api/admin/routing-forms` — Create routing form
- Validates with `CreateRoutingFormSchema`
- Sets `companyId` from `activeCompanyId`, `createdByUserId` from session
- Creates form + options in a transaction
- Returns 409 on duplicate slug (unique constraint `[companyId, slug]`)

`GET /api/admin/routing-forms/:id` — Get routing form with all options
- Includes `options` ordered by `order`
- Verifies form belongs to user's active company

`PATCH /api/admin/routing-forms/:id` — Update routing form
- Validates with `UpdateRoutingFormSchema`
- Auth: creator OR COMPANY_ADMIN OR ORG_ADMIN
- If `options` provided: delete all existing options, create new ones (full replace) in transaction
- Active toggle uses same endpoint: `{ "active": false }`

`DELETE /api/admin/routing-forms/:id` — Delete routing form
- Auth: creator OR COMPANY_ADMIN OR ORG_ADMIN

Register in `backend/src/app.ts`.

### 4. Frontend — Admin Pages

**RoutingFormsPage** — move from `frontend/src/pages/admin/RoutingFormsPage.tsx` to `frontend/src/pages/dashboard/RoutingFormsPage.tsx`:
- Move route from `/admin/routing-forms` to `/dashboard/routing-forms` (remove old route from App.tsx)
- List of routing forms as clickable cards: title, slug, option count, active/inactive badge
- Cards link to `/dashboard/routing-forms/:id`
- "+ Neues Routing Form" button → inline create form (title + slug, question defaults to "Wofür interessieren Sie sich?")
- Delete button per card (with confirm, `e.preventDefault()` + `e.stopPropagation()`)

**RoutingFormDetailPage** (`frontend/src/pages/dashboard/RoutingFormDetailPage.tsx`) — new page:
- **Header**: "← Zurück zu Routing Forms" back link, form title (inline edit, same pattern as TeamDetailPage), active toggle switch
- **Einstellungen (Settings) card**: description textarea, question label input, collectName/collectEmail toggle switches, slug (read-only display)
- **Option-Mapping-Tabelle card**: table rows, each with:
  - Label (text input)
  - Target type selector (dropdown: "Event Type" / "Nachricht" / "Externe URL")
  - Target value: event type dropdown (loaded from company event types), text input, or URL input — depending on selected target type
  - Delete button (trash icon)
  - Reorder via up/down arrow buttons (no drag-and-drop library needed for V1)
  - "+ Option hinzufügen" button at bottom
- **Fallback card**: same target type + value selector pattern as options, labeled "Wenn keine Option passt:"
- **Vorschau-Link**: clickable public URL `/:companySlug/routing/:formSlug` (opens in new tab)
- **"Speichern" button**: saves entire form + options in one PATCH request
- **Error states**: 404 if form not found, permission error if not authorized to edit

### 5. Frontend — Public Routing Page

**RoutingPage** (`frontend/src/pages/booking/RoutingPage.tsx`) — new public page:
- Route in App.tsx: `/:companySlug/routing/:formSlug` (must be BEFORE the catch-all `/:companySlug/:eventTypeSlug`)
- Company branding loaded from existing `/api/booking/:companySlug/info`
- Displays: form title, description, optional name/email fields, dropdown with options, "Weiter" button
- On submit: POST to `/api/routing/:companySlug/:formSlug/resolve`
- Handle response by `type`:
  - `EVENT_TYPE`: navigate to `/:companySlug/${value}?name=...&email=...`
  - `MESSAGE`: show message text in a styled card with company branding (no redirect)
  - `URL`: `window.location.href = value` (external redirect)
- Error states: form not found (404 page), form inactive (show "Dieses Formular ist nicht mehr verfügbar"), network error

**BookingPage** update (`frontend/src/pages/booking/BookingPage.tsx`):
- Read `name` and `email` from URL query params (`useSearchParams`)
- Pre-fill the booking form fields if present

### 6. Navigation

- Add "Routing" nav item to Sidebar after "Teams"
- Icon: a split/fork icon (or simple arrow-split SVG)
- Route: `/dashboard/routing-forms`

### 7. Frontend API Functions

Add to `frontend/src/api/admin.ts`:
```typescript
export async function getRoutingForms() { ... }
export async function createRoutingForm(data: any) { ... }
export async function getRoutingForm(id: string) { ... }
export async function updateRoutingForm(id: string, data: any) { ... }
export async function deleteRoutingForm(id: string) { ... }
```

### Files to modify

**Backend:**
- `backend/prisma/schema.prisma` — redesign RoutingForm, add RoutingOption, drop RoutingRule, add User relation
- `backend/src/routes/routing.ts` — rewrite public endpoints to use RoutingOption
- `backend/src/routes/admin/routing-forms.ts` — rewrite with per-route auth (remove requireRole plugin hook)
- `backend/src/app.ts` — verify admin routes registration

**Shared:**
- `shared/src/schemas/admin.ts` — add Zod schemas (CreateRoutingFormSchema, UpdateRoutingFormSchema, ResolveRoutingFormSchema, RoutingOptionSchema, RoutingTargetType)

**Frontend:**
- `frontend/src/pages/admin/RoutingFormsPage.tsx` → move to `frontend/src/pages/dashboard/RoutingFormsPage.tsx`
- `frontend/src/pages/dashboard/RoutingFormDetailPage.tsx` — new form builder page
- `frontend/src/pages/booking/RoutingPage.tsx` — new public routing form page
- `frontend/src/pages/booking/BookingPage.tsx` — read pre-fill query params
- `frontend/src/components/layout/Sidebar.tsx` — add "Routing" nav item
- `frontend/src/App.tsx` — add/move routes, remove old `/admin/routing-forms`
- `frontend/src/api/admin.ts` — add routing form CRUD API functions

## Verification

1. **Create**: User creates routing form with title, slug, question, and dropdown options mapped to event types/messages/URLs
2. **Edit**: Detail page shows option-mapping table, user can add/remove/reorder options, change targets, toggle active
3. **Public form**: Visitor opens `/:companySlug/routing/:formSlug`, sees branded form with dropdown
4. **Routing to event type**: Selecting "Enterprise" and clicking "Weiter" redirects to the mapped event type booking page
5. **Pre-fill**: Name/email entered in routing form appear pre-filled on booking page
6. **Message target**: Selecting an option mapped to "Nachricht" shows the message instead of redirecting
7. **URL target**: Selecting an option mapped to a URL redirects to that URL
8. **Fallback**: Invalid optionId in resolve request uses fallback target
9. **Permissions**: Any user can create/list/view forms, only creator/COMPANY_ADMIN/ORG_ADMIN can edit/delete
10. **Slug uniqueness**: Creating a form with a duplicate slug returns a user-friendly error
11. **Inactive form**: Public page shows "Dieses Formular ist nicht mehr verfügbar" for inactive forms
