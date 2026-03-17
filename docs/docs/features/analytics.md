---
sidebar_position: 9
---

# Analytics

The analytics dashboard provides booking statistics for company and organization admins.

## Access

The analytics endpoint requires `COMPANY_ADMIN` or `ORG_ADMIN` role.

- **COMPANY_ADMIN**: Sees analytics scoped to their active company.
- **ORG_ADMIN**: If no active company is set, sees analytics across all companies in the organization.

## Overview endpoint

```
GET /api/admin/analytics/overview
```

Returns a comprehensive analytics overview with four sections.

### Summary

High-level metrics for the selected scope:

| Metric | Description |
|--------|-------------|
| `total30d` | Total bookings created in the last 30 days |
| `totalWeek` | Total bookings created in the last 7 days |
| `cancelled30d` | Number of cancelled bookings in the last 30 days |
| `cancelRate` | Cancellation rate as a percentage (rounded to integer) |

### By status

Bookings grouped by status for the last 30 days:

```json
{
  "byStatus": [
    { "status": "CONFIRMED", "count": 42 },
    { "status": "CANCELLED", "count": 5 },
    { "status": "COMPLETED", "count": 38 },
    { "status": "NO_SHOW", "count": 2 }
  ]
}
```

### By user

Top 10 users by booking count in the last 30 days:

```json
{
  "byUser": [
    { "userId": "user-uuid-1", "name": "Alice Smith", "count": 15 },
    { "userId": "user-uuid-2", "name": "Bob Jones", "count": 12 }
  ]
}
```

### Daily breakdown

Day-by-day booking counts for the last 30 days:

```json
{
  "daily": [
    { "date": "2026-02-15", "count": 3 },
    { "date": "2026-02-16", "count": 5 },
    { "date": "2026-02-17", "count": 2 }
  ]
}
```

## Full response example

```json
{
  "summary": {
    "total30d": 87,
    "totalWeek": 23,
    "cancelled30d": 5,
    "cancelRate": 6
  },
  "byStatus": [
    { "status": "CONFIRMED", "count": 42 },
    { "status": "CANCELLED", "count": 5 },
    { "status": "COMPLETED", "count": 38 },
    { "status": "NO_SHOW", "count": 2 }
  ],
  "byUser": [
    { "userId": "uuid-1", "name": "Alice Smith", "count": 15 },
    { "userId": "uuid-2", "name": "Bob Jones", "count": 12 },
    { "userId": "uuid-3", "name": "Carol Davis", "count": 10 }
  ],
  "daily": [
    { "date": "2026-02-15", "count": 3 },
    { "date": "2026-02-16", "count": 5 },
    { "date": "2026-02-17", "count": 2 }
  ]
}
```

## Notes

- All date ranges are calculated relative to the current server time.
- The `cancelRate` is `0` when there are no bookings in the last 30 days.
- The daily breakdown uses the `createdAt` timestamp (booking creation date), not the `startTime` (meeting date).
- The by-user breakdown shows a maximum of 10 users, ordered by booking count descending.
