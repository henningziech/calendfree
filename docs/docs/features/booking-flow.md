---
sidebar_position: 2
---

# Booking Flow

The booking flow covers how customers discover available time slots, submit a booking, and manage it afterward.

## Public booking page

Each event type has a public booking page at:

```
/{companySlug}/{eventTypeSlug}
```

The booking page displays the event type title, description, duration, custom form fields, and a calendar with available slots.

## Step-by-step flow

### 1. Get available slots

```
GET /api/booking/:companySlug/:eventTypeSlug/slots?date=2026-03-20&timezone=Europe/Berlin
```

- If `date` is provided, returns slots for that specific day.
- If `date` is omitted, returns slots for the next 7 days.
- `timezone` defaults to `Europe/Berlin`.
- For group events with `showRemainingSpots` enabled, each slot includes a `remainingSpots` count.

**Response:**

```json
{
  "slots": [
    { "start": "2026-03-20T09:00:00.000Z", "end": "2026-03-20T09:30:00.000Z" },
    { "start": "2026-03-20T09:30:00.000Z", "end": "2026-03-20T10:00:00.000Z", "remainingSpots": 4 }
  ]
}
```

Slot availability takes into account:
- The event type's bookable hours
- Each user's weekly schedule and availability config
- Google Calendar busy times (from connected accounts)
- Buffer times (before and after)
- Minimum notice and maximum advance settings
- Vacation periods and absence status
- Existing bookings

### 2. Get event type info

```
GET /api/booking/:companySlug/:eventTypeSlug/info
```

Returns the event type details for the booking form: title, description, duration, color, custom form fields, and whether comments are allowed.

### 3. Submit booking

```
POST /api/booking/:companySlug/:eventTypeSlug
```

**Request body:**

```json
{
  "startTime": "2026-03-20T09:00:00.000Z",
  "timezone": "Europe/Berlin",
  "name": "Jane Doe",
  "email": "jane@example.com",
  "comment": "Looking forward to it!",
  "formData": {
    "Company name": "Acme Corp"
  }
}
```

**What happens on submission:**

1. **Personal event types** -- the booking is assigned to the event type's owner.
2. **Team event types** -- the system re-checks slot availability and assigns a user via round-robin (see [Teams & Round-Robin](./teams-round-robin.md)).
3. **Group event types** -- the booking is created inside a `Serializable` transaction to prevent overbooking beyond `maxInvitees`.

All booking types use **serializable database transactions** with conflict checks to prevent double-booking of the same time slot.
4. A Google Calendar event is created on the assigned user's calendar (with optional Google Meet link).
5. Notification emails are scheduled.
6. A HubSpot sync job is queued (if configured).

**Response (201):**

```json
{
  "id": "booking-uuid",
  "startTime": "2026-03-20T09:00:00.000Z",
  "endTime": "2026-03-20T09:30:00.000Z",
  "assignedUser": { "name": "John Smith", "email": "john@example.com" },
  "meetLink": "https://meet.google.com/abc-defg-hij",
  "cancelUrl": "https://app.calendfree.com/manage/{token}/cancel",
  "rescheduleUrl": "https://app.calendfree.com/manage/{token}/reschedule"
}
```

### 4. Cancel a booking

Customers can cancel their booking using the token link included in the confirmation:

```
POST /api/booking/:bookingToken/cancel
```

- Cancellation deletes the associated Google Calendar event.
- Cancellation notification emails are sent.
- The cancel link expires at the meeting start time (`tokenExpiresAt`). After that, a `410 Gone` response is returned.

### 5. Get booking details

Customers can view their booking details via the token:

```
GET /api/booking/:bookingToken
```

Returns event type info, assigned consultant, customer data, and company branding for a styled confirmation page.

## Booking statuses

| Status | Description |
|--------|-------------|
| `CONFIRMED` | Booking is confirmed and active |
| `CANCELLED` | Booking was cancelled (by customer or admin) |
| `RESCHEDULED` | Booking was rescheduled to a new time |
| `NO_SHOW` | Customer did not show up (set by admin) |
| `COMPLETED` | Meeting was completed (set by admin) |
| `PENDING_CALENDAR_SYNC` | Calendar event creation failed; will be retried |

Admins can update booking status to `COMPLETED` or `NO_SHOW` via:

```
PATCH /api/me/bookings/:bookingId/status
```

## Booking tokens

Each booking receives a cryptographically secure 32-byte random token (generated with `crypto.randomBytes`). This token is used for:

- **Cancel links** -- `{FRONTEND_URL}/manage/{token}/cancel`
- **Reschedule links** -- `{FRONTEND_URL}/manage/{token}/reschedule`
- **Booking detail retrieval** -- `GET /api/booking/{token}`

Tokens expire at the meeting start time. After expiry, cancel and reschedule operations return `410 Gone`.

## Company info and branding

The public booking page fetches company info and branding:

```
GET /api/booking/:companySlug/info
```

This returns the company name, language preference, and branding configuration (colors, logo, fonts). See [Branding](./branding.md) for details.
