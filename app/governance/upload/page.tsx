"use client"

import { useState, useRef } from "react"
import { 
  FileUp, 
  Trash2, 
  AlertTriangle, 
  CheckCircle2,
  RefreshCw,
  Search,
  Loader2,
  Check,
  Shield,
  XCircle,
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
import { persistUploadBatch } from "./actions"

export interface ProcessedProgramRow {
  id: string
  programTitle: string
  assignedUnit: string
  priorityLevel: string
  targetAudience: string
  businessUnit: string
  budgetRequired: boolean
  approvedBudgetPhp: number | null
  deliveryCompletion: string
  programYear: number | null
  
  // Ownership
  programLead: string
  trainerType: string
  internalTrainers: string
  externalVendor: string
  supportTeam: string

  // Validation
  rowStatus: 'valid' | 'warning' | 'error'
  validationMessages: string[]
}

type Step = 'upload' | 'preview'

export default function GovernanceUploadPage() {
  const [step, setStep] = useState<Step>('upload')
  const [fileName, setFileName] = useState("")
  const [processedData, setProcessedData] = useState<ProcessedProgramRow[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")

  const fileInputRef = useRef<HTMLInputElement>(null)

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
        // Read as raw arrays with header: 1
        const jsonData = utils.sheet_to_json<any[]>(sheet, { header: 1, defval: "" })
        
        if (!jsonData || jsonData.length < 5) {
          toast.error("The uploaded file does not contain enough rows to match the expected format.")
          setIsLoading(false)
          return
        }

        // Find the header row dynamically by scanning the first 10 rows
        let headerRowIndex = -1
        let fieldNames: any[] = []
        
        for (let i = 0; i < Math.min(10, jsonData.length); i++) {
          const row = jsonData[i] || []
          if (row.some((cell: any) => typeof cell === 'string' && /program.*title|course.*name|^program$|^title$/i.test(cell))) {
            headerRowIndex = i
            fieldNames = row
            break
          }
        }

        // If we still can't find it, fallback to row 4 (index 3) like the default TCDEX format or row 1 (index 0)
        if (headerRowIndex === -1) {
          if (jsonData.length > 3 && jsonData[3].some((cell: any) => typeof cell === 'string')) {
            headerRowIndex = 3
            fieldNames = jsonData[3]
          } else {
            headerRowIndex = 0
            fieldNames = jsonData[0] || []
          }
        }
        
        // Data starts immediately after the header row
        const dataRows = jsonData.slice(headerRowIndex + 1)
        
        // Find indices dynamically based on expected headers if possible
        const findColIndex = (pattern: RegExp) => fieldNames.findIndex(f => typeof f === 'string' && pattern.test(f))
        
        const titleIdx = findColIndex(/program.*title|course.*name|^program$|^title$/i)
        const unitIdx = findColIndex(/assigned.*unit|tcdex|^unit$/i)
        const priorityIdx = findColIndex(/priority|level/i)
        const targetAudienceIdx = findColIndex(/target.*audience|audience/i)
        const businessUnitIdx = findColIndex(/business.*unit|bu/i)
        const budgetReqIdx = findColIndex(/budget.*required/i)
        const budgetPhpIdx = findColIndex(/approved.*budget|budget.*php/i)
        const completionIdx = findColIndex(/delivery.*completion|status/i)
        const quarterIdx = findColIndex(/quarter|planned.*quarter/i)
        const datesIdx = findColIndex(/date/i)
        const leadsIdx = findColIndex(/program.*lead|owner|^lead|person.*name|personnel/i)
        const trainerTypeIdx = findColIndex(/trainer.*type/i)
        const trainersIdx = findColIndex(/internal.*trainer|facilitator|trainer.*name|^trainer/i)
        const vendorIdx = findColIndex(/external.*vendor|provider|vendor.*name|^vendor/i)
        const supportIdx = findColIndex(/support.*team|support.*names/i)

        // Diagnostic Mapping Summary
        const mappingInfo = {
          title: titleIdx >= 0 ? fieldNames[titleIdx] : "NOT_FOUND",
          leads: leadsIdx >= 0 ? fieldNames[leadsIdx] : "NOT_FOUND",
          trainers: trainersIdx >= 0 ? fieldNames[trainersIdx] : "NOT_FOUND",
          vendor: vendorIdx >= 0 ? fieldNames[vendorIdx] : "NOT_FOUND"
        }
        console.log("Column Mapping Detected:", mappingInfo)
        toast.info(`Mapped: Title(${mappingInfo.title}), Leads(${mappingInfo.leads}), Trainers(${mappingInfo.trainers})`)


        const normalized: ProcessedProgramRow[] = []

        dataRows.forEach((row, index) => {
          // If the row is completely empty, skip it
          if (!row || row.length === 0 || row.every((cell: any) => cell === undefined || cell === null || cell === "")) return

          // Basic string fallback
          const getVal = (idx: number) => idx >= 0 && idx < row.length && row[idx] !== undefined && row[idx] !== null ? String(row[idx]).trim() : ""

          const rawTitle = getVal(titleIdx)
          
          const messages: string[] = []
          let rowStatus: 'valid' | 'warning' | 'error' = 'valid'

          // 1. Mandatory Field: Program Title
          if (!rawTitle) {
            rowStatus = 'error'
            messages.push("Missing Program Title")
          }
          
          const programTitle = rawTitle.toUpperCase()

          // 2. Normalization: Assigned Unit
          let assignedUnit = getVal(unitIdx).toUpperCase()
          const validUnits = ["LSE", "TD", "DEIB", "EX"]
          // normalize common mistakes
          if (assignedUnit.includes("LEADERSHIP")) assignedUnit = "LSE"
          else if (assignedUnit.includes("TALENT")) assignedUnit = "TD"
          else if (assignedUnit.includes("DIVERSITY")) assignedUnit = "DEIB"
          else if (assignedUnit.includes("EXPERIENCE")) assignedUnit = "EX"

          if (assignedUnit && !validUnits.includes(assignedUnit)) {
            if (rowStatus !== 'error') rowStatus = 'warning'
            messages.push(`Unknown Assigned Unit: ${getVal(unitIdx) || 'Empty'}`)
          }

          // 3. Normalization: Priority Level
          let rawPriority = getVal(priorityIdx)
          // Strip emojis
          let priorityLevel = rawPriority.replace(/[\u1000-\uFFFF]/g, '').trim().toUpperCase()
          const validPriorities = ["HIGH", "MEDIUM", "LOW"]
          if (priorityLevel && !validPriorities.includes(priorityLevel)) {
            // attempt heuristic
            if (priorityLevel.includes("HIGH")) priorityLevel = "HIGH"
            else if (priorityLevel.includes("MED")) priorityLevel = "MEDIUM"
            else if (priorityLevel.includes("LOW")) priorityLevel = "LOW"
            else if (priorityLevel !== "") {
              if (rowStatus !== 'error') rowStatus = 'warning'
              messages.push(`Unknown Priority Level: ${rawPriority}`)
            }
          }

          // 4. Budget Required
          const budgetRequired = getVal(budgetReqIdx).toUpperCase() === "YES"

          // 5. Approved Budget PHP
          const rawBudgetStr = getVal(budgetPhpIdx)
          let approvedBudgetPhp: number | null = null
          if (rawBudgetStr) {
            // strip currency logic e.g. "?33,333.33" -> 33333.33
            const numericStr = rawBudgetStr.replace(/[^0-9.-]+/g, "")
            if (numericStr) {
               approvedBudgetPhp = parseFloat(numericStr)
            }
          }

          // 6. Derivation: Program Year
          const quarterStr = getVal(quarterIdx)
          const datesStr = getVal(datesIdx)
          let programYear = new Date().getFullYear()
          const yearMatch = datesStr.match(/\b(20\d{2})\b/) || quarterStr.match(/\b(20\d{2})\b/)
          if (yearMatch) {
            programYear = parseInt(yearMatch[1])
          }

          normalized.push({
            id: `gov-${index}-${Date.now()}`,
            programTitle: programTitle || `[Row ${index + 5}]`,
            assignedUnit,
            priorityLevel,
            targetAudience: getVal(targetAudienceIdx),
            businessUnit: getVal(businessUnitIdx),
            budgetRequired,
            approvedBudgetPhp,
            deliveryCompletion: getVal(completionIdx),
            programYear,
            programLead: getVal(leadsIdx),
            trainerType: getVal(trainerTypeIdx),
            internalTrainers: getVal(trainersIdx),
            externalVendor: getVal(vendorIdx),
            supportTeam: getVal(supportIdx),
            rowStatus,
            validationMessages: messages
          })
        })

        setProcessedData(normalized)
        setStep('preview')
        
        const errCount = normalized.filter(r => r.rowStatus === 'error').length
        if (errCount > 0) {
          toast.warning(`Parsed with ${errCount} errors to review.`)
        } else {
          toast.success(`Successfully mapped ${normalized.length} program records.`)
        }
      } catch (error) {
        console.error(error)
        toast.error("Failed to parse Excel file. Make sure the format matches the standard tracker.")
      } finally {
        setIsLoading(false)
      }
    }
    reader.readAsBinaryString(file)
  }

  const handleFinish = async () => {
    setIsSaving(true)
    const validRows = processedData.filter(r => r.rowStatus !== 'error')
    const errorCount = processedData.filter(r => r.rowStatus === 'error').length

    // Produce validation log for the batch
    const validationLog = processedData.map(r => ({
      row_id: r.id,
      title: r.programTitle,
      status: r.rowStatus,
      messages: r.validationMessages
    }))

    const counts = {
      parsed: processedData.length,
      imported: validRows.length,
      rejected: errorCount
    }

    try {
      const result = await persistUploadBatch(fileName, validRows, validationLog, counts)

      if (result && result.success) {
        toast.success(`Successfully saved ${validRows.length} programs to the Database.`)
        setStep('upload')
        setProcessedData([])
        if (fileInputRef.current) fileInputRef.current.value = ""
      } else {
        toast.error(result?.error || "Failed to save records.")
      }
    } catch (e) {
      toast.error("An unexpected error occurred while saving.")
    } finally {
      setIsSaving(false)
    }
  }

  const handleClear = () => {
    setStep('upload')
    setProcessedData([])
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const filteredData = processedData.filter(row => 
    row.programTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
    row.assignedUnit.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">Import Governance Tracker</h1>
          <p className="text-zinc-500 dark:text-zinc-400">Step {step === 'upload' ? '1' : '2'}: {
            step === 'upload' ? 'Upload Tracker Excel' : 'Review & Normalize'
          }</p>
        </div>
        <div className="flex gap-2">
          {step !== 'upload' && (
            <Button variant="outline" onClick={handleClear} className="text-zinc-500" disabled={isSaving}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Reset
            </Button>
          )}
          {step === 'upload' && (
            <>
              <input type="file" accept=".xlsx, .xls, .csv" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
              <Button className="bg-[#0046ab] hover:bg-[#003a8f] text-white" onClick={() => fileInputRef.current?.click()} disabled={isLoading}>
                {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileUp className="h-4 w-4 mr-2" />}
                Select File
              </Button>
            </>
          )}
        </div>
      </div>

      {step === 'upload' && (
        <Card className="border-dashed border-2 bg-transparent flex flex-col items-center justify-center py-24 text-center">
          <div className="h-20 w-20 rounded-full bg-zinc-100 flex items-center justify-center mb-6 dark:bg-zinc-800">
            <Shield className="h-10 w-10 text-zinc-400" />
          </div>
          <h3 className="text-xl font-semibold mb-2">Upload Program Tracker</h3>
          <p className="text-zinc-500 max-w-md px-4">
            Upload the structured program tracker Excel data (Row 3 for Context Groups, Row 4 for Field Names). We will automatically parse, transform, and validate your data for DB induction.
          </p>
        </Card>
      )}

      {step === 'preview' && (
        <Card className="border-none shadow-md overflow-hidden">
          <CardHeader className="bg-white dark:bg-zinc-900 border-b pb-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-lg">Normalized Program Records</CardTitle>
                <CardDescription>Processed {processedData.length} records. Invalid rows will be rejected during save.</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative w-full md:w-64">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-500" />
                  <Input placeholder="Search titles or units..." className="pl-9" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[500px] w-full">
              <Table containerClassName="min-w-full w-fit">
                <TableHeader className="bg-zinc-50 sticky top-0 z-10 dark:bg-zinc-800">
                  <TableRow>
                    <TableHead className="w-[50px]"></TableHead>
                    <TableHead className="min-w-[250px]">Program Title</TableHead>
                    <TableHead>Assigned Unit</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Program Lead</TableHead>
                    <TableHead>Trainer(s)</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead className="text-center">Budget Required</TableHead>
                    <TableHead className="text-right">Approved Budget PHP</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredData.map((row) => (
                    <TableRow key={row.id} className={row.rowStatus === 'error' ? 'bg-red-50/50 hover:bg-red-50' : row.rowStatus === 'warning' ? 'bg-amber-50/50 hover:bg-amber-50' : ''}>
                      <TableCell>
                        {row.rowStatus === 'valid' && <CheckCircle2 className="h-5 w-5 text-green-500" />}
                        {row.rowStatus === 'warning' && <span title={row.validationMessages.join(', ')}><AlertTriangle className="h-5 w-5 text-amber-500" /></span>}
                        {row.rowStatus === 'error' && <span title={row.validationMessages.join(', ')}><XCircle className="h-5 w-5 text-red-500" /></span>}
                      </TableCell>
                      <TableCell className="font-medium">
                        <div className="flex flex-col">
                          <span>{row.programTitle}</span>
                          {row.validationMessages.length > 0 && (
                            <span className={`text-xs mt-1 ${row.rowStatus === 'error' ? 'text-red-500' : 'text-amber-600'}`}>
                              {row.validationMessages.join(' • ')}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{row.assignedUnit}</TableCell>
                      <TableCell>
                        {row.priorityLevel && (
                          <Badge variant="outline" className={
                            row.priorityLevel === "HIGH" ? "text-red-600 border-red-200 bg-red-50" : 
                            row.priorityLevel === "MEDIUM" ? "text-amber-600 border-amber-200 bg-amber-50" : 
                            "text-green-600 border-green-200 bg-green-50"
                          }>
                            {row.priorityLevel}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-zinc-600 truncate max-w-[120px]" title={row.programLead}>
                        {row.programLead || <span className="text-red-400 font-bold italic">Missing</span>}
                      </TableCell>
                      <TableCell className="text-xs text-zinc-600 truncate max-w-[120px]" title={row.internalTrainers}>
                        {row.internalTrainers || <span className="text-zinc-400 italic">N/A</span>}
                      </TableCell>
                      <TableCell className="text-xs text-zinc-600">
                        {row.trainerType || "N/A"}
                      </TableCell>
                      <TableCell className="text-xs text-zinc-600 truncate max-w-[120px]" title={row.externalVendor}>
                        {row.externalVendor || "N/A"}
                      </TableCell>
                      <TableCell className="text-center">
                        {row.budgetRequired ? (
                          <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-none">YES</Badge>
                        ) : (
                          <span className="text-zinc-500 text-sm">NO</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium text-zinc-700">
                        {row.approvedBudgetPhp !== null 
                          ? new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(row.approvedBudgetPhp) 
                          : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredData.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-zinc-500 py-8">
                        No records found matching your search.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
          <div className="p-4 border-t bg-zinc-50 dark:bg-zinc-900/50 flex justify-between items-center">
            <div className="text-sm text-zinc-500">
              <span className="font-medium text-green-600">{processedData.filter(r => r.rowStatus !== 'error').length}</span> valid records ready to import.
              {processedData.some(r => r.rowStatus === 'error') && (
                <span className="ml-2 font-medium text-red-500">{processedData.filter(r => r.rowStatus === 'error').length} rows will be rejected.</span>
              )}
            </div>
            <Button 
              className="bg-[#0046ab] hover:bg-[#003a8f] text-white" 
              onClick={handleFinish}
              disabled={isSaving || processedData.filter(r => r.rowStatus !== 'error').length === 0}
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              {isSaving ? "Saving..." : "Save Valid Records to Database"}
            </Button>
          </div>
        </Card>
      )}
    </div>
  )
}
