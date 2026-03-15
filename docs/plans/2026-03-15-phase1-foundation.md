# Calendfree Phase 1: Foundation — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Set up the Calendfree monorepo with backend (Fastify + TypeScript), frontend (React + Vite + Tailwind), shared package, Prisma schema, Google OAuth flow, session management, RBAC middleware, and CLAUDE.md files.

**Architecture:** Monorepo with three packages (`backend`, `frontend`, `shared`) managed via npm workspaces. Backend is Fastify with TypeScript, using Prisma for PostgreSQL access. Auth is Google OAuth 2.0 with Redis-backed sessions. Shared package contains Zod schemas and TypeScript types used by both frontend and backend.

**Tech Stack:** Fastify, React 19, Vite, Tailwind CSS, Prisma, PostgreSQL, Redis, Zod, TypeScript, Docker Compose, Vitest

---

## Chunk 1: Project Scaffolding & Infrastructure

### Task 1: Initialize Monorepo

**Files:**
- Create: `package.json` (root)
- Create: `tsconfig.base.json`
- Create: `.gitignore`
- Create: `.env.example`
- Create: `docker-compose.yml`

- [ ] **Step 1: Create root package.json with workspaces**

```json
{
  "name": "calendfree",
  "private": true,
  "workspaces": ["shared", "backend", "frontend"],
  "scripts": {
    "dev": "concurrently \"npm run dev -w backend\" \"npm run dev -w frontend\"",
    "build": "npm run build -w shared && npm run build -w backend && npm run build -w frontend",
    "lint": "npm run lint -w shared && npm run lint -w backend && npm run lint -w frontend",
    "test": "npm run test -w shared && npm run test -w backend",
    "db:migrate": "npm run db:migrate -w backend",
    "db:generate": "npm run db:generate -w backend"
  },
  "devDependencies": {
    "concurrently": "^9.1.0",
    "typescript": "^5.7.0"
  }
}
```

- [ ] **Step 2: Create base TypeScript config**

```json
// tsconfig.base.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "resolveJsonModule": true
  }
}
```

- [ ] **Step 3: Create .gitignore**

```
node_modules/
dist/
.env
*.log
.prisma/
generated/
```

- [ ] **Step 4: Create .env.example**

```env
# Database
DATABASE_URL=postgresql://calendfree:calendfree@localhost:5432/calendfree

# Redis
REDIS_URL=redis://localhost:6379

# Google OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:3001/api/auth/google/callback

# Security
SESSION_SECRET=change-me-to-a-random-string-at-least-32-chars
# Generate with: openssl rand -hex 32 (must be exactly 64 hex chars = 32 bytes for AES-256)
ENCRYPTION_KEY=0000000000000000000000000000000000000000000000000000000000000000

# App
BACKEND_URL=http://localhost:3001
FRONTEND_URL=http://localhost:5173
```

- [ ] **Step 5: Create docker-compose.yml**

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: calendfree
      POSTGRES_PASSWORD: calendfree
      POSTGRES_DB: calendfree
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redisdata:/data

volumes:
  pgdata:
  redisdata:
```

- [ ] **Step 6: Commit**

```bash
git init
git add package.json tsconfig.base.json .gitignore .env.example docker-compose.yml
git commit -m "feat: initialize calendfree monorepo with docker-compose"
```

---

### Task 2: Scaffold Shared Package

**Files:**
- Create: `shared/package.json`
- Create: `shared/tsconfig.json`
- Create: `shared/src/index.ts`
- Create: `shared/src/schemas/auth.ts`
- Create: `shared/src/schemas/organization.ts`
- Create: `shared/src/types/index.ts`

- [ ] **Step 1: Create shared package.json**

```json
{
  "name": "@calendfree/shared",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "lint": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "zod": "^3.24.0"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "vitest": "^3.0.0"
  }
}
```

- [ ] **Step 2: Create shared tsconfig.json**

```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: Create auth schemas**

```typescript
// shared/src/schemas/auth.ts
import { z } from 'zod';

export const RoleSchema = z.enum(['ORG_ADMIN', 'COMPANY_ADMIN', 'USER']);
export type Role = z.infer<typeof RoleSchema>;

export const SessionUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string(),
  avatarUrl: z.string().url().nullable(),
  organizationId: z.string().uuid(),
  /** Active company context — user can switch between companies they belong to */
  activeCompanyId: z.string().uuid().nullable(),
  /** Role in the active company (null if no company selected) */
  activeRole: RoleSchema.nullable(),
});
export type SessionUser = z.infer<typeof SessionUserSchema>;

export const GoogleTokensSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresAt: z.date(),
  scopes: z.array(z.string()),
});
export type GoogleTokens = z.infer<typeof GoogleTokensSchema>;
```

- [ ] **Step 4: Create organization schemas**

```typescript
// shared/src/schemas/organization.ts
import { z } from 'zod';

export const SlugSchema = z.string()
  .min(2).max(63)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with hyphens');

export const CreateOrganizationSchema = z.object({
  name: z.string().min(1).max(255),
  slug: SlugSchema,
});
export type CreateOrganization = z.infer<typeof CreateOrganizationSchema>;

export const CreateCompanySchema = z.object({
  name: z.string().min(1).max(255),
  slug: SlugSchema,
});
export type CreateCompany = z.infer<typeof CreateCompanySchema>;

export const BrandingConfigSchema = z.object({
  logoUrl: z.string().url().nullable().optional(),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  fontFamily: z.string().max(100).optional(),
});
export type BrandingConfig = z.infer<typeof BrandingConfigSchema>;
```

- [ ] **Step 5: Create barrel export**

```typescript
// shared/src/index.ts
export * from './schemas/auth.js';
export * from './schemas/organization.js';
export * from './types/index.js';
```

- [ ] **Step 6: Create types index (placeholder for Prisma-generated types)**

```typescript
// shared/src/types/index.ts
// Re-exports of Prisma-generated types will be added after schema is created.
// For now, export shared utility types.

export type Paginated<T> = {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type ApiError = {
  statusCode: number;
  error: string;
  message: string;
};

export type ApiSuccess<T> = {
  data: T;
};
```

- [ ] **Step 7: Commit**

```bash
git add shared/
git commit -m "feat: scaffold shared package with Zod schemas for auth and organization"
```

---

### Task 3: Scaffold Backend Package

