"use client"

import { useEffect, useState, useMemo } from "react"
import { 
  Users, 
  TrendingUp, 
  Calendar, 
  Heart,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  PieChart as PieChartIcon,
  Activity,
  Award,
  Download,
  Building2,
  MapPin,
  Target,
  Layers,
  ThumbsUp,
  ThumbsDown,
  MessageSquare
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const parseEventDate = (val: any) => {
  if (!val) return new Date(NaN)
  if (typeof val === 'number' || (!isNaN(Number(val)) && !String(val).includes('-') && !String(val).includes('/'))) {
    const serial = Number(val)
    // Excel dates start from Dec 30, 1899
    return new Date((serial - 25569) * 86400 * 1000)
  }
  return new Date(val)
}

export default function ERGDashboard() {
  const [membershipData, setMembershipData] = useState<any[]>([])
  const [snapshots, setSnapshots] = useState<any[]>([])
  const [eventLogs, setEventLogs] = useState<any[]>([])
  const [feedback, setFeedback] = useState<any[]>([])
  const [participation, setParticipation] = useState<any[]>([])
  const [auditLogs, setAuditLogs] = useState<any[]>([])
  
  // Filter States
  const [selectedERG, setSelectedERG] = useState("All")
  const [chartSelectedERG, setChartSelectedERG] = useState("All")
  const [selectedBU, setSelectedBU] = useState("All")
  const [showTrendlines, setShowTrendlines] = useState(true)

  // Date Range Filter States
  const ALL_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
  const [startMonth, setStartMonth] = useState(0) // Jan
  const [endMonth, setEndMonth] = useState(11)    // Dec
  const [growthYear, setGrowthYear] = useState(new Date().getFullYear())

  // Figure 3 (Attendance) Date Range Filter States
  const [attendanceStartMonth, setAttendanceStartMonth] = useState(0)
  const [attendanceEndMonth, setAttendanceEndMonth] = useState(11)
  const [attendanceYear, setAttendanceYear] = useState(new Date().getFullYear())

  // Figure 4 (Feedback) Date Range Filter States
  const [feedbackStartMonth, setFeedbackStartMonth] = useState(0)
  const [feedbackEndMonth, setFeedbackEndMonth] = useState(11)
  const [feedbackYear, setFeedbackYear] = useState(new Date().getFullYear())
  const [selectedDEIB, setSelectedDEIB] = useState("All")
  const [hoveredFeedbackIndex, setHoveredFeedbackIndex] = useState<number | null>(null)
  const [hoveredAttendance, setHoveredAttendance] = useState<{erg: string, type: string | null} | null>(null)

  // Figure 5 (Heatmap) Date Range Filter States
  const [heatmapStartMonth, setHeatmapStartMonth] = useState(0)
  const [heatmapEndMonth, setHeatmapEndMonth] = useState(11)
  const [heatmapYear, setHeatmapYear] = useState(new Date().getFullYear())

  // Available Month Detectors
  const growthAvailableMonths = useMemo(() => {
    const relevantSnapshots = snapshots.filter(s => {
      const matchYear = s.Year === undefined || Number(s.Year) === growthYear || String(s.Year).includes(String(growthYear))
      return matchYear
    })
    const allMonthKeys = ["Jan Members", "Feb Members", "Mar Members", "Apr Members", "May Members", "Jun Members", "Jul Members", "Aug Members", "Sep Members", "Oct Members", "Nov Members", "Dec Members"]
    const indices = new Set<number>()
    relevantSnapshots.forEach(s => {
      allMonthKeys.forEach((key, i) => {
        if (Number(s[key]) > 0) indices.add(i)
      })
    })
    return indices
  }, [snapshots, growthYear])

  const attendanceAvailableMonths = useMemo(() => {
    const indices = new Set<number>()
    eventLogs.forEach(e => {
      const date = parseEventDate(e["Event Date"])
      if (!isNaN(date.getTime()) && date.getFullYear() === attendanceYear) {
        indices.add(date.getMonth())
      }
    })
    return indices
  }, [eventLogs, attendanceYear])

  const feedbackAvailableMonths = useMemo(() => {
    const indices = new Set<number>()
    feedback.forEach(f => {
      const dateStr = f.uploadDate
      if (dateStr) {
        const date = new Date(dateStr)
        if (!isNaN(date.getTime()) && date.getFullYear() === feedbackYear) {
          indices.add(date.getMonth())
        }
      }
    })
    return indices
  }, [feedback, feedbackYear])

  const heatmapAvailableMonths = useMemo(() => {
    const indices = new Set<number>()
    participation.forEach(p => {
      const dateStr = p.uploadDate
      if (dateStr) {
        const date = new Date(dateStr)
        if (!isNaN(date.getTime()) && date.getFullYear() === heatmapYear) {
          indices.add(date.getMonth())
        }
      }
    })
    return indices
  }, [participation, heatmapYear])

  // Available Year Detectors
  const growthAvailableYears = useMemo(() => {
    const years = new Set<number>()
    snapshots.forEach(s => {
      const y = Number(s.Year)
      if (!isNaN(y)) years.add(y)
    })
    return years.size > 0 ? Array.from(years).sort((a, b) => a - b) : [new Date().getFullYear()]
  }, [snapshots])

  const attendanceAvailableYears = useMemo(() => {
    const years = new Set<number>()
    eventLogs.forEach(e => {
      const date = parseEventDate(e["Event Date"])
      if (!isNaN(date.getTime())) years.add(date.getFullYear())
    })
    return years.size > 0 ? Array.from(years).sort((a, b) => a - b) : [new Date().getFullYear()]
  }, [eventLogs])

  const feedbackAvailableYears = useMemo(() => {
    const years = new Set<number>()
    feedback.forEach(f => {
      const dateStr = f.uploadDate
      if (dateStr) {
        const date = new Date(dateStr)
        if (!isNaN(date.getTime())) years.add(date.getFullYear())
      }
    })
    return years.size > 0 ? Array.from(years).sort((a, b) => a - b) : [new Date().getFullYear()]
  }, [feedback])

  const heatmapAvailableYears = useMemo(() => {
    const years = new Set<number>()
    participation.forEach(p => {
      const dateStr = p.uploadDate
      if (dateStr) {
        const date = new Date(dateStr)
        if (!isNaN(date.getTime())) years.add(date.getFullYear())
      }
    })
    return years.size > 0 ? Array.from(years).sort((a, b) => a - b) : [new Date().getFullYear()]
  }, [participation])

  const kpiAvailableYears = useMemo(() => {
    const years = new Set<number>([
      ...growthAvailableYears,
      ...attendanceAvailableYears,
      ...feedbackAvailableYears,
      ...heatmapAvailableYears
    ])
    return Array.from(years).sort((a, b) => a - b)
  }, [growthAvailableYears, attendanceAvailableYears, feedbackAvailableYears, heatmapAvailableYears])

  // Auto-adjust selections when year changes or data is loaded
  useEffect(() => {
    if (!kpiAvailableYears.includes(kpiYear)) setKpiYear(kpiAvailableYears[kpiAvailableYears.length - 1])
  }, [kpiAvailableYears])

  useEffect(() => {
    if (!growthAvailableYears.includes(growthYear)) setGrowthYear(growthAvailableYears[growthAvailableYears.length - 1])
  }, [growthAvailableYears])

  useEffect(() => {
    if (!attendanceAvailableYears.includes(attendanceYear)) setAttendanceYear(attendanceAvailableYears[attendanceAvailableYears.length - 1])
  }, [attendanceAvailableYears])

  useEffect(() => {
    if (!feedbackAvailableYears.includes(feedbackYear)) setFeedbackYear(feedbackAvailableYears[feedbackAvailableYears.length - 1])
  }, [feedbackAvailableYears])

  useEffect(() => {
    if (!heatmapAvailableYears.includes(heatmapYear)) setHeatmapYear(heatmapAvailableYears[heatmapAvailableYears.length - 1])
  }, [heatmapAvailableYears])

  // Auto-adjust selections when months are filtered

  useEffect(() => {
    setMembershipData(JSON.parse(localStorage.getItem("erg_membership_registry") || "[]"))
    setSnapshots(JSON.parse(localStorage.getItem("erg_membership_snapshots") || "[]"))
    setEventLogs(JSON.parse(localStorage.getItem("erg_event_logs") || "[]"))
    setFeedback(JSON.parse(localStorage.getItem("erg_feedback_summaries") || "[]"))
    setParticipation(JSON.parse(localStorage.getItem("erg_participation_details") || "[]"))
    setAuditLogs(JSON.parse(localStorage.getItem("erg_audit_logs") || "[]"))
  }, [])

  const latestRegistryUpdate = useMemo(() => {
    const regLog = auditLogs.find(log => log.templateType === 'membership_registry')
    return regLog ? regLog.date : null
  }, [auditLogs])

  // Centralized Color Mapping for ERGs
  const ergColors = useMemo(() => {
    const allErgs = Array.from(new Set([
      ...membershipData.map(m => m["Primary ERG"]),
      ...snapshots.map(s => s.ERG),
      ...eventLogs.map(e => e.ERG),
      ...feedback.map(f => f.ERG),
      ...participation.map(p => p.ERG)
    ])).filter(Boolean).sort()

    const map: Record<string, string> = {}
    allErgs.forEach((erg, i) => {
      // Generate a consistent HSL color based on the ERG's index
      map[erg] = `hsl(${210 + (i * 45) % 360}, 65%, 45%)`
    })
    return map
  }, [membershipData, snapshots, eventLogs, feedback, participation])

  const ergs = useMemo(() => ["All", ...Array.from(new Set(membershipData.map(m => m["Primary ERG"])))], [membershipData])
  const bus = useMemo(() => ["All", ...Array.from(new Set(membershipData.map(m => m["Delivery Unit / Business Unit"])))], [membershipData])

  const filteredMembership = useMemo(() => {
    return membershipData.filter(m => {
      const matchERG = selectedERG === "All" || m["Primary ERG"] === selectedERG
      const matchBU = selectedBU === "All" || m["Delivery Unit / Business Unit"] === selectedBU
      return matchERG && matchBU
    })
  }, [membershipData, selectedERG, selectedBU])

  // Figure 1: Active Members by ERG (Horizontal Bar)
  const ergsDist = useMemo(() => {
    const counts: Record<string, number> = {}
    filteredMembership.filter(m => m.Status === "Active").forEach(m => {
      const key = m["Primary ERG"] || "Unassigned"
      counts[key] = (counts[key] || 0) + 1
    })
    return Object.entries(counts).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count)
  }, [filteredMembership])

  // Figure 2: Monthly Growth Trends (Dynamic Scale Line Chart)
  const growthTrendInfo = useMemo(() => {
    const relevantSnapshots = snapshots.filter(s => {
      const matchERG = chartSelectedERG === "All" ? (selectedERG === "All" || s.ERG === selectedERG) : s.ERG === chartSelectedERG
      const matchYear = s.Year === undefined || Number(s.Year) === growthYear || String(s.Year).includes(String(growthYear))
      return matchERG && matchYear
    })
    const allMonthKeys = [
      "Jan Members", "Feb Members", "Mar Members", "Apr Members", 
      "May Members", "Jun Members", "Jul Members", "Aug Members", 
      "Sep Members", "Oct Members", "Nov Members", "Dec Members"
    ]

    // Slice based on startMonth and endMonth
    const monthKeys = allMonthKeys.slice(startMonth, endMonth + 1)
    const displayMonths = ALL_MONTHS.slice(startMonth, endMonth + 1)
    
    // Find global max for scaling
    let maxVal = 0
    relevantSnapshots.forEach(s => {
      monthKeys.forEach(m => {
        const val = Number(s[m]) || 0
        if (val > maxVal) maxVal = val
      })
    })

    // Add buffer to top of chart
    maxVal = Math.ceil((maxVal * 1.2) / 10) * 10 || 100

    const trends = relevantSnapshots.map(s => ({
      name: s.ERG,
      data: monthKeys.map(m => Number(s[m]) || 0),
      growth: s["Growth Rate %"] || 0
    }))

    let totalStartVal = 0
    let totalEndVal = 0
    trends.forEach(t => {
      totalStartVal += t.data[0] || 0
      totalEndVal += t.data[t.data.length - 1] || 0
    })

    const netChange = totalEndVal - totalStartVal
    const growthRate = totalStartVal > 0 ? (netChange / totalStartVal) * 100 : 0

    return { trends, maxVal, months: displayMonths, netChange, growthRate }
  }, [snapshots, selectedERG, chartSelectedERG, startMonth, endMonth, growthYear])


  // Figure 3: Attendance by Activity Type (Stacked Column)
  const attendanceByType = useMemo(() => {
    const relevantEvents = eventLogs.filter(e => {
      const matchERG = selectedERG === "All" || e.ERG === selectedERG
      
      // Date Filtering
      const date = parseEventDate(e["Event Date"])
      const monthIndex = date.getMonth()
      const year = date.getFullYear()
      
      const matchMonth = !isNaN(monthIndex) && monthIndex >= attendanceStartMonth && monthIndex <= attendanceEndMonth
      const matchYear = !isNaN(year) && year === attendanceYear
      
      return matchERG && matchMonth && matchYear
    })
    
    // Dynamically derive ERG list from relevant events
    const ergsWithData = selectedERG === "All" 
      ? Array.from(new Set(relevantEvents.map(e => e.ERG))).filter(Boolean).sort()
      : [selectedERG]

    const types = ["Internal Webinar", "Learning Session", "Internal Forum", "External Partnership"]
    
    const data = ergsWithData.map(erg => {
      const ergEvents = relevantEvents.filter(e => e.ERG === erg)
      const typeCounts: Record<string, any> = {}
      let total = 0
      types.forEach(t => {
        const count = ergEvents.filter(e => e["Activity Type"] === t)
          .reduce((acc, curr) => acc + (Number(curr["Attendance / Participation Count"]) || 0), 0)
        typeCounts[t] = count
        total += count
      })
      return { erg, ...typeCounts, total }
    })

    const maxVal = Math.max(...data.map(d => d.total), 10)
    const roundedMax = Math.ceil(maxVal / 10) * 10

    return { data, maxVal: roundedMax }
  }, [eventLogs, selectedERG, attendanceStartMonth, attendanceEndMonth, attendanceYear])

  // Figure 4: Feedback Effectiveness (Combo Chart)
  const feedbackEffectiveness = useMemo(() => {
    const relevantFeedback = feedback.filter(f => {
      const matchERG = selectedERG === "All" || f.ERG === selectedERG
      const matchDEIB = selectedDEIB === "All" || f["DEIB event"] === selectedDEIB
      
      // Date Filtering (based on uploadDate)
      const dateStr = f.uploadDate
      if (!dateStr) return matchERG && matchDEIB
      
      const date = new Date(dateStr)
      const monthIndex = date.getMonth()
      const year = date.getFullYear()
      const matchDate = !isNaN(monthIndex) && monthIndex >= feedbackStartMonth && monthIndex <= feedbackEndMonth
      const matchYear = !isNaN(year) && year === feedbackYear
      
      return matchERG && matchDEIB && matchDate && matchYear
    })

    const data = relevantFeedback.map(f => ({
      title: f["Activity Title"],
      score: Number(f["Overall Evaluation Score"]) || 0,
      pos: Number(f["Positive Feedbacks"]) || 0,
      neg: Number(f["Negative Feedbacks"]) || 0,
      total: (Number(f["Positive Feedbacks"]) || 0) + (Number(f["Negative Feedbacks"]) || 0)
    }))

    const maxCount = Math.max(...data.map(d => Math.max(d.pos, d.neg)), 10)
    const maxVal = Math.ceil(maxCount / 10) * 10

    return { data, maxVal }
  }, [feedback, selectedERG, selectedDEIB, feedbackStartMonth, feedbackEndMonth, feedbackYear])

  const deibEvents = useMemo(() => ["All", ...Array.from(new Set(feedback.map(f => f["DEIB event"])))].filter(Boolean), [feedback])

  // Figure 5: Cross-BU Participation Heatmap
  const heatmapData = useMemo(() => {
    const relevantParticipation = participation.filter(p => {
      const matchERG = selectedERG === "All" || p.ERG === selectedERG
      
      // Date Filtering (based on uploadDate)
      const dateStr = p.uploadDate
      if (!dateStr) return matchERG
      
      const date = new Date(dateStr)
      const monthIndex = date.getMonth()
      const year = date.getFullYear()
      const matchDate = !isNaN(monthIndex) && monthIndex >= heatmapStartMonth && monthIndex <= heatmapEndMonth
      const matchYear = !isNaN(year) && year === heatmapYear
      
      return matchERG && matchDate && matchYear
    })

    // Dynamically derive labels from filtered data
    const ergsInData = Array.from(new Set(relevantParticipation.map(p => p.ERG))).filter(Boolean).sort()
    const busInData = Array.from(new Set(relevantParticipation.map(p => p["Delivery Unit / Business Unit"]))).filter(Boolean).sort()
    
    const rows = ergsInData.map(erg => {
      const buCounts: Record<string, number> = {}
      busInData.forEach(bu => {
        buCounts[bu] = relevantParticipation.filter(p => p.ERG === erg && p["Delivery Unit / Business Unit"] === bu).length
      })
      return { erg, ...buCounts }
    })

    return { rows, columns: busInData }
  }, [participation, selectedERG, heatmapStartMonth, heatmapEndMonth, heatmapYear])

  // KPI Section Year Filter
  const [kpiYear, setKpiYear] = useState(new Date().getFullYear())

  const kpis = useMemo(() => {
    // 1. Active Members (Authoritative / Live)
    const active = filteredMembership.filter(m => m.Status === "Active").length
    
    // 2. Avg Growth Rate (Filtered by kpiYear)
    const relevantSnapshots = snapshots.filter(s => {
      const matchERG = selectedERG === "All" || s.ERG === selectedERG
      const matchYear = s.Year === undefined || Number(s.Year) === kpiYear || String(s.Year).includes(String(kpiYear))
      return matchERG && matchYear
    })

    const allMonthKeys = [
      "Jan Members", "Feb Members", "Mar Members", "Apr Members", 
      "May Members", "Jun Members", "Jul Members", "Aug Members", 
      "Sep Members", "Oct Members", "Nov Members", "Dec Members"
    ]

    let totalStartVal = 0
    let totalEndVal = 0
    relevantSnapshots.forEach(s => {
      // Find first non-zero month and last non-zero month for the year
      let firstVal = 0
      let lastVal = 0
      for (const m of allMonthKeys) {
        if (Number(s[m]) > 0) {
          if (firstVal === 0) firstVal = Number(s[m])
          lastVal = Number(s[m])
        }
      }
      totalStartVal += firstVal
      totalEndVal += lastVal
    })
    const growth = totalStartVal > 0 ? ((totalEndVal - totalStartVal) / totalStartVal) * 100 : 0
    const netChange = totalEndVal - totalStartVal

    // 3. Total Attendance (Filtered by kpiYear)
    const events = eventLogs.filter(e => {
      const date = parseEventDate(e["Event Date"])
      return !isNaN(date.getTime()) && date.getFullYear() === kpiYear
    })
    const attendance = events.reduce((acc, curr) => acc + (Number(curr["Attendance / Participation Count"]) || 0), 0)
    
    // 4. Evaluation Score (Filtered by kpiYear)
    const filteredFeedback = feedback.filter(f => {
      const matchERG = selectedERG === "All" || f.ERG === selectedERG
      const dateStr = f.uploadDate
      if (!dateStr) return matchERG
      const date = new Date(dateStr)
      return !isNaN(date.getTime()) && date.getFullYear() === kpiYear
    })
    const avgScore = (filteredFeedback.length > 0)
      ? filteredFeedback.reduce((acc, curr) => acc + (Number(curr["Overall Evaluation Score"]) || 0), 0) / filteredFeedback.length
      : 0

    return [
      { title: "Active Members", value: active.toLocaleString(), icon: Users, description: "Current Registry", isLive: true },
      { title: "Net Change", value: `${netChange >= 0 ? '+' : ''}${netChange.toLocaleString()}`, icon: TrendingUp, description: `Net Growth (${kpiYear})` },
      { title: "Avg Growth Rate", value: `${growth.toFixed(1)}%`, icon: TrendingUp, description: `Annual Growth (${kpiYear})` },
      { title: "Total Attendance", value: attendance.toLocaleString(), icon: Activity, description: `Total reached in ${kpiYear}` },
      { title: "Evaluation Score", value: `${avgScore.toFixed(1)}/5.0`, icon: Award, description: `Quality avg (${kpiYear})` }
    ]
  }, [filteredMembership, snapshots, eventLogs, feedback, selectedERG, kpiYear])

  if (membershipData.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">ERG Dashboard</h1>
        <Card className="border-dashed border-2 py-24 text-center">
          <BarChart3 className="h-12 w-12 mx-auto text-zinc-300 mb-4" />
          <h2 className="text-xl font-semibold">No Data Available</h2>
          <p className="text-zinc-500 mb-8">Please upload ERG data files to populate the dashboard.</p>
          <Button onClick={() => window.location.href='/erg/upload'}>Go to Import</Button>
        </Card>
      </div>
    )
  }

  const formatLocalDate = (date: Date | string) => {
    const d = new Date(date)
    if (isNaN(d.getTime())) return "N/A"
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-3xl font-bold">ERG Dashboard</h1>
            <Badge className="bg-green-500/10 text-green-600 hover:bg-green-500/10 border-green-200 flex items-center gap-1.5 py-0.5">
              <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
              System Healthy
            </Badge>
          </div>
          <div className="flex items-center gap-2 text-zinc-500">
            <p>Holistic Performance & Impact Monitor</p>
            <span>•</span>
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase bg-zinc-100 px-2 py-0.5 rounded text-zinc-400 dark:bg-zinc-800">
              <Activity className="h-3 w-3" />
              Last Sync: {formatLocalDate(new Date())} {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        </div>
        <div className="flex gap-4 no-print">
          <Select value={selectedERG} onValueChange={setSelectedERG}>
            <SelectTrigger className="w-[180px] print-keep"><SelectValue placeholder="All ERGs" /></SelectTrigger>
            <SelectContent>{ergs.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={selectedBU} onValueChange={setSelectedBU}>
            <SelectTrigger className="w-[180px] print-keep"><SelectValue placeholder="All Business Units" /></SelectTrigger>
            <SelectContent>{bus.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
          </Select>
          <Button variant="outline" onClick={() => window.print()}><Download className="h-4 w-4 mr-2" /> PDF</Button>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5 text-zinc-400" />
          <h2 className="text-lg font-bold">Key Performance Indicators</h2>
        </div>
        <div className="flex items-center gap-3 bg-zinc-100 p-1 rounded-lg dark:bg-zinc-800">
          <span className="text-[10px] font-black uppercase text-zinc-400 px-2">Filter Metrics By Year</span>
          <Select value={String(kpiYear)} onValueChange={(v) => setKpiYear(parseInt(v))}>
            <SelectTrigger className="h-8 w-[100px] text-[11px] font-bold bg-white dark:bg-zinc-900 border-none shadow-sm print-keep">
              <SelectValue placeholder="Year" />
            </SelectTrigger>
            <SelectContent>
              {kpiAvailableYears.map(y => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        {kpis.map(kpi => (
          <Card key={kpi.title} className="border-none shadow-sm relative overflow-hidden group">
            {(kpi as any).isLive && (
              <div className="absolute top-0 right-0 p-2">
                <Badge className="bg-green-500/10 text-green-600 text-[8px] border-none uppercase tracking-tighter">Live</Badge>
              </div>
            )}
            <CardContent className="p-6">
              <div className="p-2 bg-[#0046ab]/10 rounded-lg w-fit mb-4 group-hover:bg-[#0046ab] transition-colors">
                <kpi.icon className="h-5 w-5 text-[#0046ab] group-hover:text-white" />
              </div>
              <h3 className="text-sm font-medium text-zinc-500">{kpi.title}</h3>
              <p className="text-2xl font-bold">{kpi.value}</p>
              <p className="text-xs text-zinc-400 mt-1">{kpi.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Figure 1: Active Members by ERG */}
        <Card className="border-none shadow-sm">
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="text-lg">Active Members by ERG</CardTitle>
              {latestRegistryUpdate && (
                <Badge variant="outline" className="text-[10px] font-medium text-zinc-400 border-zinc-100 flex items-center gap-1.5">
                  <Calendar className="h-3 w-3" />
                  Latest Upload: {formatLocalDate(latestRegistryUpdate)} {new Date(latestRegistryUpdate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {ergsDist.map(item => (
              <div key={item.label} className="space-y-1">
                <div className="flex justify-between text-xs font-medium"><span>{item.label}</span><span>{item.count}</span></div>
                <div className="h-2 bg-zinc-100 rounded-full dark:bg-zinc-800">
                  <div 
                    className="h-2 rounded-full transition-all" 
                    style={{ 
                      width: `${(item.count / (ergsDist[0]?.count || 1)) * 100}%`,
                      backgroundColor: ergColors[item.label] || '#0046ab'
                    }} 
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Figure 3: Stacked Attendance */}
        <Card className="border-none shadow-sm">
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-lg">Attendance by ERG & Activity Type</CardTitle>
                <CardDescription>Participation count by category</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Select value={String(attendanceStartMonth)} onValueChange={(v) => setAttendanceStartMonth(parseInt(v))}>
                  <SelectTrigger className="h-8 w-[90px] text-[10px] font-bold bg-zinc-50/50 border-zinc-100 print-keep">
                    <SelectValue placeholder="Start" />
                  </SelectTrigger>
                  <SelectContent>
                    {ALL_MONTHS.map((m, i) => (
                      <SelectItem 
                        key={m} 
                        value={String(i)} 
                        disabled={i > attendanceEndMonth || (attendanceAvailableMonths.size > 0 && !attendanceAvailableMonths.has(i))}
                      >
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-[10px] font-black text-zinc-300">TO</span>
                <Select value={String(attendanceEndMonth)} onValueChange={(v) => setAttendanceEndMonth(parseInt(v))}>
                  <SelectTrigger className="h-8 w-[90px] text-[10px] font-bold bg-zinc-50/50 border-zinc-100 print-keep">
                    <SelectValue placeholder="End" />
                  </SelectTrigger>
                  <SelectContent>
                    {ALL_MONTHS.map((m, i) => (
                      <SelectItem 
                        key={m} 
                        value={String(i)} 
                        disabled={i < attendanceStartMonth || (attendanceAvailableMonths.size > 0 && !attendanceAvailableMonths.has(i))}
                      >
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="h-4 w-px bg-zinc-200 mx-1" />
                <Select value={String(attendanceYear)} onValueChange={(v) => setAttendanceYear(parseInt(v))}>
                  <SelectTrigger className="h-8 w-[80px] text-[11px] font-bold bg-zinc-900 text-white border-zinc-900 print-keep">
                    <SelectValue placeholder="Year" />
                  </SelectTrigger>
                  <SelectContent>
                    {attendanceAvailableYears.map(y => (
                      <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pb-16">
            <div className="flex gap-2">
              {/* Y-AXIS */}
              <div className="flex flex-col justify-between text-[10px] text-zinc-400 h-[260px] pb-0 font-bold w-10 border-r border-zinc-50 pr-2 mt-16">
                <span>{attendanceByType.maxVal}</span>
                <span>{Math.round(attendanceByType.maxVal * 0.75)}</span>
                <span>{Math.round(attendanceByType.maxVal * 0.5)}</span>
                <span>{Math.round(attendanceByType.maxVal * 0.25)}</span>
                <span>0</span>
              </div>

              {/* Scrollable Chart Area */}
              <div className="flex-1 overflow-x-auto overflow-y-hidden pb-20 pt-16 custom-scrollbar">
                <div 
                  className="h-[260px] relative border-b border-zinc-100 flex items-end px-32"
                  style={{ minWidth: `${Math.max(attendanceByType.data.length * 80, 400)}px` }}
                >
                  {/* Grid Lines */}
                  <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-20">
                    {[0, 1, 2, 3, 4].map(line => (
                      <div key={line} className="w-full border-t border-zinc-300" />
                    ))}
                  </div>

                  {attendanceByType.data.length === 0 ? (
                    <div className="absolute inset-0 flex items-center justify-center text-zinc-400 text-sm font-medium">
                      No attendance data for this period
                    </div>
                  ) : (
                    <div className="flex-1 flex justify-around items-end h-full">
                      {attendanceByType.data.map((item, i) => {
                        const types = ["Internal Webinar", "Learning Session", "Internal Forum", "External Partnership"]
                        const colors = ['bg-blue-600', 'bg-indigo-600', 'bg-violet-600', 'bg-sky-600']
                        
                        return (
                          <div key={item.erg} className="flex flex-col items-center justify-end h-full relative flex-1 min-w-[60px] hover:z-50">
                            <div 
                              className="w-8 flex flex-col-reverse items-center mb-0 h-full relative group"
                              onMouseEnter={() => setHoveredAttendance({ erg: item.erg, type: null })}
                              onMouseLeave={() => setHoveredAttendance(null)}
                            >
                              {types.map((t, typeIdx) => {
                                const val = (item as any)[t] || 0
                                if (val === 0) return null
                                const height = (val / attendanceByType.maxVal) * 100
                                
                                return (
                                  <div 
                                    key={t}
                                    className={`${colors[typeIdx]} w-full transition-all hover:brightness-110 relative`}
                                    style={{ height: `${height}%` }}
                                    onMouseEnter={(e) => {
                                      e.stopPropagation();
                                      setHoveredAttendance({ erg: item.erg, type: t });
                                    }}
                                  >
                                  </div>
                                )
                              })}

                              {/* Combined Tooltip */}
                              {hoveredAttendance?.erg === item.erg && (
                                <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-zinc-900 text-white text-[11px] px-3 py-2 rounded-md z-[100] whitespace-nowrap pointer-events-none border border-white/10 shadow-2xl flex items-center gap-3 animate-in fade-in zoom-in duration-200">
                                  {hoveredAttendance?.type && (
                                    <>
                                      <div className="flex items-center gap-1.5">
                                        <div className={`h-2 w-2 rounded-full ${colors[types.indexOf(hoveredAttendance.type)]}`} />
                                        <span className="font-bold">{hoveredAttendance.type.replace('Internal ', '')}: {(item as any)[hoveredAttendance.type].toLocaleString()}</span>
                                      </div>
                                      <div className="w-px h-3 bg-white/20" />
                                    </>
                                  )}
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-white/50 text-[10px] uppercase font-bold tracking-tighter">Total</span>
                                    <span className="font-bold">{item.total.toLocaleString()}</span>
                                  </div>
                                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-zinc-900 rotate-45" />
                                </div>
                              )}
                            </div>

                            {/* X-Axis Tick */}
                            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-px h-2 bg-zinc-300" />

                            {/* X-Axis Label (Rotated) */}
                            <div className="absolute top-[272px] left-1/2 w-0 overflow-visible">
                              <div className="w-32 origin-top-left rotate-45 text-[10px] font-bold text-zinc-500 hover:text-zinc-900 transition-colors cursor-default leading-tight">
                                {item.erg}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-4 mt-8 justify-center">
              {["Internal Webinar", "Learning Session", "Internal Forum", "External Partnership"].map((t, i) => (
                <div key={t} className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-zinc-500">
                  <div className={`h-2.5 w-2.5 rounded-sm ${['bg-blue-600', 'bg-indigo-600', 'bg-violet-600', 'bg-sky-600'][i]}`} /> 
                  {t.replace('Internal ', '').replace(' Session', '')}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Figure 2: Growth Trends - FULL WIDTH */}
      <Card className="border-none shadow-sm">
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <CardTitle className="text-lg">Membership Growth Trends</CardTitle>
                <button 
                  onClick={() => setShowTrendlines(!showTrendlines)}
                  className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${showTrendlines ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-white text-zinc-500 border-zinc-200'}`}
                >
                  {showTrendlines ? 'Line Chart: ON' : 'Line Chart: OFF'}
                </button>
              </div>
              <CardDescription>Monthly enrollment progress</CardDescription>
              <div className="flex items-center gap-2 mt-2">
                <Select value={chartSelectedERG} onValueChange={setChartSelectedERG}>
                  <SelectTrigger className="h-8 w-[140px] text-[11px] font-bold bg-blue-50 text-blue-700 border-blue-100 print-keep">
                    <SelectValue placeholder="All ERGs" />
                  </SelectTrigger>
                  <SelectContent>
                    {ergs.map(e => <SelectItem key={e} value={e}>{e === "All" ? "All ERGs" : e}</SelectItem>)}
                  </SelectContent>
                </Select>
                <div className="h-4 w-px bg-zinc-200 mx-1" />
                <Select value={String(startMonth)} onValueChange={(v) => setStartMonth(parseInt(v))}>
                  <SelectTrigger className="h-8 w-[100px] text-[11px] font-semibold bg-zinc-50/50 border-zinc-100 print-keep">
                    <SelectValue placeholder="Start" />
                  </SelectTrigger>
                  <SelectContent>
                    {ALL_MONTHS.map((m, i) => (
                      <SelectItem 
                        key={m} 
                        value={String(i)} 
                        disabled={i > endMonth || (growthAvailableMonths.size > 0 && !growthAvailableMonths.has(i))}
                      >
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-[10px] font-black text-zinc-300 uppercase tracking-widest">to</span>
                <Select value={String(endMonth)} onValueChange={(v) => setEndMonth(parseInt(v))}>
                  <SelectTrigger className="h-8 w-[100px] text-[11px] font-semibold bg-zinc-50/50 border-zinc-100 print-keep">
                    <SelectValue placeholder="End" />
                  </SelectTrigger>
                  <SelectContent>
                    {ALL_MONTHS.map((m, i) => (
                      <SelectItem 
                        key={m} 
                        value={String(i)} 
                        disabled={i < startMonth || (growthAvailableMonths.size > 0 && !growthAvailableMonths.has(i))}
                      >
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="h-4 w-px bg-zinc-200 mx-1" />
                <Select value={String(growthYear)} onValueChange={(v) => setGrowthYear(parseInt(v))}>
                  <SelectTrigger className="h-8 w-[80px] text-[11px] font-bold bg-zinc-900 text-white border-zinc-900 print-keep">
                    <SelectValue placeholder="Year" />
                  </SelectTrigger>
                  <SelectContent>
                    {growthAvailableYears.map(y => (
                      <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="ml-4 flex items-center gap-4 border-l pl-4 border-zinc-100">
                  <div className="flex flex-col">
                    <span className="text-[9px] text-zinc-400 font-bold uppercase leading-none mb-1">Net Change</span>
                    <span className={`text-[11px] font-black leading-none ${growthTrendInfo.netChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {growthTrendInfo.netChange >= 0 ? '+' : ''}{growthTrendInfo.netChange.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[9px] text-zinc-400 font-bold uppercase leading-none mb-1">Growth Rate</span>
                    <span className={`text-[11px] font-black leading-none ${growthTrendInfo.growthRate >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {growthTrendInfo.growthRate >= 0 ? '+' : ''}{growthTrendInfo.growthRate.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap justify-end max-w-[400px]">
              {growthTrendInfo.trends.map((t) => (
                <div key={t.name} className="flex items-center gap-1 text-[10px] font-bold">
                  <div className="h-2 w-2 rounded-full" style={{ backgroundColor: ergColors[t.name] }} />
                  {t.name}
                </div>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            {/* Y-AXIS */}
            <div className="flex flex-col justify-between text-[10px] text-zinc-400 h-[200px] pb-0 font-bold">
              <span>{growthTrendInfo.maxVal}</span>
              <span>{Math.round(growthTrendInfo.maxVal * 0.75)}</span>
              <span>{Math.round(growthTrendInfo.maxVal * 0.5)}</span>
              <span>{Math.round(growthTrendInfo.maxVal * 0.25)}</span>
              <span>0</span>
            </div>
            
            {/* CHART AREA */}
            <div className="flex-1">
              <div className="h-[200px] w-full border-b border-l border-zinc-100 relative flex items-end justify-between px-2 overflow-visible">
                {/* Grid Lines */}
                <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                  {[0, 1, 2, 3, 4].map(line => (
                    <div key={line} className="w-full border-t border-zinc-100/50" style={{ height: '0px' }} />
                  ))}
                </div>

                {/* SVG TRENDLINES */}
                {showTrendlines && (
                  <svg 
                    viewBox="0 0 100 100" 
                    className="absolute inset-0 w-full h-full pointer-events-none overflow-visible" 
                    preserveAspectRatio="none"
                  >
                    {growthTrendInfo.trends.map((trend, trendIdx) => {
                      const points = trend.data.map((val, monthIdx) => {
                        if (val === 0) return null
                        
                        // 1. Account for the padding on the sides of the chart (8px approx 1.2%)
                        const sidePadding = 1.2 
                        const usableWidth = 100 - (sidePadding * 2)
                        
                        // 2. Find the center of the month group
                        const monthWidth = usableWidth / growthTrendInfo.months.length
                        const groupX = sidePadding + (monthIdx * monthWidth) + (monthWidth / 2)
                        
                        // 3. Offset to the specific bar (8px bar + 1px gap = approx 0.85% shift)
                        const barOffset = (trendIdx - (growthTrendInfo.trends.length - 1) / 2) * 0.85
                        const finalX = groupX + barOffset
                        
                        const y = 100 - ((val / growthTrendInfo.maxVal) * 100)
                        return `${finalX},${y}`
                      }).filter(Boolean)

                      if (points.length < 2) return null

                      return (
                        <path 
                          key={trend.name}
                          d={`M ${points.join(' L ')}`}
                          fill="none"
                          stroke={ergColors[trend.name]}
                          strokeWidth="0.4"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="transition-all duration-500 opacity-80"
                        />
                      )
                    })}
                  </svg>
                )}

                {/* Monthly Groups */}
                {growthTrendInfo.months.map((month, monthIdx) => (
                  <div key={month} className="flex-1 flex flex-col items-center justify-end h-full gap-0.5 hover:relative hover:z-50">
                    <div className="flex items-end gap-px h-full">
                      {growthTrendInfo.trends.map((trend) => {
                        const val = trend.data[monthIdx]
                        const height = (val / growthTrendInfo.maxVal) * 100
                        return (
                          <div 
                            key={trend.name} 
                            className="w-1.5 sm:w-2 relative group"
                            style={{ height: `${height}%` }}
                          >
                            {/* VISUAL BAR */}
                            <div 
                              className="absolute inset-0 rounded-t-sm transition-all hover:brightness-110"
                              style={{ 
                                backgroundColor: ergColors[trend.name],
                                opacity: val > 0 ? (showTrendlines ? 0.4 : 1) : 0.1
                              }}
                            />

                            {/* TOOLTIP (Always full opacity on hover) */}
                            {val > 0 && (
                              <div className="absolute -top-14 left-1/2 -translate-x-1/2 bg-zinc-900 text-white text-[11px] font-bold px-3 py-1.5 rounded-md opacity-0 group-hover:opacity-100 z-50 whitespace-nowrap pointer-events-none transition-all duration-200 shadow-xl border border-white/10 flex flex-col items-center gap-1">
                                <div className="flex items-center gap-2">
                                  <div className="h-2 w-2 rounded-full" style={{ backgroundColor: ergColors[trend.name] }} />
                                  <span>{trend.name}: {val.toLocaleString()}</span>
                                </div>
                                <span className="text-[9px] text-zinc-400 uppercase tracking-tighter">{growthTrendInfo.months[monthIdx]} {growthYear}</span>
                                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-zinc-900 rotate-45" />
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
              
              {/* X-AXIS LABELS */}
              <div className="flex justify-between mt-2 text-[10px] text-zinc-400 font-bold uppercase pl-2">
                {growthTrendInfo.months.map(m => <span key={m} className="flex-1 text-center">{m}</span>)}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Figure 4: Feedback Balance */}
        <Card className="border-none shadow-sm flex flex-col">
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-lg">Event Feedback Balance</CardTitle>
                <CardDescription>Sentiment vs. Evaluation Score</CardDescription>
                <div className="flex flex-col gap-2 mt-2">
                  <div className="flex items-center gap-2">
                    <Select value={String(feedbackStartMonth)} onValueChange={(v) => setFeedbackStartMonth(parseInt(v))}>
                      <SelectTrigger className="h-8 w-[90px] text-[10px] font-bold bg-zinc-50/50 border-zinc-100 print-keep">
                        <SelectValue placeholder="Start" />
                      </SelectTrigger>
                      <SelectContent>
                        {ALL_MONTHS.map((m, i) => (
                          <SelectItem 
                            key={m} 
                            value={String(i)} 
                            disabled={i > feedbackEndMonth || (feedbackAvailableMonths.size > 0 && !feedbackAvailableMonths.has(i))}
                          >
                            {m}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <span className="text-[10px] font-black text-zinc-300">TO</span>
                    <Select value={String(feedbackEndMonth)} onValueChange={(v) => setFeedbackEndMonth(parseInt(v))}>
                      <SelectTrigger className="h-8 w-[90px] text-[10px] font-bold bg-zinc-50/50 border-zinc-100 print-keep">
                        <SelectValue placeholder="End" />
                      </SelectTrigger>
                      <SelectContent>
                        {ALL_MONTHS.map((m, i) => (
                          <SelectItem 
                            key={m} 
                            value={String(i)} 
                            disabled={i < feedbackStartMonth || (feedbackAvailableMonths.size > 0 && !feedbackAvailableMonths.has(i))}
                          >
                            {m}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="h-4 w-px bg-zinc-200 mx-1" />
                    <Select value={String(feedbackYear)} onValueChange={(v) => setFeedbackYear(parseInt(v))}>
                      <SelectTrigger className="h-8 w-[80px] text-[11px] font-bold bg-zinc-900 text-white border-zinc-900 print-keep">
                        <SelectValue placeholder="Year" />
                      </SelectTrigger>
                      <SelectContent>
                        {feedbackAvailableYears.map(y => (
                          <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Select value={selectedDEIB} onValueChange={setSelectedDEIB}>
                    <SelectTrigger className="h-8 w-full text-[10px] font-bold bg-zinc-50/50 border-zinc-100 print-keep">
                      <SelectValue placeholder="Filter by DEIB Event" />
                    </SelectTrigger>
                    <SelectContent>
                      {deibEvents.map(e => <SelectItem key={e} value={e}>{e === 'All' ? 'All DEIB Events' : e}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1 pb-12">
            {/* Legend */}
            <div className="mb-6 flex flex-wrap gap-4 justify-center">
              <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase text-zinc-500">
                <div className="h-2 w-2 rounded-full bg-green-500" /> Positive
              </div>
              <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase text-zinc-500">
                <div className="h-2 w-2 rounded-full bg-red-500" /> Negative
              </div>
              <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase text-yellow-500">
                <div className="h-0.5 w-4 bg-yellow-500" /> Avg Score
              </div>
            </div>

            <div className="flex gap-2">
              {/* Left Y-Axis */}
              <div className="flex flex-col justify-between text-[9px] text-zinc-400 h-[260px] pb-0 font-bold w-6 border-r border-zinc-50 pr-1 mt-20">
                <span>{feedbackEffectiveness.maxVal}</span>
                <span>{Math.round(feedbackEffectiveness.maxVal * 0.75)}</span>
                <span>{Math.round(feedbackEffectiveness.maxVal * 0.5)}</span>
                <span>{Math.round(feedbackEffectiveness.maxVal * 0.25)}</span>
                <span>0</span>
              </div>

              {/* Scrollable Chart Area */}
              <div className="flex-1 overflow-x-auto overflow-y-hidden pb-32 pt-16 custom-scrollbar">
                <div 
                  className="h-[260px] relative border-b border-zinc-100 flex items-end px-32"
                  style={{ minWidth: `${Math.max(feedbackEffectiveness.data.length * 80, 400)}px` }}
                >
                    <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-20">
                      {[0, 1, 2, 3, 4].map(line => (
                        <div key={line} className="w-full border-t border-zinc-300" />
                      ))}
                    </div>

                    <div className="flex-1 h-full relative flex items-end">
                      <svg 
                        viewBox="0 0 100 100" 
                        className="absolute inset-0 w-full h-full pointer-events-none overflow-visible z-20" 
                        preserveAspectRatio="none"
                      >
                        {(() => {
                          const n = feedbackEffectiveness.data.length || 1
                          const points = feedbackEffectiveness.data.map((d, i) => {
                            const x = (i / n) * 100 + (100 / n / 2)
                            const y = 100 - (Math.min(Math.max(d.score, 0), 5) / 5) * 100
                            return `${x},${y}`
                          })
                          
                          return (
                            points.length >= 2 && (
                              <path 
                                d={`M ${points.join(' L ')}`}
                                fill="none"
                                stroke="#eab308"
                                strokeWidth="1.5"
                                vectorEffect="non-scaling-stroke"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="transition-all duration-500 opacity-60"
                              />
                            )
                          )
                        })()}
                      </svg>

                      {/* Score Points (Divs to prevent oval distortion) */}
                      <div className="absolute inset-0 pointer-events-none z-30">
                        {feedbackEffectiveness.data.map((d, i) => {
                          const n = feedbackEffectiveness.data.length || 1
                          const x = (i / n) * 100 + (100 / n / 2)
                          const y = 100 - (Math.min(Math.max(d.score, 0), 5) / 5) * 100
                          return (
                            <div 
                              key={i}
                              className="absolute w-1.5 h-1.5 bg-yellow-500 rounded-full border border-white shadow-sm -translate-x-1/2 -translate-y-1/2 pointer-events-auto cursor-pointer"
                              style={{ left: `${x}%`, top: `${y}%` }}
                              onMouseEnter={() => setHoveredFeedbackIndex(i)}
                              onMouseLeave={() => setHoveredFeedbackIndex(null)}
                            />
                          )
                        })}
                      </div>

                      <div className="flex-1 flex justify-around items-end h-full">
                        {feedbackEffectiveness.data.map((item, i) => (
                          <div key={`${item.title}-${i}`} className="flex flex-col items-center justify-end h-full relative flex-1 min-w-[60px]">
                            <div className="flex items-end gap-1.5 mb-0 h-full pointer-events-none">
                              <div 
                                className="w-4 bg-green-500 rounded-t-sm transition-all hover:brightness-110 shadow-sm pointer-events-auto cursor-pointer" 
                                style={{ height: `${(item.pos / feedbackEffectiveness.maxVal) * 100}%` }}
                                onMouseEnter={() => setHoveredFeedbackIndex(i)}
                                onMouseLeave={() => setHoveredFeedbackIndex(null)}
                              />
                              <div 
                                className="w-4 bg-red-500 rounded-t-sm transition-all hover:brightness-110 shadow-sm pointer-events-auto cursor-pointer" 
                                style={{ height: `${(item.neg / feedbackEffectiveness.maxVal) * 100}%` }}
                                onMouseEnter={() => setHoveredFeedbackIndex(i)}
                              />
                            </div>
                            
                            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-px h-2 bg-zinc-300" />
                            <div className="absolute top-[272px] left-1/2 w-0 overflow-visible">
                              <div className="w-48 origin-top-left rotate-45 text-[9px] font-bold text-zinc-500 hover:text-zinc-900 transition-colors cursor-default leading-tight">
                                {item.title}
                              </div>
                            </div>

                            <div 
                              className={`absolute top-0 left-1/2 -translate-x-1/2 bg-zinc-900 text-white text-[10px] p-2.5 rounded shadow-2xl z-[100] pointer-events-none transition-all whitespace-nowrap flex flex-col gap-1.5 border border-white/10 ${hoveredFeedbackIndex === i ? 'opacity-100 scale-100 translate-y-2' : 'opacity-0 scale-95 translate-y-0'}`}
                            >
                              <div className="font-bold border-b border-zinc-700 pb-1 mb-1">{item.title}</div>
                              <div className="flex items-center gap-2">
                                <div className="h-2 w-2 rounded-full bg-green-500" />
                                Positive: {item.pos}
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="h-2 w-2 rounded-full bg-red-500" />
                                Negative: {item.neg}
                              </div>
                              <div className="flex items-center gap-2 border-t border-zinc-700 pt-1 mt-1 font-bold text-yellow-400">
                                <Award className="h-3.5 w-3.5" />
                                Score: {item.score.toFixed(1)}/5
                              </div>
                              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-zinc-900 rotate-45" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Y-Axis */}
                <div className="flex flex-col justify-between text-[9px] text-yellow-600 h-[260px] pb-0 font-bold w-6 text-right border-l border-zinc-50 pl-1 mt-20">
                  <span>5.0</span>
                  <span>3.75</span>
                  <span>2.5</span>
                  <span>1.25</span>
                  <span>0</span>
                </div>
              </div>
          </CardContent>
        </Card>

        {/* Figure 5: Heatmap */}
        <Card className="border-none shadow-sm flex flex-col">
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-lg">Cross-BU Participation Heatmap</CardTitle>
                <CardDescription>Member distribution across units</CardDescription>
                <div className="flex items-center gap-2 mt-2">
                  <Select value={String(heatmapStartMonth)} onValueChange={(v) => setHeatmapStartMonth(parseInt(v))}>
                    <SelectTrigger className="h-8 w-[80px] text-[10px] font-bold bg-zinc-50/50 border-zinc-100 print-keep">
                      <SelectValue placeholder="Start" />
                    </SelectTrigger>
                    <SelectContent>
                      {ALL_MONTHS.map((m, i) => (
                        <SelectItem 
                          key={m} 
                          value={String(i)} 
                          disabled={i > heatmapEndMonth || (heatmapAvailableMonths.size > 0 && !heatmapAvailableMonths.has(i))}
                        >
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={String(heatmapEndMonth)} onValueChange={(v) => setHeatmapEndMonth(parseInt(v))}>
                    <SelectTrigger className="h-8 w-[80px] text-[10px] font-bold bg-zinc-50/50 border-zinc-100 print-keep">
                      <SelectValue placeholder="End" />
                    </SelectTrigger>
                    <SelectContent>
                      {ALL_MONTHS.map((m, i) => (
                        <SelectItem 
                          key={m} 
                          value={String(i)} 
                          disabled={i < heatmapStartMonth || (heatmapAvailableMonths.size > 0 && !heatmapAvailableMonths.has(i))}
                        >
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="h-4 w-px bg-zinc-200 mx-1" />
                  <Select value={String(heatmapYear)} onValueChange={(v) => setHeatmapYear(parseInt(v))}>
                    <SelectTrigger className="h-8 w-[80px] text-[11px] font-bold bg-zinc-900 text-white border-zinc-900 print-keep">
                      <SelectValue placeholder="Year" />
                    </SelectTrigger>
                    <SelectContent>
                      {heatmapAvailableYears.map(y => (
                        <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0 flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-x-auto overflow-y-auto border-t pt-2 pb-12 min-h-[500px] custom-scrollbar flex flex-col items-center">
              {heatmapData.rows.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full py-20 text-zinc-400">
                  <BarChart3 className="h-10 w-10 mb-2 opacity-20" />
                  <p className="text-sm font-medium">No data found</p>
                </div>
              ) : (
                <div className="text-[11px] flex flex-col gap-[4px] w-fit pr-12 -ml-12 -mt-4">
                  {/* Header Row */}
                  <div className="flex" style={{ gap: '4px', height: '150px' }}>
                    <div style={{ width: '200px', flexShrink: 0 }} className="flex items-end justify-end p-4 pb-6 font-black text-[11px] uppercase tracking-[0.15em] text-zinc-400 border-b-2 border-zinc-100 pr-8">ERG / BU</div>
                    {heatmapData.columns.map(bu => (
                      <div key={bu} style={{ width: '65px', flexShrink: 0 }} className="flex items-end justify-center font-bold text-zinc-500 relative">
                        <div 
                          style={{ 
                            transform: 'rotate(-45deg)', 
                            transformOrigin: 'bottom left',
                            marginBottom: '10px',
                            marginLeft: '15px'
                          }} 
                          className="uppercase tracking-wider text-[10px] whitespace-nowrap absolute bottom-0 left-1/2"
                        >
                          {bu}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Data Rows */}
                  {heatmapData.rows.map((row) => (
                    <div key={row.erg} className="flex" style={{ gap: '4px' }}>
                      <div 
                        style={{ width: '200px', height: '65px', flexShrink: 0 }} 
                        className="flex items-center justify-end px-8 font-semibold text-zinc-600 dark:text-zinc-400 border-r-2 border-zinc-100 text-[12px] leading-snug text-right"
                      >
                        {row.erg}
                      </div>
                      {heatmapData.columns.map(bu => {
                        const val = (row as any)[bu] || 0
                        const maxPossible = Math.max(...heatmapData.rows.flatMap(r => heatmapData.columns.map(b => (r as any)[b] || 0)))
                        const intensity = maxPossible > 0 ? (val / maxPossible) : 0
                        return (
                          <div 
                            key={bu} 
                            className="relative group/cell font-bold transition-all duration-200"
                            style={{ 
                              width: '65px', 
                              height: '65px', 
                              flexShrink: 0,
                              backgroundColor: val > 0 ? `rgba(0, 70, 171, ${0.05 + (intensity * 0.8)})` : 'transparent', 
                              border: val > 0 ? 'none' : '1px solid #e4e4e7',
                              color: intensity > 0.5 ? 'white' : (val > 0 ? '#0046ab' : '#ccc'),
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: '14px'
                            }}
                          >
                            <span className="w-full text-center">{val}</span>
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 px-3 py-2 bg-zinc-900 text-white rounded text-[10px] opacity-0 group-hover/cell:opacity-100 z-50 whitespace-nowrap pointer-events-none transition-all shadow-xl flex flex-col items-center">
                              <span className="font-bold border-b border-white/20 mb-1 pb-1 w-full text-center">{row.erg}</span>
                              <span>BU: {bu}</span>
                              <span className="text-blue-400 font-black mt-1">Total: {val}</span>
                              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-zinc-900 rotate-45" />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function Button({ children, className, onClick, variant }: any) {
  const base = "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 h-9 px-4 py-2"
  const variants: any = {
    default: "bg-[#0046ab] text-white shadow hover:bg-[#003a8f]",
    outline: "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground",
    ghost: "hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
  }
  return <button className={`${base} ${variants[variant || 'default']} ${className}`} onClick={onClick}>{children}</button>
}
