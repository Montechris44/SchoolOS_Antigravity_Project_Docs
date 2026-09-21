import { query } from "../../db/pool";
import { recordAuditLog } from "../../shared/audit/audit-log";
import { BadRequestError, ForbiddenError, NotFoundError } from "../../shared/http/errors";
import { assertSchoolMember } from "../../shared/security/ownership";

const STAFF_ROLES = ["admin", "teacher", "bursar", "non_academic"];
const DEFAULT_ON_TIME = "08:00";
const DEFAULT_VERY_LATE = "09:00";

function minutes(time: string): number {
  const [h, m] = time.slice(0, 5).split(":").map(Number);
  return h * 60 + (m || 0);
}

export function statusFromSignIn(signIn: string, onTime: string, veryLate: string): "ON_TIME" | "LATE" | "VERY_LATE" {
  const mins = minutes(signIn);
  if (mins <= minutes(onTime)) return "ON_TIME";
  if (mins <= minutes(veryLate)) return "LATE";
  return "VERY_LATE";
}

/** "Now" in the school's own time zone — the server clock decides, never the client, so sign-in times cannot be spoofed. */
async function schoolNow(schoolId: string): Promise<{ date: string; time: string }> {
  const result = await query<{ date: string; time: string }>(
    `SELECT to_char(NOW() AT TIME ZONE COALESCE((SELECT timezone FROM school_settings WHERE school_id = $1), 'Africa/Lagos'), 'YYYY-MM-DD') AS date,
            to_char(NOW() AT TIME ZONE COALESCE((SELECT timezone FROM school_settings WHERE school_id = $1), 'Africa/Lagos'), 'HH24:MI:SS') AS time`,
    [schoolId]
  );
  return result.rows[0];
}

export async function getCutoffs(schoolId: string) {
  const result = await query<{ staff_sign_in_cutoff: string; staff_very_late_cutoff: string }>(
    "SELECT staff_sign_in_cutoff, staff_very_late_cutoff FROM school_settings WHERE school_id = $1",
    [schoolId]
  );
  const row = result.rows[0];
  return {
    onTime: row ? String(row.staff_sign_in_cutoff).slice(0, 5) : DEFAULT_ON_TIME,
    veryLate: row ? String(row.staff_very_late_cutoff).slice(0, 5) : DEFAULT_VERY_LATE,
  };
}

export async function getSession(schoolId: string, date: string) {
  const result = await query(
    `SELECT s.id, s.is_open, s.opened_at, s.closed_at, s.opened_by, s.closed_by, op.full_name AS opened_by_name, cp.full_name AS closed_by_name
     FROM staff_attendance_sessions s
     LEFT JOIN profiles op ON op.id = s.opened_by LEFT JOIN profiles cp ON cp.id = s.closed_by
     WHERE s.school_id = $1 AND s.attendance_date = $2`,
    [schoolId, date]
  );
  const row = result.rows[0];
  return row ? { ...row, attendance_date: date, exists: true } : { attendance_date: date, is_open: false, exists: false };
}

async function assertSessionOpen(schoolId: string, date: string) {
  const session = await getSession(schoolId, date);
  if (!session.exists || !session.is_open) {
    throw new ForbiddenError("Attendance is closed for today. Contact your school administrator.");
  }
}

export async function openSession(schoolId: string, actorId: string, date?: string) {
  const day = date ?? (await schoolNow(schoolId)).date;
  await query(
    `INSERT INTO staff_attendance_sessions (school_id, attendance_date, is_open, opened_at, opened_by, closed_at, closed_by)
     VALUES ($1, $2, TRUE, NOW(), $3, NULL, NULL)
     ON CONFLICT (school_id, attendance_date)
     DO UPDATE SET is_open = TRUE, opened_at = NOW(), opened_by = EXCLUDED.opened_by, closed_at = NULL, closed_by = NULL`,
    [schoolId, day, actorId]
  );
  await recordAuditLog({ schoolId, userId: actorId, action: "staff_attendance.opened", resourceType: "staff_attendance_session", resourceId: day });
  return getSession(schoolId, day);
}

export async function closeSession(schoolId: string, actorId: string, date?: string) {
  const day = date ?? (await schoolNow(schoolId)).date;
  const existing = await getSession(schoolId, day);
  if (!existing.exists) throw new NotFoundError("No attendance session exists for this date. Open attendance first.");

  await query(
    `UPDATE staff_attendance_sessions SET is_open = FALSE, closed_at = NOW(), closed_by = $3 WHERE school_id = $1 AND attendance_date = $2`,
    [schoolId, day, actorId]
  );
  await recordAuditLog({ schoolId, userId: actorId, action: "staff_attendance.closed", resourceType: "staff_attendance_session", resourceId: day });
  return getSession(schoolId, day);
}

