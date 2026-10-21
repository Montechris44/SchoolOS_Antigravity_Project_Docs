import { query } from "../../db/pool";
import { PeopleKind, resolveFields } from "./people-fields";

export async function loadPeopleFields(schoolId: string, kind: PeopleKind) {
  const result = await query("SELECT student_fields, teacher_fields FROM school_settings WHERE school_id = $1", [schoolId]);
  return resolveFields(kind, result.rows[0]?.[`${kind}_fields`] ?? []);
}
