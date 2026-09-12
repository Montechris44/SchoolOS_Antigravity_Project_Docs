import { query } from "../../db/pool";
import { ConflictError } from "../../shared/http/errors";
import { CreateSubjectInput } from "./subjects.schemas";

export async function listSubjects(schoolId: string) {
  const result = await query(
    "SELECT id, school_id, name, code FROM subjects WHERE school_id = $1 ORDER BY name ASC",
    [schoolId]
  );
  return result.rows;
}

export async function createSubject(schoolId: string, input: CreateSubjectInput) {
  const existing = await query<{ id: string }>("SELECT id FROM subjects WHERE school_id = $1 AND code = $2", [
    schoolId,
    input.code.toUpperCase(),
  ]);

  if (existing.rowCount && existing.rowCount > 0) {
    throw new ConflictError(`A subject with code '${input.code}' already exists.`);
  }

  const result = await query(
    `INSERT INTO subjects (school_id, name, code) VALUES ($1, $2, $3)
     RETURNING id, school_id, name, code`,
    [schoolId, input.name, input.code.toUpperCase()]
  );

  return result.rows[0];
}
