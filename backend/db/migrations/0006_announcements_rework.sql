-- 0004's announcements/announcement_templates shape didn't match the real product
-- contract (channels array, delivery stats, status lifecycle). Nothing had been
-- written to either table yet, so replace them outright rather than patching.
DROP TABLE IF EXISTS announcements;
DROP TABLE IF EXISTS announcement_templates;

CREATE TABLE announcements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  channels TEXT[] NOT NULL,
  target_audience TEXT NOT NULL CHECK (target_audience IN ('all', 'parents', 'teachers', 'class')),
  target_class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'SENT' CHECK (status IN ('DRAFT', 'QUEUED', 'SENT', 'FAILED')),
  sent_at TIMESTAMPTZ,
  recipient_count INTEGER NOT NULL DEFAULT 0,
  delivered_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  pending_count INTEGER NOT NULL DEFAULT 0,
  sent_by_user_id UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
