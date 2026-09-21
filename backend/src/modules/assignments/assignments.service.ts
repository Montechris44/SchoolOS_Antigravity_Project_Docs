import { isAdminRole } from "../../config/rbac";
import { AuthenticatedUser } from "../../middleware/auth";
import { query } from "../../db/pool";
import { assertTeachesClass } from "../../shared/academics/period";
import { notifyUser } from "../../shared/academics/notifications";
import { recordAuditLog } from "../../shared/audit/audit-log";
import { BadRequestError, ConflictError, NotFoundError } from "../../shared/http/errors";
import { assertClassArm, assertOwned } from "../../shared/security/ownership";

export interface AssignmentInput {
  classId: string;
  armId?: string | null;
  subjectId?: string | null;
  title: string;
  description?: string | null;
  points?: number;
  dueDate?: string | null;
}

const ASSIGNMENT_COLUMNS = `
  a.id, a.class_id, a.arm_id, a.subject_id, a.teacher_id, a.title, a.description, a.points, a.due_date, a.status, a.created_at,
  c.name AS class_name, ca.name AS arm_name, s.name AS subject_name, p.full_name AS teacher_name`;

const ASSIGNMENT_FROM = `
  FROM assignments a
  JOIN classes c ON c.id = a.class_id
  LEFT JOIN class_arms ca ON ca.id = a.arm_id
  LEFT JOIN subjects s ON s.id = a.subject_id
  LEFT JOIN profiles p ON p.id = a.teacher_id`;

const ASSIGNMENT_SELECT = `SELECT ${ASSIGNMENT_COLUMNS} ${ASSIGNMENT_FROM}`;

