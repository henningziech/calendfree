---
sidebar_position: 3
---

# Teams & Round-Robin

Teams group multiple users together for round-robin booking assignment. When a customer books a team event type, the system automatically assigns the booking to an available team member.

## Creating a team

```bash
curl -X POST /api/admin/companies/{companyId}/teams \
  -H "Content-Type: application/json" \
  -d '{ "name": "Sales Team" }'
```

When a team is created:
- The creating user becomes the team **OWNER** with a default weight of 100.
- A **SEQUENTIAL** round-robin configuration is automatically created.

## Team roles

| Role | Permissions |
|------|-------------|
| `MEMBER` | Receives booking assignments, can view team bookings |
| `OWNER` | All MEMBER permissions plus: manage members, update team settings, change round-robin config, delete team |

Company admins (`COMPANY_ADMIN`) and organization admins (`ORG_ADMIN`) can manage any team regardless of their team role.

The last owner of a team cannot be demoted or removed -- another owner must be assigned first.

## Managing members

### Add a member

```bash
curl -X POST /api/admin/teams/{teamId}/members \
  -H "Content-Type: application/json" \
  -d '{ "userId": "user-uuid", "weight": 80 }'
```

### Invite by email

```bash
curl -X POST /api/admin/teams/{teamId}/invite \
  -H "Content-Type: application/json" \
  -d '{ "email": "user@example.com", "weight": 100 }'
```

### Self-service join/leave

Users can join or leave teams themselves:

```bash
# Join
curl -X POST /api/admin/teams/{teamId}/join

# Leave
curl -X POST /api/admin/teams/{teamId}/leave
```

### Update member weight

```bash
curl -X PATCH /api/admin/teams/{teamId}/members/{userId} \
  -H "Content-Type: application/json" \
  -d '{ "weight": 60 }'
```

Weight is an integer from 1 to 100. It is used by the **WEIGHTED** round-robin mode to control assignment frequency.

### Update member role

```bash
curl -X PATCH /api/admin/teams/{teamId}/members/{userId}/role \
  -H "Content-Type: application/json" \
  -d '{ "role": "OWNER" }'
```

## Round-robin modes

Each team has a `RoundRobinConfig` that determines how bookings are distributed among members. The mode can be changed at any time.

### SEQUENTIAL

Members are assigned in a fixed rotation order. The system tracks a `lastAssignedIndex` that advances with each booking. Uses optimistic concurrency control (`version` field) to handle concurrent bookings.

### LEAST_BUSY

The member with the fewest upcoming confirmed bookings is assigned next. This mode naturally balances workload across team members.

### WEIGHTED

Members are assigned proportionally based on their `weight` value. A member with weight 80 receives roughly twice as many bookings as a member with weight 40.

### Changing the mode

```bash
curl -X PUT /api/admin/teams/{teamId}/round-robin \
  -H "Content-Type: application/json" \
  -d '{ "mode": "LEAST_BUSY" }'
```

Changing the mode resets the `lastAssignedIndex` to 0.

## How assignment works

When a customer submits a booking for a team event type:

1. The system re-checks slot availability for all team members with connected Google accounts.
2. Only members who are available at the requested time are considered.
3. One member is selected using the team's round-robin mode.
4. The booking is created and assigned to the selected member.
5. A calendar event is created on the assigned member's Google Calendar.

If no team members are available for the requested slot, the booking returns `409 Conflict`.

## Team bookings

### List team bookings

```bash
GET /api/admin/teams/{teamId}/bookings?status=upcoming&page=1&limit=15&userId={userId}
```

Query parameters:

| Parameter | Default | Description |
|-----------|---------|-------------|
| `status` | `upcoming` | `upcoming` (future confirmed) or `all` |
| `page` | `1` | Page number |
| `limit` | `15` | Items per page (max 50) |
| `userId` | -- | Filter by assigned user |

Only team members can view team bookings.

## API endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/admin/companies/:companyId/teams` | Create team |
| `GET` | `/api/admin/companies/:companyId/teams` | List teams |
| `GET` | `/api/admin/teams/:id` | Get team details |
| `PATCH` | `/api/admin/teams/:id` | Update team name |
| `DELETE` | `/api/admin/teams/:id` | Delete team |
| `PUT` | `/api/admin/teams/:id/round-robin` | Update round-robin config |
| `POST` | `/api/admin/teams/:id/members` | Add member |
| `PATCH` | `/api/admin/teams/:teamId/members/:userId` | Update member weight |
| `PATCH` | `/api/admin/teams/:teamId/members/:userId/role` | Update member role |
| `DELETE` | `/api/admin/teams/:teamId/members/:userId` | Remove member |
| `POST` | `/api/admin/teams/:id/join` | Join team (self) |
| `POST` | `/api/admin/teams/:id/leave` | Leave team (self) |
| `POST` | `/api/admin/teams/:id/invite` | Invite user by email |
| `GET` | `/api/admin/teams/:id/bookings` | List team bookings |
