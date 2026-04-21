export interface ProgramSession {
  sessionId: string
  sessionDate: string | null
  sessionNumber: number | null
  participantsCount: number
  completionsCount: number
  feedbackScoreAvg: number | null
  facilitatorName: string | null
  deliveryMode: string | null
}

export interface ProcessedProgramRow {
  id: string
  programTitle: string
  assignedUnit: string
  priorityLevel: string
  targetAudience: string
  businessUnit: string
  budgetRequired: boolean
  approvedBudgetPhp: number | null
  deliveryCompletion: string
  deliveryStatus: string
  programYear: number | null
  plannedMonth: string
  quarter: string
  deliveryMode: string
  overallReportStatus: string

  // Session aggregates
  totalParticipants: number
  totalCompletions: number
  avgFeedbackScore: number | null
  sessionCount: number
  sessions: ProgramSession[]

  // Ownership
  programLead: string
  internalTrainerNames: string
  externalVendor: string
  supportTeam: string

  // Lifecycle phases (8 core + extra)
  naStatus: string
  designStatus: string
  guidelinesStatus: string
  materialsStatus: string
  marketingStatus: string
  campaignAssetsStatus: string
  commsScheduleStatus: string
  attendanceConfirmationStatus: string
  facilitatorBriefingStatus: string
  dryRunStatus: string
  feedbackFormDeployed: boolean
  feedbackStatus: string
  paymentStatus: string

  // Legacy
  targetParticipants: number
  reachedParticipants: number
  evaluationEvidence: string
}

export const LIFECYCLE_PHASES = [
  { key: "naStatus",                     label: "Needs Analysis" },
  { key: "designStatus",                 label: "Design" },
  { key: "guidelinesStatus",             label: "Guidelines" },
  { key: "materialsStatus",              label: "Materials" },
  { key: "marketingStatus",              label: "Marketing Plan" },
  { key: "campaignAssetsStatus",         label: "Campaign Assets" },
  { key: "commsScheduleStatus",          label: "Comms Schedule" },
  { key: "attendanceConfirmationStatus", label: "Attendance Confirmation" },
] as const

export function lifecycleScore(row: ProcessedProgramRow): number {
  const vals: number[] = LIFECYCLE_PHASES.map(p => {
    const v = row[p.key as keyof ProcessedProgramRow] as string
    if (v === "COMPLETED") return 1
    if (v === "IN_PROGRESS") return 0.5
    return 0
  })
  return (vals.reduce((a, b) => a + b, 0) / vals.length) * 100
}
