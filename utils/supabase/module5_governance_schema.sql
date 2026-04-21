-- TalentIQ Module 5: Governance and Reporting
-- Initial Supabase Migration Script

-- 1. Create Enums for Lifecycle Statuses to maintain data integrity
CREATE TYPE lifecycle_status_enum AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'N_A');
CREATE TYPE priority_level_enum AS ENUM ('HIGH', 'MEDIUM', 'LOW');
CREATE TYPE payment_status_enum AS ENUM ('PAID', 'PENDING', 'N_A');
CREATE TYPE delivery_mode_enum AS ENUM ('VILT', 'ILT', 'Self-paced', 'Hybrid');


-- 2. Create Audit Batches Table (Tracks every Excel Upload)
CREATE TABLE public.upload_batches (
    batch_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    filename VARCHAR(300) NOT NULL,
    upload_type VARCHAR(20) NOT NULL DEFAULT 'EXCEL_UPLOAD',
    uploaded_by VARCHAR(150),
    upload_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    records_parsed INTEGER DEFAULT 0,
    records_imported INTEGER DEFAULT 0,
    records_rejected INTEGER DEFAULT 0,
    validation_log JSONB,
    status VARCHAR(20) DEFAULT 'COMPLETE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create core Programs Table
CREATE TABLE public.programs (
    program_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program_title VARCHAR(300) NOT NULL,
    assigned_unit VARCHAR(100),
    priority_level priority_level_enum,
    target_audience VARCHAR(200),
    
    -- Architectural Audit Implementation: PostgreSQL Array instead of delimited strings
    business_unit TEXT[], 
    
    delivery_mode delivery_mode_enum,
    planned_month VARCHAR(50),
    planned_quarter VARCHAR(5),
    program_year INTEGER,
    budget_required BOOLEAN DEFAULT FALSE,
    approved_budget_php NUMERIC(12,2),
    delivery_completion VARCHAR(50),
    report_status VARCHAR(50),
    
    -- Architectural Audit Implementation: Phase 2 WIG Readiness
    strategic_alignment_id UUID, 
    
    upload_batch_id UUID REFERENCES public.upload_batches(batch_id) ON DELETE SET NULL,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for Array searching
CREATE INDEX idx_programs_business_unit ON public.programs USING GIN (business_unit);


-- 4. Create Ownership Junction Table
CREATE TABLE public.program_ownership (
    ownership_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program_id UUID REFERENCES public.programs(program_id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL,  -- e.g., 'PROGRAM_LEAD', 'TRAINER', 'SUPPORT'
    
    -- Raw imported string data, to be resolved to 'user_id' in subsequent system phase
    person_name VARCHAR(150), 
    
    -- Architectural Audit Note: Eventual mapping
    user_id UUID, 
    
    trainer_type VARCHAR(50), 
    vendor_name VARCHAR(200),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- 5. Create Lifecycle Status Table (using ENUMs)
CREATE TABLE public.program_lifecycle_status (
    program_id UUID PRIMARY KEY REFERENCES public.programs(program_id) ON DELETE CASCADE,
    
    needs_analysis_status lifecycle_status_enum DEFAULT 'NOT_STARTED',
    design_status lifecycle_status_enum DEFAULT 'NOT_STARTED',
    guidelines_status lifecycle_status_enum DEFAULT 'NOT_STARTED',
    materials_status lifecycle_status_enum DEFAULT 'NOT_STARTED',
    marketing_plan_status lifecycle_status_enum DEFAULT 'NOT_STARTED',
    campaign_assets_status lifecycle_status_enum DEFAULT 'NOT_STARTED',
    comms_schedule_status lifecycle_status_enum DEFAULT 'NOT_STARTED',
    attendance_confirmation_status lifecycle_status_enum DEFAULT 'NOT_STARTED',
    facilitator_briefing_status lifecycle_status_enum DEFAULT 'NOT_STARTED',
    dry_run_status lifecycle_status_enum DEFAULT 'NOT_STARTED',
    
    feedback_form_deployed BOOLEAN DEFAULT FALSE,
    feedback_report_status VARCHAR(50),  -- e.g., 'IN PROGRESS', 'DONE', 'MISSING'
    payment_status payment_status_enum DEFAULT 'N_A',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- 6. Create Program Sessions Table
CREATE TABLE public.program_sessions (
    session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program_id UUID REFERENCES public.programs(program_id) ON DELETE CASCADE,
    session_date DATE,
    session_number INTEGER,
    delivery_mode delivery_mode_enum,
    participants_count INTEGER DEFAULT 0,
    completions_count INTEGER DEFAULT 0,
    feedback_score_avg NUMERIC(4,2),
    facilitator_name VARCHAR(150),
    notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- 7. Triggers for automagic updated_at
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER trgo_upload_batches BEFORE UPDATE ON public.upload_batches FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
CREATE TRIGGER trgo_programs BEFORE UPDATE ON public.programs FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
CREATE TRIGGER trgo_program_ownership BEFORE UPDATE ON public.program_ownership FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
CREATE TRIGGER trgo_program_lifecycle_status BEFORE UPDATE ON public.program_lifecycle_status FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
CREATE TRIGGER trgo_program_sessions BEFORE UPDATE ON public.program_sessions FOR EACH ROW EXECUTE PROCEDURE update_modified_column();


-- 8. Enable Row Level Security (RLS) policies
ALTER TABLE public.upload_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.program_ownership ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.program_lifecycle_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.program_sessions ENABLE ROW LEVEL SECURITY;

-- Default Policies (allow anon and authenticated for development)
CREATE POLICY "Enable read access for all users" ON public.programs FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "Enable write access for all users" ON public.programs FOR ALL TO authenticated, anon USING (true);

CREATE POLICY "Enable read for all" ON public.program_ownership FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Enable insert for all" ON public.program_ownership FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Enable update for all" ON public.program_ownership FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Enable delete for all" ON public.program_ownership FOR DELETE TO anon, authenticated USING (true);

CREATE POLICY "Enable read access for all users" ON public.program_lifecycle_status FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "Enable write access for all users" ON public.program_lifecycle_status FOR ALL TO authenticated, anon USING (true);

CREATE POLICY "Enable read access for all users" ON public.upload_batches FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "Enable write access for all users" ON public.upload_batches FOR ALL TO authenticated, anon USING (true);

CREATE POLICY "Enable read access for all users" ON public.program_sessions FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "Enable write access for all users" ON public.program_sessions FOR ALL TO authenticated, anon USING (true);
