"use client"

import { useEffect, useState } from "react"
import { 
  FileClock, 
  Search, 
  Calendar,
  FileSpreadsheet,
  Trash2,
  AlertTriangle,
  History
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
    setLogs(updatedLogs)
    setDeleteId(null)
    toast.success("Log entry removed from history")
  }

  const filteredLogs = logs.filter(log => 
    log.fileName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.templateName.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">ERG Audit Logs</h1>
          <p className="text-zinc-500 dark:text-zinc-400">Track and manage your data upload history.</p>
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
                History of files processed and imported into the ERG module.
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
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-red-500 hover:bg-red-50 hover:text-red-600"
                        onClick={() => setDeleteId(log.id)}
                        title="Delete Log"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Confirm Deletion
            </DialogTitle>
            <DialogDescription>
              This will remove this upload's summary from the audit trail. 
              Note: This action does not automatically revert data changes in the dashboard.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete Entry</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
