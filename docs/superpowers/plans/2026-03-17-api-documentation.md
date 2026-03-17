# API Documentation & Feature Docs Website — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Docusaurus 3 documentation website with auto-generated API reference from OpenAPI spec and handwritten feature documentation.

**Architecture:** Backend routes get enriched with Fastify `schema` objects (using `fastify-type-provider-zod` for Zod→JSON Schema conversion). A spec export script generates `docs/openapi/calendfree.json` without requiring a running database. Docusaurus renders both the API reference and feature docs.

**Tech Stack:** Docusaurus 3, docusaurus-openapi-docs, fastify-type-provider-zod, Zod

**Spec:** `docs/superpowers/specs/2026-03-17-api-documentation-design.md`

---

## Task 1: Install Zod Type Provider for Fastify

**Files:**
- Modify: `backend/package.json`
- Modify: `backend/src/app.ts`

- [ ] **Step 1: Install fastify-type-provider-zod**

```bash
cd backend && npm install fastify-type-provider-zod
```

- [ ] **Step 2: Configure the Zod type provider in app.ts**

In `backend/src/app.ts`, add import at the top (after existing imports):

```typescript
import {
  serializerCompiler,
  validatorCompiler,
  jsonSchemaTransform,
} from 'fastify-type-provider-zod';
```

After `const app = Fastify({...});` (after line 45), add:

```typescript
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
```

Update the swagger registration (lines 81-95) to add `transform`:

```typescript
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'Calendfree API',
        description: 'Round-Robin Scheduling Platform API',
        version: '0.1.0',
      },
      components: {
        securitySchemes: {
          session: { type: 'apiKey', in: 'cookie', name: 'sessionId' },
          apiKey: { type: 'http', scheme: 'bearer', bearerFormat: 'API Key' },
        },
      },
    },
    transform: jsonSchemaTransform,
  });
```

- [ ] **Step 3: Add NODE_ENV=docgen guard for infrastructure plugins**

In `backend/src/app.ts`, wrap infrastructure that requires live connections. Replace the session, apiKeyAuth, and tenant registration (lines 78, 99, 102) with:

```typescript
  const isDocgen = config.NODE_ENV === 'docgen';

  if (!isDocgen) {
    // Session management (Redis-backed)
    await app.register(sessionPlugin);

    // API key authentication (before session check, populates session.user if valid key)
    app.addHook('preHandler', apiKeyAuth);

    // Tenant context (decorates request with organizationId/companyId)
    await app.register(tenantPlugin);
  }
```

Also update the job queue guard (line 143) to include docgen:

```typescript
  if (config.NODE_ENV !== 'test' && !isDocgen) {
```

Do NOT wrap the health check route behind `isDocgen` — it should be registered always so it appears in the OpenAPI spec. The handler's `prisma`/`redis` calls only execute when a request is made, which never happens during docgen (only `app.ready()` is called, not `app.listen()`).

**Note on static imports:** `redis.ts` uses `lazyConnect: true` and `PrismaClient` lazy-connects on first query, so the top-level imports of `redis` and `prisma` in `app.ts` are safe in docgen mode — no actual connections are established.

- [ ] **Step 4: Update config.ts to allow 'docgen' as NODE_ENV**

In `backend/src/config.ts` line 15, change:

```typescript
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
```

to:

```typescript
  NODE_ENV: z.enum(['development', 'production', 'test', 'docgen']).default('development'),
```

- [ ] **Step 5: Run backend tests to verify no regressions**

```bash
npm run test -w backend
```

Expected: All existing tests pass. The Zod type provider and docgen guards must not break existing behavior.

- [ ] **Step 6: Verify backend still starts normally**

```bash
cd backend && npm run dev
```

Expected: Server starts without errors on port 3001. Ctrl+C to stop.

- [ ] **Step 7: Commit**

```bash
git add backend/package.json backend/package-lock.json backend/src/app.ts backend/src/config.ts
git commit -m "feat: add fastify-type-provider-zod and docgen mode for OpenAPI export"
```

