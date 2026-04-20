"use client"

import { useEffect, useState } from "react"
import {
  FileClock,
  Search,
  Calendar,
  FileSpreadsheet,
  Trash2,
  AlertTriangle,
  Eye,
  Database,
  ArrowLeftRight,
  Loader2
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
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/utils/supabase/client"

interface AuditLog {
  id: string
  batch_id?: string
  fileName: string
  date: string
  count: number
  importType?: 'status' | 'courses' | 'detailed_report'
  cleanedData?: any[]
  statusSummary?: any[]
  deptSummary?: any[]
  mgrSummary?: any[]
  employeeSummary?: any[]
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null)
  const [isViewOpen, setIsViewOpen] = useState(false)
  const [userRole, setUserRole] = useState<string | null>(null)

  useEffect(() => {
    const fetchLogsAndRole = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (user) {
        // Fetch Role
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("roles(name)")
          .eq("user_id", user.id)
          .single()

        if (roleData && (roleData as any).roles) {
          setUserRole((roleData as any).roles.name)
        } else {
          setUserRole("viewer")
        }
      }

      const { data, error } = await supabase.from('lms_batches').select('*').order('upload_timestamp', { ascending: false })
      if (data) {
        const parsed = data.map(b => {
          return {
            fileName: b.filename,
            importType: b.upload_type,
            date: new Date(b.upload_timestamp).toLocaleString(),
            count: b.records_imported,
            id: b.batch_id,
            batch_id: b.batch_id
          } as AuditLog
        })
        setLogs(parsed)
      } else if (error) {
        console.error("Failed to fetch history logs", error)
      }
    }
    fetchLogsAndRole()
  }, [])

  const handleDelete = async () => {
    if (!deleteId || userRole === "viewer") return
    const supabase = createClient()

    // Purge linked cascade constraints manually just in case
    await supabase.from('lms_assigned_courses').delete().eq('batch_id', deleteId)
    await supabase.from('lms_status_completion').delete().eq('batch_id', deleteId)
    await supabase.from('lms_detailed_report').delete().eq('batch_id', deleteId)
    // Purge the batch record itself
    await supabase.from('lms_batches').delete().eq('batch_id', deleteId)

    const updatedLogs = logs.filter(log => log.id !== deleteId)
    setLogs(updatedLogs)
    setDeleteId(null)
    toast.success("Log and underlying database records permanently removed")
  }

  const handleSetActive = (log: AuditLog, e: React.MouseEvent) => {
    e.stopPropagation()
    // Logic to set active data for LMS dashboard
    localStorage.setItem("lms_active_data", JSON.stringify(log))
    toast.success(`Dashboard data updated to: ${log.fileName}`)
  }

  const [isLoadingData, setIsLoadingData] = useState(false)

  const openLogDetails = async (log: AuditLog) => {
    setSelectedLog(log)
    setIsViewOpen(true)

    if (log.cleanedData) return

    setIsLoadingData(true)
    try {
      const supabase = createClient()
      let cleanedData: any[] = []

      if (log.importType === 'courses') {
        const { data } = await supabase.from('lms_assigned_courses').select('*').eq('batch_id', log.id)
        if (data) {
          cleanedData = data.map(row => ({
            id: row.id,
            Location: row.location,
            'User type': row.user_type,
            'Assigned Courses': row.assigned_courses,
            'Completed Courses': row.completed_courses,
            'Delivery Unit': row.delivery_unit,
            Name: row.name,
            'Name of Immediate Supervisor': row.immediate_supervisor
          }))
        }
      } else if (log.importType === 'status') {
        const { data } = await supabase.from('lms_status_completion').select('*').eq('batch_id', log.id)
        if (data) {
          cleanedData = data.map(row => ({
            id: row.id,
            Location: row.location,
            Role: row.role,
            Status: row.status,
            'Delivery Unit': row.delivery_unit,
            Name: row.name,
            'Name of Immediate Supervisor': row.immediate_supervisor
          }))
        }
      } else if (log.importType === 'detailed_report') {
        const { data } = await supabase.from('lms_detailed_report').select('*').eq('batch_id', log.id)
        if (data) {
          cleanedData = data.map(row => ({
            id: row.id,
            'User Name': row.user_name,
            'User Status': row.user_status,
            'Course Name': row.course_name,
            'Course Status': row.course_status,
            'Completion Percentage': `${row.completion_percentage}%`,
            'Delivery Unit or Department': row.delivery_unit_or_department,
            'Project Name': row.project_name,
            'Project Manager': row.project_manager,
            'Reporting Manager': row.reporting_manager
          }))
        }
      }

      setSelectedLog({ ...log, cleanedData })
      setLogs(prev => prev.map(l => l.id === log.id ? { ...l, cleanedData } : l))
    } catch (e) {
      console.error("Failed fetching data", e)
      toast.error("Failed to load historical records")
    } finally {
      setIsLoadingData(false)
    }
  }

  const filteredLogs = logs.filter(log =>
    log.fileName?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">History</h1>
          <p className="text-zinc-500 dark:text-zinc-400">View and manage uploaded LMS files</p>
        </div>
      </div>

      <Card className="border-none shadow-sm overflow-hidden">
        <CardHeader className="bg-white dark:bg-zinc-900 border-b pb-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileClock className="h-5 w-5 text-[#0046ab]" />
                Upload History
              </CardTitle>

            </div>
            <div className="relative w-full md:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-500" />
              <Input
                placeholder="Search logs..."
                className="pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filteredLogs.length === 0 ? (
            <div className="py-20 text-center space-y-3">
              <div className="h-12 w-12 rounded-full bg-zinc-50 flex items-center justify-center mx-auto">
                <Calendar className="h-6 w-6 text-zinc-300" />
              </div>
              <p className="text-zinc-500">No upload logs found.</p>
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-zinc-50 dark:bg-zinc-800">
                <TableRow>
                  <TableHead>File Name</TableHead>
                  <TableHead>Import Type</TableHead>
                  <TableHead>Upload Date</TableHead>
                  <TableHead className="text-right">Processed Records</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.map((log) => (
                  <TableRow
                    key={log.id}
                    className="cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                    onClick={() => openLogDetails(log)}
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <FileSpreadsheet className="h-4 w-4 text-[#0046ab]" />
                        {log.fileName}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={log.importType === 'detailed_report' ? "bg-emerald-50 text-emerald-700 border-emerald-200" : log.importType === 'courses' ? "bg-purple-50 text-purple-700 border-purple-200" : "bg-blue-50 text-blue-700 border-blue-200"}>
                        {log.importType === 'detailed_report' ? 'Status&Courses' : log.importType === 'courses' ? 'Courses' : 'Status'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-zinc-500 text-sm">{log.date}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{log.count.toLocaleString()}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-[#0046ab]"
                          title="Set as Active for Dashboard"
                          onClick={(e) => handleSetActive(log, e)}
                        >
                          <ArrowLeftRight className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-zinc-500"
                          onClick={(e) => {
                            e.stopPropagation();
                            openLogDetails(log);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {userRole !== "viewer" && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-red-500 hover:bg-red-50 hover:text-red-600"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteId(log.id);
                            }}
                            title="Delete Log"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Confirm Deletion
            </DialogTitle>
            <DialogDescription>
              This will remove this upload&apos;s data from the system and the dashboard.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete Log</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail View Modal */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-[95vw] w-[1400px] h-[90vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-0 shrink-0">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-[#0046ab] flex items-center justify-center shadow-md">
                <FileSpreadsheet className="h-6 w-6 text-white" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold">{selectedLog?.fileName}</DialogTitle>
                <DialogDescription className="flex items-center gap-4 mt-1">
                  <span className="flex items-center gap-1.5"><Calendar className="h-3 w-3" /> {selectedLog?.date}</span>
                  <span className="flex items-center gap-1.5"><Database className="h-3 w-3" /> {selectedLog?.count} Records</span>
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-hidden flex flex-col mt-6">
            <div className="px-6 border-b bg-zinc-50/50 dark:bg-zinc-900/50 shrink-0 py-3">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Cleaned Excel Data</h3>
            </div>

            <div className="flex-1 overflow-hidden">
              <ScrollArea className="h-full w-full">
                <div className="p-6">
                  {isLoadingData ? (
                    <div className="flex flex-col items-center justify-center h-full text-zinc-500 py-20">
                      <Loader2 className="h-10 w-10 animate-spin mb-4 text-[#0046ab]" />
                      <p className="font-medium animate-pulse text-[#0046ab]">Querying Supabase Records...</p>
                      <p className="text-sm mt-2 opacity-70">Please hold on while we securely fetch the batch data from your database.</p>
                    </div>
                  ) : selectedLog?.cleanedData ? (
                    <SheetDataTable data={selectedLog.cleanedData} />
                  ) : (
                    <div className="text-center py-20 text-zinc-400">
                      <FileSpreadsheet className="h-10 w-10 mx-auto mb-2 opacity-20" />
                      <p>No raw data available for this log. This might be an older log entry.</p>
                    </div>
                  )}
                </div>
                <ScrollBar orientation="horizontal" className="visible" />
                <ScrollBar orientation="vertical" />
              </ScrollArea>
            </div>
          </div>

          <DialogFooter className="p-4 border-t bg-zinc-50 dark:bg-zinc-900 flex items-center justify-between sm:justify-between shrink-0">
            <p className="text-xs text-zinc-500 font-medium italic">Showing cleaned data from Excel source.</p>
            <Button
              className="bg-[#0046ab] hover:bg-[#003a8f] text-white"
              onClick={() => {
                if (selectedLog) {
                  localStorage.setItem("lms_active_data", JSON.stringify(selectedLog))
                  toast.success("Updated dashboard data")
                }
              }}
            >
              <ArrowLeftRight className="h-4 w-4 mr-2" />
              Use for Dashboard
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function SheetDataTable({ data }: { data: any[] }) {
  if (!data || data.length === 0) return (
    <div className="text-center py-20 text-zinc-400">
      <FileSpreadsheet className="h-10 w-10 mx-auto mb-2 opacity-20" />
      <p>No data available.</p>
    </div>
  )

  const columns = Object.keys(data[0]).filter(k => k !== 'id')

  return (
    <div className="border rounded-lg bg-white dark:bg-zinc-950 min-w-max">
      <Table containerClassName="overflow-visible">
        <TableHeader className="bg-zinc-50 dark:bg-zinc-800 sticky top-0 z-10">
          <TableRow>
            {columns.map(col => (
              <TableHead key={col} className="whitespace-nowrap px-4 py-3 border-r last:border-r-0">{col}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row, idx) => (
            <TableRow key={idx}>
              {columns.map(col => (
                <TableCell key={`${idx}-${col}`} className="whitespace-nowrap px-4 py-3 border-r last:border-r-0">
                  {/status/i.test(col) ? (
                    <Badge variant="outline" className={row[col] === "Completed" || row[col]?.toString().trim().toLowerCase() === "active" ? "text-green-600 border-green-200 bg-green-50" : row[col] === "Ongoing" ? "text-blue-600 border-blue-200 bg-blue-50" : "text-red-600 border-red-200 bg-red-50"}>
                      {row[col]}
                    </Badge>
                  ) : (
                    String(row[col] ?? "-")
                  )}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
