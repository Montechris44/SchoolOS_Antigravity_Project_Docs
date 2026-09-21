import bcrypt from "bcryptjs";

import { query, withTransaction } from "../../db/pool";
import { env } from "../../config/env";
import { recordAuditLog } from "../../shared/audit/audit-log";
import { emailTemplates, sendEmail } from "../../shared/email/mailer";
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from "../../shared/http/errors";
import { generateTemporaryPassword } from "../../shared/security/credentials";
import { assertOwned } from "../../shared/security/ownership";
import { CreateStaffInput, UpdateStaffInput } from "./staff.schemas";

const BCRYPT_ROUNDS = 12;

const ROLE_PREFIX: Record<string, string> = { teacher: "TCH", bursar: "ACC", non_academic: "NAC", admin: "ADM" };
const ROLE_LABEL: Record<string, string> = {
  teacher: "Teacher",
  bursar: "Bursar",
  non_academic: "Support staff",
  admin: "Administrator",
};

// Membership is the source of truth for whether the person can sign in; staff.is_active mirrors it.
const STAFF_SELECT = `
  SELECT
    st.id, st.school_id, st.user_id, st.employee_id, st.first_name, st.last_name,
    st.role, st.title, st.phone, st.email, m.is_active, st.created_at AS hire_date,
    st.gender, st.address, st.date_of_birth, st.join_date, st.department, st.qualification,
    st.years_of_experience, st.photo_url, p.last_login_at, p.force_password_change,
    COALESCE(array_agg(DISTINCT ta.class_id) FILTER (WHERE ta.class_id IS NOT NULL), '{}') AS assigned_class_ids,
    COALESCE(array_agg(DISTINCT ta.subject_id) FILTER (WHERE ta.subject_id IS NOT NULL), '{}') AS assigned_subject_ids,
    COALESCE(array_agg(DISTINCT s.name) FILTER (WHERE s.name IS NOT NULL), '{}') AS subjects,
    ca.id AS class_teacher_arm_id, ca.name AS class_teacher_arm_name,
    COALESCE(cta.id, ctc.id) AS class_teacher_class_id, COALESCE(cta.name, ctc.name) AS class_teacher_class_name
  FROM staff st
  JOIN profiles p ON p.id = st.user_id
  JOIN memberships m ON m.school_id = st.school_id AND m.user_id = st.user_id
  LEFT JOIN teacher_assignments ta ON ta.staff_id = st.id AND ta.is_active = TRUE
  LEFT JOIN subjects s ON s.id = ta.subject_id
  LEFT JOIN class_arms ca ON ca.class_teacher_id = st.user_id AND ca.school_id = st.school_id
  LEFT JOIN classes cta ON cta.id = ca.class_id
  LEFT JOIN classes ctc ON ctc.class_teacher_id = st.user_id AND ctc.school_id = st.school_id
`;

const STAFF_GROUP_BY = "GROUP BY st.id, p.last_login_at, p.force_password_change, m.is_active, ca.id, ca.name, cta.id, cta.name, ctc.id, ctc.name";

export async function listStaff(schoolId: string, filters: { role?: string; search?: string } = {}) {
  const result = await query(
    `${STAFF_SELECT}
     WHERE st.school_id = $1
       AND ($2::text IS NULL OR st.role::text = $2)
       AND ($3::text IS NULL OR st.first_name ILIKE $3 OR st.last_name ILIKE $3 OR st.email ILIKE $3 OR st.employee_id ILIKE $3)
     ${STAFF_GROUP_BY}
     ORDER BY st.last_name ASC, st.first_name ASC`,
    [schoolId, filters.role ?? null, filters.search ? `%${filters.search}%` : null]
  );
  return result.rows;
}

export async function getStaff(schoolId: string, idOrUserId: string) {
  const result = await query(
    `${STAFF_SELECT} WHERE st.school_id = $1 AND (st.user_id = $2 OR st.id = $2) ${STAFF_GROUP_BY}`,
    [schoolId, idOrUserId]
  );
  if (result.rowCount === 0) throw new NotFoundError("Staff member not found.");
  return result.rows[0];
}

