-- ============================================================
-- TalentIQ Module 5: Summary Metrics Framework
-- Governance Domains A–D: Views and RPC Functions
-- Compatible with Supabase SQL Editor
-- ============================================================


-- ============================================================
-- DOMAIN A: PORTFOLIO VOLUME (Real-time Counts)
-- ============================================================

-- View: Master governance dashboard view (filter-aware via Supabase client)
-- Supports filtering by program_year and assigned_unit at the SDK level.
CREATE OR REPLACE VIEW public.v_governance_programs AS
SELECT
    p.program_id,
    p.program_title,
    p.assigned_unit,
    p.planned_quarter,
    p.program_year,
    p.delivery_completion,
    p.report_status,
    p.business_unit,
    p.created_at,

    -- Lifecycle status snapshot
    ls.needs_analysis_status,
    ls.design_status,
    ls.guidelines_status,
    ls.materials_status,
    ls.marketing_plan_status,
    ls.campaign_assets_status,
    ls.comms_schedule_status,
    ls.attendance_confirmation_status,
    ls.facilitator_briefing_status,
    ls.dry_run_status,
    ls.feedback_report_status,
    ls.payment_status,

    -- Session aggregates
    COALESCE(s.total_participants, 0)       AS total_participants,
    COALESCE(s.total_completions, 0)        AS total_completions,
    COALESCE(s.avg_feedback_score, NULL)    AS avg_feedback_score,
    COALESCE(s.session_count, 0)            AS session_count

FROM public.programs p
LEFT JOIN public.program_lifecycle_status ls ON ls.program_id = p.program_id
LEFT JOIN (
    SELECT
        program_id,
        SUM(participants_count)             AS total_participants,
        SUM(completions_count)              AS total_completions,
        AVG(feedback_score_avg)             AS avg_feedback_score,
        COUNT(session_id)                   AS session_count
    FROM public.program_sessions
    GROUP BY program_id
) s ON s.program_id = p.program_id;


