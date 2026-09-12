import { query } from "../../db/pool";
import { ConflictError, NotFoundError } from "../../shared/http/errors";
import { CreateClassInput } from "./classes.schemas";

const CLASS_SELECT = `
  SELECT
    c.id, c.school_id, c.name, c.grade_level, c.capacity,
    ct.staff_id AS class_teacher_id,
    st.first_name AS class_teacher_first_name,
    st.last_name AS class_teacher_last_name
  FROM classes c
  LEFT JOIN teacher_assignments ct ON ct.class_id = c.id AND ct.is_class_teacher = TRUE
  LEFT JOIN staff st ON st.id = ct.staff_id
`;

interface ClassRow {
  id: string;
  school_id: string;
  name: string;
  grade_level: string;
  capacity: number;
  class_teacher_id: string | null;
  class_teacher_first_name: string | null;
  class_teacher_last_name: string | null;
}

function toClassRecord(row: ClassRow) {
  return {
    id: row.id,
    school_id: row.school_id,
    name: row.name,
    grade_level: row.grade_level,
    capacity: row.capacity,
    class_teacher_id: row.class_teacher_id,
    class_teacher_name: row.class_teacher_id ? `${row.class_teacher_first_name} ${row.class_teacher_last_name}` : null,
  };
}

export async function listClasses(schoolId: string) {
  const result = await query<ClassRow>(`${CLASS_SELECT} WHERE c.school_id = $1 ORDER BY c.name ASC`, [schoolId]);
  return result.rows.map(toClassRecord);
}

export async function createClass(schoolId: string, input: CreateClassInput) {
  const existing = await query<{ id: string }>("SELECT id FROM classes WHERE school_id = $1 AND name = $2", [
    schoolId,
    input.name,
  ]);

  if (existing.rowCount && existing.rowCount > 0) {
    throw new ConflictError(`A class named '${input.name}' already exists.`);
  }

  const result = await query<{ id: string }>(
    `INSERT INTO classes (school_id, name, grade_level, capacity) VALUES ($1, $2, $3, $4) RETURNING id`,
    [schoolId, input.name, input.gradeLevel, input.capacity]
  );

  return getClassById(schoolId, result.rows[0].id);
}

export async function getClassById(schoolId: string, classId: string) {
  const result = await query<ClassRow>(`${CLASS_SELECT} WHERE c.school_id = $1 AND c.id = $2`, [schoolId, classId]);

  if (result.rowCount === 0) {
    throw new NotFoundError("Class not found.");
  }

  return toClassRecord(result.rows[0]);
}
