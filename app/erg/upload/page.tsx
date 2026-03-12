"use client"

import { useState, useRef, useMemo } from "react"
import { 
  FileUp, 
  Trash2, 
  AlertTriangle, 
  CheckCircle2,
  FileSpreadsheet,
  RefreshCw,
  Search,
  Loader2,
  Filter,
  Check,
  ChevronRight,
  Info
} from "lucide-react"
import { toast } from "sonner"
import { read, utils } from "xlsx"

import { Button } from "@/components/ui/button"
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface RowData {
  id: string
  [key: string]: any
}

type Step = 'upload' | 'preview'
type TemplateType = 
  | 'membership_registry' 
  | 'membership_snapshot' 
  | 'event_activity' 
  | 'event_feedback' 
  | 'participation_detail'

const templateConfigs = {
  membership_registry: {
    name: "Membership Registry",
    description: "Authoritative list of ERG members",
    requiredColumns: ["Employee ID", "Name", "Email", "Delivery Unit / Business Unit", "Location", "Primary ERG", "Join Date"],
    localStorageKey: "erg_membership_registry"
  },
  membership_snapshot: {
    name: "Monthly Membership Snapshot",
    description: "Monthly total member counts per ERG",
    requiredColumns: ["Month", "ERG", "Total Members"],
    localStorageKey: "erg_membership_snapshots"
  },
  event_activity: {
    name: "Event Activity Log",
    description: "Record of ERG events",
    requiredColumns: ["Event ID", "Event Name", "ERG", "Date", "Type"],
    localStorageKey: "erg_event_logs"
  },
  event_feedback: {
    name: "Event Feedback Summary",
    description: "Aggregated feedback for events",
    requiredColumns: ["Event ID", "Rating", "Comments"],
    localStorageKey: "erg_feedback_summaries"
  },
  participation_detail: {
    name: "Participation Detail Register",
    description: "Detailed attendance for each event",
    requiredColumns: ["Event ID", "Member ID", "Status"],
    localStorageKey: "erg_participation_details"
  }
}

