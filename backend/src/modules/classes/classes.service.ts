import { PoolClient } from "pg";

import { withTransaction, query } from "../../db/pool";
import { recordAuditLog } from "../../shared/audit/audit-log";
import { BadRequestError, ConflictError, NotFoundError } from "../../shared/http/errors";
import { assertOwned, assertSchoolMember } from "../../shared/security/ownership";
import { CreateClassInput } from "./classes.schemas";

// The class teacher lives on the class (schools without arms) or on each arm. The legacy
// teacher_assignments.is_class_teacher marker is still honoured as a fallback for older data.
const CLASS_SELECT = `
  SELECT
    c.id, c.school_id, c.name, c.grade_level, c.capacity, c.level, c.description,
    COALESCE(c.class_teacher_id, legacy.user_id) AS class_teacher_id,
    COALESCE(ctp.full_name, legacy.first_name || ' ' || legacy.last_name) AS class_teacher_name,
    (SELECT COUNT(*)::int FROM students s WHERE s.current_class_id = c.id AND s.enrollment_status = 'active') AS student_count,
    COALESCE((
      SELECT json_agg(json_build_object(
        'id', ca.id, 'name', ca.name, 'capacity', ca.capacity,
        'class_teacher_id', ca.class_teacher_id, 'class_teacher_name', atp.full_name,
        'student_count', (SELECT COUNT(*)::int FROM students s WHERE s.arm_id = ca.id AND s.enrollment_status = 'active')
      ) ORDER BY ca.name)
      FROM class_arms ca LEFT JOIN profiles atp ON atp.id = ca.class_teacher_id
      WHERE ca.class_id = c.id
    ), '[]'::json) AS arms
  FROM classes c
  LEFT JOIN profiles ctp ON ctp.id = c.class_teacher_id
  LEFT JOIN LATERAL (
    SELECT st.user_id, st.first_name, st.last_name
    FROM teacher_assignments ta JOIN staff st ON st.id = ta.staff_id
    WHERE ta.class_id = c.id AND ta.is_class_teacher = TRUE
    LIMIT 1
  ) legacy ON c.class_teacher_id IS NULL
`;

export async function listClasses(schoolId: string) {
  const result = await query(`${CLASS_SELECT} WHERE c.school_id = $1 ORDER BY c.level NULLS LAST, c.name ASC`, [schoolId]);
  return result.rows;
}

