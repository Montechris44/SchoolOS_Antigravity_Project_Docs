-- School portal core: class arms, class teachers, results workflow, timetable, assignments,
-- messaging, notifications, events, leave, staff attendance, refresh/reset tokens.
--
-- Every user reference points at profiles(id) (the login identity); every table carries
-- school_id so tenant isolation is enforced by the application on each query. RLS is switched
-- on for the new tables with no policies: only the owning API role can read them, never a
-- role that authenticates through a data API.

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- Identity & tenant additions (all additive / nullable so existing rows stay valid)
-- ---------------------------------------------------------------------------
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS force_password_change BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS school_code TEXT,
  ADD COLUMN IF NOT EXISTS student_email_domain TEXT,
  ADD COLUMN IF NOT EXISTS theme_color TEXT;

UPDATE schools
SET school_code = UPPER(REGEXP_REPLACE(slug, '[^A-Za-z0-9]', '', 'g'))
WHERE school_code IS NULL OR school_code = '';

CREATE TABLE IF NOT EXISTS school_settings (
  school_id UUID PRIMARY KEY REFERENCES schools(id) ON DELETE CASCADE,
  pass_mark NUMERIC(5,2) NOT NULL DEFAULT 50 CHECK (pass_mark BETWEEN 0 AND 100),
  max_score NUMERIC(5,2) NOT NULL DEFAULT 100,
  ranking_mode TEXT NOT NULL DEFAULT 'AUTO' CHECK (ranking_mode IN ('AUTO', 'AVERAGE', 'SSS_GRADE_COUNTS')),
  allow_parent_portal BOOLEAN NOT NULL DEFAULT TRUE,
  allow_student_portal BOOLEAN NOT NULL DEFAULT TRUE,
  timezone TEXT NOT NULL DEFAULT 'Africa/Lagos',
  staff_sign_in_cutoff TIME NOT NULL DEFAULT '08:00',
  staff_very_late_cutoff TIME NOT NULL DEFAULT '09:00',
  watermark_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO school_settings (school_id) SELECT id FROM schools ON CONFLICT (school_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS student_id_counters (
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  last_seq INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (school_id, year)
);

-- Grading bands (WAEC style by default), one set per school.
CREATE TABLE IF NOT EXISTS grading_systems (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Default',
  min_score NUMERIC(5,2) NOT NULL,
  max_score NUMERIC(5,2) NOT NULL,
  grade TEXT NOT NULL,
  remark TEXT,
  is_pass BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (min_score >= 0 AND max_score <= 100 AND min_score <= max_score)
);
CREATE INDEX IF NOT EXISTS idx_grading_systems_school ON grading_systems(school_id);

INSERT INTO grading_systems (school_id, name, min_score, max_score, grade, remark, is_pass)
SELECT s.id, 'Default', g.min_score, g.max_score, g.grade, g.remark, g.is_pass
FROM schools s
CROSS JOIN (VALUES
  (75, 100, 'A1', 'Excellent', TRUE),
  (70, 74.99, 'B2', 'Very good', TRUE),
  (65, 69.99, 'B3', 'Good', TRUE),
  (60, 64.99, 'C4', 'Credit', TRUE),
  (55, 59.99, 'C5', 'Credit', TRUE),
  (50, 54.99, 'C6', 'Credit', TRUE),
  (45, 49.99, 'D7', 'Pass', TRUE),
  (40, 44.99, 'E8', 'Weak pass', TRUE),
  (0, 39.99, 'F9', 'Fail', FALSE)
) AS g(min_score, max_score, grade, remark, is_pass);

-- ---------------------------------------------------------------------------
-- Academic structure
-- ---------------------------------------------------------------------------
ALTER TABLE terms
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deactivated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE classes
  ADD COLUMN IF NOT EXISTS level INTEGER,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS class_teacher_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE TABLE IF NOT EXISTS class_arms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  capacity INTEGER NOT NULL DEFAULT 40 CHECK (capacity > 0),
  class_teacher_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (class_id, name)
);
CREATE INDEX IF NOT EXISTS idx_class_arms_school ON class_arms(school_id);
CREATE INDEX IF NOT EXISTS idx_class_arms_class ON class_arms(class_id);

-- A teacher may be class teacher of exactly one class or arm.
CREATE UNIQUE INDEX IF NOT EXISTS uq_class_arms_class_teacher ON class_arms(class_teacher_id) WHERE class_teacher_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_classes_class_teacher ON classes(class_teacher_id) WHERE class_teacher_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS global_subjects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  code TEXT,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'GENERAL',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE subjects
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS global_subject_id UUID REFERENCES global_subjects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'CUSTOM' CHECK (source IN ('GLOBAL', 'CUSTOM'));

-- ---------------------------------------------------------------------------
-- People
-- ---------------------------------------------------------------------------
ALTER TABLE students
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS arm_id UUID REFERENCES class_arms(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS photo_url TEXT,
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS blood_group TEXT,
  ADD COLUMN IF NOT EXISTS genotype TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE students ALTER COLUMN date_of_birth DROP NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_students_user ON students(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_students_class_arm ON students(school_id, current_class_id, arm_id);

ALTER TABLE staff
  ADD COLUMN IF NOT EXISTS gender TEXT,
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS date_of_birth DATE,
  ADD COLUMN IF NOT EXISTS qualification TEXT,
  ADD COLUMN IF NOT EXISTS years_of_experience INTEGER,
  ADD COLUMN IF NOT EXISTS department TEXT,
  ADD COLUMN IF NOT EXISTS join_date DATE,
  ADD COLUMN IF NOT EXISTS photo_url TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE teacher_assignments
  ADD COLUMN IF NOT EXISTS teacher_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS arm_id UUID REFERENCES class_arms(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS term_id UUID REFERENCES terms(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES academic_sessions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE teacher_assignments ta
SET teacher_id = st.user_id
FROM staff st
WHERE st.id = ta.staff_id AND ta.teacher_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_teacher_assignments_teacher ON teacher_assignments(school_id, teacher_id) WHERE is_active;
CREATE UNIQUE INDEX IF NOT EXISTS uq_teacher_assignments_scope
  ON teacher_assignments (school_id, teacher_id, class_id, subject_id, COALESCE(arm_id, '00000000-0000-0000-0000-000000000000'::uuid))
  WHERE teacher_id IS NOT NULL AND subject_id IS NOT NULL;

ALTER TABLE attendance_records
  ADD COLUMN IF NOT EXISTS arm_id UUID REFERENCES class_arms(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_attendance_school_date ON attendance_records(school_id, date);

-- ---------------------------------------------------------------------------
-- Results workflow: CA scheme -> subject batch -> class teacher -> admin -> release
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE RESTRICT,
  arm_id UUID REFERENCES class_arms(id) ON DELETE SET NULL,
  term_id UUID NOT NULL REFERENCES terms(id) ON DELETE RESTRICT,
  session_id UUID NOT NULL REFERENCES academic_sessions(id) ON DELETE RESTRICT,
  total_score NUMERIC(8,2),
  average_score NUMERIC(6,2),
  position INTEGER,
  position_suffix TEXT,
  class_size INTEGER,
  total_subjects INTEGER NOT NULL DEFAULT 0,
  passed_subjects INTEGER NOT NULL DEFAULT 0,
  failed_subjects INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'SUBMITTED', 'LOCKED', 'PUBLISHED')),
  approval_status TEXT NOT NULL DEFAULT 'DRAFT'
    CHECK (approval_status IN ('DRAFT', 'SUBMITTED_FOR_APPROVAL', 'PENDING_REVIEW', 'RETURNED_FOR_CORRECTION', 'APPROVED', 'PUBLISHED')),
  submitted_at TIMESTAMPTZ,
  submitted_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  published_at TIMESTAMPTZ,
  published_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  class_teacher_submitted_at TIMESTAMPTZ,
  class_teacher_submitted_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  teacher_remark TEXT,
  principal_remark TEXT,
  correction_reason TEXT,
  grade_counts JSONB,
  pdf_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (student_id, term_id)
);
CREATE INDEX IF NOT EXISTS idx_results_school_term ON results(school_id, term_id, session_id);
CREATE INDEX IF NOT EXISTS idx_results_class ON results(school_id, class_id, term_id, session_id);
CREATE INDEX IF NOT EXISTS idx_results_approval ON results(school_id, approval_status);

CREATE TABLE IF NOT EXISTS result_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  result_id UUID NOT NULL REFERENCES results(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE RESTRICT,
  teacher_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ca_score NUMERIC(6,2) NOT NULL DEFAULT 0,
  exam_score NUMERIC(6,2) NOT NULL DEFAULT 0,
  total_score NUMERIC(6,2) GENERATED ALWAYS AS (ca_score + exam_score) STORED,
  grade TEXT,
  remark TEXT,
  subject_remark TEXT,
  ca_components JSONB NOT NULL DEFAULT '{}'::jsonb,
  scores_complete BOOLEAN NOT NULL DEFAULT FALSE,
  computed_total NUMERIC(6,2),
  is_locked BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (result_id, subject_id)
);
CREATE INDEX IF NOT EXISTS idx_result_entries_result ON result_entries(result_id);
CREATE INDEX IF NOT EXISTS idx_result_entries_subject ON result_entries(school_id, subject_id);

CREATE TABLE IF NOT EXISTS teacher_assessment_schemes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  arm_id UUID REFERENCES class_arms(id) ON DELETE SET NULL,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  term_id UUID NOT NULL REFERENCES terms(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES academic_sessions(id) ON DELETE CASCADE,
  components JSONB NOT NULL DEFAULT '[]'::jsonb,
  exam_max_score NUMERIC(6,2) NOT NULL DEFAULT 60 CHECK (exam_max_score > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_schemes_scope_arm
  ON teacher_assessment_schemes (school_id, class_id, arm_id, subject_id, term_id) WHERE arm_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_schemes_scope_no_arm
  ON teacher_assessment_schemes (school_id, class_id, subject_id, term_id) WHERE arm_id IS NULL;

CREATE TABLE IF NOT EXISTS subject_score_batches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  arm_id UUID REFERENCES class_arms(id) ON DELETE SET NULL,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  term_id UUID NOT NULL REFERENCES terms(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES academic_sessions(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT', 'PUBLISHED_TO_CLASS_TEACHER', 'NEEDS_REPUBLISH', 'PENDING_REVIEW', 'RETURNED_FOR_CORRECTION', 'APPROVED', 'PUBLISHED')),
  published_at TIMESTAMPTZ,
  last_edited_at TIMESTAMPTZ,
  submitted_to_admin_at TIMESTAMPTZ,
  submitted_to_admin_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  review_notes TEXT,
  released_at TIMESTAMPTZ,
  released_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_batches_scope_arm
  ON subject_score_batches (school_id, class_id, arm_id, subject_id, term_id) WHERE arm_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_batches_scope_no_arm
  ON subject_score_batches (school_id, class_id, subject_id, term_id) WHERE arm_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_batches_admin_queue ON subject_score_batches (school_id, session_id, term_id, status);

CREATE TABLE IF NOT EXISTS score_edit_audits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  batch_id UUID REFERENCES subject_score_batches(id) ON DELETE SET NULL,
  result_entry_id UUID REFERENCES result_entries(id) ON DELETE SET NULL,
  edited_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  class_teacher_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  class_id UUID,
  arm_id UUID,
  subject_id UUID,
  term_id UUID,
  student_id UUID,
  changes JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_score_edit_audits_ct ON score_edit_audits (school_id, class_teacher_id, created_at DESC);

CREATE TABLE IF NOT EXISTS class_rankings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  arm_id UUID REFERENCES class_arms(id) ON DELETE CASCADE,
  term_id UUID NOT NULL REFERENCES terms(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES academic_sessions(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  position_suffix TEXT,
  total_score NUMERIC(8,2),
  average_score NUMERIC(6,2),
  total_subjects INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (student_id, term_id)
);
CREATE INDEX IF NOT EXISTS idx_class_rankings_class_term ON class_rankings(class_id, term_id, session_id, position);

CREATE TABLE IF NOT EXISTS report_cards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  result_id UUID NOT NULL REFERENCES results(id) ON DELETE CASCADE,
  term_id UUID NOT NULL REFERENCES terms(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES academic_sessions(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE RESTRICT,
  arm_id UUID REFERENCES class_arms(id) ON DELETE SET NULL,
  total_score NUMERIC(8,2),
  average_score NUMERIC(6,2),
  position INTEGER,
  position_suffix TEXT,
  class_size INTEGER,
  total_subjects INTEGER,
  passed_subjects INTEGER,
  failed_subjects INTEGER,
  teacher_remark TEXT,
  principal_remark TEXT,
  next_term_begins DATE,
  term_ending_date DATE,
  status TEXT NOT NULL DEFAULT 'GENERATED',
  pdf_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (student_id, term_id)
);

CREATE TABLE IF NOT EXISTS approval_workflow_audit (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  result_id UUID NOT NULL REFERENCES results(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  previous_status TEXT,
  new_status TEXT,
  performed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reason TEXT,
  performed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_approval_audit_result ON approval_workflow_audit(result_id, performed_at DESC);

CREATE OR REPLACE FUNCTION audit_result_approval_change() RETURNS TRIGGER AS $$
BEGIN
  IF OLD.approval_status IS DISTINCT FROM NEW.approval_status THEN
    INSERT INTO approval_workflow_audit (school_id, result_id, action, previous_status, new_status, performed_by, reason)
    VALUES (
      NEW.school_id, NEW.id, 'STATUS_CHANGE', OLD.approval_status, NEW.approval_status,
      COALESCE(NEW.published_by, NEW.approved_by, NEW.reviewed_by, NEW.submitted_by),
      NEW.correction_reason
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_results_approval_audit ON results;
CREATE TRIGGER trg_results_approval_audit
  AFTER UPDATE OF approval_status ON results
  FOR EACH ROW EXECUTE FUNCTION audit_result_approval_change();

-- ---------------------------------------------------------------------------
-- Timetable, assignments, messaging, notifications, events, leave, staff attendance
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS timetable (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  arm_id UUID REFERENCES class_arms(id) ON DELETE SET NULL,
  term_id UUID REFERENCES terms(id) ON DELETE SET NULL,
  subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL,
  teacher_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  room TEXT,
  file_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (end_time > start_time)
);
CREATE INDEX IF NOT EXISTS idx_timetable_class ON timetable(school_id, class_id, day_of_week, start_time);
CREATE INDEX IF NOT EXISTS idx_timetable_teacher ON timetable(school_id, teacher_id, day_of_week, start_time);

CREATE TABLE IF NOT EXISTS assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  arm_id UUID REFERENCES class_arms(id) ON DELETE SET NULL,
  subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL,
  teacher_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  points INTEGER NOT NULL DEFAULT 100 CHECK (points > 0),
  due_date TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'PUBLISHED' CHECK (status IN ('DRAFT', 'PUBLISHED', 'CLOSED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_assignments_class ON assignments(school_id, class_id, due_date);

CREATE TABLE IF NOT EXISTS assignment_submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'NOT_STARTED' CHECK (status IN ('NOT_STARTED', 'IN_PROGRESS', 'SUBMITTED', 'GRADED')),
  submission_text TEXT,
  grade_score NUMERIC(6,2),
  feedback TEXT,
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (assignment_id, student_id)
);
CREATE INDEX IF NOT EXISTS idx_assignment_submissions_student ON assignment_submissions(school_id, student_id);

CREATE TABLE IF NOT EXISTS assignment_files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  submission_id UUID NOT NULL REFERENCES assignment_submissions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  mime_type TEXT,
  public_id TEXT,
  bytes INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  subject TEXT,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'SENT' CHECK (status IN ('SENT', 'READ', 'DELETED')),
  read_at TIMESTAMPTZ,
  parent_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_messages_recipient ON messages(school_id, recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(school_id, sender_id, created_at DESC);

CREATE TABLE IF NOT EXISTS message_broadcasts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  subject TEXT,
  body TEXT NOT NULL,
  class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
  arm_id UUID REFERENCES class_arms(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_message_broadcasts_school ON message_broadcasts(school_id, created_at DESC);

CREATE TABLE IF NOT EXISTS message_broadcast_reads (
  broadcast_id UUID NOT NULL REFERENCES message_broadcasts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (broadcast_id, user_id)
);

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(school_id, user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  event_type TEXT NOT NULL DEFAULT 'ACADEMIC'
    CHECK (event_type IN ('ACADEMIC', 'SOCIAL', 'SPORTS', 'EXAMINATION', 'HOLIDAY', 'OTHER')),
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ,
  location TEXT,
  is_public BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_events_school_start ON events(school_id, start_date);

CREATE TABLE IF NOT EXISTS leave_passes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  leave_type TEXT NOT NULL DEFAULT 'GENERAL',
  reason TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')),
  approved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (end_date >= start_date)
);
CREATE INDEX IF NOT EXISTS idx_leave_passes_school ON leave_passes(school_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS staff_attendance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  attendance_date DATE NOT NULL,
  sign_in_time TIME,
  sign_out_time TIME,
  status TEXT NOT NULL DEFAULT 'ABSENT' CHECK (status IN ('ON_TIME', 'LATE', 'VERY_LATE', 'ABSENT', 'ON_LEAVE')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (school_id, staff_id, attendance_date)
);
CREATE INDEX IF NOT EXISTS idx_staff_attendance_date ON staff_attendance(school_id, attendance_date);

CREATE TABLE IF NOT EXISTS staff_attendance_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  attendance_date DATE NOT NULL,
  is_open BOOLEAN NOT NULL DEFAULT TRUE,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  opened_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  closed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (school_id, attendance_date)
);

CREATE TABLE IF NOT EXISTS staff_leave_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  staff_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  leave_type TEXT NOT NULL DEFAULT 'OTHER',
  reason TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')),
  review_notes TEXT,
  reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (end_date >= start_date)
);
CREATE INDEX IF NOT EXISTS idx_staff_leave_school ON staff_leave_requests(school_id, status, created_at DESC);

-- ---------------------------------------------------------------------------
-- Session credentials: refresh tokens & password resets are stored as SHA-256 hashes,
-- so a database read never yields a usable token.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  membership_id UUID REFERENCES memberships(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id) WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS password_resets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_password_resets_user ON password_resets(user_id) WHERE used_at IS NULL;

-- ---------------------------------------------------------------------------
-- Triggers & row level security for everything new
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'school_settings', 'grading_systems', 'terms', 'classes', 'class_arms', 'students', 'staff',
    'teacher_assignments', 'results', 'result_entries', 'teacher_assessment_schemes', 'subject_score_batches',
    'class_rankings', 'report_cards', 'timetable', 'assignments', 'assignment_submissions', 'messages',
    'events', 'leave_passes', 'staff_attendance', 'staff_attendance_sessions', 'staff_leave_requests'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_updated_at ON %I', t, t);
    EXECUTE format('CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at()', t, t);
  END LOOP;

  FOREACH t IN ARRAY ARRAY[
    'school_settings', 'student_id_counters', 'grading_systems', 'class_arms', 'global_subjects', 'results',
    'result_entries', 'teacher_assessment_schemes', 'subject_score_batches', 'score_edit_audits', 'class_rankings',
    'report_cards', 'approval_workflow_audit', 'timetable', 'assignments', 'assignment_submissions',
    'assignment_files', 'messages', 'message_broadcasts', 'message_broadcast_reads', 'notifications', 'events',
    'leave_passes', 'staff_attendance', 'staff_attendance_sessions', 'staff_leave_requests', 'refresh_tokens',
    'password_resets'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- Platform catalogue of Nigerian school subjects
-- ---------------------------------------------------------------------------
INSERT INTO global_subjects (name, code, description, category) VALUES
  ('Mathematics', 'MTH', 'Core mathematics for all levels', 'CORE'),
  ('English Language', 'ENG', 'Core English language and communication', 'CORE'),
  ('Civic Education', 'CIV', 'Citizenship, rights and civic responsibility', 'CORE'),
  ('Computer Studies', 'CMP', 'Basic computing and digital literacy', 'CORE'),
  ('Information and Communication Technology', 'ICT', 'ICT applications and digital skills', 'CORE'),
  ('Physical and Health Education', 'PHE', 'Physical fitness, sports and health education', 'CORE'),
  ('Agricultural Science', 'AGR', 'Crop and animal production basics', 'CORE'),
  ('French', 'FRE', 'French as a foreign language', 'LANGUAGE'),
  ('Yoruba', 'YOR', 'Yoruba language studies', 'LANGUAGE'),
  ('Igbo', 'IGB', 'Igbo language studies', 'LANGUAGE'),
  ('Hausa', 'HAU', 'Hausa language studies', 'LANGUAGE'),
  ('Arabic Studies', 'ARA', 'Arabic language and Islamic scholarship', 'LANGUAGE'),
  ('Christian Religious Studies', 'CRS', 'Christian religious education', 'RELIGION'),
  ('Islamic Religious Studies', 'IRS', 'Islamic religious education', 'RELIGION'),
  ('Security Education', 'SEC', 'Security awareness and safety education', 'CORE'),
  ('Entrepreneurship Education', 'ENT', 'Enterprise and business skills', 'CORE'),
  ('Basic Science and Technology', 'BST', 'Integrated science and technology for primary', 'PRIMARY'),
  ('Cultural and Creative Arts', 'CCA', 'Arts, culture and creativity for primary/JSS', 'PRIMARY'),
  ('National Values Education', 'NVE', 'Civic, social and security values (primary)', 'PRIMARY'),
  ('Pre-Vocational Studies', 'PVS', 'Introductory vocational skills', 'PRIMARY'),
  ('Quantitative Reasoning', 'QR', 'Numerical reasoning and aptitude', 'PRIMARY'),
  ('Verbal Reasoning', 'VR', 'Verbal aptitude and comprehension', 'PRIMARY'),
  ('Handwriting', 'HW', 'Penmanship and writing skills', 'PRIMARY'),
  ('Phonics', 'PHN', 'Early reading and phonics', 'PRIMARY'),
  ('Moral Instruction', 'MOR', 'Moral and character education', 'PRIMARY'),
  ('Basic Science', 'BSC', 'Integrated science for junior secondary', 'JSS'),
  ('Basic Technology', 'BTE', 'Introductory technology and workshop practice', 'JSS'),
  ('Social Studies', 'SOS', 'Society, culture and environment', 'JSS'),
  ('Business Studies', 'BUS', 'Introductory commerce and office skills', 'JSS'),
  ('Home Economics', 'HEC', 'Food, clothing and family living', 'JSS'),
  ('Music', 'MUS', 'Music theory and practical', 'JSS'),
  ('Fine Arts', 'ART', 'Visual arts and design', 'JSS'),
  ('History', 'HIS', 'Historical studies', 'JSS'),
  ('Religious and National Values', 'RNV', 'Integrated CRS/IRS, civic and security education', 'JSS'),
  ('Literature-in-English', 'LIT', 'Prose, drama and poetry in English', 'SSS'),
  ('Government', 'GOV', 'Political systems and Nigerian government', 'SSS'),
  ('Economics', 'ECO', 'Micro and macro economics', 'SSS'),
  ('Commerce', 'COM', 'Trade, business and commercial practice', 'SSS'),
  ('Geography', 'GEO', 'Physical and human geography', 'SSS'),
  ('Christian Religious Knowledge', 'CRK', 'Advanced CRS for senior secondary', 'SSS'),
  ('Islamic Religious Knowledge', 'IRK', 'Advanced IRS for senior secondary', 'SSS'),
  ('Visual Arts', 'VAR', 'Drawing, painting and visual design', 'SSS'),
  ('Theatre Arts', 'THA', 'Drama and performing arts', 'SSS'),
  ('Tourism', 'TOU', 'Tourism and hospitality fundamentals', 'SSS'),
  ('Biology', 'BIO', 'Life sciences', 'SSS'),
  ('Chemistry', 'CHM', 'Chemical sciences', 'SSS'),
  ('Physics', 'PHY', 'Physical sciences', 'SSS'),
  ('Further Mathematics', 'FMTH', 'Advanced mathematics for science stream', 'SSS'),
  ('Technical Drawing', 'TD', 'Engineering and technical drawing', 'SSS'),
  ('Food and Nutrition', 'FAN', 'Nutrition science and food preparation', 'SSS'),
  ('Clothing and Textiles', 'CLT', 'Garment and textile studies', 'SSS'),
  ('Financial Accounting', 'ACC', 'Bookkeeping and financial accounting', 'SSS'),
  ('Book Keeping', 'BKP', 'Basic bookkeeping', 'SSS'),
  ('Office Practice', 'OFP', 'Office administration and practice', 'SSS'),
  ('Store Management', 'STM', 'Stores and inventory management', 'SSS'),
  ('Marketing', 'MKT', 'Marketing principles and practice', 'SSS'),
  ('Insurance', 'INS', 'Insurance principles', 'SSS'),
  ('Data Processing', 'DPR', 'Data processing and computer applications', 'SSS'),
  ('Typewriting', 'TYP', 'Keyboarding and typewriting', 'SSS'),
  ('Shorthand', 'SHT', 'Shorthand writing', 'SSS'),
  ('Animal Husbandry', 'ANH', 'Livestock production and care', 'TRADE'),
  ('Fishery', 'FSH', 'Fish farming and fishery science', 'TRADE'),
  ('Catering Craft Practice', 'CCP', 'Catering and food service craft', 'TRADE'),
  ('Garment Making', 'GMK', 'Fashion and garment construction', 'TRADE'),
  ('Cosmetology', 'COS', 'Beauty and cosmetology craft', 'TRADE'),
  ('Building Construction', 'BLD', 'Building and construction trades', 'TRADE'),
  ('Woodwork', 'WDW', 'Carpentry and woodwork', 'TRADE'),
  ('Metalwork', 'MTW', 'Metal fabrication and workshop', 'TRADE'),
  ('Auto Mechanics', 'ATM', 'Automobile maintenance and repair', 'TRADE'),
  ('Electrical Installation and Maintenance Work', 'EIM', 'Electrical installation craft', 'TRADE'),
  ('Electronics', 'ELE', 'Electronics craft practice', 'TRADE'),
  ('Photography', 'PHO', 'Photographic practice', 'TRADE'),
  ('Printing Craft Practice', 'PRN', 'Printing and graphic craft', 'TRADE'),
  ('GSM Phone Maintenance and Repairs', 'GSM', 'Mobile phone repair trade', 'TRADE'),
  ('Furniture Making', 'FUR', 'Furniture design and making', 'TRADE'),
  ('Painting and Decorating', 'PAD', 'Painting and decorative trades', 'TRADE'),
  ('Plumbing and Pipe Fitting', 'PLB', 'Plumbing craft practice', 'TRADE'),
  ('Welding and Fabrication Engineering Craft Practice', 'WLD', 'Welding and metal fabrication', 'TRADE')
ON CONFLICT (name) DO NOTHING;
