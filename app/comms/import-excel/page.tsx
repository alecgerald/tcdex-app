"use client"

import { useState, useRef, useEffect } from "react"
import { 
  FileUp, 
  FileSpreadsheet, 
  RefreshCw, 
  Loader2, 
  CheckCircle2,
  Calendar,
  Database,
  BarChart3,
  Layers,
  Search,
  Check,
  ChevronRight
} from "lucide-react"
import { toast } from "sonner"
import { read, utils } from "xlsx"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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

interface CommsData {
  id?: string
  fileName?: string
  uploadedAt: string
  newFollowers: any[]
  contentPosts?: any[] // legacy, keeping for compatibility during migration
  contentDailyMetrics?: any[]
  contentPostMetrics?: any[]
  location: any[]
  jobFunction: any[]
  seniority: any[]
  industry: any[]
  companySize: any[]
  type?: string
}

export default function CommsImportExcelPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [data, setData] = useState<CommsData | null>(null)
  const [uploadType, setUploadType] = useState("followers")
  const [searchTerm, setSearchTerm] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement> | React.DragEvent) => {
    let file: File | undefined
    if ('files' in e.target && e.target.files) {
      file = e.target.files[0]
    } else if ('dataTransfer' in e && e.dataTransfer.files) {
      file = e.dataTransfer.files[0]
    }

    if (!file) return

    const extension = file.name.split('.').pop()?.toLowerCase()
    if (extension !== 'xls' && extension !== 'xlsx') {
      toast.error("Please upload .xls or .xlsx files only")
      return
    }

    setIsLoading(true)
    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const binaryData = event.target?.result
        const workbook = read(binaryData, { type: "binary" })
        
        // Get existing data to merge
        const existingDataStr = localStorage.getItem("comms_linkedin_data")
        let existingData: any = {}
        if (existingDataStr) {
          try {
            existingData = JSON.parse(existingDataStr)
          } catch (e) {
            console.error("Failed to parse existing data", e)
          }
        }

        let commsData: CommsData

        if (uploadType === "followers") {
          const requiredSheets = [
            "New followers",
            "Location",
            "Job function",
            "Seniority",
            "Industry",
            "Company size"
          ]

          const missingSheets = requiredSheets.filter(s => !workbook.SheetNames.includes(s))
          if (missingSheets.length > 0) {
            toast.error(`Missing sheets for Followers: ${missingSheets.join(", ")}`)
            setIsLoading(false)
            return
          }

          commsData = {
            ...existingData,
            id: `log-${Date.now()}`,
            fileName: file?.name,
            uploadedAt: new Date().toISOString(),
            type: "followers",
            newFollowers: utils.sheet_to_json(workbook.Sheets["New followers"]),
            location: utils.sheet_to_json(workbook.Sheets["Location"]),
            jobFunction: utils.sheet_to_json(workbook.Sheets["Job function"]),
            seniority: utils.sheet_to_json(workbook.Sheets["Seniority"]),
            industry: utils.sheet_to_json(workbook.Sheets["Industry"]),
            companySize: utils.sheet_to_json(workbook.Sheets["Company size"])
          }
        } else if (uploadType === "content-posts") {
          // Sheet 1: Daily Metrics
          const dailySheet = workbook.Sheets[workbook.SheetNames[0]]
          const dailyData: any[] = utils.sheet_to_json(dailySheet, { range: 1 })
          
          // Sheet 2: Post Metrics
          const postSheet = workbook.Sheets[workbook.SheetNames[1]] || dailySheet
          const postData: any[] = utils.sheet_to_json(postSheet, { range: 1 })
          
          if (!dailyData || dailyData.length === 0) {
            toast.error("The uploaded file is empty")
            setIsLoading(false)
            return
          }

          commsData = {
            ...existingData,
            id: `log-${Date.now()}`,
            fileName: file?.name,
            uploadedAt: new Date().toISOString(),
            type: "content-posts",
            contentDailyMetrics: dailyData,
            contentPostMetrics: postData,
            // Fallback for legacy code
            contentPosts: postData,
            // Ensure these have defaults if not already present
            newFollowers: existingData.newFollowers || [],
            location: existingData.location || [],
            jobFunction: existingData.jobFunction || [],
            seniority: existingData.seniority || [],
            industry: existingData.industry || [],
            companySize: existingData.companySize || []
          }
        } else {
          // Placeholder for other types
          commsData = {
            ...existingData,
            id: `log-${Date.now()}`,
            fileName: file?.name,
            uploadedAt: new Date().toISOString(),
            type: uploadType
          }
          toast.info(`${uploadType} import structure not fully implemented, but file received.`)
        }

        // Save as active dataset
        localStorage.setItem("comms_linkedin_data", JSON.stringify(commsData))
        
        // Save to audit logs
        const existingLogs = JSON.parse(localStorage.getItem("comms_audit_logs") || "[]")
        localStorage.setItem("comms_audit_logs", JSON.stringify([commsData, ...existingLogs]))

        setData(commsData)
        toast.success(`LinkedIn ${uploadType} data imported successfully`)
      } catch (error) {
        toast.error("Failed to parse Excel file")
        console.error(error)
      } finally {
        setIsLoading(false)
      }
    }
    reader.readAsBinaryString(file)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    handleFileUpload(e)
  }

  const handleFinish = () => {
    toast.success("File added to dashboard successfully")
    setData(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const getPreviewData = () => {
    if (!data) return []
    if (data.type === 'content-posts') {
      // Preview Sheet 2 (Posts) by default as it's more human-readable
      return data.contentPostMetrics || data.contentDailyMetrics || []
    }
    return data.newFollowers || []
  }

  const previewData = getPreviewData()
  const columns = previewData.length > 0 ? Object.keys(previewData[0]) : []
  
  const filteredData = previewData.filter(row => 
    Object.values(row).some(val => String(val).toLowerCase().includes(searchTerm.toLowerCase()))
  )

  if (data && !isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">Review Results</h1>
            <p className="text-zinc-500 dark:text-zinc-400">Step 2: Review your {data.type || 'data'} before adding to dashboard</p>
          </div>
          <Button variant="outline" onClick={() => setData(null)} className="text-zinc-500">
            <RefreshCw className="h-4 w-4 mr-2" />
            Reset
          </Button>
        </div>

        <Card className="border-none shadow-md overflow-hidden">
          <CardHeader className="bg-white dark:bg-zinc-900 border-b pb-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-lg">Data Preview: {data.type === 'content-posts' ? 'Content Posts' : data.fileName}</CardTitle>
                <CardDescription>Showing {filteredData.length} records from the imported file.</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative w-full md:w-64">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-500" />
                  <Input 
                    placeholder="Search records..." 
                    className="pl-9" 
                    value={searchTerm} 
                    onChange={(e) => setSearchTerm(e.target.value)} 
                  />
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
                  {filteredData.length > 0 ? (
                    filteredData.map((row, idx) => (
                      <TableRow key={idx}>
                        {columns.map((col) => (
                          <TableCell key={`${idx}-${col}`}>
                            {String(row[col])}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={columns.length} className="h-24 text-center">
                        No results found.
                      </TableCell>
                    </TableRow>
                  )}
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
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">Import Excel</h1>
          <p className="text-zinc-500 dark:text-zinc-400">Upload your LinkedIn analytics export file</p>
        </div>
        <div className="flex items-center gap-3 bg-white dark:bg-zinc-900 p-2 rounded-xl border shadow-sm">
          <Layers className="h-4 w-4 text-[#0046ab] ml-2" />
          <span className="text-sm font-medium text-zinc-500">Excel Type:</span>
          <Select value={uploadType} onValueChange={setUploadType}>
            <SelectTrigger className="w-[160px] border-none shadow-none focus:ring-0 h-8">
              <SelectValue placeholder="Select Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="content-posts">Content Posts</SelectItem>
              <SelectItem value="followers">Followers</SelectItem>
              <SelectItem value="visitors">Visitors</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div 
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className="group relative"
      >
        <Card className="border-dashed border-2 bg-transparent flex flex-col items-center justify-center py-24 text-center transition-colors group-hover:border-[#0046ab] group-hover:bg-[#0046ab]/5">
          <div className="h-20 w-20 rounded-full bg-zinc-100 flex items-center justify-center mb-6 dark:bg-zinc-800 transition-colors group-hover:bg-white dark:group-hover:bg-zinc-700">
            {isLoading ? (
              <Loader2 className="h-10 w-10 text-[#0046ab] animate-spin" />
            ) : (
              <FileSpreadsheet className="h-10 w-10 text-zinc-400 group-hover:text-[#0046ab]" />
            )}
          </div>
          <h3 className="text-xl font-semibold mb-2">
            {isLoading ? `Processing ${uploadType}...` : `Upload ${uploadType.replace('-', ' ')} Export`}
          </h3>
          <p className="text-zinc-500 max-w-md px-4 mb-8">
            Drag and drop your LinkedIn Excel file here, or click the button below to browse.
            <br />
            {uploadType === 'followers' && (
              <span className="text-xs mt-2 block">Expected sheets: New followers, Location, Job function, Seniority, Industry, Company size</span>
            )}
          </p>
          
          <input type="file" accept=".xlsx, .xls" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
          <Button 
            className="bg-[#0046ab] hover:bg-[#003a8f] text-white" 
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
          >
            {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileUp className="h-4 w-4 mr-2" />}
            Browse Files
          </Button>
        </Card>
      </div>
    </div>
  )
}