async function allocateEmployeeId(schoolId: string, role: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = ROLE_PREFIX[role] ?? "STF";
  const latest = await query<{ employee_id: string }>(
    `SELECT employee_id FROM staff WHERE school_id = $1 AND employee_id LIKE $2 ORDER BY employee_id DESC LIMIT 1`,
    [schoolId, `${prefix}-${year}-%`]
  );
  const last = latest.rows[0]?.employee_id.split("-").pop();
  const next = last && !Number.isNaN(parseInt(last, 10)) ? parseInt(last, 10) + 1 : 1;
  return `${prefix}-${year}-${String(next).padStart(3, "0")}`;
}

export async function createStaff(schoolId: string, actorId: string, input: CreateStaffInput) {
  const email = input.email.toLowerCase();

  const existingProfile = await query<{ id: string }>("SELECT id FROM profiles WHERE email = $1", [email]);
  if (existingProfile.rowCount && existingProfile.rowCount > 0) {
    throw new ConflictError("An account with this email already exists.");
  }
  if (input.role === "non_academic" && !input.department?.trim() && !input.title?.trim()) {
    throw new BadRequestError("A job title is required for non-academic staff.");
  }
  if (input.classTeacherArmId) await assertOwned(schoolId, "class_arms", input.classTeacherArmId, "Arm");
  if (input.classTeacherClassId) await assertOwned(schoolId, "classes", input.classTeacherClassId, "Class");

  const employeeId = input.employeeId?.trim() || (await allocateEmployeeId(schoolId, input.role));
  const duplicate = await query("SELECT 1 FROM staff WHERE school_id = $1 AND employee_id = $2", [schoolId, employeeId]);
  if (duplicate.rowCount && duplicate.rowCount > 0) {
    throw new ConflictError(`Employee ID '${employeeId}' is already in use.`);
  }

  const temporaryPassword = input.password ?? generateTemporaryPassword();
  const passwordHash = await bcrypt.hash(temporaryPassword, BCRYPT_ROUNDS);

  const staffId = await withTransaction(async (client) => {
    const profile = await client.query<{ id: string }>(
      `INSERT INTO profiles (email, full_name, phone, password_hash, force_password_change)
       VALUES ($1, $2, $3, $4, TRUE) RETURNING id`,
      [email, `${input.firstName} ${input.lastName}`, input.phone ?? null, passwordHash]
    );
    const userId = profile.rows[0].id;

    await client.query("INSERT INTO memberships (school_id, user_id, role, is_active) VALUES ($1, $2, $3, TRUE)", [
      schoolId,
      userId,
      input.role,
    ]);

    const staff = await client.query<{ id: string }>(
      `INSERT INTO staff (school_id, user_id, employee_id, first_name, last_name, role, title, phone, email, is_active,
                          gender, address, date_of_birth, join_date, department, qualification, years_of_experience)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, TRUE, $10, $11, $12, $13, $14, $15, $16)
       RETURNING id`,
      [
        schoolId,
        userId,
        employeeId,
        input.firstName,
        input.lastName,
        input.role,
        input.title ?? input.department ?? ROLE_LABEL[input.role],
        input.phone ?? "",
        email,
        input.gender ?? null,
        input.address ?? null,
        input.dateOfBirth ?? null,
        input.joinDate ?? null,
        input.department ?? null,
        input.qualification ?? null,
        input.yearsOfExperience ?? null,
      ]
    );

    if (input.role === "teacher" && (input.classTeacherArmId || input.classTeacherClassId)) {
      if (input.classTeacherArmId) {
        await client.query("UPDATE class_arms SET class_teacher_id = $1 WHERE id = $2 AND school_id = $3", [
          userId,
          input.classTeacherArmId,
          schoolId,
        ]);
      } else {
        await client.query("UPDATE classes SET class_teacher_id = $1 WHERE id = $2 AND school_id = $3", [
          userId,
          input.classTeacherClassId,
          schoolId,
        ]);
      }
    }

    return staff.rows[0].id;
  });

  const school = await query<{ name: string }>("SELECT name FROM schools WHERE id = $1", [schoolId]);
  const template = emailTemplates.welcome(input.firstName, school.rows[0].name, ROLE_LABEL[input.role], `${env.FRONTEND_URL}/login`);
  void sendEmail({ to: email, subject: template.subject, html: template.html });

  await recordAuditLog({
    schoolId,
    userId: actorId,
    action: "staff.created",
    resourceType: "staff",
    resourceId: staffId,
    payload: { role: input.role },
  });

  const staff = await getStaff(schoolId, staffId);
  return { ...staff, temporary_password: input.password ? undefined : temporaryPassword };
}

