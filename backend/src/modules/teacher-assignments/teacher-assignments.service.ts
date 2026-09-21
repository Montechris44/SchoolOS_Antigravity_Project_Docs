import { query } from "../../db/pool";
import { recordAuditLog } from "../../shared/audit/audit-log";
import { NotFoundError } from "../../shared/http/errors";
import { assertClassArm, assertOwned, assertSchoolMember, assertTermSession } from "../../shared/security/ownership";

export interface AssignmentInput {
  teacherId: string;
  classId: string;
  armId?: string | null;
  subjectId: string;
  termId?: string | null;
  sessionId?: string | null;
}

const ASSIGNMENT_SELECT = `
  SELECT ta.id, ta.teacher_id, ta.class_id, ta.arm_id, ta.subject_id, ta.term_id, ta.session_id, ta.is_active,
         p.full_name AS teacher_name,
         c.name AS class_name, ca.name AS arm_name,
         CASE WHEN ca.name IS NOT NULL THEN c.name || ' ' || ca.name ELSE c.name END AS class_label,
         s.name AS subject_name, s.code AS subject_code
  FROM teacher_assignments ta
  JOIN profiles p ON p.id = ta.teacher_id
  JOIN classes c ON c.id = ta.class_id
  LEFT JOIN class_arms ca ON ca.id = ta.arm_id
  JOIN subjects s ON s.id = ta.subject_id
`;

export async function listAssignments(schoolId: string, filters: { teacherId?: string; classId?: string }) {
  const result = await query(
    `${ASSIGNMENT_SELECT}
     WHERE ta.school_id = $1 AND ta.is_active = TRUE AND ta.teacher_id IS NOT NULL
       AND ($2::uuid IS NULL OR ta.teacher_id = $2)
       AND ($3::uuid IS NULL OR ta.class_id = $3)
     ORDER BY c.name, ca.name NULLS FIRST, s.name`,
    [schoolId, filters.teacherId ?? null, filters.classId ?? null]
  );
  return result.rows;
}

export async function createAssignment(schoolId: string, actorId: string, input: AssignmentInput) {
  await assertSchoolMember(schoolId, input.teacherId, "Teacher", ["teacher"]);
  await assertClassArm(schoolId, input.classId, input.armId);
  await assertOwned(schoolId, "subjects", input.subjectId, "Subject");
  if (input.termId && input.sessionId) {
    await assertTermSession(schoolId, input.termId, input.sessionId);
  } else if (input.termId) {
    await assertOwned(schoolId, "terms", input.termId, "Term");
  } else if (input.sessionId) {
    await assertOwned(schoolId, "academic_sessions", input.sessionId, "Academic session");
  }

  // The legacy staff_id column still anchors the row to the teacher's staff record.
  const staff = await query<{ id: string }>("SELECT id FROM staff WHERE school_id = $1 AND user_id = $2", [
    schoolId,
    input.teacherId,
  ]);
  if (staff.rowCount === 0) throw new NotFoundError("This teacher has no staff record.");

  const result = await query<{ id: string }>(
    `INSERT INTO teacher_assignments (school_id, staff_id, teacher_id, class_id, arm_id, subject_id, term_id, session_id, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE)
     ON CONFLICT (school_id, teacher_id, class_id, subject_id, COALESCE(arm_id, '00000000-0000-0000-0000-000000000000'::uuid))
       WHERE teacher_id IS NOT NULL AND subject_id IS NOT NULL
     DO UPDATE SET is_active = TRUE, term_id = EXCLUDED.term_id, session_id = EXCLUDED.session_id
     RETURNING id`,
    [
      schoolId,
      staff.rows[0].id,
      input.teacherId,
      input.classId,
      input.armId ?? null,
      input.subjectId,
      input.termId ?? null,
      input.sessionId ?? null,
    ]
  );

  await recordAuditLog({
    schoolId,
    userId: actorId,
    action: "teacher_assignment.created",
    resourceType: "teacher_assignment",
    resourceId: result.rows[0].id,
    payload: { teacherId: input.teacherId, classId: input.classId, subjectId: input.subjectId },
  });

  const created = await query(`${ASSIGNMENT_SELECT} WHERE ta.id = $1 AND ta.school_id = $2`, [
    result.rows[0].id,
    schoolId,
  ]);
  return created.rows[0];
}

export async function deleteAssignment(schoolId: string, actorId: string, assignmentId: string): Promise<void> {
  const result = await query("DELETE FROM teacher_assignments WHERE id = $1 AND school_id = $2", [
    assignmentId,
    schoolId,
  ]);
  if (result.rowCount === 0) throw new NotFoundError("Assignment not found.");

  await recordAuditLog({
    schoolId,
    userId: actorId,
    action: "teacher_assignment.deleted",
    resourceType: "teacher_assignment",
    resourceId: assignmentId,
  });
}
