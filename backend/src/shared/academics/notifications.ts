import { PoolClient } from "pg";

import { pool } from "../../db/pool";

export interface NotificationInput {
  type: string;
  title: string;
  message: string;
  entityType?: string;
  entityId?: string;
}

type Executor = Pick<PoolClient, "query"> | typeof pool;

/** Notifications are best-effort: a failure here must never fail the action that triggered it. */
export async function notifyUser(
  schoolId: string,
  userId: string,
  input: NotificationInput,
  client: Executor = pool
): Promise<void> {
  try {
    await client.query(
      `INSERT INTO notifications (school_id, user_id, type, title, message, entity_type, entity_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [schoolId, userId, input.type, input.title, input.message, input.entityType ?? null, input.entityId ?? null]
    );
  } catch (error) {
    console.error("[notifications] insert failed:", (error as Error).message);
  }
}

export async function notifyRoles(
  schoolId: string,
  roles: string[],
  input: NotificationInput,
  client: Executor = pool
): Promise<void> {
  try {
    await client.query(
      `INSERT INTO notifications (school_id, user_id, type, title, message, entity_type, entity_id)
       SELECT $1, m.user_id, $3, $4, $5, $6, $7
       FROM memberships m
       WHERE m.school_id = $1 AND m.is_active = TRUE AND m.role::text = ANY($2::text[])`,
      [schoolId, roles, input.type, input.title, input.message, input.entityType ?? null, input.entityId ?? null]
    );
  } catch (error) {
    console.error("[notifications] fan-out failed:", (error as Error).message);
  }
}

/** Student and guardian accounts linked to a student record, so a published result reaches both. */
export async function notifyStudentAndGuardians(
  schoolId: string,
  studentId: string,
  input: NotificationInput,
  client: Executor = pool
): Promise<void> {
  try {
    await client.query(
      `INSERT INTO notifications (school_id, user_id, type, title, message, entity_type, entity_id)
       SELECT $1, u.user_id, $3, $4, $5, $6, $7
       FROM (
         SELECT s.user_id FROM students s WHERE s.id = $2 AND s.school_id = $1 AND s.user_id IS NOT NULL
         UNION
         SELECT g.user_id FROM students s JOIN guardians g ON g.id = s.guardian_id
         WHERE s.id = $2 AND s.school_id = $1 AND g.user_id IS NOT NULL
       ) u`,
      [schoolId, studentId, input.type, input.title, input.message, input.entityType ?? null, input.entityId ?? null]
    );
  } catch (error) {
    console.error("[notifications] student fan-out failed:", (error as Error).message);
  }
}
