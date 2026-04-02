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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface ImportData {
  id: string
  fileName: string
  uploadedAt: string
  type: string
  rows: any[]
  sheets?: Record<string, any[]>
}

export default function CommsImportExcelPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [data, setData] = useState<ImportData | null>(null)
  const [activeUploadType, setActiveUploadType] = useState<string>("facebook-visits")
  const [searchTerm, setSearchTerm] = useState("")
  const [activeSheet, setActiveSheet] = useState<string | null>(null)
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

        Papa.parse(file, {
          header: false,
          dynamicTyping: true,
          skipEmptyLines: 'greedy',
          complete: (results) => {
            const dataArray = results.data as any[][];
            let headerRowIndex = 0;

            if (activeUploadType === "facebook-visits" || activeUploadType === "instagram-views" || activeUploadType === "linkedin-analytics") {
              for (let i = 0; i < Math.min(5, dataArray.length); i++) {
                const row = dataArray[i] || [];
                const isHeaderRow = row.length > 1 && row.some((cell: any) => {
                  const c = String(cell).trim().toLowerCase();
                  return c === 'date' || c === 'primary' || c === 'impressions' || c === 'post title' || c === 'campaign name' || c === 'created date';
                });

                if (isHeaderRow) {
                  headerRowIndex = i;
                  break;
                }
              }
            }

            const headers = dataArray[headerRowIndex] || [];
            const dataRows = dataArray.slice(headerRowIndex + 1);

            const mappedRows = dataRows.map(row => {
              const obj: any = {};
              headers.forEach((header: any, index: number) => {
                // Remove invisible BOM characters effectively ensuring clean keys
                const cleanHeader = typeof header === 'string' ? header.replace(/^\uFEFF/, '').trim() : header;
                if (cleanHeader) {
                  obj[cleanHeader] = row[index];
                }
              });
              return obj;
            });

            const importData: ImportData = {
              id: `log-${Date.now()}`,
              fileName: file.name,
              uploadedAt: new Date().toISOString(),
              type: activeUploadType,
              rows: mappedRows
            };
            saveAndShowData(importData);
          }
        });
      } else if (extension === 'xlsx' || extension === 'xls') {
        const xlsxModule = await import('xlsx')
        const XLSX = (xlsxModule as any).default || xlsxModule
        const reader = new FileReader()

        reader.onload = (event) => {
          try {
            const ab = event.target?.result as ArrayBuffer
            const workbook = XLSX.read(new Uint8Array(ab), { type: "array" })
            let allRows: any[] = []
            const sheetsData: Record<string, any[]> = {}

            workbook.SheetNames.forEach((sheetName: string) => {
              const currentSheet = workbook.Sheets[sheetName]

              if (activeUploadType === "facebook-visits" || activeUploadType === "instagram-views" || activeUploadType === "linkedin-analytics") {
                // Apply smart explicit header detection across all major platforms,
                // bypassing structural variables like rogue meta-title rows entirely.
                const dataArray: any[][] = XLSX.utils.sheet_to_json(currentSheet, { header: 1 })
                if (dataArray.length > 0) {
                  let headerRowIndex = 0;

                  // Scan the first 5 rows looking for exact standard column headers
                  for (let i = 0; i < Math.min(5, dataArray.length); i++) {
                    const row = dataArray[i] || [];
                    const isHeaderRow = row.length > 1 && row.some((cell: any) => {
                      const c = String(cell).trim().toLowerCase();
                      return c === 'date' || c === 'primary' || c === 'impressions' || c === 'post title' || c === 'campaign name' || c === 'created date';
                    });

                    if (isHeaderRow) {
                      headerRowIndex = i;
                      break;
                    }
                  }

                  const headers = dataArray[headerRowIndex]
                  const dataRows = dataArray.slice(headerRowIndex + 1)

                  const sheetRows = dataRows.map(row => {
                    const obj: any = {}
                    headers.forEach((header: any, index: number) => {
                      if (header) {
                        obj[header] = row[index]
                      }
                    })
                    return obj
                  })
                  sheetsData[sheetName] = sheetRows
                  allRows = [...allRows, ...sheetRows]
                }
              } else {
                const sheetRows = XLSX.utils.sheet_to_json(currentSheet)
                sheetsData[sheetName] = sheetRows
                allRows = [...allRows, ...sheetRows]
              }
            })

            const importData: ImportData = {
              id: `log-${Date.now()}`,
              fileName: file.name,
              uploadedAt: new Date().toISOString(),
              type: activeUploadType,
              rows: allRows,
              sheets: sheetsData
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
    if (importData.type === "facebook-visits" || importData.type === "instagram-views" || importData.type === "linkedin-analytics" || importData.type === "tiktok-overview") {
      importData.rows = importData.rows.map(row => {
        if (typeof row === 'object' && row !== null) {
          const newRow = { ...row };
          for (const key in newRow) {
            const val = newRow[key];
            if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(val)) {
              newRow[key] = val.split('T')[0];
            }
          }
          return newRow;
        }
        return row;
      });
    }

    const logs = JSON.parse(localStorage.getItem("comms_audit_logs") || "[]")
    localStorage.setItem("comms_audit_logs", JSON.stringify([importData, ...logs]))

    if (importData.type === "facebook-visits") {
      localStorage.setItem("comms_facebook_visits_data", JSON.stringify(importData))
    } else if (importData.type === "instagram-views") {
      localStorage.setItem("comms_instagram_views_data", JSON.stringify(importData))
    } else if (importData.type === "linkedin-analytics") {
      localStorage.setItem("comms_linkedin_analytics_data", JSON.stringify(importData))
    } else if (importData.type === "tiktok-overview") {
      localStorage.setItem("comms_tiktok_overview_data", JSON.stringify(importData))
    }

    setData(importData)
    if (importData.sheets) {
      setActiveSheet(Object.keys(importData.sheets)[0])
    } else {
      setActiveSheet(null)
    }
    setIsLoading(false)
    toast.success(`${importData.fileName} imported successfully`)
  }

  const handleFinish = () => {
    setData(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const currentRows = (data?.sheets && activeSheet) ? data.sheets[activeSheet] : (data?.rows || [])
  const columns = currentRows.length ? Object.keys(currentRows[0]) : []
  const filteredData = currentRows.filter((row: any) =>
    Object.values(row).some(val => String(val).toLowerCase().includes(searchTerm.toLowerCase()))
  ) || []

  if (data && !isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">Import Summary</h1>
            <p className="text-zinc-500 dark:text-zinc-400">Step 2: Review Results</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleFinish} className="text-zinc-500">
              <RefreshCw className="h-4 w-4 mr-2" />
              Reset & Upload Another
            </Button>
            <Button onClick={handleFinish} className="bg-[#0046ab] text-white hover:bg-[#003a8f]">Save Data</Button>
          </div>
        </div>
        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle>Data Preview</CardTitle>
            <CardDescription>{currentRows.length} rows found in {activeSheet ? `sheet "${activeSheet}"` : "file"}.</CardDescription>
            {data.sheets && Object.keys(data.sheets).length > 1 && (
              <div className="flex items-center gap-2 mt-4">
                <span className="text-sm font-medium">Select Sheet:</span>
                <div className="flex flex-wrap gap-2">
                  {Object.keys(data.sheets).map(sheetName => (
                    <Button
                      key={sheetName}
                      variant={activeSheet === sheetName ? "default" : "outline"}
                      size="sm"
                      onClick={() => setActiveSheet(sheetName)}
                    >
                      {sheetName}
                    </Button>
                  ))}
                </div>
              </div>
            )}
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
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">Import Excel</h1>
          <p className="text-zinc-500 dark:text-zinc-400">Step 1: Upload File</p>
        </div>
        <div className="flex gap-2">
          <input type="file" accept=".xlsx, .xls, .csv" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
          <Button className="bg-[#0046ab] hover:bg-[#003a8f] text-white" onClick={() => fileInputRef.current?.click()} disabled={isLoading}>
            {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileUp className="h-4 w-4 mr-2" />}
            Select File
          </Button>
        </div>
      </div>

      <div className="space-y-6">
        <Tabs value={activeUploadType} onValueChange={(v) => setActiveUploadType(v)} className="w-full">
          <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4 max-w-3xl">
            {uploadTypes.map((type) => (
              <TabsTrigger key={type.id} value={type.id} className="flex items-center gap-2">
                <type.icon className={`h-4 w-4 ${activeUploadType === type.id ? type.color : 'text-zinc-400'}`} />
                <span className="hidden sm:inline">{type.name}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <Card className="border-dashed border-2 bg-transparent flex flex-col items-center justify-center py-24 text-center">
          <div className="h-20 w-20 rounded-full bg-zinc-100 flex items-center justify-center mb-6 dark:bg-zinc-800">
            <FileSpreadsheet className="h-10 w-10 text-zinc-400" />
          </div>
          <h3 className="text-xl font-semibold mb-2">
            Upload {uploadTypes.find(t => t.id === activeUploadType)?.name} data
          </h3>
          <p className="text-zinc-500 max-w-md px-4">
            Upload the Excel or CSV file containing your {uploadTypes.find(t => t.id === activeUploadType)?.name} analytics data. Ensure standard platform export formats are used.
          </p>
        </Card>
      </div>
    </div>
  )
}
