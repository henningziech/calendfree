---
sidebar_position: 11
title: Email Notifications
---

# Email Notifications

## Overview

Calendfree supports per-EventType email notifications to keep both customers and consultants informed throughout the booking lifecycle. By default, all notifications are **turned off** — you choose exactly which emails get sent.

There are **5 notification types** available, covering the full journey from booking confirmation through post-meeting follow-up.

## Notification Types

| Type | Trigger | Timing |
|------|---------|--------|
| **Confirmation** | A new booking is created | Sent immediately |
| **Cancellation** | A booking is cancelled | Sent immediately |
| **Reminder 1** | Before the scheduled meeting | Configurable (see below) |
| **Reminder 2** | Before the scheduled meeting | Configurable (see below) |
| **Follow-Up** | After the meeting ends | Configurable (see below) |

## Configuration

To enable and configure notifications for an event type:

1. Navigate to the **Event Types** page.
2. Click the **bell icon** on the event type you want to configure.
3. **Toggle** the notification types you want to activate.
4. For Reminder and Follow-Up types, **configure the timing** using the dropdown.
5. Click **Save** to apply your changes.

Each notification type can be enabled or disabled independently, so you can mix and match to fit your workflow.

## Custom Templates

Every notification type supports custom email templates with two editable fields:

- **Subject** — The email subject line.
- **Body** — The email body content.

Templates use **plaintext** with `{{variable}}` syntax for dynamic values. For example:

```
Hello {{customerName}},

Your meeting "{{eventTypeTitle}}" with {{consultantName}} is scheduled for {{dateTime}}.

Join here: {{meetLink}}
```

Branding (company logo and colors) is automatically applied to all outgoing emails — you only need to provide the text content.

## Template Variables

The following variables are available in both subject and body templates:

| Variable | Description |
|----------|-------------|
| `{{customerName}}` | Full name of the customer who booked |
| `{{customerEmail}}` | Email address of the customer |
| `{{eventTypeTitle}}` | Name of the event type |
| `{{consultantName}}` | Name of the assigned consultant |
| `{{consultantEmail}}` | Email address of the assigned consultant |
| `{{dateTime}}` | Formatted date and time of the meeting |
| `{{duration}}` | Duration of the meeting (e.g., "30 minutes") |
| `{{meetLink}}` | Google Meet link for the meeting |
| `{{cancelUrl}}` | Link for the customer to cancel the booking |
| `{{rescheduleUrl}}` | Link for the customer to reschedule |
| `{{companyName}}` | Your company/organization name |
| `{{reminderText}}` | Human-readable time until the meeting (used in reminders) |

## Preview

Each template includes a **Preview** button that renders a sample email using placeholder data. This lets you verify formatting and variable placement before activating the notification.

## Timing Options

### Reminder 1

| Option |
|--------|
| 48 hours before |
| 24 hours before |
| 12 hours before |
| 6 hours before |
| 2 hours before |

### Reminder 2

| Option |
|--------|
| 4 hours before |
| 2 hours before |
| 1 hour before |
| 30 minutes before |
| 15 minutes before |

### Follow-Up

| Option |
|--------|
| 30 minutes after |
| 1 hour after |
| 2 hours after |
| 6 hours after |
| 24 hours after |

## Language

Email templates respect the **company language setting**. Templates are available in both **German (DE)** and **English (EN)**. The language used for outgoing emails is determined by your organization's configured language.

## Branding

Your **company logo** and **brand colors** are automatically applied to all notification emails. This ensures a consistent look across every email without any extra template work. Branding settings are managed on the [Branding](./branding.md) page and apply globally to all outgoing communications.
