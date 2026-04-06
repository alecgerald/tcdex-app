"use client"

import { useState, useRef } from "react"
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
  Info,
  Layers,
  Download
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

const templateConfigs: Record<TemplateType, any> = {
  membership_registry: {
    name: "Membership Registry",
    requiredColumns: ["Employee ID", "Name", "Email", "Delivery Unit / Business Unit", "Location", "Primary ERG", "Join Date"],
    localStorageKey: "erg_membership_registry"
  },
  membership_snapshot: {
    name: "Monthly Membership Snapshot",
    // Only require the "anchors". We will detect months dynamically.
    requiredColumns: ["ERG", "Growth Rate %"], 
    localStorageKey: "erg_membership_snapshots"
  },
  event_activity: {
    name: "Event Activity Log",
    requiredColumns: ["ERG", "Event Date", "DEIB event", "Activity Title", "Activity Type", "Attendance / Participation Count"],
    localStorageKey: "erg_event_logs"
  },
  event_feedback: {
    name: "Event Feedback Summary",
    requiredColumns: ["ERG", "DEIB event", "Activity Title", "Overall Evaluation Score", "Positive Feedbacks", "Negative Feedbacks", "Response Count"],
    localStorageKey: "erg_feedback_summaries"
  },
  participation_detail: {
    name: "Participation Detail Register",
    requiredColumns: ["DEIB event", "ERG", "Activity Title", "Activity Type", "Employee ID", "Name", "Delivery Unit / Business Unit", "Location", "Member of What ERG"],
    localStorageKey: "erg_participation_details"
  }
}