**Files:**
- Create: `backend/package.json`
- Create: `backend/tsconfig.json`
- Create: `backend/src/app.ts`
- Create: `backend/src/server.ts`
- Create: `backend/src/config.ts`
- Create: `backend/src/plugins/index.ts`

- [ ] **Step 1: Create backend package.json**

```json
{
  "name": "@calendfree/backend",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "lint": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "db:migrate": "prisma migrate dev",
    "db:generate": "prisma generate",
    "db:push": "prisma db push",
    "db:seed": "tsx prisma/seed.ts"
  },
  "dependencies": {
    "@calendfree/shared": "*",
    "@fastify/cookie": "^11.0.0",
    "@fastify/cors": "^10.0.0",
    "@fastify/helmet": "^13.0.0",
    "@fastify/rate-limit": "^10.2.0",
    "@fastify/session": "^11.0.0",
    "@fastify/swagger": "^9.4.0",
    "@fastify/swagger-ui": "^5.2.0",
    "@prisma/client": "^6.3.0",
    "connect-redis": "^8.0.0",
    "dotenv": "^16.4.0",
    "fastify": "^5.2.0",
    "google-auth-library": "^9.15.0",
    "ioredis": "^5.4.0",
    "pg-boss": "^10.1.0",
    "pino": "^9.6.0",
    "zod": "^3.24.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "pino-pretty": "^13.0.0",
    "prisma": "^6.3.0",
    "tsx": "^4.19.0",
    "typescript": "^5.7.0",
    "vitest": "^3.0.0"
  }
}
```

- [ ] **Step 2: Create backend tsconfig.json**

```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: Create config.ts with environment validation**

```typescript
// backend/src/config.ts
import { z } from 'zod';
import 'dotenv/config';

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  GOOGLE_REDIRECT_URI: z.string().url(),
  SESSION_SECRET: z.string().min(32),
  ENCRYPTION_KEY: z.string().length(64).regex(/^[0-9a-fA-F]+$/, 'Must be 64 hex chars (32 bytes for AES-256)'),
  ENCRYPTION_KEY_NEW: z.string().length(64).regex(/^[0-9a-fA-F]+$/).optional(),
  BACKEND_URL: z.string().url().default('http://localhost:3001'),
  FRONTEND_URL: z.string().url().default('http://localhost:5173'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3001),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = parsed.data;
export type Config = typeof config;
```

- [ ] **Step 4: Create app.ts (Fastify app factory)**

```typescript
// backend/src/app.ts
import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { config } from './config.js';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: config.LOG_LEVEL,
      transport: config.NODE_ENV === 'development'
        ? { target: 'pino-pretty' }
        : undefined,
    },
    genReqId: () => crypto.randomUUID(),
  });

  // Security
  await app.register(helmet, {
    contentSecurityPolicy: config.NODE_ENV === 'production',
  });

  // CORS
  await app.register(cors, {
    origin: config.FRONTEND_URL,
    credentials: true,
  });

  // Rate limiting
  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });

  // Swagger / OpenAPI
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
  });
  await app.register(swaggerUi, { routePrefix: '/api/docs' });

  // Health check
  app.get('/api/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

  return app;
}
```

- [ ] **Step 5: Create server.ts (entry point)**

```typescript
// backend/src/server.ts
import { buildApp } from './app.js';
import { config } from './config.js';

async function start() {
  const app = await buildApp();

  try {
    await app.listen({ port: config.PORT, host: '0.0.0.0' });
    app.log.info(`Calendfree backend running on port ${config.PORT}`);
    app.log.info(`API docs: ${config.BACKEND_URL}/api/docs`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
```

- [ ] **Step 6: Create vitest config with test env vars**

```typescript
// backend/vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    env: {
      DATABASE_URL: 'postgresql://calendfree:calendfree@localhost:5432/calendfree',
      REDIS_URL: 'redis://localhost:6379',
      GOOGLE_CLIENT_ID: 'test-client-id.apps.googleusercontent.com',
      GOOGLE_CLIENT_SECRET: 'test-client-secret',
      GOOGLE_REDIRECT_URI: 'http://localhost:3001/api/auth/google/callback',
      SESSION_SECRET: 'test-session-secret-at-least-32-characters-long',
      ENCRYPTION_KEY: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
      BACKEND_URL: 'http://localhost:3001',
      FRONTEND_URL: 'http://localhost:5173',
      NODE_ENV: 'test',
    },
  },
});
```

- [ ] **Step 7: Write test for health endpoint**

```typescript
// backend/src/__tests__/health.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../app.js';
import type { FastifyInstance } from 'fastify';

describe('Health endpoint', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/health returns status ok', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/health',
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.status).toBe('ok');
    expect(body.timestamp).toBeDefined();
  });
});
```

- [ ] **Step 8: Run test to verify it passes**

Run: `cd calendfree && npm install && npm run build -w shared && npm run test -w backend`
Expected: PASS — health test green. Note: shared must be built first since backend depends on it.

- [ ] **Step 9: Commit**

```bash
git add backend/
git commit -m "feat: scaffold backend with Fastify, health endpoint, swagger, and security plugins"
```

---

### Task 4: Scaffold Frontend Package

**Files:**
- Create: `frontend/` (via Vite scaffold)
- Modify: `frontend/package.json` (add workspace dep)
- Create: `frontend/src/App.tsx`

- [ ] **Step 1: Scaffold Vite React TS project**

```bash
cd calendfree
npm create vite@latest frontend -- --template react-ts
```

- [ ] **Step 2: Install Tailwind CSS and dependencies**

```bash
cd frontend
npm install -D tailwindcss @tailwindcss/vite
```

- [ ] **Step 3: Add Tailwind to vite.config.ts**

```typescript
// frontend/vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
```

- [ ] **Step 4: Add Tailwind import to CSS**

```css
/* frontend/src/index.css */
@import "tailwindcss";
```

- [ ] **Step 5: Replace App.tsx with minimal shell**

```tsx
// frontend/src/App.tsx
function App() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900">Calendfree</h1>
        <p className="mt-2 text-gray-600">Round-Robin Scheduling Platform</p>
      </div>
    </div>
  );
}

