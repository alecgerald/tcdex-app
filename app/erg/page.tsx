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

export default function ERGDashboard() {
  const [membershipData, setMembershipData] = useState<any[]>([])
  const [snapshots, setSnapshots] = useState<any[]>([])
  const [eventLogs, setEventLogs] = useState<any[]>([])
  const [feedback, setFeedback] = useState<any[]>([])
  const [participation, setParticipation] = useState<any[]>([])
  const [auditLogs, setAuditLogs] = useState<any[]>([])
  
  // Filter States
  const [selectedERG, setSelectedERG] = useState("All")
  const [selectedBU, setSelectedBU] = useState("All")
  const [showTrendlines, setShowTrendlines] = useState(true)

  // Date Range Filter States
  const ALL_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
  const [startMonth, setStartMonth] = useState(0) // Jan
  const [endMonth, setEndMonth] = useState(11)    // Dec

  // Figure 3 (Attendance) Date Range Filter States
  const [attendanceStartMonth, setAttendanceStartMonth] = useState(0)
  const [attendanceEndMonth, setAttendanceEndMonth] = useState(11)

  // Figure 4 (Feedback) Date Range Filter States
  const [feedbackStartMonth, setFeedbackStartMonth] = useState(0)
  const [feedbackEndMonth, setFeedbackEndMonth] = useState(11)
  const [selectedDEIB, setSelectedDEIB] = useState("All")
  const [hoveredFeedbackIndex, setHoveredFeedbackIndex] = useState<number | null>(null)

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
    const relevantSnapshots = snapshots.filter(s => selectedERG === "All" || s.ERG === selectedERG)
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

    return { trends, maxVal, months: displayMonths }
  }, [snapshots, selectedERG, startMonth, endMonth])


  // Figure 3: Attendance by Activity Type (Stacked Column)
  const attendanceByType = useMemo(() => {
    const relevantEvents = eventLogs.filter(e => {
      const matchERG = selectedERG === "All" || e.ERG === selectedERG
      
      // Date Filtering
      const date = new Date(e["Event Date"])
      const monthIndex = date.getMonth()
      const matchDate = !isNaN(monthIndex) && monthIndex >= attendanceStartMonth && monthIndex <= attendanceEndMonth
      
      return matchERG && matchDate
    })
    const types = ["Internal Webinar", "Learning Session", "Internal Forum", "External Partnership"]
    const ergsList = selectedERG === "All" ? ergs.filter(e => e !== "All") : [selectedERG]
    
    return ergsList.map(erg => {
      const ergEvents = relevantEvents.filter(e => e.ERG === erg)
      const typeCounts: Record<string, number> = {}
      types.forEach(t => {
        typeCounts[t] = ergEvents.filter(e => e["Activity Type"] === t)
          .reduce((acc, curr) => acc + (Number(curr["Attendance / Participation Count"]) || 0), 0)
      })
      return { erg, ...typeCounts }
    })
  }, [eventLogs, selectedERG, ergs, attendanceStartMonth, attendanceEndMonth])

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
      const matchDate = !isNaN(monthIndex) && monthIndex >= feedbackStartMonth && monthIndex <= feedbackEndMonth
      
      return matchERG && matchDEIB && matchDate
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
  }, [feedback, selectedERG, selectedDEIB, feedbackStartMonth, feedbackEndMonth])

  const deibEvents = useMemo(() => ["All", ...Array.from(new Set(feedback.map(f => f["DEIB event"])))].filter(Boolean), [feedback])

  // Figure 5: Cross-BU Participation Heatmap
  const heatmapData = useMemo(() => {
    const relevantParticipation = participation.filter(p => selectedERG === "All" || p.ERG === selectedERG)
    const ergsList = ergs.filter(e => e !== "All")
    const busList = bus.filter(b => b !== "All")
    
    return ergsList.map(erg => {
      const buCounts: Record<string, number> = {}
      busList.forEach(bu => {
        buCounts[bu] = relevantParticipation.filter(p => p.ERG === erg && p["Delivery Unit / Business Unit"] === bu).length
      })
      return { erg, ...buCounts }
    })
  }, [participation, selectedERG, ergs, bus])

  const kpis = useMemo(() => {
    const active = filteredMembership.filter(m => m.Status === "Active").length
    const growth = snapshots.filter(s => selectedERG === "All" || s.ERG === selectedERG)
      .reduce((acc, curr) => acc + (parseFloat(curr["Growth Rate %"]) || 0), 0) / (snapshots.length || 1)
    
    const events = eventLogs.filter(e => selectedERG === "All" || e.ERG === selectedERG)
    const attendance = events.reduce((acc, curr) => acc + (Number(curr["Attendance / Participation Count"]) || 0), 0)
    
    const filteredFeedback = feedback.filter(f => selectedERG === "All" || f.ERG === selectedERG)
    const avgScore = (filteredFeedback.length > 0)
      ? filteredFeedback.reduce((acc, curr) => acc + (Number(curr["Overall Evaluation Score"]) || 0), 0) / filteredFeedback.length
      : 0

    return [
      { title: "Active Members", value: active.toLocaleString(), icon: Users, description: "Total in directory" },
      { title: "Avg Growth Rate", value: `${growth.toFixed(1)}%`, icon: TrendingUp, description: "Month-over-month" },
      { title: "Total Attendance", value: attendance.toLocaleString(), icon: Activity, description: "Across all events" },
      { title: "Evaluation Score", value: `${avgScore.toFixed(1)}/5.0`, icon: Award, description: "Event quality avg" }
    ]
  }, [filteredMembership, snapshots, eventLogs, feedback, selectedERG])

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
              Last Sync: {new Date().toLocaleDateString()} {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        </div>
        <div className="flex gap-4">
          <Select value={selectedERG} onValueChange={setSelectedERG}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="All ERGs" /></SelectTrigger>
            <SelectContent>{ergs.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={selectedBU} onValueChange={setSelectedBU}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="All Business Units" /></SelectTrigger>
            <SelectContent>{bus.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
          </Select>
          <Button variant="outline" onClick={() => window.print()}><Download className="h-4 w-4 mr-2" /> PDF</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {kpis.map(kpi => (
          <Card key={kpi.title} className="border-none shadow-sm">
            <CardContent className="p-6">
              <div className="p-2 bg-[#0046ab]/10 rounded-lg w-fit mb-4"><kpi.icon className="h-5 w-5 text-[#0046ab]" /></div>
              <h3 className="text-sm font-medium text-zinc-500">{kpi.title}</h3>
              <p className="text-2xl font-bold">{kpi.value}</p>
              <p className="text-xs text-zinc-400 mt-1">{kpi.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Figure 1: Horizontal Bar */}
        <Card className="border-none shadow-sm">
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="text-lg">Active Members by ERG</CardTitle>
              {latestRegistryUpdate && (
                <Badge variant="outline" className="text-[10px] font-medium text-zinc-400 border-zinc-100 flex items-center gap-1.5">
                  <Calendar className="h-3 w-3" />
                  Latest Upload: {latestRegistryUpdate}
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

        {/* Figure 2: Growth Trends */}
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
                  <Select value={String(startMonth)} onValueChange={(v) => setStartMonth(parseInt(v))}>
                    <SelectTrigger className="h-8 w-[100px] text-[11px] font-semibold bg-zinc-50/50 border-zinc-100">
                      <SelectValue placeholder="Start" />
                    </SelectTrigger>
                    <SelectContent>
                      {ALL_MONTHS.map((m, i) => (
                        <SelectItem key={m} value={String(i)} disabled={i > endMonth}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="text-[10px] font-black text-zinc-300 uppercase tracking-widest">to</span>
                  <Select value={String(endMonth)} onValueChange={(v) => setEndMonth(parseInt(v))}>
                    <SelectTrigger className="h-8 w-[100px] text-[11px] font-semibold bg-zinc-50/50 border-zinc-100">
                      <SelectValue placeholder="End" />
                    </SelectTrigger>
                    <SelectContent>
                      {ALL_MONTHS.map((m, i) => (
                        <SelectItem key={m} value={String(i)} disabled={i < startMonth}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex gap-2 flex-wrap justify-end max-w-[200px]">
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
              <div className="flex flex-col justify-between text-[10px] text-zinc-400 h-[200px] pb-6 font-bold">
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
                                <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-zinc-900 text-white text-[11px] font-bold px-3 py-1.5 rounded-md opacity-0 group-hover:opacity-100 z-50 whitespace-nowrap pointer-events-none transition-all duration-200 shadow-xl border border-white/10 flex items-center gap-2">
                                  <div className="h-2 w-2 rounded-full" style={{ backgroundColor: ergColors[trend.name] }} />
                                  <span>{trend.name}: {val.toLocaleString()}</span>
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
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Figure 3: Stacked Attendance */}
        <Card className="border-none shadow-sm">
          <CardHeader>
            <div className="flex justify-between items-start">
              <CardTitle className="text-lg">Attendance by ERG & Activity Type</CardTitle>
              <div className="flex items-center gap-2">
                <Select value={String(attendanceStartMonth)} onValueChange={(v) => setAttendanceStartMonth(parseInt(v))}>
                  <SelectTrigger className="h-8 w-[90px] text-[10px] font-bold bg-zinc-50/50 border-zinc-100">
                    <SelectValue placeholder="Start" />
                  </SelectTrigger>
                  <SelectContent>
                    {ALL_MONTHS.map((m, i) => (
                      <SelectItem key={m} value={String(i)} disabled={i > attendanceEndMonth}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-[10px] font-black text-zinc-300">TO</span>
                <Select value={String(attendanceEndMonth)} onValueChange={(v) => setAttendanceEndMonth(parseInt(v))}>
                  <SelectTrigger className="h-8 w-[90px] text-[10px] font-bold bg-zinc-50/50 border-zinc-100">
                    <SelectValue placeholder="End" />
                  </SelectTrigger>
                  <SelectContent>
                    {ALL_MONTHS.map((m, i) => (
                      <SelectItem key={m} value={String(i)} disabled={i < attendanceStartMonth}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {attendanceByType.map(item => {
                const types = ["Internal Webinar", "Learning Session", "Internal Forum", "External Partnership"]
                const totalAttendance = types.reduce((acc, t) => acc + (item[t] || 0), 0)
                const visibleTypes = types.filter(t => (item[t] || 0) > 0)
                
                return (
                  <div key={item.erg} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <div className="text-xs font-bold">{item.erg}</div>
                      <div className="text-[10px] text-zinc-400 font-medium">Total: {totalAttendance.toLocaleString()}</div>
                    </div>
                    <div className="flex h-4 w-full rounded-full bg-zinc-100 dark:bg-zinc-800 relative">
                      {types.map((t, i) => {
                        const val = item[t] || 0
                        const percentage = totalAttendance > 0 ? (val / totalAttendance) * 100 : 0
                        const colors = ['bg-blue-600', 'bg-indigo-600', 'bg-violet-600', 'bg-sky-600']
                        const isFirst = t === visibleTypes[0]
                        const isLast = t === visibleTypes[visibleTypes.length - 1]
                        
                        return (
                          <div 
                            key={t}
                            className={`${colors[i]} h-full transition-all hover:brightness-110 relative group ${isFirst ? 'rounded-l-full' : ''} ${isLast ? 'rounded-r-full' : ''}`}
                            style={{ width: `${percentage}%` }}
                          >
                            {val > 0 && (
                              <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-zinc-900 text-white text-[11px] font-bold px-3 py-1.5 rounded-md opacity-0 group-hover:opacity-100 z-50 whitespace-nowrap pointer-events-none transition-all duration-200 shadow-xl border border-white/10 flex items-center gap-2">
                                <div className={`h-2 w-2 rounded-full ${colors[i]}`} />
                                <span>{t.replace('Internal ', '')}: {val.toLocaleString()}</span>
                                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-zinc-900 rotate-45" />
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="flex flex-wrap gap-4 mt-6">
              {["Internal Webinar", "Learning Session", "Internal Forum", "External Partnership"].map((t, i) => (
                <div key={t} className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-zinc-500">
                  <div className={`h-2 w-2 rounded-full ${['bg-blue-600', 'bg-indigo-600', 'bg-violet-600', 'bg-sky-600'][i]}`} /> {t.replace('Internal ', '').replace(' Session', '')}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

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
                      <SelectTrigger className="h-8 w-[90px] text-[10px] font-bold bg-zinc-50/50 border-zinc-100">
                        <SelectValue placeholder="Start" />
                      </SelectTrigger>
                      <SelectContent>
                        {ALL_MONTHS.map((m, i) => (
                          <SelectItem key={m} value={String(i)} disabled={i > feedbackEndMonth}>{m}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <span className="text-[10px] font-black text-zinc-300">TO</span>
                    <Select value={String(feedbackEndMonth)} onValueChange={(v) => setFeedbackEndMonth(parseInt(v))}>
                      <SelectTrigger className="h-8 w-[90px] text-[10px] font-bold bg-zinc-50/50 border-zinc-100">
                        <SelectValue placeholder="End" />
                      </SelectTrigger>
                      <SelectContent>
                        {ALL_MONTHS.map((m, i) => (
                          <SelectItem key={m} value={String(i)} disabled={i < feedbackStartMonth}>{m}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Select value={selectedDEIB} onValueChange={setSelectedDEIB}>
                    <SelectTrigger className="h-8 w-full text-[10px] font-bold bg-zinc-50/50 border-zinc-100">
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
            {/* Legend - Back at the Top */}
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
              {/* Left Y-Axis (Feedback Count) */}
              <div className="flex flex-col justify-between text-[9px] text-zinc-400 h-[260px] pb-0 font-bold w-6 border-r border-zinc-50 pr-1 mt-20">
                <span>{feedbackEffectiveness.maxVal}</span>
                <span>{Math.round(feedbackEffectiveness.maxVal * 0.75)}</span>
                <span>{Math.round(feedbackEffectiveness.maxVal * 0.5)}</span>
                <span>{Math.round(feedbackEffectiveness.maxVal * 0.25)}</span>
                <span>0</span>
              </div>

              {/* Scrollable Chart Area */}
              <div className="flex-1 overflow-x-auto overflow-y-hidden pb-32 pt-20">
                <div 
                  className="h-[260px] relative border-b border-zinc-100 flex items-end px-4"
                  style={{ minWidth: `${Math.max(feedbackEffectiveness.data.length * 80, 400)}px` }}
                >
                    {/* Grid Lines */}
                    <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-20">
                      {[0, 1, 2, 3, 4].map(line => (
                        <div key={line} className="w-full border-t border-zinc-300" />
                      ))}
                    </div>

                    {/* SVG Line Chart (Score Axis) */}
                    <svg 
                      viewBox="0 0 100 100" 
                      className="absolute inset-y-0 left-4 right-4 w-[calc(100%-2rem)] h-[260px] pointer-events-none overflow-visible z-20" 
                      preserveAspectRatio="none"
                    >
                      {(() => {
                        const points = feedbackEffectiveness.data.map((d, i) => {
                          const n = feedbackEffectiveness.data.length || 1
                          const x = (i / n) * 100 + (100 / n / 2)
                          const y = 100 - (Math.min(Math.max(d.score, 0), 5) / 5) * 100
                          return `${x},${y}`
                        })
                        
                        return (
                          <>
                            {points.length >= 2 && (
                              <path 
                                d={`M ${points.join(' L ')}`}
                                fill="none"
                                stroke="#eab308"
                                strokeWidth="0.6"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="transition-all duration-500 opacity-80"
                              />
                            )}
                            {points.map((p, i) => {
                              const [x, y] = p.split(',')
                              return (
                                <circle 
                                  key={i} 
                                  cx={x} 
                                  cy={y} 
                                  r="1.5" 
                                  fill="#eab308" 
                                  stroke="white" 
                                  strokeWidth="0.3" 
                                  className="pointer-events-auto cursor-pointer"
                                  onMouseEnter={() => setHoveredFeedbackIndex(i)}
                                  onMouseLeave={() => setHoveredFeedbackIndex(null)}
                                />
                              )
                            })}
                          </>
                        )
                      })()}
                    </svg>

                    {/* Clustered Bars */}
                    <div className="flex-1 flex justify-around items-end h-full">
                      {feedbackEffectiveness.data.map((item, i) => (
                        <div key={`${item.title}-${i}`} className="flex flex-col items-center justify-end h-full relative flex-1 min-w-[60px]">
                          <div className="flex items-end gap-1.5 mb-0 h-full pointer-events-none">
                            {/* Positive Bar */}
                            <div 
                              className="w-4 bg-green-500 rounded-t-sm transition-all hover:brightness-110 shadow-sm pointer-events-auto cursor-pointer" 
                              style={{ height: `${(item.pos / feedbackEffectiveness.maxVal) * 100}%` }}
                              onMouseEnter={() => setHoveredFeedbackIndex(i)}
                              onMouseLeave={() => setHoveredFeedbackIndex(null)}
                            />
                            {/* Negative Bar */}
                            <div 
                              className="w-4 bg-red-500 rounded-t-sm transition-all hover:brightness-110 shadow-sm pointer-events-auto cursor-pointer" 
                              style={{ height: `${(item.neg / feedbackEffectiveness.maxVal) * 100}%` }}
                              onMouseEnter={() => setHoveredFeedbackIndex(i)}
                            />
                          </div>
                          
                          {/* X-Axis Tick */}
                          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-px h-2 bg-zinc-300" />

                          {/* X-Axis Label (Rotated) */}
                          <div className="absolute top-[272px] left-1/2 w-0 overflow-visible">
                            <div className="w-48 origin-top-left rotate-45 text-[9px] font-bold text-zinc-500 hover:text-zinc-900 transition-colors cursor-default leading-tight">
                              {item.title}
                            </div>
                          </div>

                          {/* Tooltip */}
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
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Right Y-Axis (Evaluation Score) */}
                <div className="flex flex-col justify-between text-[9px] text-yellow-600 h-[260px] pb-0 font-bold w-6 text-right border-l border-zinc-50 pl-1 mt-20">
                  <span>5.0</span>
                  <span>3.75</span>
                  <span>2.5</span>
                  <span>1.25</span>
                  <span>0</span>
                  </div>
                  </div>
                  </CardContent>        </Card>
      </div>

      {/* Figure 5: Heatmap */}
      <Card className="border-none shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Cross-BU Participation Heatmap</CardTitle>
          <CardDescription>Member distribution across delivery units</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto border-t pt-8 pb-16 min-h-[450px] custom-scrollbar">
            <table className="text-[11px] border-collapse mx-auto">
              <thead>
                <tr>
                  <th className="p-3 text-left bg-zinc-50 dark:bg-zinc-900 sticky left-0 z-30 border-r border-b font-bold text-zinc-500 min-w-[160px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] h-[180px] align-bottom">
                    ERG / Business Unit
                  </th>
                  {bus.filter(b => b !== "All").map(bu => (
                    <th key={bu} className="p-0 bg-zinc-50 dark:bg-zinc-900 border-r border-b font-bold text-zinc-500 w-12 h-[180px] min-w-[48px] align-bottom pb-6">
                      <div className="flex justify-center h-0 overflow-visible">
                        <span className="inline-block -rotate-90 whitespace-nowrap origin-left -translate-x-1/2 ml-1 text-[10px] uppercase tracking-wider">
                          {bu}
                        </span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {heatmapData.map((row, rowIndex) => (
                  <tr key={row.erg} className="group/row">
                    <td className="p-3 font-bold bg-white dark:bg-zinc-950 sticky left-0 z-20 border-r border-b text-zinc-700 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] group-hover/row:bg-zinc-50 transition-colors whitespace-nowrap">
                      {row.erg}
                    </td>
                    {bus.filter(b => b !== "All").map(bu => {
                      const val = row[bu] || 0
                      const maxPossible = Math.max(...heatmapData.flatMap(r => bus.filter(b => b !== "All").map(b => r[b] || 0)))
                      const intensity = maxPossible > 0 ? (val / maxPossible) : 0
                      
                      return (
                        <td 
                          key={bu} 
                          className="p-0 border-r border-b relative group/cell w-12 h-12"
                        >
                          <div 
                            className="w-12 h-12 flex items-center justify-center transition-all duration-200 font-bold"
                            style={{ 
                              backgroundColor: val > 0 ? `rgba(0, 70, 171, ${0.05 + (intensity * 0.8)})` : 'transparent', 
                              color: intensity > 0.5 ? 'white' : (val > 0 ? '#0046ab' : '#ccc')
                            }}
                          >
                            {val}
                          </div>
                          
                          {/* TOOLTIP */}
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-zinc-900 text-white rounded text-[10px] opacity-0 group-hover/cell:opacity-100 z-50 whitespace-nowrap pointer-events-none transition-all shadow-xl flex flex-col items-center gap-1 border border-white/10">
                            <span className="text-zinc-400 uppercase font-black tracking-wider text-[8px] border-b border-zinc-700 pb-1 mb-1 w-full text-center">
                              Participation Details
                            </span>
                            <span className="font-bold">{row.erg}</span>
                            <span className="opacity-80">Unit: {bu}</span>
                            <span className="text-[#3b82f6] text-xs mt-1">Total: {val}</span>
                            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-zinc-900 rotate-45" />
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
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
