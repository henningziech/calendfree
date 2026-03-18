# Event Type Notification System — Design Spec

## Overview

Notification-Einstellungen leben auf dem **EventType** (Terminplaner). Pro EventType können 5 Notification-Typen einzeln aktiviert und konfiguriert werden. Default: alle aus. Mails gehen nur an den Kunden, nicht an den Consultant.

## Notification Types

| Typ | Timing | Default |
|-----|--------|---------|
| Bestätigung | Sofort nach Buchung | Aus |
| Absage | Sofort bei Stornierung | Aus |
| Erinnerung 1 | Konfigurierbar: 48h / **24h** / 12h / 6h / 2h vor Termin | Aus |
| Erinnerung 2 | Konfigurierbar: 4h / 2h / **1h** / 30min / 15min vor Termin | Aus |
| Follow-Up | Konfigurierbar: **30min** / 1h / 2h / 6h / 24h nach Termin | Aus |

**Fett** = Default-Wert wenn aktiviert.

## Template System

- Jeder Typ hat Subject + Body (Plaintext mit Handlebars-Variablen, kein HTML)
- Wenn Subject/Body leer (null): Standard-Templates in Company-Sprache (`de`/`en`)
- Custom-Body-Text wird mit Newlines → `<br>` konvertiert und in HTML-Branding-Wrapper eingebettet
- Admin editiert nur den Textinhalt, nicht das Layout
- "Auf Standard zurücksetzen"-Button setzt Subject/Body auf `null` zurück

### Verfügbare Template-Variablen

| Variable | Beschreibung | Beispiel |
|----------|-------------|---------|
| `{{customerName}}` | Name des Kunden | Max Mustermann |
| `{{customerEmail}}` | E-Mail des Kunden | max@example.com |
| `{{eventTypeTitle}}` | Titel des Terminplaners | Erstgespräch |
| `{{consultantName}}` | Name des Consultants | Anna Schmidt |
| `{{consultantEmail}}` | E-Mail des Consultants | anna@seibert.group |
| `{{reminderText}}` | Erinnerungszeitraum (nur Reminder) | 24 Stunden / 1 Stunde |
| `{{dateTime}}` | Formatierter Termin | 20. März 2026, 14:00 Uhr |
| `{{duration}}` | Dauer in Minuten | 30 |
| `{{meetLink}}` | Google Meet Link (wenn vorhanden) | https://meet.google.com/... |
| `{{cancelUrl}}` | Stornierungs-Link | https://app.calendfree.de/manage/.../cancel |
| `{{rescheduleUrl}}` | Umbuchungs-Link | https://app.calendfree.de/manage/.../reschedule |
| `{{companyName}}` | Firmenname | Seibert Group |

## Datenmodell

Neues Prisma-Model `NotificationConfig` als 1:1-Relation auf `EventType`:

```prisma
model NotificationConfig {
  id               String  @id @default(uuid())
  eventTypeId      String  @unique
  eventType        EventType @relation(fields: [eventTypeId], references: [id], onDelete: Cascade)

  // Bestätigung
  confirmationEnabled  Boolean @default(false)
  confirmationSubject  String?
  confirmationBody     String?

  // Absage
  cancellationEnabled  Boolean @default(false)
  cancellationSubject  String?
  cancellationBody     String?

  // Erinnerung 1
  reminder1Enabled     Boolean @default(false)
  reminder1Timing      String  @default("24h")  // 48h, 24h, 12h, 6h, 2h
  reminder1Subject     String?
  reminder1Body        String?

  // Erinnerung 2
  reminder2Enabled     Boolean @default(false)
  reminder2Timing      String  @default("1h")   // 4h, 2h, 1h, 30min, 15min
  reminder2Subject     String?
  reminder2Body        String?

  // Follow-Up
  followUpEnabled      Boolean @default(false)
  followUpTiming       String  @default("30min") // 30min, 1h, 2h, 6h, 24h
  followUpSubject      String?
  followUpBody         String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

Timing-Werte als String gespeichert, im Backend in Millisekunden konvertiert.

Auf dem `EventType`-Model muss die Rück-Relation ergänzt werden:
```prisma
// In model EventType:
notificationConfig NotificationConfig?
```

### Migration bestehender EventTypes

Da Notifications bisher hardcoded immer feuern (ohne Config), ist das Deployment ein **bewusster Breaking Change**: Nach dem Deploy sind alle Notifications aus, bis ein Admin sie pro EventType aktiviert. Das ist gewollt — der aktuelle Zustand (alle Notifications immer an, ohne Opt-in) ist nicht der gewünschte Endzustand. Bestehende EventTypes bekommen **keine** auto-generierten Config-Rows.

## Shared Zod Schema

In `shared/src/schemas/admin.ts` ein neues Schema `NotificationConfigSchema` definieren:

```typescript
export const Reminder1TimingSchema = z.enum(['48h', '24h', '12h', '6h', '2h']);
export const Reminder2TimingSchema = z.enum(['4h', '2h', '1h', '30min', '15min']);
export const FollowUpTimingSchema = z.enum(['30min', '1h', '2h', '6h', '24h']);

