# Calendfree - Round-Robin Scheduling Platform

## Context

Die Seibert Group zahlt ~30k€/Jahr für Calendly, hauptsächlich wegen der Round-Robin-Funktion. Google Calendar Appointment Schedules bieten kein Round-Robin, und die API ist nicht erweiterbar (keine programmatische Steuerung der Appointment Schedule Engine). Calendfree ist eine Eigenentwicklung die Calendly vollständig ersetzt, mit Fokus auf Round-Robin-Scheduling, Multi-Company-Support und nahtloser Google Workspace Integration.

## Design-Prinzipien

- **Modular & Erweiterbar**: Jeder Service ist ein eigenständiges Modul mit klarem Interface. Neue Features (z.B. Zoom, SMS) lassen sich als neue Service-Module hinzufügen ohne bestehenden Code zu ändern.
- **Security-first**: Verschlüsselte Tokens, RBAC auf jeder Ebene, Audit-Logging aller sicherheitsrelevanten Aktionen, Input-Validation mit Zod, Tenant-Isolation.
- **Dokumentiert**: JSDoc-Kommentare auf allen public Interfaces, OpenAPI/Swagger für die REST API (auto-generiert), README pro Modul.
- **API-first**: Alle Funktionen sind über die REST API erreichbar. User können API-Keys generieren für programmatischen Zugriff.

## Tech Stack

- **Frontend**: React 19 + Vite + TypeScript + Tailwind CSS + React Router
- **Backend**: Fastify + TypeScript + @fastify/swagger (OpenAPI)
- **ORM**: Prisma
- **Database**: PostgreSQL
- **Auth**: Google OAuth 2.0 (Calendar + Gmail scopes) + API-Keys für programmatischen Zugriff
- **Email**: Gmail API (im Namen des zugewiesenen Users)
- **Video**: Google Meet (auto-generated)
- **Validation**: Zod (Schemas werden zwischen Frontend und Backend geteilt)
- **Testing**: Vitest + Playwright
- **Docs**: OpenAPI/Swagger (auto-generiert aus Fastify-Schemas)
- **Job Queue**: pg-boss (PostgreSQL-basiert, persistent, multi-instance safe)
- **Session**: Redis-backed sessions (@fastify/session + connect-redis)
- **Reverse Proxy**: Caddy (automatisches TLS, Custom Domains)
- **Monitoring**: Structured Logging (pino) + Sentry (Error Tracking)
- **Hosting**: Self-hosted (Docker Compose: App + PostgreSQL + Redis + Caddy)

## Architektur

```
┌──────────────────────────────────────┐
│         Frontend (React SPA)          │
│         Vite + Tailwind               │
├──────────────┬───────────────────────┤
│ Public Pages │   Admin Panel          │
│ - Buchung    │   - Org-Admin          │
│ - Cancel     │   - Company-Admin      │
│ - Reschedule │   - User Dashboard     │
│ - Routing    │                        │
└──────┬───────┴────────┬──────────────┘
       │                │
       ▼                ▼
┌──────────────────────────────────────┐
│      Backend (Fastify + TS)           │
├──────────────────────────────────────┤
│  Routes:                              │
│  - /api/auth       (Google OAuth)     │
│  - /api/booking    (public)           │
│  - /api/admin      (org/company)      │
│  - /api/teams      (CRUD + RR config) │
│  - /api/events     (event types)      │
│  - /api/routing    (routing forms)    │
│  - /api/stats      (analytics)        │
│  - /api/hubspot    (CRM sync)         │
├──────────────────────────────────────┤
│  Services:                            │
│  - RoundRobinService                  │
│  - CalendarService (Google API)       │
│  - NotificationService (Gmail API)    │
│  - AvailabilityService                │
│  - AnalyticsService                   │
│  - HubSpotService                     │
│  - RoutingService                     │
├──────────────────────────────────────┤
│  Jobs (pg-boss):                      │
│  - Erinnerungsmails (24h/1h vorher)   │
│  - Follow-up Mails (nach Meeting)     │
│  - Token Refresh                      │
│  - Analytics Aggregation              │
│  - HubSpot Sync (async)              │
└──────────┬───────────────────────────┘
           │
┌──────────▼───────────────────────────┐
│       PostgreSQL + Redis              │
│  PG: Organizations, Companies, Users, │
│  Teams, TeamMemberships, EventTypes,  │
│  Bookings, GoogleTokens, RoutingForms,│
│  RoutingRules, FollowUpTemplates,     │
│  ApiKeys, AuditLog, AnalyticsEvents   │
│  Redis: Sessions, Availability Cache  │
└──────────────────────────────────────┘
           │
┌──────────▼───────────────────────────┐
│       Caddy (Reverse Proxy)           │
│  - Auto-TLS (Let's Encrypt)          │
│  - Custom Domain Routing             │
│  - Static File Serving (Frontend)    │
└──────────────────────────────────────┘
```

