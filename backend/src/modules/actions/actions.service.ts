import { query } from "../../db/pool";
import { NotFoundError } from "../../shared/http/errors";
import { CreateActionInput, UpdateActionInput } from "./actions.schemas";

const ACTION_SELECT = `
  SELECT a.id, a.school_id, a.signal_id, a.title, a.recommended_step, a.priority,
         a.assigned_to_user_id, p.full_name AS assigned_to_name,
         a.status, a.notes, a.outcome, a.created_at, a.resolved_at
  FROM actions a
  LEFT JOIN profiles p ON p.id = a.assigned_to_user_id
`;

export async function listActions(schoolId: string) {
  const result = await query(`${ACTION_SELECT} WHERE a.school_id = $1 ORDER BY a.created_at DESC`, [schoolId]);
  return result.rows;
}

export async function createAction(schoolId: string, actorUserId: string, input: CreateActionInput) {
  const assignedTo = input.assignedToUserId ?? actorUserId;

  const result = await query<{ id: string }>(
    `INSERT INTO actions (school_id, title, recommended_step, priority, assigned_to_user_id, status, notes)
     VALUES ($1, $2, $3, $4, $5, 'OPEN', $6)
     RETURNING id`,
    [schoolId, input.title, input.recommendedStep, input.priority, assignedTo, input.notes ?? null]
  );

  const created = await query(`${ACTION_SELECT} WHERE a.id = $1`, [result.rows[0].id]);
  return created.rows[0];
}

export async function updateAction(schoolId: string, actionId: string, input: UpdateActionInput) {
  const existing = await query<{ id: string }>("SELECT id FROM actions WHERE school_id = $1 AND id = $2", [
    schoolId,
    actionId,
  ]);

  if (existing.rowCount === 0) {
    throw new NotFoundError("Action not found.");
  }

  const isResolved = input.status === "RESOLVED";

  await query(
    `UPDATE actions
     SET status = $1, outcome = COALESCE($2, outcome), resolved_at = ${isResolved ? "NOW()" : "NULL"}
     WHERE id = $3`,
    [input.status, input.outcome ?? null, actionId]
  );

  const result = await query(`${ACTION_SELECT} WHERE a.id = $1`, [actionId]);
  return result.rows[0];
}
