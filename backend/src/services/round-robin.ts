// backend/src/services/round-robin.ts
import { prisma } from '../db.js';
import { Prisma } from '@prisma/client';

const MAX_RETRIES = 3;

interface RoundRobinResult {
  userId: string;
}

/**
 * Assign a user from a team using the configured round-robin mode.
 * Uses SELECT FOR UPDATE for concurrency safety.
 * @param teamId - The team to assign from
 * @param availableUserIds - Users who are available for the requested slot
 * @returns The assigned user ID
 * @throws Error if no user can be assigned after retries
 */
export async function assignUser(
  teamId: string,
  availableUserIds: string[],
): Promise<RoundRobinResult> {
  if (availableUserIds.length === 0) {
    throw new Error('No available users for this slot');
  }

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
        // Lock the RoundRobinConfig row
        const [rrConfig] = await tx.$queryRaw<Array<{
          id: string;
          teamId: string;
          mode: string;
          lastAssignedIndex: number;
          version: number;
        }>>`
          SELECT id, "teamId", mode, "lastAssignedIndex", version
          FROM "RoundRobinConfig"
          WHERE "teamId" = ${teamId}
          FOR UPDATE
        `;

        if (!rrConfig) {
          throw new Error(`No RoundRobinConfig found for team ${teamId}`);
        }

        let selectedUserId: string;

        switch (rrConfig.mode) {
          case 'SEQUENTIAL':
            selectedUserId = await assignSequential(tx, rrConfig, availableUserIds);
            break;
          case 'LEAST_BUSY':
            selectedUserId = await assignLeastBusy(tx, availableUserIds);
            break;
          case 'WEIGHTED':
            selectedUserId = await assignWeighted(tx, teamId, availableUserIds);
            break;
          default:
            throw new Error(`Unknown round-robin mode: ${rrConfig.mode}`);
        }

        return { userId: selectedUserId };
      }, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 5000,
      });
    } catch (err: any) {
      // Retry on serialization failure
      if (err.code === 'P2034' || err.message?.includes('could not serialize')) {
        if (attempt < MAX_RETRIES - 1) continue;
      }
      throw err;
    }
  }

  throw new Error('Failed to assign user after max retries');
}

/** Sequential: rotate through members by index */
async function assignSequential(
  tx: Prisma.TransactionClient,
  rrConfig: { id: string; lastAssignedIndex: number; version: number },
  availableUserIds: string[],
): Promise<string> {
  // Get ordered team memberships
  const memberships = await tx.teamMembership.findMany({
    where: { teamId: rrConfig.id, userId: { in: availableUserIds } },
    orderBy: { userId: 'asc' },
  });

  if (memberships.length === 0) throw new Error('No available members in team');

  // Find next index (wrap around)
  const nextIndex = (rrConfig.lastAssignedIndex + 1) % memberships.length;
  const selectedUserId = memberships[nextIndex].userId;

  // Update pointer
  await tx.roundRobinConfig.update({
    where: { id: rrConfig.id },
    data: {
      lastAssignedIndex: nextIndex,
      version: { increment: 1 },
    },
  });

  return selectedUserId;
}

/** Least-busy: assign to user with fewest recent bookings */
async function assignLeastBusy(
  tx: Prisma.TransactionClient,
  availableUserIds: string[],
): Promise<string> {
  // Count bookings this week for each available user
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const bookingCounts = await tx.booking.groupBy({
    by: ['assignedUserId'],
    where: {
      assignedUserId: { in: availableUserIds },
      status: { in: ['CONFIRMED', 'COMPLETED', 'PENDING_CALENDAR_SYNC'] },
      startTime: { gte: weekAgo },
    },
    _count: { id: true },
  });

  // Find user with minimum bookings
  const countMap = new Map(bookingCounts.map((c) => [c.assignedUserId, c._count.id]));

  let minCount = Infinity;
  let selectedUserId = availableUserIds[0];

  for (const uid of availableUserIds) {
    const count = countMap.get(uid) ?? 0;
    if (count < minCount) {
      minCount = count;
      selectedUserId = uid;
    }
  }

  return selectedUserId;
}

/** Weighted: assign to user furthest below their weight target */
async function assignWeighted(
  tx: Prisma.TransactionClient,
  teamId: string,
  availableUserIds: string[],
): Promise<string> {
  // Get weights for available members
  const memberships = await tx.teamMembership.findMany({
    where: { teamId, userId: { in: availableUserIds } },
  });

  const totalWeight = memberships.reduce((sum, m) => sum + m.weight, 0);
  if (totalWeight === 0) return availableUserIds[0];

  // Count total bookings for the team in last 30 days
  const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const allTeamUserIds = memberships.map((m) => m.userId);

  const bookingCounts = await tx.booking.groupBy({
    by: ['assignedUserId'],
    where: {
      assignedUserId: { in: allTeamUserIds },
      status: { in: ['CONFIRMED', 'COMPLETED', 'PENDING_CALENDAR_SYNC'] },
      startTime: { gte: monthAgo },
    },
    _count: { id: true },
  });

  const countMap = new Map(bookingCounts.map((c) => [c.assignedUserId, c._count.id]));
  const totalBookings = Array.from(countMap.values()).reduce((a, b) => a + b, 0) || 1;

  // Find user furthest below their target percentage
  let maxDeficit = -Infinity;
  let selectedUserId = availableUserIds[0];

  for (const membership of memberships) {
    const targetPct = membership.weight / totalWeight;
    const actualPct = (countMap.get(membership.userId) ?? 0) / totalBookings;
    const deficit = targetPct - actualPct;

    if (deficit > maxDeficit) {
      maxDeficit = deficit;
      selectedUserId = membership.userId;
    }
  }

  return selectedUserId;
}
