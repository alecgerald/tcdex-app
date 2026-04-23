"use server"

import { createClient } from "@/utils/supabase/server"

export async function fetchDashboardData() {
  const supabase = await createClient()

  // 1. Fetch all successful upload batches
  const { data: batches, error: batchError } = await supabase
    .from("upload_batches")
    .select("*")
    .order("created_at", { ascending: false })

  if (batchError) {
    console.error("Error fetching batches:", batchError)
    return { error: "Failed to fetch data sources" }
  }

  // 2. Fetch all programs with full joins
  const { data: programs, error: progError } = await supabase
    .from("programs")
    .select(`
      *,
      program_lifecycle_status (*),
      program_ownership (*),
      program_sessions (*)
    `)

  if (progError) {
    console.error("Error fetching programs:", progError)
    return { error: "Failed to fetch program data" }
  }

  // 3. Format into the GovernanceAuditLog structure
  const formattedLogs = batches.map(batch => {
    const batchPrograms = programs.filter(p => p.upload_batch_id === batch.batch_id)

    const normalizedData = batchPrograms.map(p => {
      const lifecycle = p.program_lifecycle_status?.[0] || {}
      const sessions = p.program_sessions || []

      const totalParticipants = sessions.reduce((acc: number, s: any) => acc + (s.participants_count || 0), 0)
      const totalCompletions = sessions.reduce((acc: number, s: any) => acc + (s.completions_count || 0), 0)
      const sessionFeedbackScores = sessions.filter((s: any) => s.feedback_score_avg !== null)
      const avgFeedbackScore = sessionFeedbackScores.length > 0
        ? sessionFeedbackScores.reduce((acc: number, s: any) => acc + s.feedback_score_avg, 0) / sessionFeedbackScores.length
        : null

      return {
        id: p.program_id,
        programTitle: p.program_title,
        assignedUnit: p.assigned_unit,
        priorityLevel: p.priority_level,
        targetAudience: p.target_audience,
        businessUnit: Array.isArray(p.business_unit) ? p.business_unit.join(", ") : (p.business_unit || ""),
        deliveryStatus: p.delivery_completion || "Planned",
        deliveryCompletion: p.delivery_completion || "Planned",
        plannedMonth: p.planned_month || "N/A",
        quarter: p.planned_quarter || "Q1",
        programYear: p.program_year || new Date().getFullYear(),
        budgetRequired: p.budget_required || false,
        approvedBudgetPhp: p.approved_budget_php || null,
        overallReportStatus: p.report_status || "PENDING",
        deliveryMode: p.delivery_mode || "VILT",

        // Session aggregates
        totalParticipants,
        totalCompletions,
        avgFeedbackScore,
        sessionCount: sessions.length,
        sessions: sessions.map((s: any) => ({
          sessionId: s.session_id,
          sessionDate: s.session_date,
          sessionNumber: s.session_number,
          participantsCount: s.participants_count || 0,
          completionsCount: s.completions_count || 0,
          feedbackScoreAvg: s.feedback_score_avg,
          facilitatorName: s.facilitator_name,
          deliveryMode: s.delivery_mode,
        })),

        // Ownership
        programLead: p.program_ownership
          ?.filter((o: any) => o.role === "PROGRAM_LEAD")
          .map((o: any) => o.person_name)
          .join(", ") || "",
        internalTrainerNames: p.program_ownership
          ?.filter((o: any) => o.role === "TRAINER")
          .map((o: any) => o.person_name)
          .join(", ") || "",
        externalVendor: p.program_ownership
          ?.find((o: any) => o.role === "TRAINER")?.vendor_name || "",
        supportTeam: p.program_ownership
          ?.filter((o: any) => o.role === "SUPPORT")
          .map((o: any) => o.person_name)
          .join(", ") || "",

        // Lifecycle status (full 8 + extra phases)
        naStatus: lifecycle.needs_analysis_status || "NOT_STARTED",
        designStatus: lifecycle.design_status || "NOT_STARTED",
        guidelinesStatus: lifecycle.guidelines_status || "NOT_STARTED",
        materialsStatus: lifecycle.materials_status || "NOT_STARTED",
        marketingStatus: lifecycle.marketing_plan_status || "NOT_STARTED",
        campaignAssetsStatus: lifecycle.campaign_assets_status || "NOT_STARTED",
        commsScheduleStatus: lifecycle.comms_schedule_status || "NOT_STARTED",
        attendanceConfirmationStatus: lifecycle.attendance_confirmation_status || "NOT_STARTED",
        facilitatorBriefingStatus: lifecycle.facilitator_briefing_status || "NOT_STARTED",
        dryRunStatus: lifecycle.dry_run_status || "NOT_STARTED",
        feedbackFormDeployed: lifecycle.feedback_form_deployed || false,
        feedbackStatus: lifecycle.feedback_report_status || "MISSING",
        paymentStatus: lifecycle.payment_status || "N_A",

        // Legacy fields for backwards compat
        targetParticipants: totalParticipants,
        reachedParticipants: totalCompletions,
        evaluationEvidence: lifecycle.feedback_form_deployed ? "Evidence Provided" : "No Evidence",
        personNames: p.program_ownership?.map((o: any) => o.person_name).join(", ") || "",
        trainerType: p.program_ownership?.find((o: any) => o.role === "TRAINER")?.trainer_type || "N/A",
      }
    })

    return {
      id: batch.batch_id,
      fileName: batch.filename,
      date: new Date(batch.created_at).toLocaleString(),
      count: batch.records_imported,
      normalizedData
    }
  })

  // Master "All Data" log
  if (formattedLogs.length > 0) {
    const allPrograms = formattedLogs.flatMap(l => l.normalizedData)
    formattedLogs.unshift({
      id: "ALL_DATA",
      fileName: "All Uploaded Data (Master)",
      date: new Date().toLocaleString(),
      count: allPrograms.length,
      normalizedData: allPrograms
    })
  }

  return { data: formattedLogs }
}

