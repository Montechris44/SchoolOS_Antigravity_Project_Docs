import bcrypt from "bcryptjs";
import { PoolClient } from "pg";

import { env } from "../../config/env";
import { isAdminRole } from "../../config/rbac";
import { AuthenticatedUser } from "../../middleware/auth";
import { query, withTransaction } from "../../db/pool";
import { recordAuditLog } from "../../shared/audit/audit-log";
import { ConflictError, NotFoundError } from "../../shared/http/errors";
import { generateTemporaryPassword } from "../../shared/security/credentials";
import { assertClassArm } from "../../shared/security/ownership";
import { buildStudentEmail } from "../../shared/text/names";
import { getCurrentPeriod } from "../../shared/academics/period";
import { findOrCreateGuardian } from "../guardians/guardians.service";
import { CreateStudentInput, UpdateStudentInput } from "./students.schemas";

const BCRYPT_ROUNDS = 12;

const STUDENT_SELECT = `
  SELECT
    s.id, s.school_id, s.user_id, s.admission_number, s.first_name, s.last_name, s.middle_name,
    s.gender, s.date_of_birth, s.current_class_id, s.arm_id, s.guardian_id,
    s.enrollment_status, s.enrolled_date, s.photo_url, s.address, s.blood_group, s.genotype,
    c.name AS current_class_name, ca.name AS arm_name,
    CASE WHEN ca.name IS NOT NULL THEN c.name || ' ' || ca.name ELSE c.name END AS class_label,
    g.first_name AS guardian_first_name, g.last_name AS guardian_last_name,
    g.phone AS guardian_phone, g.email AS guardian_email, g.relationship AS guardian_relationship,
    p.email AS login_email, p.last_login_at, p.force_password_change
  FROM students s
  JOIN classes c ON c.id = s.current_class_id
  LEFT JOIN class_arms ca ON ca.id = s.arm_id
  LEFT JOIN guardians g ON g.id = s.guardian_id
  LEFT JOIN profiles p ON p.id = s.user_id
`;

interface StudentRow {
  id: string;
  school_id: string;
  user_id: string | null;
  admission_number: string;
  first_name: string;
  last_name: string;
  middle_name: string | null;
  gender: string;
  date_of_birth: string | null;
  current_class_id: string;
  arm_id: string | null;
  guardian_id: string | null;
  enrollment_status: string;
  enrolled_date: string;
  photo_url: string | null;
  address: string | null;
  blood_group: string | null;
  genotype: string | null;
  current_class_name: string;
  arm_name: string | null;
  class_label: string;
  guardian_first_name: string | null;
  guardian_last_name: string | null;
  guardian_phone: string | null;
  guardian_email: string | null;
  guardian_relationship: string | null;
  login_email: string | null;
  last_login_at: string | null;
  force_password_change: boolean | null;
}

function toStudentRecord(row: StudentRow) {
  return {
    id: row.id,
    school_id: row.school_id,
    user_id: row.user_id,
    admission_number: row.admission_number,
    first_name: row.first_name,
    last_name: row.last_name,
    middle_name: row.middle_name,
    gender: row.gender,
    date_of_birth: row.date_of_birth,
    current_class_id: row.current_class_id,
    current_class_name: row.current_class_name,
    arm_id: row.arm_id,
    arm_name: row.arm_name,
    class_label: row.class_label,
    guardian_id: row.guardian_id,
    guardian_name: row.guardian_id ? `${row.guardian_first_name} ${row.guardian_last_name}` : null,
    guardian_phone: row.guardian_phone,
    guardian_email: row.guardian_email,
    guardian_relationship: row.guardian_relationship,
    enrollment_status: row.enrollment_status,
    enrolled_date: row.enrolled_date,
    photo_url: row.photo_url,
    address: row.address,
    blood_group: row.blood_group,
    genotype: row.genotype,
    login_email: row.login_email,
    has_login: row.user_id !== null,
    last_login_at: row.last_login_at,
    must_change_password: row.force_password_change ?? false,
  };
}

/**
 * Which students a caller may see. Administrators, bursars see everyone; a teacher only the classes
 * they teach or are class teacher of; a student only themselves; a parent only their own children.
 * (Previously every signed-in role with students:view could list the whole school.)
 */
