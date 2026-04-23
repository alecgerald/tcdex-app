-- SQL to create post_learning_survey table
CREATE TABLE IF NOT EXISTS post_learning_survey (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_title TEXT NOT NULL,
  session_rating INTEGER,
  facilitator_rating INTEGER,
  feedback_likes TEXT,
  feedback_suggestions TEXT,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE post_learning_survey ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all for now (adjust as needed for production)
CREATE POLICY "Allow all access to post_learning_survey" ON post_learning_survey
  FOR ALL USING (true) WITH CHECK (true);