## Projekt-Struktur

```
calendfree/
├── frontend/
│   └── src/
│       ├── pages/
│       │   ├── booking/       # Öffentliche Buchungsseite
│       │   ├── routing/       # Routing Form Seite
│       │   ├── manage/        # Cancel/Reschedule
│       │   ├── admin/         # Org-Admin Panel
│       │   ├── company/       # Company-Admin Panel
│       │   └── dashboard/     # User Dashboard
│       ├── components/
│       │   ├── calendar/      # Slot-Picker, Verfügbarkeitsanzeige
│       │   ├── forms/         # Buchungsformulare, Routing Forms
│       │   ├── layout/        # Nav, Sidebar, Branding
│       │   └── embed/         # Embed Widget Komponente
│       └── api/               # API Client
├── shared/                    # Shared Zod Schemas, Types, Constants
│   └── src/
│       ├── schemas/           # Zod Validation Schemas (Frontend + Backend)
│       └── types/             # TypeScript Types (generiert aus Prisma + Zod)
├── backend/
│   └── src/
│       ├── routes/
│       ├── services/          # Modulare Services mit klaren Interfaces
│       ├── models/
│       ├── jobs/
│       ├── middleware/        # Auth, Tenant-Isolation, Rate Limiting, API-Key
│       └── utils/
├── prisma/
│   └── schema.prisma
├── embed/                     # Standalone Embed Script
│   └── calendfree-embed.js
└── docker-compose.yml
```

## Datenmodell

### Hierarchie

```
Organization ("Seibert Group")          ← Org-Admin
├── Company ("Seibert Group GmbH")      ← Company-Admin
│   ├── Team "Sales DE"
│   │   ├── User A (weight: 40%)
│   │   └── User B (weight: 60%)
│   └── Team "Onboarding"
│       ├── User C
│       └── User D
├── Company ("Seibert Solutions GmbH")  ← Company-Admin
│   └── Team "Enterprise Consulting"
│       ├── User E
│       └── User F
└── ...
```

### Kern-Entitäten

```
Organization       1──n  Company
Organization       1──1  BrandingConfig (Default)
Company            1──n  Team
Company            1──n  EventType
Company            n──n  User (via CompanyMembership + Rolle pro Company)
Company            1──1  BrandingConfig (Override, optional)
Company            1──n  RoutingForm
Team               n──n  User (via TeamMembership + weight)
Team               1──1  RoundRobinConfig (mode, pointer)
EventType          n──1  Team (optional, für Team-Events)
EventType          n──1  User (optional, für persönliche Events)
EventType          1──n  Booking
EventType          1──n  FormField
Booking            n──1  User (zugewiesener User)
Booking            1──1  BookingFormData
User               1──1  GoogleTokens (OAuth: Calendar + Gmail)
User               1──1  AvailabilityConfig (Arbeitszeiten, Puffer, Limits)
RoutingForm        1──n  RoutingRule (Bedingung → EventType)
```

### Rollen & Berechtigungen

| Rolle | Berechtigungen |
|-------|---------------|
| **Org-Admin** | Alles. Companies CRUD, Company-Admins ernennen, globale Settings, globales Branding, org-weite Analytics |
| **Company-Admin** | Teams CRUD, Event Types CRUD, User einladen/zuweisen, Gewichtung setzen, Company-Branding, Routing Forms, Company Analytics, Follow-Up Templates, HubSpot-Config |
| **User** | Google Calendar verbinden, Arbeitszeiten/Puffer/Limits konfigurieren, eigene Buchungen sehen, persönliche Event Types verwalten, persönliche Buchungsseite an/aus |