function visibilityClause(actor: AuthenticatedUser, params: unknown[]): string {
  if (isAdminRole(actor.role) || actor.role === "bursar") return "TRUE";

  params.push(actor.userId);
  const userParam = `$${params.length}`;

  switch (actor.role) {
    case "teacher":
      // An assignment to a specific arm covers that arm only; an assignment without an arm covers the class.
      return `(
        EXISTS (
          SELECT 1 FROM teacher_assignments ta
          WHERE ta.school_id = s.school_id AND ta.teacher_id = ${userParam} AND ta.is_active = TRUE
            AND ta.class_id = s.current_class_id AND (ta.arm_id IS NULL OR ta.arm_id = s.arm_id)
        )
        OR s.current_class_id IN (SELECT id FROM classes WHERE school_id = s.school_id AND class_teacher_id = ${userParam})
        OR s.arm_id IN (SELECT id FROM class_arms WHERE school_id = s.school_id AND class_teacher_id = ${userParam})
      )`;
    case "student":
      return `s.user_id = ${userParam}`;
    case "parent":
      return `s.guardian_id IN (SELECT id FROM guardians WHERE school_id = s.school_id AND user_id = ${userParam})`;
    default:
      return "FALSE";
  }
}

export async function listStudents(
  actor: AuthenticatedUser,
  filters: { classId?: string; armId?: string; status?: string; search?: string } = {}
) {
  const params: unknown[] = [actor.schoolId];
  const conditions = ["s.school_id = $1"];

  if (filters.classId) {
    params.push(filters.classId);
    conditions.push(`s.current_class_id = $${params.length}`);
  }
  if (filters.armId) {
    params.push(filters.armId);
    conditions.push(`s.arm_id = $${params.length}`);
  }
  if (filters.status) {
    params.push(filters.status);
    conditions.push(`s.enrollment_status = $${params.length}`);
  }
  if (filters.search) {
    params.push(`%${filters.search}%`);
    conditions.push(
      `(s.first_name ILIKE $${params.length} OR s.last_name ILIKE $${params.length} OR s.admission_number ILIKE $${params.length})`
    );
  }
  conditions.push(visibilityClause(actor, params));

  const result = await query<StudentRow>(
    `${STUDENT_SELECT} WHERE ${conditions.join(" AND ")} ORDER BY s.last_name ASC, s.first_name ASC`,
    params
  );

  return result.rows.map(toStudentRecord);
}

export async function getStudentById(actor: AuthenticatedUser, studentId: string) {
  const params: unknown[] = [actor.schoolId, studentId];
  const clause = visibilityClause(actor, params);
  const result = await query<StudentRow>(`${STUDENT_SELECT} WHERE s.school_id = $1 AND s.id = $2 AND ${clause}`, params);

  if (result.rowCount === 0) {
    throw new NotFoundError("Student not found.");
  }

  return toStudentRecord(result.rows[0]);
}

/** Internal lookups by staff use, without per-role visibility (callers already checked permissions). */
export async function getStudentRecord(schoolId: string, studentId: string) {
  const result = await query<StudentRow>(`${STUDENT_SELECT} WHERE s.school_id = $1 AND s.id = $2`, [
    schoolId,
    studentId,
  ]);
  if (result.rowCount === 0) throw new NotFoundError("Student not found.");
  return toStudentRecord(result.rows[0]);
}

// ---------------------------------------------------------------------------
// Identifiers & credentials
// ---------------------------------------------------------------------------

/** {SCHOOLCODE}/{year}/{seq}, sequence kept per school and year. */
async function allocateAdmissionNumber(schoolId: string, client: PoolClient): Promise<string> {
  const year = new Date().getFullYear();
  const school = await client.query<{ code: string }>(
    `SELECT COALESCE(NULLIF(school_code, ''), UPPER(REGEXP_REPLACE(slug, '[^A-Za-z0-9]', '', 'g'))) AS code
     FROM schools WHERE id = $1`,
    [schoolId]
  );
  const counter = await client.query<{ last_seq: number }>(
    `INSERT INTO student_id_counters (school_id, year, last_seq) VALUES ($1, $2, 1)
     ON CONFLICT (school_id, year) DO UPDATE SET last_seq = student_id_counters.last_seq + 1
     RETURNING last_seq`,
    [schoolId, year]
  );
  return `${school.rows[0].code}/${year}/${counter.rows[0].last_seq}`;
}