export async function getClassById(schoolId: string, classId: string) {
  const result = await query(`${CLASS_SELECT} WHERE c.school_id = $1 AND c.id = $2`, [schoolId, classId]);

  if (result.rowCount === 0) {
    throw new NotFoundError("Class not found.");
  }

  return result.rows[0];
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
    `INSERT INTO classes (school_id, name, grade_level, capacity, level, description)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [schoolId, input.name, input.gradeLevel, input.capacity, input.level ?? null, input.description ?? null]
  );

  return getClassById(schoolId, result.rows[0].id);
}

export async function deleteClass(schoolId: string, actorId: string, classId: string): Promise<void> {
  const students = await query("SELECT 1 FROM students WHERE school_id = $1 AND current_class_id = $2 LIMIT 1", [
    schoolId,
    classId,
  ]);
  if (students.rowCount && students.rowCount > 0) {
    throw new ConflictError("This class still has students. Move or remove them before deleting the class.");
  }

  const result = await query<{ name: string }>("DELETE FROM classes WHERE id = $1 AND school_id = $2 RETURNING name", [
    classId,
    schoolId,
  ]);
  if (result.rowCount === 0) throw new NotFoundError("Class not found.");

  await recordAuditLog({
    schoolId,
    userId: actorId,
    action: "class.deleted",
    resourceType: "class",
    resourceId: classId,
    payload: { name: result.rows[0].name },
  });
}

// ---------------------------------------------------------------------------
// Arms (e.g. JSS 1 → A, B, C)
// ---------------------------------------------------------------------------

export async function createArm(schoolId: string, input: { classId: string; name: string; capacity: number }) {
  await assertOwned(schoolId, "classes", input.classId, "Class");

  const existing = await query("SELECT 1 FROM class_arms WHERE class_id = $1 AND name = $2", [input.classId, input.name]);
  if (existing.rowCount && existing.rowCount > 0) {
    throw new ConflictError(`Arm '${input.name}' already exists for this class.`);
  }

  await withTransaction(async (client) => {
    // A class that starts using arms hands its class-teacher role over to the arms.
    await client.query("UPDATE classes SET class_teacher_id = NULL WHERE id = $1 AND school_id = $2", [
      input.classId,
      schoolId,
    ]);
    await client.query("INSERT INTO class_arms (school_id, class_id, name, capacity) VALUES ($1, $2, $3, $4)", [
      schoolId,
      input.classId,
      input.name,
      input.capacity,
    ]);
  });

  return getClassById(schoolId, input.classId);
}

export async function updateArm(schoolId: string, armId: string, input: { name?: string; capacity?: number }) {
  await assertOwned(schoolId, "class_arms", armId, "Arm");

  const arm = await query<{ class_id: string }>(
    `UPDATE class_arms SET name = COALESCE($3, name), capacity = COALESCE($4, capacity)
     WHERE id = $1 AND school_id = $2 RETURNING class_id`,
    [armId, schoolId, input.name ?? null, input.capacity ?? null]
  );
  return getClassById(schoolId, arm.rows[0].class_id);
}

export async function deleteArm(schoolId: string, actorId: string, armId: string): Promise<void> {
  const students = await query("SELECT 1 FROM students WHERE school_id = $1 AND arm_id = $2 LIMIT 1", [schoolId, armId]);
  if (students.rowCount && students.rowCount > 0) {
    throw new ConflictError("This arm still has students. Move them before deleting the arm.");
  }

  const result = await query<{ name: string }>("DELETE FROM class_arms WHERE id = $1 AND school_id = $2 RETURNING name", [
    armId,
    schoolId,
  ]);
  if (result.rowCount === 0) throw new NotFoundError("Arm not found.");

  await recordAuditLog({
    schoolId,
    userId: actorId,
    action: "class_arm.deleted",
    resourceType: "class_arm",
    resourceId: armId,
    payload: { name: result.rows[0].name },
  });
}

// ---------------------------------------------------------------------------
// Class teacher: exactly one class or arm per teacher
// ---------------------------------------------------------------------------

async function clearTeacherElsewhere(client: PoolClient, schoolId: string, teacherId: string) {
  await client.query("UPDATE class_arms SET class_teacher_id = NULL WHERE school_id = $1 AND class_teacher_id = $2", [
    schoolId,
    teacherId,
  ]);
  await client.query("UPDATE classes SET class_teacher_id = NULL WHERE school_id = $1 AND class_teacher_id = $2", [
    schoolId,
    teacherId,
  ]);
}

export async function assignArmClassTeacher(schoolId: string, actorId: string, armId: string, teacherId: string) {
  await assertOwned(schoolId, "class_arms", armId, "Arm");
  await assertSchoolMember(schoolId, teacherId, "Teacher", ["teacher"]);

  await withTransaction(async (client) => {
    await clearTeacherElsewhere(client, schoolId, teacherId);
    await client.query("UPDATE class_arms SET class_teacher_id = $1 WHERE id = $2 AND school_id = $3", [
      teacherId,
      armId,
      schoolId,
    ]);
  });

  await recordAuditLog({
    schoolId,
    userId: actorId,
    action: "class_arm.teacher_assigned",
    resourceType: "class_arm",
    resourceId: armId,
    payload: { teacherId },
  });
}

export async function clearArmClassTeacher(schoolId: string, actorId: string, armId: string) {
  const result = await query("UPDATE class_arms SET class_teacher_id = NULL WHERE id = $1 AND school_id = $2", [
    armId,
    schoolId,
  ]);
  if (result.rowCount === 0) throw new NotFoundError("Arm not found.");

  await recordAuditLog({
    schoolId,
    userId: actorId,
    action: "class_arm.teacher_cleared",
    resourceType: "class_arm",
    resourceId: armId,
  });
}

export async function assignClassLevelTeacher(schoolId: string, actorId: string, classId: string, teacherId: string) {
  await assertOwned(schoolId, "classes", classId, "Class");
  await assertSchoolMember(schoolId, teacherId, "Teacher", ["teacher"]);

  const arms = await query("SELECT 1 FROM class_arms WHERE class_id = $1 AND school_id = $2 LIMIT 1", [classId, schoolId]);
  if (arms.rowCount && arms.rowCount > 0) {
    throw new BadRequestError("This class has arms. Assign a class teacher on each arm instead.");
  }

  await withTransaction(async (client) => {
    await clearTeacherElsewhere(client, schoolId, teacherId);
    await client.query("UPDATE classes SET class_teacher_id = $1 WHERE id = $2 AND school_id = $3", [
      teacherId,
      classId,
      schoolId,
    ]);
  });

  await recordAuditLog({
    schoolId,
    userId: actorId,
    action: "class.teacher_assigned",
    resourceType: "class",
    resourceId: classId,
    payload: { teacherId },
  });
}

export async function clearClassLevelTeacher(schoolId: string, actorId: string, classId: string) {
  const result = await query("UPDATE classes SET class_teacher_id = NULL WHERE id = $1 AND school_id = $2", [
    classId,
    schoolId,
  ]);
  if (result.rowCount === 0) throw new NotFoundError("Class not found.");

  await recordAuditLog({
    schoolId,
    userId: actorId,
    action: "class.teacher_cleared",
    resourceType: "class",
    resourceId: classId,
  });
}