// Allowed editable columns (whitelist for safety)
const EDITABLE_PROGRAM_FIELDS: Record<string, string> = {
  deliveryStatus:       "delivery_completion",
  overallReportStatus:  "report_status",
  priorityLevel:        "priority_level",
  deliveryMode:         "delivery_mode",
  programTitle:         "program_title",
  targetAudience:       "target_audience",
  assignedUnit:         "assigned_unit",
  plannedMonth:         "planned_month",
  quarter:              "planned_quarter",
  programYear:          "program_year",
  budgetRequired:       "budget_required",
  approvedBudgetPhp:    "approved_budget_php",
}

// Fields that require type coercion before writing to DB
const BOOLEAN_FIELDS = new Set(["budgetRequired"])
const NUMBER_FIELDS  = new Set(["programYear", "approvedBudgetPhp"])

export async function updateProgramField(
  programId: string,
  field: string,
  value: string
) {
  // Special case: evaluationEvidence maps to feedback_form_deployed on lifecycle table
  if (field === "evaluationEvidence") {
    const supabase = await createClient()
    const feedbackDeployed = value === "Evidence Provided"
    const { error } = await supabase
      .from("program_lifecycle_status")
      .update({ feedback_form_deployed: feedbackDeployed })
      .eq("program_id", programId)
    if (error) {
      console.error("Error updating feedback_form_deployed:", error)
      return { error: "Failed to update evaluationEvidence" }
    }
    return { success: true }
  }

  const dbColumn = EDITABLE_PROGRAM_FIELDS[field]
  if (!dbColumn) return { error: "Field not editable" }

  // Coerce value type to match DB column
  let coerced: string | boolean | number = value
  if (BOOLEAN_FIELDS.has(field)) coerced = value === "true"
  if (NUMBER_FIELDS.has(field))  coerced = Number(value) || 0

  const supabase = await createClient()
  const { error } = await supabase
    .from("programs")
    .update({ [dbColumn]: coerced })
    .eq("program_id", programId)

  if (error) {
    console.error(`Error updating ${dbColumn}:`, error)
    return { error: `Failed to update ${field}` }
  }

  return { success: true }
}

