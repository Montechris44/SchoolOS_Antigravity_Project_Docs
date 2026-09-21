import { QueryResult, QueryResultRow } from "pg";

import { pool, query } from "../../db/pool";
import { CreateGuardianInput } from "./guardians.schemas";

interface QueryExecutor {
  query<T extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]): Promise<QueryResult<T>>;
}

export interface GuardianRecord {
  id: string;
  school_id: string;
  first_name: string;
  last_name: string;
  relationship: string;
  phone: string;
  email: string;
  address: string | null;
}

const GUARDIAN_SELECT = "id, school_id, first_name, last_name, relationship, phone, email, address";

/**
 * Owners, administrators and bursars see every guardian; a teacher the guardians of students in their classes;
 * a parent only themselves; a student only their own guardian. (Parent and student roles previously received
 * the whole school's guardian directory — names, phones and e-mails.)
 */
export async function listGuardians(actor: { schoolId: string; role: string; userId: string }): Promise<GuardianRecord[]> {
  const params: unknown[] = [actor.schoolId];
  let scope = "TRUE";

  if (actor.role !== "owner" && actor.role !== "admin" && actor.role !== "bursar") {
    params.push(actor.userId);
    const user = `$${params.length}`;
    if (actor.role === "parent") {
      scope = `user_id = ${user}`;
    } else if (actor.role === "student") {
      scope = `id IN (SELECT guardian_id FROM students WHERE user_id = ${user} AND guardian_id IS NOT NULL)`;
    } else if (actor.role === "teacher") {
      scope = `id IN (
        SELECT s.guardian_id FROM students s
        WHERE s.school_id = guardians.school_id AND s.guardian_id IS NOT NULL AND (
          EXISTS (SELECT 1 FROM teacher_assignments ta WHERE ta.school_id = s.school_id AND ta.teacher_id = ${user} AND ta.is_active
                  AND ta.class_id = s.current_class_id AND (ta.arm_id IS NULL OR ta.arm_id = s.arm_id))
          OR s.current_class_id IN (SELECT id FROM classes WHERE school_id = s.school_id AND class_teacher_id = ${user})
          OR s.arm_id IN (SELECT id FROM class_arms WHERE school_id = s.school_id AND class_teacher_id = ${user})
        ))`;
    } else {
      scope = "FALSE";
    }
  }

  const result = await query<GuardianRecord>(
    `SELECT ${GUARDIAN_SELECT} FROM guardians WHERE school_id = $1 AND ${scope} ORDER BY last_name ASC`,
    params
  );
  return result.rows;
}

export async function createGuardian(schoolId: string, input: CreateGuardianInput): Promise<GuardianRecord> {
  const result = await query<GuardianRecord>(
    `INSERT INTO guardians (school_id, first_name, last_name, relationship, phone, email, address)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING ${GUARDIAN_SELECT}`,
    [schoolId, input.firstName, input.lastName, input.relationship, input.phone, input.email, input.address ?? null]
  );
  return result.rows[0];
}

/** Reuses an existing guardian by (school, phone, email) or creates one, for inline enrollment flows. */
export async function findOrCreateGuardian(
  schoolId: string,
  input: CreateGuardianInput,
  client: QueryExecutor = pool
): Promise<GuardianRecord> {
  const existing = await client.query<GuardianRecord>(
    `SELECT ${GUARDIAN_SELECT} FROM guardians WHERE school_id = $1 AND phone = $2 AND email = $3`,
    [schoolId, input.phone, input.email]
  );

  if (existing.rowCount && existing.rowCount > 0) {
    return existing.rows[0];
  }

  const result = await client.query<GuardianRecord>(
    `INSERT INTO guardians (school_id, first_name, last_name, relationship, phone, email, address)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING ${GUARDIAN_SELECT}`,
    [schoolId, input.firstName, input.lastName, input.relationship, input.phone, input.email, input.address ?? null]
  );

  return result.rows[0];
}
