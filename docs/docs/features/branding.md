---
sidebar_position: 6
---

# Branding

Calendfree supports per-company branding for public booking pages. Branding settings control colors, logo, fonts, and footer text. If a company has no branding configured, it falls back to the organization-level branding.

## Branding fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `primaryColor` | string | `#0B8ECA` | Primary brand color (hex) |
| `accentColor` | string | `#14B8A6` | Accent color (hex) |
| `backgroundColor` | string | `#F8FAFC` | Page background color (hex) |
| `textColor` | string | `#1E293B` | Text color (hex) |
| `fontFamily` | string | `Inter` | Font family name (max 100 chars) |
| `logoUrl` | string | `null` | URL to the company logo image |
| `showPoweredBy` | boolean | `true` | Show "Powered by Calendfree" badge |
| `footerText` | string | `null` | Custom footer text (max 200 chars) |

## Branding hierarchy

1. **Company branding** -- if the company has a `BrandingConfig`, it is used.
2. **Organization branding** -- if the company has no branding, the organization's branding is used as fallback.
3. **Defaults** -- if neither exists, the default values shown above are used.

## Update branding

```bash
curl -X PUT /api/admin/companies/{companyId}/branding \
  -H "Content-Type: application/json" \
  -d '{
    "primaryColor": "#1D4ED8",
    "accentColor": "#059669",
    "backgroundColor": "#FFFFFF",
    "textColor": "#111827",
    "fontFamily": "Roboto",
    "showPoweredBy": false,
    "footerText": "Acme Corp - Schedule a meeting"
  }'
```

This endpoint uses upsert logic -- it creates the branding config if it does not exist, or updates it if it does. Requires `COMPANY_ADMIN` or `ORG_ADMIN` role.

## Logo upload

Upload a company logo as a multipart form file upload:

```bash
curl -X POST /api/admin/companies/{companyId}/branding/logo \
  -F "file=@logo.png"
```

### Constraints

- **Accepted formats**: PNG, JPEG, GIF, WebP
- File type is validated by magic bytes (not just the file extension)
- Uploading a new logo replaces the previous one (the old file is deleted)
- Logos are stored at `/uploads/logos/{companyId}-{timestamp}.{ext}`

### Delete logo

```bash
curl -X DELETE /api/admin/companies/{companyId}/branding/logo
```

Removes the logo file from the server and clears the `logoUrl` in the branding config.

## API endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `PUT` | `/api/admin/companies/:id/branding` | Create or update branding |
| `POST` | `/api/admin/companies/:id/branding/logo` | Upload logo |
| `DELETE` | `/api/admin/companies/:id/branding/logo` | Delete logo |

## Public access

Public booking pages automatically load the company's branding via:

```
GET /api/booking/:companySlug/info
```

This returns the company name, language, and full branding configuration for use in the booking page UI. The branding data is also included when retrieving booking details via token (`GET /api/booking/:bookingToken`).
