import bcrypt from "bcryptjs";

import { query } from "../../db/pool";
import { ForbiddenError, NotFoundError, UnauthorizedError } from "../../shared/http/errors";
import {
  ListAuditLogsQuery,
  SuperAdminLoginInput,
  UpdateSchoolStatusInput,
} from "./super-admin.schemas";

const MAX_FAILED_LOGINS = 5;
const LOCKOUT_MINUTES = 15;

export interface SuperAdminRecord {
  id: string;
  email: string;
  full_name: string;
  created_at: string;
}

const SUPER_ADMIN_SELECT = "id, email, full_name, created_at";

export async function superAdminLogin(input: SuperAdminLoginInput): Promise<SuperAdminRecord> {
  const email = input.email.toLowerCase();

  const result = await query<
    SuperAdminRecord & {
      password_hash: string;
      is_active: boolean;
      failed_login_count: number;
      locked_until: string | null;
    }
  >(
    `SELECT id, email, full_name, created_at, password_hash, is_active, failed_login_count, locked_until
     FROM super_admins WHERE email = $1`,
    [email]
  );

  const invalidCredentialsError = new UnauthorizedError("Invalid email or password.");

  if (result.rowCount === 0) {
    throw invalidCredentialsError;
  }

  const admin = result.rows[0];

  if (!admin.is_active) {
    throw new ForbiddenError("This super admin account has been deactivated.");
  }

  if (admin.locked_until && new Date(admin.locked_until).getTime() > Date.now()) {
    throw new ForbiddenError("This account is temporarily locked due to repeated failed sign-in attempts.");
  }

  const passwordMatches = await bcrypt.compare(input.password, admin.password_hash);

  if (!passwordMatches) {
    const nextFailedCount = admin.failed_login_count + 1;
    const shouldLock = nextFailedCount >= MAX_FAILED_LOGINS;

    await query(`UPDATE super_admins SET failed_login_count = $1, locked_until = $2 WHERE id = $3`, [
      shouldLock ? 0 : nextFailedCount,
      shouldLock ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000) : null,
      admin.id,
    ]);

    throw invalidCredentialsError;
  }

  await query(
    `UPDATE super_admins SET failed_login_count = 0, locked_until = NULL, last_login_at = NOW() WHERE id = $1`,
    [admin.id]
  );

  return { id: admin.id, email: admin.email, full_name: admin.full_name, created_at: admin.created_at };
}

export async function getSuperAdminById(superAdminId: string): Promise<SuperAdminRecord> {
  const result = await query<SuperAdminRecord>(`SELECT ${SUPER_ADMIN_SELECT} FROM super_admins WHERE id = $1`, [
    superAdminId,
  ]);

  if (result.rowCount === 0) {
    throw new UnauthorizedError("This super admin account no longer exists.");
  }

  return result.rows[0];
}

const SCHOOL_SUMMARY_SELECT = `
  SELECT
    s.id, s.name, s.slug, s.status, s.city, s.state, s.country, s.email, s.phone, s.currency, s.created_at,
    (SELECT COUNT(*) FROM memberships m WHERE m.school_id = s.id AND m.is_active) AS member_count,
    (SELECT COUNT(*) FROM students st WHERE st.school_id = s.id) AS student_count,
    (SELECT COUNT(*) FROM staff sf WHERE sf.school_id = s.id AND sf.is_active) AS staff_count
  FROM schools s
`;