export default App;
```

- [ ] **Step 6: Add @calendfree/shared dependency to frontend package.json**

Add to `frontend/package.json` dependencies:
```json
"@calendfree/shared": "*"
```

- [ ] **Step 7: Verify frontend starts**

```bash
cd calendfree && npm install && npm run dev -w frontend
```

Open http://localhost:5173 — should show "Calendfree" heading with Tailwind styling.

- [ ] **Step 8: Commit**

```bash
git add frontend/
git commit -m "feat: scaffold frontend with React, Vite, and Tailwind CSS"
```

---

## Chunk 2: Prisma Schema & Database

### Task 5: Create Prisma Schema

**Files:**
- Create: `backend/prisma/schema.prisma`

- [ ] **Step 1: Create the full Prisma schema**

```prisma
// backend/prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ──────────────────────────────────────────────
// Enums
// ──────────────────────────────────────────────

enum Role {
  ORG_ADMIN
  COMPANY_ADMIN
  USER
}

enum RoundRobinMode {
  SEQUENTIAL
  LEAST_BUSY
  WEIGHTED
}

enum BookingStatus {
  CONFIRMED
  CANCELLED
  RESCHEDULED
  NO_SHOW
  COMPLETED
  PENDING_CALENDAR_SYNC
}

enum AuditAction {
  USER_LOGIN
  USER_LOGOUT
  TOKEN_CREATED
  TOKEN_REVOKED
  ROLE_CHANGED
  API_KEY_CREATED
  API_KEY_REVOKED
  BOOKING_CREATED
  BOOKING_CANCELLED
  BOOKING_RESCHEDULED
  SETTINGS_CHANGED
}

// ──────────────────────────────────────────────
// Organization & Company
// ──────────────────────────────────────────────

model Organization {
  id        String   @id @default(uuid())
  name      String
  slug      String   @unique
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  companies Company[]
  users     User[]
  branding  BrandingConfig? @relation("OrgBranding")
}

model Company {
  id             String   @id @default(uuid())
  name           String
  slug           String
  customDomain   String?  @unique
  organizationId String
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  organization Organization      @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  teams        Team[]
  eventTypes   EventType[]
  memberships  CompanyMembership[]
  branding     BrandingConfig?   @relation("CompanyBranding")
  routingForms RoutingForm[]

  @@unique([organizationId, slug])
}

model BrandingConfig {
  id             String  @id @default(uuid())
  logoUrl        String?
  primaryColor   String? @default("#2563EB")
  accentColor    String? @default("#7C3AED")
  fontFamily     String? @default("Inter")

  organizationId String? @unique
  organization   Organization? @relation("OrgBranding", fields: [organizationId], references: [id], onDelete: Cascade)

  companyId String? @unique
  company   Company? @relation("CompanyBranding", fields: [companyId], references: [id], onDelete: Cascade)
}

// ──────────────────────────────────────────────
// Users & Memberships
// ──────────────────────────────────────────────

model User {
  id             String   @id @default(uuid())
  email          String   @unique
  name           String
  avatarUrl      String?
  slug           String?
  timezone       String   @default("Europe/Berlin")
  organizationId String
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  organization    Organization        @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  companyMemberships CompanyMembership[]
  teamMemberships TeamMembership[]
  googleTokens   GoogleTokens?
  availability   AvailabilityConfig?
  bookings       Booking[]
  personalEventTypes EventType[]      @relation("PersonalEventTypes")
  apiKeys        ApiKey[]
  auditLogs      AuditLog[]

  // Slug is unique within the organization (for personal booking pages)
  @@unique([organizationId, slug])
}

model CompanyMembership {
  id        String   @id @default(uuid())
  userId    String
  companyId String
  role      Role     @default(USER)
  createdAt DateTime @default(now())

  user    User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  company Company @relation(fields: [companyId], references: [id], onDelete: Cascade)

  @@unique([userId, companyId])
}