**Wichtig**: Ein User kann Mitglied in mehreren Companies sein (z.B. jemand der für Group GmbH und Solutions GmbH arbeitet). Die `CompanyMembership` Tabelle bildet die n:m Beziehung ab. Rollen sind pro Company: ein User kann in Company A Admin und in Company B normaler User sein.

**Persönliche Buchungsseiten-Slugs**: Slugs werden pro Company generiert (z.B. `max-mustermann`). Eindeutigkeit wird innerhalb einer Company erzwungen. Bei Namenskollision: automatischer Suffix (`max-mustermann-2`).

## Buchungsflow

### Team-Buchung (Round-Robin)

```
1. Kunde öffnet: termine.seibert-solutions.de/erstgespraech
   (oder via Routing Form dorthin geleitet)
2. Frontend ruft GET /api/booking/{company-slug}/{event-type-slug}/slots
3. Backend:
   a. Findet EventType → Team → alle User des Teams
   b. Für jeden User: Google Calendar FreeBusy API
   c. Filtert nach: Arbeitszeiten, Puffer, Booking Limits
   d. Aggregiert verfügbare Slots (min. 1 User frei)
4. Kunde wählt Slot + füllt Formular aus
5. Frontend ruft POST /api/booking
6. Backend (innerhalb DB-Transaction mit Row Lock):
   a. RoundRobinService wählt User (SELECT FOR UPDATE auf RR Config)
   b. Prüft nochmal Verfügbarkeit via FreeBusy API
   c. Falls Slot belegt → nächster RR-Kandidat (max 3 Retries)
   d. Falls kein User verfügbar → 409 Conflict an Frontend ("Slot nicht mehr verfügbar")
   e. Speichert Booking in DB + Updated RR State (COMMIT)
   f. Erstellt Google Calendar Event (mit Meet Link) — bei Fehler: Booking bleibt, Event-Erstellung wird via pg-boss geretried
   g. Sendet Bestätigungsmail via Gmail API — bei Fehler: pg-boss Retry
   h. Queued: HubSpot Sync (async via pg-boss)
7. Cron Jobs:
   - 24h vorher: Erinnerungsmail
   - 1h vorher: Erinnerungsmail
   - Nach Meeting-Ende: Follow-up Mail
```

### Persönliche Buchung

```
1. Kunde öffnet: termine.seibert-solutions.de/max-mustermann
2. Sieht persönliche Event Types des Users
3. Wählt Event Type → sieht nur Slots dieses einen Users
4. Rest wie oben, aber ohne Round-Robin (direkte Zuweisung)
```

### Routing Form Flow

```
1. Kunde öffnet: termine.seibert-solutions.de/start
2. Sieht Routing Form: "Welches Thema?" → Dropdown/Radio
3. Antworten werden gegen RoutingRules geprüft
4. Redirect zu passendem Event Type / Buchungsseite
```

## Round-Robin Algorithmen

Jedes Team hat einen konfigurierbaren Round-Robin-Modus:

### Concurrency Control (gilt für alle Modi)
Alle Round-Robin-Zuweisungen nutzen `SELECT ... FOR UPDATE` Row-Level Lock auf der `RoundRobinConfig` Row des Teams. Das verhindert Race Conditions bei gleichzeitigen Buchungen:

```sql
BEGIN;
SELECT * FROM round_robin_config WHERE team_id = $1 FOR UPDATE;
-- Round-Robin-Logik (je nach Modus)
UPDATE round_robin_config SET ... WHERE team_id = $1;
INSERT INTO bookings ...;
COMMIT;
```

Zusätzlich: Optimistic Concurrency via `version` Column auf Bookings -- bei Conflict wird der Round-Robin-Durchlauf wiederholt (max 3 Retries).

### Sequential
- DB speichert `lastAssignedIndex` pro Team
- Nächster User = `(lastAssignedIndex + 1) % teamSize`
- Überspringt User die im gewählten Slot nicht verfügbar sind

