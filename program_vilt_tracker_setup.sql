-- SQL to create the program_vilt_tracker table
CREATE TABLE program_vilt_tracker (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  department TEXT NOT NULL,
  year TEXT NOT NULL,
  cohort TEXT NOT NULL,
  overall_status TEXT NOT NULL, -- 'Complete', 'Absent', 'Incomplete'
  module_status JSONB DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(email, year, cohort)
);

-- Enable Row Level Security
ALTER TABLE program_vilt_tracker ENABLE ROW LEVEL SECURITY;

-- Allow read access for everyone
CREATE POLICY "Allow read access for all" ON program_vilt_tracker
  FOR SELECT USING (true);

-- Allow all operations for authenticated users
CREATE POLICY "Allow all for authenticated" ON program_vilt_tracker
  FOR ALL USING (true);
