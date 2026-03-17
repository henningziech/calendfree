---
sidebar_position: 4
---

# Availability

Each user has an availability configuration that controls when they can receive bookings. The availability system combines several layers to determine open slots.

## Weekly schedule

The weekly schedule defines the user's regular working hours as a JSON object mapping weekday names to time ranges:

```json
{
  "monday":    [{ "start": "09:00", "end": "17:00" }],
  "tuesday":   [{ "start": "09:00", "end": "17:00" }],
  "wednesday": [{ "start": "09:00", "end": "17:00" }],
  "thursday":  [{ "start": "09:00", "end": "17:00" }],
  "friday":    [{ "start": "09:00", "end": "17:00" }]
}
```

The default schedule is Monday through Friday, 09:00-17:00. Days not included in the object (e.g. `saturday`, `sunday`) have no available hours.

Multiple time ranges per day are supported for split schedules:

```json
{
  "monday": [
    { "start": "08:00", "end": "12:00" },
    { "start": "13:00", "end": "17:00" }
  ]
}
```

## Date-specific overrides

Override the weekly schedule for specific dates. Each entry maps a date (YYYY-MM-DD) to an array of time ranges:

```json
{
  "2026-03-25": [{ "start": "10:00", "end": "14:00" }],
  "2026-03-26": []
}
```

- A date with time ranges replaces the weekly schedule for that day.
- A date with an empty array (`[]`) means the user is unavailable that entire day.
- Dates not listed fall back to the weekly schedule.

## Vacation periods

Vacation periods block the user from receiving bookings for a date range (inclusive).

```bash
# Create a vacation
curl -X POST /api/me/vacations \
  -H "Content-Type: application/json" \
  -d '{
    "startDate": "2026-07-15",
    "endDate": "2026-07-30",
    "label": "Summer vacation"
  }'
```

| Field | Type | Description |
|-------|------|-------------|
| `startDate` | string | Start date (YYYY-MM-DD, inclusive) |
| `endDate` | string | End date (YYYY-MM-DD, inclusive, must be >= startDate) |
| `label` | string (optional) | Optional label (e.g. "Summer vacation", max 255 chars) |

### Vacation API

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/me/vacations` | List current and future vacations |
| `POST` | `/api/me/vacations` | Create vacation period |
| `DELETE` | `/api/me/vacations/:id` | Delete vacation period |

## Public holidays

The availability system supports country-based public holidays.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `holidayCountry` | string | `"de"` | Country code for holiday calendar (e.g. `de`, `at`, `ch`) |
| `blockedHolidays` | string[] | `null` | Specific holiday dates to block (YYYY-MM-DD format) |

When a `holidayCountry` is set, the system automatically blocks public holidays for that country. The `blockedHolidays` array can be used to manually block additional dates.

## Booking limits

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `maxPerDay` | integer | `8` | Maximum bookings per day (1-50, or `null` for unlimited) |
| `maxPerWeek` | integer | `30` | Maximum bookings per week (1-200, or `null` for unlimited) |

## Absence status

Users can set their status to mark themselves as temporarily unavailable:

| Status | Description |
|--------|-------------|
| `AVAILABLE` | User can receive bookings (default) |
| `ABSENT` | User is temporarily unavailable for booking assignment |

The absence can optionally include an end date (`absentUntil`), after which the status auto-resets to `AVAILABLE`.

### Set your own status

```bash
curl -X PATCH /api/me/status \
  -H "Content-Type: application/json" \
  -d '{ "status": "ABSENT", "absentUntil": "2026-04-01T00:00:00.000Z" }'
```

### Admin: set a user's status

```bash
curl -X PATCH /api/admin/users/{userId}/status \
  -H "Content-Type: application/json" \
  -d '{ "status": "ABSENT", "absentUntil": "2026-04-01T00:00:00.000Z" }'
```

## Update availability

Users update their own availability via:

```bash
curl -X PATCH /api/me/availability \
  -H "Content-Type: application/json" \
  -d '{
    "weeklySchedule": {
      "monday": [{ "start": "09:00", "end": "17:00" }],
      "tuesday": [{ "start": "09:00", "end": "17:00" }],
      "wednesday": [{ "start": "09:00", "end": "12:00" }],
      "thursday": [{ "start": "09:00", "end": "17:00" }],
      "friday": [{ "start": "09:00", "end": "15:00" }]
    },
    "maxPerDay": 6,
    "maxPerWeek": 25,
    "holidayCountry": "de",
    "dateSpecificHours": {
      "2026-04-10": []
    }
  }'
```

The availability config is created automatically when a user first logs in. Only the fields you provide are updated; omitted fields keep their current values.
