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