export async function createAssignment(actor: AuthenticatedUser, input: AssignmentInput) {
  await assertClassArm(actor.schoolId, input.classId, input.armId);
  if (input.subjectId) await assertOwned(actor.schoolId, "subjects", input.subjectId, "Subject");
  await assertTeachesClass(actor, input.classId, input.armId);

  const created = await query<{ id: string }>(
    `INSERT INTO assignments (school_id, class_id, arm_id, subject_id, teacher_id, title, description, points, due_date)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
    [
      actor.schoolId,
      input.classId,
      input.armId ?? null,
      input.subjectId ?? null,
      actor.userId,
      input.title,
      input.description ?? null,
      input.points ?? 100,
      input.dueDate ?? null,
    ]
  );

  // Tell the class about it.
  await query(
    `INSERT INTO notifications (school_id, user_id, type, title, message, entity_type, entity_id)
     SELECT $1, s.user_id, 'ASSIGNMENT_POSTED', 'New assignment', $4, 'assignment', $5
     FROM students s
     WHERE s.school_id = $1 AND s.current_class_id = $2 AND s.enrollment_status = 'active' AND s.user_id IS NOT NULL
       AND ($3::uuid IS NULL OR s.arm_id = $3)`,
    [actor.schoolId, input.classId, input.armId ?? null, input.title, created.rows[0].id]
  );

  await recordAuditLog({ schoolId: actor.schoolId, userId: actor.userId, action: "assignment.created", resourceType: "assignment", resourceId: created.rows[0].id });
  return getAssignment(actor, created.rows[0].id);
}

async function getAssignment(actor: AuthenticatedUser, id: string) {
  const result = await query(`${ASSIGNMENT_SELECT} WHERE a.id = $1 AND a.school_id = $2`, [id, actor.schoolId]);
  if (result.rowCount === 0) throw new NotFoundError("Assignment not found.");
  return result.rows[0];
}

/** Teachers see the assignments they set; administrators see all (optionally for one class). */
export async function listAssignments(actor: AuthenticatedUser, filters: { classId?: string }) {
  const result = await query(
    `SELECT ${ASSIGNMENT_COLUMNS}, counts.submitted_count, counts.graded_count ${ASSIGNMENT_FROM}
     CROSS JOIN LATERAL (SELECT COUNT(*) FILTER (WHERE sub.status IN ('SUBMITTED', 'GRADED'))::int AS submitted_count,
                                COUNT(*) FILTER (WHERE sub.status = 'GRADED')::int AS graded_count
                         FROM assignment_submissions sub WHERE sub.assignment_id = a.id) counts
     WHERE a.school_id = $1 AND ($2::boolean OR a.teacher_id = $3) AND ($4::uuid IS NULL OR a.class_id = $4)
     ORDER BY a.due_date DESC NULLS LAST, a.created_at DESC`,
    [actor.schoolId, isAdminRole(actor.role), actor.userId, filters.classId ?? null]
  );
  return result.rows;
}

async function assertOwnsAssignment(actor: AuthenticatedUser, id: string) {
  const assignment = await getAssignment(actor, id);
  if (!isAdminRole(actor.role) && assignment.teacher_id !== actor.userId) {
    throw new NotFoundError("Assignment not found.");
  }
  return assignment;
}

export async function deleteAssignment(actor: AuthenticatedUser, id: string): Promise<void> {
  await assertOwnsAssignment(actor, id);
  await query("DELETE FROM assignments WHERE id = $1 AND school_id = $2", [id, actor.schoolId]);
  await recordAuditLog({ schoolId: actor.schoolId, userId: actor.userId, action: "assignment.deleted", resourceType: "assignment", resourceId: id });
}

export async function listSubmissions(actor: AuthenticatedUser, assignmentId: string) {
  const assignment = await assertOwnsAssignment(actor, assignmentId);

  const roster = await query(
    `SELECT s.id AS student_id, s.admission_number, s.first_name, s.last_name,
            COALESCE(sub.status, 'NOT_STARTED') AS status, sub.submission_text, sub.grade_score, sub.feedback, sub.submitted_at,
            COALESCE((SELECT json_agg(json_build_object('id', f.id, 'name', f.name, 'url', f.url, 'mime_type', f.mime_type))
                      FROM assignment_files f WHERE f.submission_id = sub.id), '[]') AS files
     FROM students s
     LEFT JOIN assignment_submissions sub ON sub.student_id = s.id AND sub.assignment_id = $3
     WHERE s.school_id = $1 AND s.current_class_id = $2 AND s.enrollment_status = 'active'
       AND ($4::uuid IS NULL OR s.arm_id = $4)
     ORDER BY s.last_name, s.first_name`,
    [actor.schoolId, assignment.class_id, assignmentId, assignment.arm_id]
  );
  return { assignment, submissions: roster.rows };
}

export async function gradeSubmission(
  actor: AuthenticatedUser,
  assignmentId: string,
  studentId: string,
  input: { gradeScore: number; feedback?: string | null }
) {
  const assignment = await assertOwnsAssignment(actor, assignmentId);
  if (input.gradeScore > assignment.points) {
    throw new BadRequestError(`The score cannot be more than ${assignment.points}.`);
  }

  const student = await query<{ user_id: string | null }>(
    "SELECT user_id FROM students WHERE id = $1 AND school_id = $2 AND current_class_id = $3",
    [studentId, actor.schoolId, assignment.class_id]
  );
  if (student.rowCount === 0) throw new NotFoundError("Student not found in this class.");

  await query(
    `INSERT INTO assignment_submissions (school_id, assignment_id, student_id, status, grade_score, feedback)
     VALUES ($1, $2, $3, 'GRADED', $4, $5)
     ON CONFLICT (assignment_id, student_id) DO UPDATE SET status = 'GRADED', grade_score = EXCLUDED.grade_score, feedback = EXCLUDED.feedback`,
    [actor.schoolId, assignmentId, studentId, input.gradeScore, input.feedback ?? null]
  );

  if (student.rows[0].user_id) {
    await notifyUser(actor.schoolId, student.rows[0].user_id, {
      type: "ASSIGNMENT_GRADED",
      title: "Assignment graded",
      message: `${assignment.title}: ${input.gradeScore}/${assignment.points}`,
      entityType: "assignment",
      entityId: assignmentId,
    });
  }
  return listSubmissions(actor, assignmentId);
}

// ---- Student self-service --------------------------------------------------------

async function ownStudent(actor: AuthenticatedUser) {
  const result = await query<{ id: string; class_id: string; arm_id: string | null }>(
    `SELECT id, current_class_id AS class_id, arm_id FROM students
     WHERE user_id = $1 AND school_id = $2 AND enrollment_status = 'active'`,
    [actor.userId, actor.schoolId]
  );
  if (result.rowCount === 0) throw new NotFoundError("No active student record is linked to this account.");
  return result.rows[0];
}

export async function listMyAssignments(actor: AuthenticatedUser) {
  const student = await ownStudent(actor);
  const result = await query(
    `SELECT ${ASSIGNMENT_COLUMNS}, COALESCE(sub.status, 'NOT_STARTED') AS submission_status, sub.grade_score, sub.feedback,
            sub.submitted_at, sub.submission_text ${ASSIGNMENT_FROM}
     LEFT JOIN assignment_submissions sub ON sub.assignment_id = a.id AND sub.student_id = $3
     WHERE a.school_id = $1 AND a.class_id = $2 AND a.status <> 'DRAFT' AND (a.arm_id IS NULL OR a.arm_id = $4)
     ORDER BY a.due_date ASC NULLS LAST, a.created_at DESC`,
    [actor.schoolId, student.class_id, student.id, student.arm_id]
  );
  return result.rows;
}

export async function getMyAssignmentSummary(actor: AuthenticatedUser) {
  const items = await listMyAssignments(actor);
  const now = Date.now();
  const open = items.filter((item) => item.submission_status === "NOT_STARTED" || item.submission_status === "IN_PROGRESS");
  return {
    total: items.length,
    pending: open.length,
    overdue: open.filter((item) => item.due_date && new Date(item.due_date).getTime() < now).length,
    submitted: items.filter((item) => item.submission_status === "SUBMITTED").length,
    graded: items.filter((item) => item.submission_status === "GRADED").length,
  };
}

export async function updateMySubmission(
  actor: AuthenticatedUser,
  assignmentId: string,
  input: { submissionText?: string | null; status: "IN_PROGRESS" | "SUBMITTED" }
) {
  const student = await ownStudent(actor);

  const assignment = await query<{ due_date: string | null; status: string }>(
    `SELECT due_date, status FROM assignments
     WHERE id = $1 AND school_id = $2 AND class_id = $3 AND (arm_id IS NULL OR arm_id = $4) AND status <> 'DRAFT'`,
    [assignmentId, actor.schoolId, student.class_id, student.arm_id]
  );
  if (assignment.rowCount === 0) throw new NotFoundError("Assignment not found.");
  if (assignment.rows[0].status === "CLOSED") throw new ConflictError("This assignment is closed.");

  const existing = await query<{ status: string }>("SELECT status FROM assignment_submissions WHERE assignment_id = $1 AND student_id = $2", [
    assignmentId,
    student.id,
  ]);
  if (existing.rows[0]?.status === "GRADED") throw new ConflictError("This assignment has already been graded.");

  await query(
    `INSERT INTO assignment_submissions (school_id, assignment_id, student_id, status, submission_text, submitted_at)
     VALUES ($1, $2, $3, $4, $5, CASE WHEN $4 = 'SUBMITTED' THEN NOW() ELSE NULL END)
     ON CONFLICT (assignment_id, student_id) DO UPDATE
       SET status = EXCLUDED.status, submission_text = EXCLUDED.submission_text,
           submitted_at = CASE WHEN EXCLUDED.status = 'SUBMITTED' THEN NOW() ELSE assignment_submissions.submitted_at END`,
    [actor.schoolId, assignmentId, student.id, input.status, input.submissionText ?? null]
  );
  return (await listMyAssignments(actor)).find((item) => item.id === assignmentId);
}

export async function attachSubmissionFile(
  actor: AuthenticatedUser,
  assignmentId: string,
  file: { name: string; url: string; mimeType: string; publicId: string; bytes: number }
) {
  const student = await ownStudent(actor);
  const submission = await query<{ id: string; status: string }>(
    `INSERT INTO assignment_submissions (school_id, assignment_id, student_id, status)
     SELECT $1, a.id, $3, 'IN_PROGRESS' FROM assignments a
     WHERE a.id = $2 AND a.school_id = $1 AND a.class_id = $4 AND (a.arm_id IS NULL OR a.arm_id = $5) AND a.status = 'PUBLISHED'
     ON CONFLICT (assignment_id, student_id) DO UPDATE SET updated_at = NOW()
     RETURNING id, status`,
    [actor.schoolId, assignmentId, student.id, student.class_id, student.arm_id]
  );
  if (submission.rowCount === 0) throw new NotFoundError("Assignment not found.");
  if (submission.rows[0].status === "GRADED") throw new ConflictError("This assignment has already been graded.");

  const files = await query<{ n: number }>("SELECT COUNT(*)::int AS n FROM assignment_files WHERE submission_id = $1", [submission.rows[0].id]);
  if (files.rows[0].n >= 5) throw new BadRequestError("You can attach at most 5 files.");

  await query(
    `INSERT INTO assignment_files (school_id, submission_id, name, url, mime_type, public_id, bytes) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [actor.schoolId, submission.rows[0].id, file.name.slice(0, 200), file.url, file.mimeType, file.publicId, file.bytes]
  );
  return { attached: true };
}
