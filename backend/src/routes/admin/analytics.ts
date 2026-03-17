// backend/src/routes/admin/analytics.ts
import type { FastifyInstance } from 'fastify';
import { z } from 'zod/v4';
import { prisma } from '../../db.js';
import { requireRole } from '../../middleware/auth.js';

export async function analyticsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireRole('COMPANY_ADMIN', 'ORG_ADMIN'));

  /** GET /api/admin/analytics/overview — Booking stats for active company */
  app.get('/api/admin/analytics/overview', {
    schema: {
      summary: 'Get analytics overview',
      description: 'Returns booking statistics for the active company including totals, cancellation rates, per-user breakdown, and daily counts for the last 30 days.',
      tags: ['Analytics'],
      security: [{ session: [] }, { apiKey: [] }],
      response: {
        200: z.object({
          summary: z.object({
            total30d: z.number().describe('Total bookings in last 30 days'),
            totalWeek: z.number().describe('Total bookings in last 7 days'),
            cancelled30d: z.number().describe('Cancelled bookings in last 30 days'),
            cancelRate: z.number().describe('Cancellation rate percentage'),
          }),
          byStatus: z.array(z.object({
            status: z.string(),
            count: z.number(),
          })),
          byUser: z.array(z.object({
            userId: z.string(),
            name: z.string(),
            count: z.number(),
          })),
          daily: z.array(z.object({
            date: z.string(),
            count: z.number(),
          })),
        }),
      },
    },
  }, async (request) => {
    const user = request.session.user!;
    const companyId = user.activeCompanyId;

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const baseWhere = companyId
      ? { eventType: { companyId } }
      : { eventType: { company: { organizationId: user.organizationId } } };

    const [total30d, totalWeek, cancelled30d, byStatus, byUser, daily] = await Promise.all([
      // Total bookings last 30 days
      prisma.booking.count({ where: { ...baseWhere, createdAt: { gte: thirtyDaysAgo } } }),
      // Total bookings last 7 days
      prisma.booking.count({ where: { ...baseWhere, createdAt: { gte: sevenDaysAgo } } }),
      // Cancelled last 30 days
      prisma.booking.count({ where: { ...baseWhere, status: 'CANCELLED', createdAt: { gte: thirtyDaysAgo } } }),
      // By status
      prisma.booking.groupBy({
        by: ['status'],
        where: { ...baseWhere, createdAt: { gte: thirtyDaysAgo } },
        _count: { id: true },
      }),
      // By user (top 10)
      prisma.booking.groupBy({
        by: ['assignedUserId'],
        where: { ...baseWhere, createdAt: { gte: thirtyDaysAgo } },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 10,
      }),
      // Daily counts last 30 days
      prisma.$queryRaw<Array<{ date: string; count: bigint }>>`
        SELECT DATE("createdAt") as date, COUNT(*)::bigint as count
        FROM "Booking" b
        JOIN "EventType" et ON b."eventTypeId" = et.id
        WHERE et."companyId" = ${companyId}
        AND b."createdAt" >= ${thirtyDaysAgo}
        GROUP BY DATE("createdAt")
        ORDER BY date ASC
      `.catch(() => []),
    ]);

    // Resolve user names
    const userIds = byUser.map((u) => u.assignedUserId);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u.name]));

    return {
      summary: {
        total30d,
        totalWeek,
        cancelled30d,
        cancelRate: total30d > 0 ? Math.round((cancelled30d / total30d) * 100) : 0,
      },
      byStatus: byStatus.map((s) => ({ status: s.status, count: s._count.id })),
      byUser: byUser.map((u) => ({ userId: u.assignedUserId, name: userMap.get(u.assignedUserId) ?? 'Unknown', count: u._count.id })),
      daily: daily.map((d) => ({ date: String(d.date).slice(0, 10), count: Number(d.count) })),
    };
  });
}
