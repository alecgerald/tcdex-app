'use server'

import { createClient } from '@/utils/supabase/server'

export async function persistUploadBatch(
  fileName: string,
  parsedPrograms: any[],
  validationLog: any,
  counts: { parsed: number; imported: number; rejected: number }
) {
  const supabase = await createClient()

  try {
    // 1. Create Upload Batch
    const { data: batchData, error: batchError } = await supabase
      .from('upload_batches')
      .insert({
        filename: fileName,
        upload_type: 'EXCEL_UPLOAD',
        records_parsed: counts.parsed,
        records_imported: counts.imported,
        records_rejected: counts.rejected,
        validation_log: validationLog,
        status: counts.rejected > 0 ? (counts.imported > 0 ? 'PARTIAL' : 'FAILED') : 'COMPLETE'
      })
      .select('batch_id')
      .single()

    if (batchError || !batchData) {
      console.error('Failed to create upload batch', batchError)
      return { success: false, error: batchError?.message || 'Failed to create upload batch' }
    }

    const batchId = batchData.batch_id

    // 2. Process Programs & Ownership
    if (parsedPrograms.length > 0) {
      for (const raw of parsedPrograms) {
        // Insert Program
        const { data: progData, error: progError } = await supabase
          .from('programs')
          .insert({
            program_title: raw.programTitle,
            assigned_unit: raw.assignedUnit,
            priority_level: raw.priorityLevel || null,
            target_audience: raw.targetAudience,
            business_unit: raw.businessUnit ? [raw.businessUnit] : [],
            budget_required: raw.budgetRequired,
            approved_budget_php: raw.approvedBudgetPhp || null,
            delivery_completion: raw.deliveryCompletion,
            program_year: raw.programYear,
            upload_batch_id: batchId
          })
          .select('program_id')
          .single()

        if (progError || !progData) {
          console.error(`Failed to insert program: ${raw.programTitle}`, progError)
          continue
        }

        const programId = progData.program_id

        // Helper to clean and split names
        const splitNames = (val: string) => {
          if (!val) return []
          return val.split(/\r?\n|;/).map(n => n.trim()).filter(Boolean)
        }

        const ownershipRecords: any[] = []

        // Add Leads
        splitNames(raw.programLead).forEach(name => {
          ownershipRecords.push({
            program_id: programId,
            role: 'PROGRAM_LEAD',
            person_name: name
          })
        })

        // Add Trainers
        splitNames(raw.internalTrainers).forEach(name => {
          ownershipRecords.push({
            program_id: programId,
            role: 'TRAINER',
            person_name: name,
            trainer_type: raw.trainerType || 'Internal',
            vendor_name: raw.externalVendor || null
          })
        })

        // Add Support
        splitNames(raw.supportTeam).forEach(name => {
          ownershipRecords.push({
            program_id: programId,
            role: 'SUPPORT',
            person_name: name
          })
        })

        if (ownershipRecords.length > 0) {
          const { error: ownError } = await supabase
            .from('program_ownership')
            .insert(ownershipRecords)

          if (ownError) {
            console.error(`Failed to insert ownership for ${raw.programTitle}`, ownError)
            return { success: false, error: `Failed to insert ownership for ${raw.programTitle}: ${ownError.message}` }
          }
        }
      }
    }

    return { success: true, batchId, recordsImported: parsedPrograms.length }
  } catch (error) {
    console.error('Error persisting batch:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}
