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
  Search,
  Facebook,
  Instagram,
  Play,
  Linkedin
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
  type: string
  rows?: any[]
  // Legacy fields
  newFollowers?: any[]
  contentDailyMetrics?: any[]
  contentPostMetrics?: any[]
  location?: any[]
  jobFunction?: any[]
  seniority?: any[]
  industry?: any[]
  companySize?: any[]
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
    
    // Also update specific platform data if needed
    const deletedLog = logs.find(l => l.id === id)
    if (deletedLog) {
      if (deletedLog.type === "facebook-visits") {
        // Find most recent facebook log
        const recentFb = updatedLogs.find(l => l.type === "facebook-visits")
        if (recentFb) {
          localStorage.setItem("comms_facebook_visits_data", JSON.stringify(recentFb))
        } else {
          localStorage.removeItem("comms_facebook_visits_data")
        }
      } else if (deletedLog.type === "instagram-views") {
        const recentIg = updatedLogs.find(l => l.type === "instagram-views")
        if (recentIg) {
          localStorage.setItem("comms_instagram_views_data", JSON.stringify(recentIg))
        } else {
          localStorage.removeItem("comms_instagram_views_data")
        }
      }
    }
    
    toast.success("Log deleted successfully")
  }

  const openLogDetails = (log: CommsLog) => {
    setSelectedLog(log)
    setIsViewOpen(true)
  }

  const filteredLogs = logs.filter(log => 
    log.fileName?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getDateRange = (log: CommsLog) => {
    let dates: any[] = []
    if (log.rows) {
      dates = log.rows.map(r => r.Date).filter(Boolean)
    } else if (log.type === 'content-posts') {
      const dailyDates = log.contentDailyMetrics?.map(r => r.Date).filter(Boolean) || []
      const postDates = log.contentPostMetrics?.map(r => r['Created date'] || r.Date).filter(Boolean) || []
      dates = [...dailyDates, ...postDates]
    } else {
      dates = log.newFollowers?.map(r => r.Date).filter(Boolean) || []
    }
    
    if (dates.length === 0) return "N/A"
    
    const sortedDates = [...new Set(dates)].sort()
    return `${sortedDates[0]} - ${sortedDates[sortedDates.length - 1]}`
  }

  const getRowCount = (log: CommsLog) => {
    if (log.rows) return log.rows.length
    if (log.type === 'content-posts') {
      return (log.contentDailyMetrics?.length || 0) + (log.contentPostMetrics?.length || 0)
    }
    return log.newFollowers?.length || 0
  }

  const getTabs = (log: CommsLog) => {
    if (log.rows) {
      return [{ id: "data", label: "Data Records", data: log.rows }]
    }
    if (log.type === 'content-posts') {
      return [
        { id: "contentDailyMetrics", label: "Daily Metrics", data: log.contentDailyMetrics },
        { id: "contentPostMetrics", label: "Post Metrics", data: log.contentPostMetrics },
      ]
    }
    return [
      { id: "newFollowers", label: "New Followers", data: log.newFollowers },
      { id: "location", label: "Location", data: log.location },
      { id: "jobFunction", label: "Job Function", data: log.jobFunction },
      { id: "seniority", label: "Seniority", data: log.seniority },
      { id: "industry", label: "Industry", data: log.industry },
      { id: "companySize", label: "Company Size", data: log.companySize },
    ]
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'facebook-visits': return <Facebook className="h-4 w-4" />
      case 'instagram-views': return <Instagram className="h-4 w-4" />
      case 'tiktok-overview': return <Play className="h-4 w-4" />
      case 'linkedin-analytics': return <Linkedin className="h-4 w-4" />
      default: return <FileSpreadsheet className="h-4 w-4" />
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'facebook-visits': return 'bg-blue-100 text-blue-700'
      case 'instagram-views': return 'bg-pink-100 text-pink-700'
      case 'tiktok-overview': return 'bg-zinc-100 text-zinc-700'
      case 'linkedin-analytics': return 'bg-blue-100 text-blue-800'
      default: return 'bg-[#0046ab]/10 text-[#0046ab]'
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">Comms Audit Logs</h1>
          <p className="text-zinc-500 dark:text-zinc-400">History of data uploads and raw data preview</p>
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
                <TableHead>File Name / Type</TableHead>
                <TableHead>Upload Date</TableHead>
                <TableHead>Date Range</TableHead>
                <TableHead className="text-right">Total Rows</TableHead>
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
                        <div className={`h-8 w-8 rounded flex items-center justify-center ${getTypeColor(log.type)}`}>
                          {getTypeIcon(log.type)}
                        </div>
                        <div className="flex flex-col truncate">
                          <span className="truncate max-w-[250px]">{log.fileName}</span>
                          <span className="text-[10px] uppercase font-bold text-zinc-400">{log.type?.replace('-', ' ') || 'followers'}</span>
                        </div>
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
                      {getRowCount(log)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
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
              <div className={`h-10 w-10 rounded-lg flex items-center justify-center shadow-md ${getTypeColor(selectedLog?.type || '')} text-current`}>
                {selectedLog && getTypeIcon(selectedLog.type)}
              </div>
              <div>
                <DialogTitle className="text-xl font-bold">{selectedLog?.fileName}</DialogTitle>
                <DialogDescription className="flex items-center gap-4 mt-1">
                  <span className="flex items-center gap-1.5"><Calendar className="h-3 w-3" /> {selectedLog && new Date(selectedLog.uploadedAt).toLocaleString()}</span>
                  <span className="flex items-center gap-1.5"><Database className="h-3 w-3" /> {selectedLog && getDateRange(selectedLog)}</span>
                  <Badge variant="secondary" className="text-[10px] uppercase font-bold">{selectedLog?.type?.replace('-', ' ') || 'followers'}</Badge>
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-hidden flex flex-col mt-6">
            {selectedLog && (
              <Tabs defaultValue={getTabs(selectedLog)[0].id} className="flex-1 flex flex-col h-full overflow-hidden">
                <div className="px-6 border-b bg-zinc-50/50 dark:bg-zinc-900/50 shrink-0">
                  <TabsList className="bg-transparent h-auto p-0 gap-6 justify-start overflow-x-auto whitespace-nowrap scrollbar-none">
                    {getTabs(selectedLog).map(tab => (
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
                  {getTabs(selectedLog).map(tab => (
                    <TabsContent key={tab.id} value={tab.id} className="h-full m-0 focus-visible:ring-0 overflow-hidden">
                      <ScrollArea className="h-full w-full">
                        <div className="p-6">
                          <SheetDataTable data={tab.data || []} />
                        </div>
                        <ScrollBar orientation="horizontal" className="visible" />
                        <ScrollBar orientation="vertical" />
                      </ScrollArea>
                    </TabsContent>
                  ))}
                </div>
              </Tabs>
            )}
          </div>
          
          <DialogFooter className="p-4 border-t bg-zinc-50 dark:bg-zinc-900 flex items-center justify-between sm:justify-between shrink-0">
            <p className="text-xs text-zinc-500 font-medium italic">Showing full raw data from source.</p>
            <Button 
              variant="outline"
              onClick={() => setIsViewOpen(false)}
            >
              Close Preview
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