model GoogleTokens {
  id           String   @id @default(uuid())
  userId       String   @unique
  /** AES-256 encrypted access token */
  accessToken  String
  /** AES-256 encrypted refresh token */
  refreshToken String
  expiresAt    DateTime
  scopes       String[]
  connected    Boolean  @default(true)
  updatedAt    DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

// ──────────────────────────────────────────────
// Teams & Round-Robin
// ──────────────────────────────────────────────

model Team {
  id        String   @id @default(uuid())
  name      String
  companyId String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  company     Company          @relation(fields: [companyId], references: [id], onDelete: Cascade)
  memberships TeamMembership[]
  eventTypes  EventType[]
  rrConfig    RoundRobinConfig?
}

model TeamMembership {
  id     String @id @default(uuid())
  userId String
  teamId String
  /** Weight for weighted round-robin (percentage, e.g. 40) */
  weight Int    @default(100)

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  team Team @relation(fields: [teamId], references: [id], onDelete: Cascade)

  @@unique([userId, teamId])
}

model RoundRobinConfig {
  id               String         @id @default(uuid())
  teamId           String         @unique
  mode             RoundRobinMode @default(SEQUENTIAL)
  /** Index of last assigned member (for SEQUENTIAL mode) */
  lastAssignedIndex Int           @default(0)
  /** Optimistic concurrency control */
  version          Int            @default(0)
  updatedAt        DateTime       @updatedAt

  team Team @relation(fields: [teamId], references: [id], onDelete: Cascade)
}

// ──────────────────────────────────────────────
// Event Types & Booking
// ──────────────────────────────────────────────

model EventType {
  id          String  @id @default(uuid())
  title       String
  slug        String
  description String?
  /** Duration in minutes */
  duration    Int     @default(30)
  /** Buffer before event in minutes */
  bufferBefore Int    @default(0)
  /** Buffer after event in minutes */
  bufferAfter  Int    @default(0)
  /** Minimum notice in hours before booking */
  minNotice    Int    @default(4)
  /** How many days ahead can be booked */
  maxAdvance   Int    @default(60)
  /** Auto-generate Google Meet link */
  autoMeetLink Boolean @default(true)
  active       Boolean @default(true)
  color        String? @default("#2563EB")

  companyId String?
  company   Company? @relation(fields: [companyId], references: [id], onDelete: Cascade)

  /** For team event types */
  teamId String?
  team   Team?   @relation(fields: [teamId], references: [id], onDelete: SetNull)

  /** For personal event types */
  userId String?
  user   User?   @relation("PersonalEventTypes", fields: [userId], references: [id], onDelete: Cascade)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  formFields FormField[]
  bookings   Booking[]

  // Slug uniqueness: per-company for team events, per-user for personal events
  @@unique([companyId, slug])
  @@unique([userId, slug])
}

model FormField {
  id          String  @id @default(uuid())
  eventTypeId String
  label       String
  type        String  @default("text") // text, email, phone, select, textarea
  required    Boolean @default(false)
  options     String[] // For select fields
  order       Int     @default(0)

  eventType EventType @relation(fields: [eventTypeId], references: [id], onDelete: Cascade)
}

model Booking {
  id             String        @id @default(uuid())
  eventTypeId    String
  assignedUserId String
  status         BookingStatus @default(CONFIRMED)
  /** Booking start time (UTC) */
  startTime      DateTime
  /** Booking end time (UTC) */
  endTime        DateTime
  /** Timezone of the customer who booked */
  customerTimezone String     @default("Europe/Berlin")
  /** Google Calendar event ID (for sync) */
  calendarEventId String?
  /** Secure token for cancel/reschedule links — generated in application code with crypto.randomBytes */
  bookingToken   String        @unique
  /** Token expiry (meeting time or configured notice period before) */
  tokenExpiresAt DateTime?
  /** Optimistic concurrency control */
  version        Int           @default(0)
  createdAt      DateTime      @default(now())
  updatedAt      DateTime      @updatedAt

  eventType    EventType       @relation(fields: [eventTypeId], references: [id], onDelete: Cascade)
  assignedUser User            @relation(fields: [assignedUserId], references: [id], onDelete: Cascade)
  formData     BookingFormData?
}

model BookingFormData {
  id        String @id @default(uuid())
  bookingId String @unique
  /** Customer name */
  name      String
  /** Customer email */
  email     String
  /** Additional form field responses as JSON */
  data      Json   @default("{}")

  booking Booking @relation(fields: [bookingId], references: [id], onDelete: Cascade)
}

// ──────────────────────────────────────────────
// Availability
// ──────────────────────────────────────────────

model AvailabilityConfig {
  id     String @id @default(uuid())
  userId String @unique
  /** Weekly schedule as JSON: { "monday": [{"start": "09:00", "end": "17:00"}], ... } */
  weeklySchedule Json @default("{\"monday\":[{\"start\":\"09:00\",\"end\":\"17:00\"}],\"tuesday\":[{\"start\":\"09:00\",\"end\":\"17:00\"}],\"wednesday\":[{\"start\":\"09:00\",\"end\":\"17:00\"}],\"thursday\":[{\"start\":\"09:00\",\"end\":\"17:00\"}],\"friday\":[{\"start\":\"09:00\",\"end\":\"17:00\"}]}")
  /** Max bookings per day */
  maxPerDay  Int? @default(8)
  /** Max bookings per week */
  maxPerWeek Int? @default(30)

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

// ──────────────────────────────────────────────
// Routing Forms
// ──────────────────────────────────────────────

model RoutingForm {
  id        String   @id @default(uuid())
  title     String
  slug      String
  companyId String
  active    Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  company Company       @relation(fields: [companyId], references: [id], onDelete: Cascade)
  rules   RoutingRule[]

  @@unique([companyId, slug])
}

model RoutingRule {
  id            String @id @default(uuid())
  routingFormId String
  /** Field name to match */
  field         String
  /** Operator: equals, contains, regex */
  operator      String @default("equals")
  /** Value to match against */
  value         String
  /** Target event type slug or URL */
  targetSlug    String
  order         Int    @default(0)

  routingForm RoutingForm @relation(fields: [routingFormId], references: [id], onDelete: Cascade)
}

// ──────────────────────────────────────────────
// API Keys
// ──────────────────────────────────────────────

model ApiKey {
  id        String    @id @default(uuid())
  userId    String
  name      String
  /** SHA-256 hash of the key (prefix: cf_live_) */
  keyHash   String    @unique
  /** First 8 chars for identification */
  keyPrefix String
  expiresAt DateTime?
  active    Boolean   @default(true)
  lastUsedAt DateTime?
  createdAt DateTime  @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

// ──────────────────────────────────────────────
// Audit Log
// ──────────────────────────────────────────────

model AuditLog {
  id        String      @id @default(uuid())
  userId    String?
  action    AuditAction
  details   Json?
  ipAddress String?
  createdAt DateTime    @default(now())

  user User? @relation(fields: [userId], references: [id], onDelete: SetNull)
}
```

- [ ] **Step 2: Start Docker containers and run migration**

```bash
cd calendfree
docker compose up -d
cp .env.example backend/.env
# Edit backend/.env with actual values or keep defaults for local dev
npm run db:migrate -w backend -- --name init
```

Expected: Migration creates all tables in PostgreSQL.

- [ ] **Step 3: Generate Prisma Client**

```bash
npm run db:generate -w backend
```

- [ ] **Step 4: Create Prisma client singleton**

```typescript
// backend/src/db.ts
import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['warn', 'error'],
});
```

- [ ] **Step 5: Write test to verify DB connection**

```typescript
// backend/src/__tests__/db.test.ts
import { describe, it, expect, afterAll } from 'vitest';
import { prisma } from '../db.js';

describe('Database connection', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('connects to PostgreSQL', async () => {
    const result = await prisma.$queryRaw<[{ now: Date }]>`SELECT NOW()`;
    expect(result[0].now).toBeInstanceOf(Date);
  });
});
```

- [ ] **Step 6: Run test**

Run: `npm run test -w backend`
Expected: PASS — DB connection test green.

- [ ] **Step 7: Commit**

```bash
git add backend/prisma/ backend/src/db.ts backend/src/__tests__/db.test.ts
git commit -m "feat: add Prisma schema with full data model and database connection"
```

---

### Task 6: Create Seed Script

**Files:**
- Create: `backend/prisma/seed.ts`

- [ ] **Step 1: Create seed script for development**

```typescript
// backend/prisma/seed.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Create organization
  const org = await prisma.organization.upsert({
    where: { slug: 'seibert-group' },
    update: {},
    create: {
      name: 'Seibert Group',
      slug: 'seibert-group',
    },
  });

  // Create org branding
  await prisma.brandingConfig.upsert({
    where: { organizationId: org.id },
    update: {},
    create: {
      organizationId: org.id,
      primaryColor: '#2563EB',
      accentColor: '#7C3AED',
    },
  });

  // Create companies
  const groupGmbh = await prisma.company.upsert({
    where: { organizationId_slug: { organizationId: org.id, slug: 'seibert-group-gmbh' } },
    update: {},
    create: {
      name: 'Seibert Group GmbH',
      slug: 'seibert-group-gmbh',
      organizationId: org.id,
    },
  });

  const solutions = await prisma.company.upsert({
    where: { organizationId_slug: { organizationId: org.id, slug: 'seibert-solutions' } },
    update: {},
    create: {
      name: 'Seibert Solutions GmbH',
      slug: 'seibert-solutions',
      organizationId: org.id,
    },
  });

  // Create admin user
  const admin = await prisma.user.upsert({
    where: { email: 'admin@seibert.group' },
    update: {},
    create: {
      email: 'admin@seibert.group',
      name: 'Admin User',
      organizationId: org.id,
    },
  });

  // Make admin org-admin in both companies
  await prisma.companyMembership.upsert({
    where: { userId_companyId: { userId: admin.id, companyId: groupGmbh.id } },
    update: {},
    create: { userId: admin.id, companyId: groupGmbh.id, role: 'ORG_ADMIN' },
  });

  await prisma.companyMembership.upsert({
    where: { userId_companyId: { userId: admin.id, companyId: solutions.id } },
    update: {},
    create: { userId: admin.id, companyId: solutions.id, role: 'ORG_ADMIN' },
  });

  console.log('Seed completed:', { org: org.slug, companies: [groupGmbh.slug, solutions.slug] });
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
```

- [ ] **Step 2: Add seed command to backend package.json**

In `backend/package.json`, add under `prisma` key:
```json
"prisma": {
  "seed": "tsx prisma/seed.ts"
}
```

- [ ] **Step 3: Run seed**

```bash
cd calendfree && npx -w backend prisma db seed
```

Expected: "Seed completed" with org and company slugs.

- [ ] **Step 4: Commit**

```bash
git add backend/prisma/seed.ts backend/package.json
git commit -m "feat: add database seed script with sample organization and companies"
```

---

## Chunk 3: Authentication & Session Management

### Task 7: Set Up Redis & Session Plugin

**Files:**
- Create: `backend/src/plugins/session.ts`
- Modify: `backend/src/app.ts`

- [ ] **Step 1: Create Redis client utility**

```typescript
// backend/src/redis.ts
import IORedis from 'ioredis';
import { config } from './config.js';