/** Every active staff member with the day's record; approved leave shows as ON_LEAVE when they did not sign in. */
export async function getByDate(schoolId: string, date: string) {
  const staff = await query<Record<string, any>>(
    `SELECT p.id AS user_id, st.first_name, st.last_name, st.employee_id, st.role::text AS role, st.department,
            COALESCE((SELECT s.name FROM teacher_assignments ta JOIN subjects s ON s.id = ta.subject_id
                      WHERE ta.teacher_id = p.id AND ta.is_active LIMIT 1), st.department, st.title) AS subject,
            sa.sign_in_time, sa.sign_out_time, sa.status, sa.notes,
            EXISTS (SELECT 1 FROM staff_leave_requests l WHERE l.staff_user_id = p.id AND l.school_id = st.school_id
                    AND l.status = 'APPROVED' AND $2::date BETWEEN l.start_date AND l.end_date) AS on_approved_leave
     FROM staff st
     JOIN profiles p ON p.id = st.user_id
     JOIN memberships m ON m.school_id = st.school_id AND m.user_id = st.user_id AND m.is_active
     LEFT JOIN staff_attendance sa ON sa.staff_id = p.id AND sa.school_id = st.school_id AND sa.attendance_date = $2
     WHERE st.school_id = $1 AND st.role::text = ANY($3::text[])
     ORDER BY st.last_name, st.first_name`,
    [schoolId, date, STAFF_ROLES]
  );

  return {
    session: await getSession(schoolId, date),
    records: staff.rows.map((row) => ({
      userId: row.user_id,
      name: `${row.first_name} ${row.last_name}`,
      employeeId: row.employee_id,
      role: row.role,
      subject: row.subject,
      signInTime: row.sign_in_time ? String(row.sign_in_time).slice(0, 5) : null,
      signOutTime: row.sign_out_time ? String(row.sign_out_time).slice(0, 5) : null,
      status: row.status ?? (row.on_approved_leave ? "ON_LEAVE" : "ABSENT"),
      notes: row.notes,
    })),
  };
}

export async function getStaffHistory(schoolId: string, staffUserId: string, limit = 30) {
  await assertSchoolMember(schoolId, staffUserId, "Staff member", STAFF_ROLES);
  const result = await query(
    `SELECT attendance_date, sign_in_time, sign_out_time, status, notes
     FROM staff_attendance WHERE school_id = $1 AND staff_id = $2 ORDER BY attendance_date DESC LIMIT $3`,
    [schoolId, staffUserId, Math.min(Math.max(limit, 1), 120)]
  );
  return result.rows.map((row) => ({
    date: row.attendance_date,
    signInTime: row.sign_in_time ? String(row.sign_in_time).slice(0, 5) : null,
    signOutTime: row.sign_out_time ? String(row.sign_out_time).slice(0, 5) : null,
    status: row.status,
    notes: row.notes,
  }));
}

export interface ManualMark {
  staffUserId: string;
  attendanceDate: string;
  status: "ON_TIME" | "LATE" | "VERY_LATE" | "ABSENT" | "ON_LEAVE";
  signInTime?: string | null;
  signOutTime?: string | null;
  notes?: string | null;
}

/** Administrator override (for a missed sign-in, an agreed absence, ...). Always audited. */
export async function markStaffAttendance(schoolId: string, actorId: string, data: ManualMark) {
  await assertSchoolMember(schoolId, data.staffUserId, "Staff member", STAFF_ROLES);

  await query(
    `INSERT INTO staff_attendance (school_id, staff_id, attendance_date, sign_in_time, sign_out_time, status, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (school_id, staff_id, attendance_date)
     DO UPDATE SET sign_in_time = COALESCE(EXCLUDED.sign_in_time, staff_attendance.sign_in_time),
                   sign_out_time = COALESCE(EXCLUDED.sign_out_time, staff_attendance.sign_out_time),
                   status = EXCLUDED.status, notes = COALESCE(EXCLUDED.notes, staff_attendance.notes)`,
    [schoolId, data.staffUserId, data.attendanceDate, data.signInTime ?? null, data.signOutTime ?? null, data.status, data.notes ?? null]
  );
  await recordAuditLog({
    schoolId,
    userId: actorId,
    action: "staff_attendance.marked",
    resourceType: "staff_attendance",
    resourceId: data.staffUserId,
    payload: { date: data.attendanceDate, status: data.status },
  });
  return getByDate(schoolId, data.attendanceDate);
}

