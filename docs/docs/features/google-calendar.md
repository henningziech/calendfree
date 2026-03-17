---
sidebar_position: 8
---

# Google Calendar Integration

Calendfree integrates with Google Calendar to check user availability and create booking events. Google OAuth 2.0 is the primary authentication method for both user login and calendar access.

## OAuth connection

When a user logs in via Google, Calendfree requests the following OAuth scopes:

| Scope | Purpose |
|-------|---------|
| `userinfo.email` | Read the user's email address |
| `userinfo.profile` | Read the user's name and avatar |
| `calendar.readonly` | Read calendar events to detect busy times |
| `calendar.events` | Create and delete calendar events for bookings |
| `gmail.send` | Send booking notification emails |

The OAuth flow uses `access_type: offline` and `prompt: consent` to obtain a refresh token for background operations.

## Token storage

Google OAuth tokens are encrypted at rest using **AES-256-GCM** before being stored in the database:

- **Algorithm**: `aes-256-gcm`
- **IV**: 16 bytes, randomly generated per encryption
- **Auth tag**: 16 bytes
- **Storage format**: Base64-encoded concatenation of `IV + AuthTag + Ciphertext`
- **Key**: Derived from the `ENCRYPTION_KEY` environment variable (32-byte hex string)

Both the access token and refresh token are encrypted individually.

## Token refresh

Access tokens are automatically refreshed when they expire:

1. Before making a Calendar API request, the system checks the token's `expiresAt` timestamp (with a 5-minute buffer).
2. If expired, the refresh token is used to obtain a new access token from Google.
3. The new access token is encrypted and stored.
4. If the refresh fails (e.g. user revoked access), the Google connection is marked as `connected: false`.

Users with a disconnected Google account are excluded from booking assignment.

## Busy-time detection

When calculating available slots, Calendfree queries the user's primary Google Calendar for events:

```
GET /calendar/v3/calendars/primary/events
```

The query:
- Uses `singleEvents: true` to expand recurring events
- Orders by `startTime`
- Paginates through all events in the requested time range (up to 250 per page)
- Excludes cancelled events (`status: cancelled`)
- Excludes transparent events (`transparency: transparent`) -- these are "free" events that do not block time

All non-transparent, non-cancelled events are treated as busy time and block booking slots.

## Calendar event creation

When a booking is confirmed, Calendfree creates a Google Calendar event on the assigned user's primary calendar:

- **Summary**: `{Event Type Title} -- {Customer Name}`
- **Description**: Includes customer name, email, and optional comment
- **Attendees**: The customer's email is added as an attendee
- **Notifications**: `sendUpdates: all` -- Google sends email invitations to all attendees

### Google Meet links

If the event type has `autoMeetLink: true` (default), a Google Meet link is automatically generated using the Calendar API's conference data feature:

```json
{
  "conferenceData": {
    "createRequest": {
      "requestId": "calendfree-{timestamp}-{random}",
      "conferenceSolutionKey": { "type": "hangoutsMeet" }
    }
  }
}
```

The generated Meet link is returned in the booking response and can be shared with the customer.

## Calendar event deletion

When a booking is cancelled (by the customer or an admin), the associated Google Calendar event is deleted:

- Uses `sendUpdates: all` so attendees receive a cancellation notification
- If the calendar event was already deleted (404), the error is silently ignored
- Calendar event deletion failures do not block booking cancellation

## Error handling

Calendar operations are non-blocking -- if a Calendar API call fails:

- **On booking creation**: The booking is saved with status `PENDING_CALENDAR_SYNC` instead of `CONFIRMED`. The calendar event can be retried later.
- **On booking cancellation**: The booking is still marked as `CANCELLED` even if the calendar event deletion fails.
- All calendar errors are logged for debugging.

## Required environment variables

| Variable | Description |
|----------|-------------|
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `GOOGLE_REDIRECT_URI` | OAuth redirect URI (e.g. `http://localhost:3000/api/auth/google/callback`) |
| `ENCRYPTION_KEY` | 32-byte hex key for AES-256-GCM token encryption |