export const redis = new IORedis(config.REDIS_URL, {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
});
```

- [ ] **Step 2: Create session plugin**

```typescript
// backend/src/plugins/session.ts
import fp from 'fastify-plugin';
import cookie from '@fastify/cookie';
import session from '@fastify/session';
import { redis } from '../redis.js';
import { config } from '../config.js';
import type { SessionUser } from '@calendfree/shared';

// Extend Fastify session type
declare module '@fastify/session' {
  interface FastifySessionObject {
    user?: SessionUser;
  }
}

/**
 * Custom Redis session store compatible with @fastify/session.
 * We implement the store interface directly instead of using connect-redis
 * (which is designed for express-session and has type incompatibilities).
 */
class RedisSessionStore {
  private prefix = 'sess:';

  async get(sid: string, callback: (err: any, session?: any) => void) {
    try {
      const data = await redis.get(this.prefix + sid);
      callback(null, data ? JSON.parse(data) : null);
    } catch (err) {
      callback(err);
    }
  }

  async set(sid: string, session: any, callback: (err?: any) => void) {
    try {
      const ttl = session.cookie?.maxAge ? Math.ceil(session.cookie.maxAge / 1000) : 86400;
      await redis.setex(this.prefix + sid, ttl, JSON.stringify(session));
      callback();
    } catch (err) {
      callback(err);
    }
  }

  async destroy(sid: string, callback: (err?: any) => void) {
    try {
      await redis.del(this.prefix + sid);
      callback();
    } catch (err) {
      callback(err);
    }
  }
}

export default fp(async function sessionPlugin(app) {
  await app.register(cookie);
  await app.register(session, {
    secret: config.SESSION_SECRET,
    store: new RedisSessionStore() as any,
    cookie: {
      secure: config.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
    saveUninitialized: false,
  });
});
```

- [ ] **Step 3: Add fastify-plugin dependency**

```bash
cd calendfree && npm install -w backend fastify-plugin
```

- [ ] **Step 4: Register session plugin in app.ts**

Add to `backend/src/app.ts` after the rate-limit registration:
```typescript
import sessionPlugin from './plugins/session.js';

// ... after rate-limit registration:
await app.register(sessionPlugin);
```

- [ ] **Step 5: Update health endpoint to check Redis**

Update health endpoint in `app.ts`:
```typescript
import { redis } from './redis.js';
import { prisma } from './db.js';

app.get('/api/health', async () => {
  const dbOk = await prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false);
  const redisOk = await redis.ping().then(() => true).catch(() => false);
  return {
    status: dbOk && redisOk ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    services: { database: dbOk, redis: redisOk },
  };
});
```

- [ ] **Step 6: Write test for session**

```typescript
// backend/src/__tests__/session.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../app.js';
import type { FastifyInstance } from 'fastify';

describe('Session management', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('health check reports redis status', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/health' });
    const body = response.json();
    expect(body.services).toHaveProperty('redis');
    expect(body.services).toHaveProperty('database');
  });
});
```

- [ ] **Step 7: Run tests**

Run: `npm run test -w backend`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add backend/src/redis.ts backend/src/plugins/session.ts backend/src/app.ts backend/src/__tests__/session.test.ts
git commit -m "feat: add Redis-backed session management with health check"
```

---

### Task 8: Implement Google OAuth Flow

**Files:**
- Create: `backend/src/services/google-auth.ts`
- Create: `backend/src/routes/auth.ts`
- Create: `backend/src/utils/encryption.ts`

- [ ] **Step 1: Create encryption utility for tokens**

```typescript
// backend/src/utils/encryption.ts
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { config } from '../config.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

function getKey(): Buffer {
  return Buffer.from(config.ENCRYPTION_KEY, 'hex');
}

/** Encrypt a string. Returns base64-encoded (iv + tag + ciphertext). */
export function encrypt(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

/** Decrypt a base64-encoded string. */
export function decrypt(encoded: string): string {
  const buf = Buffer.from(encoded, 'base64');
  const iv = buf.subarray(0, IV_LENGTH);
  const tag = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const ciphertext = buf.subarray(IV_LENGTH + TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(tag);
  return decipher.update(ciphertext) + decipher.final('utf8');
}
```

