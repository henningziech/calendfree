// backend/src/services/audit-log.ts
import { prisma } from '../db.js';
import type { AuditAction } from '@prisma/client';

/** Log an auditable action. Non-blocking — fire and forget. */
export function logAudit(params: {
  userId?: string;
  action: AuditAction;
  details?: Record<string, unknown>;
  ipAddress?: string;
}): void {
  // Fire and forget — audit logging should never block a request
  prisma.auditLog.create({ data: params }).catch((err) => {
    console.error('Audit log write failed:', err);
  });
}
