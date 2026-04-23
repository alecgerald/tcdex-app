"use client"

import { useEffect, useState, useTransition, useRef } from "react"
import { 
  FileSpreadsheet, 
  Download, 
  Search,
  Database,
  Filter,
  Loader2,
  Pencil,
  Check,
  X
} from "lucide-react"
import { utils, writeFile } from "xlsx"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { fetchDashboardData, updateProgramField, updateOwnershipField } from "../actions"

// ─── Option lists ──────────────────────────────────────────────────────────────
const DELIVERY_STATUS_OPTIONS = ["Planned", "Ongoing", "Completed", "Cancelled", "Deferred"]
const REPORT_STATUS_OPTIONS    = ["PENDING", "IN_PROGRESS", "SUBMITTED", "APPROVED", "REJECTED"]
const PRIORITY_LEVEL_OPTIONS   = ["HIGH", "MEDIUM", "LOW", "NONE"]
const DELIVERY_MODE_OPTIONS    = ["VILT", "ILT", "E-Learning", "Blended", "On-the-Job", "Coaching", "Webinar", "Workshop"]
const TRAINER_TYPE_OPTIONS     = ["Internal", "External", "Blended", "N/A"]
const QUARTER_OPTIONS          = ["Q1", "Q2", "Q3", "Q4"]
const BUDGET_OPTIONS           = ["true", "false"]
const EVAL_OPTIONS             = ["Evidence Provided", "No Evidence", "Partial Evidence"]

// ─── Badge colour helpers ──────────────────────────────────────────────────────
function deliveryBadgeClass(status: string) {
  switch (status) {
    case "Completed":  return "text-green-600  border-green-200  bg-green-50"
    case "Ongoing":    return "text-blue-600   border-blue-200   bg-blue-50"
    case "Planned":    return "text-purple-600 border-purple-200 bg-purple-50"
    case "Deferred":   return "text-amber-600  border-amber-200  bg-amber-50"
    case "Cancelled":  return "text-red-600    border-red-200    bg-red-50"
    default:           return "text-red-600    border-red-200    bg-red-50"
  }
}

function priorityBadgeClass(level: string) {
  switch (level) {
    case "HIGH":   return "text-red-600    border-red-200    bg-red-50"
    case "MEDIUM": return "text-amber-600  border-amber-200  bg-amber-50"
    case "LOW":    return "text-emerald-600 border-emerald-200 bg-emerald-50"
    default:       return "text-zinc-600   border-zinc-200   bg-zinc-50"
  }
}

// ─── Inline SELECT editable cell ─────────────────────────────────────────────
interface EditableCellProps {
  programId: string
  field: string
  value: string
  options: string[]
  renderDisplay: (val: string) => React.ReactNode
  disabled?: boolean
  onSaved: (programId: string, field: string, newValue: string) => void
  useOwnershipAction?: boolean
}

function EditableCell({
  programId, field, value, options, renderDisplay, disabled, onSaved, useOwnershipAction
}: EditableCellProps) {
  const [isPending, startTransition] = useTransition()
  const [current, setCurrent] = useState(value)

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newVal = e.target.value
    const prev = current
    setCurrent(newVal)

    startTransition(async () => {
      const action = useOwnershipAction ? updateOwnershipField : updateProgramField
      const result = await action(programId, field, newVal)
      if (result?.error) {
        setCurrent(prev)
        toast.error(`Failed to update: ${result.error}`)
      } else {
        onSaved(programId, field, newVal)
        toast.success("Updated successfully")
      }
    })
  }

  if (disabled) return <>{renderDisplay(current)}</>

  return (
    <div className="relative inline-flex items-center gap-1 group">
      {isPending
        ? <Loader2 className="h-3 w-3 animate-spin text-zinc-400 shrink-0" />
        : <Pencil className="h-2.5 w-2.5 text-zinc-300 group-hover:text-[#0046ab] transition-colors shrink-0" />
      }
      <div className="relative">
        {renderDisplay(current)}
        <select
          value={current}
          onChange={handleChange}
          disabled={isPending}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          title="Click to change"
        >
          {options.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </div>
    </div>
  )
}

// ─── Inline TEXT editable cell ────────────────────────────────────────────────
interface EditableTextCellProps {
  programId: string
  field: string
  value: string
  disabled?: boolean
  type?: "text" | "number"
  placeholder?: string
  onSaved: (programId: string, field: string, newValue: string) => void
  useOwnershipAction?: boolean
  className?: string
}

