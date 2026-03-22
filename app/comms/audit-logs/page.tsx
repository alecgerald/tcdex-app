"use client"

import { useEffect, useState } from "react"
import { 
  FileClock, 
  FileSpreadsheet, 
  Eye, 
  Trash2, 
  Database, 
  Calendar,
  ChevronRight,
  ArrowLeftRight,
  ExternalLink,
  Search
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"

interface CommsLog {
  id: string
  fileName: string
  uploadedAt: string
  newFollowers: any[]
  location: any[]
  jobFunction: any[]
  seniority: any[]
  industry: any[]
  companySize: any[]
}

export default function CommsAuditLogsPage() {
  const [logs, setLogs] = useState<CommsLog[]>([])
  const [selectedLog, setSelectedLog] = useState<CommsLog | null>(null)
  const [isViewOpen, setIsViewOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")

  useEffect(() => {
    const savedLogs = localStorage.getItem("comms_audit_logs")
    if (savedLogs) {
      try {
        setLogs(JSON.parse(savedLogs))
      } catch (e) {
        console.error("Failed to parse logs", e)
      }
    }
  }, [])

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const updatedLogs = logs.filter(log => log.id !== id)
    setLogs(updatedLogs)
    localStorage.setItem("comms_audit_logs", JSON.stringify(updatedLogs))
    toast.success("Log deleted successfully")
  }

  const handleSetActive = (log: CommsLog, e: React.MouseEvent) => {
    e.stopPropagation()
    localStorage.setItem("comms_linkedin_data", JSON.stringify(log))
    toast.success(`Dashboard data updated to: ${log.fileName}`)
  }

  const openLogDetails = (log: CommsLog) => {
    setSelectedLog(log)
    setIsViewOpen(true)
  }

  const filteredLogs = logs.filter(log => 
    log.fileName?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getDateRange = (log: CommsLog) => {
    if (!log.newFollowers || log.newFollowers.length === 0) return "N/A"
    const dates = log.newFollowers.map(r => r.Date).filter(Boolean)
    if (dates.length === 0) return "N/A"
    return `${dates[0]} - ${dates[dates.length - 1]}`
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">Comms Audit Logs</h1>
          <p className="text-zinc-500 dark:text-zinc-400">History of LinkedIn data uploads and raw data preview</p>
        </div>
        <div className="relative w-full md:w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-500" />
          <Input 
            placeholder="Search files..." 
            className="pl-9" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <Card className="border-none shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-zinc-50 dark:bg-zinc-800">
              <TableRow>
                <TableHead>File Name</TableHead>
                <TableHead>Upload Date</TableHead>
                <TableHead>Date Range</TableHead>
                <TableHead className="text-right">Rows</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-zinc-500">
                    No audit logs found. Upload a file to see it here.
                  </TableCell>
                </TableRow>
              ) : (
                filteredLogs.map((log) => (
                  <TableRow 
                    key={log.id} 
                    className="cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                    onClick={() => openLogDetails(log)}
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded bg-[#0046ab]/10 flex items-center justify-center">
                          <FileSpreadsheet className="h-4 w-4 text-[#0046ab]" />
                        </div>
                        <span className="truncate max-w-[250px]">{log.fileName}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-sm">{new Date(log.uploadedAt).toLocaleDateString()}</span>
                        <span className="text-[10px] text-zinc-400 uppercase font-bold">{new Date(log.uploadedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-normal text-zinc-500">
                        {getDateRange(log)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {log.newFollowers.length}
                    </TableCell>
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
                          onClick={() => openLogDetails(log)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-red-500"
                          onClick={(e) => handleDelete(log.id, e)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

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
                  <span className="flex items-center gap-1.5"><Calendar className="h-3 w-3" /> {selectedLog && new Date(selectedLog.uploadedAt).toLocaleString()}</span>
                  <span className="flex items-center gap-1.5"><Database className="h-3 w-3" /> {selectedLog && getDateRange(selectedLog)}</span>
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-hidden flex flex-col mt-6">
            <Tabs defaultValue="newFollowers" className="flex-1 flex flex-col h-full overflow-hidden">
              <div className="px-6 border-b bg-zinc-50/50 dark:bg-zinc-900/50 shrink-0">
                <TabsList className="bg-transparent h-auto p-0 gap-6 justify-start overflow-x-auto whitespace-nowrap scrollbar-none">
                  {[
                    { id: "newFollowers", label: "New Followers" },
                    { id: "location", label: "Location" },
                    { id: "jobFunction", label: "Job Function" },
                    { id: "seniority", label: "Seniority" },
                    { id: "industry", label: "Industry" },
                    { id: "companySize", label: "Company Size" },
                  ].map(tab => (
                    <TabsTrigger 
                      key={tab.id} 
                      value={tab.id}
                      className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#0046ab] data-[state=active]:bg-transparent pb-3 pt-2 px-0 text-sm font-semibold shadow-none shrink-0"
                    >
                      {tab.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>

              <div className="flex-1 overflow-hidden">
                {selectedLog && Object.entries({
                  newFollowers: selectedLog.newFollowers,
                  location: selectedLog.location,
                  jobFunction: selectedLog.jobFunction,
                  seniority: selectedLog.seniority,
                  industry: selectedLog.industry,
                  companySize: selectedLog.companySize
                }).map(([key, sheetData]) => (
                  <TabsContent key={key} value={key} className="h-full m-0 focus-visible:ring-0 overflow-hidden">
                    <ScrollArea className="h-full w-full">
                      <div className="p-6">
                        <SheetDataTable data={sheetData} />
                      </div>
                      <ScrollBar orientation="horizontal" className="visible" />
                      <ScrollBar orientation="vertical" />
                    </ScrollArea>
                  </TabsContent>
                ))}
              </div>
            </Tabs>
          </div>
          
          <DialogFooter className="p-4 border-t bg-zinc-50 dark:bg-zinc-900 flex items-center justify-between sm:justify-between shrink-0">
            <p className="text-xs text-zinc-500 font-medium italic">Showing full raw data from Excel source.</p>
            <Button 
              className="bg-[#0046ab] hover:bg-[#003a8f] text-white"
              onClick={() => {
                if (selectedLog) {
                  localStorage.setItem("comms_linkedin_data", JSON.stringify(selectedLog))
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
      <p>No data available in this sheet.</p>
    </div>
  )

  const columns = Object.keys(data[0])

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
                  {String(row[col] ?? "-")}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
