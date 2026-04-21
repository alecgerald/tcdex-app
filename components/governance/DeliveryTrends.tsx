"use client"

import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ComposedChart, ReferenceLine,
} from "recharts"
import { ProcessedProgramRow } from "./types"

interface Props {
  data: ProcessedProgramRow[]
  onProgramClick: (p: ProcessedProgramRow) => void
}

const tooltipStyle = { borderRadius: "8px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }
const BENCHMARK = 80

// Custom Y-axis tick — truncates long names, shows full on hover
const CustomYTick = ({ x, y, payload }: any) => {
  const label: string = payload.value || ""
  const display = label.length > 18 ? label.slice(0, 16) + "…" : label
  return (
    <g transform={`translate(${x},${y})`}>
      <title>{label}</title>
      <text
        x={0} y={0} dy={4}
        textAnchor="end"
        fill="#52525b"
        fontSize={11}
        fontWeight={600}
      >
        {display}
      </text>
    </g>
  )
}

// Inline custom legend
const renderLegend = (props: any) => {
  const { payload } = props
  return (
    <ul className="flex flex-wrap justify-center gap-x-3 gap-y-1 px-2 pt-1">
      {payload.map((entry: any, i: number) => (
        <li key={i} className="flex items-center gap-1 text-[11px] text-zinc-600">
          <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ background: entry.color }} />
          {entry.value}
        </li>
      ))}
    </ul>
  )
}

export default function DeliveryTrends({ data, onProgramClick }: Props) {
  const reachByUnit = useMemo(() => {
    const map: Record<string, { name: string; Participants: number; Completions: number }> = {}
    data.forEach(d => {
      const u = d.assignedUnit || "Unassigned"
      if (!map[u]) map[u] = { name: u, Participants: 0, Completions: 0 }
      map[u].Participants += d.totalParticipants || 0
      map[u].Completions  += d.totalCompletions  || 0
    })
    return Object.values(map).sort((a, b) => b.Participants - a.Participants)
  }, [data])

  const completionByUnit = useMemo(() => {
    const map: Record<string, { total: number; completed: number }> = {}
    data.forEach(d => {
      const u = d.assignedUnit || "Unassigned"
      if (!map[u]) map[u] = { total: 0, completed: 0 }
      map[u].total++
      if (d.deliveryStatus?.toUpperCase() === "COMPLETED") map[u].completed++
    })
    return Object.entries(map).map(([name, v]) => ({
      name,
      rate: v.total ? Math.round((v.completed / v.total) * 100) : 0,
    })).sort((a, b) => b.rate - a.rate)
  }, [data])

  const funnel = useMemo(() => {
    const registered = data.reduce((a, d) => a + (d.totalParticipants || 0), 0)
    const attended   = data.reduce((a, d) => a + (d.totalParticipants || 0), 0)
    const completed  = data.reduce((a, d) => a + (d.totalCompletions  || 0), 0)
    return [
      { name: "Registered", value: registered },
      { name: "Attended",   value: attended   },
      { name: "Completed",  value: completed  },
    ]
  }, [data])

  // Dynamic heights so all bars are visible
  const reachChartH      = Math.max(200, reachByUnit.length      * 40 + 20)
  const completionChartH = Math.max(200, completionByUnit.length * 40 + 20)

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-zinc-800 dark:text-zinc-200 border-b pb-2">Delivery &amp; Participation Trends</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Participant Reach by Unit */}
        <Card className="border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-zinc-500 uppercase tracking-wider">Participant Reach by Unit</CardTitle>
          </CardHeader>
          <CardContent style={{ height: reachChartH }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={reachByUnit} layout="vertical" margin={{ top: 4, right: 24, left: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                <XAxis type="number" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis
                  dataKey="name"
                  type="category"
                  tick={<CustomYTick />}
                  axisLine={false}
                  tickLine={false}
                  width={130}
                />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend content={renderLegend} />
                <Bar dataKey="Participants" fill="#0046ab" radius={[0,4,4,0]} barSize={14} />
                <Bar dataKey="Completions"  fill="#22c55e" radius={[0,4,4,0]} barSize={14} />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Completion Rate Tracker */}
        <Card className="border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-zinc-500 uppercase tracking-wider">
              Completion Rate Tracker
              <span className="ml-2 text-zinc-400 normal-case font-normal">— red line: {BENCHMARK}% target</span>
            </CardTitle>
          </CardHeader>
          <CardContent style={{ height: completionChartH }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={completionByUnit} layout="vertical" margin={{ top: 4, right: 36, left: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} unit="%" />
                <YAxis
                  dataKey="name"
                  type="category"
                  tick={<CustomYTick />}
                  axisLine={false}
                  tickLine={false}
                  width={130}
                />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => [`${v}%`, "Completion Rate"]} />
                <ReferenceLine x={BENCHMARK} stroke="#ef4444" strokeDasharray="4 2" strokeWidth={2} />
                <Bar dataKey="rate" name="Completion %" fill="#0046ab" radius={[0,4,4,0]} barSize={14} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Session Completion Funnel */}
        <Card className="border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-zinc-500 uppercase tracking-wider">Session-Level Completion Funnel</CardTitle>
          </CardHeader>
          <CardContent className="p-5 space-y-3">
            {funnel.map((stage, i) => {
              const max = funnel[0].value || 1
              const pct = Math.round((stage.value / max) * 100)
              const colors = ["bg-[#0046ab]", "bg-blue-400", "bg-emerald-500"]
              return (
                <div key={stage.name}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-semibold text-zinc-700">{stage.name}</span>
                    <span className="text-zinc-500 font-mono">{stage.value.toLocaleString()} ({pct}%)</span>
                  </div>
                  <div className="w-full h-7 bg-zinc-100 rounded-lg overflow-hidden">
                    <div className={`h-full ${colors[i]} rounded-lg transition-all flex items-center px-3`} style={{ width: `${pct}%` }}>
                      {pct > 15 && <span className="text-white text-xs font-bold">{pct}%</span>}
                    </div>
                  </div>
                </div>
              )
            })}
            <p className="text-[11px] text-zinc-400 pt-1">Drop-off: {funnel[0].value > 0 ? `${Math.round(((funnel[0].value - funnel[2].value) / funnel[0].value) * 100)}%` : "—"} overall</p>
          </CardContent>
        </Card>

        {/* Top programs by participants — drill-down clickable list */}
        <Card className="border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-zinc-500 uppercase tracking-wider">Top Programs by Participants (click to view)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-2 overflow-y-auto h-60">
            {[...data]
              .sort((a, b) => (b.totalParticipants || 0) - (a.totalParticipants || 0))
              .slice(0, 6)
              .map(prog => {
                const max = data.reduce((m, d) => Math.max(m, d.totalParticipants || 0), 1)
                const pct = Math.min(Math.round(((prog.totalParticipants || 0) / max) * 100), 100)
                return (
                  <button
                    key={prog.id}
                    onClick={() => onProgramClick(prog)}
                    className="w-full text-left group"
                  >
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium text-zinc-700 truncate max-w-[200px] group-hover:text-[#0046ab] transition-colors" title={prog.programTitle}>
                        {prog.programTitle}
                      </span>
                      <span className="text-zinc-500 font-mono shrink-0 ml-2">{prog.totalParticipants} pax</span>
                    </div>
                    <div className="w-full h-2 bg-zinc-100 rounded-full overflow-hidden">
                      <div className="h-full bg-[#0046ab] rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </button>
                )
              })}
          </CardContent>
        </Card>

      </div>
    </div>
  )
}
