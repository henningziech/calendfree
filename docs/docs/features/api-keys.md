---
sidebar_position: 10
---

# API Keys

API keys let you access the Calendfree REST API programmatically -- for building integrations, automations, or custom booking flows.

## How they work

- API keys authenticate as the user who created them, with the same permissions
- The full key is shown **only once** at creation time. Calendfree stores a SHA-256 hash, not the key itself.
- Keys can have an optional expiration date
- Each key tracks its last-used timestamp

## Key format

All API keys follow this format:

```
cf_live_<64 hex characters>
```

Example: `cf_live_a1b2c3d4e5f6...`

The `cf_live_` prefix allows the middleware to quickly identify API key requests and distinguish them from other Bearer tokens.

## Creating an API key

### Via the UI

1. Go to **Dashboard > API Keys**
2. Click **Create API Key**
3. Enter a descriptive name (e.g., "n8n integration", "CI pipeline")
4. Optionally set an expiration date
5. Click **Create**
6. **Copy the key immediately** -- it will not be shown again

### Via the API

```bash
curl -X POST http://localhost:3001/api/me/api-keys \
  -H "Content-Type: application/json" \
  -H "Cookie: <session-cookie>" \
  -d '{"name": "My Integration"}'
```

Response:

```json
{
  "id": "uuid",
  "name": "My Integration",
  "key": "cf_live_a1b2c3d4...",
  "keyPrefix": "cf_live_a1b2c3d4",
  "expiresAt": null,
  "createdAt": "2026-03-17T10:00:00.000Z"
}
```

## Using API keys

Pass the key as a Bearer token in the `Authorization` header:

```bash
Authorization: Bearer cf_live_a1b2c3d4...
```

### Example: List your event types

```bash
curl http://localhost:3001/api/admin/event-types \
  -H "Authorization: Bearer cf_live_a1b2c3d4..."
```

### Example: List your bookings

```bash
curl http://localhost:3001/api/admin/bookings \
  -H "Authorization: Bearer cf_live_a1b2c3d4..."
```

### Example: Create a booking programmatically

```bash
curl -X POST http://localhost:3001/api/booking/acme/30min-consultation \
  -H "Content-Type: application/json" \
  -d '{
    "eventTypeSlug": "30min-consultation",
    "startTime": "2026-03-20T14:00:00.000Z",
    "timezone": "Europe/Berlin",
    "name": "Jane Doe",
    "email": "jane@example.com"
  }'
```

Note: The public booking endpoint does not require authentication. API keys are needed for admin endpoints (managing event types, viewing bookings, etc.).

## Listing keys

```bash
curl http://localhost:3001/api/me/api-keys \
  -H "Authorization: Bearer cf_live_a1b2c3d4..."
```

Returns all your API keys with their prefix, name, status, and last-used timestamp. The full key hash is never returned.

## Revoking a key

Delete a key by its ID to permanently revoke access:

```bash
curl -X DELETE http://localhost:3001/api/me/api-keys/<key-id> \
  -H "Authorization: Bearer cf_live_a1b2c3d4..."
```

Revocation is immediate. Any request using the revoked key will receive a `401 Unauthorized` response.

## Security notes

- Store API keys securely (environment variables, secret managers) -- never commit them to source control
- Use expiration dates for keys that are only needed temporarily
- Revoke keys you no longer need
- Each API key authenticates as the user who created it, including their organization and company context
- Inactive or expired keys are rejected with `401`
