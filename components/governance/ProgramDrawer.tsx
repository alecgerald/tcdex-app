"use client"

import { useState, useTransition } from "react"
import { X, Users, Banknote, CalendarDays, Star, CheckCircle2, Circle, Clock, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { ProcessedProgramRow, LIFECYCLE_PHASES, lifecycleScore } from "./types"
import { updateLifecycleStatus, updateProgramField } from "@/app/(dashboard)/governance/actions"

interface Props {
  program: ProcessedProgramRow | null
  onClose: () => void
  onProgramUpdate?: (updated: ProcessedProgramRow) => void
}

const LIFECYCLE_OPTIONS = ["NOT_STARTED", "IN_PROGRESS", "COMPLETED", "N_A"]
const DELIVERY_STATUS_OPTIONS = ["Planned", "Ongoing", "Completed", "Cancelled", "Deferred"]
const REPORT_STATUS_OPTIONS = ["PENDING", "IN_PROGRESS", "SUBMITTED", "APPROVED", "REJECTED"]
const PAYMENT_STATUS_OPTIONS = ["N_A", "PENDING", "PAID", "WAIVED"]
const FEEDBACK_STATUS_OPTIONS = ["MISSING", "PARTIAL", "COMPLETE"]

// Status badge display config
const STATUS_CONFIG: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  COMPLETED: { label: "Done", cls: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: <CheckCircle2 className="h-3 w-3" /> },
  IN_PROGRESS: { label: "In Progress", cls: "bg-amber-100 text-amber-700 border-amber-200", icon: <Clock className="h-3 w-3" /> },
  NOT_STARTED: { label: "Not Started", cls: "bg-red-100 text-red-600 border-red-200", icon: <Circle className="h-3 w-3" /> },
  N_A: { label: "N/A", cls: "bg-zinc-100 text-zinc-500 border-zinc-200", icon: <Circle className="h-3 w-3" /> },
}