- [ ] **Step 2: Write encryption test**

```typescript
// backend/src/__tests__/encryption.test.ts
import { describe, it, expect } from 'vitest';
import { encrypt, decrypt } from '../utils/encryption.js';

describe('Encryption', () => {
  it('encrypts and decrypts a string', () => {
    const original = 'ya29.a0secret-access-token';
    const encrypted = encrypt(original);
    expect(encrypted).not.toBe(original);
    expect(decrypt(encrypted)).toBe(original);
  });

  it('produces different ciphertext for same input (random IV)', () => {
    const input = 'same-input';
    const a = encrypt(input);
    const b = encrypt(input);
    expect(a).not.toBe(b);
    expect(decrypt(a)).toBe(decrypt(b));
  });
});
```

- [ ] **Step 3: Run test to verify**

Run: `npm run test -w backend -- --run src/__tests__/encryption.test.ts`
Expected: PASS

- [ ] **Step 4: Create Google Auth service**

```typescript
// backend/src/services/google-auth.ts
import { OAuth2Client } from 'google-auth-library';
import { config } from '../config.js';
import { prisma } from '../db.js';
import { encrypt, decrypt } from '../utils/encryption.js';

const SCOPES = [
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/gmail.send',
];

export function createOAuth2Client(): OAuth2Client {
  return new OAuth2Client({
    clientId: config.GOOGLE_CLIENT_ID,
    clientSecret: config.GOOGLE_CLIENT_SECRET,
    redirectUri: config.GOOGLE_REDIRECT_URI,
  });
}

/** Generate the Google OAuth consent URL. */
export function getAuthUrl(state?: string): string {
  const client = createOAuth2Client();
  return client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
    state,
  });
}

/** Exchange authorization code for tokens and upsert user. */
export async function handleCallback(code: string) {
  const client = createOAuth2Client();
  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);

  // Get user info
  const userInfo = await client.request<{
    email: string;
    name: string;
    picture: string;
  }>({ url: 'https://www.googleapis.com/oauth2/v2/userinfo' });

  const { email, name, picture } = userInfo.data;

  // Find or create user
  let user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    // New user — must be invited to an org first (or be the first user = org admin)
    // For now, auto-create in first org (setup flow will be more sophisticated)
    const org = await prisma.organization.findFirst();
    if (!org) {
      throw new Error('No organization exists. Please run the seed script first.');
    }

    user = await prisma.user.create({
      data: {
        email,
        name,
        avatarUrl: picture,
        organizationId: org.id,
      },
    });
  }

  // Store encrypted tokens
  await prisma.googleTokens.upsert({
    where: { userId: user.id },
    update: {
      accessToken: encrypt(tokens.access_token!),
      refreshToken: tokens.refresh_token ? encrypt(tokens.refresh_token) : undefined,
      expiresAt: new Date(tokens.expiry_date!),
      scopes: SCOPES,
      connected: true,
    },
    create: {
      userId: user.id,
      accessToken: encrypt(tokens.access_token!),
      refreshToken: encrypt(tokens.refresh_token!),
      expiresAt: new Date(tokens.expiry_date!),
      scopes: SCOPES,
    },
  });

  // Get user's company memberships for session
  const memberships = await prisma.companyMembership.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'asc' },
  });

  const activeMembership = memberships[0] ?? null;

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    organizationId: user.organizationId,
    activeCompanyId: activeMembership?.companyId ?? null,
    activeRole: activeMembership?.role ?? null,
  };
}
```

- [ ] **Step 5: Create auth routes**

```typescript
// backend/src/routes/auth.ts
import type { FastifyInstance } from 'fastify';
import { getAuthUrl, handleCallback } from '../services/google-auth.js';
import { config } from '../config.js';

export async function authRoutes(app: FastifyInstance) {
  /** Redirect to Google OAuth consent screen */
  app.get('/api/auth/google', async (request, reply) => {
    const url = getAuthUrl();
    return reply.redirect(url);
  });

  /** Google OAuth callback — exchanges code for tokens, creates session */
  app.get('/api/auth/google/callback', async (request, reply) => {
    const { code, error } = request.query as { code?: string; error?: string };

    if (error || !code) {
      app.log.warn({ error }, 'OAuth callback error');
      return reply.redirect(`${config.FRONTEND_URL}/login?error=oauth_failed`);
    }

    try {
      const sessionUser = await handleCallback(code);
      request.session.user = sessionUser;

      return reply.redirect(`${config.FRONTEND_URL}/dashboard`);
    } catch (err) {
      app.log.error(err, 'OAuth callback failed');
      return reply.redirect(`${config.FRONTEND_URL}/login?error=oauth_failed`);
    }
  });

  /** Get current session user */
  app.get('/api/auth/me', async (request, reply) => {
    if (!request.session.user) {
      return reply.status(401).send({ error: 'Not authenticated' });
    }
    return request.session.user;
  });

  /** Logout — destroy session */
  app.post('/api/auth/logout', async (request, reply) => {
    await request.session.destroy();
    return { success: true };
  });
}
```

- [ ] **Step 6: Register auth routes in app.ts**

Add to `backend/src/app.ts`:
```typescript
import { authRoutes } from './routes/auth.js';

// ... after plugin registrations:
await app.register(authRoutes);
```

- [ ] **Step 7: Write auth route test**

```typescript
// backend/src/__tests__/auth.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../app.js';
import type { FastifyInstance } from 'fastify';

describe('Auth routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/auth/google redirects to Google', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/auth/google',
    });
    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toContain('accounts.google.com');
  });

  it('GET /api/auth/me returns 401 when not authenticated', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
    });
    expect(response.statusCode).toBe(401);
  });
});
```

- [ ] **Step 8: Run tests**

Run: `npm run test -w backend`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add backend/src/utils/encryption.ts backend/src/services/google-auth.ts backend/src/routes/auth.ts backend/src/__tests__/
git commit -m "feat: implement Google OAuth flow with encrypted token storage and session management"
```

---

## Chunk 4: RBAC Middleware & CLAUDE.md Files

### Task 9: Implement RBAC Middleware

**Files:**
- Create: `backend/src/middleware/auth.ts`
- Create: `backend/src/middleware/tenant.ts`

- [ ] **Step 1: Create auth middleware**

```typescript
// backend/src/middleware/auth.ts
import type { FastifyRequest, FastifyReply } from 'fastify';
import type { Role } from '@calendfree/shared';

