---
sidebar_position: 7
---

# Embed Widget

The Calendfree embed widget lets you add a booking interface to any external website with a single script tag.

## Quick start

Add the following script tag to your HTML page:

```html
<script
  src="https://your-calendfree-instance.com/embed.js"
  data-calendfree-company="your-company-slug"
  data-calendfree-event-type="your-event-type-slug"
></script>
```

This renders a "Termin buchen" (Book appointment) button that opens a popup with the booking page.

## Display modes

### Popup mode (default)

Renders a styled button. When clicked, the booking page opens in a centered modal overlay.

```html
<script
  src="https://your-calendfree-instance.com/embed.js"
  data-calendfree-company="acme"
  data-calendfree-event-type="sales-demo"
  data-calendfree-mode="popup"
  data-calendfree-text="Schedule a Demo"
></script>
```

The popup modal is 90% wide (max 640px) and 80% viewport height, with a close button and click-outside-to-dismiss behavior.

### Inline mode

Embeds the booking page directly into the page as an iframe.

```html
<script
  src="https://your-calendfree-instance.com/embed.js"
  data-calendfree-company="acme"
  data-calendfree-event-type="sales-demo"
  data-calendfree-mode="inline"
></script>
```

The inline iframe is full-width with a minimum height of 600px, no border, and rounded corners.

## Configuration attributes

| Attribute | Required | Default | Description |
|-----------|----------|---------|-------------|
| `data-calendfree-company` | Yes | -- | Company slug |
| `data-calendfree-event-type` | No | -- | Event type slug (omit to show all event types) |
| `data-calendfree-mode` | No | `popup` | Display mode: `popup` or `inline` |
| `data-calendfree-text` | No | `Termin buchen` | Button text (popup mode only) |
| `data-calendfree-url` | No | *(auto-detected)* | Base URL of the Calendfree instance |

## URL construction

The embed script constructs the booking page URL as:

```
{baseUrl}/{companySlug}/{eventTypeSlug}
```

If `data-calendfree-url` is not set, the base URL is derived from the script's `src` attribute by removing `/embed.js`.

If `data-calendfree-event-type` is omitted, the URL points to the company's booking page listing all active event types.

## Multiple embeds

You can include multiple script tags on the same page to embed different event types:

```html
<div>
  <h3>Sales Demo</h3>
  <script
    src="https://your-calendfree-instance.com/embed.js"
    data-calendfree-company="acme"
    data-calendfree-event-type="sales-demo"
    data-calendfree-text="Book Sales Demo"
  ></script>
</div>

<div>
  <h3>Technical Support</h3>
  <script
    src="https://your-calendfree-instance.com/embed.js"
    data-calendfree-company="acme"
    data-calendfree-event-type="tech-support"
    data-calendfree-text="Book Support Call"
  ></script>
</div>
```

## Serving the script

The embed script is served from:

```
GET /embed.js
```

Response headers:
- `Content-Type: application/javascript`
- `Cache-Control: public, max-age=3600` (1 hour)
- `Access-Control-Allow-Origin: *` (allows embedding from any domain)