### Least-busy
- Zählt Bookings pro User im aktuellen Zeitfenster (z.B. diese Woche)
- User mit wenigsten Bookings bekommt den Termin
- Bei Gleichstand: wer am längsten keinen Termin bekommen hat (`lastBookedAt`)

### Weighted
- Jeder User hat ein `weight` in der TeamMembership (z.B. 40, 30, 30)
- System trackt aktuelle prozentuale Verteilung
- User der am weitesten unter seinem Soll liegt, bekommt den Termin
- Bei Gleichstand: Random

## Verfügbarkeit

Pro User konfigurierbar:
- **Arbeitszeiten**: Wochentag → Zeitfenster (z.B. Mo-Fr 09:00-17:00)
- **Puffer vor/nach Termin**: z.B. 15min (wird von verfügbaren Slots abgezogen)
- **Booking Limits**: Max. Termine pro Tag / pro Woche
- **Google Calendar**: Belegte Zeiten via FreeBusy API (alle Kalender des Users)

- **Minimum Scheduling Notice**: z.B. "keine Buchung weniger als 4h im Voraus" (pro EventType)
- **Booking Window**: Wie weit im Voraus buchbar (z.B. 1 Woche bis 3 Monate, pro EventType)

Slot-Berechnung:
```
verfügbare_slots = arbeitszeiten
  ∩ NICHT(google_calendar_busy)
  ∩ NICHT(existierende_bookings + puffer)
  ∩ booking_limit_nicht_erreicht
  ∩ innerhalb_booking_window
  ∩ nach_minimum_scheduling_notice
```

### Timezone-Handling
- Alle Zeiten in DB: **UTC**
- Jeder User speichert seine IANA Timezone (z.B. `Europe/Berlin`)
- Arbeitszeiten werden relativ zur User-Timezone interpretiert
- Buchungsseite erkennt Timezone des Kunden (via `Intl.DateTimeFormat().resolvedOptions().timeZone`)
- Kunde kann Timezone manuell ändern auf der Buchungsseite
- Slot-Anzeige erfolgt in der Timezone des Kunden
- Booking Limits ("max pro Tag") beziehen sich auf den Tag in der User-Timezone

## E-Mail (Gmail API)

Alle E-Mails werden über die Gmail API des zugewiesenen Users gesendet:

- **Bestätigung**: Sofort nach Buchung an Kunde + User
- **Erinnerung**: 24h und 1h vor dem Termin
- **Stornierung**: Bei Cancel/Reschedule
- **Follow-up**: Konfigurierbar nach Meeting-Ende (Template pro EventType)

OAuth Scope: `https://www.googleapis.com/auth/gmail.send`

Templates sind pro Company/EventType konfigurierbar mit Variablen:
`{{customerName}}`, `{{consultantName}}`, `{{dateTime}}`, `{{meetLink}}`, `{{cancelUrl}}`, `{{rescheduleUrl}}`

## Branding

Zwei Ebenen:
1. **Organization Default**: Logo, Primärfarbe, Akzentfarbe, Font
2. **Company Override** (optional): Überschreibt einzelne oder alle Werte

Buchungsseite rendert das Branding der jeweiligen Company (oder Org-Default als Fallback).

## Custom Domains

Jede Company kann eine eigene Domain konfigurieren:
- Company-Admin trägt Domain ein (z.B. `termine.seibert-solutions.de`)
- Backend prüft DNS (CNAME muss auf `calendfree.example.com` zeigen) bevor Domain aktiviert wird
- Caddy Reverse Proxy: On-Demand TLS — Zertifikat wird automatisch beim ersten Request via Let's Encrypt ausgestellt
- Backend prüft `Host`-Header → resolved zur richtigen Company
- Caddy-Config wird via API dynamisch aktualisiert wenn Domains hinzugefügt/entfernt werden

## Embed Widget

Ein leichtgewichtiges JavaScript-Snippet zum Einbetten auf externen Websites:

```html
<script src="https://calendfree.example.com/embed.js"
        data-company="seibert-solutions"
        data-event-type="erstgespraech"
        data-mode="popup">  <!-- oder "inline" -->
</script>
```

