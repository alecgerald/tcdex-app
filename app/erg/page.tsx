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
  Award
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface KPI {
  title: string
  value: string | number
  description: string
  icon: any
  trend?: number
}

export default function ERGDashboard() {
  const [membershipData, setMembershipData] = useState<any[]>([])
  const [snapshots, setSnapshots] = useState<any[]>([])
  const [eventLogs, setEventLogs] = useState<any[]>([])
  const [feedback, setFeedback] = useState<any[]>([])
  const [participation, setParticipation] = useState<any[]>([])

  useEffect(() => {
    setMembershipData(JSON.parse(localStorage.getItem("erg_membership_registry") || "[]"))
    setSnapshots(JSON.parse(localStorage.getItem("erg_membership_snapshots") || "[]"))
    setEventLogs(JSON.parse(localStorage.getItem("erg_event_logs") || "[]"))
    setFeedback(JSON.parse(localStorage.getItem("erg_feedback_summaries") || "[]"))
    setParticipation(JSON.parse(localStorage.getItem("erg_participation_details") || "[]"))
  }, [])

  const kpis = useMemo(() => {
    // 1. Total Members
    const totalMembers = membershipData.length
    
    // 2. Growth Rate (simplified from snapshots)
    const latestSnapshot = snapshots.length > 0 ? snapshots[snapshots.length - 1] : null
    const prevSnapshot = snapshots.length > 1 ? snapshots[snapshots.length - 2] : null
    let growthRate = 0
    if (latestSnapshot && prevSnapshot) {
      const current = latestSnapshot["Total Members"] || 0
      const previous = prevSnapshot["Total Members"] || 0
      growthRate = previous > 0 ? ((current - previous) / previous) * 100 : 0
    }

    // 3. Attendance Rate
    const totalParticipation = participation.length
    const attendedCount = participation.filter(p => p.Status === "Attended").length
    const attendanceRate = totalParticipation > 0 ? (attendedCount / totalParticipation) * 100 : 0

    // 4. Satisfaction Score
    const avgRating = feedback.length > 0 
      ? feedback.reduce((acc, curr) => acc + (Number(curr.Rating) || 0), 0) / feedback.length 
      : 0

    return [
      {
        title: "Total Members",
        value: totalMembers.toLocaleString(),
        description: "Active in registry",
        icon: Users,
        trend: growthRate !== 0 ? growthRate : undefined
      },
      {
        title: "Growth Rate",
        value: `${growthRate.toFixed(1)}%`,
        description: "Vs. previous snapshot",
        icon: TrendingUp,
        trend: growthRate
      },
      {
        title: "Attendance Rate",
        value: `${attendanceRate.toFixed(1)}%`,
        description: "Avg. event participation",
        icon: Activity,
      },
      {
        title: "Satisfaction Score",
        value: `${avgRating.toFixed(1)}/5.0`,
        description: "Event feedback avg",
        icon: Heart,
      }
    ]
  }, [membershipData, snapshots, participation, feedback])

  if (membershipData.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">ERG Dashboard</h1>
          <p className="text-zinc-500 dark:text-zinc-400">Employee Resource Group Analytics & Performance</p>
        </div>
        <Card className="border-dashed border-2 bg-transparent">
          <CardContent className="flex flex-col items-center justify-center py-24 text-center">
            <div className="h-20 w-20 rounded-full bg-zinc-100 flex items-center justify-center mb-6 dark:bg-zinc-800">
              <BarChart3 className="h-10 w-10 text-zinc-400" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Registry Data Missing</h2>
            <p className="text-zinc-500 max-w-sm mb-8">
              To view analytics, please upload the Membership Registry Excel file with the standard columns.
            </p>
            <Button className="bg-[#0046ab] hover:bg-[#003a8f] text-white" onClick={() => window.location.href='/erg/upload'}>
              Import Registry
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">ERG Dashboard</h1>
          <p className="text-zinc-500 dark:text-zinc-400">Holistic performance view across all ERGs.</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-zinc-500 bg-white border rounded-lg px-3 py-1.5 dark:bg-zinc-900">
          <Calendar className="h-4 w-4" />
          <span>Last updated: {new Date().toLocaleDateString()}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {kpis.map((kpi) => (
          <Card key={kpi.title} className="border-none shadow-sm overflow-hidden">
            <CardContent className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div className="p-2 bg-[#0046ab]/10 rounded-lg">
                  <kpi.icon className="h-5 w-5 text-[#0046ab]" />
                </div>
                {kpi.trend !== undefined && (
                  <div className={`flex items-center text-xs font-bold ${kpi.trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {kpi.trend >= 0 ? <ArrowUpRight className="h-3 w-3 mr-0.5" /> : <ArrowDownRight className="h-3 w-3 mr-0.5" />}
                    {Math.abs(kpi.trend).toFixed(1)}%
                  </div>
                )}
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-medium text-zinc-500 uppercase tracking-wider">{kpi.title}</h3>
                <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">{kpi.value}</p>
                <p className="text-xs text-zinc-400">{kpi.description}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Membership by ERG */}
        <Card className="border-none shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <PieChartIcon className="h-5 w-5 text-zinc-400" />
              <CardTitle>Distribution by Primary ERG</CardTitle>
            </div>
            <CardDescription>Membership breakdown per group</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Array.from(new Set(membershipData.map(m => m["Primary ERG"]))).map(erg => {
                const count = membershipData.filter(m => m["Primary ERG"] === erg).length
                const percentage = (count / membershipData.length) * 100
                return (
                  <div key={erg} className="space-y-1.5">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">{erg}</span>
                      <span className="text-zinc-500">{count} members ({percentage.toFixed(1)}%)</span>
                    </div>
                    <div className="w-full bg-zinc-100 rounded-full h-2 dark:bg-zinc-800">
                      <div className="bg-[#0046ab] h-2 rounded-full" style={{ width: `${percentage}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Recent Events */}
        <Card className="border-none shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Award className="h-5 w-5 text-zinc-400" />
              <CardTitle>Event Effectiveness</CardTitle>
            </div>
            <CardDescription>Performance of recent activities</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {eventLogs.slice(-5).reverse().map(event => {
                const eventFeedback = feedback.filter(f => String(f["Event ID"]) === String(event["Event ID"]))
                const avgRating = eventFeedback.length > 0 
                  ? eventFeedback.reduce((acc, curr) => acc + (Number(curr.Rating) || 0), 0) / eventFeedback.length 
                  : 0
                
                const eventParticipation = participation.filter(p => String(p["Event ID"]) === String(event["Event ID"]))
                const attended = eventParticipation.filter(p => p.Status === "Attended").length
                const total = eventParticipation.length
                const rate = total > 0 ? (attended / total) * 100 : 0

                return (
                  <div key={event["Event ID"]} className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-lg bg-zinc-100 flex items-center justify-center shrink-0 dark:bg-zinc-800">
                      <Calendar className="h-5 w-5 text-zinc-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{event["Event Name"]}</p>
                      <p className="text-xs text-zinc-500">{event.ERG} • {event.Date}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="flex items-center gap-1 justify-end">
                        <Heart className="h-3 w-3 text-red-500 fill-red-500" />
                        <span className="text-xs font-bold">{avgRating.toFixed(1)}</span>
                      </div>
                      <p className="text-[10px] text-zinc-400 uppercase font-bold">{rate.toFixed(0)}% Attended</p>
                    </div>
                  </div>
                )
              })}
              {eventLogs.length === 0 && (
                <p className="text-center py-10 text-zinc-500 text-sm italic">No event data recorded.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function Button({ children, className, onClick, variant }: any) {
  const base = "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
  const variants: any = {
    default: "bg-[#0046ab] text-white shadow hover:bg-[#003a8f]",
    outline: "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground"
  }
  return (
    <button className={`${base} ${variants[variant || 'default']} ${className}`} onClick={onClick}>
      {children}
    </button>
  )
}
