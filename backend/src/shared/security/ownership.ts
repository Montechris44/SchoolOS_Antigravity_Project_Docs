import { PoolClient } from "pg";

import { pool } from "../../db/pool";
import { BadRequestError, NotFoundError } from "../http/errors";

/**
 * Foreign keys alone do not stop a caller from pointing a record at another school's class, student
 * or term, so every id that arrives in a request is checked against the caller's school here.
 * The table name is taken from a fixed whitelist, never from user input.
 */
const OWNED_TABLES = [
  "classes",
  "class_arms",
  "subjects",
  "terms",
  "academic_sessions",
  "students",
  "assignments",
  "assignment_submissions",
  "timetable",
  "events",
  "leave_passes",
  "staff_leave_requests",
  "subject_score_batches",
  "guardians",
  "grading_systems",
] as const;

export type OwnedTable = (typeof OWNED_TABLES)[number];

type Executor = Pick<PoolClient, "query"> | typeof pool;

export async function assertOwned(
  schoolId: string,
  table: OwnedTable,
  id: string,
  label: string,
  client: Executor = pool
): Promise<void> {
  if (!OWNED_TABLES.includes(table)) {
    throw new Error(`Table '${table}' is not registered for ownership checks.`);
  }
  const result = await client.query(`SELECT 1 FROM ${table} WHERE id = $1 AND school_id = $2`, [id, schoolId]);
  if (result.rowCount === 0) {
    throw new NotFoundError(`${label} not found in this school.`);
  }
}

/** A user (profile) belongs to a school when they hold an active membership in it, optionally with one of `roles`. */
export async function assertSchoolMember(
  schoolId: string,
  userId: string,
  label: string,
  roles?: string[],
  client: Executor = pool
): Promise<void> {
  const result = roles
    ? await client.query(
        `SELECT 1 FROM memberships WHERE school_id = $1 AND user_id = $2 AND is_active = TRUE AND role::text = ANY($3::text[])`,
        [schoolId, userId, roles]
      )
    : await client.query(`SELECT 1 FROM memberships WHERE school_id = $1 AND user_id = $2 AND is_active = TRUE`, [
        schoolId,
        userId,
      ]);
  if (result.rowCount === 0) {
    throw new NotFoundError(`${label} not found in this school.`);
  }
}

/** The arm (when given) must belong to the class, and the class to the school. */
export async function assertClassArm(
  schoolId: string,
  classId: string,
  armId?: string | null,
  client: Executor = pool
): Promise<void> {
  await assertOwned(schoolId, "classes", classId, "Class", client);
  if (armId) {
    const arm = await client.query(`SELECT 1 FROM class_arms WHERE id = $1 AND class_id = $2 AND school_id = $3`, [
      armId,
      classId,
      schoolId,
    ]);
    if (arm.rowCount === 0) {
      throw new BadRequestError("The selected arm does not belong to this class.");
    }
  }
}

/** Term must belong to the school and the session to which it says it belongs. */
export async function assertTermSession(
  schoolId: string,
  termId: string,
  sessionId: string,
  client: Executor = pool
): Promise<void> {
  const result = await client.query(`SELECT 1 FROM terms WHERE id = $1 AND session_id = $2 AND school_id = $3`, [
    termId,
    sessionId,
    schoolId,
  ]);
  if (result.rowCount === 0) {
    throw new BadRequestError("The selected term does not belong to that academic session in this school.");
  }
}