async function uniqueStudentEmail(client: PoolClient, schoolId: string, firstName: string, lastName: string): Promise<string> {
  const school = await client.query<{ student_email_domain: string | null }>(
    "SELECT student_email_domain FROM schools WHERE id = $1",
    [schoolId]
  );
  const domain = school.rows[0]?.student_email_domain || env.STUDENT_EMAIL_FALLBACK_DOMAIN;
  const base = buildStudentEmail(firstName, lastName, domain);
  const [local, host] = base.split("@");

  for (let attempt = 0; attempt < 50; attempt += 1) {
    const candidate = attempt === 0 ? base : `${local}${attempt + 1}@${host}`;
    const taken = await client.query("SELECT 1 FROM profiles WHERE email = $1", [candidate]);
    if (taken.rowCount === 0) return candidate;
  }
  return `${local}.${Date.now()}@${host}`;
}

async function createStudentLogin(
  client: PoolClient,
  schoolId: string,
  studentId: string,
  firstName: string,
  lastName: string
): Promise<{ email: string; temporaryPassword: string }> {
  const email = await uniqueStudentEmail(client, schoolId, firstName, lastName);
  const temporaryPassword = generateTemporaryPassword();

  const profile = await client.query<{ id: string }>(
    `INSERT INTO profiles (email, full_name, password_hash, force_password_change)
     VALUES ($1, $2, $3, TRUE) RETURNING id`,
    [email, `${firstName} ${lastName}`, await bcrypt.hash(temporaryPassword, BCRYPT_ROUNDS)]
  );
  await client.query("INSERT INTO memberships (school_id, user_id, role, is_active) VALUES ($1, $2, 'student', TRUE)", [
    schoolId,
    profile.rows[0].id,
  ]);
  await client.query("UPDATE students SET user_id = $1 WHERE id = $2 AND school_id = $3", [
    profile.rows[0].id,
    studentId,
    schoolId,
  ]);
  return { email, temporaryPassword };
}

export interface StudentCredentials {
  email: string;
  temporaryPassword: string;
}

export async function createStudent(schoolId: string, actorId: string, input: CreateStudentInput) {
  await assertClassArm(schoolId, input.classId, input.armId);

  if (input.admissionNumber) {
    const existingAdmission = await query<{ id: string }>(
      "SELECT id FROM students WHERE school_id = $1 AND admission_number = $2",
      [schoolId, input.admissionNumber]
    );
    if (existingAdmission.rowCount && existingAdmission.rowCount > 0) {
      throw new ConflictError(`Admission number '${input.admissionNumber}' is already registered in this school.`);
    }
  }

  const { studentId, credentials } = await withTransaction(async (client) => {
    let guardianId: string | null = null;
    if (input.guardian) {
      const guardian = await findOrCreateGuardian(schoolId, input.guardian, client);
      guardianId = guardian.id;
    }

    const admissionNumber = input.admissionNumber ?? (await allocateAdmissionNumber(schoolId, client));

    const result = await client.query<{ id: string }>(
      `INSERT INTO students (
         school_id, admission_number, first_name, last_name, middle_name, gender, date_of_birth,
         current_class_id, arm_id, guardian_id, enrollment_status, enrolled_date, address, blood_group, genotype
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, COALESCE($12, CURRENT_DATE), $13, $14, $15)
       RETURNING id`,
      [
        schoolId,
        admissionNumber,
        input.firstName,
        input.lastName,
        input.middleName ?? null,
        input.gender,
        input.dateOfBirth ?? null,
        input.classId,
        input.armId ?? null,
        guardianId,
        input.enrollmentStatus,
        input.enrolledDate ?? null,
        input.address ?? null,
        input.bloodGroup ?? null,
        input.genotype ?? null,
      ]
    );
    const id = result.rows[0].id;

    const login = input.createLogin ? await createStudentLogin(client, schoolId, id, input.firstName, input.lastName) : null;
    return { studentId: id, credentials: login };
  });

  await recordAuditLog({
    schoolId,
    userId: actorId,
    action: "student.enrolled",
    resourceType: "student",
    resourceId: studentId,
  });

  return { student: await getStudentRecord(schoolId, studentId), credentials };
}

