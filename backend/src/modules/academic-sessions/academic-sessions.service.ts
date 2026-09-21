import { withTransaction, query } from "../../db/pool";
import { recordAuditLog } from "../../shared/audit/audit-log";
import { ConflictError, NotFoundError } from "../../shared/http/errors";
import { CreateAcademicSessionInput } from "./academic-sessions.schemas";

const SESSION_SELECT = "id, school_id, name, start_date, end_date, is_current";
const TERM_SELECT = "id, school_id, session_id, name, start_date, end_date, is_current, is_active";

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

export async function setCurrentSession(schoolId: string, actorId: string, sessionId: string) {
  const session = await withTransaction(async (client) => {
    const target = await client.query("SELECT id FROM academic_sessions WHERE id = $1 AND school_id = $2", [
      sessionId,
      schoolId,
    ]);
    if (target.rowCount === 0) throw new NotFoundError("Academic session not found.");

    await client.query("UPDATE academic_sessions SET is_current = (id = $1) WHERE school_id = $2", [sessionId, schoolId]);
    const result = await client.query(`SELECT ${SESSION_SELECT} FROM academic_sessions WHERE id = $1`, [sessionId]);
    return result.rows[0];
  });

  await recordAuditLog({
    schoolId,
    userId: actorId,
    action: "academic_session.set_current",
    resourceType: "academic_session",
    resourceId: sessionId,
  });
  return session;
}

export async function setCurrentTerm(schoolId: string, actorId: string, termId: string) {
  const term = await withTransaction(async (client) => {
    const target = await client.query<{ is_active: boolean; session_id: string }>(
      "SELECT is_active, session_id FROM terms WHERE id = $1 AND school_id = $2",
      [termId, schoolId]
    );
    if (target.rowCount === 0) throw new NotFoundError("Term not found.");
    if (!target.rows[0].is_active) throw new ConflictError("Reactivate this term before making it current.");

    await client.query("UPDATE terms SET is_current = (id = $1) WHERE school_id = $2", [termId, schoolId]);
    // The session that owns the current term becomes the current session.
    await client.query("UPDATE academic_sessions SET is_current = (id = $1) WHERE school_id = $2", [
      target.rows[0].session_id,
      schoolId,
    ]);
    const result = await client.query(`SELECT ${TERM_SELECT} FROM terms WHERE id = $1`, [termId]);
    return result.rows[0];
  });

  await recordAuditLog({
    schoolId,
    userId: actorId,
    action: "term.set_current",
    resourceType: "term",
    resourceId: termId,
  });
  return term;
}

/** Deactivated terms keep their history readable but reject edits from everyone except administrators. */
export async function setTermActive(schoolId: string, actorId: string, termId: string, active: boolean) {
  const result = await query(
    `UPDATE terms
     SET is_active = $3::boolean,
         is_current = CASE WHEN $3::boolean THEN is_current ELSE FALSE END,
         deactivated_at = CASE WHEN $3::boolean THEN NULL ELSE NOW() END,
         deactivated_by = CASE WHEN $3::boolean THEN NULL ELSE $4::uuid END
     WHERE id = $1 AND school_id = $2
     RETURNING ${TERM_SELECT}`,
    [termId, schoolId, active, actorId]
  );
  if (result.rowCount === 0) throw new NotFoundError("Term not found.");

  await recordAuditLog({
    schoolId,
    userId: actorId,
    action: active ? "term.reactivated" : "term.deactivated",
    resourceType: "term",
    resourceId: termId,
  });
  return result.rows[0];
}

/** Sessions, terms and the current period in one call — the default filters for every academic screen. */
export async function getAcademicStatus(schoolId: string) {
  const [sessions, terms] = await Promise.all([
    listAcademicSessions(schoolId),
    query(`SELECT ${TERM_SELECT} FROM terms WHERE school_id = $1 ORDER BY start_date ASC`, [schoolId]),
  ]);

  const currentTerm =
    terms.rows.find((term) => term.is_current) ?? [...terms.rows].sort((a, b) => (a.start_date < b.start_date ? 1 : -1))[0] ?? null;
  const currentSession =
    sessions.find((session) => session.is_current) ??
    sessions.find((session) => currentTerm && session.id === currentTerm.session_id) ??
    sessions[0] ??
    null;

  return { sessions, terms: terms.rows, currentSession, currentTerm };
}
