-- SchoolOS Row Level Security (RLS) Policies
-- Strict multi-tenant isolation enforcing that a user can ONLY access entities belonging to their authorized school

-- Helper function to check if the current user belongs to a school
CREATE OR REPLACE FUNCTION user_belongs_to_school(target_school_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM memberships
    WHERE memberships.school_id = target_school_id
      AND memberships.user_id = auth.uid()
      AND memberships.is_active = TRUE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check user role within a school
CREATE OR REPLACE FUNCTION user_has_school_role(target_school_id UUID, allowed_roles user_role[])
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM memberships
    WHERE memberships.school_id = target_school_id
      AND memberships.user_id = auth.uid()
      AND memberships.is_active = TRUE
      AND memberships.role = ANY(allowed_roles)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable RLS on all tenant-owned tables
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE academic_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE guardians ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_structures ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE intelligence_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- 1. Schools Policy
CREATE POLICY "Users can view their authorized schools"
  ON schools FOR SELECT
  USING (user_belongs_to_school(id));

-- 2. Memberships Policy
CREATE POLICY "Users can view memberships in their school"
  ON memberships FOR SELECT
  USING (user_belongs_to_school(school_id));

-- 3. Students Policy
CREATE POLICY "Tenant isolation for students SELECT"
  ON students FOR SELECT
  USING (user_belongs_to_school(school_id));

CREATE POLICY "Admin & Owner can manage students"
  ON students FOR ALL
  USING (user_has_school_role(school_id, ARRAY['owner'::user_role, 'admin'::user_role]));

-- 4. Attendance Policy
CREATE POLICY "Tenant isolation for attendance SELECT"
  ON attendance_records FOR SELECT
  USING (user_belongs_to_school(school_id));

CREATE POLICY "Teachers, Admins, Owners can mark attendance"
  ON attendance_records FOR INSERT
  WITH CHECK (user_has_school_role(school_id, ARRAY['owner'::user_role, 'admin'::user_role, 'teacher'::user_role]));

-- 5. Invoices & Payments Policy
CREATE POLICY "Tenant isolation for invoices SELECT"
  ON invoices FOR SELECT
  USING (user_belongs_to_school(school_id));

CREATE POLICY "Bursar, Admin, Owner can manage invoices"
  ON invoices FOR ALL
  USING (user_has_school_role(school_id, ARRAY['owner'::user_role, 'admin'::user_role, 'bursar'::user_role]));

CREATE POLICY "Tenant isolation for payments SELECT"
  ON payments FOR SELECT
  USING (user_belongs_to_school(school_id));

-- 6. Intelligence Signals & Actions Policy
CREATE POLICY "Tenant isolation for intelligence signals"
  ON intelligence_signals FOR SELECT
  USING (user_belongs_to_school(school_id));

CREATE POLICY "Tenant isolation for actions"
  ON actions FOR ALL
  USING (user_belongs_to_school(school_id));

-- 7. Audit Logs Policy (Append only for system, SELECT for authorized owners)
CREATE POLICY "Owners can view school audit logs"
  ON audit_logs FOR SELECT
  USING (user_has_school_role(school_id, ARRAY['owner'::user_role]));
