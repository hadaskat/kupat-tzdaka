import type { Firestore } from 'firebase-admin/firestore';

export interface AuditEntry {
  adminId: string;
  action: string;
  entity: string;
  entityId: string;
  /** Set when the action belongs to a specific fund, so fund managers can see their own trail. */
  fundId?: string | null;
  details?: Record<string, unknown>;
}

/**
 * Append-only record of every sensitive action (spec §4.11). Written with the
 * Admin SDK only - security rules block all client writes - and deliberately
 * never throws, so a logging failure can't roll back an operation that already
 * committed.
 */
export async function writeAuditLog(db: Firestore, entry: AuditEntry): Promise<void> {
  try {
    await db.collection('auditLog').add({
      adminId: entry.adminId,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId,
      fundId: entry.fundId ?? null,
      details: entry.details ?? null,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('audit log write failed', entry.action, error);
  }
}
