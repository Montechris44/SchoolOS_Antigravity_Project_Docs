-- SchoolOS Database Schema Migration
-- Tenancy, RBAC, Core Entities & Audit Trail

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Schools (Tenant entity)
CREATE TABLE IF NOT EXISTS schools (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  logo_url TEXT,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'Nigeria',
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'NGN',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Profiles / Users
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. School Memberships (Tenancy & RBAC linkage)
CREATE TYPE user_role AS ENUM ('owner', 'admin', 'bursar', 'teacher', 'parent', 'student');

CREATE TABLE IF NOT EXISTS memberships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role user_role NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(school_id, user_id)
);

-- 4. Academic Sessions & Terms
CREATE TABLE IF NOT EXISTS academic_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL, -- e.g. "2026/2027"
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_current BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(school_id, name)
);

CREATE TABLE IF NOT EXISTS terms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES academic_sessions(id) ON DELETE CASCADE,
  name TEXT NOT NULL, -- "First Term", "Second Term", "Third Term"
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_current BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(school_id, session_id, name)
);

-- 5. Classes & Subjects
CREATE TABLE IF NOT EXISTS classes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL, -- "JSS 1 Gold", "Primary 4 Blue"
  grade_level TEXT NOT NULL, -- "JSS 1", "SS 2"
  capacity INTEGER NOT NULL DEFAULT 40,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(school_id, name)
);

CREATE TABLE IF NOT EXISTS subjects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(school_id, code)
);

-- 6. Guardians & Students
CREATE TABLE IF NOT EXISTS guardians (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  relationship TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS students (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  admission_number TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  middle_name TEXT,
  gender TEXT NOT NULL CHECK (gender IN ('male', 'female')),
  date_of_birth DATE NOT NULL,
  current_class_id UUID NOT NULL REFERENCES classes(id) ON DELETE RESTRICT,
  guardian_id UUID REFERENCES guardians(id) ON DELETE SET NULL,
  enrollment_status TEXT NOT NULL DEFAULT 'active' CHECK (enrollment_status IN ('active', 'graduated', 'transferred', 'suspended')),
  enrolled_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(school_id, admission_number)
);

-- 7. Staff & Teacher Assignments
CREATE TABLE IF NOT EXISTS staff (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  employee_id TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  role user_role NOT NULL,
  title TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(school_id, employee_id)
);

CREATE TABLE IF NOT EXISTS teacher_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
  is_class_teacher BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. Attendance Records
CREATE TABLE IF NOT EXISTS attendance_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('PRESENT', 'ABSENT', 'LATE', 'EXCUSED')),
  marked_by_user_id UUID NOT NULL REFERENCES profiles(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(school_id, class_id, student_id, date)
);

-- 9. Assessments, Scores & Results
CREATE TABLE IF NOT EXISTS assessments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  term_id UUID NOT NULL REFERENCES terms(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('CA1', 'CA2', 'EXAM', 'PROJECT')),
  max_score NUMERIC(5,2) NOT NULL DEFAULT 100,
  weight_percentage NUMERIC(5,2) NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  score_obtained NUMERIC(5,2) NOT NULL CHECK (score_obtained >= 0),
  entered_by_user_id UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(school_id, assessment_id, student_id)
);

-- 10. Fee Structures, Invoices & Payments
CREATE TABLE IF NOT EXISTS fee_structures (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  term_id UUID NOT NULL REFERENCES terms(id) ON DELETE CASCADE,
  class_grade_level TEXT NOT NULL,
  title TEXT NOT NULL,
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  due_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  guardian_id UUID REFERENCES guardians(id) ON DELETE SET NULL,
  term_id UUID NOT NULL REFERENCES terms(id) ON DELETE RESTRICT,
  total_amount NUMERIC(12,2) NOT NULL CHECK (total_amount >= 0),
  amount_paid NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
  balance_due NUMERIC(12,2) GENERATED ALWAYS AS (total_amount - amount_paid) STORED,
  status TEXT NOT NULL DEFAULT 'ISSUED' CHECK (status IN ('DRAFT', 'ISSUED', 'PARTIAL', 'PAID', 'OVERDUE', 'CANCELLED')),
  due_date DATE NOT NULL,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(school_id, invoice_number)
);

CREATE TABLE IF NOT EXISTS invoice_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0)
);

CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE RESTRICT,
  receipt_number TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  provider TEXT NOT NULL CHECK (provider IN ('paystack', 'manual')),
  provider_reference TEXT NOT NULL,
  payment_method TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('INITIATED', 'PENDING', 'VERIFIED_SUCCESS', 'FAILED', 'CANCELLED')),
  paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  payer_name TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(school_id, provider_reference),
  UNIQUE(school_id, idempotency_key)
);

-- 11. Intelligence Signals & Action Center
CREATE TABLE IF NOT EXISTS intelligence_signals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  metric_value TEXT NOT NULL,
  threshold TEXT NOT NULL,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  action_created BOOLEAN NOT NULL DEFAULT FALSE,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS actions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  signal_id UUID REFERENCES intelligence_signals(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  recommended_step TEXT NOT NULL,
  priority TEXT NOT NULL CHECK (priority IN ('P0', 'P1', 'P2')),
  assigned_to_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'DISMISSED')),
  notes TEXT,
  outcome TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- 12. Audit Logs (Append-Only)
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  payload JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
