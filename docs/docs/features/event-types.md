---
sidebar_position: 1
---

# Event Types

Event types define what kind of meetings your customers can book. Each event type has its own public booking page, scheduling rules, and optional custom form fields.

## Categories

Calendfree supports three event type categories:

| Category | Description | Assignment |
|----------|-------------|------------|
| **PERSONAL** | 1:1 meeting between customer and a single host | Assigned to the creating user |
| **TEAM** | Round-robin meeting distributed across team members | Requires a `teamId`; uses round-robin assignment |
| **GROUP** | One host, multiple invitees per time slot | Assigned to the creating user; requires `maxInvitees` |

### Validation rules

- **TEAM** event types must have a `teamId` set.
- **GROUP** event types require `maxInvitees` (minimum 2) and cannot have a `teamId`.
- **PERSONAL** event types have no team — the event is automatically assigned to the user who creates it.

## Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `title` | string | (required) | Display title (1-255 chars) |
| `slug` | string | (required) | URL slug (lowercase alphanumeric with hyphens) |
| `description` | string | -- | Optional description (max 2000 chars) |
| `duration` | integer | `30` | Duration in minutes (5-480) |
| `bufferBefore` | integer | `0` | Buffer time before event in minutes (0-120) |
| `bufferAfter` | integer | `0` | Buffer time after event in minutes (0-120) |
| `minNotice` | integer | `4` | Minimum notice in hours before booking (0-720) |
| `maxAdvance` | integer | `60` | How many days ahead can be booked (1-365) |
| `autoMeetLink` | boolean | `true` | Auto-generate a Google Meet link |
| `color` | string | `#2563EB` | Display color (hex, e.g. `#2563EB`) |
| `allowComment` | boolean | `false` | Show a free-text comment field on the booking form |
| `bookableHours` | JSON | `null` | Restrict which hours are bookable per weekday (see below) |
| `roundRobinMode` | enum | `SEQUENTIAL` | Round-robin mode (only used for TEAM events) |
| `eventCategory` | enum | `PERSONAL` | One of `PERSONAL`, `TEAM`, `GROUP` |

### Bookable hours

The `bookableHours` field restricts when slots are offered. If `null`, all hours are bookable (only Google Calendar busy times apply). Otherwise, provide a JSON object mapping weekday names to time ranges:

```json
{
  "monday": [{ "start": "09:00", "end": "12:00" }, { "start": "13:00", "end": "17:00" }],
  "tuesday": [{ "start": "09:00", "end": "17:00" }],
  "wednesday": [{ "start": "09:00", "end": "17:00" }],
  "thursday": [{ "start": "09:00", "end": "17:00" }],
  "friday": [{ "start": "09:00", "end": "16:00" }]
}
```

Days not listed in the object have no bookable hours.

## Custom form fields

Each event type can define custom form fields that the customer fills in when booking. Fields are ordered by their `order` property.

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `label` | string | (required) | Field label (1-255 chars) |
| `type` | enum | `text` | One of `text`, `email`, `phone`, `select`, `textarea` |
| `required` | boolean | `false` | Whether the field is mandatory |
| `options` | string[] | `[]` | Options for `select` type fields |

```json
{
  "formFields": [
    { "label": "Company", "type": "text", "required": true },
    { "label": "Phone number", "type": "phone", "required": false },
    { "label": "Department", "type": "select", "required": true, "options": ["Sales", "Support", "Other"] },
    { "label": "Additional info", "type": "textarea", "required": false }
  ]
}
```

:::note
Form fields are set at creation time. The update endpoint (`PATCH`) does not support modifying form fields — you need to delete and recreate the event type.
:::

## Group event settings

Group event types allow multiple customers to book the same time slot.

| Field | Type | Description |
|-------|------|-------------|
| `maxInvitees` | integer | Maximum invitees per slot (2-1000, required for GROUP) |
| `showRemainingSpots` | boolean | Show remaining spots on the public booking page |

Group bookings use a database transaction with `Serializable` isolation level to prevent overbooking.

## API endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/admin/companies/:companyId/event-types` | Create event type |
| `GET` | `/api/admin/companies/:companyId/event-types` | List event types |
| `GET` | `/api/admin/event-types/:id` | Get event type details |
| `PATCH` | `/api/admin/event-types/:id` | Update event type |
| `DELETE` | `/api/admin/event-types/:id` | Delete event type |
| `PATCH` | `/api/admin/event-types/:id/toggle` | Toggle active/inactive |

### Create example

```bash
curl -X POST /api/admin/companies/{companyId}/event-types \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Sales Demo",
    "slug": "sales-demo",
    "duration": 45,
    "bufferBefore": 5,
    "bufferAfter": 10,
    "minNotice": 24,
    "maxAdvance": 30,
    "eventCategory": "TEAM",
    "teamId": "team-uuid",
    "roundRobinMode": "LEAST_BUSY",
    "formFields": [
      { "label": "Company name", "type": "text", "required": true }
    ]
  }'
```

### Toggle active status

Event types can be activated or deactivated without deleting them. Inactive event types are not shown on public booking pages.

```bash
curl -X PATCH /api/admin/event-types/{id}/toggle
```