Zwei Modi:
- **Popup**: Button der ein Modal mit der Buchungsseite öffnet
- **Inline**: iFrame direkt in der Seite

## HubSpot-Integration

Pro Company konfigurierbar. Komplett asynchron via pg-boss Job Queue (Buchung wird nie durch HubSpot-Fehler blockiert):

- HubSpot API Key / OAuth Token (verschlüsselt gespeichert)
- Bei neuer Buchung (async):
  - Contact in HubSpot finden oder erstellen (via E-Mail)
  - Activity/Meeting erstellen
  - Optional: Deal erstellen oder bestehenden Deal updaten
- Bei Stornierung (async): Activity updaten
- **Fehlerhandling**: 3 Retries mit Exponential Backoff. Nach finalem Fehler: Sync-Status "failed" in DB, sichtbar im Company-Admin Panel. Manuelle Retry-Option.
- **Rate Limiting**: Respektiert HubSpot API Limits (100 Requests/10s)

## Analytics Dashboard

### Org-Admin sieht:
- Buchungen über alle Companies (Trend, Vergleich)
- Top Event Types, Top Teams
- Gesamtauslastung

### Company-Admin sieht:
- Buchungen pro Team, pro User
- Round-Robin-Verteilung (ist die Gewichtung fair?)
- No-Show-Rate (Booking erstellt aber Meeting nicht stattgefunden)
- Beliebteste Slots (Wochentage, Uhrzeiten)
- Cancel/Reschedule-Rate

### User sieht:
- Eigene Buchungen (kommend, vergangen, storniert)
- Persönliche Statistiken

## Cancel / Reschedule

- Bestätigungsmail enthält eindeutige Links: `/manage/{bookingToken}/cancel` und `/manage/{bookingToken}/reschedule`
- **Cancel**: Booking wird als cancelled markiert, Google Calendar Event gelöscht, Benachrichtigung an beide Seiten
- **Reschedule**: Neuer Slot wählen → gleicher User wenn verfügbar, sonst neuer Round-Robin-Durchlauf. Altes Event wird gelöscht, neues erstellt.
- Optional: Mindestvorlaufzeit für Cancel/Reschedule (z.B. 24h vorher)

## Google OAuth Flow

Ein einziger OAuth-Consent für alle benötigten Scopes:

```
Scopes:
- https://www.googleapis.com/auth/calendar.readonly    (FreeBusy)
- https://www.googleapis.com/auth/calendar.events       (Events CRUD)
- https://www.googleapis.com/auth/gmail.send             (E-Mails senden)
- https://www.googleapis.com/auth/userinfo.email         (User-Identifikation)
- https://www.googleapis.com/auth/userinfo.profile       (Name, Bild)
```

Tokens werden verschlüsselt in der DB gespeichert. Refresh Token wird automatisch erneuert (Cron Job prüft Ablauf).

## Public API & API-Keys

User können in ihrem Dashboard API-Keys generieren für programmatischen Zugriff:

### API-Key Management
- User generiert API-Key im Dashboard (Name + optionales Ablaufdatum)
- Key wird einmalig angezeigt, danach nur noch Hash in DB
- Keys können deaktiviert/gelöscht werden
- Rate Limiting pro API-Key (konfigurierbar)

### Verfügbare Endpoints (mit API-Key)
- `GET /api/v1/me/bookings` — Eigene Buchungen abrufen (kommend, vergangen)
- `GET /api/v1/me/availability` — Eigene Verfügbarkeit abfragen
- `GET /api/v1/me/event-types` — Eigene Event Types auflisten
- `PATCH /api/v1/me/availability` — Arbeitszeiten/Puffer/Limits ändern
- `POST /api/v1/bookings/{id}/cancel` — Buchung stornieren
- Für Company-Admins zusätzlich: Team- und User-Endpoints

### Auth-Header
```
Authorization: Bearer cf_live_xxxxxxxxxxxx
```

### API-Dokumentation
- OpenAPI/Swagger UI unter `/api/docs`
- Auto-generiert aus Fastify-Route-Schemas
- Interaktives "Try it out" mit API-Key