/** Require an authenticated session. */
export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  if (!request.session.user) {
    return reply.status(401).send({ error: 'Authentication required' });
  }
}

/** Require a specific minimum role in the active company. */
export function requireRole(...allowedRoles: Role[]) {
  return async function (request: FastifyRequest, reply: FastifyReply) {
    const user = request.session.user;
    if (!user) {
      return reply.status(401).send({ error: 'Authentication required' });
    }

    // ORG_ADMIN can do anything
    if (user.activeRole === 'ORG_ADMIN') return;

    if (!user.activeRole || !allowedRoles.includes(user.activeRole)) {
      return reply.status(403).send({ error: 'Insufficient permissions' });
    }
  };
}
```

- [ ] **Step 2: Create tenant isolation middleware**

```typescript
// backend/src/middleware/tenant.ts
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';

// Extend Fastify request type for tenant context
declare module 'fastify' {
  interface FastifyRequest {
    organizationId?: string;
    companyId?: string | null;
  }
}

/** Plugin that decorates request with tenant context fields. */
export default fp(async function tenantPlugin(app: FastifyInstance) {
  app.decorateRequest('organizationId', undefined);
  app.decorateRequest('companyId', undefined);
});

/**
 * PreHandler that extracts organizationId and companyId from the session
 * and attaches them to the request. Use as preHandler on tenant-scoped routes.
 */
export async function tenantIsolation(request: FastifyRequest, reply: FastifyReply) {
  const user = request.session.user;
  if (!user) {
    return reply.status(401).send({ error: 'Authentication required' });
  }

  request.organizationId = user.organizationId;
  request.companyId = user.activeCompanyId;
}
```

- [ ] **Step 3: Write middleware tests**

```typescript
// backend/src/__tests__/middleware.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../app.js';
import type { FastifyInstance } from 'fastify';
import { requireAuth, requireRole } from '../middleware/auth.js';

