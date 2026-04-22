"use server"

import { createClient } from "@/utils/supabase/server"
import { revalidatePath } from "next/cache"

export async function fetchERGDashboardData() {
  const supabase = await createClient()

  // Fetch all ERG data in parallel
  const [
    { data: registry },
    { data: snapshots },
    { data: logs },
    { data: feedback },
    { data: participation },
    { data: auditLogs }
  ] = await Promise.all([
    supabase.from("erg_membership_registry").select("*"),
    supabase.from("erg_membership_snapshots").select("*"),
    supabase.from("erg_event_logs").select("*"),
    supabase.from("erg_feedback_summaries").select("*"),
    supabase.from("erg_participation_details").select("*"),
    supabase.from("erg_batches").select("*").order("upload_timestamp", { ascending: false })
  ])

  // Map database columns back to the frontend's expected Excel-style keys
  const normalizedRegistry = (registry || []).map(r => ({
    "Employee ID": r.employee_id,
    "Name": r.name,
    "Email": r.email,
    "Delivery Unit / Business Unit": r.business_unit,
    "Location": r.location,
    "Primary ERG": r.primary_erg,
    "Join Date": r.join_date,
    "Status": r.status
  }))

  const normalizedSnapshots = (snapshots || []).map(s => ({
    "ERG": s.erg_name,
    "Year": s.year,
    "Growth Rate %": s.growth_rate,
    "Jan Members": s.jan_members,
    "Feb Members": s.feb_members,
    "Mar Members": s.mar_members,
    "Apr Members": s.apr_members,
    "May Members": s.may_members,
    "Jun Members": s.jun_members,
    "Jul Members": s.jul_members,
    "Aug Members": s.aug_members,
    "Sep Members": s.sep_members,
    "Oct Members": s.oct_members,
    "Nov Members": s.nov_members,
    "Dec Members": s.dec_members
  }))

  const normalizedLogs = (logs || []).map(l => ({
    "ERG": l.erg_name,
    "Event Date": l.event_date,
    "DEIB event": l.deib_event,
    "Activity Title": l.activity_title,
    "Activity Type": l.activity_type,
    "Attendance / Participation Count": l.attendance_count
  }))

  const normalizedFeedback = (feedback || []).map(f => ({
    "ERG": f.erg_name,
    "DEIB event": f.deib_event,
    "Activity Title": f.activity_title,
    "Overall Evaluation Score": f.overall_score,
    "Positive Feedbacks": f.positive_feedbacks,
    "Negative Feedbacks": f.negative_feedbacks,
    "Response Count": f.response_count,
    uploadDate: f.upload_date // Use upload_date for backdating support
  }))

  const normalizedParticipation = (participation || []).map(p => ({
    "Employee ID": p.employee_id,
    "Name": p.name,
    "Delivery Unit / Business Unit": p.business_unit,
    "Location": p.location,
    "Member of What ERG": p.member_erg,
    "ERG": p.erg_name,
    "Activity Title": p.activity_title,
    "Activity Type": p.activity_type,
    "DEIB event": p.deib_event,
    uploadDate: p.upload_date // Use upload_date for backdating support
  }))

  const normalizedAuditLogs = (auditLogs || []).map(a => ({
    id: a.batch_id,
    templateType: a.upload_type,
    fileName: a.filename,
    date: a.upload_timestamp,
    count: a.records_imported,
    status: a.status
  }))

  return {
    membershipData: normalizedRegistry,
    snapshots: normalizedSnapshots,
    eventLogs: normalizedLogs,
    feedback: normalizedFeedback,
    participation: normalizedParticipation,
    auditLogs: normalizedAuditLogs
  }
}

export async function fetchBatchData(batchId: string, templateType: string) {
  const supabase = await createClient()
  let tableName = ""

  switch (templateType) {
    case 'membership_registry': tableName = "erg_membership_registry"; break
    case 'membership_snapshot': tableName = "erg_membership_snapshots"; break
    case 'event_activity': tableName = "erg_event_logs"; break
    case 'event_feedback': tableName = "erg_feedback_summaries"; break
    case 'participation_detail': tableName = "erg_participation_details"; break
    default: return { error: "Invalid template type" }
  }

  const { data, error } = await supabase
    .from(tableName)
    .select("*")
    .eq("batch_id", batchId)

  if (error) {
    console.error("Fetch Batch Error:", error)
    return { error: "Failed to fetch batch content" }
  }

  // Normalization logic (same as in fetchERGDashboardData but for a single batch)
  let normalized = []
  if (templateType === 'membership_registry') {
    normalized = data.map(r => ({
      "Employee ID": r.employee_id,
      "Name": r.name,
      "Email": r.email,
      "Delivery Unit / Business Unit": r.business_unit,
      "Location": r.location,
      "Primary ERG": r.primary_erg,
      "Join Date": r.join_date,
      "Status": r.status
    }))
  } else if (templateType === 'membership_snapshot') {
    normalized = data.map(s => ({
      "ERG": s.erg_name,
      "Year": s.year,
      "Growth Rate %": s.growth_rate,
      "Jan Members": s.jan_members,
      "Feb Members": s.feb_members,
      "Mar Members": s.mar_members,
      "Apr Members": s.apr_members,
      "May Members": s.may_members,
      "Jun Members": s.jun_members,
      "Jul Members": s.jul_members,
      "Aug Members": s.aug_members,
      "Sep Members": s.sep_members,
      "Oct Members": s.oct_members,
      "Nov Members": s.nov_members,
      "Dec Members": s.dec_members
    }))
  } else if (templateType === 'event_activity') {
    normalized = data.map(l => ({
      "ERG": l.erg_name,
      "Event Date": l.event_date,
      "DEIB event": l.deib_event,
      "Activity Title": l.activity_title,
      "Activity Type": l.activity_type,
      "Attendance / Participation Count": l.attendance_count
    }))
  } else if (templateType === 'event_feedback') {
    normalized = data.map(f => ({
      "ERG": f.erg_name,
      "DEIB event": f.deib_event,
      "Activity Title": f.activity_title,
      "Overall Evaluation Score": f.overall_score,
      "Positive Feedbacks": f.positive_feedbacks,
      "Negative Feedbacks": f.negative_feedbacks,
      "Response Count": f.response_count
    }))
  } else if (templateType === 'participation_detail') {
    normalized = data.map(p => ({
      "Employee ID": p.employee_id,
      "Name": p.name,
      "Delivery Unit / Business Unit": p.business_unit,
      "Location": p.location,
      "Member of What ERG": p.member_erg,
      "ERG": p.erg_name,
      "Activity Title": p.activity_title,
      "Activity Type": p.activity_type,
      "DEIB event": p.deib_event
    }))
  }

  return { data: normalized }
}

export async function deleteBatch(batchId: string) {
  const supabase = await createClient()
  
  // Cascade delete handles removing records from data tables
  const { error } = await supabase
    .from("erg_batches")
    .delete()
    .eq("batch_id", batchId)

  if (error) {
    console.error("Delete Batch Error:", error)
    return { success: false, error: "Failed to delete batch" }
  }

  revalidatePath("/erg")
  return { success: true }
}