## Sicherheit

- **Tenant Isolation**: Alle DB-Queries enthalten `organizationId` / `companyId` Filter
- **RBAC Middleware**: Prüft Rolle + Zugehörigkeit vor jedem Admin-Endpoint
- **API-Key Auth**: Gehashte Keys (SHA-256), Scoped auf User-Ebene, Rate Limited
- **Rate Limiting**: Auf Booking-Endpoints und API-Endpoints (verhindert Spam/Abuse)
- **CSRF Protection**: Auf allen State-ändernden Endpoints (Session-basiert)
- **Token Encryption**: Google OAuth Tokens mit AES-256 verschlüsselt in DB. Encryption Key via Environment Variable (`ENCRYPTION_KEY`). Key Rotation: neuer Key wird als `ENCRYPTION_KEY_NEW` gesetzt, Background Job re-encrypts alle Tokens, danach wird der alte Key entfernt.
- **Booking Tokens**: Kryptographisch sichere Random-Tokens. Cancel/Reschedule-Tokens laufen zum Meeting-Zeitpunkt ab (bzw. bei konfigurierter Mindestvorlaufzeit entsprechend früher). Separate "Booking ansehen"-Tokens laufen 30 Tage nach Meeting-Datum ab.
- **Input Validation**: Zod Schemas auf allen Endpoints (shared zwischen Frontend + Backend)
- **Audit Log**: Alle sicherheitsrelevanten Aktionen werden geloggt (Login, Token-Erstellung, Rollen-Änderungen, API-Key-Nutzung)
- **Helmet**: HTTP Security Headers (HSTS, CSP, X-Frame-Options)
- **Dependency Scanning**: npm audit in CI/CD Pipeline

## Error Handling & Logging

### Backend Error Handling
- **Structured Logging**: pino Logger mit JSON-Output, Request-ID Correlation, Log-Levels (debug, info, warn, error)
- **Error Tracking**: Sentry Integration für unerwartete Fehler (mit Source Maps)
- **Google API Fehler**: Retry mit Exponential Backoff (429, 503). Bei dauerhaftem Fehler: Booking wird als `pending_calendar_sync` markiert, pg-boss Job für Retry. User/Admin wird über fehlende Kalender-Sync benachrichtigt.
- **Gmail Fehler**: E-Mail-Versand ist non-blocking. Bei Fehler: pg-boss Retry. Nach 3 Fehlern: Fallback auf System-SMTP (konfigurierbar) oder Fehler im Admin-Panel sichtbar.
- **Token Revoked**: Wenn ein User seinen Google-Zugang entzieht, wird der User automatisch als "disconnected" markiert. Admin bekommt Notification. User wird aus Round-Robin ausgeschlossen bis er sich neu verbindet.

### Frontend Error Handling
- **Error Boundary**: React Error Boundary fängt unerwartete Fehler, zeigt benutzerfreundliche Fehlerseite
- **API Error Pages**: Dedizierte Fehlerseiten für:
  - 404: "Buchungsseite nicht gefunden" (falsche Company/Event Type)
  - 409: "Dieser Slot ist leider nicht mehr verfügbar" (Race Condition)
  - 410: "Dieser Buchungslink ist abgelaufen"
  - 503: "Der Service ist vorübergehend nicht erreichbar"
  - Generisch: "Etwas ist schiefgelaufen" mit Retry-Button
- **Toast Notifications**: Für transiente Fehler in Admin/Dashboard (z.B. "Speichern fehlgeschlagen")
- Alle Fehlerseiten sind gebrandit (Company-Branding)

### Health & Monitoring
- `GET /api/health` — Prüft DB-Verbindung, Redis, pg-boss
- `GET /api/health/detailed` (Admin-only) — Google API Quota Status, Job Queue Stats, Token Health
- Structured Logs an stdout (für Docker Logging Driver / ELK / Loki)

## Dokumentation

### Code-Dokumentation
- JSDoc-Kommentare auf allen exportierten Funktionen, Interfaces und Services
- Jedes Service-Modul hat eine kurze README.md die erklärt: Was macht es, wie benutzt man es, wovon hängt es ab
- Inline-Kommentare nur wo die Logik nicht selbsterklärend ist (z.B. Round-Robin-Algorithmen)

