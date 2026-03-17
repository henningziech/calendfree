---
sidebar_position: 2
---

# First Booking

A step-by-step walkthrough from initial setup to a confirmed booking on your Google Calendar.

## 1. Log in

Open `http://localhost:5173` and sign in with your Google account. You'll land on the user dashboard.

## 2. Create a company

Navigate to **Admin > Companies** and create a new company. Choose a name and a **slug** -- the slug becomes part of your public booking URL (e.g., `acme` gives you URLs like `/acme/...`).

## 3. Create an event type

Go to **Admin > Event Types** and create your first event type:

- **Title** -- Display name, e.g. "30-Minute Consultation"
- **Slug** -- URL-safe identifier, e.g. `30min-consultation`
- **Duration** -- Meeting length in minutes (5--480, default: 30)
- **Buffer before/after** -- Optional padding between meetings (0--120 min)
- **Min notice** -- How far in advance bookings must be made (default: 4 hours)
- **Max advance** -- How far into the future slots are available (default: 60 days)
- **Auto Meet link** -- Automatically create a Google Meet link (on by default)
- **Event category** -- `PERSONAL` (single host), `TEAM` (round-robin), or `GROUP` (multiple attendees)

For a personal event type, leave the category as `PERSONAL`. The event type will use your calendar for availability.

## 4. Set your availability

Go to **Dashboard > Availability** to configure your weekly schedule. The default is Monday through Friday, 9:00--17:00. You can:

- Adjust time slots per weekday
- Add date-specific overrides
- Set daily and weekly booking limits
- Block holidays by country

## 5. Open the public booking page

Your booking page is available at:

```
http://localhost:5173/:companySlug/:eventTypeSlug
```

For example, if your company slug is `acme` and event type slug is `30min-consultation`:

```
http://localhost:5173/acme/30min-consultation
```

This page is public -- no login required. Share this URL with anyone who needs to book time with you.

## 6. Book a slot

On the booking page:

1. **Select a date** from the calendar -- available dates are highlighted
2. **Pick a time slot** from the list of available times
3. **Fill in the form** -- at minimum, your name and email
4. **Confirm** the booking

After confirmation, you'll see a summary with:

- The confirmed date and time
- The assigned team member (for round-robin event types)
- A Google Meet link (if auto Meet link is enabled)
- Links to cancel or reschedule

## 7. Check Google Calendar

The booking automatically creates an event in the host's Google Calendar. Both the host and the guest receive calendar invitations with all the meeting details.

If auto Meet link is enabled, the calendar event includes a Google Meet link that both parties can use to join.

## What's next?

- Create a **team** and a team event type to try round-robin scheduling
- Set up a [routing form](/features/routing-forms) to pre-qualify visitors
- Generate an [API key](/features/api-keys) for programmatic access
- Customize your [branding](/features/branding) with company colors and logo
