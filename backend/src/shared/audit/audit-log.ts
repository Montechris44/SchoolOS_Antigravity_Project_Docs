import { PoolClient } from "pg";

import { pool } from "../../db/pool";

export interface AuditLogEntry {
  schoolId?: string | null;
  userId?: string | null;
  superAdminId?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  payload?: Record<string, unknown>;
  ipAddress?: string | null;
}

export async function recordAuditLog(entry: AuditLogEntry, client?: PoolClient): Promise<void> {
  const executor = client ?? pool;

  await executor.query(
    `INSERT INTO audit_logs (school_id, user_id, super_admin_id, action, resource_type, resource_id, payload, ip_address)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      entry.schoolId ?? null,
      entry.userId ?? null,
      entry.superAdminId ?? null,
      entry.action,
      entry.resourceType,
      entry.resourceId ?? null,
      entry.payload ? JSON.stringify(entry.payload) : null,
      entry.ipAddress ?? null,
    ]
  );
}
