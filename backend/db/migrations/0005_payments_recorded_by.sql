-- Track which staff member recorded a manual payment (NULL for Paystack webhook payments).
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS recorded_by_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL;
