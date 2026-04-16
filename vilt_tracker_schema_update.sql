-- Ensure vilt_tracker table has year and cohort columns
-- Run this if the columns are missing or you want to ensure the schema is correct.

DO $$ 
BEGIN
    -- Add year column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vilt_tracker' AND column_name='year') THEN
        ALTER TABLE vilt_tracker ADD COLUMN year TEXT DEFAULT '2026';
    END IF;

    -- Add cohort column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vilt_tracker' AND column_name='cohort') THEN
        ALTER TABLE vilt_tracker ADD COLUMN cohort TEXT DEFAULT 'Default';
    END IF;

    -- Ensure they are NOT NULL after setting defaults
    ALTER TABLE vilt_tracker ALTER COLUMN year SET NOT NULL;
    ALTER TABLE vilt_tracker ALTER COLUMN cohort SET NOT NULL;

    -- Update unique constraint if necessary
    -- First, drop the old unique constraint if it exists (assuming it might be on email only or participant_id)
    -- The code uses 'email, year, cohort' for onConflict, so we need a unique index/constraint on those.
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'vilt_tracker_email_year_cohort_key'
    ) THEN
        -- If there's an old unique constraint on email alone, we might need to remove it or just add this one.
        -- Supabase/Postgres allows multiple unique constraints.
        ALTER TABLE vilt_tracker ADD CONSTRAINT vilt_tracker_email_year_cohort_key UNIQUE (email, year, cohort);
    END IF;
END $$;
