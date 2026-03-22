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
  BarChart3
} from "lucide-react"
import { toast } from "sonner"
import { read, utils } from "xlsx"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface CommsData {
  id?: string
  fileName?: string
  uploadedAt: string
  newFollowers: any[]
  location: any[]
  jobFunction: any[]
  seniority: any[]
  industry: any[]
  companySize: any[]
}

export default function CommsImportExcelPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [data, setData] = useState<CommsData | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const savedData = localStorage.getItem("comms_linkedin_data")
    if (savedData) {
      try {
        setData(JSON.parse(savedData))
      } catch (e) {
        console.error("Failed to parse saved data", e)
      }
    }
  }, [])

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
          toast.error(`Missing sheets: ${missingSheets.join(", ")}`)
          setIsLoading(false)
          return
        }

        const commsData: CommsData = {
          id: `log-${Date.now()}`,
          fileName: file?.name,
          uploadedAt: new Date().toISOString(),
          newFollowers: utils.sheet_to_json(workbook.Sheets["New followers"]),
          location: utils.sheet_to_json(workbook.Sheets["Location"]),
          jobFunction: utils.sheet_to_json(workbook.Sheets["Job function"]),
          seniority: utils.sheet_to_json(workbook.Sheets["Seniority"]),
          industry: utils.sheet_to_json(workbook.Sheets["Industry"]),
          companySize: utils.sheet_to_json(workbook.Sheets["Company size"])
        }

        // Save as active dataset
        localStorage.setItem("comms_linkedin_data", JSON.stringify(commsData))
        
        // Save to audit logs
        const existingLogs = JSON.parse(localStorage.getItem("comms_audit_logs") || "[]")
        localStorage.setItem("comms_audit_logs", JSON.stringify([commsData, ...existingLogs]))

        setData(commsData)
        toast.success("LinkedIn data imported and logged successfully")
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

  const handleReupload = () => {
    fileInputRef.current?.click()
  }

  const getDateRange = () => {
    if (!data || data.newFollowers.length === 0) return "N/A"
    const dates = data.newFollowers.map(r => r.Date).filter(Boolean)
    if (dates.length === 0) return "N/A"
    return `${dates[0]} - ${dates[dates.length - 1]}`
  }

  if (data && !isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">LinkedIn Data Status</h1>
          <p className="text-zinc-500 dark:text-zinc-400">Current active dataset for Comms dashboard</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                Data Summary
              </CardTitle>
              <CardDescription>Overview of the currently loaded dataset</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between py-2 border-b">
                <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
                  <FileSpreadsheet className="h-4 w-4" />
                  <span className="text-sm">File Name</span>
                </div>
                <span className="text-sm font-medium truncate max-w-[200px]">{data.fileName || "Unknown"}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b">
                <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
                  <Calendar className="h-4 w-4" />
                  <span className="text-sm">Uploaded At</span>
                </div>
                <span className="text-sm font-medium">{new Date(data.uploadedAt).toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b">
                <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
                  <Database className="h-4 w-4" />
                  <span className="text-sm">Date Range</span>
                </div>
                <span className="text-sm font-medium">{getDateRange()}</span>
              </div>
              <div className="pt-2">
                <p className="text-sm font-semibold mb-3">Sheet Row Counts:</p>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "New Followers", count: data.newFollowers.length },
                    { label: "Location", count: data.location.length },
                    { label: "Job Function", count: data.jobFunction.length },
                    { label: "Seniority", count: data.seniority.length },
                    { label: "Industry", count: data.industry.length },
                    { label: "Company Size", count: data.companySize.length },
                  ].map((item) => (
                    <div key={item.label} className="bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded-lg flex flex-col">
                      <span className="text-xs text-zinc-500 uppercase tracking-wider">{item.label}</span>
                      <span className="text-lg font-bold">{item.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm flex flex-col justify-center items-center p-8 text-center bg-[#0046ab]/5">
            <div className="h-16 w-16 rounded-full bg-white dark:bg-zinc-800 flex items-center justify-center mb-4 shadow-sm">
              <RefreshCw className="h-8 w-8 text-[#0046ab]" />
            </div>
            <h3 className="text-xl font-bold mb-2">Need to update data?</h3>
            <p className="text-zinc-500 mb-6 max-w-xs">You can replace the current dataset by uploading a new LinkedIn export file.</p>
            <input type="file" accept=".xlsx, .xls" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
            <Button className="bg-[#0046ab] hover:bg-[#003a8f] text-white" onClick={handleReupload}>
              <FileUp className="h-4 w-4 mr-2" />
              Re-upload File
            </Button>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">Import Excel</h1>
        <p className="text-zinc-500 dark:text-zinc-400">Upload your LinkedIn followers export file</p>
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
            {isLoading ? "Processing LinkedIn file..." : "Upload LinkedIn Export"}
          </h3>
          <p className="text-zinc-500 max-w-md px-4 mb-8">
            Drag and drop your LinkedIn Excel file here, or click the button below to browse.
            <br />
            <span className="text-xs mt-2 block">Expected sheets: New followers, Location, Job function, Seniority, Industry, Company size</span>
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
