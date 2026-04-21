"use client"

import { useEffect, useState, useMemo } from "react"
import { ShieldCheck, Loader2, Database, Trash2 } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { fetchDashboardData, deleteUploadBatch } from "./actions"
import { utils, writeFile } from "xlsx"
import { exportDashboardPdf } from "@/lib/exportPdf"

// Governance components
import FilterBar from "@/components/governance/FilterBar"
import KpiCards from "@/components/governance/KpiCards"
import DistributionCharts from "@/components/governance/DistributionCharts"
import DeliveryTrends from "@/components/governance/DeliveryTrends"
import GovernanceIndicators from "@/components/governance/GovernanceIndicators"
import ProgramDrawer from "@/components/governance/ProgramDrawer"
import { ProcessedProgramRow } from "@/components/governance/types"

interface GovernanceAuditLog {
  id: string
  fileName: string
  date: string
  count: number
  normalizedData: ProcessedProgramRow[]
}

interface FilterState {
  year: string
  quarters: string[]
  units: string[]
  modes: string[]
  priorities: string[]
  statuses: string[]
  leadSearch: string
  buSearch: string
}

const DEFAULT_FILTERS: FilterState = {
  year: "all",
  quarters: [],
  units: [],
  modes: [],
  priorities: [],
  statuses: [],
  leadSearch: "",
  buSearch: "",
}

