# Company Branding Feature — Design Spec

## Context

Calendfree is a round-robin scheduling platform. Companies have public-facing booking pages (`/:companySlug/:eventTypeSlug`) where external users book meetings. Currently, these pages use hardcoded colors and a fixed "Powered by Calendfree" footer. Admins need the ability to customize the look of these public pages per company — logo, colors, and footer.

A `BrandingConfig` Prisma model already exists with `logoUrl`, `primaryColor`, `accentColor`, and `fontFamily` fields. API endpoints for reading and writing branding exist. A `BrandedLayout` component sets CSS custom properties for primary/accent colors and renders a logo. However: no admin UI exists for editing branding, no file upload infrastructure exists for logos, many colors in public components are hardcoded, and new fields (background color, text color, footer control) are needed.

## Scope

Branding is configured **per Company**. Only public-facing booking pages are affected (BookingPage, ConfirmationPage, CancelPage, ReschedulePage). The admin UI keeps its fixed styling.

## Data Model Changes

### Canonical Default Colors

To resolve the mismatch between Prisma defaults and frontend fallbacks, these are the canonical defaults used everywhere (Prisma, BrandedLayout, admin UI "Reset to Default"):

| Property | Default Value | Used for |
|----------|---------------|----------|
| Primary | `#0B8ECA` | Buttons, links, active elements |
| Accent | `#14B8A6` | Secondary actions, gradients |
| Background | `#F8FAFC` | Page background |
| Text | `#1E293B` | Primary text |

The Prisma migration must update the existing `primaryColor` default from `#2563EB` to `#0B8ECA` and `accentColor` default from `#7C3AED` to `#14B8A6`.

### New fields on `BrandingConfig` (Prisma)

| Field | Type | Default | Purpose |
|-------|------|---------|---------|
| `backgroundColor` | `String?` | `"#F8FAFC"` | Page background color |
| `textColor` | `String?` | `"#1E293B"` | Primary text color |
| `showPoweredBy` | `Boolean` | `true` | Show "Powered by Calendfree" footer |
| `footerText` | `String?` | `null` | Custom footer text (replaces "Powered by" when set) |

Existing fields remain: `logoUrl`, `primaryColor` (default updated to `#0B8ECA`), `accentColor` (default updated to `#14B8A6`), `fontFamily` (default `Inter`).

### Shared Schema Extension (`shared/src/schemas/organization.ts`)

Add to `BrandingConfigSchema`:
- `backgroundColor`: hex color regex, optional
- `textColor`: hex color regex, optional
- `showPoweredBy`: boolean, optional
- `footerText`: string max 200 chars, nullable, optional

## Logo Upload

### Backend Infrastructure

- Install `@fastify/multipart` and `@fastify/static` via `npm install`
- Register `@fastify/multipart` in `app.ts` with 2MB file size limit
- Register `@fastify/static` to serve `backend/public/uploads/` at `/uploads/`

### Endpoints