export default function ERGUploadPage() {
  const [step, setStep] = useState<Step>('upload')
  const [templateType, setTemplateType] = useState<TemplateType>('membership_registry')
  const [fileName, setFileName] = useState("")
  const [processedData, setProcessedData] = useState<RowData[]>([])
  const [columns, setColumns] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  
  const fileInputRef = useRef<HTMLInputElement>(null)

  const validateColumns = (headers: string[], required: string[]) => {
    const missing = required.filter(req => 
      !headers.some(h => h.toLowerCase().includes(req.toLowerCase()))
    )
    return missing
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setIsLoading(true)
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const data = event.target?.result
        const workbook = read(data, { type: "binary" })
        const sheetName = workbook.SheetNames[0]
        const sheet = workbook.Sheets[sheetName]
        const jsonData = utils.sheet_to_json(sheet) as any[]
        
        if (!jsonData || jsonData.length === 0) {
          toast.error("The uploaded file is empty")
          setIsLoading(false)
          return
        }

        const headers = Object.keys(jsonData[0])
        const missing = validateColumns(headers, templateConfigs[templateType].requiredColumns)

        if (missing.length > 0) {
          toast.error(`Missing required columns: ${missing.join(", ")}`)
          setIsLoading(false)
          return
        }

        const processed = jsonData.map((row, index) => ({
          ...row,
          id: `erg-${templateType}-${index}-${Date.now()}`
        }))

        setProcessedData(processed)
        setColumns(Object.keys(jsonData[0]))
        setStep('preview')
        toast.success(`${templateConfigs[templateType].name} read successfully.`)
      } catch (error) {
        toast.error("Failed to parse Excel file")
      } finally {
        setIsLoading(false)
      }
    }
    reader.readAsBinaryString(file)
  }

  const handleFinish = () => {
    setIsLoading(true)
    
    // In a real app, we'd process this data to compute KPIs
    // For this prototype, we'll store the summary and the data (limited for local storage)
    const uploadTime = new Date().toLocaleString()
    const existingLogs = JSON.parse(localStorage.getItem("erg_audit_logs") || "[]")
    
    const newLog = { 
      id: `log-${Date.now()}`,
      templateType,
      templateName: templateConfigs[templateType].name,
      fileName, 
      date: uploadTime, 
      count: processedData.length
    }
    
    localStorage.setItem("erg_audit_logs", JSON.stringify([newLog, ...existingLogs]))
    
    // Store the actual data for the dashboard/directory
    // Note: LocalStorage has limits, so we'd typically send this to a backend
    if (templateType === 'membership_registry') {
      localStorage.setItem("erg_membership_registry", JSON.stringify(processedData))
    } else {
      // Append or replace for other types
      localStorage.setItem(templateConfigs[templateType].localStorageKey, JSON.stringify(processedData))
    }

    toast.success(`${templateConfigs[templateType].name} added to system`)
    
    // Reset state
    setStep('upload')
    setProcessedData([])
    if (fileInputRef.current) fileInputRef.current.value = ""
    setIsLoading(false)
  }

  const handleClear = () => {
    setStep('upload')
    setProcessedData([])
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const filteredData = processedData.filter(row => 
    Object.values(row).some(val => String(val).toLowerCase().includes(searchTerm.toLowerCase()))
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">Import ERG Excel</h1>
          <p className="text-zinc-500 dark:text-zinc-400">
            {step === 'upload' ? 'Step 1: Select Template and Upload' : 'Step 2: Review and Confirm'}
          </p>
        </div>
        <div className="flex gap-2">
          {step !== 'upload' && (
            <Button variant="outline" onClick={handleClear} className="text-zinc-500">
              <RefreshCw className="h-4 w-4 mr-2" />
              Reset
            </Button>
          )}
        </div>
      </div>

      {step === 'upload' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-1 border-none shadow-sm h-fit">
            <CardHeader>
              <CardTitle className="text-lg">Template Type</CardTitle>
              <CardDescription>Select the type of data you are uploading</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Select 
                value={templateType} 
                onValueChange={(val) => setTemplateType(val as TemplateType)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select template type" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(templateConfigs).map(([key, config]) => (
                    <SelectItem key={key} value={key}>{config.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 dark:bg-blue-950/20 dark:border-blue-900">
                <div className="flex gap-2 text-blue-800 dark:text-blue-300 mb-2">
                  <Info className="h-4 w-4 shrink-0 mt-0.5" />
                  <span className="text-sm font-semibold">Required Columns:</span>
                </div>
                <ul className="text-xs text-blue-700 dark:text-blue-400 space-y-1 list-disc pl-4">
                  {templateConfigs[templateType].requiredColumns.map(col => (
                    <li key={col}>{col}</li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2 border-dashed border-2 bg-transparent flex flex-col items-center justify-center py-20 text-center">
            <div className="h-20 w-20 rounded-full bg-zinc-100 flex items-center justify-center mb-6 dark:bg-zinc-800">
              <FileSpreadsheet className="h-10 w-10 text-zinc-400" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Upload {templateConfigs[templateType].name}</h3>
            <p className="text-zinc-500 max-w-md px-4 mb-8">
              {templateConfigs[templateType].description}. Ensure all required columns are present.
            </p>
            
            <input 
              type="file" 
              accept=".xlsx, .xls, .csv" 
              className="hidden" 
              ref={fileInputRef} 
              onChange={handleFileUpload} 
            />
            <Button 
              className="bg-[#0046ab] hover:bg-[#003a8f] text-white px-8 py-6 h-auto text-lg" 
              onClick={() => fileInputRef.current?.click()} 
              disabled={isLoading}
            >
              {isLoading ? <Loader2 className="h-5 w-5 mr-2 animate-spin" /> : <FileUp className="h-5 w-5 mr-2" />}
              Select File to Upload
            </Button>
          </Card>
        </div>
      )}

      {step === 'preview' && (
        <Card className="border-none shadow-md overflow-hidden">
          <CardHeader className="bg-white dark:bg-zinc-900 border-b pb-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-lg">Data Preview: {templateConfigs[templateType].name}</CardTitle>
                <CardDescription>Review the {processedData.length} records before adding to the system.</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative w-full md:w-64">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-500" />
                  <Input placeholder="Search preview..." className="pl-9" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[500px] w-full">
              <Table containerClassName="min-w-full w-fit">
                <TableHeader className="bg-zinc-50 sticky top-0 z-10 dark:bg-zinc-800">
                  <TableRow>
                    {columns.map((col) => (
                      <TableHead key={col} className="min-w-[150px]">{col}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredData.map((row) => (
                    <TableRow key={row.id}>
                      {columns.map((col) => (
                        <TableCell key={`${row.id}-${col}`}>
                          {String(row[col] || "")}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
          <div className="p-4 border-t bg-zinc-50 dark:bg-zinc-900/50 flex justify-end">
            <Button className="bg-[#0046ab] hover:bg-[#003a8f] text-white" onClick={handleFinish} disabled={isLoading}>
              {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
              Confirm and Process
            </Button>
          </div>
        </Card>
      )}
    </div>
  )
}