export async function bulkImportStudents(schoolId: string, actorId: string, students: CreateStudentInput[]) {
  const success: Array<{ index: number; student: Awaited<ReturnType<typeof getStudentRecord>>; credentials: StudentCredentials | null }> = [];
  const failed: Array<{ index: number; error: string }> = [];

  for (let index = 0; index < students.length; index += 1) {
    try {
      const created = await createStudent(schoolId, actorId, students[index]);
      success.push({ index, ...created });
    } catch (error) {
      failed.push({ index, error: (error as Error).message });
    }
  }
  return { success, failed };
}

export async function updateStudent(schoolId: string, actorId: string, studentId: string, input: UpdateStudentInput) {
  const current = await getStudentRecord(schoolId, studentId);

  const classId = input.classId ?? current.current_class_id;
  // Moving to another class clears the arm unless a new one is given.
  const armId = input.armId !== undefined ? input.armId : input.classId ? null : current.arm_id;
  if (input.classId || input.armId) await assertClassArm(schoolId, classId, armId);

  await withTransaction(async (client) => {
    let guardianId: string | undefined;
    if (input.guardian) {
      guardianId = (await findOrCreateGuardian(schoolId, input.guardian, client)).id;
    }

    await client.query(
      `UPDATE students SET
         first_name = COALESCE($3, first_name), last_name = COALESCE($4, last_name),
         middle_name = CASE WHEN $5::boolean THEN $6 ELSE middle_name END,
         gender = COALESCE($7, gender),
         date_of_birth = CASE WHEN $8::boolean THEN $9::date ELSE date_of_birth END,
         current_class_id = $10, arm_id = $11,
         address = CASE WHEN $12::boolean THEN $13 ELSE address END,
         blood_group = CASE WHEN $14::boolean THEN $15 ELSE blood_group END,
         genotype = CASE WHEN $16::boolean THEN $17 ELSE genotype END,
         enrollment_status = COALESCE($18, enrollment_status),
         guardian_id = COALESCE($19, guardian_id)
       WHERE id = $1 AND school_id = $2`,
      [
        studentId,
        schoolId,
        input.firstName ?? null,
        input.lastName ?? null,
        input.middleName !== undefined,
        input.middleName ?? null,
        input.gender ?? null,
        input.dateOfBirth !== undefined,
        input.dateOfBirth ?? null,
        classId,
        armId,
        input.address !== undefined,
        input.address ?? null,
        input.bloodGroup !== undefined,
        input.bloodGroup ?? null,
        input.genotype !== undefined,
        input.genotype ?? null,
        input.enrollmentStatus ?? null,
        guardianId ?? null,
      ]
    );

    if ((input.firstName || input.lastName) && current.user_id) {
      await client.query("UPDATE profiles SET full_name = $1 WHERE id = $2", [
        `${input.firstName ?? current.first_name} ${input.lastName ?? current.last_name}`,
        current.user_id,
      ]);
    }
    if (input.enrollmentStatus && current.user_id) {
      await syncLoginWithStatus(client, schoolId, current.user_id, input.enrollmentStatus);
    }
  });

  await recordAuditLog({
    schoolId,
    userId: actorId,
    action: "student.updated",
    resourceType: "student",
    resourceId: studentId,
    payload: { fields: Object.keys(input) },
  });
  return getStudentRecord(schoolId, studentId);
}

/** Only active students can sign in; graduating, transferring or suspending closes the account. */
async function syncLoginWithStatus(client: PoolClient, schoolId: string, userId: string, status: string) {
  const active = status === "active";
  await client.query("UPDATE memberships SET is_active = $1 WHERE school_id = $2 AND user_id = $3", [active, schoolId, userId]);
  if (!active) {
    await client.query("UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL", [userId]);
  }
}

export async function resetStudentPassword(schoolId: string, actorId: string, studentId: string): Promise<string> {
  const student = await getStudentRecord(schoolId, studentId);
  if (!student.user_id) throw new NotFoundError("This student does not have a sign-in account yet.");

  const temporaryPassword = generateTemporaryPassword();
  await query(
    "UPDATE profiles SET password_hash = $1, force_password_change = TRUE, failed_login_count = 0, locked_until = NULL WHERE id = $2",
    [await bcrypt.hash(temporaryPassword, BCRYPT_ROUNDS), student.user_id]
  );
  await query("UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL", [student.user_id]);

  await recordAuditLog({
    schoolId,
    userId: actorId,
    action: "student.password_reset",
    resourceType: "student",
    resourceId: studentId,
  });
  return temporaryPassword;
}

