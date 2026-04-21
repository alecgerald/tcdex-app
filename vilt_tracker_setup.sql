-- SQL to create the vilt_tracker table
CREATE TABLE vilt_tracker (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  year TEXT NOT NULL,
  cohort TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Absent', -- 'Complete' or 'Absent'
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(participant_id, year, cohort)
);

-- Enable Row Level Security
ALTER TABLE vilt_tracker ENABLE ROW LEVEL SECURITY;

-- Allow read access for everyone (authenticated or otherwise)
CREATE POLICY "Allow read access for all users" ON vilt_tracker
  FOR SELECT USING (true);

-- Allow authenticated users to insert/update
CREATE POLICY "Allow insert for authenticated users" ON vilt_tracker
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow update for authenticated users" ON vilt_tracker
  FOR UPDATE USING (true);
