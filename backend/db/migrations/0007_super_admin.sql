-- Platform-level super admin: a tenant-less identity, kept in its own table
-- rather than as a role inside `memberships` (which is always school-scoped).
-- Mirrors the reference project's pattern: separate table, own login, and
-- final authority over tenant lifecycle (suspend/reactivate a school).

CREATE TABLE super_admins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  failed_login_count INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tenant lifecycle control. A super admin can suspend a school, which blocks
-- every member of that school from logging in until reactivated.
ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED'));

-- audit_logs.school_id is NOT NULL today; super-admin actions are often
-- platform-wide (no single school), and some target a school without being
-- performed "as" a school member, so both need to be nullable here.
ALTER TABLE audit_logs
  ALTER COLUMN school_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS super_admin_id UUID REFERENCES super_admins(id) ON DELETE SET NULL;
