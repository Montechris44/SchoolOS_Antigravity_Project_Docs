import { query, withTransaction } from "../../db/pool";
import { ConflictError, NotFoundError } from "../../shared/http/errors";
import { CreateSubjectInput } from "./subjects.schemas";

const SUBJECT_SELECT = "id, school_id, name, code, description, is_active, source, global_subject_id";

export async function listSubjects(schoolId: string, includeInactive = true) {
  const result = await query(
    `SELECT ${SUBJECT_SELECT} FROM subjects
     WHERE school_id = $1 AND ($2 OR is_active = TRUE)
     ORDER BY name ASC`,
    [schoolId, includeInactive]
  );
  return result.rows;
}

export async function createSubject(schoolId: string, input: CreateSubjectInput) {
  const existing = await query<{ id: string }>(
    "SELECT id FROM subjects WHERE school_id = $1 AND (code = $2 OR LOWER(name) = LOWER($3))",
    [schoolId, input.code.toUpperCase(), input.name]
  );

  if (existing.rowCount && existing.rowCount > 0) {
    throw new ConflictError(`A subject with code '${input.code}' or the same name already exists.`);
  }

  const result = await query(
    `INSERT INTO subjects (school_id, name, code, description) VALUES ($1, $2, $3, $4)
     RETURNING ${SUBJECT_SELECT}`,
    [schoolId, input.name, input.code.toUpperCase(), input.description ?? null]
  );

  return result.rows[0];
}

export async function updateSubject(
  schoolId: string,
  subjectId: string,
  input: { name?: string; code?: string; description?: string | null }
) {
  if (input.code || input.name) {
    const clash = await query(
      `SELECT 1 FROM subjects WHERE school_id = $1 AND id <> $2 AND (code = $3 OR LOWER(name) = LOWER($4))`,
      [schoolId, subjectId, input.code?.toUpperCase() ?? "", input.name ?? ""]
    );
    if (clash.rowCount && clash.rowCount > 0) throw new ConflictError("Another subject already uses that name or code.");
  }

  const result = await query(
    `UPDATE subjects
     SET name = COALESCE($3, name), code = COALESCE($4, code),
         description = CASE WHEN $5::boolean THEN $6 ELSE description END
     WHERE id = $1 AND school_id = $2
     RETURNING ${SUBJECT_SELECT}`,
    [
      subjectId,
      schoolId,
      input.name ?? null,
      input.code?.toUpperCase() ?? null,
      input.description !== undefined,
      input.description ?? null,
    ]
  );
  if (result.rowCount === 0) throw new NotFoundError("Subject not found.");
  return result.rows[0];
}

export async function toggleSubject(schoolId: string, subjectId: string) {
  const result = await query(
    `UPDATE subjects SET is_active = NOT is_active WHERE id = $1 AND school_id = $2 RETURNING ${SUBJECT_SELECT}`,
    [subjectId, schoolId]
  );
  if (result.rowCount === 0) throw new NotFoundError("Subject not found.");
  return result.rows[0];
}

/** The platform-wide catalogue of Nigerian curriculum subjects, marking which ones the school already added. */
export async function listCatalog(schoolId: string) {
  const result = await query(
    `SELECT g.id, g.name, g.code, g.description, g.category,
            EXISTS (
              SELECT 1 FROM subjects s
              WHERE s.school_id = $1 AND (s.global_subject_id = g.id OR LOWER(s.name) = LOWER(g.name))
            ) AS already_added
     FROM global_subjects g
     WHERE g.is_active = TRUE
     ORDER BY g.category, g.name`,
    [schoolId]
  );
  return result.rows;
}

export async function addFromCatalog(schoolId: string, globalSubjectIds: string[]) {
  return withTransaction(async (client) => {
    const added: unknown[] = [];
    const skipped: string[] = [];

    for (const id of globalSubjectIds) {
      const global = await client.query<{ id: string; name: string; code: string | null; description: string | null }>(
        "SELECT id, name, code, description FROM global_subjects WHERE id = $1 AND is_active = TRUE",
        [id]
      );
      if (global.rowCount === 0) continue;
      const subject = global.rows[0];

      const code = (subject.code ?? subject.name.slice(0, 4)).toUpperCase();
      const clash = await client.query(
        "SELECT 1 FROM subjects WHERE school_id = $1 AND (LOWER(name) = LOWER($2) OR code = $3)",
        [schoolId, subject.name, code]
      );
      if (clash.rowCount && clash.rowCount > 0) {
        skipped.push(subject.name);
        continue;
      }

      const inserted = await client.query(
        `INSERT INTO subjects (school_id, name, code, description, global_subject_id, source)
         VALUES ($1, $2, $3, $4, $5, 'GLOBAL') RETURNING ${SUBJECT_SELECT}`,
        [schoolId, subject.name, code, subject.description, subject.id]
      );
      added.push(inserted.rows[0]);
    }
    return { added, skipped };
  });
}
