"use client"

import { Building2, CheckCircle2, Users, Star, AlertTriangle, Banknote } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { ProcessedProgramRow } from "./types"

interface Props {
  data: ProcessedProgramRow[]
  priorYearData?: ProcessedProgramRow[]
}

export default function KpiCards({ data, priorYearData }: Props) {
  const total = data.length
  const completed = data.filter(d => d.deliveryStatus?.toUpperCase() === "COMPLETED").length
  const completionRate = total ? (completed / total) * 100 : 0

  const totalParticipants = data.reduce((a, d) => a + (d.totalParticipants || 0), 0)
  const avgParticipants = total ? totalParticipants / total : 0

  const feedbackPrograms = data.filter(d => d.avgFeedbackScore !== null)
  const avgFeedback = feedbackPrograms.length
    ? feedbackPrograms.reduce((a, d) => a + d.avgFeedbackScore!, 0) / feedbackPrograms.length
    : null

  const missingFeedback = data.filter(
    d => d.feedbackStatus?.toUpperCase() === "MISSING"
  ).length
  const missingRate = completed ? (missingFeedback / completed) * 100 : 0

  const budgeted = data.filter(d => d.approvedBudgetPhp !== null)
  const totalBudget = budgeted.reduce((a, d) => a + (d.approvedBudgetPhp || 0), 0)

  // Delta vs prior year
  const priorTotal = priorYearData?.length ?? null

  const kpis = [
    {
      label: "Total Programs",
      value: total.toString(),
      sub: priorTotal !== null
        ? `${total - priorTotal > 0 ? "+" : ""}${total - priorTotal} vs prior year`
        : "All programs",
      icon: Building2,
      color: "text-[#0046ab]",
      iconBg: "bg-blue-50",
    },
    {
      label: "Completed Programs",
      value: completed.toString(),
      sub: `${completionRate.toFixed(1)}% completion rate`,
      icon: CheckCircle2,
      color: "text-emerald-600",
      iconBg: "bg-emerald-50",
    },
    {
      label: "Total Participants",
      value: totalParticipants.toLocaleString(),
      sub: `Avg ${Math.round(avgParticipants)} per program`,
      icon: Users,
      color: "text-purple-600",
      iconBg: "bg-purple-50",
    },
    {
      label: "Avg Feedback Score",
      value: avgFeedback !== null ? avgFeedback.toFixed(2) : "—",
      sub: `${feedbackPrograms.length} programs evaluated`,
      icon: Star,
      color: "text-amber-500",
      iconBg: "bg-amber-50",
    },
    {
      label: "Missing Evaluation",
      value: missingFeedback.toString(),
      sub: `${missingRate.toFixed(1)}% of completed programs`,
      icon: AlertTriangle,
      color: "text-red-500",
      iconBg: "bg-red-50",
    },
    {
      label: "Total Budget (PHP)",
      value: new Intl.NumberFormat("en-PH", {
        style: "currency",
        currency: "PHP",
        maximumFractionDigits: 0,
      }).format(totalBudget),
      sub: `${budgeted.length} funded programs`,
      icon: Banknote,
      color: "text-zinc-700",
      iconBg: "bg-zinc-100",
    },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
      {kpis.map((kpi, idx) => (
        <Card key={idx} className="border shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider leading-tight">
                {kpi.label}
              </p>
              <div className={`h-7 w-7 rounded-lg ${kpi.iconBg} flex items-center justify-center shrink-0`}>
                <kpi.icon className={`h-3.5 w-3.5 ${kpi.color}`} />
              </div>
            </div>
            <p className={`text-2xl font-bold tracking-tight ${kpi.color}`}>{kpi.value}</p>
            <p className="text-[10px] text-zinc-400 mt-1 font-medium uppercase tracking-wide">{kpi.sub}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
