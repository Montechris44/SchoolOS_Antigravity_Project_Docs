import bcrypt from "bcryptjs";

import { env } from "../../config/env";
import { UserRole } from "../../config/rbac";
import { query, withTransaction } from "../../db/pool";
import { recordAuditLog } from "../../shared/audit/audit-log";
import { emailTemplates, sendEmail } from "../../shared/email/mailer";
import { BadRequestError, ConflictError, ForbiddenError, UnauthorizedError } from "../../shared/http/errors";
import { generateOpaqueToken, hashToken } from "../../shared/security/credentials";
import { slugify } from "../../shared/text/slug";
import { LoginInput, RegisterSchoolInput } from "./auth.schemas";

const MAX_FAILED_LOGINS = 5;
const LOCKOUT_MINUTES = 15;
const BCRYPT_ROUNDS = 12;
const PASSWORD_RESET_MINUTES = 60;
// Compared against when an e-mail is unknown, so unknown and wrong-password sign-ins take similar time.
const DUMMY_PASSWORD_HASH = bcrypt.hashSync("schoolos-timing-equaliser", BCRYPT_ROUNDS);

export interface SchoolRecord {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  theme_color: string | null;
  address: string;
  city: string;
  state: string;
  country: string;
  phone: string;
  email: string;
  currency: string;
  created_at: string;
}

export interface ProfileRecord {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
  created_at: string;
}

export interface AuthResult {
  user: ProfileRecord;
  school: SchoolRecord;
  role: UserRole;
  membershipId: string;
  /** True while the account still carries an admin-issued temporary password. */
  forcePasswordChange: boolean;
}

export interface RequestMeta {
  ipAddress?: string | null;
  userAgent?: string | null;
}

const SCHOOL_COLUMNS =
  "id, name, slug, logo_url, theme_color, address, city, state, country, phone, email, currency, created_at";

interface DefaultTerm {
  name: "First Term" | "Second Term" | "Third Term";
  startDate: string;
  endDate: string;
}

/** Nigerian academic year runs Sep-Jul; bootstraps a usable session/terms so a new school isn't stuck. */
function buildDefaultAcademicCalendar(): { sessionName: string; sessionStart: string; sessionEnd: string; terms: DefaultTerm[] } {
  const now = new Date();
  const startYear = now.getUTCMonth() >= 7 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
  const endYear = startYear + 1;

  const terms: DefaultTerm[] = [
    { name: "First Term", startDate: `${startYear}-09-01`, endDate: `${startYear}-12-20` },
    { name: "Second Term", startDate: `${endYear}-01-05`, endDate: `${endYear}-04-10` },
    { name: "Third Term", startDate: `${endYear}-04-25`, endDate: `${endYear}-07-25` },
  ];

  return {
    sessionName: `${startYear}/${endYear}`,
    sessionStart: terms[0].startDate,
    sessionEnd: terms[2].endDate,
    terms,
  };
}

async function findUniqueSlug(baseName: string): Promise<string> {
  const base = slugify(baseName) || "school";
  let candidate = base;
  let attempt = 1;

  while (attempt < 50) {
    const existing = await query<{ id: string }>("SELECT id FROM schools WHERE slug = $1", [candidate]);
    if (existing.rowCount === 0) {
      return candidate;
    }
    attempt += 1;
    candidate = `${base}-${attempt}`;
  }

  return `${base}-${Date.now()}`;
}

export const DEFAULT_GRADING_BANDS: Array<[number, number, string, string, boolean]> = [
  [75, 100, "A1", "Excellent", true],
  [70, 74.99, "B2", "Very good", true],
  [65, 69.99, "B3", "Good", true],
  [60, 64.99, "C4", "Credit", true],
  [55, 59.99, "C5", "Credit", true],
  [50, 54.99, "C6", "Credit", true],
  [45, 49.99, "D7", "Pass", true],
  [40, 44.99, "E8", "Weak pass", true],
  [0, 39.99, "F9", "Fail", false],
];

