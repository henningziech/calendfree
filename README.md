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

[MIT](LICENSE) — free to use, modify, and distribute.