---

## Task 2: Initialize Docusaurus Site

**Files:**
- Create: `docs/` directory with Docusaurus scaffold
- Modify: `package.json` (root — add docs scripts)
- Modify: `.gitignore`

- [ ] **Step 1: Create the Docusaurus project**

```bash
cd /Users/hziech/calendfree
npx create-docusaurus@latest docs classic --typescript
```

When prompted, accept defaults.

- [ ] **Step 2: Install OpenAPI docs plugin**

```bash
cd docs && npm install docusaurus-plugin-openapi-docs docusaurus-theme-openapi-docs
```

- [ ] **Step 3: Configure docusaurus.config.ts**

Replace `docs/docusaurus.config.ts` with:

```typescript
import { themes as prismThemes } from 'prism-react-renderer';
import type { Config } from '@docusaurus/types';
import type * as OpenApiPlugin from 'docusaurus-plugin-openapi-docs';

const config: Config = {
  title: 'Calendfree',
  tagline: 'Round-Robin Scheduling Platform',
  favicon: 'img/favicon.ico',
  url: 'https://docs.calendfree.de',
  baseUrl: '/',
  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',

  i18n: { defaultLocale: 'en', locales: ['en'] },

  presets: [
    ['classic', {
      docs: {
        sidebarPath: './sidebars.ts',
        docItemComponent: '@theme/ApiItem',
      },
      theme: { customCss: './src/css/custom.css' },
    }],
  ],

  plugins: [
    ['docusaurus-plugin-openapi-docs', {
      id: 'api',
      docsPluginId: 'classic',
      config: {
        calendfree: {
          specPath: 'openapi/calendfree.json',
          outputDir: 'docs/api',
          sidebarOptions: { groupPathsBy: 'tag' },
        } satisfies OpenApiPlugin.Options,
      },
    }],
  ],

  themes: ['docusaurus-theme-openapi-docs'],

  themeConfig: {
    navbar: {
      title: 'Calendfree',
      logo: { alt: 'Calendfree', src: 'img/logo-mini.png' },
      items: [
        { type: 'docSidebar', sidebarId: 'docs', label: 'Docs', position: 'left' },
        // TODO: Uncomment after Task 10 (gen-api-docs creates the sidebar)
        // { type: 'docSidebar', sidebarId: 'api', label: 'API Reference', position: 'left' },
      ],
    },
    footer: {
      style: 'dark',
      links: [],
      copyright: `Copyright © ${new Date().getFullYear()} Calendfree`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
    colorMode: {
      defaultMode: 'light',
    },
  },
};

export default config;
```

- [ ] **Step 4: Configure sidebars.ts**

Replace `docs/sidebars.ts` with:

```typescript
import type { SidebarsConfig } from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  docs: [
    'intro',
    {
      type: 'category',
      label: 'Getting Started',
      items: [
        'getting-started/setup',
        'getting-started/first-booking',
      ],
    },
    {
      type: 'category',
      label: 'Features',
      items: [
        'features/event-types',
        'features/booking-flow',
        'features/teams-round-robin',
        'features/availability',
        'features/routing-forms',
        'features/branding',
        'features/embed-widget',
        'features/google-calendar',
        'features/analytics',
        'features/api-keys',
      ],
    },
  ],
  // TODO: Uncomment after Task 10 (gen-api-docs creates the sidebar file)
  // api: [
  //   {
  //     type: 'category',
  //     label: 'API Reference',
  //     link: { type: 'generated-index', title: 'Calendfree API', description: 'Complete API reference for Calendfree.' },
  //     items: require('./docs/api/sidebar.js'),
  //   },
  // ],
};

export default sidebars;
```

- [ ] **Step 5: Apply Calendfree branding CSS**

Replace `docs/src/css/custom.css` with:

