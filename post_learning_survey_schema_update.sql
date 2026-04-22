-- Update post_learning_survey table to include year and cohort columns
DO $$ 
BEGIN
    -- Add year column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='post_learning_survey' AND column_name='year') THEN
        ALTER TABLE post_learning_survey ADD COLUMN year INTEGER DEFAULT 2026;
    END IF;

    -- Add cohort column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='post_learning_survey' AND column_name='cohort') THEN
        ALTER TABLE post_learning_survey ADD COLUMN cohort TEXT DEFAULT 'Default';
    END IF;

    -- Ensure they are NOT NULL after setting defaults
    ALTER TABLE post_learning_survey ALTER COLUMN year SET NOT NULL;
    ALTER TABLE post_learning_survey ALTER COLUMN cohort SET NOT NULL;

END $$;
