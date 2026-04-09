"use client"

import { useEffect, useState } from "react"
import {
  FileSpreadsheet,
  Users,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Table as TableIcon,
  PieChart as PieChartIcon,
  Loader2,
  Database,
  Building2,
  UserCheck,
  ClipboardList,
  GraduationCap,
  Search,
  Download,
  FileText,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  ChevronUp,
  ChevronDown
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { utils, writeFile } from "xlsx"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"

interface SummaryItem {
  status: string
  count: number
  rate: string
}

interface BreakoutItem {
  name: string
  total: number
  completed: number
  ongoing?: number
  notStarted?: number
  rate: string
}

interface CourseItem {
  name: string
  assigned: number
  completed: number
  rate: string
}

interface AuditLog {
  id: string
  fileName: string
  date: string
  count: number
  importType?: 'status' | 'courses' | 'detailed_report'
  statusSummary?: SummaryItem[]
  deptSummary: any[]
  mgrSummary?: BreakoutItem[]
  employeeSummary?: CourseItem[]
  detailedSummary?: any[]
  cleanedData?: any[]
}

const PieChart = ({ data }: { data: SummaryItem[] }) => {
  const total = data.reduce((acc, curr) => acc + curr.count, 0)
  let cumulativePercent = 0

  function getCoordinatesForPercent(percent: number) {
    const x = Math.cos(2 * Math.PI * percent)
    const y = Math.sin(2 * Math.PI * percent)
    return [x, y]
  }

  return (
    <svg viewBox="-1 -1 2 2" className="h-48 w-48 -rotate-90">
      {data.map((slice) => {
        const slicePercent = slice.count / total
        if (slicePercent === 0) return null

        const [startX, startY] = getCoordinatesForPercent(cumulativePercent)
        cumulativePercent += slicePercent
        const [endX, endY] = getCoordinatesForPercent(cumulativePercent)

        const largeArcFlag = slicePercent > 0.5 ? 1 : 0
        const pathData = [
          `M ${startX} ${startY}`,
          `A 1 1 0 ${largeArcFlag} 1 ${endX} ${endY}`,
          `L 0 0`,
        ].join(' ')

        const color = slice.status === 'Completed' ? '#22c55e' : slice.status === 'Ongoing' ? '#3b82f6' : '#ef4444'
        return <path key={slice.status} d={pathData} fill={color} className="stroke-white stroke-[0.02]" />
      })}
    </svg>
  )
}

export default function LMSDashboard() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [selectedLogId, setSelectedLogId] = useState<string>("")
  const [dashboardType, setDashboardType] = useState<'status' | 'courses' | 'detailed_report'>('status')
  const [isLoading, setIsLoading] = useState(true)

  // Search states
  const [deptSearch, setDeptSearch] = useState("")
  const [mgrSearch, setMgrSearch] = useState("")
  const [courseDeptSearch, setCourseDeptSearch] = useState("")
  const [employeeSearch, setEmployeeSearch] = useState("")

  // Pagination states
  const [deptPage, setDeptPage] = useState(1)
  const [mgrPage, setMgrPage] = useState(1)
  const [courseDeptPage, setCourseDeptPage] = useState(1)
  const [employeePage, setEmployeePage] = useState(1)

  // Sort states
  type SortConfig = { key: string, direction: 'asc' | 'desc' } | null
  const [deptSort, setDeptSort] = useState<SortConfig>(null)
  const [mgrSort, setMgrSort] = useState<SortConfig>(null)
  const [courseDeptSort, setCourseDeptSort] = useState<SortConfig>(null)
  const [employeeSort, setEmployeeSort] = useState<SortConfig>(null)

  // Detailed Report states
  const [detailedSearch, setDetailedSearch] = useState("")
  const [detailedPage, setDetailedPage] = useState(1)
  const [detailedSort, setDetailedSort] = useState<SortConfig>(null)

  const handleSort = (key: string, currentSort: SortConfig, setSort: (s: SortConfig) => void) => {
    if (!currentSort || currentSort.key !== key) {
      setSort({ key, direction: 'desc' })
    } else if (currentSort.direction === 'desc') {
      setSort({ key, direction: 'asc' })
    } else {
      setSort(null)
    }
  }

  const SortIcon = ({ sort, sortKey }: { sort: SortConfig, sortKey: string }) => {
    if (!sort || sort.key !== sortKey) return <ChevronsUpDown className="h-4 w-4 ml-1 text-zinc-400" />
    return sort.direction === 'desc' ? <ChevronDown className="h-4 w-4 ml-1 text-[#0046ab]" /> : <ChevronUp className="h-4 w-4 ml-1 text-[#0046ab]" />
  }

  const parseSortValue = (val: any) => {
    if (typeof val === 'string') {
      const isPercent = val.endsWith('%')
      if (isPercent) return parseFloat(val.replace('%', ''))
      return val.toLowerCase()
    }
    return val || 0
  }

  const applySort = (data: any[], sort: SortConfig) => {
    if (!sort) return [...data]
    return [...data].sort((a, b) => {
      const aVal = parseSortValue(a[sort.key])
      const bVal = parseSortValue(b[sort.key])
      if (aVal < bVal) return sort.direction === 'asc' ? -1 : 1
      if (aVal > bVal) return sort.direction === 'asc' ? 1 : -1
      return 0
    })
  }

  useEffect(() => {
    const existingLogs = localStorage.getItem("lms_audit_logs")
    const activeData = localStorage.getItem("lms_active_data")

    if (existingLogs) {
      const parsedLogs = JSON.parse(existingLogs) as AuditLog[]
      setLogs(parsedLogs)

      if (activeData) {
        try {
          const active = JSON.parse(activeData)
          setSelectedLogId(active.id)
          setDashboardType(active.importType || 'status')
        } catch (e) {
          if (parsedLogs.length > 0) setSelectedLogId(parsedLogs[0].id)
        }
      } else if (parsedLogs.length > 0) {
        // Find latest log of current type if possible, or just the first one
        const latestOfCurrentType = parsedLogs.find(l => (l.importType || 'status') === dashboardType)
        if (latestOfCurrentType) {
          setSelectedLogId(latestOfCurrentType.id)
        } else {
          setSelectedLogId(parsedLogs[0].id)
          setDashboardType(parsedLogs[0].importType || 'status')
        }
      }
    }
    setIsLoading(false)
  }, [])

  // Update selected log when dashboard type changes
  useEffect(() => {
    if (logs.length > 0) {
      const latestOfCurrentType = logs.find(l => (l.importType || 'status') === dashboardType)
      if (latestOfCurrentType) {
        setSelectedLogId(latestOfCurrentType.id)
      }
    }
  }, [dashboardType, logs])

  const selectedLog = logs.find(log => log.id === selectedLogId)
  const filteredLogsForType = logs.filter(l => (l.importType || 'status') === dashboardType)

  const statusSummary = selectedLog?.statusSummary || []

  const filteredDeptSummary = (selectedLog?.deptSummary || []).filter((item: any) =>
    item.name.toLowerCase().includes((dashboardType === 'status' ? deptSearch : courseDeptSearch).toLowerCase())
  )

  const filteredMgrSummary = (selectedLog?.mgrSummary || []).filter((item: any) =>
    item.name.toLowerCase().includes(mgrSearch.toLowerCase())
  )

  const filteredEmployeeSummary = (selectedLog?.employeeSummary || []).filter((item: any) =>
    item.name.toLowerCase().includes(employeeSearch.toLowerCase())
  )

  const filteredDetailedSummary = (selectedLog?.detailedSummary || []).filter((item: any) =>
    item.userName.toLowerCase().includes(detailedSearch.toLowerCase()) ||
    item.courseName.toLowerCase().includes(detailedSearch.toLowerCase())
  )

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Completed": return "bg-green-500"
      case "Ongoing": return "bg-blue-500"
      case "Not Started": return "bg-red-500"
      default: return "bg-zinc-400"
    }
  }

  const handleDownloadExcel = () => {
    if (!selectedLog || !selectedLog.cleanedData) return

    // Clean data for excel (remove the 'id' field we added during upload)
    const dataToExport = selectedLog.cleanedData.map(({ id, ...rest }: any) => {
      const exportRow = { ...rest }

      if (selectedLog.importType === 'courses') {
        // Dynamically calculate Completion % for every raw row identically to dashboard logic
        const assignedKey = Object.keys(exportRow).find(k => /assigned/i.test(k)) || "Assigned Courses"
        const completedKey = Object.keys(exportRow).find(k => /completed/i.test(k) && !/status/i.test(k)) || "Completed Courses"

        const assigned = Number(exportRow[assignedKey]) || 0
        const completed = Number(exportRow[completedKey]) || 0

        exportRow['Completion %'] = assigned > 0 ? `${((completed / assigned) * 100).toFixed(1)}%` : "0.0%"
      }

      return exportRow
    })

    const ws = utils.json_to_sheet(dataToExport)
    const wb = utils.book_new()
    utils.book_append_sheet(wb, ws, "Cleaned Data")
    writeFile(wb, `${selectedLog.fileName}_cleaned.xlsx`)
  }

  const handleDownloadPDF = () => {
    if (!selectedLog) return

    const doc = new jsPDF()
    const timestamp = new Date().toLocaleString()

    // Header
    const pdfWidth = doc.internal.pageSize.getWidth()
    doc.setFontSize(20)
    doc.setTextColor(0, 70, 171) // #0046ab
    doc.text("LMS Dashboard Summary", pdfWidth / 2, 22, { align: 'center' })

    if (selectedLog.importType === 'status') {
      let nextY = 35;

      try {
        const total = (selectedLog.statusSummary || []).reduce((acc, curr) => acc + curr.count, 0)
        if (total > 0 && typeof document !== 'undefined') {
          const canvas = document.createElement('canvas')
          canvas.width = 1000
          canvas.height = 400
          const ctx = canvas.getContext('2d')
          if (ctx) {
            ctx.imageSmoothingEnabled = true;
            ctx.scale(2, 2); // High-DPI scaling (500x200 effective space)

            let currentAngle = -0.5 * Math.PI
            const cx = 130, cy = 100, radius = 90

              ; (selectedLog.statusSummary || []).forEach(slice => {
                const sliceAngle = (slice.count / total) * 2 * Math.PI
                ctx.beginPath()
                ctx.moveTo(cx, cy)
                ctx.arc(cx, cy, radius, currentAngle, currentAngle + sliceAngle)
                ctx.closePath()
                if (slice.status === 'Completed') ctx.fillStyle = '#22c55e'
                else if (slice.status === 'Ongoing') ctx.fillStyle = '#3b82f6'
                else ctx.fillStyle = '#ef4444'
                ctx.fill()

                // No border
                currentAngle += sliceAngle
              })

            // Cutout donut hole
            ctx.beginPath()
            ctx.arc(cx, cy, 55, 0, 2 * Math.PI)
            ctx.fillStyle = '#ffffff'
            ctx.fill()

            // Draw center text natively
            const completionRate = (((selectedLog.deptSummary as any[]).reduce((acc, curr) => acc + (curr.completed || 0), 0) / (selectedLog.count || 1)) * 100).toFixed(1)
            ctx.fillStyle = '#111827'
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            ctx.font = 'bold 28px sans-serif'
            ctx.fillText(`${completionRate}%`, cx, cy - 8)

            ctx.fillStyle = '#6b7280'
            ctx.font = 'bold 10px sans-serif'
            ctx.fillText('COMPLETED', cx, cy + 14)

            // Draw Legend natively onto the right side
            let legendY = 60;
            ; (selectedLog.statusSummary || []).forEach(slice => {
              if (slice.status === 'Completed') ctx.fillStyle = '#22c55e'
              else if (slice.status === 'Ongoing') ctx.fillStyle = '#3b82f6'
              else ctx.fillStyle = '#ef4444'

              ctx.beginPath()
              ctx.arc(280, legendY, 6, 0, 2 * Math.PI)
              ctx.fill()

              ctx.textAlign = 'left'
              ctx.textBaseline = 'middle'

              ctx.fillStyle = '#4b5563'
              ctx.font = 'bold 16px sans-serif'
              ctx.fillText(`${slice.status}`, 300, legendY)

              ctx.fillStyle = '#9ca3af'
              ctx.font = '14px sans-serif'
              ctx.fillText(`-   ${slice.rate}  (${slice.count})`, 390, legendY)

              legendY += 40;
            })

            const imgData = canvas.toDataURL('image/png', 1.0)
            const imgWidth = 160
            doc.addImage(imgData, 'PNG', (pdfWidth - imgWidth) / 2, 28, imgWidth, 64)

            nextY = 96
          }
        }
      } catch (e) {
        console.error("Canvas pie chart generation failed", e)
      }

      // Status Distribution Table
      doc.setFontSize(14)
      doc.setTextColor(0)
      doc.text("Status Distribution", 14, nextY)

      autoTable(doc, {
        startY: nextY + 5,
        head: [['Status', 'Count', 'Percentage (%)']],
        body: (selectedLog.statusSummary || []).map(s => [s.status, s.count, s.rate]),
        theme: 'striped',
        headStyles: { fillColor: [0, 70, 171] }
      })

      // Department Summary Table
      doc.text("Department Completion", 14, (doc as any).lastAutoTable.finalY + 15)

      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 20,
        head: [['Department', 'Completed', 'Not Started', 'Ongoing', 'Total', 'Rate']],
        body: (selectedLog.deptSummary as BreakoutItem[]).map(d => [
          d.name, d.completed, d.notStarted ?? 0, d.ongoing ?? 0, d.total, d.rate
        ]),
        theme: 'striped',
        headStyles: { fillColor: [0, 70, 171] }
      })

      // Manager Summary Table
      if (selectedLog.mgrSummary && selectedLog.mgrSummary.length > 0) {
        if ((doc as any).lastAutoTable.finalY + 40 > 280) doc.addPage()
        doc.text("Manager Completion", 14, (doc as any).lastAutoTable.finalY + 15)

        autoTable(doc, {
          startY: (doc as any).lastAutoTable.finalY + 20,
          head: [['Manager', 'Completed', 'Not Started', 'Ongoing', 'Total', 'Rate']],
          body: selectedLog.mgrSummary.map(m => [
            m.name, m.completed, m.notStarted ?? 0, m.ongoing ?? 0, m.total, m.rate
          ]),
          theme: 'striped',
          headStyles: { fillColor: [0, 70, 171] }
        })
      }
    } else if (selectedLog.importType === 'courses') {
      // Courses Analysis
      const totalAssigned = (selectedLog.deptSummary as CourseItem[]).reduce((a, b) => a + (b.assigned || 0), 0)
      const totalCompleted = (selectedLog.deptSummary as CourseItem[]).reduce((a, b) => a + (b.completed || 0), 0)
      const overallRate = ((totalCompleted / (totalAssigned || 1)) * 100).toFixed(1) + "%"

      doc.setFontSize(14)
      doc.text("Overall Metrics", 14, 35)
      doc.setFontSize(11)
      doc.text(`Total Courses Assigned: ${totalAssigned.toLocaleString()}`, 14, 45)
      doc.text(`Total Courses Completed: ${totalCompleted.toLocaleString()}`, 14, 52)
      doc.text(`Overall Completion Rate: ${overallRate}`, 14, 59)

      // Department Analysis Table
      doc.setFontSize(14)
      doc.text("Department Analysis", 14, 75)

      autoTable(doc, {
        startY: 80,
        head: [['Department', 'Assigned Courses', 'Completed Courses', 'Rate']],
        body: (selectedLog.deptSummary as CourseItem[]).map(d => [
          d.name, d.assigned.toLocaleString(), d.completed.toLocaleString(), d.rate
        ]),
        theme: 'striped',
        headStyles: { fillColor: [0, 70, 171] }
      })

      // Employee Analysis Table
      if (selectedLog.employeeSummary && selectedLog.employeeSummary.length > 0) {
        if ((doc as any).lastAutoTable.finalY + 40 > 280) doc.addPage()
        doc.text("Employee Analysis", 14, (doc as any).lastAutoTable.finalY + 15)

        autoTable(doc, {
          startY: (doc as any).lastAutoTable.finalY + 20,
          head: [['Employee Name', 'Assigned', 'Completed', 'Rate']],
          body: selectedLog.employeeSummary.map(e => [
            e.name, e.assigned.toLocaleString(), e.completed.toLocaleString(), e.rate
          ]),
          theme: 'striped',
          headStyles: { fillColor: [0, 70, 171] }
        })
      }
    } else if (selectedLog.importType === 'detailed_report') {
      doc.setFontSize(14)
      doc.text("Detailed Report Snapshot", 14, 35)

      const recordsToPrint = (selectedLog.detailedSummary || []).slice(0, 100)
      autoTable(doc, {
        startY: 45,
        head: [['User Name', 'Course Name', 'User Status', 'Course Status', 'Completion %']],
        body: recordsToPrint.map(r => [
          r.userName,
          r.courseName.substring(0, 30) + (r.courseName.length > 30 ? '...' : ''),
          r.userStatus,
          r.courseStatus,
          r.completionPercentage
        ]),
        theme: 'striped',
        headStyles: { fillColor: [0, 70, 171] },
        styles: { fontSize: 8 }
      })
      if ((selectedLog.detailedSummary || []).length > 100) {
        doc.text("Note: Only showing the first 100 records in PDF. Please download Excel for full report.", 14, (doc as any).lastAutoTable.finalY + 10)
      }
    }

    const pageCount = (doc.internal as any).getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)
      const pageHeight = doc.internal.pageSize.getHeight()
      doc.setFontSize(8)
      doc.setTextColor(150)
      const footerText = `Source: ${selectedLog.fileName}   |   Import Type: ${selectedLog.importType === 'courses' ? 'Assigned/Completed Courses' : selectedLog.importType === 'detailed_report' ? 'Completion Detailed Report' : 'Status Completion'}   |   Generated: ${timestamp}`
      doc.text(footerText, 14, pageHeight - 10)
    }

    doc.save(`${selectedLog.fileName}_summary.pdf`)
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
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">No Data Available</h1>
        <p className="text-zinc-500 max-sm">
          Please upload an Academy LMS Excel file in the <strong>Import Excel</strong> section to generate the dashboard.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">LMS Dashboard</h1>
          <p className="text-zinc-500 dark:text-zinc-400">Academy Analytics - Source Isolated Reporting</p>
        </div>

        <div className="flex flex-col items-end gap-3">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-2 text-[#0046ab] border-[#0046ab]/20 hover:bg-[#0046ab]/5"
              onClick={handleDownloadExcel}
              disabled={!selectedLog}
            >
              <Download className="h-4 w-4" />
              Download Excel
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-2 text-red-600 border-red-200 hover:bg-red-50"
              onClick={handleDownloadPDF}
              disabled={!selectedLog}
            >
              <FileText className="h-4 w-4" />
              Download PDF
            </Button>
          </div>
          <div className="flex items-center gap-3 bg-white border rounded-lg px-3 py-1.5 shadow-sm dark:bg-zinc-900">
            <Database className="h-4 w-4 text-[#0046ab]" />
            <span className="text-sm font-medium text-zinc-500">Source:</span>
            <Select value={selectedLogId} onValueChange={setSelectedLogId}>
              <SelectTrigger className="w-[200px] border-none shadow-none h-8 p-0 focus:ring-0">
                <SelectValue placeholder="Select Source" />
              </SelectTrigger>
              <SelectContent>
                {filteredLogsForType.map((log) => (
                  <SelectItem key={log.id} value={log.id}>
                    {log.fileName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {selectedLog && (
            <p className="text-[10px] text-zinc-400 uppercase font-bold">Uploaded: {selectedLog.date}</p>
          )}
        </div>
      </div>

      <Tabs value={dashboardType} onValueChange={(v) => setDashboardType(v as 'status' | 'courses' | 'detailed_report')} className="w-full">
        <TabsList className="grid w-full grid-cols-1 md:grid-cols-3 max-w-3xl">
          <TabsTrigger value="status" className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Status Completion
          </TabsTrigger>
          <TabsTrigger value="courses" className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4" />
            Assigned/Completed Courses
          </TabsTrigger>
          <TabsTrigger value="detailed_report" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            CompletionDetailedReport
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {!selectedLog && (
        <Card className="border-none shadow-sm flex flex-col items-center justify-center py-20 text-center">
          <AlertCircle className="h-10 w-10 text-zinc-300 mb-4" />
          <h3 className="text-lg font-semibold">No {dashboardType === 'status' ? 'Status' : dashboardType === 'detailed_report' ? 'Detailed Report' : 'Courses'} logs found</h3>
          <p className="text-zinc-500 max-w-sm">Please switch to the other view or upload a file for this category.</p>
        </Card>
      )}

      {selectedLog && (selectedLog.importType || 'status') === 'status' && dashboardType === 'status' && (
        <div className="space-y-6 animate-in fade-in duration-500">
          {/* Output 1: Status Analysis */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border-none shadow-sm">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <TableIcon className="h-5 w-5 text-zinc-400" />
                  <CardTitle>Status Distribution</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Count</TableHead>
                      <TableHead className="text-right">Percentage (%)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {statusSummary.map((row) => (
                      <TableRow key={row.status}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <div className={`h-2 w-2 rounded-full ${getStatusColor(row.status)}`} />
                            {row.status}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{row.count}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant="secondary" className="font-mono text-[#0046ab]">{row.rate}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <PieChartIcon className="h-5 w-5 text-zinc-400" />
                  <CardTitle>Status Visual Representation</CardTitle>
                </div>
                <CardDescription>Visual breakdown of status percentages</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center justify-center h-full pt-4">
                  <div className="relative h-56 w-56 flex items-center justify-center mb-6">
                    <PieChart data={statusSummary} />
                    <div className="absolute inset-12 bg-white rounded-full dark:bg-zinc-900 flex flex-col items-center justify-center shadow-sm border text-center">
                      <span className="text-2xl font-bold">
                        {(selectedLog.deptSummary as any[]).reduce((acc, curr) => acc + (curr.completed || 0), 0) / (selectedLog.count || 1) * 100 > 0
                          ? (((selectedLog.deptSummary as any[]).reduce((acc, curr) => acc + (curr.completed || 0), 0) / (selectedLog.count || 1)) * 100).toFixed(1)
                          : "0.0"}%
                      </span>
                      <span className="text-[10px] text-zinc-400 uppercase font-bold leading-tight">Total<br />Completion</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4 w-full pt-4 border-t">
                    {statusSummary.map((s) => (
                      <div key={s.status} className="flex flex-col items-center">
                        <div className={`h-2.5 w-2.5 rounded-full mb-1 ${getStatusColor(s.status)}`} />
                        <span className="text-[10px] font-medium text-zinc-500 uppercase">{s.status}</span>
                        <span className="text-sm font-bold">{s.rate}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Output 2: Department Completion */}
          <Card className="border-none shadow-sm">
            <CardHeader className="pb-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-zinc-400" />
                  <CardTitle>Department Completion</CardTitle>
                </div>
                <div className="relative w-full md:w-64">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-500" />
                  <Input
                    placeholder="Search department..."
                    className="pl-9 h-9"
                    value={deptSearch}
                    onChange={(e) => {
                      setDeptSearch(e.target.value)
                      setDeptPage(1)
                    }}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <Table>
                  <TableHeader className="bg-white sticky top-0 dark:bg-zinc-900 z-10">
                    <TableRow>
                      <TableHead>
                        <div className="flex items-center cursor-pointer hover:text-zinc-900 dark:hover:text-zinc-100" onClick={() => handleSort('name', deptSort, setDeptSort)}>
                          Delivery Unit or Department <SortIcon sort={deptSort} sortKey="name" />
                        </div>
                      </TableHead>
                      <TableHead className="text-right">
                        <div className="flex items-center justify-end cursor-pointer hover:text-zinc-900 dark:hover:text-zinc-100" onClick={() => handleSort('completed', deptSort, setDeptSort)}>
                          Completed <SortIcon sort={deptSort} sortKey="completed" />
                        </div>
                      </TableHead>
                      <TableHead className="text-right">
                        <div className="flex items-center justify-end cursor-pointer hover:text-zinc-900 dark:hover:text-zinc-100" onClick={() => handleSort('notStarted', deptSort, setDeptSort)}>
                          Not Started <SortIcon sort={deptSort} sortKey="notStarted" />
                        </div>
                      </TableHead>
                      <TableHead className="text-right">
                        <div className="flex items-center justify-end cursor-pointer hover:text-zinc-900 dark:hover:text-zinc-100" onClick={() => handleSort('ongoing', deptSort, setDeptSort)}>
                          Ongoing <SortIcon sort={deptSort} sortKey="ongoing" />
                        </div>
                      </TableHead>
                      <TableHead className="text-right">
                        <div className="flex items-center justify-end cursor-pointer hover:text-zinc-900 dark:hover:text-zinc-100" onClick={() => handleSort('total', deptSort, setDeptSort)}>
                          Grand Total <SortIcon sort={deptSort} sortKey="total" />
                        </div>
                      </TableHead>
                      <TableHead className="text-right">
                        <div className="flex items-center justify-end cursor-pointer hover:text-zinc-900 dark:hover:text-zinc-100" onClick={() => handleSort('rate', deptSort, setDeptSort)}>
                          Completion % <SortIcon sort={deptSort} sortKey="rate" />
                        </div>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredDeptSummary.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="h-24 text-center text-zinc-500">No departments found matching your search.</TableCell>
                      </TableRow>
                    ) : (
                      applySort(filteredDeptSummary, deptSort).slice((deptPage - 1) * 10, deptPage * 10).map((row: any) => (
                        <TableRow key={row.name}>
                          <TableCell className="font-medium">{row.name}</TableCell>
                          <TableCell className="text-right text-green-600 font-semibold">{row.completed}</TableCell>
                          <TableCell className="text-right text-red-500">{row.notStarted ?? "-"}</TableCell>
                          <TableCell className="text-right text-blue-500">{row.ongoing ?? "-"}</TableCell>
                          <TableCell className="text-right font-bold">{row.total}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-3">
                              <span className="font-bold text-[#0046ab]">{row.rate}</span>
                              <div className="w-24 bg-zinc-100 rounded-full h-1.5 dark:bg-zinc-800">
                                <div className="bg-[#0046ab] h-1.5 rounded-full" style={{ width: row.rate }} />
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
              {filteredDeptSummary.length > 10 && (
                <div className="flex items-center justify-end space-x-2 pt-4">
                  <Button variant="outline" size="sm" onClick={() => setDeptPage(prev => Math.max(prev - 1, 1))} disabled={deptPage === 1}>
                    <ChevronLeft className="h-4 w-4 mr-1" /> Prev
                  </Button>
                  <div className="text-sm text-zinc-500 font-medium px-2">Page {deptPage} of {Math.ceil(filteredDeptSummary.length / 10)}</div>
                  <Button variant="outline" size="sm" onClick={() => setDeptPage(prev => Math.min(prev + 1, Math.ceil(filteredDeptSummary.length / 10)))} disabled={deptPage === Math.ceil(filteredDeptSummary.length / 10)}>
                    Next <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Output 3: Manager Completion */}
          <Card className="border-none shadow-sm">
            <CardHeader className="pb-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <UserCheck className="h-5 w-5 text-zinc-400" />
                  <CardTitle>Manager Completion</CardTitle>
                </div>
                <div className="relative w-full md:w-64">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-500" />
                  <Input
                    placeholder="Search manager..."
                    className="pl-9 h-9"
                    value={mgrSearch}
                    onChange={(e) => {
                      setMgrSearch(e.target.value)
                      setMgrPage(1)
                    }}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <Table>
                  <TableHeader className="bg-white sticky top-0 dark:bg-zinc-900 z-10">
                    <TableRow>
                      <TableHead>
                        <div className="flex items-center cursor-pointer hover:text-zinc-900 dark:hover:text-zinc-100" onClick={() => handleSort('name', mgrSort, setMgrSort)}>
                          Name of Immediate Supervisor <SortIcon sort={mgrSort} sortKey="name" />
                        </div>
                      </TableHead>
                      <TableHead className="text-right">
                        <div className="flex items-center justify-end cursor-pointer hover:text-zinc-900 dark:hover:text-zinc-100" onClick={() => handleSort('completed', mgrSort, setMgrSort)}>
                          Completed <SortIcon sort={mgrSort} sortKey="completed" />
                        </div>
                      </TableHead>
                      <TableHead className="text-right">
                        <div className="flex items-center justify-end cursor-pointer hover:text-zinc-900 dark:hover:text-zinc-100" onClick={() => handleSort('notStarted', mgrSort, setMgrSort)}>
                          Not Started <SortIcon sort={mgrSort} sortKey="notStarted" />
                        </div>
                      </TableHead>
                      <TableHead className="text-right">
                        <div className="flex items-center justify-end cursor-pointer hover:text-zinc-900 dark:hover:text-zinc-100" onClick={() => handleSort('ongoing', mgrSort, setMgrSort)}>
                          Ongoing <SortIcon sort={mgrSort} sortKey="ongoing" />
                        </div>
                      </TableHead>
                      <TableHead className="text-right">
                        <div className="flex items-center justify-end cursor-pointer hover:text-zinc-900 dark:hover:text-zinc-100" onClick={() => handleSort('total', mgrSort, setMgrSort)}>
                          Grand Total <SortIcon sort={mgrSort} sortKey="total" />
                        </div>
                      </TableHead>
                      <TableHead className="text-right">
                        <div className="flex items-center justify-end cursor-pointer hover:text-zinc-900 dark:hover:text-zinc-100" onClick={() => handleSort('rate', mgrSort, setMgrSort)}>
                          Completion % <SortIcon sort={mgrSort} sortKey="rate" />
                        </div>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMgrSummary.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="h-24 text-center text-zinc-500">No managers found matching your search.</TableCell>
                      </TableRow>
                    ) : (
                      applySort(filteredMgrSummary, mgrSort).slice((mgrPage - 1) * 10, mgrPage * 10).map((row: any) => (
                        <TableRow key={row.name}>
                          <TableCell className="font-medium">{row.name}</TableCell>
                          <TableCell className="text-right text-green-600 font-semibold">{row.completed}</TableCell>
                          <TableCell className="text-right text-red-500">{row.notStarted ?? "-"}</TableCell>
                          <TableCell className="text-right text-blue-500">{row.ongoing ?? "-"}</TableCell>
                          <TableCell className="text-right font-bold">{row.total}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-3">
                              <span className="font-bold text-[#0046ab]">{row.rate}</span>
                              <div className="w-24 bg-zinc-100 rounded-full h-1.5 dark:bg-zinc-800">
                                <div className="bg-[#0046ab] h-1.5 rounded-full" style={{ width: row.rate }} />
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
              {filteredMgrSummary.length > 10 && (
                <div className="flex items-center justify-end space-x-2 pt-4">
                  <Button variant="outline" size="sm" onClick={() => setMgrPage(prev => Math.max(prev - 1, 1))} disabled={mgrPage === 1}>
                    <ChevronLeft className="h-4 w-4 mr-1" /> Prev
                  </Button>
                  <div className="text-sm text-zinc-500 font-medium px-2">Page {mgrPage} of {Math.ceil(filteredMgrSummary.length / 10)}</div>
                  <Button variant="outline" size="sm" onClick={() => setMgrPage(prev => Math.min(prev + 1, Math.ceil(filteredMgrSummary.length / 10)))} disabled={mgrPage === Math.ceil(filteredMgrSummary.length / 10)}>
                    Next <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {selectedLog && selectedLog.importType === 'courses' && dashboardType === 'courses' && (
        <div className="space-y-6 animate-in fade-in duration-500">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-none shadow-sm bg-[#0046ab] text-white">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center">
                    <GraduationCap className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-white/60 text-xs font-bold uppercase">Total Courses Assigned</p>
                    <h3 className="text-2xl font-bold">
                      {(selectedLog.deptSummary as any[]).reduce((a, b) => a + (b.assigned || 0), 0).toLocaleString()}
                    </h3>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-none shadow-sm bg-green-600 text-white">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center">
                    <CheckCircle2 className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-white/60 text-xs font-bold uppercase">Total Courses Completed</p>
                    <h3 className="text-2xl font-bold">
                      {(selectedLog.deptSummary as any[]).reduce((a, b) => a + (b.completed || 0), 0).toLocaleString()}
                    </h3>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-none shadow-sm bg-zinc-900 text-white">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center">
                    <TrendingUp className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-white/60 text-xs font-bold uppercase">Overall Completion Rate</p>
                    <h3 className="text-2xl font-bold">
                      {((selectedLog.deptSummary as any[]).reduce((a, b) => a + (b.completed || 0), 0) /
                        ((selectedLog.deptSummary as any[]).reduce((a, b) => a + (b.assigned || 1), 0)) * 100).toFixed(1)}%
                    </h3>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="border-none shadow-sm">
            <CardHeader className="pb-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-zinc-400" />
                  <CardTitle>Department Analysis</CardTitle>
                </div>
                <div className="relative w-full md:w-64">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-500" />
                  <Input
                    placeholder="Search department..."
                    className="pl-9 h-9"
                    value={courseDeptSearch}
                    onChange={(e) => {
                      setCourseDeptSearch(e.target.value)
                      setCourseDeptPage(1)
                    }}
                  />
                </div>
              </div>
              <CardDescription>Sum of courses per Delivery Unit</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <Table>
                  <TableHeader className="bg-white sticky top-0 dark:bg-zinc-900 z-10">
                    <TableRow>
                      <TableHead>
                        <div className="flex items-center cursor-pointer hover:text-zinc-900 dark:hover:text-zinc-100" onClick={() => handleSort('name', courseDeptSort, setCourseDeptSort)}>
                          Department <SortIcon sort={courseDeptSort} sortKey="name" />
                        </div>
                      </TableHead>
                      <TableHead className="text-right">
                        <div className="flex items-center justify-end cursor-pointer hover:text-zinc-900 dark:hover:text-zinc-100" onClick={() => handleSort('assigned', courseDeptSort, setCourseDeptSort)}>
                          Sum of Assigned Courses <SortIcon sort={courseDeptSort} sortKey="assigned" />
                        </div>
                      </TableHead>
                      <TableHead className="text-right">
                        <div className="flex items-center justify-end cursor-pointer hover:text-zinc-900 dark:hover:text-zinc-100" onClick={() => handleSort('completed', courseDeptSort, setCourseDeptSort)}>
                          Sum of Completed Courses <SortIcon sort={courseDeptSort} sortKey="completed" />
                        </div>
                      </TableHead>
                      <TableHead className="text-right">
                        <div className="flex items-center justify-end cursor-pointer hover:text-zinc-900 dark:hover:text-zinc-100" onClick={() => handleSort('rate', courseDeptSort, setCourseDeptSort)}>
                          Completion Rate % <SortIcon sort={courseDeptSort} sortKey="rate" />
                        </div>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredDeptSummary.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="h-24 text-center text-zinc-500">No departments found matching your search.</TableCell>
                      </TableRow>
                    ) : (
                      applySort(filteredDeptSummary, courseDeptSort).slice((courseDeptPage - 1) * 10, courseDeptPage * 10).map((row: any) => (
                        <TableRow key={row.name}>
                          <TableCell className="font-medium">{row.name}</TableCell>
                          <TableCell className="text-right">{Number(row.assigned || 0).toLocaleString()}</TableCell>
                          <TableCell className="text-right text-green-600 font-semibold">{Number(row.completed || 0).toLocaleString()}</TableCell>
                          <TableCell className="text-right">
                            <Badge className="bg-[#0046ab] hover:bg-[#0046ab] font-mono">{row.rate}</Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
              {filteredDeptSummary.length > 10 && (
                <div className="flex items-center justify-end space-x-2 pt-4">
                  <Button variant="outline" size="sm" onClick={() => setCourseDeptPage(prev => Math.max(prev - 1, 1))} disabled={courseDeptPage === 1}>
                    <ChevronLeft className="h-4 w-4 mr-1" /> Prev
                  </Button>
                  <div className="text-sm text-zinc-500 font-medium px-2">Page {courseDeptPage} of {Math.ceil(filteredDeptSummary.length / 10)}</div>
                  <Button variant="outline" size="sm" onClick={() => setCourseDeptPage(prev => Math.min(prev + 1, Math.ceil(filteredDeptSummary.length / 10)))} disabled={courseDeptPage === Math.ceil(filteredDeptSummary.length / 10)}>
                    Next <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm">
            <CardHeader className="pb-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-zinc-400" />
                  <CardTitle>Employee Analysis</CardTitle>
                </div>
                <div className="relative w-full md:w-64">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-500" />
                  <Input
                    placeholder="Search employee..."
                    className="pl-9 h-9"
                    value={employeeSearch}
                    onChange={(e) => {
                      setEmployeeSearch(e.target.value)
                      setEmployeePage(1)
                    }}
                  />
                </div>
              </div>
              <CardDescription>Individual course completion performance</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <Table>
                  <TableHeader className="bg-white sticky top-0 dark:bg-zinc-900 z-10">
                    <TableRow>
                      <TableHead>
                        <div className="flex items-center cursor-pointer hover:text-zinc-900 dark:hover:text-zinc-100" onClick={() => handleSort('name', employeeSort, setEmployeeSort)}>
                          Employee Name <SortIcon sort={employeeSort} sortKey="name" />
                        </div>
                      </TableHead>
                      <TableHead className="text-right">
                        <div className="flex items-center justify-end cursor-pointer hover:text-zinc-900 dark:hover:text-zinc-100" onClick={() => handleSort('assigned', employeeSort, setEmployeeSort)}>
                          Sum of Assigned Courses <SortIcon sort={employeeSort} sortKey="assigned" />
                        </div>
                      </TableHead>
                      <TableHead className="text-right">
                        <div className="flex items-center justify-end cursor-pointer hover:text-zinc-900 dark:hover:text-zinc-100" onClick={() => handleSort('completed', employeeSort, setEmployeeSort)}>
                          Sum of Completed Courses <SortIcon sort={employeeSort} sortKey="completed" />
                        </div>
                      </TableHead>
                      <TableHead className="text-right">
                        <div className="flex items-center justify-end cursor-pointer hover:text-zinc-900 dark:hover:text-zinc-100" onClick={() => handleSort('rate', employeeSort, setEmployeeSort)}>
                          Completion Rate % <SortIcon sort={employeeSort} sortKey="rate" />
                        </div>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEmployeeSummary.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="h-24 text-center text-zinc-500">No employees found matching your search.</TableCell>
                      </TableRow>
                    ) : (
                      applySort(filteredEmployeeSummary, employeeSort).slice((employeePage - 1) * 10, employeePage * 10).map((row: any) => (
                        <TableRow key={row.name}>
                          <TableCell className="font-medium">{row.name}</TableCell>
                          <TableCell className="text-right">{Number(row.assigned || 0).toLocaleString()}</TableCell>
                          <TableCell className="text-right text-green-600 font-semibold">{Number(row.completed || 0).toLocaleString()}</TableCell>
                          <TableCell className="text-right font-bold text-[#0046ab]">{row.rate}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
              {filteredEmployeeSummary.length > 10 && (
                <div className="flex items-center justify-end space-x-2 pt-4">
                  <Button variant="outline" size="sm" onClick={() => setEmployeePage(prev => Math.max(prev - 1, 1))} disabled={employeePage === 1}>
                    <ChevronLeft className="h-4 w-4 mr-1" /> Prev
                  </Button>
                  <div className="text-sm text-zinc-500 font-medium px-2">Page {employeePage} of {Math.ceil(filteredEmployeeSummary.length / 10)}</div>
                  <Button variant="outline" size="sm" onClick={() => setEmployeePage(prev => Math.min(prev + 1, Math.ceil(filteredEmployeeSummary.length / 10)))} disabled={employeePage === Math.ceil(filteredEmployeeSummary.length / 10)}>
                    Next <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {selectedLog && selectedLog.importType === 'detailed_report' && dashboardType === 'detailed_report' && (
        <div className="space-y-6 animate-in fade-in duration-500">
          <Card className="border-none shadow-sm">
            <CardHeader className="pb-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <TableIcon className="h-5 w-5 text-zinc-400" />
                  <CardTitle>Completion Detailed Report</CardTitle>
                </div>
                <div className="relative w-full md:w-64">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-500" />
                  <Input
                    placeholder="Search User or Course..."
                    className="pl-9 h-9"
                    value={detailedSearch}
                    onChange={(e) => {
                      setDetailedSearch(e.target.value)
                      setDetailedPage(1)
                    }}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px]">
                <Table>
                  <TableHeader className="bg-white sticky top-0 dark:bg-zinc-900 z-10">
                    <TableRow>
                      <TableHead>
                        <div className="flex items-center cursor-pointer hover:text-zinc-900 dark:hover:text-zinc-100" onClick={() => handleSort('userName', detailedSort, setDetailedSort)}>
                          User Name <SortIcon sort={detailedSort} sortKey="userName" />
                        </div>
                      </TableHead>
                      <TableHead>
                        <div className="flex items-center cursor-pointer hover:text-zinc-900 dark:hover:text-zinc-100" onClick={() => handleSort('userStatus', detailedSort, setDetailedSort)}>
                          User Status <SortIcon sort={detailedSort} sortKey="userStatus" />
                        </div>
                      </TableHead>
                      <TableHead className="w-[300px]">
                        <div className="flex items-center cursor-pointer hover:text-zinc-900 dark:hover:text-zinc-100" onClick={() => handleSort('courseName', detailedSort, setDetailedSort)}>
                          Course Name <SortIcon sort={detailedSort} sortKey="courseName" />
                        </div>
                      </TableHead>
                      <TableHead>
                        <div className="flex items-center cursor-pointer hover:text-zinc-900 dark:hover:text-zinc-100" onClick={() => handleSort('courseStatus', detailedSort, setDetailedSort)}>
                          Course Status <SortIcon sort={detailedSort} sortKey="courseStatus" />
                        </div>
                      </TableHead>
                      <TableHead className="text-right">
                        <div className="flex items-center justify-end cursor-pointer hover:text-zinc-900 dark:hover:text-zinc-100" onClick={() => handleSort('completionPercentage', detailedSort, setDetailedSort)}>
                          Completion Percentage <SortIcon sort={detailedSort} sortKey="completionPercentage" />
                        </div>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredDetailedSummary.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="h-24 text-center text-zinc-500">No records found matching your search.</TableCell>
                      </TableRow>
                    ) : (
                      applySort(filteredDetailedSummary, detailedSort).slice((detailedPage - 1) * 20, detailedPage * 20).map((row: any, i: number) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium">{row.userName}</TableCell>
                          <TableCell>
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${row.userStatus?.toString().trim().toLowerCase() === 'active' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'}`}>
                              {row.userStatus}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="max-w-[300px] truncate" title={row.courseName}>
                              {row.courseName}
                            </div>
                          </TableCell>
                          <TableCell>{row.courseStatus}</TableCell>
                          <TableCell className="text-right font-medium">{row.completionPercentage}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
              {filteredDetailedSummary.length > 20 && (
                <div className="flex items-center justify-end space-x-2 pt-4">
                  <Button variant="outline" size="sm" onClick={() => setDetailedPage(prev => Math.max(prev - 1, 1))} disabled={detailedPage === 1}>
                    <ChevronLeft className="h-4 w-4 mr-1" /> Prev
                  </Button>
                  <div className="text-sm text-zinc-500 font-medium px-2">Page {detailedPage} of {Math.ceil(filteredDetailedSummary.length / 20)}</div>
                  <Button variant="outline" size="sm" onClick={() => setDetailedPage(prev => Math.min(prev + 1, Math.ceil(filteredDetailedSummary.length / 20)))} disabled={detailedPage === Math.ceil(filteredDetailedSummary.length / 20)}>
                    Next <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