```css
:root {
  --ifm-color-primary: #0B8ECA;
  --ifm-color-primary-dark: #0a7fb5;
  --ifm-color-primary-darker: #0978ab;
  --ifm-color-primary-darkest: #08638d;
  --ifm-color-primary-light: #0c9ddf;
  --ifm-color-primary-lighter: #0da4e9;
  --ifm-color-primary-lightest: #1fb8fc;
  --ifm-code-font-size: 95%;
  --docusaurus-highlighted-code-line-bg: rgba(0, 0, 0, 0.1);
}

[data-theme='dark'] {
  --ifm-color-primary: #14B8A6;
  --ifm-color-primary-dark: #12a595;
  --ifm-color-primary-darker: #119c8d;
  --ifm-color-primary-darkest: #0e8074;
  --ifm-color-primary-light: #16cbb7;
  --ifm-color-primary-lighter: #17d4bf;
  --ifm-color-primary-lightest: #2ae0cd;
  --docusaurus-highlighted-code-line-bg: rgba(0, 0, 0, 0.3);
}
```

- [ ] **Step 6: Copy logo to docs static**

```bash
cp frontend/public/logo-mini.png docs/static/img/logo-mini.png
```

- [ ] **Step 7: Clean up default Docusaurus pages**

Remove the default blog and tutorial docs that come with the scaffold:

```bash
rm -rf docs/blog docs/docs/tutorial-basics docs/docs/tutorial-extras docs/docs/intro.md
```

- [ ] **Step 8: Create placeholder intro.md**

Create `docs/docs/intro.md`:

```markdown
---
sidebar_position: 1
slug: /
---

# Welcome to Calendfree

Calendfree is a round-robin scheduling platform that integrates with Google Workspace. It enables teams to share booking pages, distribute appointments automatically, and manage availability — all with your existing Google Calendar.

## Key Features

- **Event Types** — Personal, team (round-robin), and group events
- **Smart Scheduling** — Automatic slot detection based on Google Calendar availability
- **Round-Robin** — Sequential, least-busy, or weighted distribution across team members
- **Availability Management** — Weekly schedules, date overrides, vacations, and holidays
- **Routing Forms** — Pre-qualify visitors and route them to the right event type
- **Branding** — Custom colors, logo, and footer for your booking pages
- **Embed Widget** — Add booking to any website with a script tag
- **API Keys** — Programmatic access for integrations
- **Analytics** — Booking statistics and team performance

## Quick Links

- [Setup Guide](/docs/getting-started/setup) — Get Calendfree running locally
- [First Booking](/docs/getting-started/first-booking) — Create your first event type and book a slot
- [API Reference](/docs/api) — Complete REST API documentation
```

- [ ] **Step 9: Create directory structure for feature docs**

```bash
mkdir -p docs/docs/getting-started docs/docs/features
```

Create placeholder files so Docusaurus doesn't break:

```bash
for f in getting-started/setup getting-started/first-booking features/event-types features/booking-flow features/teams-round-robin features/availability features/routing-forms features/branding features/embed-widget features/google-calendar features/analytics features/api-keys; do
  echo -e "---\nsidebar_position: 1\n---\n\n# $(basename $f | sed 's/-/ /g' | sed 's/\b\(.\)/\u\1/g')\n\nComing soon." > "docs/docs/$f.md"
done
```

- [ ] **Step 10: Add docs .gitignore**

Create `docs/.gitignore`:

```
build/
node_modules/
.docusaurus/
openapi/calendfree.json
docs/api/
```

- [ ] **Step 11: Update root .gitignore**

The root `.gitignore` has `docs/` which would ignore the entire docs directory. Change it to only ignore generated docs output:

In `/.gitignore`, replace `docs/` with:

```
docs/build/
docs/node_modules/
docs/.docusaurus/
docs/openapi/calendfree.json
docs/docs/api/
```

- [ ] **Step 12: Add npm scripts to root package.json**

Add these scripts to the root `package.json` `scripts` section:

```json
"docs:dev": "cd docs && npm start",
"docs:build": "npm run docs:export-spec && cd docs && npx docusaurus gen-api-docs calendfree && npm run build",
"docs:export-spec": "npx tsx docs/scripts/export-spec.ts"
```

- [ ] **Step 13: Verify Docusaurus starts**

```bash
cd docs && npm start
```

Expected: Docusaurus dev server starts, shows the intro page. The API reference sidebar won't work yet (no spec generated). Ctrl+C to stop.

- [ ] **Step 14: Commit**

```bash
git add docs/docusaurus.config.ts docs/sidebars.ts docs/package.json docs/tsconfig.json docs/src/ docs/docs/ docs/static/ docs/.gitignore docs/scripts/ .gitignore package.json
git commit -m "feat: initialize Docusaurus 3 docs site with Calendfree branding"
```

---

## Task 3: OpenAPI Spec Export Script

**Files:**
- Create: `docs/scripts/export-spec.ts`
- Create: `docs/openapi/` directory

- [ ] **Step 1: Create the export script**

Create `docs/scripts/export-spec.ts`:

```typescript
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Set environment before any backend imports — dummy values are fine since
// docgen mode skips all infrastructure that needs live connections.
process.env.NODE_ENV = 'docgen';
process.env.DATABASE_URL = 'postgresql://dummy:dummy@localhost:5432/dummy';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.GOOGLE_CLIENT_ID = 'dummy';
process.env.GOOGLE_CLIENT_SECRET = 'dummy';
process.env.GOOGLE_REDIRECT_URI = 'http://localhost:3001/api/auth/google/callback';
process.env.SESSION_SECRET = 'dummy-session-secret-at-least-32-chars!!';
process.env.ENCRYPTION_KEY = '0'.repeat(64);

const { buildApp } = await import('../../backend/src/app.js');

const app = await buildApp();
await app.ready();

const spec = app.swagger();

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(__dirname, '..', 'openapi');
mkdirSync(outDir, { recursive: true });

const outPath = resolve(outDir, 'calendfree.json');
writeFileSync(outPath, JSON.stringify(spec, null, 2));

console.log(`OpenAPI spec written to ${outPath}`);
console.log(`  Paths: ${Object.keys(spec.paths || {}).length}`);

await app.close();
process.exit(0);
```

- [ ] **Step 2: Create the openapi directory**

```bash
mkdir -p docs/openapi
```

- [ ] **Step 3: Test the export script**

```bash
npx tsx docs/scripts/export-spec.ts
```

Expected: Outputs "OpenAPI spec written to .../openapi/calendfree.json" with a path count. If it fails due to missing env vars or imports, debug the specific error — the `NODE_ENV=docgen` guards in app.ts must skip all infrastructure that needs live connections.

- [ ] **Step 4: Verify the exported spec**

```bash
cat docs/openapi/calendfree.json | python3 -m json.tool | head -30
```

Expected: Valid JSON with `openapi`, `info`, and `paths` keys.

- [ ] **Step 5: Commit**

```bash
git add -f docs/scripts/export-spec.ts
git commit -m "feat: add OpenAPI spec export script for docs generation"
```

---

## Task 4: Add OpenAPI Schemas to Booking Routes (Public)

**Files:**
- Modify: `backend/src/routes/booking.ts`

This is the most important route file — public-facing endpoints that external integrators use. Each route gets a `schema` object added to the route options (first argument after the path). The existing handler code stays unchanged.

- [ ] **Step 1: Add schemas to all booking routes**

For each route in `backend/src/routes/booking.ts`, add a `schema` property to the route options object. The pattern is:

