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
  Linkedin,
  Loader2
} from "lucide-react"
import { toast } from "sonner"
import { createClient } from "@/utils/supabase/client"


import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertTriangle } from "lucide-react"
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
  sheets?: Record<string, any[]>
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

function LoadingOverlay() {
  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm dark:bg-zinc-950/80">
      <div className="relative h-24 w-24">
        <Loader2 className="h-24 w-24 animate-spin text-[#0046ab] opacity-20" />
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="h-12 w-12 animate-spin text-[#0046ab]" />
        </div>
      </div>
      <div className="mt-6 space-y-2 text-center">
        <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Accessing records...</p>
        <p className="text-sm text-zinc-500">Please wait while we secure your information.</p>
      </div>
    </div>
  )
}

export default function CommsAuditLogsPage() {
  const [logs, setLogs] = useState<CommsLog[]>([])
  const [selectedLog, setSelectedLog] = useState<CommsLog | null>(null)
  const [isViewOpen, setIsViewOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [logToDelete, setLogToDelete] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<string | null>(null)

  useEffect(() => {
    async function loadDataAndRole() {
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

      const { data, error } = await supabase
        .from('comms_batches')
        .select('*')
        .order('upload_timestamp', { ascending: false })
      
      if (data && !error) {
        // Map to our generic format
        const mappedLogs = data.map(dbBatch => ({
           id: dbBatch.batch_id,
           fileName: dbBatch.filename,
           uploadedAt: dbBatch.upload_timestamp,
           type: dbBatch.upload_type,
           rows: Array.from({ length: dbBatch.records_imported }), // Placeholder for count
           _dbRecord: dbBatch
        }))
        setLogs(mappedLogs)
      } else if (error) {
         console.error("Failed to load logs from database:", error)
      }
    }
    loadDataAndRole()
  }, [])

  const confirmDelete = async () => {
    if (!logToDelete || userRole === "viewer") return
    const supabase = createClient()
    const { error } = await supabase.from('comms_batches').delete().eq('batch_id', logToDelete)

    if (error) {
      toast.error("Failed to delete log");
      return;
    }

    const updatedLogs = logs.filter(log => log.id !== logToDelete)
    setLogs(updatedLogs)
    setLogToDelete(null)
    
    toast.success("Log and associated data deleted successfully")
  }

  const handleDeletePrompt = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (userRole === "viewer") {
      toast.error("You do not have permission to delete history")
      return
    }
    setLogToDelete(id)
  }


  const [isProcessing, setIsProcessing] = useState(false)

  const openLogDetails = async (log: CommsLog) => {
    const supabase = createClient()
    let data;
    
    setIsProcessing(true)
    try {
      if (log.type === "facebook-visits") {
         const { data: qData } = await supabase.from('comms_facebook_visits').select('*').eq('batch_id', log.id)
         data = { rows: qData || [] }
      } else if (log.type === "instagram-views") {
         const { data: qData } = await supabase.from('comms_instagram_views').select('*').eq('batch_id', log.id)
         data = { rows: qData || [] }
      } else if (log.type === "tiktok-overview") {
         const { data: qData } = await supabase.from('comms_tiktok_overview').select('*').eq('batch_id', log.id)
         data = { rows: qData || [] }
      } else if (log.type === "linkedin-analytics") {
         const { data: genData } = await supabase.from('comms_linkedin_general').select('*').eq('batch_id', log.id)
         const { data: postData } = await supabase.from('comms_linkedin_posts').select('*').eq('batch_id', log.id)
         data = { sheets: { "General": genData || [], "Posts": postData || [] } }
      }

      if (data) {
         setSelectedLog({ ...log, ...data } as CommsLog)
         setIsViewOpen(true)
      } else {
         toast.error("Failed to load details for this log.")
      }
    } catch (e) {
      console.error("Error loading log details:", e)
      toast.error("Error fetching records")
    } finally {
      setIsProcessing(false)
    }
  }

  const filteredLogs = logs.filter(log => 
    log.fileName?.toLowerCase().includes(searchTerm.toLowerCase())
  )



  const getRowCount = (log: CommsLog) => {
    if ((log as any)._dbRecord?.records_imported !== undefined) {
      return (log as any)._dbRecord.records_imported;
    }
    if (log.rows && Array.isArray(log.rows)) return log.rows.length
    if (log.type === 'content-posts') {
      return (log.contentDailyMetrics?.length || 0) + (log.contentPostMetrics?.length || 0)
    }
    return log.newFollowers?.length || 0
  }

  const getTabs = (log: CommsLog) => {
    if (log.sheets && Object.keys(log.sheets).length > 0) {
      return Object.entries(log.sheets).map(([sheetName, sheetData]) => ({
        id: sheetName,
        label: sheetName,
        data: sheetData
      }))
    }
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

  const getDisplayName = (type: string) => {
    switch (type) {
      case 'facebook-visits': return 'Facebook'
      case 'instagram-views': return 'Instagram'
      case 'tiktok-overview': return 'Tiktok'
      case 'linkedin-analytics': return 'LinkedIn'
      default: return type?.replace('-', ' ') || 'followers'
    }
  }

  return (
    <>
      {isProcessing && <LoadingOverlay />}
      <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">History</h1>
          <p className="text-zinc-500 dark:text-zinc-400">View and manage uploaded communication platform data</p>
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
                placeholder="Search files..." 
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
                <TableHead>Type</TableHead>
                <TableHead>Upload Date</TableHead>
                <TableHead className="text-right">Total Rows</TableHead>
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
                      <div className="flex items-center gap-3">
                        <div className={`h-8 w-8 rounded flex items-center justify-center ${getTypeColor(log.type)}`}>
                          {getTypeIcon(log.type)}
                        </div>
                        <div className="flex flex-col truncate">
                          <span className="truncate max-w-[250px] font-semibold">{log.fileName}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={`text-[10px] uppercase font-bold ${getTypeColor(log.type)} border-none shadow-none`}>
                        {getDisplayName(log.type)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-sm">
                          {(() => {
                            const d = new Date(log.uploadedAt)
                            return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`
                          })()}
                        </span>
                        <span className="text-[10px] text-zinc-400 uppercase font-bold">{new Date(log.uploadedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
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
                        {userRole !== "viewer" && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-red-500"
                            onClick={(e) => handleDeletePrompt(log.id, e)}
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
                  <Badge variant="secondary" className={`text-[10px] uppercase font-bold ${getTypeColor(selectedLog?.type || '')} border-none shadow-none`}>
                    {getDisplayName(selectedLog?.type || '')}
                  </Badge>
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-hidden flex flex-col mt-6">
            {selectedLog && (
              <Tabs defaultValue={getTabs(selectedLog)[0].id} className="flex-1 flex flex-col h-full overflow-hidden">
                <div className="px-6 border-b bg-zinc-50/50 dark:bg-zinc-900/50 shrink-0">
                  <TabsList className="bg-transparent h-auto p-0 gap-6 justify-start flex-wrap">
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

      {/* Delete Confirmation Modal */}
      <Dialog open={!!logToDelete} onOpenChange={(open) => !open && setLogToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Confirm Deletion
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this record? This action will permanently remove it from the database and cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLogToDelete(null)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </>
  )
}

function SheetDataTable({ data }: { data: any[] }) {
  if (!data || data.length === 0) return (
    <div className="text-center py-20 text-zinc-400">
      <FileSpreadsheet className="h-10 w-10 mx-auto mb-2 opacity-20" />
      <p>No data available in this sheet.</p>
    </div>
  )

  const columns = Object.keys(data[0]).filter(col => col !== 'id' && col !== 'batch_id')

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
              {columns.map(col => {
                let value = row[col];
                if (col.toLowerCase().includes('date') && value) {
                   const d = new Date(value);
                   if (!isNaN(d.getTime())) {
                      value = `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
                   }
                }
                return (
                  <TableCell key={`${idx}-${col}`} className="whitespace-nowrap px-4 py-3 border-r last:border-r-0">
                    {String(value ?? "-")}
                  </TableCell>
                )
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