export default function ERGUploadPage() {
  const [step, setStep] = useState<Step>('upload')
  const [templateType, setTemplateType] = useState<TemplateType | null>(null)
  const [fileName, setFileName] = useState("")
  const [processedData, setProcessedData] = useState<RowData[]>([])
  const [columns, setColumns] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  
  const fileInputRef = useRef<HTMLInputElement>(null)

  const detectTemplateType = (headers: string[]): TemplateType | null => {
    for (const [key, config] of Object.entries(templateConfigs)) {
      const isMatch = config.requiredColumns.every((req: string) => 
        headers.some(h => h.trim().toLowerCase() === req.toLowerCase())
      )
      if (isMatch) return key as TemplateType
    }
    return null
  }

  const validateData = (data: any[], type: TemplateType) => {
    const errors: string[] = []
    if (type === 'membership_registry') {
      const ids = new Set()
      data.forEach((row, index) => {
        const empId = row["Employee ID"]
        const erg = row["Primary ERG"]
        if (!empId) errors.push(`Row ${index + 1}: Missing Employee ID`)
        else if (ids.has(empId)) errors.push(`Row ${index + 1}: Duplicate Employee ID (${empId})`)
        else ids.add(empId)

        if (!erg || String(erg).trim() === "") {
          errors.push(`Row ${index + 1}: Primary ERG assignment is required`)
        }
      })
    }
    return errors
  }

  const standardizeData = (data: any[], type: TemplateType) => {
    return data.map(row => {
      const newRow = { ...row }
      if (type === 'membership_registry') {
        newRow.Status = "Active" // Automatically mark all as active
      }
      if (type === 'membership_registry' || type === 'participation_detail') {
        const buKey = "Delivery Unit / Business Unit"
        const locKey = "Location"
        if (newRow[buKey]) newRow[buKey] = String(newRow[buKey]).trim().toUpperCase()
        if (newRow[locKey]) newRow[locKey] = String(newRow[locKey]).trim().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
      }
      if (type === 'event_feedback') {
        const numericCols = ["Overall Evaluation Score", "Positive Feedbacks", "Negative Feedbacks", "Response Count"]
        numericCols.forEach(col => {
          if (newRow[col] === undefined || newRow[col] === null || isNaN(Number(newRow[col]))) {
            newRow[col] = 0
          }
        })
      }
      return newRow
    })
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
        
        let detectedType: TemplateType | null = null
        let jsonData: any[] = []
        let headers: string[] = []

        // AUTO-SCAN: Try Row 1, then 2, 3, 4, 5 to find valid headers
        for (let i = 0; i < 5; i++) {
          const attemptData = utils.sheet_to_json(sheet, { range: i }) as any[]
          if (attemptData.length > 0) {
            const attemptHeaders = Object.keys(attemptData[0])
            const match = detectTemplateType(attemptHeaders)
            if (match) {
              detectedType = match
              jsonData = attemptData
              headers = attemptHeaders
              break
            }
          }
        }

        if (!detectedType) {
          toast.error("Format unrecognized. We scanned the first 5 rows but couldn't find valid ERG headers.")
          setIsLoading(false)
          return
        }

        const dataErrors = validateData(jsonData, detectedType)
        if (dataErrors.length > 0) {
          dataErrors.slice(0, 3).forEach(err => toast.error(err))
          setIsLoading(false)
          return
        }

        const standardized = standardizeData(jsonData, detectedType)
        const processed = standardized.map((row, index) => ({
          ...row,
          id: `erg-${detectedType}-${index}-${Date.now()}`
        }))

        setTemplateType(detectedType)
        setProcessedData(processed)
        setColumns(Object.keys(jsonData[0]))
        setStep('preview')
        toast.success(`Detected as ${templateConfigs[detectedType].name}`)
      } catch (error) {
        toast.error("Failed to parse file")
      } finally {
        setIsLoading(false)
      }
    }
    reader.readAsBinaryString(file)
  }

  const handleFinish = () => {
    if (!templateType) return
    setIsLoading(true)
    
    const logId = `log-${Date.now()}`
    const uploadTime = new Date().toISOString()
    const existingLogs = JSON.parse(localStorage.getItem("erg_audit_logs") || "[]")
    
    const newLog = { 
      id: logId,
      templateType,
      templateName: templateConfigs[templateType].name,
      fileName, 
      date: uploadTime, 
      count: processedData.length
    }
    
    localStorage.setItem("erg_audit_logs", JSON.stringify([newLog, ...existingLogs]))

    // SMART MERGE LOGIC:
    // 1. Authoritative (Registry) -> Overwrite
    // 2. Trend/Historical (Snapshots, Events, etc.) -> Merge & Update
    const storageKey = templateConfigs[templateType].localStorageKey
    
    // Attach upload time to each row to enable upload-date-based filtering later
    const dataWithUploadTime = processedData.map(row => ({ ...row, uploadDate: uploadTime }))
    let finalData = dataWithUploadTime

    if (templateType !== 'membership_registry') {
      const existingData = JSON.parse(localStorage.getItem(storageKey) || "[]")
      
      // Define unique keys for each historical template to prevent duplicates
      const getUniqueKey = (row: any) => {
        switch (templateType) {
          case 'membership_snapshot':
            // Merge by ERG name (updates existing ERG stats)
            return String(row["ERG"]).trim().toLowerCase()
          case 'event_activity':
            // Merge by Date + Title + ERG
            return `${row["ERG"]}-${row["Event Date"]}-${row["Activity Title"]}`.toLowerCase()
          case 'event_feedback':
            // Merge by DEIB Event Code + Title + ERG
            return `${row["ERG"]}-${row["DEIB event"]}-${row["Activity Title"]}`.toLowerCase()
          case 'participation_detail':
            // Merge by Employee + Event
            return `${row["Employee ID"]}-${row["Activity Title"]}`.toLowerCase()
          default:
            return row.id
        }
      }

      // Create a map of existing data for efficient lookup/update
      const dataMap = new Map(existingData.map((row: any) => [getUniqueKey(row), row]))
      
      // Merge new data into the map (new records added, existing records updated)
      dataWithUploadTime.forEach(row => {
        const key = getUniqueKey(row)
        if (templateType === 'membership_snapshot' && dataMap.has(key)) {
          // DEEP MERGE for snapshots: keep Jan-Apr while adding May-Jun
          dataMap.set(key, { ...dataMap.get(key), ...row })
        } else {
          dataMap.set(key, row)
        }
      })

      finalData = Array.from(dataMap.values())

      // Update columns state to include any new monthly columns found in existing data
      if (finalData.length > 0) {
        const allPossibleColumns = new Set<string>()
        finalData.forEach(row => {
          Object.keys(row).forEach(k => {
            if (k !== 'id') allPossibleColumns.add(k)
          })
        })
        // Filter out internal 'id' and ensure the stable columns are present
        setColumns(Array.from(allPossibleColumns))
      }
    }

    localStorage.setItem(storageKey, JSON.stringify(finalData))
    localStorage.setItem(`erg_data_${logId}`, JSON.stringify(processedData))

    const isMerged = templateType !== 'membership_registry'
    toast.success(
      isMerged 
        ? `${templateConfigs[templateType].name} merged with existing data`
        : `${templateConfigs[templateType].name} updated (Authoritative Overwrite)`
    )
    
    setStep('upload')
    setProcessedData([])
    setTemplateType(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
    setIsLoading(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Import ERG Data</h1>
          <p className="text-zinc-500">Automated template detection and validation.</p>
        </div>
      </div>

      {step === 'upload' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-1 border-none shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Reference Materials</CardTitle>
              <CardDescription>Ensuring 100% data accuracy</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg dark:bg-blue-950/20 dark:border-blue-900">
                <div className="flex gap-2 text-blue-800 dark:text-blue-300 mb-2">
                  <FileSpreadsheet className="h-4 w-4 shrink-0" />
                  <span className="text-xs font-bold uppercase">Sample Templates</span>
                </div>
                <div className="space-y-2">
                  {Object.entries(templateConfigs).map(([key, config]: [string, any]) => (
                    <button 
                      key={key}
                      onClick={() => toast.info(`Downloading ${config.name} template...`)}
                      className="flex items-center justify-between w-full text-[10px] p-2 bg-white border rounded hover:bg-zinc-50 transition-colors dark:bg-zinc-900 dark:border-zinc-800"
                    >
                      <span className="font-medium truncate mr-2">{config.name}</span>
                      <Download className="h-3 w-3 text-blue-600 shrink-0" />
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-[10px] font-bold uppercase text-zinc-400">Supported Formats</span>
                {Object.values(templateConfigs).map((c: any) => (
                  <div key={c.name} className="flex items-center gap-2 text-xs text-zinc-600 font-medium p-2 bg-zinc-50 rounded border dark:bg-zinc-900/50">
                    <CheckCircle2 className="h-3 w-3 text-green-500" />
                    {c.name}
                  </div>
                ))}
              </div>

              {/* TEMPORARY TESTING TOOL */}
              <div className="pt-4 border-t mt-4">
                <span className="text-[10px] font-bold uppercase text-red-500 block mb-2">Testing Tools</span>
                <Button 
                  variant="destructive" 
                  size="sm" 
                  className="w-full text-[10px] h-8"
                  onClick={() => {
                    if (confirm("Are you sure? This will wipe ALL uploaded Excel data for ERG and LMS.")) {
                      const keys = [
                        "erg_membership_registry", "erg_membership_snapshots", 
                        "erg_event_logs", "erg_feedback_summaries", 
                        "erg_participation_details", "erg_audit_logs", "lms_audit_logs"
                      ];
                      keys.forEach(k => localStorage.removeItem(k));
                      Object.keys(localStorage).forEach(k => {
                        if (k.startsWith("erg_data_")) localStorage.removeItem(k);
                      });
                      toast.success("Dashboard data reset successfully");
                      setTimeout(() => window.location.reload(), 1000);
                    }
                  }}
                >
                  <Trash2 className="h-3 w-3 mr-2" />
                  Reset All Data (Fresh Start)
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2 border-dashed border-2 bg-transparent flex flex-col items-center justify-center py-24 text-center">
            <div className="h-20 w-20 rounded-full bg-zinc-100 flex items-center justify-center mb-6 dark:bg-zinc-800">
              <FileSpreadsheet className="h-10 w-10 text-zinc-400" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Smart Excel Upload</h3>
            <p className="text-zinc-500 max-w-sm mb-8 px-4">Simply upload any of the 5 ERG templates. The system will identify and validate the data automatically.</p>
            
            <input type="file" accept=".xlsx, .xls, .csv" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
            <Button className="bg-[#0046ab] hover:bg-[#003a8f] text-white px-10 py-6 h-auto text-lg rounded-xl" onClick={() => fileInputRef.current?.click()} disabled={isLoading}>
              {isLoading ? <Loader2 className="h-5 w-5 mr-2 animate-spin" /> : <FileUp className="h-5 w-5 mr-2" />}
              Upload Excel or CSV
            </Button>
          </Card>
        </div>
      )}

      {step === 'preview' && templateType && (
        <Card className="border-none shadow-md overflow-hidden">
          <CardHeader className="bg-white dark:bg-zinc-900 border-b pb-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Badge className="bg-green-600">Detected: {templateConfigs[templateType].name}</Badge>
                </div>
                <CardDescription>Review {processedData.length} records before processing.</CardDescription>
              </div>
              <div className="relative w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-500" />
                <Input placeholder="Search preview..." className="pl-9 h-9" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[450px]">
              <Table>
                <TableHeader className="bg-zinc-50 dark:bg-zinc-800 sticky top-0 z-10">
                  <TableRow>
                    {columns.map((col) => (
                      <TableHead key={col} className="min-w-[150px] whitespace-nowrap">{col}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {processedData.filter(row => Object.values(row).some(v => String(v).toLowerCase().includes(searchTerm.toLowerCase()))).map((row) => (
                    <TableRow key={row.id}>
                      {columns.map((col) => (
                        <TableCell key={`${row.id}-${col}`} className="text-xs">{String(row[col] ?? "")}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
          <div className="p-4 border-t bg-zinc-50 dark:bg-zinc-900/50 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setStep('upload')}>Cancel</Button>
            <Button className="bg-[#0046ab] hover:bg-[#003a8f] text-white" onClick={handleFinish} disabled={isLoading}>
              {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
              Save Data to Dashboard
            </Button>
          </div>
        </Card>
      )}
    </div>
  )
}