```typescript
// BEFORE:
app.get('/api/booking/:companySlug/:eventTypeSlug/slots', async (request, reply) => {

// AFTER:
app.get('/api/booking/:companySlug/:eventTypeSlug/slots', {
  schema: {
    summary: 'Get available time slots',
    description: 'Returns available booking slots for an event type on a given date. Respects assigned users\' availability, Google Calendar busy times, buffer settings, and booking limits.',
    tags: ['Bookings'],
    security: [],
    querystring: z.object({
      date: z.string().describe('Date to fetch slots for (YYYY-MM-DD)'),
      timezone: z.string().optional().describe('IANA timezone, e.g. Europe/Berlin'),
    }),
    response: {
      200: z.object({
        slots: z.array(z.object({
          start: z.string().describe('Slot start time (ISO 8601)'),
          end: z.string().describe('Slot end time (ISO 8601)'),
        })),
      }),
    },
  },
}, async (request, reply) => {
```

Add `import { z } from 'zod';` at the top of the file if not already imported.

Apply this pattern to all 6 booking routes:

1. `GET /api/booking/:companySlug/:eventTypeSlug/slots` — tags: ['Bookings'], security: []
2. `POST /api/booking/:companySlug/:eventTypeSlug` — tags: ['Bookings'], security: []
3. `GET /api/booking/:bookingToken` — tags: ['Bookings'], security: []
4. `POST /api/booking/:bookingToken/cancel` — tags: ['Bookings'], security: []
5. `GET /api/booking/:companySlug/info` — tags: ['Bookings'], security: []
6. `GET /api/booking/:companySlug/:eventTypeSlug/info` — tags: ['Bookings'], security: []

For each route, write a `summary` (short title), `description` (1-2 sentences), `params` (for path parameters like `:companySlug`, `:bookingToken`), and `response` schemas matching what the route actually returns. Check the handler's `return` or `reply.send()` to determine the response shape.

- [ ] **Step 2: Verify the backend still compiles and tests pass**

```bash
cd backend && npx tsc --noEmit
npm run test -w backend
```

Expected: No new errors introduced. All tests pass. Adding declarative `schema` objects alongside existing manual `.parse()` calls should not cause conflicts — Fastify validates via schema first, then the handler's `.parse()` runs as before.

- [ ] **Step 3: Re-export the OpenAPI spec and verify booking routes appear**

```bash
npx tsx docs/scripts/export-spec.ts
cat docs/openapi/calendfree.json | python3 -c "import json,sys; d=json.load(sys.stdin); [print(f'  {m.upper()} {p}') for p in sorted(d.get('paths',{})) for m in d['paths'][p] if '/booking' in p]"
```

Expected: All 6 booking endpoints listed with their HTTP methods.

- [ ] **Step 4: Commit**

```bash
git add backend/src/routes/booking.ts
git commit -m "docs: add OpenAPI schemas to public booking routes"
```

---

## Task 5: Add OpenAPI Schemas to Auth Routes

**Files:**
- Modify: `backend/src/routes/auth.ts`

- [ ] **Step 1: Add schemas to all auth routes**

Apply the same pattern as Task 4 to all 5 routes in `auth.ts`:

1. `GET /api/auth/google` — summary: "Start Google OAuth flow", tags: ['Auth'], security: []
2. `GET /api/auth/google/callback` — summary: "Google OAuth callback", tags: ['Auth'], security: []
3. `GET /api/auth/me` — summary: "Get current user", tags: ['Auth'], security: [{ session: [] }, { apiKey: [] }]
4. `PATCH /api/auth/me/company` — summary: "Switch active company", tags: ['Auth'], security: [{ session: [] }]
5. `POST /api/auth/logout` — summary: "Log out", tags: ['Auth'], security: [{ session: [] }]

- [ ] **Step 2: Verify compilation**

```bash
cd backend && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/routes/auth.ts
git commit -m "docs: add OpenAPI schemas to auth routes"
```

---

## Task 6: Add OpenAPI Schemas to Admin Company Routes

**Files:**
- Modify: `backend/src/routes/admin/company.ts`

- [ ] **Step 1: Add schemas to all company routes**

9 endpoints, all with tags: ['Companies'], security: [{ session: [] }, { apiKey: [] }]:

1. `POST /api/admin/companies` — "Create company"
2. `GET /api/admin/companies` — "List companies"
3. `GET /api/admin/companies/:id` — "Get company details"
4. `PATCH /api/admin/companies/:id` — "Update company"
5. `DELETE /api/admin/companies/:id` — "Delete company"
6. `GET /api/admin/companies/:companyId/bookings` — "Get company bookings"
7. `PUT /api/admin/companies/:id/branding` — "Update company branding"
8. `POST /api/admin/companies/:id/branding/logo` — "Upload company logo"
9. `DELETE /api/admin/companies/:id/branding/logo` — "Delete company logo"

For the logo upload endpoint, use `{ type: 'string', format: 'binary' }` as the request body schema (multipart doesn't have a Zod equivalent — use a raw JSON Schema object).

- [ ] **Step 2: Verify compilation**

```bash
cd backend && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/routes/admin/company.ts
git commit -m "docs: add OpenAPI schemas to admin company routes"
```

---

## Task 7: Add OpenAPI Schemas to Admin Team Routes

**Files:**
- Modify: `backend/src/routes/admin/teams.ts`

- [ ] **Step 1: Add schemas to all 12 team routes**

All with tags: ['Teams'], security: [{ session: [] }, { apiKey: [] }].

Key endpoints: create team, list teams, get team, update team, delete team, update round-robin config, add/update/remove members, join/leave/invite.

- [ ] **Step 2: Verify compilation**

```bash
cd backend && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/routes/admin/teams.ts
git commit -m "docs: add OpenAPI schemas to admin team routes"
```

---

## Task 8: Add OpenAPI Schemas to Admin User Routes

**Files:**
- Modify: `backend/src/routes/admin/users.ts`

- [ ] **Step 1: Add schemas to all user routes**

This is the largest route file (20+ endpoints). Split across:
- Company user management (tags: ['Users'])
- Personal profile `/api/me` (tags: ['My Account'])
- Booking management `/api/me/bookings` (tags: ['My Account'])
- Vacation management `/api/me/vacations` (tags: ['My Account'])
- Availability `/api/me/availability` (tags: ['My Account'])
- Comments `/api/me/bookings/:id/comments` (tags: ['My Account'])

All with security: [{ session: [] }, { apiKey: [] }].

- [ ] **Step 2: Verify compilation**

```bash
cd backend && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/routes/admin/users.ts
git commit -m "docs: add OpenAPI schemas to admin user routes"
```

---

## Task 9: Add OpenAPI Schemas to Remaining Admin Routes

**Files:**
- Modify: `backend/src/routes/admin/event-types.ts`
- Modify: `backend/src/routes/admin/api-keys.ts`
- Modify: `backend/src/routes/admin/routing-forms.ts`
- Modify: `backend/src/routes/admin/organization.ts`
- Modify: `backend/src/routes/admin/analytics.ts`
- Modify: `backend/src/routes/admin/hubspot.ts`
- Modify: `backend/src/routes/admin/domains.ts`
- Modify: `backend/src/routes/routing.ts`
- Modify: `backend/src/routes/embed.ts`
- Modify: `backend/src/routes/holidays.ts`

- [ ] **Step 1: Add schemas to event type routes (6 endpoints)**

Tags: ['Event Types'], security: [{ session: [] }, { apiKey: [] }]

- [ ] **Step 2: Add schemas to API key routes (3 endpoints)**

Tags: ['API Keys'], security: [{ session: [] }, { apiKey: [] }]

- [ ] **Step 3: Add schemas to routing form admin routes (5 endpoints)**

Tags: ['Routing Forms'], security: [{ session: [] }, { apiKey: [] }]

- [ ] **Step 4: Add schemas to public routing routes (2 endpoints)**

Tags: ['Routing Forms'], security: []

- [ ] **Step 5: Add schemas to organization routes (2 endpoints)**

Tags: ['Organizations'], security: [{ session: [] }]

- [ ] **Step 6: Add schemas to analytics route (1 endpoint)**

Tags: ['Analytics'], security: [{ session: [] }, { apiKey: [] }]

- [ ] **Step 7: Add schemas to HubSpot route (1 endpoint)**

Tags: ['Integrations'], security: [{ session: [] }]

- [ ] **Step 8: Add schemas to domain routes (2 endpoints)**

Tags: ['Companies'], security: [{ session: [] }]

- [ ] **Step 9: Add schemas to embed route (1 endpoint)**

Tags: ['System'], security: []

- [ ] **Step 10: Add schemas to holidays route (1 endpoint)**

Tags: ['System'], security: [{ session: [] }, { apiKey: [] }]

- [ ] **Step 11: Verify all routes compile**

```bash
cd backend && npx tsc --noEmit
```

- [ ] **Step 12: Re-export spec and verify full endpoint count**

```bash
npx tsx docs/scripts/export-spec.ts
cat docs/openapi/calendfree.json | python3 -c "import json,sys; d=json.load(sys.stdin); paths=d.get('paths',{}); total=sum(len(v) for v in paths.values()); print(f'Total: {total} endpoints across {len(paths)} paths')"
```

Expected: ~67+ endpoints.

- [ ] **Step 13: Commit**

```bash
git add backend/src/routes/
git commit -m "docs: add OpenAPI schemas to all remaining routes"
```

---

## Task 10: Generate API Reference Pages and Verify

**Files:**
- Modify: `docs/sidebars.ts` (uncomment api sidebar)

- [ ] **Step 1: Export fresh spec**

```bash
npx tsx docs/scripts/export-spec.ts
```

- [ ] **Step 2: Generate API docs from spec**

```bash
cd docs && npx docusaurus gen-api-docs calendfree
```

Expected: Creates markdown files in `docs/docs/api/` for each endpoint, grouped by tag.

- [ ] **Step 3: Update sidebars.ts to include API sidebar**

Uncomment the `api` sidebar in `docs/sidebars.ts` (was commented out in Task 2 Step 4):

```typescript
  api: [
    {
      type: 'category',
      label: 'API Reference',
      link: { type: 'generated-index', title: 'Calendfree API', description: 'Complete API reference for Calendfree.' },
      items: require('./docs/api/sidebar.js'),
    },
  ],
```

Also uncomment the API Reference navbar item in `docs/docusaurus.config.ts`:

```typescript
{ type: 'docSidebar', sidebarId: 'api', label: 'API Reference', position: 'left' },
```

- [ ] **Step 4: Test the full site**

```bash
cd docs && npm start
```

Expected: Both "Docs" and "API Reference" navigation items work. API Reference shows endpoints grouped by tag (Bookings, Auth, Companies, Teams, etc.).

- [ ] **Step 5: Commit**

```bash
git add docs/sidebars.ts docs/docusaurus.config.ts
git commit -m "docs: generate API reference pages from OpenAPI spec"
```

---

## Task 11: Write Feature Documentation — Essential Pages

**Files:**
- Modify: `docs/docs/intro.md`
- Create/Modify: `docs/docs/getting-started/setup.md`
- Create/Modify: `docs/docs/getting-started/first-booking.md`
- Create/Modify: `docs/docs/features/api-keys.md`

- [ ] **Step 1: Write intro.md**

Expand the placeholder with a proper introduction: what Calendfree is, who it's for, key features with brief descriptions, links to getting started and API reference.

- [ ] **Step 2: Write setup.md**

Cover: prerequisites (Node 22+, Docker), cloning the repo, `docker compose up -d`, `.env` setup, `npm install`, `npm run db:migrate`, `npm run dev`, first Google OAuth login.

- [ ] **Step 3: Write first-booking.md**

Step-by-step walkthrough: create a company, create an event type, open the public booking page URL, select a slot, fill form, confirm. Include the URL pattern: `/:companySlug/:eventTypeSlug`.

- [ ] **Step 4: Write api-keys.md**

Cover: what API keys are, how to create them in the UI, using them with `Authorization: Bearer cf_live_...`, key format, revocation, example curl commands.

- [ ] **Step 5: Verify site builds**

```bash
cd docs && npm run build
```

Expected: Build succeeds without errors.

- [ ] **Step 6: Commit**

```bash
git add docs/docs/intro.md docs/docs/getting-started/ docs/docs/features/api-keys.md
git commit -m "docs: write essential documentation pages (intro, setup, first-booking, api-keys)"
```

---

## Task 12: Write Feature Documentation — Remaining Pages

**Files:**
- Modify: `docs/docs/features/event-types.md`
- Modify: `docs/docs/features/booking-flow.md`
- Modify: `docs/docs/features/teams-round-robin.md`
- Modify: `docs/docs/features/availability.md`
- Modify: `docs/docs/features/routing-forms.md`
- Modify: `docs/docs/features/branding.md`
- Modify: `docs/docs/features/embed-widget.md`
- Modify: `docs/docs/features/google-calendar.md`
- Modify: `docs/docs/features/analytics.md`

- [ ] **Step 1: Write event-types.md**

Cover: three categories (Personal, Team, Group), creating event types, duration/buffer/notice settings, bookable hours, form fields, activation/deactivation.

- [ ] **Step 2: Write booking-flow.md**

Cover: public booking page flow, slot selection UI, form submission, confirmation page, cancel/reschedule via token links, booking statuses.

- [ ] **Step 3: Write teams-round-robin.md**

Cover: creating teams, adding/removing members, three round-robin modes (Sequential, Least Busy, Weighted), configuring weights, team ownership.

- [ ] **Step 4: Write availability.md**

Cover: weekly schedule, date-specific overrides, vacation periods, public holidays (country-based), max bookings per day/week, absent status.

- [ ] **Step 5: Write routing-forms.md**

Cover: creating routing forms, question configuration, options (link to event type, URL, or message), fallback behavior, public URL, name/email collection.

- [ ] **Step 6: Write branding.md**

Cover: logo upload (PNG/JPEG/GIF/WebP, 2MB max), color customization (primary, accent, background, text), footer text, "Powered by" toggle, live preview.

- [ ] **Step 7: Write embed-widget.md**

Cover: script tag, configuration, URL pattern, embedding on external websites.

- [ ] **Step 8: Write google-calendar.md**

Cover: connecting Google account via OAuth, required scopes, how busy-time detection works, Google Meet link auto-generation, token encryption.

- [ ] **Step 9: Write analytics.md**

Cover: dashboard overview, 30-day and 7-day stats, bookings by status, bookings by user, daily breakdown.

- [ ] **Step 10: Verify full site builds**

```bash
cd docs && npm run build
```

Expected: Build succeeds. All sidebar links work.

- [ ] **Step 11: Commit**

```bash
git add docs/docs/features/
git commit -m "docs: write all feature documentation pages"
```

---

## Task 13: Final Integration and Polish

**Files:**
- Various docs files

- [ ] **Step 1: Full build test**

```bash
npm run docs:build
```

Expected: Spec export + Docusaurus build both succeed.

- [ ] **Step 2: Verify API reference completeness**

Open the built site and check:
- All tags are present (Auth, Bookings, Companies, Teams, Event Types, Users, My Account, API Keys, Routing Forms, Analytics, Integrations, System)
- Each endpoint has a summary and description
- Request parameters are documented
- Response schemas are shown

- [ ] **Step 3: Verify feature docs completeness**

Check that all 13 pages are accessible from the sidebar and have meaningful content.

- [ ] **Step 4: Fix any broken links or build warnings**

Address any `onBrokenLinks: 'throw'` errors or markdown warnings.

- [ ] **Step 5: Final commit**

```bash
git add docs/
git commit -m "docs: finalize documentation site with API reference and feature docs"
```
