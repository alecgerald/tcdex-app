"use client"

import { useEffect, useState, useMemo } from "react"
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
  ChevronDown,
  BarChart3,
  Filter
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { utils, writeFile } from "xlsx"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import { createClient } from "@/utils/supabase/client"

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
  deptSummary?: any[]
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

        const color = slice.status === 'Completed' ? '#22c55e' : (slice.status === 'Ongoing' || slice.status === 'In Progress') ? '#3b82f6' : '#ef4444'
        return <path key={slice.status} d={pathData} fill={color} className="stroke-white stroke-[0.02]" />
      })}
    </svg>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="h-10 w-48 bg-zinc-200 dark:bg-zinc-800 rounded-md" />
          <div className="h-4 w-64 bg-zinc-100 dark:bg-zinc-900 rounded-md" />
        </div>
        <div className="h-10 w-32 bg-zinc-200 dark:bg-zinc-800 rounded-md" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-32 bg-white dark:bg-zinc-900 rounded-xl border" />
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1 h-[400px] bg-white dark:bg-zinc-900 rounded-xl border" />
        <div className="lg:col-span-2 h-[400px] bg-white dark:bg-zinc-900 rounded-xl border" />
      </div>
      
      <div className="h-[300px] bg-white dark:bg-zinc-900 rounded-xl border" />
    </div>
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

  // Status Tab internal toggle 
  const [completionTab, setCompletionTab] = useState<'department' | 'manager'>('department')

  // Courses Tab internal toggle
  const [coursesTab, setCoursesTab] = useState<'department' | 'employee'>('department')

  const [selectedStatusLocations, setSelectedStatusLocations] = useState<string[]>([])
  const [selectedStatusRoles, setSelectedStatusRoles] = useState<string[]>([])
  const [selectedStatusDUs, setSelectedStatusDUs] = useState<string[]>([])

  // Courses Filters states
  const [selectedCourseLocations, setSelectedCourseLocations] = useState<string[]>([])
  const [selectedCourseUserTypes, setSelectedCourseUserTypes] = useState<string[]>([])
  const [selectedCourseDUs, setSelectedCourseDUs] = useState<string[]>([])

  // Detailed Report states
  const [detailedSearch, setDetailedSearch] = useState("")
  const [detailedPage, setDetailedPage] = useState(1)
  const [detailedSort, setDetailedSort] = useState<SortConfig>(null)
  const [selectedCourseNames, setSelectedCourseNames] = useState<string[]>([])
  const [selectedCourseStatuses, setSelectedCourseStatuses] = useState<string[]>([])
  const [selectedDeliveryUnits, setSelectedDeliveryUnits] = useState<string[]>([])
  const [selectedUserStatuses, setSelectedUserStatuses] = useState<string[]>([])

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
    const loadData = async () => {
      const activeData = localStorage.getItem("lms_active_data")
      let parsedLogs: AuditLog[] = []

      try {
        const supabase = createClient()
        const { data: batches } = await supabase.from('lms_batches').select('*').order('upload_timestamp', { ascending: false })
        
        if (batches) {
          parsedLogs = batches.map(b => {
            return {
              id: String(b.batch_id),
              batch_id: String(b.batch_id),
              fileName: b.filename,
              date: new Date(b.upload_timestamp).toLocaleString(),
              count: b.records_imported,
              importType: b.upload_type as any
            }
          })
          
          // Explicitly clear aggregated hooks so all queries fetch completely from their distinct relational child tables
          parsedLogs = parsedLogs.map(l => ({ ...l, cleanedData: undefined, detailedSummary: undefined }))
        }
      } catch (err) {
        console.error("Failed to load database batches:", err)
      }

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
        const latestOfCurrentType = parsedLogs.find(l => (l.importType || 'status') === dashboardType)
        if (latestOfCurrentType) {
          setSelectedLogId(latestOfCurrentType.id)
        } else {
          setSelectedLogId(parsedLogs[0].id)
          setDashboardType(parsedLogs[0].importType || 'status')
        }
      }
      setIsLoading(false)
    }

    loadData()
  }, [])

  useEffect(() => {
    if (selectedLogId) {
      const log = logs.find(l => l.id === selectedLogId)
      if (log && !log.cleanedData) {
        const fetchData = async () => {
          setIsLoading(true)
          try {
            const supabase = createClient()
            if (dashboardType === 'courses') {
              const { data } = await supabase.from('lms_assigned_courses').select('*').eq('batch_id', selectedLogId)
              if (data) {
                const cleanedData = data.map(row => ({
                  id: row.id,
                  Location: row.location,
                  'User type': row.user_type,
                  'Assigned Courses': row.assigned_courses,
                  'Completed Courses': row.completed_courses,
                  'Delivery Unit': row.delivery_unit,
                  Name: row.name,
                  'Name of Immediate Supervisor': row.immediate_supervisor
                }))
                setLogs(prev => prev.map(l => l.id === selectedLogId ? { ...l, cleanedData } : l))
              }
            } else if (dashboardType === 'status') {
              const { data } = await supabase.from('lms_status_completion').select('*').eq('batch_id', selectedLogId)
              if (data) {
                const cleanedData = data.map(row => ({
                  id: row.id,
                  Location: row.location,
                  Role: row.role,
                  Status: row.status,
                  'Delivery Unit': row.delivery_unit,
                  Name: row.name,
                  'Name of Immediate Supervisor': row.immediate_supervisor
                }))
                setLogs(prev => prev.map(l => l.id === selectedLogId ? { ...l, cleanedData } : l))
              }
            } else if (dashboardType === 'detailed_report') {
              const { data } = await supabase.from('lms_detailed_report').select('*').eq('batch_id', selectedLogId)
              if (data) {
                const detailedSummary = data.map(row => ({
                  id: row.id,
                  userName: row.user_name,
                  userStatus: row.user_status,
                  courseName: row.course_name,
                  courseStatus: row.course_status,
                  completionPercentage: `${row.completion_percentage}%`,
                  deliveryUnit: row.delivery_unit_or_department,
                  projectName: row.project_name,
                  projectManager: row.project_manager,
                  reportingManager: row.reporting_manager
                }))
                setLogs(prev => prev.map(l => l.id === selectedLogId ? { ...l, cleanedData: detailedSummary, detailedSummary } : l))
              }
            }
          } catch (e) {
            console.error("Failed fetching detailed table data", e)
          } finally {
            setIsLoading(false)
          }
        }
        fetchData()
      }
    }
  }, [dashboardType, selectedLogId, logs])

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

  const uniqueStatusLocations = useMemo(() => {
    if (!selectedLog?.cleanedData || dashboardType !== 'status') return []
    const locs = new Set<string>()
    selectedLog.cleanedData.forEach((r: any) => locs.add(r['Location'] || "Unknown"))
    return Array.from(locs).sort()
  }, [selectedLog, dashboardType])

  const uniqueStatusRoles = useMemo(() => {
    if (!selectedLog?.cleanedData || dashboardType !== 'status') return []
    const roles = new Set<string>()
    selectedLog.cleanedData.forEach((r: any) => roles.add(r['Role'] || "Unknown"))
    return Array.from(roles).sort()
  }, [selectedLog, dashboardType])

  const uniqueStatusDUs = useMemo(() => {
    if (!selectedLog?.cleanedData || dashboardType !== 'status') return []
    const dus = new Set<string>()
    selectedLog.cleanedData.forEach((r: any) => dus.add(r['Delivery Unit'] || "Unknown"))
    return Array.from(dus).sort()
  }, [selectedLog, dashboardType])

  const activeStatusData = useMemo(() => {
    if (!selectedLog || !selectedLog.cleanedData) return []
    const data = selectedLog.cleanedData
    return data.filter((row: any) => {
      const loc = row['Location'] || "Unknown"
      const role = row['Role'] || "Unknown"
      const du = row['Delivery Unit'] || "Unknown"

      const locMatch = selectedStatusLocations.length === 0 || selectedStatusLocations.includes(loc)
      const roleMatch = selectedStatusRoles.length === 0 || selectedStatusRoles.includes(role)
      const duMatch = selectedStatusDUs.length === 0 || selectedStatusDUs.includes(du)

      return locMatch && roleMatch && duMatch
    })
  }, [selectedLog, selectedStatusLocations, selectedStatusRoles, selectedStatusDUs])

  const uniqueCourseLocations = useMemo(() => {
    if (!selectedLog || !selectedLog.cleanedData || dashboardType !== 'courses') return []
    const data = selectedLog.cleanedData
    const locs = new Set<string>()
    data.forEach((r: any) => locs.add(r['Location'] || "Unknown"))
    return Array.from(locs).sort()
  }, [selectedLog, dashboardType])

  const uniqueCourseUserTypes = useMemo(() => {
    if (!selectedLog || !selectedLog.cleanedData || dashboardType !== 'courses') return []
    const data = selectedLog.cleanedData
    const types = new Set<string>()
    data.forEach((r: any) => types.add(r['User type'] || r['Role'] || "Unknown"))
    return Array.from(types).sort()
  }, [selectedLog, dashboardType])

  const uniqueCourseDUs = useMemo(() => {
    if (!selectedLog || !selectedLog.cleanedData || dashboardType !== 'courses') return []
    const data = selectedLog.cleanedData
    const dus = new Set<string>()
    const k = Object.keys(data[0] || {}).find((k: string) => /delivery unit|department|dept/i.test(k)) || "Delivery Unit"
    data.forEach((r: any) => dus.add(r[k] || "Unknown"))
    return Array.from(dus).sort()
  }, [selectedLog, dashboardType])

  const activeCoursesData = useMemo(() => {
    if (!selectedLog?.cleanedData) return []
    const cleaned = selectedLog.cleanedData;
    return cleaned.filter((row: any) => {
      const loc = row['Location'] || "Unknown"
      const type = row['User type'] || row['Role'] || "Unknown"
      const k = Object.keys(cleaned[0] || {}).find((k: string) => /delivery unit|department|dept/i.test(k)) || "Delivery Unit"
      const du = row[k] || "Unknown"

      const locMatch = selectedCourseLocations.length === 0 || selectedCourseLocations.includes(loc)
      const typeMatch = selectedCourseUserTypes.length === 0 || selectedCourseUserTypes.includes(type)
      const duMatch = selectedCourseDUs.length === 0 || selectedCourseDUs.includes(du)

      return locMatch && typeMatch && duMatch
    })
  }, [selectedLog, selectedCourseLocations, selectedCourseUserTypes, selectedCourseDUs])

  const filteredDeptSummary = useMemo(() => {
    let baseData = selectedLog?.deptSummary || []
    
    if (dashboardType === 'status' && selectedLog?.cleanedData) {
      const depts: Record<string, any> = {}
      activeStatusData.forEach((row: any) => {
        const key = String(row['Delivery Unit'] || "Unknown")
        if (!depts[key]) depts[key] = { total: 0, completed: 0, ongoing: 0, notStarted: 0 }
        depts[key].total += 1
        const s = String(row['Status'] || row['status'] || "Not Started").toLowerCase()
        if (s.includes("completed")) depts[key].completed += 1
        else if (s.includes("ongoing") || s.includes("progress")) depts[key].ongoing += 1
        else depts[key].notStarted += 1
      })
      baseData = Object.entries(depts).map(([name, stats]: [string, any]) => ({
        name,
        total: stats.total,
        completed: stats.completed,
        ongoing: stats.ongoing,
        notStarted: stats.notStarted,
        rate: stats.total > 0 ? `${((stats.completed / stats.total) * 100).toFixed(1)}%` : "0.0%"
      })).sort((a: any, b: any) => b.name.localeCompare(a.name))
    } else if (dashboardType === 'courses' && selectedLog?.cleanedData) {
        const duKey = Object.keys(selectedLog?.cleanedData?.[0] || {}).find((k: string) => /delivery unit|department|dept/i.test(k)) || "Delivery Unit"
        const assignedKey = Object.keys(selectedLog?.cleanedData?.[0] || {}).find((k: string) => /assigned/i.test(k)) || "Assigned Courses"
        const completedKey = Object.keys(selectedLog?.cleanedData?.[0] || {}).find((k: string) => /completed/i.test(k) && !/status/i.test(k)) || "Completed Courses"
        
        const depts: Record<string, any> = {}
        activeCoursesData.forEach((row: any) => {
          const key = String(row[duKey] || "Unknown")
          if (!depts[key]) depts[key] = { name: key, assigned: 0, completed: 0 }
          depts[key].assigned += Number(row[assignedKey] || 0)
          depts[key].completed += Number(row[completedKey] || 0)
        })

        baseData = Object.entries(depts).map(([_, stats]: [string, any]) => ({
          ...stats,
          rate: stats.assigned > 0 ? `${((stats.completed / stats.assigned) * 100).toFixed(1)}%` : "0.0%"
        })).sort((a: any, b: any) => b.assigned - a.assigned)
    }
    
    return baseData.filter((item: any) =>
      item.name.toLowerCase().includes((dashboardType === 'status' ? deptSearch : courseDeptSearch).toLowerCase())
    )
  }, [selectedLog, activeStatusData, activeCoursesData, dashboardType, deptSearch, courseDeptSearch])

  const filteredMgrSummary = useMemo(() => {
    let baseData = selectedLog?.mgrSummary || []
    
    if (dashboardType === 'status' && selectedLog?.cleanedData) {
      const mgrs: Record<string, any> = {}
      activeStatusData.forEach((row: any) => {
        const key = String(row['Name of Immediate Supervisor'] || "Unknown")
        if (!mgrs[key]) mgrs[key] = { total: 0, completed: 0, ongoing: 0, notStarted: 0 }
        mgrs[key].total += 1
        const s = String(row['Status'] || row['status'] || "Not Started").toLowerCase()
        if (s.includes("completed")) mgrs[key].completed += 1
        else if (s.includes("ongoing") || s.includes("progress")) mgrs[key].ongoing += 1
        else mgrs[key].notStarted += 1
      })
      baseData = Object.entries(mgrs).map(([name, stats]: [string, any]) => ({
        name,
        total: stats.total,
        completed: stats.completed,
        ongoing: stats.ongoing,
        notStarted: stats.notStarted,
        rate: stats.total > 0 ? `${((stats.completed / stats.total) * 100).toFixed(1)}%` : "0.0%"
      })).sort((a: any, b: any) => b.name.localeCompare(a.name))
    }

    return baseData.filter((item: any) =>
      item.name.toLowerCase().includes(mgrSearch.toLowerCase())
    )
  }, [selectedLog, activeStatusData, dashboardType, mgrSearch])

  const filteredEmployeeSummary = useMemo(() => {
    let baseData = selectedLog?.employeeSummary || []
    
    if (dashboardType === 'courses' && selectedLog?.cleanedData) {
        const nameKey = Object.keys(selectedLog?.cleanedData?.[0] || {}).find((k: string) => /name/i.test(k) && !/manager|supervisor|unit/i.test(k)) || "Name"
        const assignedKey = Object.keys(selectedLog?.cleanedData?.[0] || {}).find((k: string) => /assigned/i.test(k)) || "Assigned Courses"
        const completedKey = Object.keys(selectedLog?.cleanedData?.[0] || {}).find((k: string) => /completed/i.test(k) && !/status/i.test(k)) || "Completed Courses"
        
        const employees: Record<string, any> = {}
        activeCoursesData.forEach((row: any) => {
          const key = String(row[nameKey] || "Unknown")
          if (!employees[key]) employees[key] = { name: key, assigned: 0, completed: 0 }
          employees[key].assigned += Number(row[assignedKey] || 0)
          employees[key].completed += Number(row[completedKey] || 0)
        })

        baseData = Object.entries(employees).map(([_, stats]: [string, any]) => ({
          ...stats,
          rate: stats.assigned > 0 ? `${((stats.completed / stats.assigned) * 100).toFixed(1)}%` : "0.0%"
        })).sort((a: any, b: any) => b.assigned - a.assigned)
    }

    return baseData.filter((item: any) =>
      item.name.toLowerCase().includes(employeeSearch.toLowerCase())
    )
  }, [selectedLog, activeCoursesData, dashboardType, employeeSearch])

  const courseCardsData = useMemo(() => {
    if (dashboardType !== 'courses') return { assigned: 0, completed: 0, rate: "0.0%" }
    // Calculate total aggregated summary from the fully filtered active subsets
    const assigned = filteredDeptSummary.reduce((a, b: any) => a + (b.assigned || 0), 0)
    const completed = filteredDeptSummary.reduce((a, b: any) => a + (b.completed || 0), 0)
    const rate = assigned > 0 ? ((completed / assigned) * 100).toFixed(1) : "0.0"
    return { assigned, completed, rate }
  }, [dashboardType, filteredDeptSummary])

  const dynamicStatusSummary = useMemo(() => {
    if ((selectedLog?.importType || 'status') !== 'status') return [];
    
    const activeData = completionTab === 'department' ? filteredDeptSummary : filteredMgrSummary;
    
    let completed = 0;
    let ongoing = 0;
    let notStarted = 0;
    
    activeData.forEach((item: any) => {
      completed += (item.completed || 0);
      ongoing += (item.ongoing || 0);
      notStarted += (item.notStarted || 0);
    });
    
    const total = completed + ongoing + notStarted;
    
    if (total === 0) return [];
    
    return [
      { status: 'Completed', count: completed, rate: ((completed / total) * 100).toFixed(1) + '%' },
      { status: 'Ongoing', count: ongoing, rate: ((ongoing / total) * 100).toFixed(1) + '%' },
      { status: 'Not Started', count: notStarted, rate: ((notStarted / total) * 100).toFixed(1) + '%' }
    ].filter(s => s.count > 0);
  }, [selectedLog, completionTab, filteredDeptSummary, filteredMgrSummary]);

  const dynamicTotalCount = useMemo(() => {
    return dynamicStatusSummary.reduce((acc, curr) => acc + curr.count, 0);
  }, [dynamicStatusSummary]);

  const uniqueCourseNames = useMemo(() => {
    if (!selectedLog?.detailedSummary) return []
    const names = new Set<string>()
    selectedLog.detailedSummary.forEach((r: any) => names.add(r.courseName))
    return Array.from(names).sort()
  }, [selectedLog])

  const uniqueCourseStatuses = useMemo(() => {
    if (!selectedLog?.detailedSummary) return []
    const statuses = new Set<string>()
    selectedLog.detailedSummary.forEach((r: any) => {
      statuses.add(String(r.courseStatus).toLowerCase().replace(/\s/g, '') === 'ongoing' ? 'In Progress' : r.courseStatus)
    })
    return Array.from(statuses).sort()
  }, [selectedLog])

  const uniqueDeliveryUnits = useMemo(() => {
    if (!selectedLog?.detailedSummary) return []
    const units = new Set<string>()
    selectedLog.detailedSummary.forEach((r: any) => units.add(r.deliveryUnit || "Unknown"))
    return Array.from(units).sort()
  }, [selectedLog])

  const uniqueUserStatuses = useMemo(() => {
    if (!selectedLog?.detailedSummary) return []
    const statuses = new Set<string>()
    selectedLog.detailedSummary.forEach((r: any) => statuses.add(r.userStatus || "Unknown"))
    return Array.from(statuses).sort()
  }, [selectedLog])

  const filteredDetailedSummary = (selectedLog?.detailedSummary || []).filter((item: any) => {
    const matchesSearch = item.userName.toLowerCase().includes(detailedSearch.toLowerCase()) ||
                          item.courseName.toLowerCase().includes(detailedSearch.toLowerCase())
    const matchesCourseName = selectedCourseNames.length === 0 || selectedCourseNames.includes(item.courseName)
    const matchesCourseStatus = selectedCourseStatuses.length === 0 || selectedCourseStatuses.includes(
      String(item.courseStatus).toLowerCase().replace(/\s/g, '') === 'ongoing' ? 'In Progress' : item.courseStatus
    )
    const matchesDeliveryUnit = selectedDeliveryUnits.length === 0 || selectedDeliveryUnits.includes(item.deliveryUnit || "Unknown")
    const matchesUserStatus = selectedUserStatuses.length === 0 || selectedUserStatuses.includes(item.userStatus || "Unknown")
    return matchesSearch && matchesCourseName && matchesCourseStatus && matchesDeliveryUnit && matchesUserStatus
  })

  const detailedStatusSummary = useMemo(() => {
    if (dashboardType !== 'detailed_report' || filteredDetailedSummary.length === 0) return []
    
    const counts: Record<string, number> = {}
    filteredDetailedSummary.forEach((row: any) => {
      // Check using correct casing
      const rawStatus = row.courseStatus ? String(row.courseStatus).trim() : "Not Started"
      const lower = rawStatus.toLowerCase().replace(/\s/g, '')
      let mapped = "Not Started"
      if (lower === 'completed') mapped = "Completed"
      else if (lower === 'ongoing' || lower === 'inprogress') mapped = "In Progress"
      
      counts[mapped] = (counts[mapped] || 0) + 1
    })

    const total = filteredDetailedSummary.length
    if (total === 0) return []

    return Object.entries(counts).map(([status, count]) => {
      const rate = (count / total) * 100
      return { status, count, rate: rate < 1 && rate > 0 ? "<1%" : `${rate.toFixed(1)}%` }
    }).sort((a, b) => b.status.localeCompare(a.status))
  }, [dashboardType, filteredDetailedSummary])

  const detailedCompletionRate = useMemo(() => {
    if (dashboardType !== 'detailed_report' || filteredDetailedSummary.length === 0) return "0.0"
    let completed = 0;
    filteredDetailedSummary.forEach((row: any) => {
      if (String(row.courseStatus).trim().toLowerCase() === 'completed' || String(row.completionPercentage).trim() === '100%') {
        completed += 1
      }
    })
    return ((completed / filteredDetailedSummary.length) * 100).toFixed(1)
  }, [dashboardType, filteredDetailedSummary])

  const dominantStatusRate = useMemo(() => {
    if (detailedStatusSummary.length === 0) return { rate: "0%", label: "Records" }
    const sorted = [...detailedStatusSummary].sort((a, b) => b.count - a.count)
    const top = sorted[0]
    return {
      rate: top.rate,
      label: top.status
    }
  }, [detailedStatusSummary])


  const getStatusColor = (status: string) => {
    switch (status) {
      case "Completed": return "bg-green-500"
      case "Ongoing":
      case "In Progress": return "bg-blue-500"
      case "Not Started": return "bg-red-500"
      default: return "bg-zinc-400"
    }
  }

  const handleDownloadExcel = () => {
    if (!selectedLog || !selectedLog.cleanedData) return

    let exportRecords = selectedLog.cleanedData;
    if (selectedLog.importType === 'detailed_report' && dashboardType === 'detailed_report') {
      exportRecords = filteredDetailedSummary;
    } else if (selectedLog.importType === 'status' && dashboardType === 'status') {
      exportRecords = activeStatusData;
    } else if (selectedLog.importType === 'courses' && dashboardType === 'courses') {
      exportRecords = activeCoursesData;
    }

    // Clean data for excel (remove the 'id' field we added during upload)
    const dataToExport = exportRecords.map(({ id, ...rest }: any) => {
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
        const total = dynamicStatusSummary.reduce((acc, curr) => acc + curr.count, 0)
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

              ; dynamicStatusSummary.forEach(slice => {
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
            const completionRate = dynamicTotalCount > 0 ? ((dynamicStatusSummary.find(s => s.status === 'Completed')?.count || 0) / dynamicTotalCount * 100).toFixed(1) : "0.0"
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
            ; dynamicStatusSummary.forEach(slice => {
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
        body: dynamicStatusSummary.map(s => [s.status, s.count, s.rate]),
        theme: 'striped',
        headStyles: { fillColor: [0, 70, 171] }
      })

      // Department Summary Table
      doc.text("Department Completion", 14, (doc as any).lastAutoTable.finalY + 15)

      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 20,
        head: [['Department', 'Completed', 'Not Started', 'Ongoing', 'Total', 'Rate']],
        body: filteredDeptSummary.map((d: any) => [
          d.name, d.completed, d.notStarted ?? 0, d.ongoing ?? 0, d.total, d.rate
        ]),
        theme: 'striped',
        headStyles: { fillColor: [0, 70, 171] }
      })

      // Manager Summary Table
      if (filteredMgrSummary && filteredMgrSummary.length > 0) {
        if ((doc as any).lastAutoTable.finalY + 40 > 280) doc.addPage()
        doc.text("Manager Completion", 14, (doc as any).lastAutoTable.finalY + 15)

        autoTable(doc, {
          startY: (doc as any).lastAutoTable.finalY + 20,
          head: [['Manager', 'Completed', 'Not Started', 'Ongoing', 'Total', 'Rate']],
          body: filteredMgrSummary.map((m: any) => [
            m.name, m.completed, m.notStarted ?? 0, m.ongoing ?? 0, m.total, m.rate
          ]),
          theme: 'striped',
          headStyles: { fillColor: [0, 70, 171] }
        })
      }
    } else if (selectedLog.importType === 'courses') {
      // Courses Analysis
      const totalAssigned = courseCardsData.assigned
      const totalCompleted = courseCardsData.completed
      const overallRate = courseCardsData.rate + "%"

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
        body: filteredDeptSummary.map((d: any) => [
          d.name, d.assigned.toLocaleString(), d.completed.toLocaleString(), d.rate
        ]),
        theme: 'striped',
        headStyles: { fillColor: [0, 70, 171] }
      })

      // Employee Analysis Table
      if (filteredEmployeeSummary && filteredEmployeeSummary.length > 0) {
        if ((doc as any).lastAutoTable.finalY + 40 > 280) doc.addPage()
        doc.text("Employee Analysis", 14, (doc as any).lastAutoTable.finalY + 15)

        autoTable(doc, {
          startY: (doc as any).lastAutoTable.finalY + 20,
          head: [['Employee Name', 'Assigned', 'Completed', 'Rate']],
          body: filteredEmployeeSummary.map((e: any) => [
            e.name, e.assigned.toLocaleString(), e.completed.toLocaleString(), e.rate
          ]),
          theme: 'striped',
          headStyles: { fillColor: [0, 70, 171] }
        })
      }
    } else if (selectedLog.importType === 'detailed_report') {
      let nextY = 35;

      try {
        const total = detailedStatusSummary.reduce((acc, curr) => acc + curr.count, 0)
        if (total > 0 && typeof document !== 'undefined') {
          const canvas = document.createElement('canvas')
          canvas.width = 1000
          canvas.height = 400
          const ctx = canvas.getContext('2d')
          if (ctx) {
            ctx.imageSmoothingEnabled = true;
            ctx.scale(2, 2); 

            let currentAngle = -0.5 * Math.PI
            const cx = 130, cy = 100, radius = 90

              ; detailedStatusSummary.forEach(slice => {
                const sliceAngle = (slice.count / total) * 2 * Math.PI
                ctx.beginPath()
                ctx.moveTo(cx, cy)
                ctx.arc(cx, cy, radius, currentAngle, currentAngle + sliceAngle)
                ctx.closePath()
                if (slice.status === 'Completed') ctx.fillStyle = '#22c55e'
                else if (slice.status === 'Ongoing' || slice.status === 'In Progress') ctx.fillStyle = '#3b82f6'
                else ctx.fillStyle = '#ef4444'
                ctx.fill()

                currentAngle += sliceAngle
              })

            // Cutout donut hole
            ctx.beginPath()
            ctx.arc(cx, cy, 55, 0, 2 * Math.PI)
            ctx.fillStyle = '#ffffff'
            ctx.fill()

            // Draw center text natively
            ctx.fillStyle = '#111827'
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            ctx.font = 'bold 28px sans-serif'
            ctx.fillText(`${dominantStatusRate.rate}`, cx, cy - 8)

            ctx.fillStyle = '#6b7280'
            ctx.font = 'bold 10px sans-serif'
            ctx.fillText(dominantStatusRate.label.toUpperCase(), cx, cy + 14)

            // Draw Legend natively onto the right side
            let legendY = 60;
            ; detailedStatusSummary.forEach(slice => {
              if (slice.status === 'Completed') ctx.fillStyle = '#22c55e'
              else if (slice.status === 'Ongoing' || slice.status === 'In Progress') ctx.fillStyle = '#3b82f6'
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
        body: detailedStatusSummary.map(s => [s.status, s.count, s.rate]),
        theme: 'striped',
        headStyles: { fillColor: [0, 70, 171] }
      })

      doc.setFontSize(14)
      const tableTitleY = (doc as any).lastAutoTable.finalY + 15;
      if (tableTitleY > 280) doc.addPage()
      doc.text("Detailed Report Snapshot", 14, tableTitleY)

      const recordsToPrint = filteredDetailedSummary.slice(0, 100)
      autoTable(doc, {
        startY: tableTitleY + 5,
        head: [['User Name', 'Delivery Unit', 'User Status', 'Course Name', 'Course Status', 'Completion %']],
        body: recordsToPrint.map(r => {
          const cStatus = String(r.courseStatus).toLowerCase().replace(/\s/g, '') === 'ongoing' ? 'In Progress' : r.courseStatus;
          const cPercent = String(r.completionPercentage || "0").trim().endsWith('%') ? r.completionPercentage : `${String(r.completionPercentage || "0").trim()}%`;
          return [
            r.userName,
            String(r.deliveryUnit || "Unknown").substring(0, 20) + (String(r.deliveryUnit || "Unknown").length > 20 ? '...' : ''),
            r.userStatus,
            r.courseName.substring(0, 30) + (r.courseName.length > 30 ? '...' : ''),
            cStatus,
            cPercent
          ]
        }),
        theme: 'striped',
        headStyles: { fillColor: [0, 70, 171] },
        styles: { fontSize: 8 }
      })
      if (filteredDetailedSummary.length > 100) {
        doc.text(`Note: Showing 100 out of ${filteredDetailedSummary.length} filtered records. Download Excel for full report.`, 14, (doc as any).lastAutoTable.finalY + 10)
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
    return <DashboardSkeleton />
  }

  if (logs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
        <div className="h-20 w-20 rounded-full bg-zinc-100 flex items-center justify-center dark:bg-zinc-800">
          <FileSpreadsheet className="h-10 w-10 text-zinc-400" />
        </div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">No Data Available</h1>
        <p className="text-zinc-500 max-sm">
          Please upload an Academy LMS Excel file in the <strong>Upload Excel</strong> section to generate the dashboard.
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
                    {dynamicStatusSummary.map((row) => (
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
                    <PieChart data={dynamicStatusSummary} />
                    <div className="absolute inset-12 bg-white rounded-full dark:bg-zinc-900 flex flex-col items-center justify-center shadow-sm border text-center">
                      <span className="text-2xl font-bold">
                        {dynamicTotalCount > 0
                          ? ((dynamicStatusSummary.find(s => s.status === 'Completed')?.count || 0) / dynamicTotalCount * 100).toFixed(1)
                          : "0.0"}%
                      </span>
                      <span className="text-[10px] text-zinc-400 uppercase font-bold leading-tight">Total<br />Completion</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4 w-full pt-4 border-t">
                    {dynamicStatusSummary.map((s) => (
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

          {/* Output 2 & 3: Switchable Completion Breakdown */}
          <Card className="border-none shadow-sm">
            <CardHeader className="pb-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-2 w-auto whitespace-nowrap">
                  {completionTab === 'department' ? (
                    <Building2 className="h-5 w-5 text-zinc-400" />
                  ) : (
                    <UserCheck className="h-5 w-5 text-zinc-400" />
                  )}
                  <CardTitle>Completion Breakdown</CardTitle>
                </div>
                
                <div className="flex flex-wrap items-center gap-3 w-full justify-end">
                  {/* Status Filters */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className={`h-9 border-dashed ${selectedStatusLocations.length > 0 ? "border-[#0046ab] bg-[#0046ab]/5 text-[#0046ab]" : ""}`}>
                        <Filter className="h-4 w-4 mr-2" />
                        Location {selectedStatusLocations.length > 0 && `(${selectedStatusLocations.length})`}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64 p-0" align="end">
                      <div className="p-3 border-b border-zinc-100 dark:border-zinc-800">
                        <h4 className="font-semibold text-sm">Filter Locations</h4>
                      </div>
                      <ScrollArea className="h-64">
                        <div className="p-3 space-y-3">
                          {uniqueStatusLocations.map((loc) => (
                            <div key={loc} className="flex flex-row items-start space-x-3">
                              <Checkbox 
                                id={`loc-${loc}`} 
                                checked={selectedStatusLocations.includes(loc)}
                                onCheckedChange={(checked) => setSelectedStatusLocations(prev => checked ? [...prev, loc] : prev.filter(v => v !== loc))}
                              />
                              <Label htmlFor={`loc-${loc}`} className="text-sm font-medium leading-none">{loc}</Label>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                      {selectedStatusLocations.length > 0 && (
                        <div className="p-2 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
                          <Button variant="ghost" size="sm" className="w-full text-xs h-7" onClick={() => setSelectedStatusLocations([])}>Clear</Button>
                        </div>
                      )}
                    </PopoverContent>
                  </Popover>

                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className={`h-9 border-dashed ${selectedStatusRoles.length > 0 ? "border-[#0046ab] bg-[#0046ab]/5 text-[#0046ab]" : ""}`}>
                        <Filter className="h-4 w-4 mr-2" />
                        Role {selectedStatusRoles.length > 0 && `(${selectedStatusRoles.length})`}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64 p-0" align="end">
                      <div className="p-3 border-b border-zinc-100 dark:border-zinc-800">
                        <h4 className="font-semibold text-sm">Filter Roles</h4>
                      </div>
                      <ScrollArea className="h-64">
                        <div className="p-3 space-y-3">
                          {uniqueStatusRoles.map((role) => (
                            <div key={role} className="flex flex-row items-start space-x-3">
                              <Checkbox 
                                id={`role-${role}`} 
                                checked={selectedStatusRoles.includes(role)}
                                onCheckedChange={(checked) => setSelectedStatusRoles(prev => checked ? [...prev, role] : prev.filter(v => v !== role))}
                              />
                              <Label htmlFor={`role-${role}`} className="text-sm font-medium leading-none">{role}</Label>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                      {selectedStatusRoles.length > 0 && (
                        <div className="p-2 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
                          <Button variant="ghost" size="sm" className="w-full text-xs h-7" onClick={() => setSelectedStatusRoles([])}>Clear</Button>
                        </div>
                      )}
                    </PopoverContent>
                  </Popover>

                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className={`h-9 border-dashed ${selectedStatusDUs.length > 0 ? "border-[#0046ab] bg-[#0046ab]/5 text-[#0046ab]" : ""}`}>
                        <Filter className="h-4 w-4 mr-2" />
                        Delivery Unit {selectedStatusDUs.length > 0 && `(${selectedStatusDUs.length})`}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64 p-0" align="end">
                      <div className="p-3 border-b border-zinc-100 dark:border-zinc-800">
                        <h4 className="font-semibold text-sm">Filter Delivery Units</h4>
                      </div>
                      <ScrollArea className="h-64">
                        <div className="p-3 space-y-3">
                          {uniqueStatusDUs.map((du) => (
                            <div key={du} className="flex flex-row items-start space-x-3">
                              <Checkbox 
                                id={`du-${du}`} 
                                checked={selectedStatusDUs.includes(du)}
                                onCheckedChange={(checked) => setSelectedStatusDUs(prev => checked ? [...prev, du] : prev.filter(v => v !== du))}
                              />
                              <Label htmlFor={`du-${du}`} className="text-sm font-medium leading-none">{du}</Label>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                      {selectedStatusDUs.length > 0 && (
                        <div className="p-2 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
                          <Button variant="ghost" size="sm" className="w-full text-xs h-7" onClick={() => setSelectedStatusDUs([])}>Clear</Button>
                        </div>
                      )}
                    </PopoverContent>
                  </Popover>

                  <div className="h-6 w-px bg-zinc-200 dark:bg-zinc-800 mx-1 hidden md:block"></div>

                  <Tabs value={completionTab} onValueChange={(v) => setCompletionTab(v as 'department' | 'manager')} className="w-full sm:w-auto">
                    <TabsList className="h-9 w-full grid grid-cols-2">
                      <TabsTrigger value="department" className="text-xs px-3">Department</TabsTrigger>
                      <TabsTrigger value="manager" className="text-xs px-3">Manager</TabsTrigger>
                    </TabsList>
                  </Tabs>
                  
                  <div className="relative w-full md:w-56">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-500" />
                    <Input
                      placeholder={completionTab === 'department' ? "Search department..." : "Search manager..."}
                      className="pl-9 h-9 w-full"
                      value={completionTab === 'department' ? deptSearch : mgrSearch}
                      onChange={(e) => {
                        if (completionTab === 'department') {
                          setDeptSearch(e.target.value)
                          setDeptPage(1)
                        } else {
                          setMgrSearch(e.target.value)
                          setMgrPage(1)
                        }
                      }}
                    />
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {completionTab === 'department' && (
              <>
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
                            <span className="font-bold text-[#0046ab]">{row.rate}</span>
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
              </>
              )}

              {completionTab === 'manager' && (
              <>
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
                            <span className="font-bold text-[#0046ab]">{row.rate}</span>
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
              </>
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
                      {courseCardsData.assigned.toLocaleString()}
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
                      {courseCardsData.completed.toLocaleString()}
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
                      {courseCardsData.rate}%
                    </h3>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="border-none shadow-sm">
            <CardHeader className="pb-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-2 w-auto whitespace-nowrap">
                  {coursesTab === 'department' ? (
                    <Building2 className="h-5 w-5 text-zinc-400" />
                  ) : (
                    <Users className="h-5 w-5 text-zinc-400" />
                  )}
                  <CardTitle>Course Analysis</CardTitle>
                </div>
                
                <div className="flex flex-wrap items-center gap-3 w-full justify-end">
                  {/* Course Filters */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className={`h-9 border-dashed ${selectedCourseLocations.length > 0 ? "border-[#0046ab] bg-[#0046ab]/5 text-[#0046ab]" : ""}`}>
                        <Filter className="h-4 w-4 mr-2" />
                        Location {selectedCourseLocations.length > 0 && `(${selectedCourseLocations.length})`}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64 p-0" align="end">
                      <div className="p-3 border-b border-zinc-100 dark:border-zinc-800">
                        <h4 className="font-semibold text-sm">Filter Locations</h4>
                      </div>
                      <ScrollArea className="h-64">
                        <div className="p-3 space-y-3">
                          {uniqueCourseLocations.map((loc) => (
                            <div key={loc} className="flex flex-row items-start space-x-3">
                              <Checkbox 
                                id={`cloc-${loc}`} 
                                checked={selectedCourseLocations.includes(loc)}
                                onCheckedChange={(checked) => setSelectedCourseLocations(prev => checked ? [...prev, loc] : prev.filter(v => v !== loc))}
                              />
                              <Label htmlFor={`cloc-${loc}`} className="text-sm font-medium leading-none">{loc}</Label>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                      {selectedCourseLocations.length > 0 && (
                        <div className="p-2 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
                          <Button variant="ghost" size="sm" className="w-full text-xs h-7" onClick={() => setSelectedCourseLocations([])}>Clear</Button>
                        </div>
                      )}
                    </PopoverContent>
                  </Popover>

                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className={`h-9 border-dashed ${selectedCourseUserTypes.length > 0 ? "border-[#0046ab] bg-[#0046ab]/5 text-[#0046ab]" : ""}`}>
                        <Filter className="h-4 w-4 mr-2" />
                        User Type {selectedCourseUserTypes.length > 0 && `(${selectedCourseUserTypes.length})`}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64 p-0" align="end">
                      <div className="p-3 border-b border-zinc-100 dark:border-zinc-800">
                        <h4 className="font-semibold text-sm">Filter User Types</h4>
                      </div>
                      <ScrollArea className="h-64">
                        <div className="p-3 space-y-3">
                          {uniqueCourseUserTypes.map((type) => (
                            <div key={type} className="flex flex-row items-start space-x-3">
                              <Checkbox 
                                id={`ctype-${type}`} 
                                checked={selectedCourseUserTypes.includes(type)}
                                onCheckedChange={(checked) => setSelectedCourseUserTypes(prev => checked ? [...prev, type] : prev.filter(v => v !== type))}
                              />
                              <Label htmlFor={`ctype-${type}`} className="text-sm font-medium leading-none">{type}</Label>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                      {selectedCourseUserTypes.length > 0 && (
                        <div className="p-2 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
                          <Button variant="ghost" size="sm" className="w-full text-xs h-7" onClick={() => setSelectedCourseUserTypes([])}>Clear</Button>
                        </div>
                      )}
                    </PopoverContent>
                  </Popover>

                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className={`h-9 border-dashed ${selectedCourseDUs.length > 0 ? "border-[#0046ab] bg-[#0046ab]/5 text-[#0046ab]" : ""}`}>
                        <Filter className="h-4 w-4 mr-2" />
                        Delivery Unit {selectedCourseDUs.length > 0 && `(${selectedCourseDUs.length})`}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64 p-0" align="end">
                      <div className="p-3 border-b border-zinc-100 dark:border-zinc-800">
                        <h4 className="font-semibold text-sm">Filter Delivery Units</h4>
                      </div>
                      <ScrollArea className="h-64">
                        <div className="p-3 space-y-3">
                          {uniqueCourseDUs.map((du) => (
                            <div key={du} className="flex flex-row items-start space-x-3">
                              <Checkbox 
                                id={`cdu-${du}`} 
                                checked={selectedCourseDUs.includes(du)}
                                onCheckedChange={(checked) => setSelectedCourseDUs(prev => checked ? [...prev, du] : prev.filter(v => v !== du))}
                              />
                              <Label htmlFor={`cdu-${du}`} className="text-sm font-medium leading-none">{du}</Label>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                      {selectedCourseDUs.length > 0 && (
                        <div className="p-2 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
                          <Button variant="ghost" size="sm" className="w-full text-xs h-7" onClick={() => setSelectedCourseDUs([])}>Clear</Button>
                        </div>
                      )}
                    </PopoverContent>
                  </Popover>

                  <div className="h-6 w-px bg-zinc-200 dark:bg-zinc-800 mx-1 hidden md:block"></div>

                  <Tabs value={coursesTab} onValueChange={(v) => setCoursesTab(v as 'department' | 'employee')} className="w-full sm:w-auto">
                    <TabsList className="h-9 w-full grid grid-cols-2">
                      <TabsTrigger value="department" className="text-xs px-3">Department</TabsTrigger>
                      <TabsTrigger value="employee" className="text-xs px-3">Employee</TabsTrigger>
                    </TabsList>
                  </Tabs>
                  <div className="relative w-full md:w-64">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-500" />
                    <Input
                      placeholder={coursesTab === 'department' ? "Search department..." : "Search employee..."}
                      className="pl-9 h-9 w-full"
                      value={coursesTab === 'department' ? courseDeptSearch : employeeSearch}
                      onChange={(e) => {
                        if (coursesTab === 'department') {
                          setCourseDeptSearch(e.target.value)
                          setCourseDeptPage(1)
                        } else {
                          setEmployeeSearch(e.target.value)
                          setEmployeePage(1)
                        }
                      }}
                    />
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {coursesTab === 'department' && (
              <>
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
                            <TableCell className="text-right font-bold text-[#0046ab]">{row.rate}</TableCell>
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
              </>
              )}

              {coursesTab === 'employee' && (
              <>
                <ScrollArea className="h-[400px]">
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
              </>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {selectedLog && selectedLog.importType === 'detailed_report' && dashboardType === 'detailed_report' && (
        <div className="space-y-6 animate-in fade-in duration-500">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="border-none shadow-sm">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-zinc-400" />
                  <CardTitle>Status Distribution</CardTitle>
                </div>
                <CardDescription>Overview of all course completions</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader className="bg-zinc-50 dark:bg-zinc-800/50">
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Count</TableHead>
                      <TableHead className="text-right">Percentage (%)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detailedStatusSummary.map((row) => (
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
                    <PieChart data={detailedStatusSummary} />
                    <div className="absolute inset-12 bg-white rounded-full dark:bg-zinc-900 flex flex-col items-center justify-center shadow-sm border text-center">
                      <span className="text-2xl font-bold">{dominantStatusRate.rate}</span>
                      <span className="text-[10px] text-zinc-400 uppercase font-bold leading-tight px-2">{dominantStatusRate.label}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4 w-full pt-4 border-t">
                    {detailedStatusSummary.map((s) => (
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
              <ScrollArea className="h-[500px] w-full">
                <Table>
                  <TableHeader className="bg-white sticky top-0 dark:bg-zinc-900 z-10">
                    <TableRow>
                      <TableHead>
                        <div className="flex items-center cursor-pointer hover:text-zinc-900 dark:hover:text-zinc-100" onClick={() => handleSort('userName', detailedSort, setDetailedSort)}>
                          User Name <SortIcon sort={detailedSort} sortKey="userName" />
                        </div>
                      </TableHead>
                      <TableHead>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center cursor-pointer hover:text-zinc-900 dark:hover:text-zinc-100" onClick={() => handleSort('deliveryUnit', detailedSort, setDetailedSort)}>
                            Delivery Unit <SortIcon sort={detailedSort} sortKey="deliveryUnit" />
                          </div>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <Filter className={`h-4 w-4 ${selectedDeliveryUnits.length > 0 ? "text-[#0046ab]" : "text-zinc-400"}`} />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-72 p-0" align="start">
                              <div className="p-3 border-b border-zinc-100 dark:border-zinc-800">
                                <h4 className="font-semibold text-sm">Filter Delivery Units</h4>
                              </div>
                              <ScrollArea className="h-64">
                                <div className="p-3 space-y-3">
                                  {uniqueDeliveryUnits.map((du) => (
                                    <div key={du} className="flex flex-row items-start space-x-3">
                                      <Checkbox 
                                        id={`du-${du}`} 
                                        checked={selectedDeliveryUnits.includes(du)}
                                        onCheckedChange={(checked) => {
                                          setSelectedDeliveryUnits(prev => checked ? [...prev, du] : prev.filter(v => v !== du))
                                        }}
                                      />
                                      <Label htmlFor={`du-${du}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">{du}</Label>
                                    </div>
                                  ))}
                                </div>
                              </ScrollArea>
                              {selectedDeliveryUnits.length > 0 && (
                                <div className="p-2 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
                                  <Button variant="ghost" size="sm" className="w-full text-xs h-7" onClick={() => setSelectedDeliveryUnits([])}>Clear Filters</Button>
                                </div>
                              )}
                            </PopoverContent>
                          </Popover>
                        </div>
                      </TableHead>
                      <TableHead>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center cursor-pointer hover:text-zinc-900 dark:hover:text-zinc-100" onClick={() => handleSort('userStatus', detailedSort, setDetailedSort)}>
                            User Status <SortIcon sort={detailedSort} sortKey="userStatus" />
                          </div>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <Filter className={`h-4 w-4 ${selectedUserStatuses.length > 0 ? "text-[#0046ab]" : "text-zinc-400"}`} />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-56 p-0" align="start">
                              <div className="p-3 border-b border-zinc-100 dark:border-zinc-800">
                                <h4 className="font-semibold text-sm">Filter User Status</h4>
                              </div>
                              <div className="p-3 space-y-3">
                                {uniqueUserStatuses.map((us) => (
                                  <div key={us} className="flex flex-row items-center space-x-3">
                                    <Checkbox 
                                      id={`us-${us}`} 
                                      checked={selectedUserStatuses.includes(us)}
                                      onCheckedChange={(checked) => {
                                        setSelectedUserStatuses(prev => checked ? [...prev, us] : prev.filter(v => v !== us))
                                      }}
                                    />
                                    <Label htmlFor={`us-${us}`} className="text-sm font-medium leading-none">{us}</Label>
                                  </div>
                                ))}
                              </div>
                              {selectedUserStatuses.length > 0 && (
                                <div className="p-2 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
                                  <Button variant="ghost" size="sm" className="w-full text-xs h-7" onClick={() => setSelectedUserStatuses([])}>Clear Filters</Button>
                                </div>
                              )}
                            </PopoverContent>
                          </Popover>
                        </div>
                      </TableHead>
                      <TableHead className="w-[350px]">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center cursor-pointer hover:text-zinc-900 dark:hover:text-zinc-100" onClick={() => handleSort('courseName', detailedSort, setDetailedSort)}>
                            Course Name <SortIcon sort={detailedSort} sortKey="courseName" />
                          </div>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <Filter className={`h-4 w-4 ${selectedCourseNames.length > 0 ? "text-[#0046ab]" : "text-zinc-400"}`} />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-72 p-0" align="start">
                              <div className="p-3 border-b border-zinc-100 dark:border-zinc-800">
                                <h4 className="font-semibold text-sm">Filter Course Names</h4>
                              </div>
                              <ScrollArea className="h-64">
                                <div className="p-3 space-y-3">
                                  {uniqueCourseNames.map((cn) => (
                                    <div key={cn} className="flex flex-row items-start space-x-3">
                                      <Checkbox 
                                        id={`cn-${cn}`} 
                                        checked={selectedCourseNames.includes(cn)}
                                        onCheckedChange={(checked) => {
                                          setSelectedCourseNames(prev => checked ? [...prev, cn] : prev.filter(v => v !== cn))
                                        }}
                                      />
                                      <Label htmlFor={`cn-${cn}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">{cn}</Label>
                                    </div>
                                  ))}
                                </div>
                              </ScrollArea>
                              {selectedCourseNames.length > 0 && (
                                <div className="p-2 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
                                  <Button variant="ghost" size="sm" className="w-full text-xs h-7" onClick={() => setSelectedCourseNames([])}>Clear Filters</Button>
                                </div>
                              )}
                            </PopoverContent>
                          </Popover>
                        </div>
                      </TableHead>
                      <TableHead>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center cursor-pointer hover:text-zinc-900 dark:hover:text-zinc-100" onClick={() => handleSort('courseStatus', detailedSort, setDetailedSort)}>
                            Course Status <SortIcon sort={detailedSort} sortKey="courseStatus" />
                          </div>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <Filter className={`h-4 w-4 ${selectedCourseStatuses.length > 0 ? "text-[#0046ab]" : "text-zinc-400"}`} />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-56 p-0" align="start">
                              <div className="p-3 border-b border-zinc-100 dark:border-zinc-800">
                                <h4 className="font-semibold text-sm">Filter Status</h4>
                              </div>
                              <div className="p-3 space-y-3">
                                {uniqueCourseStatuses.map((cs) => (
                                  <div key={cs} className="flex flex-row items-center space-x-3">
                                    <Checkbox 
                                      id={`cs-${cs}`} 
                                      checked={selectedCourseStatuses.includes(cs)}
                                      onCheckedChange={(checked) => {
                                        setSelectedCourseStatuses(prev => checked ? [...prev, cs] : prev.filter(v => v !== cs))
                                      }}
                                    />
                                    <Label htmlFor={`cs-${cs}`} className="text-sm font-medium leading-none">{cs}</Label>
                                  </div>
                                ))}
                              </div>
                              {selectedCourseStatuses.length > 0 && (
                                <div className="p-2 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
                                  <Button variant="ghost" size="sm" className="w-full text-xs h-7" onClick={() => setSelectedCourseStatuses([])}>Clear Filters</Button>
                                </div>
                              )}
                            </PopoverContent>
                          </Popover>
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
                        <TableCell colSpan={6} className="h-24 text-center text-zinc-500">No records found matching your search.</TableCell>
                      </TableRow>
                    ) : (
                      applySort(filteredDetailedSummary, detailedSort).slice((detailedPage - 1) * 10, detailedPage * 10).map((row: any, i: number) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium">{row.userName}</TableCell>
                          <TableCell className="text-zinc-500">{row.deliveryUnit}</TableCell>
                          <TableCell>
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${String(row.userStatus).trim().toLowerCase() === 'active' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'}`}>
                              {row.userStatus}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="max-w-[300px] truncate" title={row.courseName}>
                              {row.courseName}
                            </div>
                          </TableCell>
                          <TableCell>
                            {String(row.courseStatus).toLowerCase().replace(/\s/g, '') === 'ongoing' ? 'In Progress' : row.courseStatus}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {String(row.completionPercentage || "0").trim().endsWith('%') ? row.completionPercentage : `${String(row.completionPercentage || "0").trim()}%`}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
              {filteredDetailedSummary.length > 10 && (
                <div className="flex items-center justify-end space-x-2 pt-4">
                  <Button variant="outline" size="sm" onClick={() => setDetailedPage(prev => Math.max(prev - 1, 1))} disabled={detailedPage === 1}>
                    <ChevronLeft className="h-4 w-4 mr-1" /> Prev
                  </Button>
                  <div className="text-sm text-zinc-500 font-medium px-2">Page {detailedPage} of {Math.ceil(filteredDetailedSummary.length / 10)}</div>
                  <Button variant="outline" size="sm" onClick={() => setDetailedPage(prev => Math.min(prev + 1, Math.ceil(filteredDetailedSummary.length / 10)))} disabled={detailedPage === Math.ceil(filteredDetailedSummary.length / 10)}>
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