export default function GovernanceDashboard() {
  const [logs, setLogs] = useState<GovernanceAuditLog[]>([])
  const [selectedLogId, setSelectedLogId] = useState<string>("")
  const [isLoading, setIsLoading] = useState(true)
  const [isPdfExporting, setIsPdfExporting] = useState(false)
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS)
  const [drawerProgram, setDrawerProgram] = useState<ProcessedProgramRow | null>(null)

  // When the drawer saves a field, propagate the updated program back into logs state
  // so charts/heatmap re-render with fresh data without a full reload
  function handleProgramUpdate(updated: ProcessedProgramRow) {
    setLogs(prev => prev.map(log => ({
      ...log,
      normalizedData: log.normalizedData.map((p: ProcessedProgramRow) =>
        p.id === updated.id ? updated : p
      )
    })))
    // Also keep the drawer in sync
    setDrawerProgram(updated)
  }

  useEffect(() => {
    async function loadData() {
      setIsLoading(true)
      const { data, error } = await fetchDashboardData()
      if (error || !data) {
        alert(`Error loading data: ${error || "Unknown error"}`)
        setIsLoading(false)
        return
      }
      setLogs(data as GovernanceAuditLog[])
      if (data.length > 0) setSelectedLogId(data[0].id)
      setIsLoading(false)
    }
    loadData()
  }, [])

  const selectedLog = logs.find(l => l.id === selectedLogId)
  const rawData = selectedLog?.normalizedData || []

  const uniqueYears = useMemo(() =>
    Array.from(new Set(rawData.map(d => d.programYear).filter(Boolean) as number[])).sort(),
  [rawData])

  const uniqueBUs = useMemo(() =>
    Array.from(new Set(rawData.map(d => d.businessUnit).filter(Boolean))).sort(),
  [rawData])

  const filteredData = useMemo(() => {
    return rawData.filter(item => {
      if (filters.year !== "all" && String(item.programYear) !== filters.year) return false
      if (filters.quarters.length > 0 && !filters.quarters.includes(item.quarter)) return false
      if (filters.units.length > 0 && !filters.units.includes(item.assignedUnit)) return false
      if (filters.modes.length > 0 && !filters.modes.includes(item.deliveryMode)) return false
      if (filters.priorities.length > 0 && !filters.priorities.includes(item.priorityLevel)) return false
      if (filters.statuses.length > 0 && !filters.statuses.includes(item.deliveryStatus?.toUpperCase())) return false
      if (filters.leadSearch && !item.programLead?.toLowerCase().includes(filters.leadSearch.toLowerCase())) return false
      if (filters.buSearch && !item.businessUnit?.toLowerCase().includes(filters.buSearch.toLowerCase())) return false
      return true
    })
  }, [rawData, filters])

  // Prior year data for KPI delta
  const priorYearData = useMemo(() => {
    if (filters.year === "all") return undefined
    const y = Number(filters.year)
    return rawData.filter(d => d.programYear === y - 1)
  }, [rawData, filters.year])

  const handleExport = () => {
    if (filteredData.length === 0) return
    const worksheet = utils.json_to_sheet(filteredData.map(d => ({
      "Program Title": d.programTitle,
      "Assigned Unit": d.assignedUnit,
      "Quarter":       d.quarter,
      "Year":          d.programYear,
      "Status":        d.deliveryStatus,
      "Priority":      d.priorityLevel,
      "Mode":          d.deliveryMode,
      "Participants":  d.totalParticipants,
      "Completions":   d.totalCompletions,
      "Avg Feedback":  d.avgFeedbackScore,
      "Report Status": d.overallReportStatus,
      "Lead":          d.programLead,
    })))
    const workbook = utils.book_new()
    utils.book_append_sheet(workbook, worksheet, "Dashboard Export")
    writeFile(workbook, `Governance_Dashboard_${new Date().toISOString().split("T")[0]}.xlsx`)
  }

  const handleExportPdf = async () => {
    if (isPdfExporting) return
    setIsPdfExporting(true)
    try {
      const reportData = filteredData.map(d => ({
        "Program Title": d.programTitle,
        "Assigned Unit": d.assignedUnit,
        "Quarter":       d.quarter,
        "Year":          d.programYear,
        "Status":        d.deliveryStatus,
        "Priority":      d.priorityLevel,
        "Mode":          d.deliveryMode,
        "Participants":  d.totalParticipants,
        "Completions":   d.totalCompletions,
        "Avg Feedback":  d.avgFeedbackScore,
        "Report Status": d.overallReportStatus,
        "Lead":          d.programLead,
      }))

      await exportDashboardPdf({
        title: "Governance Dashboard — Program Accountability & Portfolio Reporting",
        filename: `Governance_Dashboard_${new Date().toISOString().split("T")[0]}.pdf`,
        metadata: {
          Source: selectedLog?.fileName ?? "All Data",
          Programs: String(filteredData.length),
          Filters: filters.year !== "all" ? `Year ${filters.year}` : "All Years",
        },
        reportData
      })
    } finally {
      setIsPdfExporting(false)
    }
  }

  const handleDeleteLog = async () => {
    if (!selectedLogId) return
    if (!confirm("Delete this data source? All associated programs will be removed.")) return
    setIsLoading(true)
    const { success, error } = await deleteUploadBatch(selectedLogId)
    if (error) { alert(`Error: ${error}`); setIsLoading(false); return }
    alert("Data source deleted.")
    const updated = logs.filter(l => l.id !== selectedLogId)
    setLogs(updated)
    setSelectedLogId(updated.length > 0 ? updated[0].id : "")
    setIsLoading(false)
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
          <ShieldCheck className="h-10 w-10 text-zinc-400" />
        </div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">No Data Available</h1>
        <p className="text-zinc-500 max-w-sm">
          Upload a Program Tracker Excel file in the <strong>Import Excel</strong> section to generate the dashboard.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">Governance Dashboard</h1>
          <p className="text-zinc-500 dark:text-zinc-400">Program Accountability and Portfolio Reporting</p>
        </div>

        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-3 bg-white border rounded-lg px-3 py-1.5 shadow-sm dark:bg-zinc-900">
            <Database className="h-4 w-4 text-[#0046ab]" />
            <span className="text-sm font-medium text-zinc-500">Source:</span>
            <Select value={selectedLogId} onValueChange={setSelectedLogId}>
              <SelectTrigger className="w-[220px] border-none shadow-none h-8 p-0 focus:ring-0">
                <SelectValue placeholder="Select Source" />
              </SelectTrigger>
              <SelectContent>
                {logs.map(log => (
                  <SelectItem key={log.id} value={log.id}>{log.fileName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedLogId && selectedLogId !== "ALL_DATA" && (
              <Button
                variant="ghost" size="icon"
                className="h-6 w-6 text-red-500 hover:text-red-700 hover:bg-red-50 ml-1 rounded-full shrink-0"
                onClick={handleDeleteLog} title="Delete this file"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
          {selectedLog && (
            <p className="text-[10px] text-zinc-400 uppercase font-bold">
              Uploaded: {selectedLog.date} · {filteredData.length} programs shown
            </p>
          )}
        </div>
      </div>

      {/* Persistent Filter Bar */}
      <FilterBar
        filters={filters}
        onChange={setFilters}
        onExport={handleExport}
        onExportPdf={handleExportPdf}
        isPdfExporting={isPdfExporting}
        uniqueYears={uniqueYears}
        uniqueBUs={uniqueBUs}
      />

      {/* Panel 1: KPI Cards */}
      <div data-pdf-section data-pdf-label="KPI Summary">
        <KpiCards data={filteredData} priorYearData={priorYearData} />
      </div>

      {/* Panel 2: Distribution Charts */}
      <div data-pdf-section data-pdf-label="Portfolio Distribution">
        <DistributionCharts data={filteredData} />
      </div>

      {/* Panel 3: Delivery & Participation Trends */}
      <div data-pdf-section data-pdf-label="Delivery & Participation Trends">
        <DeliveryTrends data={filteredData} onProgramClick={setDrawerProgram} />
      </div>

      {/* Panel 4: Governance & Evaluation Indicators */}
      <div data-pdf-section data-pdf-label="Governance & Evaluation Indicators">
        <GovernanceIndicators data={filteredData} onProgramClick={setDrawerProgram} />
      </div>

      {/* Program Detail Drawer */}
      {drawerProgram && (
        <ProgramDrawer
          program={drawerProgram}
          onClose={() => setDrawerProgram(null)}
          onProgramUpdate={handleProgramUpdate}
        />
      )}
    </div>
  )
}
