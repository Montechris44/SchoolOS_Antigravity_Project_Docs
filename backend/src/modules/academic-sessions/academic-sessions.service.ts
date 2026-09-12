import { withTransaction, query } from "../../db/pool";
import { ConflictError } from "../../shared/http/errors";
import { CreateAcademicSessionInput } from "./academic-sessions.schemas";

const SESSION_SELECT = "id, school_id, name, start_date, end_date, is_current";

export async function listAcademicSessions(schoolId: string) {
  const result = await query(
    `SELECT ${SESSION_SELECT} FROM academic_sessions WHERE school_id = $1 ORDER BY start_date DESC`,
    [schoolId]
  );
  return result.rows;
}

export async function createAcademicSession(schoolId: string, input: CreateAcademicSessionInput) {
  const existing = await query<{ id: string }>(
    "SELECT id FROM academic_sessions WHERE school_id = $1 AND name = $2",
    [schoolId, input.name]
  );

  if (existing.rowCount && existing.rowCount > 0) {
    throw new ConflictError(`Academic session '${input.name}' already exists.`);
  }

  return withTransaction(async (client) => {
    if (input.isCurrent) {
      await client.query("UPDATE academic_sessions SET is_current = FALSE WHERE school_id = $1", [schoolId]);
    }

    const result = await client.query(
      `INSERT INTO academic_sessions (school_id, name, start_date, end_date, is_current)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING ${SESSION_SELECT}`,
      [schoolId, input.name, input.startDate, input.endDate, input.isCurrent]
    );

    return result.rows[0];
  });
}
