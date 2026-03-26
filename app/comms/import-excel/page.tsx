"use client"

import { useState, useRef } from "react"
import { 
  FileUp, 
  FileSpreadsheet, 
  RefreshCw, 
  Loader2, 
  Check,
  Search,
  Facebook,
  Instagram,
  Play,
  Linkedin,
  ArrowRight
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"

interface ImportData {
  id: string
  fileName: string
  uploadedAt: string
  type: string
  rows: any[]
}

export default function CommsImportExcelPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [data, setData] = useState<ImportData | null>(null)
  const [activeUploadType, setActiveUploadType] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)

  const uploadTypes = [
    { id: "facebook-visits", name: "Facebook Visits", description: "Upload Facebook page visits data", icon: Facebook, color: "text-blue-600", bgColor: "bg-blue-50 dark:bg-blue-900/20" },
    { id: "instagram-views", name: "Instagram Views", description: "Upload Instagram profile views data", icon: Instagram, color: "text-pink-600", bgColor: "bg-pink-50 dark:bg-pink-900/20" },
    { id: "tiktok-overview", name: "Tiktok Overview", description: "Upload Tiktok performance overview", icon: Play, color: "text-zinc-900 dark:text-zinc-100", bgColor: "bg-zinc-100 dark:bg-zinc-800" },
    { id: "linkedin-analytics", name: "LinkedIn Analytics", description: "Upload LinkedIn page analytics", icon: Linkedin, color: "text-blue-700", bgColor: "bg-blue-50 dark:bg-blue-900/20" },
  ]

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !activeUploadType) return

    setIsLoading(true)
    const extension = file.name.split('.').pop()?.toLowerCase()

    try {
      if (extension === 'csv') {
        const Papa = (await import('papaparse')).default
        
        if (activeUploadType === "facebook-visits" || activeUploadType === "instagram-views") {
          // Read as text to skip the first line manually for CSV
          const text = await file.text()
          const lines = text.split(/\r?\n/)
          const csvWithoutFirstLine = lines.slice(1).join('\n')
          
          Papa.parse(csvWithoutFirstLine, {
            header: true,
            dynamicTyping: true,
            skipEmptyLines: 'greedy',
            complete: (results) => {
              const importData: ImportData = {
                id: `log-${Date.now()}`,
                fileName: file.name,
                uploadedAt: new Date().toISOString(),
                type: activeUploadType,
                rows: results.data
              }
              saveAndShowData(importData)
            }
          })
        } else {
          Papa.parse(file, {
            header: true,
            dynamicTyping: true,
            skipEmptyLines: 'greedy',
            complete: (results) => {
              const importData: ImportData = {
                id: `log-${Date.now()}`,
                fileName: file.name,
                uploadedAt: new Date().toISOString(),
                type: activeUploadType,
                rows: results.data
              }
              saveAndShowData(importData)
            }
          })
        }
      } else if (extension === 'xlsx' || extension === 'xls') {
        const xlsxModule = await import('xlsx')
        const XLSX = (xlsxModule as any).default || xlsxModule
        const reader = new FileReader()

        reader.onload = (event) => {
          try {
            const ab = event.target?.result as ArrayBuffer
            const workbook = XLSX.read(new Uint8Array(ab), { type: "array" })
            const sheet = workbook.Sheets[workbook.SheetNames[0]]
            
            let rows: any[] = []
            if (activeUploadType === "facebook-visits" || activeUploadType === "instagram-views") {
              // Use header: 1 to get raw array of arrays
              const dataArray: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 })
              
              if (dataArray.length > 1) {
                // Row 0: Title (e.g., "Facebook visits")
                // Row 1: ["Date", "Primary"]
                const headers = dataArray[1]
                const dataRows = dataArray.slice(2)
                
                rows = dataRows.map(row => {
                  const obj: any = {}
                  headers.forEach((header: string, index: number) => {
                    if (header) {
                      obj[header] = row[index]
                    }
                  })
                  return obj
                })
              }
            } else {
              rows = XLSX.utils.sheet_to_json(sheet)
            }

            const importData: ImportData = {
              id: `log-${Date.now()}`,
              fileName: file.name,
              uploadedAt: new Date().toISOString(),
              type: activeUploadType,
              rows: rows as any[]
            }
            saveAndShowData(importData)
          } catch (error) {
            console.error("Excel error:", error)
            toast.error("Error parsing Excel file")
          } finally {
            setIsLoading(false)
          }
        }
        reader.readAsArrayBuffer(file)
      } else {
        toast.error("Please upload .csv, .xlsx, or .xls files only")
        setIsLoading(false)
      }
    } catch (error) {
      console.error("Import error:", error)
      toast.error("Failed to load import engine")
      setIsLoading(false)
    }
  }

  const saveAndShowData = (importData: ImportData) => {
    const logs = JSON.parse(localStorage.getItem("comms_audit_logs") || "[]")
    localStorage.setItem("comms_audit_logs", JSON.stringify([importData, ...logs]))
    
    if (activeUploadType === "facebook-visits") {
      localStorage.setItem("comms_facebook_visits_data", JSON.stringify(importData))
    } else if (activeUploadType === "instagram-views") {
      localStorage.setItem("comms_instagram_views_data", JSON.stringify(importData))
    }

    setData(importData)
    setIsLoading(false)
    toast.success(`${importData.fileName} imported successfully`)
  }

  const handleFinish = () => {
    setData(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const columns = data?.rows.length ? Object.keys(data.rows[0]) : []
  const filteredData = data?.rows.filter(row => 
    Object.values(row).some(val => String(val).toLowerCase().includes(searchTerm.toLowerCase()))
  ) || []

  if (data && !isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Import Summary</h1>
            <p className="text-zinc-500">{data.fileName}</p>
          </div>
          <Button onClick={handleFinish} className="bg-[#0046ab] text-white hover:bg-[#003a8f]">Done</Button>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Data Preview</CardTitle>
            <CardDescription>{data.rows.length} rows found in file.</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    {columns.map(col => <TableHead key={col}>{col}</TableHead>)}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredData.slice(0, 50).map((row, i) => (
                    <TableRow key={i}>
                      {columns.map(col => <TableCell key={col}>{String(row[col])}</TableCell>)}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Import Excel / CSV</h1>
        <p className="text-zinc-500 mt-1">Select a platform to upload your data file.</p>
      </div>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {uploadTypes.map((type) => (
          <Card key={type.id} className="cursor-pointer hover:shadow-md transition-shadow group" onClick={() => {
            setActiveUploadType(type.id)
            fileInputRef.current?.click()
          }}>
            <CardHeader className={`${type.bgColor} text-center py-8 transition-colors group-hover:opacity-80`}>
              <type.icon className={`h-8 w-8 mx-auto ${type.color}`} />
            </CardHeader>
            <CardContent className="pt-6 text-center">
              <CardTitle className="text-lg font-semibold">{type.name}</CardTitle>
              <CardDescription className="text-sm">{type.description}</CardDescription>
            </CardContent>
          </Card>
        ))}
      </div>
      <input type="file" accept=".xlsx, .xls, .csv" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
    </div>
  )
}