export async function listSchools(filters: { status?: "ACTIVE" | "SUSPENDED"; search?: string }) {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters.status) {
    params.push(filters.status);
    conditions.push(`s.status = $${params.length}`);
  }
  if (filters.search) {
    params.push(`%${filters.search}%`);
    conditions.push(`(s.name ILIKE $${params.length} OR s.slug ILIKE $${params.length} OR s.email ILIKE $${params.length})`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const result = await query(`${SCHOOL_SUMMARY_SELECT} ${where} ORDER BY s.created_at DESC`, params);
  return result.rows;
}

export async function getSchoolDetail(schoolId: string) {
  const result = await query(`${SCHOOL_SUMMARY_SELECT} WHERE s.id = $1`, [schoolId]);

  if (result.rowCount === 0) {
    throw new NotFoundError("School not found.");
  }

  return result.rows[0];
}

export async function updateSchoolStatus(
  schoolId: string,
  superAdminId: string,
  input: UpdateSchoolStatusInput
) {
  const result = await query<{ id: string; status: string }>(
    `UPDATE schools SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING id, status`,
    [input.status, schoolId]
  );

  if (result.rowCount === 0) {
    throw new NotFoundError("School not found.");
  }

  await query(
    `INSERT INTO audit_logs (school_id, super_admin_id, action, resource_type, resource_id, payload)
     VALUES ($1, $2, $3, 'school', $4, $5)`,
    [
      schoolId,
      superAdminId,
      input.status === "SUSPENDED" ? "school.suspended" : "school.reactivated",
      schoolId,
      JSON.stringify({ reason: input.reason ?? null }),
    ]
  );

  return getSchoolDetail(schoolId);
}

export async function listUsersAcrossSchools(schoolId?: string) {
  const conditions = schoolId ? "WHERE m.school_id = $1" : "";
  const params = schoolId ? [schoolId] : [];

  const result = await query(
    `SELECT
       p.id, p.email, p.full_name, p.phone, p.created_at,
       m.id AS membership_id, m.role, m.is_active AS membership_active, m.joined_at,
       s.id AS school_id, s.name AS school_name, s.slug AS school_slug
     FROM memberships m
     JOIN profiles p ON p.id = m.user_id
     JOIN schools s ON s.id = m.school_id
     ${conditions}
     ORDER BY p.created_at DESC
     LIMIT 500`,
    params
  );

  return result.rows;
}

export async function unlockProfile(superAdminId: string, profileId: string) {
  const result = await query<{ id: string }>(
    `UPDATE profiles SET failed_login_count = 0, locked_until = NULL WHERE id = $1 RETURNING id`,
    [profileId]
  );

  if (result.rowCount === 0) {
    throw new NotFoundError("Profile not found.");
  }

  await query(
    `INSERT INTO audit_logs (user_id, super_admin_id, action, resource_type, resource_id)
     VALUES ($1, $2, 'profile.unlocked', 'profile', $3)`,
    [profileId, superAdminId, profileId]
  );
}

export async function getPlatformAnalytics() {
  const [schools, students, staff, memberships] = await Promise.all([
    query<{ total: string; active: string; suspended: string }>(
      `SELECT COUNT(*) AS total,
              COUNT(*) FILTER (WHERE status = 'ACTIVE') AS active,
              COUNT(*) FILTER (WHERE status = 'SUSPENDED') AS suspended
       FROM schools`
    ),
    query<{ count: string }>("SELECT COUNT(*) FROM students"),
    query<{ count: string }>("SELECT COUNT(*) FROM staff WHERE is_active"),
    query<{ count: string }>("SELECT COUNT(*) FROM memberships WHERE is_active"),
  ]);

  return {
    total_schools: parseInt(schools.rows[0].total, 10),
    active_schools: parseInt(schools.rows[0].active, 10),
    suspended_schools: parseInt(schools.rows[0].suspended, 10),
    total_students: parseInt(students.rows[0].count, 10),
    total_staff: parseInt(staff.rows[0].count, 10),
    total_memberships: parseInt(memberships.rows[0].count, 10),
  };
}

export async function listAuditLogs(filters: ListAuditLogsQuery) {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters.schoolId) {
    params.push(filters.schoolId);
    conditions.push(`al.school_id = $${params.length}`);
  }
  if (filters.action) {
    params.push(`%${filters.action}%`);
    conditions.push(`al.action ILIKE $${params.length}`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  params.push(filters.limit);

  const result = await query(
    `SELECT al.id, al.school_id, s.name AS school_name, al.user_id, p.full_name AS user_name,
            al.super_admin_id, sa.full_name AS super_admin_name,
            al.action, al.resource_type, al.resource_id, al.payload, al.ip_address, al.created_at
     FROM audit_logs al
     LEFT JOIN schools s ON s.id = al.school_id
     LEFT JOIN profiles p ON p.id = al.user_id
     LEFT JOIN super_admins sa ON sa.id = al.super_admin_id
     ${where}
     ORDER BY al.created_at DESC
     LIMIT $${params.length}`,
    params
  );

  return result.rows;
}
