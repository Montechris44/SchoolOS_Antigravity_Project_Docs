import { UserRole, isAdminRole } from "../../config/rbac";
import { query } from "../../db/pool";
import { ForbiddenError, NotFoundError } from "../http/errors";

export interface AcademicPeriod {
  sessionId: string | null;
  sessionName: string | null;
  termId: string | null;
  termName: string | null;
  termIsActive: boolean;
}

/** Current session and term; falls back to the most recent ones when none is flagged current. */
export async function getCurrentPeriod(schoolId: string): Promise<AcademicPeriod> {
  const term = await query<{
    term_id: string;
    term_name: string;
    is_active: boolean;
    session_id: string;
    session_name: string;
  }>(
    `SELECT t.id AS term_id, t.name AS term_name, t.is_active, s.id AS session_id, s.name AS session_name
     FROM terms t JOIN academic_sessions s ON s.id = t.session_id
     WHERE t.school_id = $1
     ORDER BY t.is_current DESC, s.is_current DESC, t.start_date DESC
     LIMIT 1`,
    [schoolId]
  );

  const row = term.rows[0];
  if (row) {
    return {
      sessionId: row.session_id,
      sessionName: row.session_name,
      termId: row.term_id,
      termName: row.term_name,
      termIsActive: row.is_active,
    };
  }

  const session = await query<{ id: string; name: string }>(
    "SELECT id, name FROM academic_sessions WHERE school_id = $1 ORDER BY is_current DESC, start_date DESC LIMIT 1",
    [schoolId]
  );
  return {
    sessionId: session.rows[0]?.id ?? null,
    sessionName: session.rows[0]?.name ?? null,
    termId: null,
    termName: null,
    termIsActive: true,
  };
}

/**
 * A deactivated term keeps its history readable but is closed for everyone except school admins.
 */
export async function assertTermEditable(schoolId: string, termId: string, role: UserRole): Promise<void> {
  const result = await query<{ is_active: boolean; name: string }>(
    "SELECT is_active, name FROM terms WHERE id = $1 AND school_id = $2",
    [termId, schoolId]
  );
  const term = result.rows[0];
  if (!term) throw new NotFoundError("Term not found.");
  if (!term.is_active && !isAdminRole(role)) {
    throw new ForbiddenError(`${term.name} is deactivated. Only the school administrator can edit its data.`);
  }
}

export interface ClassTeacher {
  id: string;
  fullName: string;
  email: string;
}

/** Class teacher of an arm (or, for schools without arms, of the class itself). */
export async function getClassTeacherForArm(
  schoolId: string,
  classId: string,
  armId?: string | null
): Promise<ClassTeacher | null> {
  const armRow = await query<{ id: string; full_name: string; email: string }>(
    `SELECT p.id, p.full_name, p.email
     FROM class_arms ca JOIN profiles p ON p.id = ca.class_teacher_id
     WHERE ca.school_id = $1 AND ca.class_id = $2 AND ca.class_teacher_id IS NOT NULL
       AND ($3::uuid IS NULL OR ca.id = $3)
     LIMIT 1`,
    [schoolId, classId, armId ?? null]
  );
  if (armRow.rows[0]) {
    return { id: armRow.rows[0].id, fullName: armRow.rows[0].full_name, email: armRow.rows[0].email };
  }

  const classRow = await query<{ id: string; full_name: string; email: string }>(
    `SELECT p.id, p.full_name, p.email
     FROM classes c JOIN profiles p ON p.id = c.class_teacher_id
     WHERE c.school_id = $1 AND c.id = $2 AND c.class_teacher_id IS NOT NULL`,
    [schoolId, classId]
  );
  return classRow.rows[0]
    ? { id: classRow.rows[0].id, fullName: classRow.rows[0].full_name, email: classRow.rows[0].email }
    : null;
}

export interface Homeroom {
  armId: string | null;
  classId: string;
  armName: string | null;
  className: string;
}

/** The class (and arm) a teacher is class teacher of, optionally narrowed to a class/arm the caller asks about. */
export async function getTeacherHomeroom(
  schoolId: string,
  teacherId: string,
  scope?: { classId?: string | null; armId?: string | null }
): Promise<Homeroom | null> {
  const arm = await query<{ arm_id: string; class_id: string; arm_name: string; class_name: string }>(
    `SELECT ca.id AS arm_id, ca.class_id, ca.name AS arm_name, c.name AS class_name
     FROM class_arms ca JOIN classes c ON c.id = ca.class_id
     WHERE ca.school_id = $1 AND ca.class_teacher_id = $2
       AND ($3::uuid IS NULL OR ca.id = $3)
       AND ($4::uuid IS NULL OR ca.class_id = $4)
     ORDER BY c.level NULLS LAST, c.name, ca.name
     LIMIT 1`,
    [schoolId, teacherId, scope?.armId ?? null, scope?.classId ?? null]
  );
  if (arm.rows[0]) {
    return {
      armId: arm.rows[0].arm_id,
      classId: arm.rows[0].class_id,
      armName: arm.rows[0].arm_name,
      className: arm.rows[0].class_name,
    };
  }
  if (scope?.armId) return null;

  const cls = await query<{ class_id: string; class_name: string }>(
    `SELECT c.id AS class_id, c.name AS class_name
     FROM classes c
     WHERE c.school_id = $1 AND c.class_teacher_id = $2 AND ($3::uuid IS NULL OR c.id = $3)
     ORDER BY c.level NULLS LAST, c.name
     LIMIT 1`,
    [schoolId, teacherId, scope?.classId ?? null]
  );
  return cls.rows[0]
    ? { armId: null, classId: cls.rows[0].class_id, armName: null, className: cls.rows[0].class_name }
    : null;
}

/** Subject teachers act only on the class/subject pairs they are assigned to; school admins are exempt. */
export async function assertTeacherAssigned(
  schoolId: string,
  teacherId: string,
  role: UserRole,
  classId: string,
  subjectId: string,
  armId?: string | null
): Promise<void> {
  if (isAdminRole(role)) return;

  const assignment = await query(
    `SELECT 1 FROM teacher_assignments
     WHERE school_id = $1 AND teacher_id = $2 AND class_id = $3 AND subject_id = $4 AND is_active = TRUE
       AND ($5::uuid IS NULL OR arm_id = $5 OR arm_id IS NULL)
     LIMIT 1`,
    [schoolId, teacherId, classId, subjectId, armId ?? null]
  );
  if (assignment.rowCount === 0) {
    throw new ForbiddenError("You are not assigned to teach this subject for this class.");
  }
}

/**
 * Teachers act on a class only if they teach it (any subject) or are its class teacher; school
 * administrators are exempt. Used for attendance, homework and any other per-class teacher action.
 */
export async function assertTeachesClass(
  actor: { userId: string; schoolId: string; role: UserRole },
  classId: string,
  armId?: string | null
): Promise<void> {
  if (isAdminRole(actor.role)) return;

  const assigned = await query(
    `SELECT 1 FROM teacher_assignments
     WHERE school_id = $1 AND teacher_id = $2 AND class_id = $3 AND is_active = TRUE
       AND ($4::uuid IS NULL OR arm_id IS NULL OR arm_id = $4)
     LIMIT 1`,
    [actor.schoolId, actor.userId, classId, armId ?? null]
  );
  if (assigned.rowCount && assigned.rowCount > 0) return;

  const home = await getTeacherHomeroom(actor.schoolId, actor.userId, { classId, armId: armId ?? null });
  if (!home) throw new ForbiddenError("You do not teach this class.");
}