### API-Dokumentation
- OpenAPI/Swagger auto-generiert unter `/api/docs`
- Jeder Endpoint dokumentiert: Parameter, Request Body, Response, Fehler, Auth-Anforderung
- Beispiele für typische Flows (Buchung, Cancel, Round-Robin)

### CLAUDE.md Files
Bei Projekt-Setup werden drei CLAUDE.md Files erstellt:

1. **`/calendfree/CLAUDE.md`** (Root) — Projektübersicht, Architektur-Entscheidungen, Monorepo-Struktur, Shared Schemas, Konventionen
2. **`/calendfree/backend/CLAUDE.md`** — Backend-spezifisch: Service-Pattern, Route-Konventionen, Middleware-Chain, DB-Migration-Workflow, Test-Setup
3. **`/calendfree/frontend/CLAUDE.md`** — Frontend-spezifisch: Component-Patterns, State Management, API Client, Styling-Konventionen, Page-Struktur

## Session Management

- **Admin/Dashboard**: Cookie-basierte Sessions, gespeichert in Redis (`@fastify/session` + `connect-redis`)
- **Session Expiry**: 24h, mit Rolling Expiry (verlängert sich bei Aktivität)
- **Booking-Seiten**: Kein Login nötig (öffentlich). Cancel/Reschedule via signiertem Booking-Token.
- **API-Keys**: Stateless Auth via `Authorization: Bearer cf_live_...` Header. Kein Session nötig.
- **Auth Middleware Chain**: `Request → Rate Limiter → Session/API-Key Auth → RBAC Check → Tenant Isolation → Route Handler`

## DSGVO / Datenschutz

- **Buchungsseite**: Datenschutzhinweis vor Formular-Absendung (Link zur Datenschutzerklärung, konfigurierbar pro Company)
- **Datenminimierung**: Nur die im Formular definierten Felder werden gespeichert
- **Aufbewahrungsfristen**: Bookings werden nach konfigurierbarer Frist anonymisiert (Standard: 12 Monate nach Meeting)
- **Recht auf Löschung**: Admin-Endpoint zum Löschen aller Daten eines Kunden (E-Mail-basiert)
- **Datenexport**: Admin-Endpoint zum Export aller Booking-Daten als JSON/CSV
- **Rechtsgrundlage**: Verarbeitung auf Basis von Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung -- Kunde bucht aktiv einen Termin). Für Embed Widget auf Drittseiten: kein Cookie-Consent nötig da keine Tracking-Cookies gesetzt werden (nur funktionale Session für den Buchungsflow).
- **Auftragsverarbeitung**: Bei Nutzung durch mehrere Companies ggf. AV-Vertrag zwischen Org-Betreiber und Companies erforderlich (nicht Teil der Software, aber im Setup-Guide dokumentieren)

## Spätere Phasen (nicht MVP)

- Collective Meetings (alle Team-Mitglieder müssen verfügbar sein)
- Recurring Bookings (Terminserien)
- SMS-Erinnerungen (Twilio)
- Waiting List
- Zoom-Integration (zusätzlich zu Google Meet)
- Kalender-Sync mit Outlook/Exchange

## Verification

### Funktionale Tests
- Unit Tests: Round-Robin-Algorithmen, Slot-Berechnung, Routing-Logik
- Integration Tests: Google Calendar API Mocks, Booking Flow E2E
- E2E Tests: Playwright für kompletten Buchungsflow

### Manuelle Verification
1. Organisation + Company + Team + User anlegen
2. Google Calendar verbinden (OAuth Flow)
3. Event Type erstellen
4. Buchungsseite öffnen → Slot wählen → buchen
5. Prüfen: Google Calendar Event erstellt, Bestätigungsmail empfangen
6. Mehrere Buchungen → Round-Robin-Verteilung prüfen
7. Cancel/Reschedule testen
8. Embed Widget auf Test-Seite einbinden
9. Custom Domain konfigurieren
10. HubSpot-Sync prüfen