export async function registerSchool(input: RegisterSchoolInput): Promise<AuthResult> {
  const existingProfile = await query<{ id: string }>("SELECT id FROM profiles WHERE email = $1", [
    input.owner.email.toLowerCase(),
  ]);

  if (existingProfile.rowCount && existingProfile.rowCount > 0) {
    throw new ConflictError("An account with this email already exists.");
  }

  const slug = await findUniqueSlug(input.school.name);
  const passwordHash = await bcrypt.hash(input.owner.password, BCRYPT_ROUNDS);

  return withTransaction(async (client) => {
    const schoolResult = await client.query<SchoolRecord>(
      `INSERT INTO schools (name, slug, logo_url, address, city, state, country, phone, email, currency, school_code)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING ${SCHOOL_COLUMNS}`,
      [
        input.school.name,
        slug,
        input.school.logoUrl ?? null,
        input.school.address,
        input.school.city,
        input.school.state,
        input.school.country,
        input.school.phone,
        input.school.email.toLowerCase(),
        input.school.currency.toUpperCase(),
        slug.replace(/[^a-z0-9]/g, "").toUpperCase(),
      ]
    );
    const school = schoolResult.rows[0];

    const profileResult = await client.query<ProfileRecord>(
      `INSERT INTO profiles (email, full_name, phone, password_hash)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, full_name, phone, avatar_url, created_at`,
      [input.owner.email.toLowerCase(), input.owner.fullName, input.owner.phone ?? null, passwordHash]
    );
    const user = profileResult.rows[0];

    const membershipResult = await client.query<{ id: string }>(
      `INSERT INTO memberships (school_id, user_id, role, is_active)
       VALUES ($1, $2, 'owner', TRUE)
       RETURNING id`,
      [school.id, user.id]
    );
    const membershipId = membershipResult.rows[0].id;

    const calendar = buildDefaultAcademicCalendar();
    const sessionResult = await client.query<{ id: string }>(
      `INSERT INTO academic_sessions (school_id, name, start_date, end_date, is_current)
       VALUES ($1, $2, $3, $4, TRUE) RETURNING id`,
      [school.id, calendar.sessionName, calendar.sessionStart, calendar.sessionEnd]
    );
    const sessionId = sessionResult.rows[0].id;

    const today = new Date().toISOString().slice(0, 10);
    let currentTermAssigned = false;
    for (const term of calendar.terms) {
      const isCurrent = !currentTermAssigned && today >= term.startDate && today <= term.endDate;
      if (isCurrent) currentTermAssigned = true;

      await client.query(
        `INSERT INTO terms (school_id, session_id, name, start_date, end_date, is_current)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [school.id, sessionId, term.name, term.startDate, term.endDate, isCurrent]
      );
    }

    if (!currentTermAssigned) {
      await client.query(
        "UPDATE terms SET is_current = TRUE WHERE school_id = $1 AND session_id = $2 AND name = 'First Term'",
        [school.id, sessionId]
      );
    }

    // Portal defaults: settings row and the WAEC-style grading bands every school starts from.
    await client.query("INSERT INTO school_settings (school_id) VALUES ($1) ON CONFLICT (school_id) DO NOTHING", [
      school.id,
    ]);
    for (const [min, max, grade, remark, isPass] of DEFAULT_GRADING_BANDS) {
      await client.query(
        `INSERT INTO grading_systems (school_id, name, min_score, max_score, grade, remark, is_pass)
         VALUES ($1, 'Default', $2, $3, $4, $5, $6)`,
        [school.id, min, max, grade, remark, isPass]
      );
    }

    await recordAuditLog(
      {
        schoolId: school.id,
        userId: user.id,
        action: "school.registered",
        resourceType: "school",
        resourceId: school.id,
      },
      client
    );

    return { user, school, role: "owner" as UserRole, membershipId, forcePasswordChange: false };
  });
}

interface LoginProfileRow extends ProfileRecord {
  password_hash: string;
  failed_login_count: number;
  locked_until: string | null;
  force_password_change: boolean;
}

/** Resolves the account's active membership and school, and applies the tenant-level access switches. */
async function resolveActiveMembership(userId: string): Promise<{ membershipId: string; role: UserRole; school: SchoolRecord }> {
  const membershipResult = await query<{ id: string; role: UserRole; school_id: string }>(
    `SELECT id, role, school_id FROM memberships
     WHERE user_id = $1 AND is_active = TRUE
     ORDER BY joined_at ASC
     LIMIT 1`,
    [userId]
  );

  if (membershipResult.rowCount === 0) {
    throw new ForbiddenError("This account has no active school membership.");
  }
  const membership = membershipResult.rows[0];

  const schoolResult = await query<SchoolRecord & { status: string }>(
    `SELECT ${SCHOOL_COLUMNS}, status FROM schools WHERE id = $1`,
    [membership.school_id]
  );
  const school = schoolResult.rows[0];

  if (school.status === "SUSPENDED") {
    throw new ForbiddenError("This school's account has been suspended. Please contact SchoolOS support.");
  }

  if (membership.role === "student" || membership.role === "parent") {
    const settings = await query<{ allow_student_portal: boolean; allow_parent_portal: boolean }>(
      "SELECT allow_student_portal, allow_parent_portal FROM school_settings WHERE school_id = $1",
      [school.id]
    );
    const row = settings.rows[0];
    if (row && membership.role === "student" && !row.allow_student_portal) {
      throw new ForbiddenError("The student portal is currently switched off for this school.");
    }
    if (row && membership.role === "parent" && !row.allow_parent_portal) {
      throw new ForbiddenError("The parent portal is currently switched off for this school.");
    }
  }

  return { membershipId: membership.id, role: membership.role, school };
}

export async function login(input: LoginInput, meta: RequestMeta = {}): Promise<AuthResult> {
  const email = input.email.toLowerCase();

  const profileResult = await query<LoginProfileRow>(
    `SELECT id, email, full_name, phone, avatar_url, created_at, password_hash, failed_login_count, locked_until,
            force_password_change
     FROM profiles WHERE email = $1`,
    [email]
  );

  // The same message and roughly the same work for "no such account" and "wrong password", so the
  // sign-in form cannot be used to discover which e-mail addresses are registered.
  const invalidCredentialsError = new UnauthorizedError("Invalid email or password.");

  if (profileResult.rowCount === 0) {
    await bcrypt.compare(input.password, DUMMY_PASSWORD_HASH);
    throw invalidCredentialsError;
  }

  const profile = profileResult.rows[0];

  if (profile.locked_until && new Date(profile.locked_until).getTime() > Date.now()) {
    throw new ForbiddenError("This account is temporarily locked due to repeated failed sign-in attempts.");
  }

  const passwordMatches = await bcrypt.compare(input.password, profile.password_hash);

  if (!passwordMatches) {
    const nextFailedCount = profile.failed_login_count + 1;
    const shouldLock = nextFailedCount >= MAX_FAILED_LOGINS;

    await query(
      `UPDATE profiles
       SET failed_login_count = $1,
           locked_until = $2
       WHERE id = $3`,
      [
        shouldLock ? 0 : nextFailedCount,
        shouldLock ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000) : null,
        profile.id,
      ]
    );

    await recordAuditLog({
      userId: profile.id,
      action: shouldLock ? "auth.account_locked" : "auth.login_failed",
      resourceType: "profile",
      resourceId: profile.id,
      ipAddress: meta.ipAddress ?? null,
    });

    throw invalidCredentialsError;
  }

  const { membershipId, role, school } = await resolveActiveMembership(profile.id);

  await query("UPDATE profiles SET failed_login_count = 0, locked_until = NULL, last_login_at = NOW() WHERE id = $1", [
    profile.id,
  ]);

  await recordAuditLog({
    schoolId: school.id,
    userId: profile.id,
    action: "auth.login",
    resourceType: "profile",
    resourceId: profile.id,
    ipAddress: meta.ipAddress ?? null,
  });

  const user: ProfileRecord = {
    id: profile.id,
    email: profile.email,
    full_name: profile.full_name,
    phone: profile.phone,
    avatar_url: profile.avatar_url,
    created_at: profile.created_at,
  };

  return { user, school, role, membershipId, forcePasswordChange: profile.force_password_change };
}

export async function getCurrentUser(userId: string, schoolId: string, membershipId: string): Promise<AuthResult> {
  const profileResult = await query<ProfileRecord & { force_password_change: boolean }>(
    "SELECT id, email, full_name, phone, avatar_url, created_at, force_password_change FROM profiles WHERE id = $1",
    [userId]
  );

  if (profileResult.rowCount === 0) {
    throw new UnauthorizedError("Account no longer exists.");
  }

  const membershipResult = await query<{ role: UserRole; is_active: boolean }>(
    "SELECT role, is_active FROM memberships WHERE id = $1 AND school_id = $2 AND user_id = $3",
    [membershipId, schoolId, userId]
  );

  if (membershipResult.rowCount === 0 || !membershipResult.rows[0].is_active) {
    throw new ForbiddenError("This membership is no longer active.");
  }

  const schoolResult = await query<SchoolRecord>(`SELECT ${SCHOOL_COLUMNS} FROM schools WHERE id = $1`, [schoolId]);

  if (schoolResult.rowCount === 0) {
    throw new ForbiddenError("School not found.");
  }

  const { force_password_change: forcePasswordChange, ...user } = profileResult.rows[0];

  return {
    user,
    school: schoolResult.rows[0],
    role: membershipResult.rows[0].role,
    membershipId,
    forcePasswordChange,
  };
}

// ---------------------------------------------------------------------------
// Refresh tokens: opaque, stored hashed, rotated on every use. Presenting a token that was already
// used is treated as theft and revokes every session of that account.
// ---------------------------------------------------------------------------

export async function issueRefreshToken(
  userId: string,
  schoolId: string,
  membershipId: string,
  meta: RequestMeta = {}
): Promise<string> {
  const token = generateOpaqueToken(48);
  await query(
    `INSERT INTO refresh_tokens (user_id, school_id, membership_id, token_hash, expires_at, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, NOW() + ($5 || ' days')::interval, $6, $7)`,
    [
      userId,
      schoolId,
      membershipId,
      hashToken(token),
      String(env.REFRESH_TOKEN_DAYS),
      meta.ipAddress ?? null,
      (meta.userAgent ?? "").slice(0, 300) || null,
    ]
  );
  return token;
}

export async function revokeAllRefreshTokens(userId: string): Promise<void> {
  await query("UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL", [userId]);
}

export async function revokeRefreshToken(token: string): Promise<void> {
  await query("UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1 AND revoked_at IS NULL", [
    hashToken(token),
  ]);
}

/** Validates and rotates a refresh token, returning the session it belongs to plus a replacement token. */
export async function rotateRefreshToken(
  token: string,
  meta: RequestMeta = {}
): Promise<{ result: AuthResult; refreshToken: string }> {
  const lookup = await query<{
    id: string;
    user_id: string;
    school_id: string;
    membership_id: string;
    expires_at: string;
    revoked_at: string | null;
  }>("SELECT id, user_id, school_id, membership_id, expires_at, revoked_at FROM refresh_tokens WHERE token_hash = $1", [
    hashToken(token),
  ]);

  const record = lookup.rows[0];
  if (!record) throw new UnauthorizedError("Session expired. Please sign in again.");

  if (record.revoked_at) {
    await revokeAllRefreshTokens(record.user_id);
    await recordAuditLog({
      schoolId: record.school_id,
      userId: record.user_id,
      action: "auth.refresh_token_reuse",
      resourceType: "profile",
      resourceId: record.user_id,
      ipAddress: meta.ipAddress ?? null,
    });
    throw new UnauthorizedError("Session expired. Please sign in again.");
  }

  if (new Date(record.expires_at).getTime() < Date.now()) {
    await revokeRefreshToken(token);
    throw new UnauthorizedError("Session expired. Please sign in again.");
  }

  // Deactivated members, suspended schools and switched-off portals are re-checked on every renewal,
  // so removing someone takes effect within one access-token lifetime.
  const result = await getCurrentUser(record.user_id, record.school_id, record.membership_id).catch(() => {
    throw new UnauthorizedError("Session expired. Please sign in again.");
  });
  await resolveActiveMembership(record.user_id);

  await revokeRefreshToken(token);
  const refreshToken = await issueRefreshToken(record.user_id, record.school_id, record.membership_id, meta);
  return { result, refreshToken };
}

// ---------------------------------------------------------------------------
// Passwords
// ---------------------------------------------------------------------------

async function loadPasswordHash(userId: string): Promise<string> {
  const result = await query<{ password_hash: string }>("SELECT password_hash FROM profiles WHERE id = $1", [userId]);
  if (result.rowCount === 0) throw new UnauthorizedError("Account no longer exists.");
  return result.rows[0].password_hash;
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
  const hash = await loadPasswordHash(userId);
  if (!(await bcrypt.compare(currentPassword, hash))) {
    throw new BadRequestError("Current password is incorrect.");
  }
  if (currentPassword === newPassword) {
    throw new BadRequestError("Choose a password you have not used before.");
  }

  await query("UPDATE profiles SET password_hash = $1, force_password_change = FALSE WHERE id = $2", [
    await bcrypt.hash(newPassword, BCRYPT_ROUNDS),
    userId,
  ]);
  await revokeAllRefreshTokens(userId);
}

/** Only valid while the account still has an admin-issued temporary password. */
export async function forceUpdatePassword(userId: string, newPassword: string): Promise<void> {
  const result = await query<{ password_hash: string; force_password_change: boolean }>(
    "SELECT password_hash, force_password_change FROM profiles WHERE id = $1",
    [userId]
  );
  const profile = result.rows[0];
  if (!profile) throw new UnauthorizedError("Account no longer exists.");
  if (!profile.force_password_change) {
    throw new ForbiddenError("A password change is not required for this account.");
  }
  if (await bcrypt.compare(newPassword, profile.password_hash)) {
    throw new BadRequestError("Choose a password different from the temporary one.");
  }

  await query("UPDATE profiles SET password_hash = $1, force_password_change = FALSE WHERE id = $2", [
    await bcrypt.hash(newPassword, BCRYPT_ROUNDS),
    userId,
  ]);
  await revokeAllRefreshTokens(userId);
}

/**
 * Always resolves silently — the response never reveals whether the e-mail belongs to an account.
 * The emailed token is random, single-use, expires in an hour and only its hash is stored.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const profile = await query<{ id: string; full_name: string }>(
    `SELECT p.id, p.full_name FROM profiles p
     WHERE p.email = $1 AND EXISTS (SELECT 1 FROM memberships m WHERE m.user_id = p.id AND m.is_active = TRUE)`,
    [email.toLowerCase()]
  );
  if (profile.rowCount === 0) return;

  const userId = profile.rows[0].id;
  const token = generateOpaqueToken(32);

  await query("UPDATE password_resets SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL", [userId]);
  await query(
    `INSERT INTO password_resets (user_id, token_hash, expires_at)
     VALUES ($1, $2, NOW() + ($3 || ' minutes')::interval)`,
    [userId, hashToken(token), String(PASSWORD_RESET_MINUTES)]
  );

  const template = emailTemplates.passwordReset(`${env.FRONTEND_URL}/reset-password?token=${token}`);
  void sendEmail({ to: email.toLowerCase(), subject: template.subject, html: template.html });
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const lookup = await query<{ id: string; user_id: string }>(
    `SELECT id, user_id FROM password_resets
     WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW()`,
    [hashToken(token)]
  );
  const record = lookup.rows[0];
  if (!record) throw new BadRequestError("This reset link is invalid or has expired.");

  const hash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await withTransaction(async (client) => {
    await client.query(
      `UPDATE profiles
       SET password_hash = $1, force_password_change = FALSE, failed_login_count = 0, locked_until = NULL
       WHERE id = $2`,
      [hash, record.user_id]
    );
    await client.query("UPDATE password_resets SET used_at = NOW() WHERE id = $1", [record.id]);
    await client.query("UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL", [
      record.user_id,
    ]);
  });
}
