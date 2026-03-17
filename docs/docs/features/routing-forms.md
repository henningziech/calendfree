---
sidebar_position: 5
---

# Routing Forms

Routing forms pre-qualify visitors before directing them to the right event type. A visitor answers a question with multiple-choice options, and each option routes them to an event type, a URL, or displays a message.

## How it works

1. A visitor opens the routing form URL: `/{companySlug}/route/{formSlug}`
2. The form shows a question with multiple-choice options.
3. Optionally, the visitor provides their name and/or email.
4. Based on the selected option, the visitor is:
   - Redirected to an **event type** booking page (with optional name/email pre-fill)
   - Redirected to an external **URL**
   - Shown a **message** (e.g. "Please contact us directly")
5. If the selected option is not found, the **fallback** target is used.

## Creating a routing form

```bash
curl -X POST /api/admin/routing-forms \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Book a Meeting",
    "slug": "book-meeting",
    "description": "Choose the type of meeting you need.",
    "question": "What are you interested in?",
    "collectName": true,
    "collectEmail": true,
    "fallbackType": "MESSAGE",
    "fallbackValue": "Please contact us directly at support@example.com.",
    "options": [
      {
        "label": "Sales Demo",
        "targetType": "EVENT_TYPE",
        "targetValue": "sales-demo",
        "order": 0
      },
      {
        "label": "Technical Support",
        "targetType": "EVENT_TYPE",
        "targetValue": "tech-support",
        "order": 1
      },
      {
        "label": "Partnerships",
        "targetType": "URL",
        "targetValue": "https://example.com/partnerships",
        "order": 2
      },
      {
        "label": "Something else",
        "targetType": "MESSAGE",
        "targetValue": "Please email us at hello@example.com and we will get back to you.",
        "order": 3
      }
    ]
  }'
```

## Configuration

### Form fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `title` | string | (required) | Form title (1-200 chars) |
| `slug` | string | (required) | URL slug (lowercase alphanumeric with hyphens, 1-100 chars) |
| `description` | string | -- | Optional description (max 1000 chars) |
| `question` | string | `"Wofur interessieren Sie sich?"` | The question shown to visitors (1-500 chars) |
| `collectName` | boolean | `false` | Ask for the visitor's name |
| `collectEmail` | boolean | `false` | Ask for the visitor's email |
| `fallbackType` | enum | `MESSAGE` | Fallback target type |
| `fallbackValue` | string | `"Bitte kontaktieren Sie uns direkt."` | Fallback target value |
| `active` | boolean | `true` | Whether the form is publicly accessible |

### Routing options

Each option represents one answer choice:

| Field | Type | Description |
|-------|------|-------------|
| `label` | string | Option text shown to the visitor (1-200 chars) |
| `targetType` | enum | `EVENT_TYPE`, `URL`, or `MESSAGE` |
| `targetValue` | string | Event type slug, URL, or message text (1-2000 chars) |
| `order` | integer | Display order (starting from 0) |

### Target types

| Type | Behavior |
|------|----------|
| `EVENT_TYPE` | Redirects to the booking page for the event type slug in `targetValue` |
| `URL` | Redirects to the external URL in `targetValue` |
| `MESSAGE` | Displays the text in `targetValue` to the visitor |

## Public API

### Get routing form

```
GET /api/routing/:companySlug/:formSlug
```

Returns the form title, description, question, name/email collection settings, and option labels (without target details -- those are resolved server-side).

### Resolve an answer

```
POST /api/routing/:companySlug/:formSlug/resolve
```

**Request body:**

```json
{
  "optionId": "option-uuid",
  "name": "Jane Doe",
  "email": "jane@example.com"
}
```

**Response:**

```json
{
  "type": "EVENT_TYPE",
  "value": "sales-demo",
  "prefill": {
    "name": "Jane Doe",
    "email": "jane@example.com"
  }
}
```

If the `optionId` does not match any option, the form's fallback target is returned.

When `collectName` or `collectEmail` is enabled and the visitor provides those values, they are returned as `prefill` data to pre-populate the booking form.

## Admin API

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/admin/routing-forms` | List all routing forms for active company |
| `POST` | `/api/admin/routing-forms` | Create routing form |
| `GET` | `/api/admin/routing-forms/:id` | Get routing form with options |
| `PATCH` | `/api/admin/routing-forms/:id` | Update routing form |
| `DELETE` | `/api/admin/routing-forms/:id` | Delete routing form |

### Permissions

- Any authenticated user can create routing forms.
- Only the creator, a `COMPANY_ADMIN`, or an `ORG_ADMIN` can edit or delete a routing form.
- Updating options replaces all existing options in a transaction.