function EditableTextCell({
  programId, field, value, disabled, type = "text", placeholder, onSaved, useOwnershipAction, className
}: EditableTextCellProps) {
  const [isPending, startTransition] = useTransition()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setDraft(value) }, [value])

  function startEdit() {
    if (disabled || isPending) return
    setDraft(value)
    setEditing(true)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  function cancelEdit() {
    setDraft(value)
    setEditing(false)
  }

  function commitEdit() {
    if (draft === value) { setEditing(false); return }
    const prev = value
    setEditing(false)

    startTransition(async () => {
      const action = useOwnershipAction ? updateOwnershipField : updateProgramField
      const result = await action(programId, field, draft)
      if (result?.error) {
        setDraft(prev)
        toast.error(`Failed to update: ${result.error}`)
      } else {
        onSaved(programId, field, draft)
        toast.success("Updated successfully")
      }
    })
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter")  commitEdit()
    if (e.key === "Escape") cancelEdit()
  }

  if (disabled) {
    return <span className={className}>{value || "N/A"}</span>
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1 min-w-[100px]">
        <input
          ref={inputRef}
          type={type}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={commitEdit}
          placeholder={placeholder}
          className="w-full text-xs border border-[#0046ab] rounded px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-[#0046ab] bg-white dark:bg-zinc-900"
        />
        <button onClick={commitEdit} className="text-green-600 hover:text-green-700 shrink-0"><Check className="h-3.5 w-3.5" /></button>
        <button onClick={cancelEdit} className="text-zinc-400 hover:text-red-500 shrink-0"><X className="h-3.5 w-3.5" /></button>
      </div>
    )
  }

  return (
    <div
      className={`group flex items-center gap-1 cursor-pointer rounded hover:bg-blue-50 dark:hover:bg-zinc-800 px-1 py-0.5 transition-colors ${className}`}
      onClick={startEdit}
      title="Click to edit"
    >
      {isPending
        ? <Loader2 className="h-3 w-3 animate-spin text-zinc-400 shrink-0" />
        : <Pencil className="h-2.5 w-2.5 text-zinc-300 group-hover:text-[#0046ab] transition-colors shrink-0" />
      }
      <span className={!value ? "text-zinc-400 italic" : ""}>{value || placeholder || "N/A"}</span>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function GovernanceReportsPage() {
  const [logs, setLogs] = useState<any[]>([])
  const [selectedLogId, setSelectedLogId] = useState<string>("")
  const [searchTerm, setSearchTerm] = useState("")
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      setIsLoading(true)
      const { data, error } = await fetchDashboardData()
      if (error || !data) {
        console.error(`Error loading data: ${error || "Unknown error"}`)
        setIsLoading(false)
        return
      }
      setLogs(data)
      if (data.length > 0) setSelectedLogId(data[0].id)
      setIsLoading(false)
    }
    loadData()
  }, [])

  // Optimistically update field in local state so no re-fetch needed
  function handleFieldSaved(programId: string, field: string, newValue: string) {
    setLogs(prev =>
      prev.map(log => ({
        ...log,
        normalizedData: log.normalizedData.map((row: any) =>
          row.id === programId ? { ...row, [field]: newValue } : row
        )
      }))
    )
  }

  const selectedLog = logs.find(log => log.id === selectedLogId)
  const reportData = selectedLog?.normalizedData || []

  const filteredData = reportData.filter((row: any) =>
    Object.values(row).some(val =>
      String(val).toLowerCase().includes(searchTerm.toLowerCase())
    )
  )

  const handleExport = () => {
    if (filteredData.length === 0) return
    const exportData = filteredData.map((row: any) => ({
      "Program Name": row.programTitle || row.programName,
      "Delivery Status": row.deliveryStatus,
      "Target Audience": row.targetAudience,
      "Evaluation Evidence": row.evaluationEvidence,
      "Phase 1: Assigned Unit": row.assignedUnit || row.assignedTcdexUnit,
      "Phase 1: Priority Level": row.priorityLevel,
      "Phase 1: Target Audience": row.targetAudience,
      "Phase 1: Business Unit/Dept": row.businessUnit || row.businessUnitDevt,
      "Phase 2: Program Lead": row.programLead,
      "Phase 2: Trainer Type": row.trainerType || "N/A",
      "Phase 2: Internal Trainers": row.internalTrainerNames || "N/A",
      "Phase 2: External Vendor": row.externalVendor || "N/A",
      "Phase 2: Support Team": row.supportTeam || "N/A",
      "Phase 7: Planned Delivery Month": row.plannedMonth || row.plannedDeliveryMonth || "N/A",
      "Phase 7: Quarter": row.quarter,
      "Phase 7: Year": row.programYear,
      "Phase 7: Delivery Mode": row.deliveryMode,
      "Phase 8: Overall Report Status": row.overallReportStatus,
      "Budget Required": row.budgetRequired ? "Yes" : "No",
      "Approved Budget (PHP)": row.approvedBudgetPhp || 0,
    }))
    const worksheet = utils.json_to_sheet(exportData)
    const workbook = utils.book_new()
    utils.book_append_sheet(workbook, worksheet, "Governance Report")
    const objectMaxLength = Object.keys(exportData[0]).map(key => ({ wch: Math.max(key.length, 15) }))
    worksheet["!cols"] = objectMaxLength
    writeFile(workbook, `TCDEX_Governance_Report_${new Date().toISOString().split("T")[0]}.xlsx`)
  }

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#0046ab]" />
      </div>
    )
  }

  if (logs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
        <div className="h-20 w-20 rounded-full bg-zinc-100 flex items-center justify-center dark:bg-zinc-800">
          <FileSpreadsheet className="h-10 w-10 text-zinc-400" />
        </div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">No Reports Available</h1>
        <p className="text-zinc-500 max-w-sm">
          Please upload Governance Tracker data in the <strong>Import Excel</strong> section first.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">Master Reports</h1>
          <p className="text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5 mt-0.5">
            View and export governance metrics
            <span className="inline-flex items-center gap-1 text-xs bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-2 py-0.5 ml-1">
              <Pencil className="h-3 w-3" /> All fields editable — click any cell
            </span>
          </p>
        </div>

        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-3 bg-white border rounded-lg px-3 py-1.5 shadow-sm dark:bg-zinc-900">
            <Database className="h-4 w-4 text-[#0046ab]" />
            <span className="text-sm font-medium text-zinc-500">Source:</span>
            <Select value={selectedLogId} onValueChange={setSelectedLogId}>
              <SelectTrigger className="w-[240px] border-none shadow-none h-8 p-0 focus:ring-0">
                <SelectValue placeholder="Select Source" />
              </SelectTrigger>
              <SelectContent>
                {logs.map((log) => (
                  <SelectItem key={log.id} value={log.id}>
                    <div className="flex flex-col text-left">
                      <span>{log.fileName}</span>
                      <span className="text-[10px] text-zinc-400">{log.date}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <Card className="border-none shadow-sm overflow-hidden flex flex-col h-[calc(100vh-200px)]">
        <CardHeader className="bg-white dark:bg-zinc-900 border-b pb-4 shrink-0">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Filter className="h-5 w-5 text-zinc-400" />
              <CardTitle className="text-lg">Filtered Data ({filteredData.length} records)</CardTitle>
            </div>
            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="relative w-full md:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-500" />
                <Input
                  placeholder="Search current list..."
                  className="pl-9 h-9 bg-zinc-50"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Button onClick={handleExport} className="bg-[#0046ab] hover:bg-[#003a8f] text-white shrink-0 h-9">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 flex-1 overflow-hidden">
          <ScrollArea className="h-full w-full">
            <Table containerClassName="min-w-full w-fit">
              <TableHeader className="bg-zinc-50 sticky top-0 z-10 dark:bg-zinc-800">
                <TableRow>
                  <TableHead className="min-w-[200px]">Program Name <span className="text-[10px] text-amber-500 font-normal">✎</span></TableHead>
                  <TableHead className="min-w-[140px]">Delivery Status <span className="text-[10px] text-amber-500 font-normal">✎</span></TableHead>
                  <TableHead className="min-w-[160px]">Target Audience <span className="text-[10px] text-amber-500 font-normal">✎</span></TableHead>
                  <TableHead className="min-w-[110px]">Priority <span className="text-[10px] text-amber-500 font-normal">✎</span></TableHead>
                  <TableHead className="min-w-[90px]">Month <span className="text-[10px] text-amber-500 font-normal">✎</span></TableHead>
                  <TableHead className="min-w-[80px]">Qtr <span className="text-[10px] text-amber-500 font-normal">✎</span></TableHead>
                  <TableHead className="min-w-[80px]">Year <span className="text-[10px] text-amber-500 font-normal">✎</span></TableHead>
                  <TableHead className="min-w-[130px]">Budget <span className="text-[10px] text-amber-500 font-normal">✎</span></TableHead>
                  <TableHead className="min-w-[130px]">Report Status <span className="text-[10px] text-amber-500 font-normal">✎</span></TableHead>
                  <TableHead className="min-w-[130px]">Delivery Mode <span className="text-[10px] text-amber-500 font-normal">✎</span></TableHead>
                  <TableHead className="min-w-[150px]">Unit / Dept <span className="text-[10px] text-amber-500 font-normal">✎</span></TableHead>
                  <TableHead className="min-w-[150px]">Program Lead(s) <span className="text-[10px] text-amber-500 font-normal">✎</span></TableHead>
                  <TableHead className="min-w-[150px]">Trainer(s) <span className="text-[10px] text-amber-500 font-normal">✎</span></TableHead>
                  <TableHead className="min-w-[110px]">Trainer Type <span className="text-[10px] text-amber-500 font-normal">✎</span></TableHead>
                  <TableHead className="min-w-[150px]">Vendor Name <span className="text-[10px] text-amber-500 font-normal">✎</span></TableHead>
                  <TableHead className="min-w-[180px]">Evaluation Evidence <span className="text-[10px] text-amber-500 font-normal">✎</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={16} className="h-32 text-center text-zinc-500">
                      No matching records found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredData.map((row: any) => {
                    const isEditable = !!row.id && row.id !== "ALL_DATA"

                    return (
                      <TableRow key={row.id} className="hover:bg-zinc-50/70 transition-colors">

                        {/* Program Name — text editable */}
                        <TableCell className="font-medium text-xs md:text-sm">
                          <EditableTextCell
                            programId={row.id}
                            field="programTitle"
                            value={row.programTitle || row.programName || ""}
                            disabled={!isEditable}
                            placeholder="Enter program name"
                            onSaved={handleFieldSaved}
                          />
                        </TableCell>

                        {/* Delivery Status — select */}
                        <TableCell>
                          <EditableCell
                            programId={row.id}
                            field="deliveryStatus"
                            value={row.deliveryStatus || "Planned"}
                            options={DELIVERY_STATUS_OPTIONS}
                            disabled={!isEditable}
                            onSaved={handleFieldSaved}
                            renderDisplay={(val) => (
                              <Badge variant="outline" className={deliveryBadgeClass(val)}>
                                {val}
                              </Badge>
                            )}
                          />
                        </TableCell>

                        {/* Target Audience — text editable */}
                        <TableCell>
                          <EditableTextCell
                            programId={row.id}
                            field="targetAudience"
                            value={row.targetAudience || ""}
                            disabled={!isEditable}
                            placeholder="e.g. All Staff"
                            onSaved={handleFieldSaved}
                            className="text-xs text-zinc-600 max-w-[160px] truncate"
                          />
                        </TableCell>

                        {/* Priority — select */}
                        <TableCell>
                          <EditableCell
                            programId={row.id}
                            field="priorityLevel"
                            value={row.priorityLevel || "NONE"}
                            options={PRIORITY_LEVEL_OPTIONS}
                            disabled={!isEditable}
                            onSaved={handleFieldSaved}
                            renderDisplay={(val) => (
                              <Badge variant="outline" className={priorityBadgeClass(val)}>
                                {val}
                              </Badge>
                            )}
                          />
                        </TableCell>

                        {/* Planned Month — text */}
                        <TableCell>
                          <EditableTextCell
                            programId={row.id}
                            field="plannedMonth"
                            value={row.plannedMonth || ""}
                            disabled={!isEditable}
                            placeholder="e.g. Jan"
                            onSaved={handleFieldSaved}
                            className="text-xs text-zinc-600"
                          />
                        </TableCell>

                        {/* Quarter — select */}
                        <TableCell>
                          <EditableCell
                            programId={row.id}
                            field="quarter"
                            value={row.quarter || "Q1"}
                            options={QUARTER_OPTIONS}
                            disabled={!isEditable}
                            onSaved={handleFieldSaved}
                            renderDisplay={(val) => (
                              <span className="text-xs font-medium text-zinc-700">{val}</span>
                            )}
                          />
                        </TableCell>

                        {/* Program Year — number */}
                        <TableCell>
                          <EditableTextCell
                            programId={row.id}
                            field="programYear"
                            value={String(row.programYear || new Date().getFullYear())}
                            disabled={!isEditable}
                            type="number"
                            placeholder="YYYY"
                            onSaved={handleFieldSaved}
                            className="text-xs text-zinc-600"
                          />
                        </TableCell>

                        {/* Budget — select + amount */}
                        <TableCell className="text-xs text-zinc-600">
                          <div className="flex flex-col gap-0.5">
                            <EditableCell
                              programId={row.id}
                              field="budgetRequired"
                              value={String(row.budgetRequired ?? false)}
                              options={BUDGET_OPTIONS}
                              disabled={!isEditable}
                              onSaved={(id, f, v) => handleFieldSaved(id, f, v)}
                              renderDisplay={(val) => (
                                <Badge
                                  variant="outline"
                                  className={val === "true"
                                    ? "text-blue-600 border-blue-200 bg-blue-50"
                                    : "text-zinc-500 border-zinc-200 bg-zinc-50"}
                                >
                                  {val === "true" ? "Required" : "Not Req"}
                                </Badge>
                              )}
                            />
                            {(row.budgetRequired === true || row.budgetRequired === "true") && (
                              <EditableTextCell
                                programId={row.id}
                                field="approvedBudgetPhp"
                                value={String(row.approvedBudgetPhp || 0)}
                                disabled={!isEditable}
                                type="number"
                                placeholder="0"
                                onSaved={handleFieldSaved}
                                className="text-[11px] text-zinc-500"
                              />
                            )}
                          </div>
                        </TableCell>

                        {/* Report Status — select */}
                        <TableCell>
                          <EditableCell
                            programId={row.id}
                            field="overallReportStatus"
                            value={row.overallReportStatus || "PENDING"}
                            options={REPORT_STATUS_OPTIONS}
                            disabled={!isEditable}
                            onSaved={handleFieldSaved}
                            renderDisplay={(val) => (
                              <span className="font-medium text-xs">{val}</span>
                            )}
                          />
                        </TableCell>

                        {/* Delivery Mode — select */}
                        <TableCell>
                          <EditableCell
                            programId={row.id}
                            field="deliveryMode"
                            value={row.deliveryMode || "VILT"}
                            options={DELIVERY_MODE_OPTIONS}
                            disabled={!isEditable}
                            onSaved={handleFieldSaved}
                            renderDisplay={(val) => (
                              <span className="text-xs">{val}</span>
                            )}
                          />
                        </TableCell>

                        {/* Unit / Dept — text */}
                        <TableCell>
                          <EditableTextCell
                            programId={row.id}
                            field="assignedUnit"
                            value={row.assignedUnit || row.businessUnit || ""}
                            disabled={!isEditable}
                            placeholder="Unit / Dept"
                            onSaved={handleFieldSaved}
                            className="text-xs text-zinc-600 max-w-[150px] truncate"
                          />
                        </TableCell>

                        {/* Program Lead — text (ownership) */}
                        <TableCell>
                          <EditableTextCell
                            programId={row.id}
                            field="programLead"
                            value={row.programLead || ""}
                            disabled={!isEditable}
                            placeholder="Name(s) comma-separated"
                            onSaved={handleFieldSaved}
                            useOwnershipAction
                            className="text-xs text-zinc-600 max-w-[150px] truncate"
                          />
                        </TableCell>

                        {/* Trainers — text (ownership) */}
                        <TableCell>
                          <EditableTextCell
                            programId={row.id}
                            field="internalTrainerNames"
                            value={row.internalTrainerNames || ""}
                            disabled={!isEditable}
                            placeholder="Name(s) comma-separated"
                            onSaved={handleFieldSaved}
                            useOwnershipAction
                            className="text-xs text-zinc-600 max-w-[150px] truncate"
                          />
                        </TableCell>

                        {/* Trainer Type — select (ownership) */}
                        <TableCell>
                          <EditableCell
                            programId={row.id}
                            field="trainerType"
                            value={row.trainerType || "N/A"}
                            options={TRAINER_TYPE_OPTIONS}
                            disabled={!isEditable}
                            onSaved={handleFieldSaved}
                            useOwnershipAction
                            renderDisplay={(val) => (
                              <span className="text-xs text-zinc-600">{val}</span>
                            )}
                          />
                        </TableCell>

                        {/* Vendor — text (ownership) */}
                        <TableCell>
                          <EditableTextCell
                            programId={row.id}
                            field="externalVendor"
                            value={row.externalVendor || ""}
                            disabled={!isEditable}
                            placeholder="Vendor name"
                            onSaved={handleFieldSaved}
                            useOwnershipAction
                            className="text-xs text-zinc-600 max-w-[150px] truncate"
                          />
                        </TableCell>

                        {/* Evaluation Evidence — select */}
                        <TableCell>
                          <EditableCell
                            programId={row.id}
                            field="evaluationEvidence"
                            value={row.evaluationEvidence || "No Evidence"}
                            options={EVAL_OPTIONS}
                            disabled={!isEditable}
                            onSaved={handleFieldSaved}
                            renderDisplay={(val) => (
                              <span className={`text-xs font-medium ${
                                val === "Evidence Provided"
                                  ? "text-green-600"
                                  : val === "Partial Evidence"
                                  ? "text-amber-600"
                                  : "text-zinc-400"
                              }`}>{val}</span>
                            )}
                          />
                        </TableCell>

                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  )
}
