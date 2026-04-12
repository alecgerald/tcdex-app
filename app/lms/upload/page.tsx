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
  ChevronRight
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

interface RowData {
  id: string
  [key: string]: any
}

type Step = 'upload' | 'filter' | 'preview'

export default function ExcelUploadPage() {
  const [step, setStep] = useState<Step>('upload')
  const [rawData, setRawData] = useState<any[]>([])
  const [fileName, setFileName] = useState("")
  const [processedData, setProcessedData] = useState<RowData[]>([])
  const [columns, setColumns] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  
  // Filter states
  const [locationCol, setLocationCol] = useState("")
  const [duCol, setDuCol] = useState("")
  const [selectedLocations, setSelectedLocations] = useState<string[]>([])
  const [selectedDUs, setSelectedDUs] = useState<string[]>([])
  
  const fileInputRef = useRef<HTMLInputElement>(null)

  const uniqueFilterValues = useMemo(() => {
    if (rawData.length === 0) return { locations: [], dus: [] }
    const headers = Object.keys(rawData[0])
    const locHeader = headers.find(h => /location|site|region/i.test(h)) || headers[0]
    const duHeader = headers.find(h => /du|delivery unit|department|dept/i.test(h)) || headers[1]
    setLocationCol(locHeader)
    setDuCol(duHeader)
    const locations = Array.from(new Set(rawData.map(r => String(r[locHeader] || "Unknown")))).sort()
    const dus = Array.from(new Set(rawData.map(r => String(r[duHeader] || "Unknown")))).sort()
    return { locations, dus }
  }, [rawData])

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
        
        let jsonData: any[] = []
        let foundHeaders = false

        // AUTO-SCAN: Try Row 1 to 5 to find a row with a "Status" or "Location" column
        for (let i = 0; i < 5; i++) {
          const attemptData = utils.sheet_to_json(sheet, { range: i }) as any[]
          if (attemptData.length > 0) {
            const headers = Object.keys(attemptData[0])
            const hasKeyColumns = headers.some(h => /status|location|site|department|du/i.test(h))
            if (hasKeyColumns) {
              jsonData = attemptData
              foundHeaders = true
              break
            }
          }
        }

        if (!foundHeaders || jsonData.length === 0) {
          toast.error("Could not find valid headers in the first 5 rows. Please ensure 'Status' or 'Location' columns exist.")
          setIsLoading(false)
          return
        }

        setRawData(jsonData)
        setStep('filter')
        toast.success("File read successfully. Please select filters.")
      } catch (error) {
        toast.error("Failed to parse Excel file")
      } finally {
        setIsLoading(false)
      }
    }
    reader.readAsBinaryString(file)
  }

  const applyFiltersAndProcess = () => {
    if (selectedLocations.length === 0 || selectedDUs.length === 0) {
      toast.error("Please select at least one Location and one Delivery Unit")
      return
    }
    setIsLoading(true)
    setTimeout(() => {
      const filtered = rawData.filter(row => {
        const loc = String(row[locationCol] || "Unknown")
        const du = String(row[duCol] || "Unknown")
        return selectedLocations.includes(loc) && selectedDUs.includes(du)
      }).map((row, index) => {
        const newRow = { ...row }
        const statusKey = Object.keys(newRow).find(k => /status/i.test(k)) || "Status"
        const statusVal = newRow[statusKey]
        if (/^\d+%?$/.test(String(statusVal)) || (typeof statusVal === 'number')) {
          newRow[statusKey] = "Ongoing"
        }
        return { ...newRow, id: `row-${index}-${Date.now()}` }
      })

      if (filtered.length === 0) {
        toast.error("No records matched the selected filters")
        setIsLoading(false)
        return
      }

      // 1. Output 1: Status Summary
      const statusKey = Object.keys(filtered[0]).find(k => /status/i.test(k)) || "Status"
      const statusCounts: Record<string, number> = {}
      filtered.forEach(row => {
        const status = row[statusKey] || "Not Started"
        statusCounts[status] = (statusCounts[status] || 0) + 1
      })
      const total = filtered.length
      const statusSummary = Object.entries(statusCounts).map(([status, count]) => {
        const rate = (count / total) * 100
        return { status, count, rate: rate < 1 && rate > 0 ? "<1%" : `${rate.toFixed(1)}%` }
      }).sort((a, b) => b.status.localeCompare(a.status))

      // 2. Output 2: Department Summary
      const deptKey = Object.keys(filtered[0]).find(k => /department|dept|du|unit/i.test(k)) || duCol
      const depts: Record<string, { total: number, completed: number }> = {}
      filtered.forEach(row => {
        const key = String(row[deptKey] || "Unknown")
        if (!depts[key]) depts[key] = { total: 0, completed: 0 }
        depts[key].total += 1
        if (String(row[statusKey]).toLowerCase() === "completed") depts[key].completed += 1
      })
      const deptSummary = Object.entries(depts).map(([name, stats]) => ({
        name,
        total: stats.total,
        completed: stats.completed,
        rate: `${((stats.completed / stats.total) * 100).toFixed(1)}%`
      })).sort((a, b) => b.name.localeCompare(a.name))

      // 3. Output 3: Manager Summary
      const mgrKey = Object.keys(filtered[0]).find(k => /manager|supervisor|immediate/i.test(k)) || "Manager"
      const mgrs: Record<string, { total: number, completed: number }> = {}
      filtered.forEach(row => {
        const key = String(row[mgrKey] || "Unknown")
        if (!mgrs[key]) mgrs[key] = { total: 0, completed: 0 }
        mgrs[key].total += 1
        if (String(row[statusKey]).toLowerCase() === "completed") mgrs[key].completed += 1
      })
      const mgrSummary = Object.entries(mgrs).map(([name, stats]) => ({
        name,
        total: stats.total,
        completed: stats.completed,
        rate: `${((stats.completed / stats.total) * 100).toFixed(1)}%`
      })).sort((a, b) => b.name.localeCompare(a.name))

      const uploadTime = new Date().toISOString()
      const existingLogs = JSON.parse(localStorage.getItem("lms_audit_logs") || "[]")
      
      const newLog = { 
        id: `log-${Date.now()}`,
        fileName, 
        date: uploadTime, 
        count: filtered.length,
        statusSummary,
        deptSummary,
        mgrSummary
      }
      
      localStorage.setItem("lms_audit_logs", JSON.stringify([newLog, ...existingLogs]))
      setProcessedData(filtered)
      setColumns(Object.keys(filtered[0]).filter(c => c !== 'id'))
      setStep('preview')
      setIsLoading(false)
      toast.success(`Processed ${filtered.length} records`)
    }, 500)
  }

  const handleFinish = () => {
    toast.success("File added to dashboard successfully")
    setStep('upload')
    setRawData([])
    setProcessedData([])
    setSelectedLocations([])
    setSelectedDUs([])
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const handleClear = () => {
    setStep('upload')
    setRawData([])
    setProcessedData([])
    setSelectedLocations([])
    setSelectedDUs([])
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const filteredData = processedData.filter(row => 
    Object.values(row).some(val => String(val).toLowerCase().includes(searchTerm.toLowerCase()))
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">Import Excel</h1>
          <p className="text-zinc-500 dark:text-zinc-400">Step {step === 'upload' ? '1' : step === 'filter' ? '2' : '3'}: {
            step === 'upload' ? 'Upload File' : step === 'filter' ? 'Select Filters' : 'Review Results'
          }</p>
        </div>
        <div className="flex gap-2">
          {step !== 'upload' && (
            <Button variant="outline" onClick={handleClear} className="text-zinc-500">
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
            <FileSpreadsheet className="h-10 w-10 text-zinc-400" />
          </div>
          <h3 className="text-xl font-semibold mb-2">Upload Academy LMS data</h3>
          <p className="text-zinc-500 max-w-md px-4">Upload the Excel file to begin. You will be able to choose which Delivery Units and Locations to process in the next step.</p>
        </Card>
      )}

      {step === 'filter' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2"><Filter className="h-5 w-5 text-[#0046ab]" />Select Locations</CardTitle>
              <CardDescription>Detected in column: <span className="font-semibold">{locationCol}</span></CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px] pr-4">
                <div className="space-y-3">
                  <div className="flex items-center space-x-2 pb-2 border-b">
                    <Checkbox id="all-locs" checked={selectedLocations.length === uniqueFilterValues.locations.length} onCheckedChange={(checked) => setSelectedLocations(checked ? uniqueFilterValues.locations : [])} />
                    <Label htmlFor="all-locs" className="font-bold">Select All Locations</Label>
                  </div>
                  {uniqueFilterValues.locations.map(loc => (
                    <div key={loc} className="flex items-center space-x-2">
                      <Checkbox id={`loc-${loc}`} checked={selectedLocations.includes(loc)} onCheckedChange={() => setSelectedLocations(prev => prev.includes(loc) ? prev.filter(l => l !== loc) : [...prev, loc])} />
                      <Label htmlFor={`loc-${loc}`}>{loc}</Label>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm flex flex-col">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2"><Filter className="h-5 w-5 text-[#0046ab]" />Select Delivery Units</CardTitle>
              <CardDescription>Detected in column: <span className="font-semibold">{duCol}</span></CardDescription>
            </CardHeader>
            <CardContent className="flex-1">
              <ScrollArea className="h-[300px] pr-4">
                <div className="space-y-3">
                  <div className="flex items-center space-x-2 pb-2 border-b">
                    <Checkbox id="all-dus" checked={selectedDUs.length === uniqueFilterValues.dus.length} onCheckedChange={(checked) => setSelectedDUs(checked ? uniqueFilterValues.dus : [])} />
                    <Label htmlFor="all-dus" className="font-bold">Select All DUs</Label>
                  </div>
                  {uniqueFilterValues.dus.map(du => (
                    <div key={du} className="flex items-center space-x-2">
                      <Checkbox id={`du-${du}`} checked={selectedDUs.includes(du)} onCheckedChange={() => setSelectedDUs(prev => prev.includes(du) ? prev.filter(d => d !== du) : [...prev, du])} />
                      <Label htmlFor={`du-${du}`}>{du}</Label>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
            <div className="p-6 pt-0 border-t">
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-zinc-500">{selectedLocations.length} locations & {selectedDUs.length} DUs selected</p>
                <Button onClick={applyFiltersAndProcess} disabled={isLoading || selectedLocations.length === 0 || selectedDUs.length === 0} className="bg-[#0046ab] hover:bg-[#003a8f] text-white">
                  {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ChevronRight className="h-4 w-4 mr-2" />}
                  Process Data
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {step === 'preview' && (
        <Card className="border-none shadow-md overflow-hidden">
          <CardHeader className="bg-white dark:bg-zinc-900 border-b pb-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-lg">Cleaned Records Preview</CardTitle>
                <CardDescription>Showing {filteredData.length} records. (Anonymized summary will be saved).</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative w-full md:w-64">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-500" />
                  <Input placeholder="Search records..." className="pl-9" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
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
                          {/status/i.test(col) ? (
                            <Badge variant="outline" className={row[col] === "Completed" ? "text-green-600 border-green-200 bg-green-50" : row[col] === "Ongoing" ? "text-blue-600 border-blue-200 bg-blue-50" : "text-red-600 border-red-200 bg-red-50"}>
                              {row[col]}
                            </Badge>
                          ) : (
                            String(row[col])
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
          <div className="p-4 border-t bg-zinc-50 dark:bg-zinc-900/50 flex justify-end">
            <Button className="bg-[#0046ab] hover:bg-[#003a8f] text-white" onClick={handleFinish}>
              <Check className="h-4 w-4 mr-2" />
              Add to Dashboard
            </Button>
          </div>
        </Card>
      )}
    </div>
  )
}
