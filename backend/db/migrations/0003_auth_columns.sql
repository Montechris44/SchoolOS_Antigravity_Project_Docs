-- Self-rolled bcrypt + JWT auth (no Supabase Auth) needs credentials on profiles.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS password_hash TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS failed_login_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;

ALTER TABLE profiles ALTER COLUMN password_hash DROP DEFAULT;
