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
