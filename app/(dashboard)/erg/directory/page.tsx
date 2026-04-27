"use client"

import { useEffect, useState } from "react"
import { 
  Users, 
  Search, 
  Download,
  Mail,
  MoreHorizontal,
  UserPlus,
  MapPin,
  Building2,
  Loader2
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
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { utils, writeFile } from "xlsx"

import { fetchERGDashboardData } from "../actions"

interface Member {
  id?: string
  "Employee ID": string | number
  Name: string
  Email: string
  "Delivery Unit / Business Unit": string
  Location: string
  "Primary ERG": string
  "Join Date": string
  uploadDate?: string
  status?: string
  Status?: string
  [key: string]: any
}

export default function ERGDirectoryPage() {
  const [members, setMembers] = useState<Member[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedERG, setSelectedERG] = useState<string>("All")
  const [currentPage, setCurrentPage] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const itemsPerPage = 50

  useEffect(() => {
    async function loadMembers() {
      setIsLoading(true)
      try {
        const data = await fetchERGDashboardData()
        setMembers(data.membershipData)
      } catch (error) {
        console.error("Failed to load members:", error)
      } finally {
        setIsLoading(false)
      }
    }
    loadMembers()
  }, [])

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, selectedERG])

  const ergs = ["All", ...Array.from(new Set(members.map(m => m["Primary ERG"] || "Unassigned")))]

  const filteredMembers = members.filter(member => {
    const matchesSearch = Object.values(member).some(val => 
      String(val).toLowerCase().includes(searchTerm.toLowerCase())
    )
    const matchesERG = selectedERG === "All" || member["Primary ERG"] === selectedERG
    return matchesSearch && matchesERG
  })

  // Pagination calculations
  const totalPages = Math.ceil(filteredMembers.length / itemsPerPage)
  const paginatedMembers = filteredMembers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  const exportToExcel = () => {
    // Filter out internal/unwanted fields before export
    const dataToExport = filteredMembers.map(({ id, uploadDate, status, Status, ...rest }) => rest)
    
    const worksheet = utils.json_to_sheet(dataToExport)
    const workbook = utils.book_new()
    utils.book_append_sheet(workbook, worksheet, "ERG_Members")
    writeFile(workbook, `ERG_Membership_Export_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  const formatDate = (dateValue: any) => {
    if (!dateValue) return "N/A"
    
    // Handle YYYY-MM-DD strings directly
    if (typeof dateValue === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
      return dateValue
    }

    // ISO string handling
    if (typeof dateValue === 'string' && dateValue.includes('T')) {
      const date = new Date(dateValue)
      return isNaN(date.getTime()) ? dateValue : date.toISOString().split('T')[0]
    }

    // Excel serial date conversion (fallback for old data)
    const serial = Number(dateValue)
    if (!isNaN(serial) && serial > 10000) { // Simple check for serial dates
      const date = new Date((serial - 25569) * 86400 * 1000)
      return date.toISOString().split('T')[0]
    }

    return String(dateValue)
  }

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#0046ab]" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">Membership Directory</h1>
          <p className="text-zinc-500 dark:text-zinc-400">Authoritative registry for all ERG members.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportToExcel} disabled={members.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Export XLSX
          </Button>
        </div>
      </div>

      <Card className="border-none shadow-sm">
        <CardHeader className="bg-white dark:bg-zinc-900 border-b pb-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-col gap-4 flex-1">
              <div className="relative w-full md:w-80">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-500" />
                <Input
                  placeholder="Search members..."
                  className="pl-9"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="flex flex-wrap items-center gap-6">
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-bold uppercase text-zinc-400">ERG Filter</span>
                <div className="flex flex-wrap items-center gap-2">
                  {ergs.map(erg => (
                    <Badge 
                      key={erg}
                      variant={selectedERG === erg ? "default" : "outline"}
                      className={`whitespace-nowrap ${selectedERG === erg ? "bg-[#0046ab] hover:bg-[#0046ab]" : "cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800"}`}
                      onClick={() => setSelectedERG(erg)}
                    >
                      {erg}
                    </Badge>
                  ))}
                </div>
              </div>
              </div>
            </div>
            <div className="text-sm text-zinc-500 font-medium">
              Showing {paginatedMembers.length} members out of {filteredMembers.length}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {members.length === 0 ? (
            <div className="py-24 text-center space-y-4">
              <div className="h-16 w-16 rounded-full bg-zinc-50 flex items-center justify-center mx-auto dark:bg-zinc-800">
                <Users className="h-8 w-8 text-zinc-300" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Registry Empty</h3>
                <p className="text-zinc-500 max-w-xs mx-auto">Upload the Membership Registry Excel file to populate this view.</p>
              </div>
              <Button variant="outline" onClick={() => window.location.href='/erg/upload'}>
                Go to Import
              </Button>
            </div>
          ) : (
            <ScrollArea className="h-[600px]">
              <Table>
                <TableHeader className="bg-zinc-50 dark:bg-zinc-800 sticky top-0 z-10">
                  <TableRow>
                    <TableHead>Employee ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Primary ERG</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Join Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedMembers.map((member) => (
                    <TableRow key={member["Employee ID"]}>
                      <TableCell className="font-mono text-xs">{member["Employee ID"]}</TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{member.Name}</span>
                          <span className="text-[10px] text-zinc-400">{member.Email}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-900/20 dark:text-blue-400">
                          {member["Primary ERG"]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400">
                            <MapPin className="h-3 w-3" />
                            {member.Location}
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px] text-zinc-400">
                            <Building2 className="h-2.5 w-2.5" />
                            {member["Delivery Unit / Business Unit"]}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-zinc-500 text-sm">{formatDate(member["Join Date"])}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
        {filteredMembers.length > itemsPerPage && (
          <div className="p-4 border-t flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/50">
            <div className="text-xs text-zinc-500 font-medium">
              Page {currentPage} of {totalPages}
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
