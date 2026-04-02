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
  ClipboardList,
  BarChart3
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface RowData {
  id: string
  [key: string]: any
}

type Step = 'upload' | 'filter' | 'preview'
type ImportType = 'status' | 'courses'

export default function ExcelUploadPage() {
  const [step, setStep] = useState<Step>('upload')
  const [importType, setImportType] = useState<ImportType>('status')
  const [rawData, setRawData] = useState<any[]>([])
  const [fileName, setFileName] = useState("")
  const [processedData, setProcessedData] = useState<RowData[]>([])
  const [columns, setColumns] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")

  // Filter states
  const [locationCol, setLocationCol] = useState("")
  const [duCol, setDuCol] = useState("")
  const [roleCol, setRoleCol] = useState("")
  const [userTypeCol, setUserTypeCol] = useState("")

  const [selectedLocations, setSelectedLocations] = useState<string[]>([])
  const [selectedDUs, setSelectedDUs] = useState<string[]>([])
  const [selectedRoles, setSelectedRoles] = useState<string[]>([])
  const [selectedUserTypes, setSelectedUserTypes] = useState<string[]>([])

  const fileInputRef = useRef<HTMLInputElement>(null)

  const uniqueFilterValues = useMemo(() => {
    if (rawData.length === 0) return { locations: [], dus: [], roles: [], userTypes: [] }
    const headers = Object.keys(rawData[0])

    // Auto-detect columns
    const locHeader = headers.find(h => /location|site|region/i.test(h)) || headers[0]
    const duHeader = headers.find(h => /du|delivery unit|department|dept/i.test(h)) || headers[1]
    const roleHeader = headers.find(h => /role|job title|position/i.test(h)) || "Role"
    const userTypeHeader = headers.find(h => /user type|usertype|type/i.test(h)) || "User type"

    setLocationCol(locHeader)
    setDuCol(duHeader)
    setRoleCol(roleHeader)
    setUserTypeCol(userTypeHeader)

    const locations = Array.from(new Set(rawData.map(r => String(r[locHeader] || "Unknown")))).sort()
    const dus = Array.from(new Set(rawData.map(r => String(r[duHeader] || "Unknown")))).sort()
    const roles = Array.from(new Set(rawData.map(r => String(r[roleHeader] || "Unknown")))).sort()
    const userTypes = Array.from(new Set(rawData.map(r => String(r[userTypeHeader] || "Unknown")))).sort()

    return { locations, dus, roles, userTypes }
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
        let jsonData = utils.sheet_to_json(sheet) as any[]

        if (!jsonData || jsonData.length === 0) {
          toast.error("The uploaded file is empty")
          setIsLoading(false)
          return
        }

        // Intercept headers to explicitly merge "First name" and "Last name"
        // into a solitary "Name" column if one doesn't already natively exist.
        jsonData = jsonData.map((row: any) => {
          const keys = Object.keys(row)
          const exactNameCol = keys.find(k => k.trim().toLowerCase() === 'name')

          if (!exactNameCol) {
            const firstNameKey = keys.find(k => /first\s*name/i.test(k.trim()))
            const lastNameKey = keys.find(k => /last\s*name/i.test(k.trim()))

            if (firstNameKey && lastNameKey) {
              // Construct new object enforcing 'Name' exactly at index 0 natively
              const newRow: any = {}
              newRow['Name'] = `${String(row[lastNameKey]).trim()}, ${String(row[firstNameKey]).trim()}`

              keys.forEach(k => {
                if (k !== firstNameKey && k !== lastNameKey) {
                  newRow[k] = row[k]
                }
              })

              return newRow
            }
          }
          return row;
        })

        // Validate headers for 'courses' type
        if (importType === 'courses') {
          const headers = Object.keys(jsonData[0] as any)
          const required = ['Name', 'Assigned Courses', 'Completed Courses', 'Delivery Unit', 'Project Name', 'Name of Immediate Supervisor']
          const missing = required.filter(r => !headers.some(h => h.toLowerCase() === r.toLowerCase()))

          if (missing.length > 0) {
            toast.error(`Missing columns: ${missing.join(", ")}`)
            setIsLoading(false)
            return
          }
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
    const isStatus = importType === 'status'

    if (isStatus && (selectedLocations.length === 0 || selectedRoles.length === 0)) {
      toast.error(`Please select at least one Location and one Role`)
      return
    }
    if (!isStatus && selectedUserTypes.length === 0) {
      toast.error(`Please select at least one User type`)
      return
    }
    if (selectedDUs.length === 0) {
      toast.error(`Please select at least one Delivery Unit`)
      return
    }
    setIsLoading(true)

    setTimeout(() => {
      const filtered = rawData.filter(row => {
        const loc = String(row[locationCol] || "Unknown")
        const du = String(row[duCol] || "Unknown")
        const role = String(row[roleCol] || "Unknown")
        const userType = String(row[userTypeCol] || "Unknown")

        let match = selectedDUs.includes(du);
        if (isStatus) {
          match = match && selectedLocations.includes(loc) && selectedRoles.includes(role);
        } else {
          match = match && selectedUserTypes.includes(userType);
        }
        return match;
      }).map((row, index) => ({
        ...row,
        id: `row-${index}-${Date.now()}`
      }))

      if (filtered.length === 0) {
        toast.error("No records matched the selected filters")
        setIsLoading(false)
        return
      }

      const uploadTime = new Date().toLocaleString()
      const existingLogs = JSON.parse(localStorage.getItem("lms_audit_logs") || "[]")
      let newLog: any = {
        id: `log-${Date.now()}`,
        fileName,
        date: uploadTime,
        count: filtered.length,
        importType,
        cleanedData: filtered
      }

      if (importType === 'status') {
        // Status Completion Logic
        const statusKey = Object.keys(filtered[0]).find(k => /status/i.test(k)) || "Status"

        // Fix status values if they are numeric or suffer case-sensitivity variants
        const processedFiltered = filtered.map(row => {
          const statusVal = row[statusKey]
          if (/^\d+%?$/.test(String(statusVal)) || (typeof statusVal === 'number')) {
            row[statusKey] = "Ongoing"
          } else if (typeof statusVal === 'string') {
            const lower = statusVal.trim().toLowerCase()
            if (lower === 'not started') row[statusKey] = 'Not Started'
            else if (lower === 'ongoing') row[statusKey] = 'Ongoing'
            else if (lower === 'completed') row[statusKey] = 'Completed'
          }
          return row
        })

        const statusCounts: Record<string, number> = {}
        processedFiltered.forEach(row => {
          const status = row[statusKey] || "Not Started"
          statusCounts[status] = (statusCounts[status] || 0) + 1
        })

        const total = processedFiltered.length
        const statusSummary = Object.entries(statusCounts).map(([status, count]) => {
          const rate = (count / total) * 100
          return { status, count, rate: rate < 1 && rate > 0 ? "<1%" : `${rate.toFixed(1)}%` }
        }).sort((a, b) => b.status.localeCompare(a.status))

        const deptKey = Object.keys(processedFiltered[0]).find(k => /department|dept|du|unit/i.test(k)) || duCol
        const depts: Record<string, any> = {}
        processedFiltered.forEach(row => {
          const key = String(row[deptKey] || "Unknown")
          if (!depts[key]) depts[key] = { total: 0, completed: 0, ongoing: 0, notStarted: 0 }
          depts[key].total += 1
          const s = String(row[statusKey]).toLowerCase()
          if (s === "completed") depts[key].completed += 1
          else if (s === "ongoing") depts[key].ongoing += 1
          else depts[key].notStarted += 1
        })

        const deptSummary = Object.entries(depts).map(([name, stats]: [string, any]) => ({
          name,
          total: stats.total,
          completed: stats.completed,
          ongoing: stats.ongoing,
          notStarted: stats.notStarted,
          rate: `${((stats.completed / stats.total) * 100).toFixed(1)}%`
        })).sort((a, b) => b.name.localeCompare(a.name))

        const mgrKey = Object.keys(processedFiltered[0]).find(k => /manager|supervisor|immediate/i.test(k)) || "Manager"
        const mgrs: Record<string, any> = {}
        processedFiltered.forEach(row => {
          const key = String(row[mgrKey] || "Unknown")
          if (!mgrs[key]) mgrs[key] = { total: 0, completed: 0, ongoing: 0, notStarted: 0 }
          mgrs[key].total += 1
          const s = String(row[statusKey]).toLowerCase()
          if (s === "completed") mgrs[key].completed += 1
          else if (s === "ongoing") mgrs[key].ongoing += 1
          else mgrs[key].notStarted += 1
        })

        const mgrSummary = Object.entries(mgrs).map(([name, stats]: [string, any]) => ({
          name,
          total: stats.total,
          completed: stats.completed,
          ongoing: stats.ongoing,
          notStarted: stats.notStarted,
          rate: `${((stats.completed / stats.total) * 100).toFixed(1)}%`
        })).sort((a, b) => b.name.localeCompare(a.name))

        newLog = { ...newLog, statusSummary, deptSummary, mgrSummary }
      } else {
        // Assigned/Completed Courses Logic
        const nameKey = Object.keys(filtered[0]).find(k => /name/i.test(k) && !/manager|supervisor|unit/i.test(k)) || "Name"
        const assignedKey = Object.keys(filtered[0]).find(k => /assigned/i.test(k)) || "Assigned Courses"
        const completedKey = Object.keys(filtered[0]).find(k => /completed/i.test(k) && !/status/i.test(k)) || "Completed Courses"
        const duKey = Object.keys(filtered[0]).find(k => /delivery unit|department|dept/i.test(k)) || duCol

        // Dept Aggregation
        const depts: Record<string, any> = {}
        filtered.forEach(row => {
          const key = String(row[duKey] || "Unknown")
          if (!depts[key]) depts[key] = { name: key, assigned: 0, completed: 0 }
          depts[key].assigned += Number(row[assignedKey] || 0)
          depts[key].completed += Number(row[completedKey] || 0)
        })

        const deptSummary = Object.entries(depts).map(([_, stats]: [string, any]) => ({
          ...stats,
          rate: stats.assigned > 0 ? `${((stats.completed / stats.assigned) * 100).toFixed(1)}%` : "0.0%"
        })).sort((a, b) => b.assigned - a.assigned)

        // Employee Aggregation
        const employees: Record<string, any> = {}
        filtered.forEach(row => {
          const key = String(row[nameKey] || "Unknown")
          if (!employees[key]) employees[key] = { name: key, assigned: 0, completed: 0 }
          employees[key].assigned += Number(row[assignedKey] || 0)
          employees[key].completed += Number(row[completedKey] || 0)
        })

        const employeeSummary = Object.entries(employees).map(([_, stats]: [string, any]) => ({
          ...stats,
          rate: stats.assigned > 0 ? `${((stats.completed / stats.assigned) * 100).toFixed(1)}%` : "0.0%"
        })).sort((a, b) => b.assigned - a.assigned)

        newLog = { ...newLog, deptSummary, employeeSummary }
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
    setSelectedRoles([])
    setSelectedUserTypes([])
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const handleClear = () => {
    setStep('upload')
    setRawData([])
    setProcessedData([])
    setSelectedLocations([])
    setSelectedDUs([])
    setSelectedRoles([])
    setSelectedUserTypes([])
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
        <div className="space-y-6">
          <Tabs defaultValue="status" className="w-full" onValueChange={(v) => setImportType(v as ImportType)}>
            <TabsList className="grid w-full grid-cols-2 max-w-md">
              <TabsTrigger value="status" className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                Status Completion
              </TabsTrigger>
              <TabsTrigger value="courses" className="flex items-center gap-2">
                <ClipboardList className="h-4 w-4" />
                Assigned/Completed Courses
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <Card className="border-dashed border-2 bg-transparent flex flex-col items-center justify-center py-24 text-center">
            <div className="h-20 w-20 rounded-full bg-zinc-100 flex items-center justify-center mb-6 dark:bg-zinc-800">
              <FileSpreadsheet className="h-10 w-10 text-zinc-400" />
            </div>
            <h3 className="text-xl font-semibold mb-2">
              Upload {importType === 'status' ? 'Status Completion' : 'Assigned/Completed Courses'} data
            </h3>
            <p className="text-zinc-500 max-w-md px-4">
              {importType === 'status'
                ? "Upload the Excel file with employee status data. You can filter by Location and DU in the next step."
                : "Required columns: Name, Assigned Courses, Completed Courses, Delivery Unit, Project Name, Manager Name."}
            </p>
          </Card>
        </div>
      )}

      {step === 'filter' && (
        <div className={`grid grid-cols-1 ${importType === 'status' ? 'lg:grid-cols-3 md:grid-cols-2' : 'md:grid-cols-2 max-w-4xl mx-auto w-full'} gap-6`}>
          {importType === 'status' && (
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
                      <Label htmlFor="all-locs" className="font-bold">Select All</Label>
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
          )}

          {importType === 'status' && (
            <Card className="border-none shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2"><Filter className="h-5 w-5 text-[#0046ab]" />Select Roles</CardTitle>
                <CardDescription>Detected in column: <span className="font-semibold">{roleCol}</span></CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px] pr-4">
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2 pb-2 border-b">
                      <Checkbox id="all-roles" checked={selectedRoles.length === uniqueFilterValues.roles.length} onCheckedChange={(checked) => setSelectedRoles(checked ? uniqueFilterValues.roles : [])} />
                      <Label htmlFor="all-roles" className="font-bold">Select All</Label>
                    </div>
                    {uniqueFilterValues.roles.map(role => (
                      <div key={role} className="flex items-center space-x-2">
                        <Checkbox id={`role-${role}`} checked={selectedRoles.includes(role)} onCheckedChange={() => setSelectedRoles(prev => prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role])} />
                        <Label htmlFor={`role-${role}`}>{role}</Label>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          {importType === 'courses' && (
            <Card className="border-none shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2"><Filter className="h-5 w-5 text-[#0046ab]" />Select User Types</CardTitle>
                <CardDescription>Detected in column: <span className="font-semibold">{userTypeCol}</span></CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px] pr-4">
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2 pb-2 border-b">
                      <Checkbox id="all-usertypes" checked={selectedUserTypes.length === uniqueFilterValues.userTypes.length} onCheckedChange={(checked) => setSelectedUserTypes(checked ? uniqueFilterValues.userTypes : [])} />
                      <Label htmlFor="all-usertypes" className="font-bold">Select All</Label>
                    </div>
                    {uniqueFilterValues.userTypes.map(ut => (
                      <div key={ut} className="flex items-center space-x-2">
                        <Checkbox id={`ut-${ut}`} checked={selectedUserTypes.includes(ut)} onCheckedChange={() => setSelectedUserTypes(prev => prev.includes(ut) ? prev.filter(u => u !== ut) : [...prev, ut])} />
                        <Label htmlFor={`ut-${ut}`}>{ut}</Label>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}

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
                    <Label htmlFor="all-dus" className="font-bold">Select All</Label>
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
                <p className="text-sm text-zinc-500">
                  Ready to process records
                </p>
                <Button
                  onClick={applyFiltersAndProcess}
                  disabled={isLoading || (importType === 'status' && (selectedLocations.length === 0 || selectedRoles.length === 0)) || (!importType || importType === 'courses' ? selectedUserTypes.length === 0 : false) || selectedDUs.length === 0}
                  className="bg-[#0046ab] hover:bg-[#003a8f] text-white"
                >
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
                <CardDescription>Showing {filteredData.length} records</CardDescription>
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
