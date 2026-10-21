ALTER TABLE school_settings ADD COLUMN IF NOT EXISTS student_fields JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE school_settings ADD COLUMN IF NOT EXISTS teacher_fields JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE students ADD COLUMN IF NOT EXISTS custom_fields JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS custom_fields JSONB NOT NULL DEFAULT '{}'::jsonb;