const UPDATE_COLUMNS: Record<keyof UpdateStaffInput, string | null> = {
  firstName: "first_name",
  lastName: "last_name",
  email: "email",
  phone: "phone",
  role: "role",
  title: "title",
  employeeId: "employee_id",
  gender: "gender",
  address: "address",
  dateOfBirth: "date_of_birth",
  joinDate: "join_date",
  department: "department",
  qualification: "qualification",
  yearsOfExperience: "years_of_experience",
};

export async function updateStaff(schoolId: string, actorId: string, idOrUserId: string, input: UpdateStaffInput) {
  const current = await getStaff(schoolId, idOrUserId);
  if (current.role === "owner") throw new ForbiddenError("The school owner account cannot be edited here.");

  const sets: string[] = [];
  const params: unknown[] = [current.id, schoolId];
  for (const [key, value] of Object.entries(input) as Array<[keyof UpdateStaffInput, unknown]>) {
    const column = UPDATE_COLUMNS[key];
    if (!column || value === undefined) continue;
    params.push(key === "email" ? String(value).toLowerCase() : value);
    sets.push(`${column} = $${params.length}`);
  }
  if (sets.length === 0) return current;

  await withTransaction(async (client) => {
    if (input.email) {
      const clash = await client.query("SELECT 1 FROM profiles WHERE email = $1 AND id <> $2", [
        input.email.toLowerCase(),
        current.user_id,
      ]);
      if (clash.rowCount && clash.rowCount > 0) throw new ConflictError("That e-mail is already used by another account.");
      await client.query("UPDATE profiles SET email = $1 WHERE id = $2", [input.email.toLowerCase(), current.user_id]);
    }
    await client.query(`UPDATE staff SET ${sets.join(", ")} WHERE id = $1 AND school_id = $2`, params);

    const fullName = `${input.firstName ?? current.first_name} ${input.lastName ?? current.last_name}`;
    await client.query("UPDATE profiles SET full_name = $1, phone = COALESCE($2, phone) WHERE id = $3", [
      fullName,
      input.phone ?? null,
      current.user_id,
    ]);
    if (input.role) {
      await client.query("UPDATE memberships SET role = $1 WHERE school_id = $2 AND user_id = $3", [
        input.role,
        schoolId,
        current.user_id,
      ]);
    }
  });

  await recordAuditLog({
    schoolId,
    userId: actorId,
    action: "staff.updated",
    resourceType: "staff",
    resourceId: current.id,
    payload: { fields: Object.keys(input) },
  });
  return getStaff(schoolId, current.id);
}

export async function toggleStaff(schoolId: string, actorId: string, idOrUserId: string) {
  const current = await getStaff(schoolId, idOrUserId);
  if (current.user_id === actorId) throw new BadRequestError("You cannot deactivate your own account.");
  if (current.role === "owner") throw new ForbiddenError("The school owner account cannot be deactivated.");

  const nextActive = !current.is_active;
  await withTransaction(async (client) => {
    await client.query("UPDATE memberships SET is_active = $1 WHERE school_id = $2 AND user_id = $3", [
      nextActive,
      schoolId,
      current.user_id,
    ]);
    await client.query("UPDATE staff SET is_active = $1 WHERE id = $2", [nextActive, current.id]);
    if (!nextActive) {
      await client.query("UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL", [
        current.user_id,
      ]);
    }
  });

  await recordAuditLog({
    schoolId,
    userId: actorId,
    action: nextActive ? "staff.activated" : "staff.deactivated",
    resourceType: "staff",
    resourceId: current.id,
  });
  return getStaff(schoolId, current.id);
}

