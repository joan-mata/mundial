import { db } from './db';
import type { AuditAction } from '@prisma/client';

export async function writeAudit(
  adminId: string,
  action: AuditAction,
  detail: object,
  matchId?: string
): Promise<void> {
  await db.auditLog.create({ data: { adminId, action, detail, matchId } });
}
