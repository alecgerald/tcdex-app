"use client"

import { useEffect, useState } from "react"
import { 
  FileClock, 
  Search, 
  Calendar,
  FileSpreadsheet,
  Trash2,
  AlertTriangle,
  History,
  Eye,
  ArrowLeft
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
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"

interface AuditLog {
  id: string
  templateType: string
  templateName: string
  fileName: string
  date: string
  count: number
}

export default function ERGAuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [deleteId, setDeleteId] = useState<string | null>(null)
  
  // View Data States
  const [viewingLog, setViewLog] = useState<AuditLog | null>(null)
  const [viewData, setViewData] = useState<any[]>([])
  const [viewColumns, setViewColumns] = useState<string[]>([])

  useEffect(() => {
    const existingLogs = localStorage.getItem("erg_audit_logs")
    if (existingLogs) {
      setLogs(JSON.parse(existingLogs))
    }
  }, [])

  const handleDelete = () => {
    if (!deleteId) return
    const updatedLogs = logs.filter(log => log.id !== deleteId)
    localStorage.setItem("erg_audit_logs", JSON.stringify(updatedLogs))
    // Clean up associated data
    localStorage.removeItem(`erg_data_${deleteId}`)
    setLogs(updatedLogs)
    setDeleteId(null)
    toast.success("Log entry and associated data removed")
  }

  const handleViewContent = (log: AuditLog) => {
    const storedData = localStorage.getItem(`erg_data_${log.id}`)
    if (storedData) {
      const parsed = JSON.parse(storedData)
      setViewData(parsed)
      if (parsed.length > 0) {
        setViewColumns(Object.keys(parsed[0]).filter(k => k !== 'id'))
      }
      setViewLog(log)
    } else {
      toast.error("File content no longer available in local storage.")
    }
  }

  const filteredLogs = logs.filter(log => 
    log.fileName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.templateName.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">ERG Audit Logs</h1>
          <p className="text-zinc-500">Track and manage your data upload history.</p>
        </div>
      </div>

      <Card className="border-none shadow-sm">
        <CardHeader className="bg-white dark:bg-zinc-900 border-b pb-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <History className="h-5 w-5 text-[#0046ab]" />
                Upload History
              </CardTitle>
              <CardDescription>
                Click the view icon to see the contents of an uploaded file.
              </CardDescription>
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
              <div className="h-12 w-12 rounded-full bg-zinc-50 flex items-center justify-center mx-auto dark:bg-zinc-800">
                <Calendar className="h-6 w-6 text-zinc-300" />
              </div>
              <p className="text-zinc-500">No upload logs found.</p>
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-zinc-50 dark:bg-zinc-800">
                <TableRow>
                  <TableHead>Template Type</TableHead>
                  <TableHead>File Name</TableHead>
                  <TableHead>Upload Date</TableHead>
                  <TableHead className="text-right">Records</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      <Badge variant="outline" className="bg-zinc-100 dark:bg-zinc-800">
                        {log.templateName}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <FileSpreadsheet className="h-4 w-4 text-green-600" />
                        {log.fileName}
                      </div>
                    </TableCell>
                    <TableCell className="text-zinc-500 text-sm">{log.date}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{log.count.toLocaleString()}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-blue-500 hover:bg-blue-50"
                          onClick={() => handleViewContent(log)}
                          title="View Content"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-red-500 hover:bg-red-50 hover:text-red-600"
                          onClick={() => setDeleteId(log.id)}
                          title="Delete Log"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Content Viewer Modal */}
      <Dialog open={!!viewingLog} onOpenChange={() => setViewLog(null)}>
        <DialogContent className="max-w-[95vw] sm:max-w-[95vw] w-full h-[90vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-6 border-b bg-white dark:bg-zinc-900 sticky top-0 z-10">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-xl flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5 text-green-600" />
                  {viewingLog?.fileName}
                </DialogTitle>
                <DialogDescription>
                  Displaying {viewingLog?.count} records from {viewingLog?.templateName}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          
          <div className="flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              <Table>
                <TableHeader className="bg-zinc-50 dark:bg-zinc-800 sticky top-0 z-10">
                  <TableRow>
                    {viewColumns.map(col => (
                      <TableHead key={col} className="text-xs whitespace-nowrap min-w-[150px]">{col}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {viewData.map((row, i) => (
                    <TableRow key={i}>
                      {viewColumns.map(col => (
                        <TableCell key={col} className="text-[11px] py-2">{String(row[col] || "")}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>

          <DialogFooter className="p-4 border-t bg-zinc-50 dark:bg-zinc-900/50">
            <Button variant="outline" onClick={() => setViewLog(null)} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Logs
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Confirm Deletion
            </DialogTitle>
            <DialogDescription>
              This will remove this upload's summary and its stored file content. 
              Dashboard KPIs will remain but this specific historical view will be lost.
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
