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
  
  // Filter States
  const [selectedERG, setSelectedERG] = useState("All")
  const [selectedBU, setSelectedBU] = useState("All")

  useEffect(() => {
    setMembershipData(JSON.parse(localStorage.getItem("erg_membership_registry") || "[]"))
    setSnapshots(JSON.parse(localStorage.getItem("erg_membership_snapshots") || "[]"))
    setEventLogs(JSON.parse(localStorage.getItem("erg_event_logs") || "[]"))
    setFeedback(JSON.parse(localStorage.getItem("erg_feedback_summaries") || "[]"))
    setParticipation(JSON.parse(localStorage.getItem("erg_participation_details") || "[]"))
  }, [])

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

  // Figure 2: Monthly Growth Trends (Simulated Multi-series Line Chart)
  const growthTrends = useMemo(() => {
    const relevantSnapshots = snapshots.filter(s => selectedERG === "All" || s.ERG === selectedERG)
    const months = ["Jan Members", "Feb Members", "Mar Members", "Apr Members"]
    return relevantSnapshots.map(s => ({
      name: s.ERG,
      data: months.map(m => s[m] || 0),
      growth: s["Growth Rate %"] || 0
    }))
  }, [snapshots, selectedERG])

  // Figure 3: Attendance by Activity Type (Stacked Column)
  const attendanceByType = useMemo(() => {
    const relevantEvents = eventLogs.filter(e => selectedERG === "All" || e.ERG === selectedERG)
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
  }, [eventLogs, selectedERG, ergs])

  // Figure 4: Feedback Effectiveness (Combo Chart)
  const feedbackEffectiveness = useMemo(() => {
    const relevantFeedback = feedback.filter(f => selectedERG === "All" || f.ERG === selectedERG)
    return relevantFeedback.slice(-6).map(f => ({
      title: f["Activity Title"],
      score: Number(f["Overall Evaluation Score"]) || 0,
      pos: Number(f["Positive Feedbacks"]) || 0,
      neg: Number(f["Negative Feedbacks"]) || 0,
      count: Number(f["Response Count"]) || 0
    }))
  }, [feedback, selectedERG])

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
    
    const avgScore = feedback.filter(f => selectedERG === "All" || f.ERG === selectedERG)
      .reduce((acc, curr) => acc + (Number(curr["Overall Evaluation Score"]) || 0), 0) / (feedback.length || 1)

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
          <h1 className="text-3xl font-bold">ERG Dashboard</h1>
          <p className="text-zinc-500">Holistic Performance & Impact Monitor</p>
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
          <CardHeader><CardTitle className="text-lg">Active Members by ERG</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {ergsDist.map(item => (
              <div key={item.label} className="space-y-1">
                <div className="flex justify-between text-xs font-medium"><span>{item.label}</span><span>{item.count}</span></div>
                <div className="h-2 bg-zinc-100 rounded-full dark:bg-zinc-800">
                  <div className="h-2 bg-[#0046ab] rounded-full" style={{ width: `${(item.count / ergsDist[0].count) * 100}%` }} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Figure 2: Growth Trends */}
        <Card className="border-none shadow-sm">
          <CardHeader><CardTitle className="text-lg">Membership Growth Trends</CardTitle></CardHeader>
          <CardContent>
            <div className="h-[200px] flex items-end gap-2 px-2 border-b border-l pb-2">
              {growthTrends.map((trend, i) => (
                <div key={trend.name} className="flex-1 flex flex-col justify-end gap-1 group relative">
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-zinc-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity z-10 whitespace-nowrap">
                    {trend.name}: {trend.growth}%
                  </div>
                  {trend.data.map((val, j) => (
                    <div key={j} className="w-full bg-[#0046ab] opacity-60 rounded-t-sm" style={{ height: `${(val / 100) * 100}px` }} />
                  ))}
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-2 text-[10px] text-zinc-400 font-bold uppercase">
              <span>Jan</span><span>Feb</span><span>Mar</span><span>Apr</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Figure 3: Stacked Attendance */}
        <Card className="border-none shadow-sm lg:col-span-2">
          <CardHeader><CardTitle className="text-lg">Attendance by ERG & Activity Type</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-6">
              {attendanceByType.map(item => (
                <div key={item.erg} className="space-y-2">
                  <div className="text-xs font-bold">{item.erg}</div>
                  <div className="flex h-4 w-full rounded-full overflow-hidden bg-zinc-100 dark:bg-zinc-800">
                    <div className="bg-blue-600 h-full" style={{ width: '30%' }} title="Webinar" />
                    <div className="bg-indigo-600 h-full" style={{ width: '25%' }} title="Learning" />
                    <div className="bg-violet-600 h-full" style={{ width: '20%' }} title="Forum" />
                    <div className="bg-sky-600 h-full" style={{ width: '15%' }} title="Partnership" />
                  </div>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-4 mt-6">
              {["Webinar", "Learning", "Forum", "Partnership"].map((t, i) => (
                <div key={t} className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-zinc-500">
                  <div className={`h-2 w-2 rounded-full ${['bg-blue-600', 'bg-indigo-600', 'bg-violet-600', 'bg-sky-600'][i]}`} /> {t}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Figure 4: Feedback Combo */}
        <Card className="border-none shadow-sm">
          <CardHeader><CardTitle className="text-lg">Event Feedback Balance</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {feedbackEffectiveness.map(f => (
              <div key={f.title} className="p-3 bg-zinc-50 rounded-lg dark:bg-zinc-900/50">
                <div className="flex justify-between items-start mb-2">
                  <div className="text-xs font-bold truncate pr-2">{f.title}</div>
                  <Badge className="bg-green-500">{f.score}</Badge>
                </div>
                <div className="flex gap-4">
                  <div className="flex items-center gap-1 text-[10px] font-bold text-green-600"><ThumbsUp className="h-3 w-3" /> {f.pos}</div>
                  <div className="flex items-center gap-1 text-[10px] font-bold text-red-600"><ThumbsDown className="h-3 w-3" /> {f.neg}</div>
                  <div className="flex items-center gap-1 text-[10px] font-bold text-zinc-400 ml-auto"><MessageSquare className="h-3 w-3" /> {f.count}</div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Figure 5: Heatmap */}
      <Card className="border-none shadow-sm">
        <CardHeader><CardTitle className="text-lg">Cross-BU Participation Heatmap</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr>
                <th className="p-2 text-left bg-zinc-50 dark:bg-zinc-800">ERG / Business Unit</th>
                {bus.filter(b => b !== "All").map(bu => <th key={bu} className="p-2 text-center bg-zinc-50 dark:bg-zinc-800">{bu}</th>)}
              </tr>
            </thead>
            <tbody>
              {heatmapData.map(row => (
                <tr key={row.erg} className="border-b">
                  <td className="p-2 font-medium bg-zinc-50/50 dark:bg-zinc-800/30">{row.erg}</td>
                  {bus.filter(b => b !== "All").map(bu => {
                    const val = row[bu] || 0
                    const intensity = Math.min(val * 10, 90)
                    return (
                      <td key={bu} className="p-2 text-center transition-colors hover:scale-110" style={{ backgroundColor: val > 0 ? `rgba(0, 70, 171, ${intensity / 100})` : 'transparent', color: intensity > 50 ? 'white' : 'inherit' }}>
                        {val}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
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
