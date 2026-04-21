"use client"

import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts"
import { ProcessedProgramRow } from "./types"

interface Props {
  data: ProcessedProgramRow[]
}

const COLORS = ["#0046ab", "#3b82f6", "#8b5cf6", "#a855f7", "#ec4899", "#f43f5e"]
const STATUS_COLORS: Record<string, string> = {
  COMPLETED:   "#22c55e",
  Completed:   "#22c55e",
  IN_PROGRESS: "#3b82f6",
  Ongoing:     "#3b82f6",
  NOT_STARTED: "#a855f7",
  Planned:     "#a855f7",
  Delayed:     "#f97316",
}
const tooltipStyle = { borderRadius: "8px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }

// Custom Y-axis tick that wraps/truncates long names
const CustomYTick = ({ x, y, payload }: any) => {
  const label: string = payload.value || ""
  // truncate at 18 chars so it fits in the axis width
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

// Custom legend renderer to prevent overflow
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

export default function DistributionCharts({ data }: Props) {
  const byUnit = useMemo(() => {
    const map: Record<string, number> = {}
    data.forEach(d => { const u = d.assignedUnit || "Unassigned"; map[u] = (map[u] || 0) + 1 })
    return Object.entries(map).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count)
  }, [data])

  const byMode = useMemo(() => {
    const map: Record<string, number> = {}
    data.forEach(d => { const m = d.deliveryMode || "Unspecified"; map[m] = (map[m] || 0) + 1 })
    return Object.entries(map).map(([name, value]) => ({ name, value }))
  }, [data])

  const byQuarter = useMemo(() => {
    const map: Record<string, { name: string; Completed: number; Ongoing: number; Planned: number }> = {}
    data.forEach(d => {
      const q = d.quarter || "No Qtr"
      if (!map[q]) map[q] = { name: q, Completed: 0, Ongoing: 0, Planned: 0 }
      const s = d.deliveryStatus?.toUpperCase()
      if (s === "COMPLETED") map[q].Completed++
      else if (s === "IN_PROGRESS" || s === "ONGOING") map[q].Ongoing++
      else map[q].Planned++
    })
    return Object.values(map).sort((a, b) => a.name.localeCompare(b.name))
  }, [data])

  const byPriority = useMemo(() => {
    const units = Array.from(new Set(data.map(d => d.assignedUnit || "Unassigned")))
    return units.map(u => {
      const unit = data.filter(d => (d.assignedUnit || "Unassigned") === u)
      return {
        name: u,
        HIGH:   unit.filter(d => d.priorityLevel === "HIGH").length,
        MEDIUM: unit.filter(d => d.priorityLevel === "MEDIUM").length,
        LOW:    unit.filter(d => d.priorityLevel === "LOW").length,
      }
    }).sort((a, b) => (b.HIGH + b.MEDIUM + b.LOW) - (a.HIGH + a.MEDIUM + a.LOW))
  }, [data])

  // Dynamic chart heights based on number of bars (min 200, 32px per bar)
  const unitChartH  = Math.max(200, byUnit.length     * 36 + 20)
  const priorityChartH = Math.max(200, byPriority.length * 36 + 20)

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-zinc-800 dark:text-zinc-200 border-b pb-2">Portfolio Distribution</h2>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Programs by Unit — horizontal bar */}
        <Card className="border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-zinc-500 uppercase tracking-wider">By Assigned Unit</CardTitle>
          </CardHeader>
          <CardContent style={{ height: unitChartH }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byUnit} layout="vertical" margin={{ top: 4, right: 24, left: 4, bottom: 4 }}>
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
                <Bar dataKey="count" name="Programs" radius={[0, 4, 4, 0]} barSize={18}>
                  {byUnit.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Programs by Delivery Mode — donut */}
        <Card className="border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-zinc-500 uppercase tracking-wider">By Delivery Mode</CardTitle>
          </CardHeader>
          <CardContent className="h-64 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={byMode}
                  cx="50%"
                  cy="45%"
                  innerRadius={52}
                  outerRadius={76}
                  paddingAngle={3}
                  dataKey="value"
                  label={({ name, percent = 0 }) =>
                    percent > 0.06 ? `${name} (${Math.round(percent * 100)}%)` : ""
                  }
                  labelLine={false}
                >
                  {byMode.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} formatter={(v, n) => [v, n]} />
                <Legend content={renderLegend} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Programs by Quarter — stacked bar */}
        <Card className="border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-zinc-500 uppercase tracking-wider">By Quarter &amp; Status</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byQuarter} margin={{ top: 4, right: 8, left: -16, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend content={renderLegend} />
                <Bar dataKey="Completed" stackId="a" fill={STATUS_COLORS.COMPLETED} radius={[0,0,4,4]} />
                <Bar dataKey="Ongoing"   stackId="a" fill={STATUS_COLORS.IN_PROGRESS} />
                <Bar dataKey="Planned"   stackId="a" fill={STATUS_COLORS.NOT_STARTED} radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

      </div>

      {/* Priority stacked bar */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs text-zinc-500 uppercase tracking-wider">Workload Composition by Priority &amp; Unit</CardTitle>
        </CardHeader>
        <CardContent style={{ height: priorityChartH }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byPriority} layout="vertical" margin={{ top: 4, right: 24, left: 4, bottom: 4 }}>
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
              <Bar dataKey="HIGH"   stackId="a" fill="#ef4444" name="High"   barSize={18} />
              <Bar dataKey="MEDIUM" stackId="a" fill="#f59e0b" name="Medium" />
              <Bar dataKey="LOW"    stackId="a" fill="#10b981" name="Low"    radius={[0,4,4,0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  )
}
