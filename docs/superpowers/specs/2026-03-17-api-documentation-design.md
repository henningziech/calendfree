# Design: API Documentation & Feature Documentation Website

## Overview

Calendfree needs comprehensive documentation for end-users and developers:
1. **API Reference** — Interactive, auto-generated from OpenAPI spec with full descriptions, examples, and response schemas
2. **Feature Documentation** — Handwritten Markdown pages explaining the product, features, and guides

Both live in a single Docusaurus 3 site within the monorepo as `docs/`.

## Architecture

### Two Parts, One Source

```
Backend Fastify Routes (with OpenAPI schemas)
       │
       ▼
  OpenAPI JSON spec ──► docs/openapi/calendfree.json
       │
       ▼
  Docusaurus Site
  ├── Feature Docs (handwritten Markdown)
  └── API Reference (auto-generated from spec)
```

### Build Flow

1. Export script uses `app.ready()` (without `app.listen()`) with `NODE_ENV=docgen` to build the Fastify app, extract the OpenAPI spec, and write it to `docs/openapi/calendfree.json` — no running database or Redis required
2. Docusaurus builds feature docs + API reference from the spec
3. Output: Static website, deployable anywhere

## Part 1: OpenAPI Spec Enhancement

### Current State

Fastify routes have `@fastify/swagger` registered but:
- Routes use manual `Schema.parse(request.body)` inside handlers — no declarative `schema:` property
- No Zod type provider is installed (`fastify-type-provider-zod`)
- No `transform` or `validatorCompiler` configured for swagger
- Missing summaries, descriptions, tags, response schemas

### Infrastructure Required

Before adding schemas to routes, the following must be set up:

1. **Install `fastify-type-provider-zod`** — bridges Zod schemas to Fastify's schema system
2. **Configure `validatorCompiler` and `serializerCompiler`** in `app.ts` using the Zod type provider
3. **Add `jsonSchemaTransform`** to the `@fastify/swagger` config so Zod schemas are converted to OpenAPI-compatible JSON Schema
4. **Keep existing manual `.parse()` calls** — adding declarative `schema:` does not require removing them; both can coexist. The declarative schemas serve documentation, the manual parse calls serve runtime validation.

Changes to `app.ts`:
```typescript
import { serializerCompiler, validatorCompiler, jsonSchemaTransform } from 'fastify-type-provider-zod';

// After app creation:
app.setValidatorCompiler(validatorCompiler);
app.setSerializerCompiler(serializerCompiler);

// Update swagger registration:
await app.register(swagger, {
  openapi: { /* existing config */ },
  transform: jsonSchemaTransform,  // NEW: converts Zod → JSON Schema
});
```

### Target State

Every route gets a complete Fastify schema alongside its existing handler logic:

```typescript
app.get('/api/booking/:companySlug/:eventTypeSlug/slots', {
  schema: {
    summary: 'Get available time slots',
    description: 'Returns available booking slots for a given event type. Slots respect the assigned user\'s availability, Google Calendar busy times, buffer settings, and booking limits.',
    tags: ['Bookings'],
    params: z.object({
      companySlug: z.string().describe('Company URL slug'),
      eventTypeSlug: z.string().describe('Event type URL slug'),
    }),
    querystring: z.object({
      date: z.string().describe('Date to fetch slots for (ISO 8601, e.g. 2026-03-17)'),
      timezone: z.string().optional().describe('IANA timezone (default: Europe/Berlin)'),
    }),
    response: {
      200: z.object({
        slots: z.array(z.object({
          start: z.string(),
          end: z.string(),
        })),
      }).describe('Available time slots'),
      404: z.object({ error: z.string() }).describe('Company or event type not found'),
    },
    // Security: public endpoint
    security: [],
  },
}, handler);
```

### Security Scheme Syntax

Each route must declare its security requirements in the schema:

```typescript
// Public endpoint (no auth required):
security: []

// Session-authenticated endpoint:
security: [{ session: [] }]

// API Key endpoint:
security: [{ apiKey: [] }]

// Either session or API key:
security: [{ session: [] }, { apiKey: [] }]
```

### API Tags (Grouping)

| Tag | Endpoints |
|-----|-----------|
| **Auth** | Google OAuth, session, profile |
| **Bookings** | Public booking creation, slots, cancel/reschedule |
| **Companies** | Company CRUD, branding, logo, domains |
| **Teams** | Team CRUD, members, round-robin config |
| **Event Types** | Event type CRUD, toggle, form fields |
| **Users** | User management, availability, vacations |
| **My Account** | Current user profile, bookings, comments |
| **API Keys** | Key generation and revocation |
| **Routing Forms** | Form CRUD and public resolution |
| **Analytics** | Booking statistics |
| **Integrations** | HubSpot status |
| **System** | Health check, holidays |