/** Sign-in account for a student enrolled before portal accounts existed. */
export async function createPortalAccount(schoolId: string, actorId: string, studentId: string) {
  const student = await getStudentRecord(schoolId, studentId);
  if (student.user_id) throw new ConflictError("This student already has a sign-in account.");

  const credentials = await withTransaction((client) =>
    createStudentLogin(client, schoolId, studentId, student.first_name, student.last_name)
  );

  await recordAuditLog({
    schoolId,
    userId: actorId,
    action: "student.portal_account_created",
    resourceType: "student",
    resourceId: studentId,
  });
  return credentials;
}

export async function setStudentPhoto(schoolId: string, actorId: string, studentId: string, photoUrl: string) {
  await getStudentRecord(schoolId, studentId);
  await query("UPDATE students SET photo_url = $1 WHERE id = $2 AND school_id = $3", [photoUrl, studentId, schoolId]);

  await recordAuditLog({
    schoolId,
    userId: actorId,
    action: "student.photo_updated",
    resourceType: "student",
    resourceId: studentId,
  });
  return photoUrl;
}

/** Attendance, current-term grades and standing — the summary an administrator or teacher opens on a student. */
export async function getStudentAcademicSummary(actor: AuthenticatedUser, studentId: string) {
  const student = await getStudentById(actor, studentId);
  const schoolId = actor.schoolId;
  const period = await getCurrentPeriod(schoolId);

  const attendance = await query<{ total: number; present: number; late: number; absent: number }>(
    `SELECT COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE status = 'PRESENT')::int AS present,
            COUNT(*) FILTER (WHERE status = 'LATE')::int AS late,
            COUNT(*) FILTER (WHERE status = 'ABSENT')::int AS absent
     FROM attendance_records WHERE student_id = $1 AND school_id = $2`,
    [studentId, schoolId]
  );
  const a = attendance.rows[0];

  let subjectGrades: unknown[] = [];
  let averageScore = 0;
  if (period.termId) {
    // Parents and students only ever see published results.
    const publishedOnly = actor.role === "student" || actor.role === "parent";
    const grades = await query<{ subject_name: string; total_score: number }>(
      `SELECT sub.name AS subject_name, sub.code AS subject_code, re.ca_score, re.exam_score,
              COALESCE(re.computed_total, re.total_score) AS total_score, re.grade, re.remark
       FROM results r
       JOIN result_entries re ON re.result_id = r.id AND re.scores_complete = TRUE
       JOIN subjects sub ON sub.id = re.subject_id
       WHERE r.student_id = $1 AND r.term_id = $2 AND r.school_id = $3
         AND ($4::boolean = FALSE OR r.approval_status = 'PUBLISHED')
       ORDER BY sub.name`,
      [studentId, period.termId, schoolId, publishedOnly]
    );
    subjectGrades = grades.rows;
    if (grades.rows.length > 0) {
      const sum = grades.rows.reduce((acc, row) => acc + Number(row.total_score || 0), 0);
      averageScore = Math.round((sum / grades.rows.length) * 10) / 10;
    }
  }

  return {
    student,
    attendance: {
      totalDays: a.total,
      presentDays: a.present,
      lateDays: a.late,
      absentDays: a.absent,
      attendancePercentage: a.total > 0 ? Math.round(((a.present + a.late) / a.total) * 100) : 0,
    },
    metrics: { averageScore, subjectsGraded: subjectGrades.length },
    currentTerm: period.termId ? { id: period.termId, name: period.termName } : null,
    currentSession: period.sessionId ? { id: period.sessionId, name: period.sessionName } : null,
    subjectGrades,
  };
}

export async function setStudentStatus(schoolId: string, actorId: string, studentId: string, status: string) {
  return updateStudent(schoolId, actorId, studentId, { enrollmentStatus: status as UpdateStudentInput["enrollmentStatus"] });
}
