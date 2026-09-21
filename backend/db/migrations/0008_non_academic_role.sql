-- Support/non-teaching staff (security, cleaners, drivers, ...) get their own role.
-- Kept in a migration of its own: a newly added enum value cannot be *used* in the
-- same transaction that adds it, and the migration runner wraps each file in one.
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'non_academic';
