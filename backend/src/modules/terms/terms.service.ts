import { withTransaction, query } from "../../db/pool";
import { ConflictError, NotFoundError } from "../../shared/http/errors";
import { CreateTermInput } from "./terms.schemas";

const TERM_SELECT = "id, school_id, session_id, name, start_date, end_date, is_current, is_active";

export async function listTerms(schoolId: string, sessionId?: string) {
  const conditions = ["school_id = $1"];
  const params: unknown[] = [schoolId];

  if (sessionId) {
    params.push(sessionId);
    conditions.push(`session_id = $${params.length}`);
  }

  const result = await query(
    `SELECT ${TERM_SELECT} FROM terms WHERE ${conditions.join(" AND ")} ORDER BY start_date ASC`,
    params
  );
  return result.rows;
}

/** Falls back to the most recently started term when no term is flagged current. */
export async function getCurrentTermId(schoolId: string): Promise<string> {
  const current = await query<{ id: string }>(
    "SELECT id FROM terms WHERE school_id = $1 AND is_current = TRUE LIMIT 1",
    [schoolId]
  );

  if (current.rowCount && current.rowCount > 0) {
    return current.rows[0].id;
  }

  const fallback = await query<{ id: string }>(
    "SELECT id FROM terms WHERE school_id = $1 ORDER BY start_date DESC LIMIT 1",
    [schoolId]
  );

  if (fallback.rowCount === 0) {
    throw new NotFoundError("No academic term has been configured for this school yet.");
  }

  return fallback.rows[0].id;
}

export async function createTerm(schoolId: string, input: CreateTermInput) {
  const session = await query<{ id: string }>("SELECT id FROM academic_sessions WHERE school_id = $1 AND id = $2", [
    schoolId,
    input.sessionId,
  ]);

  if (session.rowCount === 0) {
    throw new NotFoundError("Academic session not found.");
  }

  const existing = await query<{ id: string }>(
    "SELECT id FROM terms WHERE school_id = $1 AND session_id = $2 AND name = $3",
    [schoolId, input.sessionId, input.name]
  );

  if (existing.rowCount && existing.rowCount > 0) {
    throw new ConflictError(`'${input.name}' already exists for this session.`);
  }

  return withTransaction(async (client) => {
    if (input.isCurrent) {
      await client.query("UPDATE terms SET is_current = FALSE WHERE school_id = $1", [schoolId]);
    }

    const result = await client.query(
      `INSERT INTO terms (school_id, session_id, name, start_date, end_date, is_current)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING ${TERM_SELECT}`,
      [schoolId, input.sessionId, input.name, input.startDate, input.endDate, input.isCurrent]
    );

    return result.rows[0];
  });
}