-- RPC: Domain A — Portfolio Volume Counts
-- Returns total count, breakdown by quarter, and breakdown by assigned unit.
-- Supports optional filtering by p_year and p_unit.
CREATE OR REPLACE FUNCTION public.rpc_domain_a_portfolio_volume(
    p_year      INTEGER DEFAULT NULL,
    p_unit      TEXT    DEFAULT NULL
)
RETURNS TABLE (
    metric          TEXT,
    dimension_key   TEXT,
    program_count   BIGINT
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    -- Total Programs
    RETURN QUERY
    SELECT
        'total_programs'::TEXT,
        'ALL'::TEXT,
        COUNT(*)
    FROM public.programs p
    WHERE (p_year IS NULL OR p.program_year = p_year)
      AND (p_unit IS NULL OR p.assigned_unit ILIKE p_unit);

    -- Programs by Quarter
    RETURN QUERY
    SELECT
        'by_quarter'::TEXT,
        COALESCE(p.planned_quarter, 'UNASSIGNED'),
        COUNT(*)
    FROM public.programs p
    WHERE (p_year IS NULL OR p.program_year = p_year)
      AND (p_unit IS NULL OR p.assigned_unit ILIKE p_unit)
    GROUP BY p.planned_quarter
    ORDER BY p.planned_quarter;

    -- Programs by Assigned Unit
    RETURN QUERY
    SELECT
        'by_assigned_unit'::TEXT,
        COALESCE(p.assigned_unit, 'UNASSIGNED'),
        COUNT(*)
    FROM public.programs p
    WHERE (p_year IS NULL OR p.program_year = p_year)
      AND (p_unit IS NULL OR p.assigned_unit ILIKE p_unit)
    GROUP BY p.assigned_unit
    ORDER BY p.assigned_unit;
END;
$$;


-- ============================================================
-- DOMAIN B: DELIVERY COMPLETION (Performance)
-- ============================================================

-- RPC: Domain B — Completion Rate and Total Participants
-- completion_rate = (programs where delivery_completion = 'COMPLETED' / total) * 100
CREATE OR REPLACE FUNCTION public.rpc_domain_b_delivery_completion(
    p_year      INTEGER DEFAULT NULL,
    p_unit      TEXT    DEFAULT NULL
)
RETURNS TABLE (
    total_programs          BIGINT,
    completed_programs      BIGINT,
    completion_rate_pct     NUMERIC,
    total_participants      BIGINT
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(p.program_id)                                                             AS total_programs,
        COUNT(p.program_id) FILTER (
            WHERE UPPER(p.delivery_completion) = 'COMPLETED'
        )                                                                               AS completed_programs,
        ROUND(
            COUNT(p.program_id) FILTER (
                WHERE UPPER(p.delivery_completion) = 'COMPLETED'
            )::NUMERIC
            / NULLIF(COUNT(p.program_id), 0)::NUMERIC
            * 100,
        2)                                                                              AS completion_rate_pct,
        COALESCE(SUM(s.participants_count), 0)                                          AS total_participants
    FROM public.programs p
    LEFT JOIN public.program_sessions s ON s.program_id = p.program_id
    WHERE (p_year IS NULL OR p.program_year = p_year)
      AND (p_unit IS NULL OR p.assigned_unit ILIKE p_unit);
END;
$$;


-- ============================================================
-- DOMAIN C: EVALUATION AND FEEDBACK (Quality)
-- ============================================================

-- RPC: Domain C — Average Feedback Score + Programs Missing Feedback
CREATE OR REPLACE FUNCTION public.rpc_domain_c_feedback_quality(
    p_year      INTEGER DEFAULT NULL,
    p_unit      TEXT    DEFAULT NULL
)
RETURNS TABLE (
    avg_feedback_score          NUMERIC,
    programs_missing_feedback   BIGINT
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    RETURN QUERY
    SELECT
        ROUND(
            AVG(s.feedback_score_avg),
        2)                                                                          AS avg_feedback_score,
        COUNT(DISTINCT ls.program_id) FILTER (
            WHERE UPPER(ls.feedback_report_status) = 'MISSING'
        )                                                                           AS programs_missing_feedback
    FROM public.programs p
    LEFT JOIN public.program_lifecycle_status ls ON ls.program_id = p.program_id
    LEFT JOIN public.program_sessions s          ON s.program_id  = p.program_id
    WHERE (p_year IS NULL OR p.program_year = p_year)
      AND (p_unit IS NULL OR p.assigned_unit ILIKE p_unit);
END;
$$;


-- View: Programs with missing feedback (for drill-down lists)
CREATE OR REPLACE VIEW public.v_programs_missing_feedback AS
SELECT
    p.program_id,
    p.program_title,
    p.assigned_unit,
    p.planned_quarter,
    p.program_year,
    ls.feedback_report_status
FROM public.programs p
JOIN public.program_lifecycle_status ls ON ls.program_id = p.program_id
WHERE UPPER(ls.feedback_report_status) = 'MISSING';


-- ============================================================
-- DOMAIN D: GOVERNANCE READINESS (Logic-Heavy)
-- ============================================================

-- Helper: Converts a lifecycle_status_enum value to a numeric completion score
-- COMPLETED = 1, IN_PROGRESS = 0.5, NOT_STARTED / N_A = 0
CREATE OR REPLACE FUNCTION public.fn_lifecycle_phase_score(
    phase_status lifecycle_status_enum
)
RETURNS NUMERIC
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
    RETURN CASE phase_status
        WHEN 'COMPLETED'    THEN 1.0
        WHEN 'IN_PROGRESS'  THEN 0.5
        ELSE 0.0
    END;
END;
$$;


-- RPC: Domain D — Lifecycle Completion Score per Program
-- Averages the completion score across the 8 primary lifecycle phases.
-- NOTE: The schema has 10 phase columns; this function uses the 8 core ones
-- specified in the task (Needs Analysis → Attendance Confirmation).
CREATE OR REPLACE FUNCTION public.rpc_domain_d_lifecycle_scores(
    p_year      INTEGER DEFAULT NULL,
    p_unit      TEXT    DEFAULT NULL
)
RETURNS TABLE (
    program_id                  UUID,
    program_title               TEXT,
    assigned_unit               TEXT,
    program_year                INTEGER,
    lifecycle_completion_pct    NUMERIC
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.program_id,
        p.program_title::TEXT,
        p.assigned_unit::TEXT,
        p.program_year,
        ROUND(
            (
                public.fn_lifecycle_phase_score(ls.needs_analysis_status)           +
                public.fn_lifecycle_phase_score(ls.design_status)                   +
                public.fn_lifecycle_phase_score(ls.guidelines_status)               +
                public.fn_lifecycle_phase_score(ls.materials_status)                +
                public.fn_lifecycle_phase_score(ls.marketing_plan_status)           +
                public.fn_lifecycle_phase_score(ls.campaign_assets_status)          +
                public.fn_lifecycle_phase_score(ls.comms_schedule_status)           +
                public.fn_lifecycle_phase_score(ls.attendance_confirmation_status)
            ) / 8.0 * 100,
        2)                                                              AS lifecycle_completion_pct
    FROM public.programs p
    JOIN public.program_lifecycle_status ls ON ls.program_id = p.program_id
    WHERE (p_year IS NULL OR p.program_year = p_year)
      AND (p_unit IS NULL OR p.assigned_unit ILIKE p_unit)
    ORDER BY lifecycle_completion_pct DESC;
END;
$$;


-- RPC: Domain D — Overdue Reports
-- Programs where delivery was completed > 30 days ago, but report_status != 'DONE'
CREATE OR REPLACE FUNCTION public.rpc_domain_d_overdue_reports(
    p_year      INTEGER DEFAULT NULL,
    p_unit      TEXT    DEFAULT NULL
)
RETURNS TABLE (
    program_id          UUID,
    program_title       TEXT,
    assigned_unit       TEXT,
    program_year        INTEGER,
    report_status       TEXT,
    last_session_date   DATE,
    days_overdue        INTEGER
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.program_id,
        p.program_title::TEXT,
        p.assigned_unit::TEXT,
        p.program_year,
        p.report_status::TEXT,
        MAX(s.session_date)                                                     AS last_session_date,
        (CURRENT_DATE - MAX(s.session_date))::INTEGER                          AS days_overdue
    FROM public.programs p
    LEFT JOIN public.program_sessions s ON s.program_id = p.program_id
    WHERE UPPER(p.delivery_completion) = 'COMPLETED'
      AND UPPER(COALESCE(p.report_status, '')) != 'DONE'
      AND (p_year IS NULL OR p.program_year = p_year)
      AND (p_unit IS NULL OR p.assigned_unit ILIKE p_unit)
    GROUP BY p.program_id, p.program_title, p.assigned_unit, p.program_year, p.report_status
    HAVING MAX(s.session_date) IS NOT NULL
       AND (CURRENT_DATE - MAX(s.session_date)) > 30
    ORDER BY days_overdue DESC;
END;
$$;


-- ============================================================
-- DOMAIN D: COMBINED GOVERNANCE READINESS SUMMARY
-- ============================================================

-- RPC: Aggregated Domain D summary (suitable for dashboard KPI cards)
CREATE OR REPLACE FUNCTION public.rpc_domain_d_governance_summary(
    p_year      INTEGER DEFAULT NULL,
    p_unit      TEXT    DEFAULT NULL
)
RETURNS TABLE (
    avg_lifecycle_completion_pct    NUMERIC,
    overdue_report_count            BIGINT
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    RETURN QUERY
    SELECT
        -- Average lifecycle completion across all matching programs
        ROUND(
            AVG(
                (
                    public.fn_lifecycle_phase_score(ls.needs_analysis_status)           +
                    public.fn_lifecycle_phase_score(ls.design_status)                   +
                    public.fn_lifecycle_phase_score(ls.guidelines_status)               +
                    public.fn_lifecycle_phase_score(ls.materials_status)                +
                    public.fn_lifecycle_phase_score(ls.marketing_plan_status)           +
                    public.fn_lifecycle_phase_score(ls.campaign_assets_status)          +
                    public.fn_lifecycle_phase_score(ls.comms_schedule_status)           +
                    public.fn_lifecycle_phase_score(ls.attendance_confirmation_status)
                ) / 8.0 * 100
            ),
        2)                                                              AS avg_lifecycle_completion_pct,

        -- Count programs completed > 30 days ago with unresolved reports
        (
            SELECT COUNT(*)
            FROM (
                SELECT p2.program_id
                FROM public.programs p2
                LEFT JOIN public.program_sessions s2 ON s2.program_id = p2.program_id
                WHERE UPPER(p2.delivery_completion) = 'COMPLETED'
                  AND UPPER(COALESCE(p2.report_status, '')) != 'DONE'
                  AND (p_year IS NULL OR p2.program_year = p_year)
                  AND (p_unit IS NULL OR p2.assigned_unit ILIKE p_unit)
                GROUP BY p2.program_id
                HAVING MAX(s2.session_date) IS NOT NULL
                   AND (CURRENT_DATE - MAX(s2.session_date)) > 30
            ) sub
        )                                                               AS overdue_report_count

    FROM public.programs p
    JOIN public.program_lifecycle_status ls ON ls.program_id = p.program_id
    WHERE (p_year IS NULL OR p.program_year = p_year)
      AND (p_unit IS NULL OR p.assigned_unit ILIKE p_unit);
END;
$$;


-- ============================================================
-- GRANT PERMISSIONS (Supabase anon + authenticated roles)
-- ============================================================

GRANT SELECT ON public.v_governance_programs          TO anon, authenticated;
GRANT SELECT ON public.v_programs_missing_feedback    TO anon, authenticated;

GRANT EXECUTE ON FUNCTION public.rpc_domain_a_portfolio_volume(INTEGER, TEXT)   TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_domain_b_delivery_completion(INTEGER, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_domain_c_feedback_quality(INTEGER, TEXT)   TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_domain_d_lifecycle_scores(INTEGER, TEXT)   TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_domain_d_overdue_reports(INTEGER, TEXT)    TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_domain_d_governance_summary(INTEGER, TEXT) TO anon, authenticated;