// ---- Staff self-service ------------------------------------------------------

export async function getMyStatus(schoolId: string, staffUserId: string, date?: string) {
  const day = date ?? (await schoolNow(schoolId)).date;
  const [session, cutoffs, record] = await Promise.all([
    getSession(schoolId, day),
    getCutoffs(schoolId),
    query(`SELECT sign_in_time, sign_out_time, status, notes FROM staff_attendance WHERE school_id = $1 AND staff_id = $2 AND attendance_date = $3`, [
      schoolId,
      staffUserId,
      day,
    ]),
  ]);
  const row = record.rows[0];
  return {
    date: day,
    session,
    cutoffs,
    record: row
      ? {
          signInTime: row.sign_in_time ? String(row.sign_in_time).slice(0, 5) : null,
          signOutTime: row.sign_out_time ? String(row.sign_out_time).slice(0, 5) : null,
          status: row.status,
          notes: row.notes,
        }
      : null,
    canClockIn: Boolean(session.is_open) && !row?.sign_in_time,
    canClockOut: Boolean(session.is_open) && Boolean(row?.sign_in_time) && !row?.sign_out_time,
  };
}

export async function getMyMonth(schoolId: string, staffUserId: string, month: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new BadRequestError("Month must look like 2026-09.");

  const records = await query(
    `SELECT attendance_date, sign_in_time, sign_out_time, status, notes
     FROM staff_attendance
     WHERE school_id = $1 AND staff_id = $2 AND attendance_date >= ($3 || '-01')::date
       AND attendance_date < (($3 || '-01')::date + INTERVAL '1 month')
     ORDER BY attendance_date DESC`,
    [schoolId, staffUserId, month]
  );
  const count = (status: string) => records.rows.filter((row) => row.status === status).length;
  const worked = records.rows.filter((row) => row.status !== "ABSENT" && row.status !== "ON_LEAVE").length;

  return {
    month,
    summary: {
      onTime: count("ON_TIME"),
      late: count("LATE"),
      veryLate: count("VERY_LATE"),
      absent: count("ABSENT"),
      onLeave: count("ON_LEAVE"),
      daysRecorded: records.rows.length,
      attendanceRate: records.rows.length > 0 ? Math.round((worked / records.rows.length) * 100) : 0,
    },
    records: records.rows.map((row) => ({
      date: row.attendance_date,
      signInTime: row.sign_in_time ? String(row.sign_in_time).slice(0, 5) : null,
      signOutTime: row.sign_out_time ? String(row.sign_out_time).slice(0, 5) : null,
      status: row.status,
      notes: row.notes,
    })),
  };
}

export async function clockIn(schoolId: string, staffUserId: string) {
  const now = await schoolNow(schoolId);
  await assertSessionOpen(schoolId, now.date);

  const existing = await query("SELECT sign_in_time FROM staff_attendance WHERE school_id = $1 AND staff_id = $2 AND attendance_date = $3", [
    schoolId,
    staffUserId,
    now.date,
  ]);
  if (existing.rows[0]?.sign_in_time) throw new BadRequestError("You have already signed in today.");

  const cutoffs = await getCutoffs(schoolId);
  const status = statusFromSignIn(now.time, cutoffs.onTime, cutoffs.veryLate);

  await query(
    `INSERT INTO staff_attendance (school_id, staff_id, attendance_date, sign_in_time, status)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (school_id, staff_id, attendance_date) DO UPDATE SET sign_in_time = EXCLUDED.sign_in_time, status = EXCLUDED.status`,
    [schoolId, staffUserId, now.date, now.time, status]
  );
  return getMyStatus(schoolId, staffUserId, now.date);
}

export async function clockOut(schoolId: string, staffUserId: string) {
  const now = await schoolNow(schoolId);
  await assertSessionOpen(schoolId, now.date);

  const result = await query(
    `UPDATE staff_attendance SET sign_out_time = $4
     WHERE school_id = $1 AND staff_id = $2 AND attendance_date = $3 AND sign_in_time IS NOT NULL AND sign_out_time IS NULL`,
    [schoolId, staffUserId, now.date, now.time]
  );
  if (result.rowCount === 0) throw new BadRequestError("Sign in first, and you can only sign out once.");
  return getMyStatus(schoolId, staffUserId, now.date);
}
