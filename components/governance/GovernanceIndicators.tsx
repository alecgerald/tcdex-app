"use client"

import { useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts"
import { ProcessedProgramRow, LIFECYCLE_PHASES, lifecycleScore } from "./types"

interface Props {
  data: ProcessedProgramRow[]
  onProgramClick: (p: ProcessedProgramRow) => void
}

type SortKey = "name" | "score"
const tooltipStyle = { borderRadius: "8px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }

function statusCell(status: string) {
  const map: Record<string, string> = {
    COMPLETED:   "bg-emerald-500",
    IN_PROGRESS: "bg-amber-400",
    NOT_STARTED: "bg-red-400",
    N_A:         "bg-zinc-200",
  }
  return map[status] || "bg-zinc-200"
}

function EvalGauge({ rate }: { rate: number }) {
  const clamped = Math.min(Math.max(rate, 0), 100)
  const radius = 60
  const stroke = 14
  const norm = radius - stroke / 2
  const circumference = Math.PI * norm
  const dashOffset = circumference * (1 - clamped / 100)
  const color = clamped >= 90 ? "#22c55e" : clamped >= 60 ? "#f59e0b" : "#ef4444"

  return (
    <div className="flex flex-col items-center justify-center h-52">
      <svg width={180} height={100} viewBox="0 0 180 100">
        {/* Background arc */}
        <path
          d={`M ${stroke / 2} 90 A ${norm} ${norm} 0 0 1 ${180 - stroke / 2} 90`}
          fill="none" stroke="#e5e7eb" strokeWidth={stroke} strokeLinecap="round"
        />
        {/* Progress arc */}
        <path
          d={`M ${stroke / 2} 90 A ${norm} ${norm} 0 0 1 ${180 - stroke / 2} 90`}
          fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={dashOffset}
          style={{ transition: "stroke-dashoffset 0.8s ease" }}
        />
        {/* Target needle at 90% */}
        <line x1="152" y1="28" x2="157" y2="22" stroke="#0046ab" strokeWidth="2" strokeLinecap="round" />
        <circle cx="155" cy="25" r="3" fill="#0046ab" />
      </svg>
      <div className="-mt-6 text-center">
        <p className="text-3xl font-bold" style={{ color }}>{clamped.toFixed(0)}%</p>
        <p className="text-xs text-zinc-500 uppercase font-semibold tracking-wider mt-1">Evaluation Coverage</p>
        <p className="text-[11px] text-zinc-400 mt-0.5">Target: 90%</p>
      </div>
    </div>
  )
}

export default function GovernanceIndicators({ data, onProgramClick }: Props) {
  const [heatmapSort, setHeatmapSort] = useState<SortKey>("score")

  const completed = data.filter(d => d.deliveryStatus?.toUpperCase() === "COMPLETED")
  const withFeedback = completed.filter(d => d.feedbackStatus?.toUpperCase() !== "MISSING")
  const evalRate = completed.length ? (withFeedback.length / completed.length) * 100 : 0

  // Feedback score histogram (bins 0.5-wide, 1–5)
  const histogram = useMemo(() => {
    const bins = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5]
    return bins.map(bin => ({
      label: bin.toFixed(1),
      count: data.filter(d =>
        d.avgFeedbackScore !== null &&
        d.avgFeedbackScore >= bin &&
        d.avgFeedbackScore < bin + 0.5
      ).length,
    }))
  }, [data])

  const avgScore = useMemo(() => {
    const rated = data.filter(d => d.avgFeedbackScore !== null)
    return rated.length
      ? rated.reduce((s, d) => s + d.avgFeedbackScore!, 0) / rated.length
      : null
  }, [data])

  // Report submission stacked bar per quarter
  const reportByQuarter = useMemo(() => {
    const qMap: Record<string, { name: string; Done: number; "In Progress": number; "Not Started": number; "Not Due": number }> = {}
    data.forEach(d => {
      const q = d.quarter || "No Qtr"
      if (!qMap[q]) qMap[q] = { name: q, Done: 0, "In Progress": 0, "Not Started": 0, "Not Due": 0 }
      const s = d.overallReportStatus?.toUpperCase()
      if (s === "DONE")                          qMap[q].Done++
      else if (s?.includes("PROGRESS") || s === "OPEN") qMap[q]["In Progress"]++
      else if (d.deliveryStatus?.toUpperCase() !== "COMPLETED") qMap[q]["Not Due"]++
      else                                       qMap[q]["Not Started"]++
    })
    return Object.values(qMap).sort((a, b) => a.name.localeCompare(b.name))
  }, [data])

  // Heatmap rows
  const heatmapRows = useMemo(() => {
    const sorted = [...data].sort((a, b) =>
      heatmapSort === "score"
        ? lifecycleScore(b) - lifecycleScore(a)
        : a.programTitle.localeCompare(b.programTitle)
    )
    return sorted.slice(0, 20)
  }, [data, heatmapSort])

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-zinc-800 dark:text-zinc-200 border-b pb-2">Governance &amp; Evaluation Indicators</h2>

      {/* Top row: Gauge + Report status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border shadow-sm">
          <CardHeader className="pb-0">
            <CardTitle className="text-xs text-zinc-500 uppercase tracking-wider">Evaluation Coverage Gauge</CardTitle>
          </CardHeader>
          <CardContent>
            <EvalGauge rate={evalRate} />
            <div className="flex items-center justify-center gap-6 text-xs text-zinc-500 mt-2">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[#0046ab] inline-block"/>{withFeedback.length} Evaluated</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-zinc-200 inline-block"/>{completed.length - withFeedback.length} Missing</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-zinc-500 uppercase tracking-wider">Report Submission Status by Quarter</CardTitle>
          </CardHeader>
          <CardContent className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={reportByQuarter} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: "11px" }} />
                <Bar dataKey="Done"          stackId="a" fill="#22c55e" radius={[0,0,4,4]} />
                <Bar dataKey="In Progress"   stackId="a" fill="#f59e0b" />
                <Bar dataKey="Not Started"   stackId="a" fill="#ef4444" />
                <Bar dataKey="Not Due"       stackId="a" fill="#94a3b8" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Feedback Score Distribution */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs text-zinc-500 uppercase tracking-wider">
            Feedback Score Distribution
            {avgScore !== null && <span className="ml-2 font-normal normal-case text-zinc-400">— portfolio avg: {avgScore.toFixed(2)}</span>}
          </CardTitle>
        </CardHeader>
        <CardContent className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={histogram} margin={{ top: 0, right: 20, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} label={{ value: "Score Range", position: "insideBottom", offset: -2, fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => [v, "Programs"]} />
              <Bar dataKey="count" name="Programs" fill="#0046ab" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Lifecycle Phase Heatmap */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-xs text-zinc-500 uppercase tracking-wider">Lifecycle Phase Heatmap</CardTitle>
          <div className="flex gap-2">
            <button
              onClick={() => setHeatmapSort("score")}
              className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-all ${heatmapSort === "score" ? "bg-[#0046ab] text-white border-[#0046ab]" : "text-zinc-500 border-zinc-200"}`}
            >Sort: Score</button>
            <button
              onClick={() => setHeatmapSort("name")}
              className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-all ${heatmapSort === "name" ? "bg-[#0046ab] text-white border-[#0046ab]" : "text-zinc-500 border-zinc-200"}`}
            >Sort: Name</button>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-zinc-50 dark:bg-zinc-800">
                <th className="text-left py-2 px-4 font-semibold text-zinc-600 sticky left-0 bg-zinc-50 dark:bg-zinc-800 min-w-[180px]">Program</th>
                {LIFECYCLE_PHASES.map(p => (
                  <th key={p.key} className="py-2 px-1 font-semibold text-zinc-500 text-center min-w-[80px] whitespace-nowrap">
                    {p.label}
                  </th>
                ))}
                <th className="py-2 px-2 font-semibold text-zinc-600 text-center min-w-[70px]">Score</th>
              </tr>
            </thead>
            <tbody>
              {heatmapRows.map(prog => {
                const score = lifecycleScore(prog)
                return (
                  <tr
                    key={prog.id}
                    onClick={() => onProgramClick(prog)}
                    className="border-t hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer transition-colors"
                  >
                    <td className="py-2 px-4 font-medium text-zinc-800 dark:text-zinc-200 sticky left-0 bg-white dark:bg-zinc-900 max-w-[180px] truncate" title={prog.programTitle}>
                      {prog.programTitle}
                    </td>
                    {LIFECYCLE_PHASES.map(phase => {
                      const val = prog[phase.key as keyof ProcessedProgramRow] as string
                      return (
                        <td key={phase.key} className="py-2 px-1 text-center">
                          <span className={`inline-block w-6 h-6 rounded ${statusCell(val)} opacity-90`} title={val} />
                        </td>
                      )
                    })}
                    <td className="py-2 px-2 text-center font-bold" style={{ color: score >= 75 ? "#22c55e" : score >= 40 ? "#f59e0b" : "#ef4444" }}>
                      {score.toFixed(0)}%
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {data.length === 0 && (
            <p className="text-center text-zinc-400 text-sm py-8">No programs to display.</p>
          )}
          {/* Legend */}
          <div className="flex gap-4 p-4 border-t text-xs text-zinc-500">
            <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded bg-emerald-500 inline-block"/>Done</span>
            <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded bg-amber-400 inline-block"/>In Progress</span>
            <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded bg-red-400 inline-block"/>Not Started</span>
            <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded bg-zinc-200 inline-block"/>N/A</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
