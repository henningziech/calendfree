---
sidebar_position: 1
---

# Setup Guide

Get Calendfree running locally for development.

## Prerequisites

- **Node.js 22+** and npm
- **Docker** and Docker Compose (for PostgreSQL and Redis)
- A **Google Cloud project** with OAuth 2.0 credentials (for calendar integration)

## 1. Clone and install

```bash
git clone <your-repo-url> calendfree
cd calendfree
npm install
```

This installs dependencies for all three workspaces (`shared/`, `backend/`, `frontend/`).

## 2. Start infrastructure

```bash
docker compose up -d
```

This starts:

- **PostgreSQL 16** on port `5432` (user: `calendfree`, password: `calendfree`, database: `calendfree`)
- **Redis 7** on port `6379`

## 3. Configure environment

Copy the example environment file and edit it:

```bash
cp backend/.env.example backend/.env
```

Required variables in `backend/.env`:

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string. Default: `postgresql://calendfree:calendfree@localhost:5432/calendfree` |
| `REDIS_URL` | Redis connection string. Default: `redis://localhost:6379` |
| `GOOGLE_CLIENT_ID` | OAuth 2.0 client ID from Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | OAuth 2.0 client secret |
| `GOOGLE_REDIRECT_URI` | OAuth callback URL. For local dev: `http://localhost:3001/api/auth/google/callback` |
| `SESSION_SECRET` | Random string, 32+ characters. Used for signing sessions. |
| `ENCRYPTION_KEY` | 64 hex characters (32 bytes). Used for AES-256-GCM encryption of OAuth tokens in the database. |

Optional variables:

| Variable | Default | Description |
|---|---|---|
| `BACKEND_URL` | `http://localhost:3001` | Public backend URL |
| `FRONTEND_URL` | `http://localhost:5173` | Public frontend URL |
| `PORT` | `3001` | Backend server port |
| `LOG_LEVEL` | `info` | Log level (`debug`, `info`, `warn`, `error`) |

### Email domain restriction

Organizations can restrict registration to specific email domains by configuring `allowedDomains` on the Organization model. When set, only users whose email address matches one of the allowed domains can sign up. This is configured via the organization admin API, not via environment variables.

For example, setting `allowedDomains` to `["example.com", "acme.org"]` would only allow users with `@example.com` or `@acme.org` email addresses to register.

### Generating secrets

```bash
# SESSION_SECRET
openssl rand -base64 48

# ENCRYPTION_KEY (64 hex chars = 32 bytes)
openssl rand -hex 32
```

### Google OAuth setup

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project (or use an existing one)
3. Enable the **Google Calendar API**
4. Under **Credentials**, create an **OAuth 2.0 Client ID** (type: Web application)
5. Add `http://localhost:3001/api/auth/google/callback` as an authorized redirect URI
6. Add `http://localhost:5173` as an authorized JavaScript origin
7. Copy the client ID and secret into your `.env`

## 4. Initialize the database

```bash
npm run db:migrate
npm run db:generate
```

`db:migrate` runs Prisma migrations to create all tables. `db:generate` regenerates the Prisma client.

## 5. Start development servers

```bash
npm run dev
```

This starts both servers concurrently:

- **Backend** (Fastify) at `http://localhost:3001`
- **Frontend** (Vite) at `http://localhost:5173`

The Vite dev server proxies `/api` requests to the backend automatically.

## 6. First login

Open `http://localhost:5173` and click **Sign in with Google**. This triggers the OAuth flow and creates your user account. You'll be redirected to the dashboard after authorization.

## Available scripts

| Command | Description |
|---|---|
| `npm run dev` | Start backend + frontend in dev mode |
| `npm run build` | Build all packages for production |
| `npm run test` | Run all tests (shared + backend) |
| `npm run lint` | Lint all packages |
| `npm run db:migrate` | Run Prisma database migrations |
| `npm run db:generate` | Regenerate Prisma client |
