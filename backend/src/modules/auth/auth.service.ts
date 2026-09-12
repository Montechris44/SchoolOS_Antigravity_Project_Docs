import bcrypt from "bcryptjs";

import { UserRole } from "../../config/rbac";
import { query, withTransaction } from "../../db/pool";
import { recordAuditLog } from "../../shared/audit/audit-log";
import { ConflictError, ForbiddenError, UnauthorizedError } from "../../shared/http/errors";
import { slugify } from "../../shared/text/slug";
import { LoginInput, RegisterSchoolInput } from "./auth.schemas";

const MAX_FAILED_LOGINS = 5;
const LOCKOUT_MINUTES = 15;
const BCRYPT_ROUNDS = 12;

export interface SchoolRecord {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
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
}

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
      `INSERT INTO schools (name, slug, logo_url, address, city, state, country, phone, email, currency)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, name, slug, logo_url, address, city, state, country, phone, email, currency, created_at`,
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

    return { user, school, role: "owner" as UserRole, membershipId };
  });
}

export async function login(input: LoginInput): Promise<AuthResult> {
  const email = input.email.toLowerCase();

  const profileResult = await query<
    ProfileRecord & { password_hash: string; failed_login_count: number; locked_until: string | null }
  >(
    "SELECT id, email, full_name, phone, avatar_url, created_at, password_hash, failed_login_count, locked_until FROM profiles WHERE email = $1",
    [email]
  );

  const invalidCredentialsError = new UnauthorizedError("Invalid email or password.");

  if (profileResult.rowCount === 0) {
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

    throw invalidCredentialsError;
  }

  await query("UPDATE profiles SET failed_login_count = 0, locked_until = NULL WHERE id = $1", [profile.id]);

  const membershipResult = await query<{ id: string; role: UserRole; school_id: string }>(
    `SELECT id, role, school_id FROM memberships
     WHERE user_id = $1 AND is_active = TRUE
     ORDER BY joined_at ASC
     LIMIT 1`,
    [profile.id]
  );

  if (membershipResult.rowCount === 0) {
    throw new ForbiddenError("This account has no active school membership.");
  }

  const membership = membershipResult.rows[0];

  const schoolResult = await query<SchoolRecord & { status: string }>(
    "SELECT id, name, slug, logo_url, address, city, state, country, phone, email, currency, created_at, status FROM schools WHERE id = $1",
    [membership.school_id]
  );

  const school = schoolResult.rows[0];

  if (school.status === "SUSPENDED") {
    throw new ForbiddenError("This school's account has been suspended. Please contact SchoolOS support.");
  }

  await recordAuditLog({
    schoolId: school.id,
    userId: profile.id,
    action: "auth.login",
    resourceType: "profile",
    resourceId: profile.id,
  });

  const user: ProfileRecord = {
    id: profile.id,
    email: profile.email,
    full_name: profile.full_name,
    phone: profile.phone,
    avatar_url: profile.avatar_url,
    created_at: profile.created_at,
  };

  return { user, school, role: membership.role, membershipId: membership.id };
}

export async function getCurrentUser(userId: string, schoolId: string, membershipId: string): Promise<AuthResult> {
  const profileResult = await query<ProfileRecord>(
    "SELECT id, email, full_name, phone, avatar_url, created_at FROM profiles WHERE id = $1",
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

  const schoolResult = await query<SchoolRecord>(
    "SELECT id, name, slug, logo_url, address, city, state, country, phone, email, currency, created_at FROM schools WHERE id = $1",
    [schoolId]
  );

  if (schoolResult.rowCount === 0) {
    throw new ForbiddenError("School not found.");
  }

  return {
    user: profileResult.rows[0],
    school: schoolResult.rows[0],
    role: membershipResult.rows[0].role,
    membershipId,
  };
}