export const UpdateNotificationConfigSchema = z.object({
  confirmationEnabled: z.boolean(),
  confirmationSubject: z.string().max(200).nullable(),
  confirmationBody: z.string().max(5000).nullable(),
  cancellationEnabled: z.boolean(),
  cancellationSubject: z.string().max(200).nullable(),
  cancellationBody: z.string().max(5000).nullable(),
  reminder1Enabled: z.boolean(),
  reminder1Timing: Reminder1TimingSchema,
  reminder1Subject: z.string().max(200).nullable(),
  reminder1Body: z.string().max(5000).nullable(),
  reminder2Enabled: z.boolean(),
  reminder2Timing: Reminder2TimingSchema,
  reminder2Subject: z.string().max(200).nullable(),
  reminder2Body: z.string().max(5000).nullable(),
  followUpEnabled: z.boolean(),
  followUpTiming: FollowUpTimingSchema,
  followUpSubject: z.string().max(200).nullable(),
  followUpBody: z.string().max(5000).nullable(),
});
```

## API Endpoints

### GET /api/admin/event-types/:id/notifications

Gibt die `NotificationConfig` für den EventType zurück. Wenn keine existiert, Default-Werte zurückgeben (alle disabled).

### PUT /api/admin/event-types/:id/notifications

Erstellt oder aktualisiert die `NotificationConfig` (upsert). Validierung:
- Timing-Werte müssen aus den erlaubten Optionen kommen
- Subject max 200 Zeichen, Body max 5000 Zeichen
- Org-Isolation: EventType muss zur Organisation des Users gehören

### POST /api/admin/event-types/:id/notifications/preview

Rendert ein Preview einer Mail mit Beispieldaten. Request-Body:
```json
{
  "type": "confirmation" | "cancellation" | "reminder1" | "reminder2" | "followUp",
  "subject": "optionaler Draft-Subject (wenn null: gespeicherter/Standard-Wert)",
  "body": "optionaler Draft-Body (wenn null: gespeicherter/Standard-Wert)"
}
```
Gibt gerenderten HTML-String zurück. Ermöglicht Live-Vorschau während der Bearbeitung.

## Backend-Änderungen

### notification-jobs.ts

`scheduleBookingNotifications()` bekommt `eventTypeId` als zusätzlichen Parameter und lädt die `NotificationConfig`:
- Nur Jobs für aktivierte Typen erstellen
- Timing aus Config statt hardcoded (24h/1h/30min)
- Wenn keine Config existiert oder Typ disabled: Job nicht schedulen

`cancelBookingNotifications()` muss ebenfalls die Config prüfen: nur Absage-Mail senden wenn `cancellationEnabled === true`.

### templates.ts

- Standard-Templates in `de` und `en` (aktuell nur `de`)
- Neue Funktion `renderNotificationEmail(type, config, vars, branding, language)`:
  - Wenn Custom-Subject/Body in Config: diese mit Handlebars rendern
  - Wenn null: Standard-Template in `language` verwenden
  - Branding-Wrapper (Logo, Farben) immer drumrum legen

### notifications.ts

- `getTemplateVars()` muss `meetLink` korrekt liefern (nicht immer null)
- Datumsformatierung basierend auf Company-Language (nicht hardcoded `de`)

### booking.ts

- `meetLink` auf dem Booking-Model speichern (neues Feld `meetLink String?`)
- Bei Calendar-Event-Erstellung den Meet-Link persistieren

## Frontend-Änderungen

### EventType-Detail-Seite — Neuer "Benachrichtigungen" Tab

Aufklappbare Karten pro Notification-Typ:

```
[Toggle] Bestätigung                    [Vorschau]
  ▼ Bearbeiten
  Betreff: [_________________________]
  Text:    [_________________________]
           [_________________________]
           Verfügbar: {{customerName}} {{dateTime}} {{meetLink}} ...

[Toggle] Absage                         [Vorschau]
  ▼ Bearbeiten (gleiche Struktur)

[Toggle] Erinnerung 1  Timing: [24h ▼]  [Vorschau]
  ▼ Bearbeiten (gleiche Struktur)

[Toggle] Erinnerung 2  Timing: [1h ▼]   [Vorschau]
  ▼ Bearbeiten (gleiche Struktur)

[Toggle] Follow-Up     Timing: [30min ▼] [Vorschau]
  ▼ Bearbeiten (gleiche Struktur)
```

- Toggle aktiviert/deaktiviert den Typ
- Timing-Dropdown nur bei Erinnerungen und Follow-Up
- "Bearbeiten" klappt Subject+Body auf
- Variablen-Leiste unter dem Body: Klick kopiert `{{variable}}` an Cursor-Position
- "Vorschau" sendet Draft-Subject/Body an Preview-API und zeigt gerendertes HTML im Modal
- Wenn Subject/Body leer: Platzhalter zeigt Standard-Template-Text an
- "Auf Standard zurücksetzen"-Link unter den Feldern setzt Subject/Body auf null

### i18n

Neue Translation-Keys in `en/admin.json` und `de/admin.json` für:
- Notification-Typ-Labels
- Toggle-Labels
- Timing-Optionen
- Variablen-Beschreibungen
- Platzhalter-Texte

## Was sich NICHT ändert

- Email-Versand bleibt über Gmail API des Consultants
- pg-boss Job-Queue Infrastruktur bleibt
- Retry-Logik (3 Retries, exponential backoff) bleibt
- Company-Branding-System bleibt

## Rescheduling

Wenn ein Termin umgebucht wird (neues Booking erstellt), greift die gleiche Logik: `scheduleBookingNotifications()` prüft die `NotificationConfig` des EventTypes. Alte Jobs des stornierten Bookings werden durch Status-Check (`RESCHEDULED`) übersprungen — das bestehende Verhalten bleibt.

## Abhängigkeiten / Vorbedingungen

- Meet-Link muss auf Booking-Model gespeichert werden (neues Feld `meetLink String?`, aktuell nicht persistiert)
- Standard-Templates müssen in `en` übersetzt werden (aktuell nur `de`)
- `EventType`-Model braucht die Rück-Relation `notificationConfig NotificationConfig?`