// ─── Ownership field updater ───────────────────────────────────────────────────
// Supports: programLead, internalTrainerNames, externalVendor, trainerType
export async function updateOwnershipField(
  programId: string,
  field: string,
  value: string
) {
  const supabase = await createClient()

  if (field === "programLead") {
    // Delete existing PROGRAM_LEAD entries and re-insert
    await supabase.from("program_ownership").delete()
      .eq("program_id", programId).eq("role", "PROGRAM_LEAD")
    if (value.trim()) {
      const names = value.split(",").map((n: string) => n.trim()).filter(Boolean)
      const rows = names.map((name: string) => ({ program_id: programId, role: "PROGRAM_LEAD", person_name: name }))
      const { error } = await supabase.from("program_ownership").insert(rows)
      if (error) return { error: `Failed to update programLead` }
    }
    return { success: true }
  }

  if (field === "internalTrainerNames") {
    await supabase.from("program_ownership").delete()
      .eq("program_id", programId).eq("role", "TRAINER")
    if (value.trim()) {
      const names = value.split(",").map((n: string) => n.trim()).filter(Boolean)
      const rows = names.map((name: string) => ({ program_id: programId, role: "TRAINER", person_name: name }))
      const { error } = await supabase.from("program_ownership").insert(rows)
      if (error) return { error: `Failed to update internalTrainerNames` }
    }
    return { success: true }
  }

  if (field === "externalVendor") {
    // Update vendor_name on the first TRAINER row; if none exists, we skip gracefully
    const { error } = await supabase.from("program_ownership")
      .update({ vendor_name: value })
      .eq("program_id", programId).eq("role", "TRAINER")
    if (error) return { error: `Failed to update externalVendor` }
    return { success: true }
  }

  if (field === "trainerType") {
    const { error } = await supabase.from("program_ownership")
      .update({ trainer_type: value })
      .eq("program_id", programId).eq("role", "TRAINER")
    if (error) return { error: `Failed to update trainerType` }
    return { success: true }
  }

  return { error: "Unknown ownership field" }
}

// Lifecycle status columns (frontend key → DB column)
const LIFECYCLE_COLUMNS: Record<string, string> = {
  naStatus:                     "needs_analysis_status",
  designStatus:                 "design_status",
  guidelinesStatus:             "guidelines_status",
  materialsStatus:              "materials_status",
  marketingStatus:              "marketing_plan_status",
  campaignAssetsStatus:         "campaign_assets_status",
  commsScheduleStatus:          "comms_schedule_status",
  attendanceConfirmationStatus: "attendance_confirmation_status",
  facilitatorBriefingStatus:    "facilitator_briefing_status",
  dryRunStatus:                 "dry_run_status",
  feedbackStatus:               "feedback_report_status",
  paymentStatus:                "payment_status",
}

export async function updateLifecycleStatus(
  programId: string,
  field: string,
  value: string
) {
  const dbColumn = LIFECYCLE_COLUMNS[field]
  if (!dbColumn) return { error: "Field not editable" }

  const supabase = await createClient()
  const { error } = await supabase
    .from("program_lifecycle_status")
    .update({ [dbColumn]: value })
    .eq("program_id", programId)

  if (error) {
    console.error(`Error updating lifecycle ${dbColumn}:`, error)
    return { error: `Failed to update ${field}` }
  }

  return { success: true }
}

export async function deleteUploadBatch(batchId: string) {
  if (batchId === "ALL_DATA") return { error: "Cannot delete master view" }

  const supabase = await createClient()

  const { error: progError } = await supabase
    .from("programs")
    .delete()
    .eq("upload_batch_id", batchId)

  if (progError) {
    console.error("Error deleting programs:", progError)
    return { error: "Failed to delete program data" }
  }

  const { error: batchError } = await supabase
    .from("upload_batches")
    .delete()
    .eq("batch_id", batchId)

  if (batchError) {
    console.error("Error deleting batch:", batchError)
    return { error: "Failed to delete batch record" }
  }

  return { success: true }
}