export async function deleteStaff(schoolId: string, actorId: string, idOrUserId: string): Promise<void> {
  const current = await getStaff(schoolId, idOrUserId);
  if (current.user_id === actorId) throw new BadRequestError("You cannot delete your own account.");
  if (current.role === "owner") throw new ForbiddenError("The school owner account cannot be deleted.");

  await withTransaction(async (client) => {
    await client.query("DELETE FROM staff WHERE id = $1 AND school_id = $2", [current.id, schoolId]);
    await client.query("DELETE FROM memberships WHERE school_id = $1 AND user_id = $2", [schoolId, current.user_id]);
    // The login identity goes too, unless the person also belongs to another school.
    await client.query(
      `DELETE FROM profiles p WHERE p.id = $1 AND NOT EXISTS (SELECT 1 FROM memberships m WHERE m.user_id = p.id)`,
      [current.user_id]
    );
  });

  await recordAuditLog({
    schoolId,
    userId: actorId,
    action: "staff.deleted",
    resourceType: "staff",
    resourceId: current.id,
    payload: { email: current.email },
  });
}

export async function resetStaffPassword(schoolId: string, actorId: string, idOrUserId: string): Promise<string> {
  const current = await getStaff(schoolId, idOrUserId);
  if (current.role === "owner" && current.user_id !== actorId) {
    throw new ForbiddenError("The school owner's password cannot be reset by another user.");
  }

  const temporaryPassword = generateTemporaryPassword();
  await query("UPDATE profiles SET password_hash = $1, force_password_change = TRUE, failed_login_count = 0, locked_until = NULL WHERE id = $2", [
    await bcrypt.hash(temporaryPassword, BCRYPT_ROUNDS),
    current.user_id,
  ]);
  await query("UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL", [current.user_id]);

  await recordAuditLog({
    schoolId,
    userId: actorId,
    action: "staff.password_reset",
    resourceType: "staff",
    resourceId: current.id,
  });
  return temporaryPassword;
}

/** Academic timetable for teachers; duty metadata for everyone else. */
export async function getStaffSchedule(schoolId: string, idOrUserId: string) {
  const staff = await getStaff(schoolId, idOrUserId);

  if (staff.role !== "teacher") {
    return { staff, scheduleType: "duty", entries: [], metrics: { role: staff.department ?? staff.title } };
  }

  const entries = await query<{ id: string; day_of_week: number; start_time: string; end_time: string; label: string }>(
    `SELECT t.id, t.day_of_week, t.start_time, t.end_time, t.room, c.name AS class_name, ca.name AS arm_name,
            s.name AS subject_name,
            COALESCE(s.name, 'Class') || ' (' || c.name || COALESCE(' ' || ca.name, '') || ')' AS label
     FROM timetable t
     JOIN classes c ON c.id = t.class_id
     LEFT JOIN class_arms ca ON ca.id = t.arm_id
     LEFT JOIN subjects s ON s.id = t.subject_id
     WHERE t.school_id = $1 AND t.teacher_id = $2
     ORDER BY t.day_of_week, t.start_time`,
    [schoolId, staff.user_id]
  );

  const minutes = entries.rows.reduce((total, row) => {
    const [sh, sm] = row.start_time.split(":").map(Number);
    const [eh, em] = row.end_time.split(":").map(Number);
    return total + (eh * 60 + em - (sh * 60 + sm));
  }, 0);

  const students = await query<{ count: number }>(
    `SELECT COUNT(DISTINCT s.id)::int AS count
     FROM teacher_assignments ta
     JOIN students s ON s.current_class_id = ta.class_id AND (ta.arm_id IS NULL OR s.arm_id = ta.arm_id)
     WHERE ta.school_id = $1 AND ta.teacher_id = $2 AND ta.is_active = TRUE AND s.enrollment_status = 'active'`,
    [schoolId, staff.user_id]
  );

  return {
    staff,
    scheduleType: "academic",
    entries: entries.rows,
    metrics: {
      weeklyHours: Math.max(0, Math.round((minutes / 60) * 10) / 10),
      totalStudents: students.rows[0]?.count ?? 0,
      classes: new Set(entries.rows.map((row) => row.label)).size,
    },
  };
}