### Routes to Document

All 67+ endpoints across these files:

- `backend/src/routes/auth.ts` — 5 endpoints
- `backend/src/routes/booking.ts` — 6 endpoints
- `backend/src/routes/admin/organization.ts` — 2 endpoints
- `backend/src/routes/admin/company.ts` — 9 endpoints
- `backend/src/routes/admin/teams.ts` — 12 endpoints
- `backend/src/routes/admin/users.ts` — 20+ endpoints
- `backend/src/routes/admin/event-types.ts` — 6 endpoints
- `backend/src/routes/admin/api-keys.ts` — 3 endpoints
- `backend/src/routes/admin/routing-forms.ts` — 5 endpoints
- `backend/src/routes/admin/analytics.ts` — 1 endpoint
- `backend/src/routes/admin/hubspot.ts` — 1 endpoint
- `backend/src/routes/admin/domains.ts` — 2 endpoints
- `backend/src/routes/routing.ts` — 2 endpoints
- `backend/src/routes/embed.ts` — 1 endpoint
- `backend/src/routes/holidays.ts` — 1 endpoint

### Security Schemes

Already defined in `app.ts`:
- **Session** — Cookie-based (`sessionId`)
- **API Key** — Bearer token (`cf_live_*` prefix)

## Part 2: Docusaurus Site

### Package Setup

`docs/` is added to the monorepo but NOT as a npm workspace member (it has independent dependencies and build lifecycle, unlike `shared/` which is a build dependency).

```
docs/
├── docusaurus.config.ts       # Site config, plugins, theme
├── package.json               # Docusaurus dependencies
├── tsconfig.json
├── sidebars.ts                # Sidebar navigation structure
├── static/
│   └── img/
│       ├── logo.png           # Calendfree logo
│       └── favicon.ico
├── src/
│   └── css/
│       └── custom.css         # Calendfree brand colors
├── docs/
│   ├── intro.md
│   ├── getting-started/
│   │   ├── setup.md
│   │   └── first-booking.md
│   ├── features/
│   │   ├── event-types.md
│   │   ├── booking-flow.md
│   │   ├── teams-round-robin.md
│   │   ├── availability.md
│   │   ├── routing-forms.md
│   │   ├── branding.md
│   │   ├── embed-widget.md
│   │   ├── google-calendar.md
│   │   ├── analytics.md
│   │   └── api-keys.md
│   └── api/                   # Auto-generated by docusaurus-openapi-docs (gitignored)
├── openapi/
│   └── calendfree.json        # Exported OpenAPI spec (gitignored)
└── scripts/
    └── export-spec.ts         # Spec export script
```

### .gitignore Entries

The following generated files must be gitignored:

```
# docs/.gitignore
build/
node_modules/
.docusaurus/
openapi/calendfree.json
docs/api/
```

### Dependencies

```json
{
  "dependencies": {
    "@docusaurus/core": "^3.7",
    "@docusaurus/preset-classic": "^3.7",
    "docusaurus-plugin-openapi-docs": "^4.0",
    "docusaurus-theme-openapi-docs": "^4.0"
  }
}
```

### Configuration

```typescript
// docusaurus.config.ts
export default {
  title: 'Calendfree Documentation',
  tagline: 'Round-Robin Scheduling Platform',
  url: 'https://docs.calendfree.de',  // Production URL (placeholder, configurable)
  baseUrl: '/',
  themeConfig: {
    navbar: {
      title: 'Calendfree',
      logo: { alt: 'Calendfree', src: 'img/logo.png' },
      items: [
        { type: 'docSidebar', sidebarId: 'docs', label: 'Docs' },
        { to: '/api', label: 'API Reference' },
      ],
    },
    colorMode: {
      defaultMode: 'light',
    },
  },
  plugins: [
    ['docusaurus-plugin-openapi-docs', {
      id: 'api',
      docsPluginId: 'classic',
      config: {
        calendfree: {
          specPath: 'openapi/calendfree.json',
          outputDir: 'docs/api',
          sidebarOptions: { groupPathsBy: 'tag' },
        },
      },
    }],
  ],
  themes: ['docusaurus-theme-openapi-docs'],
};
```

### Branding

Custom CSS matching Calendfree's design system:
- Primary: `#0B8ECA`
- Accent: `#14B8A6`
- Background: `#F8FAFC`
- Text: `#1E293B`

### Feature Documentation Content

