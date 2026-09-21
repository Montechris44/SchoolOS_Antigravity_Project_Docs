import { isAdminRole } from "../../config/rbac";
import { AuthenticatedUser } from "../../middleware/auth";
import { query } from "../../db/pool";
import { NotFoundError } from "../../shared/http/errors";
import { getStudentById } from "../students/students.service";

/**
 * Results as students and parents see them. Only PUBLISHED results are ever returned — this is enforced here,
 * in the query, not left to the screen to hide. Staff (administrators and the teachers of that class) can read
 * any status through getStaffResult.
 */
export async function getPublishedResults(
  actor: AuthenticatedUser,
  studentId: string,
  params: { termId?: string; sessionId?: string } = {}
) {
  // Visibility rules: a student reads only their own record, a parent only their children, a teacher their classes.
  await getStudentById(actor, studentId);
  return loadResults(actor.schoolId, studentId, { ...params, publishedOnly: true });
}

/** The signed-in student's own published results. */
export async function getMyPublishedResults(actor: AuthenticatedUser, params: { termId?: string; sessionId?: string } = {}) {
  const student = await query<{ id: string }>("SELECT id FROM students WHERE user_id = $1 AND school_id = $2", [
    actor.userId,
    actor.schoolId,
  ]);
  if (student.rowCount === 0) throw new NotFoundError("No student record is linked to this account.");
  return loadResults(actor.schoolId, student.rows[0].id, { ...params, publishedOnly: true });
}

/** Any status, for administrators and the teachers of that student's class. */
export async function getStaffResult(actor: AuthenticatedUser, studentId: string, termId: string) {
  await getStudentById(actor, studentId);
  const results = await loadResults(actor.schoolId, studentId, { termId, publishedOnly: false });
  return results[0] ?? null;
}

async function loadResults(
  schoolId: string,
  studentId: string,
  params: { termId?: string; sessionId?: string; publishedOnly: boolean }
) {
  const results = await query<Record<string, any>>(
    `SELECT r.id, r.student_id, r.class_id, r.arm_id, r.term_id, r.session_id, r.approval_status,
            r.total_score, r.average_score, r.position, r.position_suffix, r.class_size, r.total_subjects,
            r.passed_subjects, r.failed_subjects, r.teacher_remark, r.principal_remark, r.published_at,
            c.name AS class_name, a.name AS arm_name, t.name AS term_name, t.start_date AS term_start_date,
            t.end_date AS term_end_date, sess.name AS session_name
     FROM results r
     JOIN classes c ON c.id = r.class_id
     LEFT JOIN class_arms a ON a.id = r.arm_id
     JOIN terms t ON t.id = r.term_id
     JOIN academic_sessions sess ON sess.id = r.session_id
     WHERE r.school_id = $1 AND r.student_id = $2
       AND ($3::uuid IS NULL OR r.term_id = $3) AND ($4::uuid IS NULL OR r.session_id = $4)
       AND ($5::boolean = FALSE OR r.approval_status = 'PUBLISHED')
     ORDER BY t.start_date DESC`,
    [schoolId, studentId, params.termId ?? null, params.sessionId ?? null, params.publishedOnly]
  );

  const withSubjects: Array<Record<string, any>> = [];
  for (const result of results.rows) {
    const subjects = await query<Record<string, any>>(
      `SELECT sub.id AS subject_id, sub.name AS subject_name, sub.code AS subject_code, p.full_name AS teacher_name,
              re.ca_components, re.exam_score, re.computed_total AS total_score, re.grade, re.remark AS grade_remark,
              re.subject_remark, re.scores_complete
       FROM result_entries re
       JOIN subjects sub ON sub.id = re.subject_id
       LEFT JOIN profiles p ON p.id = re.teacher_id
       WHERE re.result_id = $1
         AND ($2::boolean = FALSE OR re.scores_complete)
       ORDER BY sub.name`,
      [result.id, params.publishedOnly]
    );

    // Until the class is released, the position is provisional and is not shown to anyone.
    const released = result.approval_status === "PUBLISHED";
    withSubjects.push({
      ...result,
      position: released ? result.position : null,
      position_suffix: released ? result.position_suffix : null,
      subjects: subjects.rows.map((subject) => ({
        ...subject,
        ca_components: typeof subject.ca_components === "string" ? JSON.parse(subject.ca_components) : subject.ca_components,
      })),
    });
  }
  return withSubjects;
}

export async function resolveStudentIdForReport(actor: AuthenticatedUser, studentId?: string): Promise<string> {
  if (actor.role === "student") {
    const own = await query<{ id: string }>("SELECT id FROM students WHERE user_id = $1 AND school_id = $2", [
      actor.userId,
      actor.schoolId,
    ]);
    if (own.rowCount === 0) throw new NotFoundError("No student record is linked to this account.");
    return own.rows[0].id;
  }
  if (!studentId) throw new NotFoundError("Choose a student.");
  await getStudentById(actor, studentId);
  return studentId;
}

export function canSeeUnpublished(actor: AuthenticatedUser): boolean {
  return isAdminRole(actor.role) || actor.role === "teacher";
}