**`POST /api/admin/companies/:id/branding/logo`**
- Auth: COMPANY_ADMIN or ORG_ADMIN (must verify company belongs to user's organization)
- Accepts multipart file upload
- Validates file type by checking magic bytes (use `file-type` package), not just Content-Type header
- Allowed types: PNG, JPEG, GIF, WebP (no SVG — XSS risk)
- Max file size: 2MB
- Saves to `backend/public/uploads/logos/<companyId>-<timestamp>.<ext>`
- Deletes previous logo file if exists
- Updates `BrandingConfig.logoUrl` with the relative path
- Returns updated branding config

**`DELETE /api/admin/companies/:id/branding/logo`**
- Auth: COMPANY_ADMIN or ORG_ADMIN (must verify company belongs to user's organization)
- Removes file from disk
- Sets `BrandingConfig.logoUrl` to null

### File Storage

- Directory: `backend/public/uploads/logos/`
- Created on first upload via `fs.mkdir` with `recursive: true`
- Files named `<companyId>-<timestamp>.<ext>` to avoid collisions
- On company deletion: orphaned files are acceptable for now (BrandingConfig cascades in DB)

## Admin UI: Company Branding Page

### Route

`/admin/companies/:companyId/branding` — new page `CompanyBrandingPage.tsx`

### Entry Point

Link "Branding bearbeiten" on `CompanyDetailPage` navigates to the branding page.

### Layout

- **Left side (~60%):** Form with branding controls
- **Right side (~40%):** Live preview panel (mini booking page mockup)

### Form Sections

1. **Logo**
   - Drag-and-drop area with file input fallback
   - Current logo preview (if set)
   - Remove button to delete logo
   - Upload via `FormData` to `POST /api/admin/companies/:id/branding/logo`

2. **Colors** (4 color pickers)
   - Primary color — buttons, links, active elements
   - Accent color — secondary actions, gradients
   - Background color — page background
   - Text color — main body text
   - Each has a "Reset to Default" button showing the default value

3. **Footer**
   - Toggle: "Show Powered by Calendfree" (on by default)
   - Textarea: Custom footer text (only editable when "Powered by" is off)
   - API precedence: `showPoweredBy === true` always wins over `footerText`

### Save Behavior

- Save button calls `PUT /api/admin/companies/:id/branding` with JSON fields
- Logo upload is a separate call (only triggered when a new file is selected)
- Preview updates immediately as the user changes values (local state)

### API Functions (`frontend/src/api/admin.ts`)

- `updateCompanyBranding(companyId, data)` — PUT JSON
- `uploadCompanyLogo(companyId, file)` — POST FormData (raw `fetch`, not `apiRequest`, to avoid Content-Type: application/json)
- `deleteCompanyLogo(companyId)` — DELETE

## Frontend Types

### Updated `BrandingConfig` interface (`frontend/src/api/branding.ts`)

```typescript
export interface BrandingConfig {
  primaryColor: string;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  logoUrl: string | null;
  fontFamily: string;
  showPoweredBy: boolean;
  footerText: string | null;
}
```

## CSS Theming Strategy

### CSS Custom Properties

`BrandedLayout` sets these variables on `document.documentElement`:

| Variable | Source | Default |
|----------|--------|---------|
| `--color-primary` | `primaryColor` | `#0B8ECA` |
| `--color-accent` | `accentColor` | `#14B8A6` |
| `--color-bg` | `backgroundColor` | `#F8FAFC` |
| `--color-text` | `textColor` | `#1E293B` |

### BrandedLayout Changes

- Replace hardcoded gradient background with dynamic `style={{ backgroundColor: 'var(--color-bg)' }}`
- Apply `color: var(--color-text)` to the layout wrapper
- Footer logic (precedence):
  1. `showPoweredBy === true` → "Company — Powered by Calendfree" (always wins)
  2. `showPoweredBy === false` && `footerText` is non-empty → show custom footer text
  3. `showPoweredBy === false` && no `footerText` → no footer

### Components to Convert (hardcoded → CSS variables)

Only public-facing components. Replace `bg-[#0B8ECA]` → `bg-[var(--color-primary)]`, etc.

| Component | File | Changes |
|-----------|------|---------|
| SlotPicker | `frontend/src/components/calendar/SlotPicker.tsx` | Primary color on selected dates, active slots, hover states |
| BookingForm | `frontend/src/components/forms/BookingForm.tsx` | Summary box, focus rings, submit button gradient |
| BookingPage | `frontend/src/pages/booking/BookingPage.tsx` | "Change slot" link color; add `getCompanyBranding()` call in `loadData()`, pass result to `BrandedLayout` |
| ConfirmationPage | `frontend/src/pages/booking/ConfirmationPage.tsx` | Links, buttons; pass branding via router state |
| CancelPage | `frontend/src/pages/manage/CancelPage.tsx` | Primary-colored elements; fetch branding via new token endpoint |
| ReschedulePage | `frontend/src/pages/manage/ReschedulePage.tsx` | Primary-colored elements; fetch branding via new token endpoint |

### Tailwind v4 Compatibility

Tailwind v4 supports `bg-[var(--color-primary)]` and opacity modifiers like `bg-[var(--color-primary)]/10` with hex values. As a safety net, add a `hexToRgb()` utility and set `--color-primary-rgb` etc. alongside the hex values so `rgba(var(--color-primary-rgb), 0.1)` works as a fallback.

## Branding on Cancel/Reschedule Pages

These pages only have a booking token, no company slug. A new endpoint is needed:

**`GET /api/booking/:bookingToken`**
- Public (no auth — token is the secret)
- Returns: booking details (time, event type, assigned user) + company branding config
- Used by CancelPage and ReschedulePage to display branding and booking info

## Updated Public Info Response

**`GET /api/booking/:companySlug/info`** response shape:

```json
{
  "name": "Company Name",
  "slug": "company-slug",
  "branding": {
    "primaryColor": "#0B8ECA",
    "accentColor": "#14B8A6",
    "backgroundColor": "#F8FAFC",
    "textColor": "#1E293B",
    "logoUrl": "/uploads/logos/abc-123.png",
    "fontFamily": "Inter",
    "showPoweredBy": true,
    "footerText": null
  }
}
```

## Authorization

All branding admin endpoints (PUT branding, POST logo, DELETE logo) must verify that the target company belongs to the authenticated user's organization via `organizationId` check. Follow the same pattern used in the existing GET company detail endpoint.

## Implementation Order

1. **Prisma schema + migration** — add new fields, update default colors, migrate, generate
2. **Shared schemas** — extend BrandingConfigSchema
3. **Backend: static serving + upload** — `npm install @fastify/multipart @fastify/static file-type`, register plugins in app.ts, add logo upload/delete endpoints with org authorization
4. **Backend: branding in responses** — update `/booking/:companySlug/info` to include new fields; add `GET /api/booking/:bookingToken` endpoint
5. **Frontend types** — update BrandingConfig interface, add admin API functions
6. **BrandedLayout + CSS variables** — set all variables (hex + rgb), handle footer logic, dynamic background
7. **Convert public components** — replace hardcoded colors with CSS variable references
8. **Admin branding page** — create CompanyBrandingPage with form + live preview, add route + navigation
9. **BookingPage branding fetch** — add `getCompanyBranding()` call in BookingPage `loadData()`, pass to BrandedLayout

## Verification

- Upload a logo via the branding page → appears on public booking page
- Change primary color → buttons/links on booking page reflect the change
- Change background color → booking page background changes
- Disable "Powered by" → footer disappears
- Set custom footer text (with "Powered by" off) → appears on booking page
- Open cancel/reschedule page → shows company branding
- Delete logo → booking page falls back to Calendfree logo
- No branding set → all defaults apply, pages look unchanged
- Try uploading a non-image file → rejected with error
- Try uploading a file > 2MB → rejected with error
- Verify org isolation: admin from org A cannot update branding for company in org B

## Key Files

- `backend/prisma/schema.prisma` — BrandingConfig model
- `shared/src/schemas/organization.ts` — BrandingConfigSchema
- `backend/src/routes/admin/company.ts` — branding + upload endpoints
- `backend/src/routes/booking.ts` — public branding response + booking token endpoint
- `backend/src/app.ts` — plugin registration
- `frontend/src/api/branding.ts` — BrandingConfig interface
- `frontend/src/api/admin.ts` — admin API functions
- `frontend/src/components/layout/BrandedLayout.tsx` — central branding component
- `frontend/src/pages/admin/CompanyBrandingPage.tsx` — NEW: branding editor
- `frontend/src/App.tsx` — routing
- `frontend/src/pages/admin/CompanyDetailPage.tsx` — link to branding page
- `frontend/src/components/calendar/SlotPicker.tsx` — color conversion
- `frontend/src/components/forms/BookingForm.tsx` — color conversion
- `frontend/src/pages/booking/BookingPage.tsx` — fetch + pass branding
- `frontend/src/pages/booking/ConfirmationPage.tsx` — pass branding via state
- `frontend/src/pages/manage/CancelPage.tsx` — fetch branding via token endpoint
- `frontend/src/pages/manage/ReschedulePage.tsx` — fetch branding via token endpoint
