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
  GraduationCap
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
  importType?: 'status' | 'courses'
  statusSummary?: SummaryItem[]
  deptSummary: any[]
  mgrSummary?: BreakoutItem[]
  employeeSummary?: CourseItem[]
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
  const [dashboardType, setDashboardType] = useState<'status' | 'courses'>('status')
  const [isLoading, setIsLoading] = useState(true)

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

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Completed": return "bg-green-500"
      case "Ongoing": return "bg-blue-500"
      case "Not Started": return "bg-red-500"
      default: return "bg-zinc-400"
    }
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
        <p className="text-zinc-500 max-w-sm">
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
        
        <div className="flex flex-col items-end gap-2">
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

      <Tabs value={dashboardType} onValueChange={(v) => setDashboardType(v as 'status' | 'courses')} className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="status" className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Status Completion
          </TabsTrigger>
          <TabsTrigger value="courses" className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4" />
            Assigned/Completed Courses
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {!selectedLog && (
        <Card className="border-none shadow-sm flex flex-col items-center justify-center py-20 text-center">
          <AlertCircle className="h-10 w-10 text-zinc-300 mb-4" />
          <h3 className="text-lg font-semibold">No {dashboardType === 'status' ? 'Status' : 'Courses'} logs found</h3>
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
                    {(selectedLog.statusSummary || []).map((row) => (
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
                    <PieChart data={selectedLog.statusSummary || []} />
                    <div className="absolute inset-12 bg-white rounded-full dark:bg-zinc-900 flex flex-col items-center justify-center shadow-sm border text-center">
                      <span className="text-2xl font-bold">
                        {(selectedLog.deptSummary as BreakoutItem[]).reduce((acc, curr) => acc + (curr.completed || 0), 0) / (selectedLog.count || 1) * 100 > 0 
                          ? (((selectedLog.deptSummary as BreakoutItem[]).reduce((acc, curr) => acc + (curr.completed || 0), 0) / (selectedLog.count || 1)) * 100).toFixed(1)
                          : "0.0"}%
                      </span>
                      <span className="text-[10px] text-zinc-400 uppercase font-bold leading-tight">Total<br/>Completion</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4 w-full pt-4 border-t">
                    {(selectedLog.statusSummary || []).map((s) => (
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
            <CardHeader>
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-zinc-400" />
                <CardTitle>Department Completion</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <Table>
                  <TableHeader className="bg-white sticky top-0 dark:bg-zinc-900 z-10">
                    <TableRow>
                      <TableHead>Delivery Unit / Department</TableHead>
                      <TableHead className="text-right">Completed</TableHead>
                      <TableHead className="text-right">Not Started</TableHead>
                      <TableHead className="text-right">Ongoing</TableHead>
                      <TableHead className="text-right">Grand Total</TableHead>
                      <TableHead className="text-right">Completion %</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(selectedLog.deptSummary as BreakoutItem[]).map((row) => (
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
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Output 3: Manager Completion */}
          <Card className="border-none shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-zinc-400" />
                <CardTitle>Manager Completion</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <Table>
                  <TableHeader className="bg-white sticky top-0 dark:bg-zinc-900 z-10">
                    <TableRow>
                      <TableHead>Name of Immediate Supervisor</TableHead>
                      <TableHead className="text-right">Completed</TableHead>
                      <TableHead className="text-right">Not Started</TableHead>
                      <TableHead className="text-right">Ongoing</TableHead>
                      <TableHead className="text-right">Grand Total</TableHead>
                      <TableHead className="text-right">Completion %</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(selectedLog.mgrSummary || []).map((row) => (
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
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
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
                      {(selectedLog.deptSummary as CourseItem[]).reduce((a, b) => a + (b.assigned || 0), 0).toLocaleString()}
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
                      {(selectedLog.deptSummary as CourseItem[]).reduce((a, b) => a + (b.completed || 0), 0).toLocaleString()}
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
                      {((selectedLog.deptSummary as CourseItem[]).reduce((a, b) => a + (b.completed || 0), 0) / 
                        ((selectedLog.deptSummary as CourseItem[]).reduce((a, b) => a + (b.assigned || 1), 0)) * 100).toFixed(1)}%
                    </h3>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="border-none shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-zinc-400" />
                <CardTitle>Department Analysis</CardTitle>
              </div>
              <CardDescription>Sum of courses per Delivery Unit</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <Table>
                  <TableHeader className="bg-white sticky top-0 dark:bg-zinc-900 z-10">
                    <TableRow>
                      <TableHead>Department</TableHead>
                      <TableHead className="text-right">Sum of Assigned Courses</TableHead>
                      <TableHead className="text-right">Sum of Completed Courses</TableHead>
                      <TableHead className="text-right">Completion Rate %</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(selectedLog.deptSummary as CourseItem[]).map((row) => (
                      <TableRow key={row.name}>
                        <TableCell className="font-medium">{row.name}</TableCell>
                        <TableCell className="text-right">{Number(row.assigned || 0).toLocaleString()}</TableCell>
                        <TableCell className="text-right text-green-600 font-semibold">{Number(row.completed || 0).toLocaleString()}</TableCell>
                        <TableCell className="text-right">
                          <Badge className="bg-[#0046ab] hover:bg-[#0046ab] font-mono">{row.rate}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-zinc-400" />
                <CardTitle>Employee Analysis</CardTitle>
              </div>
              <CardDescription>Individual course completion performance</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <Table>
                  <TableHeader className="bg-white sticky top-0 dark:bg-zinc-900 z-10">
                    <TableRow>
                      <TableHead>Employee Name</TableHead>
                      <TableHead className="text-right">Sum of Assigned Courses</TableHead>
                      <TableHead className="text-right">Sum of Completed Courses</TableHead>
                      <TableHead className="text-right">Completion Rate %</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(selectedLog.employeeSummary || []).map((row) => (
                      <TableRow key={row.name}>
                        <TableCell className="font-medium">{row.name}</TableCell>
                        <TableCell className="text-right">{Number(row.assigned || 0).toLocaleString()}</TableCell>
                        <TableCell className="text-right text-green-600 font-semibold">{Number(row.completed || 0).toLocaleString()}</TableCell>
                        <TableCell className="text-right font-bold text-[#0046ab]">{row.rate}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
