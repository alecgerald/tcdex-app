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
  ArrowLeft,
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
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"

import { fetchERGDashboardData, fetchBatchData, deleteBatch } from "../actions"

interface AuditLog {
  id: string
  templateType: string
  templateName: string
  fileName: string
  date: string
  count: number
}

const templateNames: Record<string, string> = {
  membership_registry: "Membership Registry",
  membership_snapshot: "Monthly Membership Snapshot",
  event_activity: "Event Activity Log",
  event_feedback: "Event Feedback Summary",
  participation_detail: "Participation Detail Register"
}

export default function ERGAuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  
  // View Data States
  const [viewingLog, setViewLog] = useState<AuditLog | null>(null)
  const [viewData, setViewData] = useState<any[]>([])
  const [viewColumns, setViewColumns] = useState<string[]>([])

  useEffect(() => {
    async function loadLogs() {
      setIsLoading(true)
      try {
        const data = await fetchERGDashboardData()
        const enrichedLogs = data.auditLogs.map((log: any) => ({
          ...log,
          templateName: templateNames[log.templateType] || log.templateType
        }))
        setLogs(enrichedLogs)
      } catch (error) {
        console.error("Failed to load logs:", error)
      } finally {
        setIsLoading(false)
      }
    }
    loadLogs()
  }, [])

  const handleDelete = async () => {
    if (!deleteId) return
    setIsLoading(true)
    const result = await deleteBatch(deleteId)
    if (result.success) {
      setLogs(logs.filter(log => log.id !== deleteId))
      setDeleteId(null)
      toast.success("Batch and associated data removed")
    } else {
      toast.error(result.error || "Failed to delete batch")
    }
    setIsLoading(false)
  }

  const handleViewContent = async (log: AuditLog) => {
    setIsLoading(true)
    const result = await fetchBatchData(log.id, log.templateType)
    if (result.data) {
      setViewData(result.data)
      if (result.data.length > 0) {
        setViewColumns(Object.keys(result.data[0]))
      }
      setViewLog(log)
    } else {
      toast.error(result.error || "Failed to fetch content")
    }
    setIsLoading(false)
  }

  const filteredLogs = logs.filter(log => 
    log.fileName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.templateName.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (isLoading && logs.length === 0) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#0046ab]" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Upload History</h1>
          <p className="text-zinc-500">Track and manage your ERG data imports.</p>
        </div>
        <Button variant="ghost" onClick={() => window.location.href='/erg'}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Dashboard
        </Button>
      </div>

      <Card className="border-none shadow-sm">
        <CardHeader className="bg-white dark:bg-zinc-900 border-b pb-4">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-500" />
            <Input
              placeholder="Search by filename or type..."
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-zinc-50 dark:bg-zinc-800">
              <TableRow>
                <TableHead>Template Type</TableHead>
                <TableHead>Filename</TableHead>
                <TableHead>Upload Date</TableHead>
                <TableHead className="text-center">Records</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-zinc-500">
                    No upload history found.
                  </TableCell>
                </TableRow>
              ) : (
                filteredLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-blue-50 rounded-md dark:bg-blue-900/20">
                          <FileSpreadsheet className="h-3.5 w-3.5 text-blue-600" />
                        </div>
                        <span className="font-medium text-xs">{log.templateName}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs font-mono text-zinc-600 max-w-[200px] truncate">{log.fileName}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-xs">{new Date(log.date).toLocaleDateString()}</span>
                        <span className="text-[10px] text-zinc-400">{new Date(log.date).toLocaleTimeString()}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary" className="font-mono text-[10px]">{log.count}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 w-8 p-0"
                          onClick={() => handleViewContent(log)}
                          title="Preview Data"
                        >
                          <Eye className="h-4 w-4 text-zinc-500" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 w-8 p-0 hover:bg-red-50 hover:text-red-600"
                          onClick={() => setDeleteId(log.id)}
                          title="Delete Batch"
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

      {/* Wide Preview Dialog */}
      <Dialog open={!!viewingLog} onOpenChange={() => setViewLog(null)}>
        <DialogContent className="sm:max-w-[90vw] w-full max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Data Preview: {viewingLog?.fileName}</DialogTitle>
            <DialogDescription>
              Showing imported records for this {viewingLog?.templateName}.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-hidden border rounded-md mt-4">
            <ScrollArea className="h-full">
              <Table>
                <TableHeader className="bg-zinc-50 sticky top-0 z-10">
                  <TableRow>
                    {viewColumns.map(col => (
                      <TableHead key={col} className="text-[10px] font-bold uppercase whitespace-nowrap">{col}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {viewData.map((row, i) => (
                    <TableRow key={i}>
                      {viewColumns.map(col => (
                        <TableCell key={col} className="text-[10px] whitespace-nowrap">{String(row[col])}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setViewLog(null)}>Close Preview</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <AlertTriangle className="h-10 w-10 text-red-500 mb-2" />
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this upload batch? This will permanently remove all associated records from the dashboard. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete Permanently</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
