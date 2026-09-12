-- Communication module: templates and sent announcements.

CREATE TABLE IF NOT EXISTS announcement_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  created_by_user_id UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(school_id, name)
);

CREATE TABLE IF NOT EXISTS announcements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  template_id UUID REFERENCES announcement_templates(id) ON DELETE SET NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  audience TEXT NOT NULL CHECK (audience IN ('all', 'staff', 'teachers', 'parents', 'students', 'class')),
  class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
  sent_by_user_id UUID NOT NULL REFERENCES profiles(id),
  recipient_count INTEGER NOT NULL DEFAULT 0,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
