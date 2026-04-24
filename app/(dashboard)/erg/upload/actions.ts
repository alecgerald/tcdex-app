"use server"

import { createClient } from "@/utils/supabase/server"
import { revalidatePath } from "next/cache"

export async function saveERGData(
  templateType: string,
  fileName: string,
  data: any[],
  uploadTime?: string,
  userId?: string
) {
  const supabase = await createClient()
  const timestamp = uploadTime || new Date().toISOString()

  let recordsImportedCount = 0
  let batchId = ""

  try {
    // 1. We'll start by processing the data first to ensure it's valid before creating any batch record
    // This way, if processing fails, no audit log is created.
    
    // However, to keep it simple and consistent with the batch requirement, we'll create the batch
    // but DELETE it if the following operations fail.
    
    const { data: batch, error: batchError } = await supabase
      .from("erg_batches")
      .insert({
        filename: fileName,
        upload_type: templateType,
        upload_timestamp: timestamp,
        records_parsed: data.length,
        records_imported: 0,
        status: "Completed", 
        user_id: userId
      })
      .select()
      .single()

    if (batchError) throw batchError
    batchId = batch.batch_id

    if (templateType === 'membership_registry') {
      const rows = data.map(row => ({
        batch_id: batchId,
        employee_id: String(row["Employee ID"]),
        name: row["Name"],
        email: row["Email"],
        business_unit: row["Delivery Unit / Business Unit"],
        location: row["Location"],
        primary_erg: row["Primary ERG"],
        join_date: row["Join Date"] || null,
        status: row["Status"] || "Active"
      }))

      const { error } = await supabase
        .from("erg_membership_registry")
        .upsert(rows, { onConflict: 'employee_id' })

      if (error) throw error
      recordsImportedCount = rows.length
    } 
    else if (templateType === 'membership_snapshot') {
      const ergNames = data.map(r => r["ERG"])
      const years = data.map(r => parseInt(r["Year"]))
      
      const { data: existingSnapshots } = await supabase
        .from("erg_membership_snapshots")
        .select("*")
        .in("erg_name", ergNames)
        .in("year", years)

      const rows = data.map(row => {
        const erg = row["ERG"]
        const year = parseInt(row["Year"])
        const existing = existingSnapshots?.find(s => s.erg_name === erg && s.year === year)
        
        const merge = (key: string) => {
          const newVal = parseInt(row[key])
          const dbKey = key.toLowerCase().replace(' ', '_')
          return (newVal > 0) ? newVal : (existing ? (existing as any)[dbKey] : 0)
        }

        return {
          batch_id: batchId,
          erg_name: erg,
          year: year,
          growth_rate: parseFloat(row["Growth Rate %"]) || existing?.growth_rate || 0,
          jan_members: merge("Jan Members"),
          feb_members: merge("Feb Members"),
          mar_members: merge("Mar Members"),
          apr_members: merge("Apr Members"),
          may_members: merge("May Members"),
          jun_members: merge("Jun Members"),
          jul_members: merge("Jul Members"),
          aug_members: merge("Aug Members"),
          sep_members: merge("Sep Members"),
          oct_members: merge("Oct Members"),
          nov_members: merge("Nov Members"),
          dec_members: merge("Dec Members")
        }
      })

      const { error } = await supabase
        .from("erg_membership_snapshots")
        .upsert(rows, { onConflict: 'erg_name,year' })

      if (error) throw error
      recordsImportedCount = rows.length
    }
    else if (templateType === 'event_activity') {
      const rows = data.map(row => ({
        batch_id: batchId,
        erg_name: row["ERG"],
        event_date: row["Event Date"],
        deib_event: row["DEIB event"],
        activity_title: row["Activity Title"],
        activity_type: row["Activity Type"],
        attendance_count: parseInt(row["Attendance / Participation Count"]) || 0
      }))

      const { error } = await supabase.from("erg_event_logs").insert(rows)
      if (error) throw error
      recordsImportedCount = rows.length
    }
    else if (templateType === 'event_feedback') {
      const rows = data.map(row => ({
        batch_id: batchId,
        erg_name: row["ERG"],
        deib_event: row["DEIB event"],
        activity_title: row["Activity Title"],
        overall_score: parseFloat(row["Overall Evaluation Score"]) || 0,
        positive_feedbacks: parseInt(row["Positive Feedbacks"]) || 0,
        negative_feedbacks: parseInt(row["Negative Feedbacks"]) || 0,
        response_count: parseInt(row["Response Count"]) || 0,
        upload_date: timestamp.split('T')[0]
      }))

      const { error } = await supabase.from("erg_feedback_summaries").insert(rows)
      if (error) throw error
      recordsImportedCount = rows.length
    }
    else if (templateType === 'participation_detail') {
      const rows = data.map(row => ({
        batch_id: batchId,
        employee_id: String(row["Employee ID"]),
        name: row["Name"],
        business_unit: row["Delivery Unit / Business Unit"],
        location: row["Location"],
        member_erg: row["Member of What ERG"],
        erg_name: row["ERG"],
        activity_title: row["Activity Title"],
        activity_type: row["Activity Type"],
        deib_event: row["DEIB event"],
        upload_date: timestamp.split('T')[0]
      }))

      const { error } = await supabase.from("erg_participation_details").insert(rows)
      if (error) throw error
      recordsImportedCount = rows.length
    }

    // Update with correct count
    await supabase
      .from("erg_batches")
      .update({ records_imported: recordsImportedCount })
      .eq("batch_id", batchId)

    revalidatePath("/erg")
    return { success: true, batchId }

  } catch (err: any) {
    console.error("Data Import Error:", err)
    
    // If we have a batchId, delete the batch record so it doesn't show in audit logs
    if (batchId) {
      const supabaseCleanup = await createClient()
      await supabaseCleanup.from("erg_batches").delete().eq("batch_id", batchId)
    }

    return { success: false, error: err.message || "Failed to import data" }
  }
}