describe('Auth middleware', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();

    // Register a test route that requires auth
    app.get('/test/protected', { preHandler: [requireAuth] }, async (req) => {
      return { user: req.session.user };
    });

    // Register a test route that requires COMPANY_ADMIN
    app.get('/test/admin', {
      preHandler: [requireRole('COMPANY_ADMIN', 'ORG_ADMIN')],
    }, async (req) => {
      return { role: req.session.user?.activeRole };
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('requireAuth returns 401 for unauthenticated requests', async () => {
    const response = await app.inject({ method: 'GET', url: '/test/protected' });
    expect(response.statusCode).toBe(401);
  });

  it('requireRole returns 401 for unauthenticated requests', async () => {
    const response = await app.inject({ method: 'GET', url: '/test/admin' });
    expect(response.statusCode).toBe(401);
  });
});
```

- [ ] **Step 4: Run tests**

Run: `npm run test -w backend`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/middleware/
git commit -m "feat: add RBAC auth middleware and tenant isolation"
```

---

### Task 10: Create CLAUDE.md Files

**Files:**
- Create: `CLAUDE.md` (root)
- Create: `backend/CLAUDE.md`
- Create: `frontend/CLAUDE.md`

- [ ] **Step 1: Create root CLAUDE.md**

```markdown
# Calendfree

Round-Robin Scheduling Platform — Calendly replacement with Google Workspace integration.

## Architecture

Monorepo with three packages:
- `shared/` — Zod schemas and TypeScript types used by both frontend and backend
- `backend/` — Fastify REST API (TypeScript)
- `frontend/` — React SPA (Vite + Tailwind CSS)

## Tech Stack

- **Runtime**: Node.js 22+
- **Language**: TypeScript (strict mode)
- **Backend**: Fastify 5, Prisma ORM, PostgreSQL 16, Redis 7, pg-boss
- **Frontend**: React 19, Vite, Tailwind CSS, React Router
- **Auth**: Google OAuth 2.0 + Redis-backed sessions + API Keys
- **Validation**: Zod (shared schemas between frontend and backend)
- **Testing**: Vitest (unit/integration), Playwright (E2E)

## Key Commands

```bash
npm run dev              # Start both backend and frontend
npm run test             # Run all tests
npm run db:migrate       # Run Prisma migrations
npm run db:generate      # Regenerate Prisma client
docker compose up -d     # Start PostgreSQL and Redis
```

## Conventions

- All shared types and validation schemas live in `shared/src/schemas/`
- Every API endpoint must have a Zod schema for request validation
- Google OAuth tokens are AES-256-GCM encrypted in the database
- All DB queries must include tenant context (organizationId/companyId)
- Commits follow conventional commits: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`
- JSDoc on all exported functions and interfaces

## Environment

Copy `.env.example` to `backend/.env` for local development. Required variables:
- `DATABASE_URL` — PostgreSQL connection string
- `REDIS_URL` — Redis connection string
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — Google OAuth credentials
- `SESSION_SECRET` — 32+ char random string for session signing
- `ENCRYPTION_KEY` — 32-byte hex key for AES-256-GCM token encryption
```

- [ ] **Step 2: Create backend CLAUDE.md**

```markdown
# Calendfree Backend

Fastify REST API with TypeScript, Prisma, and Google Workspace integration.

## Structure

```
src/
├── app.ts              # Fastify app factory (plugin registration)
├── server.ts           # Entry point
├── config.ts           # Environment validation (Zod)
├── db.ts               # Prisma client singleton
├── redis.ts            # Redis client singleton
├── routes/             # Route handlers (one file per resource)
│   └── auth.ts         # Google OAuth + session routes
├── services/           # Business logic (one file per domain)
│   └── google-auth.ts  # Google OAuth service
├── middleware/          # Fastify preHandlers
│   ├── auth.ts         # requireAuth, requireRole
│   └── tenant.ts       # Tenant isolation (org/company scoping)
├── plugins/            # Fastify plugins
│   └── session.ts      # Redis session plugin
├── jobs/               # pg-boss job handlers
└── utils/              # Utilities
    └── encryption.ts   # AES-256-GCM encrypt/decrypt
```

## Patterns

### Adding a new route
1. Create `src/routes/<resource>.ts` with a Fastify plugin function
2. Define Zod schemas in `shared/src/schemas/<resource>.ts`
3. Register the route plugin in `src/app.ts`
4. Write tests in `src/__tests__/<resource>.test.ts`

### Adding a new service
1. Create `src/services/<name>.ts` with exported functions
2. Services receive dependencies (prisma, redis) as parameters or import singletons
3. Services never access `request` or `reply` — they return data, routes handle HTTP

### Middleware chain
`Request → Rate Limiter → Session → Auth (requireAuth/requireRole) → Tenant Isolation → Route Handler`

### Database access
- Always use `prisma` singleton from `src/db.ts`
- All queries for tenant-scoped data MUST filter by `organizationId` (and `companyId` where applicable)
- Use transactions for multi-step operations: `prisma.$transaction([...])`
- Use `SELECT FOR UPDATE` via raw queries for round-robin concurrency

### Testing
- Use `buildApp()` + `app.inject()` for route tests (no real HTTP server needed)
- `vitest` with `--run` for CI, `vitest` (watch mode) for development
- Mock Google API calls in tests, never hit real Google APIs
```

- [ ] **Step 3: Create frontend CLAUDE.md**

```markdown
# Calendfree Frontend

React SPA with Vite, Tailwind CSS, and TypeScript.

## Structure

```
src/
├── App.tsx             # Root component with router
├── main.tsx            # Entry point
├── index.css           # Tailwind imports
├── pages/              # Page components (one per route)
│   ├── booking/        # Public booking pages
│   ├── routing/        # Routing form pages
│   ├── manage/         # Cancel/reschedule pages
│   ├── admin/          # Org-admin panel
│   ├── company/        # Company-admin panel
│   └── dashboard/      # User dashboard
├── components/         # Reusable UI components
│   ├── calendar/       # Slot picker, availability display
│   ├── forms/          # Form components
│   ├── layout/         # Nav, sidebar, branded wrapper
│   └── embed/          # Embed widget component
└── api/                # API client functions
```

## Patterns

### API calls
- All API calls go through functions in `src/api/`
- Use `fetch` with `credentials: 'include'` for session cookies
- Vite proxy forwards `/api` to backend in development

### Styling
- Tailwind CSS utility classes only — no custom CSS files except `index.css`
- Use Tailwind's design tokens for colors, spacing, typography
- Branding colors are loaded from the API and applied via CSS custom properties

### Components
- Prefer functional components with hooks
- Keep components small and focused (< 150 lines)
- Shared state via React Context where needed, local state preferred

### Pages
- Each route maps to a page component in `src/pages/`
- Pages fetch their own data (no global data loading)
- Error and loading states handled per-page
```

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md backend/CLAUDE.md frontend/CLAUDE.md
git commit -m "docs: add CLAUDE.md files for root, backend, and frontend"
```

---

### Task 11: Create Audit Log Service

**Files:**
- Create: `backend/src/services/audit-log.ts`

- [ ] **Step 1: Create audit log service**

```typescript
// backend/src/services/audit-log.ts
import { prisma } from '../db.js';
import type { AuditAction } from '@prisma/client';

/** Log an auditable action. Non-blocking — fire and forget. */
export function logAudit(params: {
  userId?: string;
  action: AuditAction;
  details?: Record<string, unknown>;
  ipAddress?: string;
}): void {
  // Fire and forget — audit logging should never block a request
  prisma.auditLog.create({ data: params }).catch((err) => {
    console.error('Audit log write failed:', err);
  });
}
```

- [ ] **Step 2: Add audit logging to auth routes**

In `backend/src/routes/auth.ts`, add after successful login:
```typescript
import { logAudit } from '../services/audit-log.js';

// In handleCallback success path:
logAudit({
  userId: sessionUser.id,
  action: 'USER_LOGIN',
  ipAddress: request.ip,
});

// In logout handler:
logAudit({
  userId: request.session.user?.id,
  action: 'USER_LOGOUT',
  ipAddress: request.ip,
});
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/services/audit-log.ts backend/src/routes/auth.ts
git commit -m "feat: add audit log service with login/logout tracking"
```

---

### Task 12: Final Integration Test

**Files:**
- Create: `backend/src/__tests__/integration.test.ts`

- [ ] **Step 1: Write integration test**

```typescript
// backend/src/__tests__/integration.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../app.js';
import type { FastifyInstance } from 'fastify';

describe('Phase 1 Integration', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('health check reports all services ok', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe('ok');
    expect(body.services.database).toBe(true);
    expect(body.services.redis).toBe(true);
  });

  it('swagger docs are accessible', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/docs/json' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.openapi).toBeDefined();
    expect(body.info.title).toBe('Calendfree API');
  });

  it('unauthenticated /api/auth/me returns 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/auth/me' });
    expect(res.statusCode).toBe(401);
  });

  it('oauth redirect points to Google', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/auth/google' });
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toContain('accounts.google.com');
    expect(res.headers.location).toContain('calendar');
    expect(res.headers.location).toContain('gmail');
  });
});
```

- [ ] **Step 2: Run all tests**

```bash
cd calendfree && npm run test
```

Expected: All tests pass.

- [ ] **Step 3: Verify frontend starts and shows landing page**

```bash
cd calendfree && npm run dev
```

Open http://localhost:5173 — verify "Calendfree" heading renders.
Open http://localhost:3001/api/health — verify JSON health response.
Open http://localhost:3001/api/docs — verify Swagger UI loads.

- [ ] **Step 4: Final commit**

```bash
git add .
git commit -m "test: add Phase 1 integration test suite"
```

---

## Verification Checklist

After completing all tasks, verify:

1. **`docker compose up -d`** starts PostgreSQL and Redis
2. **`npm run dev`** starts both backend (3001) and frontend (5173)
3. **`/api/health`** returns `{ status: "ok", services: { database: true, redis: true } }`
4. **`/api/docs`** shows Swagger UI with all endpoints
5. **`/api/auth/google`** redirects to Google OAuth consent screen
6. **`/api/auth/me`** returns 401 when not logged in
7. **`npm run test`** all tests pass
8. **Prisma Studio** shows correct schema: `npx -w backend prisma studio`
9. **CLAUDE.md** files exist at root, backend, and frontend
10. **Seed data** includes organization, two companies, and admin user