function statusBadge(status: string) {
  const s = STATUS_CONFIG[status] || STATUS_CONFIG["NOT_STARTED"]
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium ${s.cls}`}>
      {s.icon}{s.label}
    </span>
  )
}

// Inline native-select edit row for lifecycle phases
function LifecycleRow({
  phaseKey, label, value, programId, onSaved,
}: {
  phaseKey: string
  label: string
  value: string
  programId: string
  onSaved: (key: string, val: string) => void
}) {
  const [current, setCurrent] = useState(value)
  const [isPending, startTransition] = useTransition()

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newVal = e.target.value
    const prev = current
    setCurrent(newVal)
    startTransition(async () => {
      const result = await updateLifecycleStatus(programId, phaseKey, newVal)
      if (result?.error) {
        setCurrent(prev)
        toast.error(`Failed: ${result.error}`)
      } else {
        onSaved(phaseKey, newVal)
        toast.success(`${label} updated`)
      }
    })
  }

  return (
    <div className="flex items-center justify-between px-3 py-2 bg-white dark:bg-zinc-800">
      <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">{label}</span>
      <div className="relative">
        {statusBadge(current)}
        {isPending && (
          <span className="absolute -top-1 -right-1">
            <Loader2 className="h-3 w-3 animate-spin text-[#0046ab]" />
          </span>
        )}
        <select
          value={current}
          onChange={handleChange}
          disabled={isPending}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-wait"
          title="Click to change status"
        >
          {LIFECYCLE_OPTIONS.map(opt => (
            <option key={opt} value={opt}>{opt.replace("_", " ")}</option>
          ))}
        </select>
      </div>
    </div>
  )
}

// Generic inline-select row — accepts an async save function
function EditableRow({
  label, fieldKey, value, options, programId, onSaved, saveFn,
}: {
  label: string
  fieldKey: string
  value: string
  options: string[]
  programId: string
  onSaved: (key: string, val: string) => void
  saveFn: (programId: string, field: string, value: string) => Promise<{ error?: string; success?: boolean }>
}) {
  const [current, setCurrent] = useState(value)
  const [isPending, startTransition] = useTransition()

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newVal = e.target.value
    const prev = current
    setCurrent(newVal)
    startTransition(async () => {
      const result = await saveFn(programId, fieldKey, newVal)
      if (result?.error) {
        setCurrent(prev)
        toast.error(`Failed: ${result.error}`)
      } else {
        onSaved(fieldKey, newVal)
        toast.success(`${label} updated`)
      }
    })
  }

  return (
    <div className="flex px-3 py-2 items-center gap-3">
      <span className="text-zinc-500 w-32 shrink-0 text-xs">{label}</span>
      <div className="relative flex-1">
        <span className="font-medium text-zinc-900 dark:text-zinc-100 text-xs flex items-center gap-1">
          {isPending
            ? <Loader2 className="h-3 w-3 animate-spin text-zinc-400" />
            : <span className="text-zinc-300 text-[10px]">✎</span>
          }
          {current || "—"}
        </span>
        <select
          value={current}
          onChange={handleChange}
          disabled={isPending}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-wait"
          title="Click to edit"
        >
          {options.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </div>
    </div>
  )
}

// Main drawer
export default function ProgramDrawer({ program, onClose, onProgramUpdate }: Props) {
  // Local copy of program so optimistic updates reflect immediately in score
  const [local, setLocal] = useState<ProcessedProgramRow | null>(program)

  if (!local) return null
  const score = lifecycleScore(local)

  function handleLifecycleSaved(key: string, val: string) {
    if (!local) return
    const updated = { ...local, [key]: val }
    setLocal(updated)
    onProgramUpdate?.(updated)
  }

  function handleProgramFieldSaved(key: string, val: string) {
    if (!local) return
    const updated = { ...local, [key]: val }
    setLocal(updated)
    onProgramUpdate?.(updated)
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 z-40 transition-opacity" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-full max-w-xl bg-white dark:bg-zinc-900 z-50 shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b bg-gradient-to-r from-[#0046ab]/5 to-transparent">
          <div className="flex-1 pr-4">
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 leading-tight">{local.programTitle}</h2>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {local.assignedUnit && <Badge variant="secondary" className="text-xs">{local.assignedUnit}</Badge>}
              {local.quarter && <Badge variant="outline" className="text-xs">{local.quarter}</Badge>}
              {local.deliveryMode && <Badge variant="outline" className="text-xs">{local.deliveryMode}</Badge>}
              {local.priorityLevel && (
                <Badge className={`text-xs text-white ${local.priorityLevel === "HIGH" ? "bg-red-500" : local.priorityLevel === "MEDIUM" ? "bg-amber-500" : "bg-emerald-500"}`}>
                  {local.priorityLevel}
                </Badge>
              )}
            </div>
            <p className="text-[10px] text-amber-600 mt-2 flex items-center gap-1">
              <span>✎</span> Click any badge or value below to edit
            </p>
          </div>
          <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">

          {/* Lifecycle Score */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Lifecycle Completion</span>
              <span className="text-sm font-bold text-[#0046ab]">{score.toFixed(0)}%</span>
            </div>
            <div className="w-full h-2 bg-zinc-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${score >= 75 ? "bg-emerald-500" : score >= 40 ? "bg-amber-500" : "bg-red-500"}`}
                style={{ width: `${score}%` }}
              />
            </div>
          </div>

          {/* 8 Lifecycle Phases — all editable */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">
              Lifecycle Phases
              <span className="ml-2 text-amber-500 normal-case font-normal">✎ click badge to edit</span>
            </p>
            <div className="rounded-lg border overflow-hidden divide-y">
              {LIFECYCLE_PHASES.map(phase => (
                <LifecycleRow
                  key={phase.key}
                  phaseKey={phase.key}
                  label={phase.label}
                  value={(local[phase.key as keyof ProcessedProgramRow] as string) || "NOT_STARTED"}
                  programId={local.id}
                  onSaved={handleLifecycleSaved}
                />
              ))}
            </div>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border p-3 text-center">
              <Users className="h-4 w-4 text-[#0046ab] mx-auto mb-1" />
              <p className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{local.totalParticipants}</p>
              <p className="text-[10px] text-zinc-500 uppercase">Participants</p>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <CheckCircle2 className="h-4 w-4 text-emerald-500 mx-auto mb-1" />
              <p className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{local.totalCompletions}</p>
              <p className="text-[10px] text-zinc-500 uppercase">Completions</p>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <Star className="h-4 w-4 text-amber-400 mx-auto mb-1" />
              <p className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                {local.avgFeedbackScore !== null ? local.avgFeedbackScore.toFixed(2) : "—"}
              </p>
              <p className="text-[10px] text-zinc-500 uppercase">Avg Score</p>
            </div>
          </div>

          {/* Key Details — editable fields use ProgramFieldRow, read-only use plain row */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">
              Key Details
              <span className="ml-2 text-amber-500 normal-case font-normal">✎ click value to edit</span>
            </p>
            <div className="rounded-lg border divide-y text-sm">
              {/* Read-only rows */}
              {[
                { label: "Program Year", value: local.programYear },
                { label: "Program Lead", value: local.programLead || "—" },
                { label: "Trainer(s)", value: local.internalTrainerNames || "—" },
                { label: "Vendor", value: local.externalVendor || "—" },
                { label: "Support Team", value: local.supportTeam || "—" },
                { label: "Target Audience", value: local.targetAudience || "—" },
                { label: "Business Unit", value: local.businessUnit || "—" },
              ].map(row => (
                <div key={row.label} className="flex px-3 py-2 items-center gap-3">
                  <span className="text-zinc-500 w-32 shrink-0 text-xs">{row.label}</span>
                  <span className="font-medium text-zinc-900 dark:text-zinc-100 text-xs">{String(row.value ?? "—")}</span>
                </div>
              ))}

              {/* Editable rows */}
              {/* These fields live in the programs table */}
              <EditableRow label="Delivery Status" fieldKey="deliveryStatus" value={local.deliveryStatus || "Planned"} options={DELIVERY_STATUS_OPTIONS} programId={local.id} onSaved={handleProgramFieldSaved} saveFn={updateProgramField} />
              <EditableRow label="Report Status" fieldKey="overallReportStatus" value={local.overallReportStatus || "PENDING"} options={REPORT_STATUS_OPTIONS} programId={local.id} onSaved={handleProgramFieldSaved} saveFn={updateProgramField} />
              {/* These fields live in program_lifecycle_status table */}
              <EditableRow label="Feedback Status" fieldKey="feedbackStatus" value={local.feedbackStatus || "MISSING"} options={FEEDBACK_STATUS_OPTIONS} programId={local.id} onSaved={handleProgramFieldSaved} saveFn={updateLifecycleStatus} />
              <EditableRow label="Payment Status" fieldKey="paymentStatus" value={local.paymentStatus || "N_A"} options={PAYMENT_STATUS_OPTIONS} programId={local.id} onSaved={handleProgramFieldSaved} saveFn={updateLifecycleStatus} />

              {local.approvedBudgetPhp !== null && (
                <div className="flex px-3 py-2 items-center gap-3">
                  <span className="text-zinc-500 w-32 shrink-0 text-xs">Budget (PHP)</span>
                  <span className="font-bold text-[#0046ab] text-xs flex items-center gap-1">
                    <Banknote className="h-3.5 w-3.5" />
                    {new Intl.NumberFormat("en-PH").format(local.approvedBudgetPhp)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Sessions */}
          {local.sessions.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">Sessions ({local.sessions.length})</p>
              <div className="rounded-lg border overflow-hidden divide-y">
                {local.sessions.map((s, i) => (
                  <div key={s.sessionId} className="px-3 py-2 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-medium text-zinc-700 dark:text-zinc-300">Session {s.sessionNumber ?? i + 1}</span>
                      {s.sessionDate && (
                        <span className="text-zinc-400 ml-2 flex items-center gap-1 inline-flex">
                          <CalendarDays className="h-3 w-3" />{s.sessionDate}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-3 text-zinc-500">
                      <span>{s.participantsCount} pax</span>
                      {s.feedbackScoreAvg !== null && (
                        <span className="text-amber-500 font-bold flex items-center gap-0.5">
                          <Star className="h-3 w-3" />{s.feedbackScoreAvg.toFixed(1)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