| Page | Content Summary |
|------|----------------|
| **intro.md** | What is Calendfree, key features overview, architecture diagram |
| **setup.md** | Prerequisites (Node 22+, Docker), environment setup, Google OAuth config, first run |
| **first-booking.md** | Step-by-step: create company → create event type → open booking page → book a slot |
| **event-types.md** | Personal vs Team vs Group events, duration/buffer/notice settings, bookable hours, form fields, activation |
| **booking-flow.md** | Public booking page, slot selection, form submission, confirmation, cancel/reschedule via token links |
| **teams-round-robin.md** | Creating teams, adding members, Sequential/Least Busy/Weighted modes, weights config |
| **availability.md** | Weekly schedule, date-specific overrides, vacation periods, public holidays, max bookings per day/week |
| **routing-forms.md** | Creating forms, options with targets (event type or URL), fallback config, public URL |
| **branding.md** | Logo upload, color customization (primary, accent, background, text), footer settings, live preview |
| **embed-widget.md** | Script tag usage, configuration options, styling |
| **google-calendar.md** | OAuth connection, calendar sync, busy-time detection, Google Meet link generation |
| **analytics.md** | Dashboard overview, metrics (30d/7d stats, by status, by user, daily breakdown) |
| **api-keys.md** | Creating keys, using Bearer auth, key prefix format, revocation |

### OpenAPI Spec Export

Script `docs/scripts/export-spec.ts`:

```typescript
// Uses Fastify app.ready() WITHOUT app.listen() to build route tree and extract OpenAPI spec.
// Sets NODE_ENV=docgen to skip pg-boss, Redis, and database connections.
// Backend app.ts must guard infrastructure plugins behind NODE_ENV !== 'docgen'.
//
// Usage: npx tsx docs/scripts/export-spec.ts
//
// Flow:
// 1. Set process.env.NODE_ENV = 'docgen'
// 2. Import and build Fastify app (routes register, swagger registers)
// 3. Call app.ready() (no listen)
// 4. Call app.swagger() to get the OpenAPI spec object
// 5. Write JSON to docs/openapi/calendfree.json
// 6. Call app.close()
```

Backend `app.ts` changes needed:
```typescript
const isDocgen = process.env.NODE_ENV === 'docgen';

// Skip infrastructure that requires live connections:
if (!isDocgen) {
  // Register session, Redis, pg-boss, notification handlers, etc.
}
// Always register: swagger, routes, cors, helmet
```

### npm Scripts (root package.json)

```json
{
  "scripts": {
    "docs:dev": "cd docs && npm start",
    "docs:build": "npm run docs:export-spec && cd docs && npm run build",
    "docs:export-spec": "npx tsx docs/scripts/export-spec.ts"
  }
}
```

## Implementation Order

### Step 1: Backend Infrastructure — Zod Type Provider
- Install `fastify-type-provider-zod`
- Configure `validatorCompiler`, `serializerCompiler`, `jsonSchemaTransform` in `app.ts`
- Add `NODE_ENV=docgen` guards for infrastructure plugins (session, Redis, pg-boss)
- Verify existing routes still work (no regressions)

### Step 2: Docusaurus Setup
- Initialize `docs/` package with Docusaurus 3
- Install `docusaurus-plugin-openapi-docs` and `docusaurus-theme-openapi-docs`
- Configure `docusaurus.config.ts` with branding and OpenAPI plugin
- Add `.gitignore` for generated files
- Add npm scripts to root `package.json`

### Step 3: OpenAPI Spec Export Script
- Create `docs/scripts/export-spec.ts`
- Uses Fastify `app.ready()` with `NODE_ENV=docgen` to generate spec without DB/Redis
- Writes to `docs/openapi/calendfree.json`
- Verify spec exports correctly and Docusaurus renders it

### Step 4: Enrich Backend Route Schemas
- Add `schema` with summary, description, tags, params, response schemas to all 67+ endpoints
- Keep existing manual `.parse()` calls alongside declarative schemas
- Group by tags (Auth, Bookings, Companies, Teams, etc.)
- Add request/response examples for key endpoints
- Mark security requirements per route (`security: []` for public, `security: [{ session: [] }]` for authenticated)

### Step 5: Write Feature Documentation
- Start with essential pages: intro, setup, first-booking, api-keys
- Then remaining 9 feature pages
- Configure sidebar navigation in `sidebars.ts`

### Step 6: Integration & Polish
- Verify API reference renders correctly from spec
- Test sidebar navigation and search
- Final build test (`npm run docs:build`)

## Verification

- `npm run docs:export-spec` succeeds without requiring PostgreSQL or Redis
- `npm run docs:build` succeeds without errors
- API reference shows all 67+ endpoints grouped by tag
- Each endpoint has summary, description, params, responses
- Security schemes are correctly indicated per endpoint
- Feature docs cover all 13 topics with working sidebar navigation
- Search finds content across both feature docs and API reference
- Branding matches Calendfree design (colors, logo)
- Existing backend tests still pass after Zod type provider integration
