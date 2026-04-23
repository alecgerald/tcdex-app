-- SQL to create lms_completions table
CREATE TABLE IF NOT EXISTS lms_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  name TEXT,
  course_name TEXT,
  status TEXT,
  completed_at TIMESTAMP WITH TIME ZONE,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE lms_completions ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow read access for all users" ON lms_completions
  FOR SELECT USING (true);

CREATE POLICY "Allow insert for all users" ON lms_completions
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow update for all users" ON lms_completions
  FOR UPDATE USING (true);

CREATE POLICY "Allow delete for all users" ON lms_completions
  FOR DELETE USING (true);
