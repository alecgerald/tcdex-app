"use client"

import { useState, useEffect, useMemo } from "react"
import * as XLSX from "xlsx"
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend,
  CartesianGrid, ResponsiveContainer, LineChart, Line,
  Cell,
} from "recharts"
import { createClient } from "@/utils/supabase/client"

const supabase = createClient()

// ─── Types ────────────────────────────────────────────────
interface MetricData {
  metric: string; value: number; unit?: string; accent: string; sub?: string
}
interface EiRawRow {
  "survey period"?: string; "function"?: string; "role level"?: string
  "location"?: string; "tenure band"?: string; "q7 improvement comment"?: string
  [key: string]: string | number | undefined
}
interface VtrRawRow {
  "reporting period"?: string; "delivery unit"?: string
  "job family"?: string; "tenure band"?: string
  [key: string]: string | number | undefined
}
interface ErrRawRow {
  "reporting period"?: string; "delivery unit"?: string
  [key: string]: string | number | undefined
}
interface ItsRawRow {
  "survey period"?: string; "function"?: string; "role level"?: string
  "location"?: string; "tenure band"?: string; "response date"?: string
  [key: string]: string | number | undefined
}
interface NerRawRow {
  "reporting period"?: string; "delivery unit"?: string; "location"?: string
  [key: string]: string | number | undefined
}

// ─── Filter affect maps ───────────────────────────────────
const EI_FILTER_AFFECTS: Record<string, string[]> = {
  "Survey Period": ["Fig 1", "Fig 2", "Fig 3", "Fig 4"],
  "Function":      ["Fig 3", "Fig 4"],
  "Role Level":    ["Fig 3", "Fig 4"],
  "Location":      ["Fig 3", "Fig 4"],
  "Tenure Band":   ["Fig 3", "Fig 4"],
}
const VTR_FILTER_AFFECTS: Record<string, string[]> = {
  "Reporting Period": ["Fig 1"],
  "Delivery Unit":    ["Fig 2", "Fig 3"],
  "Job Family":       ["Fig 2", "Fig 3"],
  "Tenure Band":      ["Fig 2", "Fig 3"],
}
const ERR_FILTER_AFFECTS: Record<string, string[]> = {
  "Reporting Period": ["Fig 1"],
  "Delivery Unit":    ["Fig 2", "Fig 3"],
}
const ITS_FILTER_AFFECTS: Record<string, string[]> = {
  "Survey Period": ["Fig 1", "Fig 3"],
  "Function":      ["Fig 1", "Fig 2", "Fig 3"],
  "Role Level":    ["Fig 1", "Fig 2", "Fig 3"],
  "Location":      ["Fig 1", "Fig 2", "Fig 3"],
  "Tenure Band":   ["Fig 2", "Fig 3"],
}
const NER_FILTER_AFFECTS: Record<string, string[]> = {
  "Reporting Period": ["Fig 1"],
  "Delivery Unit":    ["Fig 2", "Fig 3"],
  "Location":         ["Fig 2", "Fig 3"],
}

// ─── Helpers ──────────────────────────────────────────────
const LIKERT: Record<string, number> = {
  "strongly agree": 5, "agree": 4, "neutral": 3, "disagree": 2, "strongly disagree": 1,
}
const toLikert = (v: string | number | undefined): number | null => {
  if (typeof v === "number") return v
  return LIKERT[(v as string || "").trim().toLowerCase()] ?? null
}
const isAgree = (v: string | number | undefined): boolean =>
  ["strongly agree", "agree"].includes((v as string || "").trim().toLowerCase())
const toNum = (v?: number | string): number => Number(v || 0)
const uniq  = (arr: (string | undefined)[]): string[] =>
  [...new Set(arr.filter((v): v is string => !!v))].sort()
const avgArr = (nums: number[]): number =>
  nums.length ? Number((nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1)) : 0
const pct = (num: number, den: number): number =>
  den ? Number(((num / den) * 100).toFixed(1)) : 0

function exportCSV(data: object[], filename: string) {
  const ws   = XLSX.utils.json_to_sheet(data)
  const blob = new Blob([XLSX.utils.sheet_to_csv(ws)], { type: "text/csv" })
  const a    = document.createElement("a")
  a.href = URL.createObjectURL(blob); a.download = filename + ".csv"; a.click()
}
function exportXLSX(data: object[], filename: string) {
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), "Sheet1")
  XLSX.writeFile(wb, filename + ".xlsx")
}

// ─── UI Primitives ────────────────────────────────────────
function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: "#fff", borderRadius: 16, boxShadow: "0 1px 4px rgba(0,0,0,.06), 0 4px 20px rgba(0,0,0,.07)", padding: "24px 26px", ...style }}>
      {children}
    </div>
  )
}
function EmptyState({ label }: { label: string }) {
  return (
    <div style={{ textAlign: "center", padding: "56px 24px", color: "#cbd5e1", fontSize: 13 }}>
      <div style={{ fontSize: 40, marginBottom: 10 }}>📭</div>
      No <strong>{label}</strong> data uploaded yet.<br />
      Go to the Engagement &amp; Retention dashboard and upload a file first.
    </div>
  )
}
function EmptyChart({ msg }: { msg: string }) {
  return (
    <div style={{ height: 150, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#cbd5e1", fontSize: 13, background: "#fafafa", borderRadius: 10, border: "1px dashed #e2e8f0" }}>
      <div style={{ fontSize: 26, marginBottom: 6 }}>📊</div>{msg}
    </div>
  )
}
function StatPill({ label, value, accent, sub }: { label: string; value: string | number; accent: string; sub?: string }) {
  return (
    <div style={{ background: accent + "0d", border: `1px solid ${accent}20`, borderRadius: 12, padding: "14px 16px" }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 5 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: accent, lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>{sub}</div>}
    </div>
  )
}
function CT({ active, payload, label, unit }: { active?: boolean; payload?: { color: string; name: string; value: number | string }[]; label?: string; unit?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: "10px 14px", fontSize: 12, boxShadow: "0 4px 20px rgba(0,0,0,.10)" }}>
      <div style={{ fontWeight: 700, color: "#0f172a", marginBottom: 4 }}>{label}</div>
      {payload.map((p, i) => <div key={i} style={{ color: p.color }}>{p.name}: <strong>{typeof p.value === "number" ? p.value.toFixed(1) : p.value}{unit ?? ""}</strong></div>)}
    </div>
  )
}
function FigCard({ fig, title, subtitle, children }: { fig: string; title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <Card>
      <div style={{ marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <span style={{ fontSize: 10, fontWeight: 800, background: "#f1f5f9", color: "#64748b", borderRadius: 6, padding: "3px 8px", letterSpacing: ".05em", textTransform: "uppercase" }}>{fig}</span>
          <span style={{ fontSize: 15, fontWeight: 800, color: "#0f172a", letterSpacing: "-.02em" }}>{title}</span>
        </div>
        <div style={{ fontSize: 12, color: "#94a3b8" }}>{subtitle}</div>
      </div>
      {children}
    </Card>
  )
}
function TwoDropFilter({ filterKeys, affectsMap, years, filterType, filterValue, selectedYear, onFilterType, onFilterValue, onYear, onClear, accent, valueOptions }: {
  filterKeys: string[]; affectsMap: Record<string, string[]>; years: string[]
  filterType: string; filterValue: string; selectedYear: string
  onFilterType: (v: string) => void; onFilterValue: (v: string) => void
  onYear: (v: string) => void; onClear: () => void
  accent: string; valueOptions: string[]
}) {
  const affects   = filterType ? affectsMap[filterType] ?? [] : []
  const hasActive = !!(filterType || selectedYear)
  const CHEVRON   = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2.5'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`
  const sel = (active: boolean): React.CSSProperties => ({
    padding: "9px 36px 9px 14px", borderRadius: 10, fontSize: 13, fontWeight: 600,
    border: active ? `1.5px solid ${accent}` : "1.5px solid #e2e8f0",
    backgroundColor: active ? accent + "08" : "#fff", backgroundImage: CHEVRON,
    backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center", backgroundSize: "12px 12px",
    color: active ? accent : "#64748b", cursor: "pointer", outline: "none",
    minWidth: 200, boxShadow: active ? `0 0 0 3px ${accent}15` : "none",
    transition: "border .15s, box-shadow .15s, color .15s",
    appearance: "none" as const, WebkitAppearance: "none" as const,
  })
  return (
    <Card style={{ padding: "20px 24px" }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <label style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".06em" }}>Filter By</label>
          <select value={filterType} onChange={e => { onFilterType(e.target.value); onFilterValue("") }} style={sel(!!filterType)}>
            <option value="">— Select filter —</option>
            {filterKeys.map(k => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>
        {years.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <label style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".06em" }}>Year</label>
            <select value={selectedYear} onChange={e => onYear(e.target.value)} style={sel(!!selectedYear)}>
              <option value="">All Years</option>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        )}
        {filterType && valueOptions.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <label style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".06em" }}>{filterType}</label>
            <select value={filterValue} onChange={e => onFilterValue(e.target.value)} style={sel(!!filterValue)}>
              <option value="">All</option>
              {valueOptions.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 2 }}>
          {filterType && affects.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 11, color: "#94a3b8" }}>Shows:</span>
              {affects.map(fig => (
                <span key={fig} style={{ fontSize: 11, fontWeight: 700, background: accent + "15", color: accent, border: `1px solid ${accent}30`, borderRadius: 6, padding: "3px 10px" }}>{fig}</span>
              ))}
            </div>
          )}
          {hasActive && (
            <button onClick={onClear} style={{ padding: "8px 14px", borderRadius: 8, fontSize: 11, fontWeight: 700, border: "1px solid #e2e8f0", background: "#f8fafc", color: "#94a3b8", cursor: "pointer" }}>✕ Clear</button>
          )}
        </div>
      </div>
      {(filterType || selectedYear) && (
        <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid #f1f5f9", fontSize: 12, color: "#64748b", display: "flex", gap: 6, flexWrap: "wrap" }}>
          {selectedYear && <span style={{ background: "#f1f5f9", borderRadius: 6, padding: "2px 8px" }}>Year: <strong>{selectedYear}</strong></span>}
          {filterType && <span style={{ background: "#f1f5f9", borderRadius: 6, padding: "2px 8px" }}>{filterType}: <strong>{filterValue || "All"}</strong></span>}
        </div>
      )}
    </Card>
  )
}
function ExportBar({ onCSV, onXLSX }: { onCSV: () => void; onXLSX: () => void }) {
  return (
    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
      {[{ label: "↓ CSV", fn: onCSV }, { label: "↓ XLSX", fn: onXLSX }, { label: "↓ PDF", fn: () => window.print() }].map(b => (
        <button key={b.label} onClick={b.fn} style={{ padding: "6px 14px", borderRadius: 8, fontSize: 11, fontWeight: 600, border: "1px solid #e2e8f0", background: "#fff", color: "#475569", cursor: "pointer" }}>{b.label}</button>
      ))}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
//  MAIN
// ═══════════════════════════════════════════════════════════
export default function EngRetReportsPage() {
  const [activeTab,       setActiveTab]       = useState<"ei" | "vtr" | "err" | "its" | "ner">("ei")
  const [summaryMetrics,  setSummaryMetrics]  = useState<MetricData[]>([])
  const [rehydrating,     setRehydrating]     = useState(true)

  // ── Raw rows (sourced entirely from Supabase) ─────────────
  const [eiRows,  setEiRows]  = useState<EiRawRow[]>([])
  const [vtrRows, setVtrRows] = useState<VtrRawRow[]>([])
  const [errRows, setErrRows] = useState<ErrRawRow[]>([])
  const [itsRows, setItsRows] = useState<ItsRawRow[]>([])
  const [nerRows, setNerRows] = useState<NerRawRow[]>([])

  // ── Filter states ─────────────────────────────────────────
  const [eiFilterType,  setEiFilterType]  = useState("")
  const [eiFilterValue, setEiFilterValue] = useState("")
  const [eiYear,        setEiYear]        = useState("")
  const [vtrFilterType,  setVtrFilterType]  = useState("")
  const [vtrFilterValue, setVtrFilterValue] = useState("")
  const [vtrYear,        setVtrYear]        = useState("")
  const [errFilterType,  setErrFilterType]  = useState("")
  const [errFilterValue, setErrFilterValue] = useState("")
  const [errYear,        setErrYear]        = useState("")
  const [itsFilterType,  setItsFilterType]  = useState("")
  const [itsFilterValue, setItsFilterValue] = useState("")
  const [itsYear,        setItsYear]        = useState("")
  const [nerFilterType,  setNerFilterType]  = useState("")
  const [nerFilterValue, setNerFilterValue] = useState("")
  const [nerYear,        setNerYear]        = useState("")

  // ── Step 1: Parallel rehydration from Supabase on mount ──
  useEffect(() => {
    const rehydrate = async () => {
      setRehydrating(true)
      try {
        await Promise.all([
          rehydrateEi(),
          rehydrateVtr(),
          rehydrateErr(),
          rehydrateIts(),
          rehydrateNer(),
        ])
      } finally {
        setRehydrating(false)
      }
    }
    rehydrate()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Rehydration helpers ───────────────────────────────────

  const rehydrateEi = async () => {
    const { data } = await supabase
      .from("engagement_survey_responses")
      .select("survey_period, function, role_level, location, tenure_band, q1_purpose, q2_enablement, q3_commitment, q4_growth, q5_belonging, q6_enps, q7_improvement_comment")

    if (!data || !data.length) return

    // Remap to flat key shape charts expect
    const mapped: EiRawRow[] = data.map(r => ({
      "survey period":          r.survey_period           ?? "",
      "function":               r.function                ?? "",
      "role level":             r.role_level              ?? "",
      "location":               r.location                ?? "",
      "tenure band":            r.tenure_band             ?? "",
      "q1 purpose":             r.q1_purpose              ?? "",
      "q2 enablement":          r.q2_enablement           ?? "",
      "q3 commitment":          r.q3_commitment           ?? "",
      "q4 growth":              r.q4_growth               ?? "",
      "q5 belonging":           r.q5_belonging            ?? "",
      "q6 enps (0-10)":         r.q6_enps                 ?? "",
      "q7 improvement comment": r.q7_improvement_comment  ?? "",
    }))
    setEiRows(mapped)

    // Build summary pill
    const engKeys = ["q1 purpose", "q2 enablement", "q3 commitment", "q4 growth", "q5 belonging"]
    let total = 0, count = 0
    mapped.forEach(r => engKeys.forEach(k => {
      const s = toLikert(r[k]); if (s !== null) { total += s; count++ }
    }))
    const avgLikert       = count ? total / count : 0
    const engagementIndex = count ? Number(((avgLikert - 1) / 4 * 100).toFixed(1)) : 0
    let p = 0, pa = 0, d = 0
    mapped.forEach(r => {
      const s = Number(r["q6 enps (0-10)"] ?? NaN)
      if (!isNaN(s)) { if (s >= 9) p++; else if (s >= 7) pa++; else d++ }
    })
    const eNpsTotal = p + pa + d
    const eNPS      = eNpsTotal ? Number(((p - d) / eNpsTotal * 100).toFixed(1)) : null

    setSummaryMetrics(prev => {
      const filtered = prev.filter(m => m.metric !== "Engagement Index")
      return [...filtered, { metric: "Engagement Index", value: engagementIndex, unit: "%", accent: "#6366f1", sub: `eNPS: ${eNPS ?? "—"} · ${data.length} responses` }]
    })
  }

  const rehydrateVtr = async () => {
    const { data } = await supabase
      .from("voluntary_turnover")
      .select("reporting_period, delivery_unit, job_family, tenure_band, avg_headcount, voluntary_separations")

    if (!data || !data.length) return

    const mapped: VtrRawRow[] = data.map(r => ({
      "reporting period":             r.reporting_period      ?? "",
      "delivery unit":                r.delivery_unit         ?? "",
      "job family":                   r.job_family            ?? "",
      "tenure band":                  r.tenure_band           ?? "",
      "average headcount during the same period": r.avg_headcount          ?? 0,
      "number of voluntary separations during the period": r.voluntary_separations ?? 0,
    }))
    setVtrRows(mapped)

    const sep  = data.reduce((s, r) => s + (r.voluntary_separations ?? 0), 0)
    const hc   = data.reduce((s, r) => s + (r.avg_headcount          ?? 0), 0)
    const rate = hc ? Number(((sep / hc) * 100).toFixed(2)) : 0

    setSummaryMetrics(prev => {
      const filtered = prev.filter(m => m.metric !== "Voluntary Turnover Rate")
      return [...filtered, { metric: "Voluntary Turnover Rate", value: rate, unit: "%", accent: "#ef4444", sub: `${sep} separations` }]
    })
  }

  const rehydrateErr = async () => {
    const { data } = await supabase
      .from("employee_retention")
      .select("reporting_period, delivery_unit, employees_start, employees_end, new_hires")

    if (!data || !data.length) return

    const mapped: ErrRawRow[] = data.map(r => ({
      "reporting period":         r.reporting_period  ?? "",
      "delivery unit":            r.delivery_unit     ?? "",
      "employees at start of period": r.employees_start   ?? 0,
      "employees at end of period":   r.employees_end     ?? 0,
      "new hires during period":      r.new_hires         ?? 0,
    }))
    setErrRows(mapped)

    const start    = data.reduce((s, r) => s + (r.employees_start ?? 0), 0)
    const end      = data.reduce((s, r) => s + (r.employees_end   ?? 0), 0)
    const newHires = data.reduce((s, r) => s + (r.new_hires       ?? 0), 0)
    const retained = end - newHires
    const rate     = start ? Number(((retained / start) * 100).toFixed(2)) : 0

    setSummaryMetrics(prev => {
      const filtered = prev.filter(m => m.metric !== "Employee Retention Rate")
      return [...filtered, { metric: "Employee Retention Rate", value: rate, unit: "%", accent: "#10b981", sub: `${retained} of ${start} retained` }]
    })
  }

  const rehydrateIts = async () => {
    const { data } = await supabase
      .from("intent_to_stay_responses")
      .select("survey_period, function, role_level, location, tenure_band, q1_intent_to_stay, response_date")

    if (!data || !data.length) return

    const mapped: ItsRawRow[] = data.map(r => ({
      "survey period":    r.survey_period      ?? "",
      "function":         r.function           ?? "",
      "role level":       r.role_level         ?? "",
      "location":         r.location           ?? "",
      "tenure band":      r.tenure_band        ?? "",
      "q1 intent to stay": r.q1_intent_to_stay ?? "",
      "response date":    r.response_date      ?? "",
    }))
    setItsRows(mapped)

    const favorable = data.filter(r => isAgree(r.q1_intent_to_stay ?? "")).length
    const rate      = data.length ? Number(((favorable / data.length) * 100).toFixed(1)) : 0

    setSummaryMetrics(prev => {
      const filtered = prev.filter(m => m.metric !== "Intent to Stay")
      return [...filtered, { metric: "Intent to Stay", value: rate, unit: "%", accent: "#8b5cf6", sub: `${data.length} responses` }]
    })
  }

  const rehydrateNer = async () => {
    const { data } = await supabase
      .from("employee_referrals")
      .select("reporting_period, delivery_unit, location, referral_count, employees_referred, total_employees")

    if (!data || !data.length) return

    const mapped: NerRawRow[] = data.map(r => ({
      "reporting period":   r.reporting_period  ?? "",
      "delivery unit":      r.delivery_unit     ?? "",
      "location":           r.location          ?? "",
      "number of employee referrals":                        r.referral_count     ?? 0,
      "employees who made at least one referral":            r.employees_referred ?? 0,
      "total active employees":                              r.total_employees    ?? 0,
    }))
    setNerRows(mapped)

    const totalReferrals = data.reduce((s, r) => s + (r.referral_count     ?? 0), 0)
    const participants   = data.reduce((s, r) => s + (r.employees_referred ?? 0), 0)
    const active         = data.reduce((s, r) => s + (r.total_employees    ?? 0), 0)
    const referralRate   = active ? Number(((participants / active) * 100).toFixed(2)) : null

    setSummaryMetrics(prev => {
      const filtered = prev.filter(m => m.metric !== "Employee Referrals")
      return [...filtered, { metric: "Employee Referrals", value: totalReferrals, unit: "", accent: "#f59e0b", sub: `Referral rate: ${referralRate ?? "—"}%` }]
    })
  }

  // ── Loaded flags ──────────────────────────────────────────
  const eiLoaded  = summaryMetrics.some(m => m.metric === "Engagement Index")
  const vtrLoaded = summaryMetrics.some(m => m.metric === "Voluntary Turnover Rate")
  const errLoaded = summaryMetrics.some(m => m.metric === "Employee Retention Rate")
  const itsLoaded = summaryMetrics.some(m => m.metric === "Intent to Stay")
  const nerLoaded = summaryMetrics.some(m => m.metric === "Employee Referrals")

  // ── Resolve column keys ───────────────────────────────────
  const eiKeys         = useMemo(() => eiRows.length  ? Object.keys(eiRows[0])  : [], [eiRows])
  const engQKeys       = ["q1 purpose", "q2 enablement", "q3 commitment", "q4 growth", "q5 belonging"]
  const resolvedEngKeys = useMemo(() => engQKeys.map(q => eiKeys.find(k => k.startsWith(q.substring(0, 6))) ?? q), [eiKeys])
  const eNpsKey        = useMemo(() => eiKeys.find(k => k.includes("enps") || (k.includes("q6") && k.includes("0-10"))) ?? "q6 enps (0-10)", [eiKeys])

  const vtrKeys   = useMemo(() => vtrRows.length ? Object.keys(vtrRows[0]) : [], [vtrRows])
  const vtrHcKey  = useMemo(() => vtrKeys.find(k => k.includes("average headcount"))     ?? "", [vtrKeys])
  const vtrSepKey = useMemo(() => vtrKeys.find(k => k.includes("voluntary separations")) ?? "", [vtrKeys])

  const errKeys        = useMemo(() => errRows.length ? Object.keys(errRows[0]) : [], [errRows])
  const errStartKey    = useMemo(() => errKeys.find(k => k.includes("employees at start")) ?? "", [errKeys])
  const errEndKey      = useMemo(() => errKeys.find(k => k.includes("employees at end"))   ?? "", [errKeys])
  const errNewHiresKey = useMemo(() => errKeys.find(k => k.includes("new hires during"))   ?? "", [errKeys])

  const itsKeys  = useMemo(() => itsRows.length ? Object.keys(itsRows[0]) : [], [itsRows])
  const itsQ1Key = useMemo(() => itsKeys.find(k => k.includes("intent to stay") || (k.startsWith("q1") && k.includes("intent"))) ?? "q1 intent to stay", [itsKeys])

  const nerKeys         = useMemo(() => nerRows.length ? Object.keys(nerRows[0]) : [], [nerRows])
  const nerReferralsKey = useMemo(() => nerKeys.find(k => k.includes("number of employee referrals"))             ?? "", [nerKeys])
  const nerParticipKey  = useMemo(() => nerKeys.find(k => k.includes("employees who made at least one referral")) ?? "", [nerKeys])
  const nerActiveKey    = useMemo(() => nerKeys.find(k => k.includes("total active employees"))                   ?? "", [nerKeys])

  // ══════════════════════════════════════════════════════════
  //  EI DERIVED
  // ══════════════════════════════════════════════════════════
  const eiYears        = useMemo(() => uniq(eiRows.map(r => (r["survey period"] as string | undefined)?.slice(0, 4))), [eiRows])
  const eiValueOptions = useMemo((): string[] => {
    switch (eiFilterType) {
      case "Survey Period": return uniq(eiRows.map(r => r["survey period"] as string | undefined))
      case "Function":      return uniq(eiRows.map(r => r["function"]     as string | undefined))
      case "Role Level":    return uniq(eiRows.map(r => r["role level"]   as string | undefined))
      case "Location":      return uniq(eiRows.map(r => r["location"]     as string | undefined))
      case "Tenure Band":   return uniq(eiRows.map(r => r["tenure band"]  as string | undefined))
      default: return []
    }
  }, [eiFilterType, eiRows])
  const eiVisibleFigs  = useMemo(() => eiFilterType ? EI_FILTER_AFFECTS[eiFilterType] ?? [] : ["Fig 1", "Fig 2", "Fig 3", "Fig 4"], [eiFilterType])
  const eiYearFiltered = useMemo(() => eiYear ? eiRows.filter(r => (r["survey period"] as string | undefined)?.startsWith(eiYear)) : eiRows, [eiRows, eiYear])
  const eiFiltered     = useMemo(() => {
    if (!eiFilterType || !eiFilterValue) return eiYearFiltered
    return eiYearFiltered.filter(r => {
      switch (eiFilterType) {
        case "Survey Period": return r["survey period"] === eiFilterValue
        case "Function":      return r["function"]      === eiFilterValue
        case "Role Level":    return r["role level"]    === eiFilterValue
        case "Location":      return r["location"]      === eiFilterValue
        case "Tenure Band":   return r["tenure band"]   === eiFilterValue
        default: return true
      }
    })
  }, [eiYearFiltered, eiFilterType, eiFilterValue])

  const DRIVER_LABELS = ["Purpose", "Enablement", "Commitment", "Growth", "Belonging"]

  const eiFig1 = useMemo(() => {
    const map: Record<string, number[]> = {}
    eiFiltered.forEach(r => {
      const period = (r["survey period"] as string | undefined) ?? "Unknown"
      resolvedEngKeys.forEach(k => { const s = toLikert(r[k]); if (s !== null) { if (!map[period]) map[period] = []; map[period].push(s) } })
    })
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([period, scores]) => ({ period, index: Number(((avgArr(scores) - 1) / 4 * 100).toFixed(1)) }))
  }, [eiFiltered, resolvedEngKeys])

  const eiFig2 = useMemo(() => {
    const map: Record<string, { p: number; d: number; total: number }> = {}
    eiFiltered.forEach(r => {
      const period = (r["survey period"] as string | undefined) ?? "Unknown"
      const score  = Number(r[eNpsKey] ?? NaN)
      if (!isNaN(score)) {
        if (!map[period]) map[period] = { p: 0, d: 0, total: 0 }
        map[period].total++
        if (score >= 9) map[period].p++; else if (score <= 6) map[period].d++
      }
    })
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([period, d]) => ({ period, eNPS: d.total ? Number(((d.p - d.d) / d.total * 100).toFixed(1)) : 0 }))
  }, [eiFiltered, eNpsKey])

  const eiFig3 = useMemo(() =>
    resolvedEngKeys.map((k, i) => {
      const scores = eiFiltered.map(r => toLikert(r[k])).filter((v): v is number => v !== null)
      const avg    = avgArr(scores)
      return { driver: DRIVER_LABELS[i] ?? k, avg, favorability: avg > 0 ? Number(((avg - 1) / 4 * 100).toFixed(1)) : 0 }
    })
  , [eiFiltered, resolvedEngKeys])

  const eiFig4 = useMemo(() => {
    const map: Record<string, { Promoters: number; Passives: number; Detractors: number }> = {}
    eiFiltered.forEach(r => {
      const period = (r["survey period"] as string | undefined) ?? "Unknown"
      const score  = Number(r[eNpsKey] ?? NaN)
      if (!isNaN(score)) {
        if (!map[period]) map[period] = { Promoters: 0, Passives: 0, Detractors: 0 }
        if (score >= 9) map[period].Promoters++; else if (score >= 7) map[period].Passives++; else map[period].Detractors++
      }
    })
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([period, d]) => ({ period, ...d }))
  }, [eiFiltered, eNpsKey])

  const eiHeadline = useMemo(() => {
    let totalScore = 0, totalItems = 0
    eiFiltered.forEach(r => { resolvedEngKeys.forEach(k => { const s = toLikert(r[k]); if (s !== null) { totalScore += s; totalItems++ } }) })
    const avg = totalItems ? totalScore / totalItems : 0
    let p = 0, pa = 0, d = 0
    eiFiltered.forEach(r => { const s = Number(r[eNpsKey] ?? NaN); if (!isNaN(s)) { if (s >= 9) p++; else if (s >= 7) pa++; else d++ } })
    const eNpsTotal = p + pa + d
    return { index: totalItems ? Number(((avg - 1) / 4 * 100).toFixed(1)) : 0, eNPS: eNpsTotal ? Number(((p - d) / eNpsTotal * 100).toFixed(1)) : null, promoters: p, passives: pa, detractors: d, responses: eiFiltered.length }
  }, [eiFiltered, resolvedEngKeys, eNpsKey])

  // ══════════════════════════════════════════════════════════
  //  VTR DERIVED
  // ══════════════════════════════════════════════════════════
  const vtrYears        = useMemo(() => uniq(vtrRows.map(r => (r["reporting period"] as string | undefined)?.slice(0, 4))), [vtrRows])
  const vtrValueOptions = useMemo((): string[] => {
    switch (vtrFilterType) {
      case "Reporting Period": return uniq(vtrRows.map(r => r["reporting period"] as string | undefined))
      case "Delivery Unit":    return uniq(vtrRows.map(r => r["delivery unit"]    as string | undefined))
      case "Job Family":       return uniq(vtrRows.map(r => r["job family"]       as string | undefined))
      case "Tenure Band":      return uniq(vtrRows.map(r => r["tenure band"]      as string | undefined))
      default: return []
    }
  }, [vtrFilterType, vtrRows])
  const vtrVisibleFigs  = useMemo(() => vtrFilterType ? VTR_FILTER_AFFECTS[vtrFilterType] ?? [] : ["Fig 1", "Fig 2", "Fig 3"], [vtrFilterType])
  const vtrYearFiltered = useMemo(() => vtrYear ? vtrRows.filter(r => (r["reporting period"] as string | undefined)?.startsWith(vtrYear)) : vtrRows, [vtrRows, vtrYear])
  const vtrFiltered     = useMemo(() => {
    if (!vtrFilterType || !vtrFilterValue) return vtrYearFiltered
    return vtrYearFiltered.filter(r => {
      switch (vtrFilterType) {
        case "Reporting Period": return r["reporting period"] === vtrFilterValue
        case "Delivery Unit":    return r["delivery unit"]    === vtrFilterValue
        case "Job Family":       return r["job family"]       === vtrFilterValue
        case "Tenure Band":      return r["tenure band"]      === vtrFilterValue
        default: return true
      }
    })
  }, [vtrYearFiltered, vtrFilterType, vtrFilterValue])

  const vtrFig1 = useMemo(() => {
    const map: Record<string, { sep: number; hc: number }> = {}
    vtrFiltered.forEach(r => { const p = (r["reporting period"] as string | undefined) ?? "Unknown"; if (!map[p]) map[p] = { sep: 0, hc: 0 }; map[p].sep += toNum(r[vtrSepKey]); map[p].hc += toNum(r[vtrHcKey]) })
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([period, d]) => ({ period, rate: pct(d.sep, d.hc) }))
  }, [vtrFiltered, vtrSepKey, vtrHcKey])
  const vtrFig2 = useMemo(() => {
    const map: Record<string, { sep: number; hc: number }> = {}
    vtrFiltered.forEach(r => { const unit = (r["delivery unit"] as string | undefined)?.trim() ?? "Unknown"; if (!map[unit]) map[unit] = { sep: 0, hc: 0 }; map[unit].sep += toNum(r[vtrSepKey]); map[unit].hc += toNum(r[vtrHcKey]) })
    return Object.entries(map).map(([unit, d]) => ({ unit, rate: pct(d.sep, d.hc) }))
  }, [vtrFiltered, vtrSepKey, vtrHcKey])
  const vtrFig3 = useMemo(() => {
    const map: Record<string, { sep: number; hc: number }> = {}
    vtrFiltered.forEach(r => { const unit = (r["delivery unit"] as string | undefined)?.trim() ?? "Unknown"; if (!map[unit]) map[unit] = { sep: 0, hc: 0 }; map[unit].sep += toNum(r[vtrSepKey]); map[unit].hc += toNum(r[vtrHcKey]) })
    return Object.entries(map).map(([unit, d]) => ({ unit, "Avg Headcount": d.hc, "Voluntary Separations": d.sep, rate: pct(d.sep, d.hc) }))
  }, [vtrFiltered, vtrSepKey, vtrHcKey])
  const vtrHeadline = useMemo(() => {
    const sep = vtrFiltered.reduce((s, r) => s + toNum(r[vtrSepKey]), 0)
    const hc  = vtrFiltered.reduce((s, r) => s + toNum(r[vtrHcKey]),  0)
    return { sep, hc, rate: pct(sep, hc) }
  }, [vtrFiltered, vtrSepKey, vtrHcKey])

  // ══════════════════════════════════════════════════════════
  //  ERR DERIVED
  // ══════════════════════════════════════════════════════════
  const errYears        = useMemo(() => uniq(errRows.map(r => (r["reporting period"] as string | undefined)?.slice(0, 4))), [errRows])
  const errValueOptions = useMemo((): string[] => {
    switch (errFilterType) {
      case "Reporting Period": return uniq(errRows.map(r => r["reporting period"] as string | undefined))
      case "Delivery Unit":    return uniq(errRows.map(r => r["delivery unit"]    as string | undefined))
      default: return []
    }
  }, [errFilterType, errRows])
  const errVisibleFigs  = useMemo(() => errFilterType ? ERR_FILTER_AFFECTS[errFilterType] ?? [] : ["Fig 1", "Fig 2", "Fig 3"], [errFilterType])
  const errYearFiltered = useMemo(() => errYear ? errRows.filter(r => (r["reporting period"] as string | undefined)?.startsWith(errYear)) : errRows, [errRows, errYear])
  const errFiltered     = useMemo(() => {
    if (!errFilterType || !errFilterValue) return errYearFiltered
    return errYearFiltered.filter(r => {
      switch (errFilterType) {
        case "Reporting Period": return r["reporting period"] === errFilterValue
        case "Delivery Unit":    return r["delivery unit"]    === errFilterValue
        default: return true
      }
    })
  }, [errYearFiltered, errFilterType, errFilterValue])

  const errFig1 = useMemo(() => {
    const map: Record<string, { start: number; end: number; nh: number }> = {}
    errFiltered.forEach(r => { const p = (r["reporting period"] as string | undefined) ?? "Unknown"; if (!map[p]) map[p] = { start: 0, end: 0, nh: 0 }; map[p].start += toNum(r[errStartKey]); map[p].end += toNum(r[errEndKey]); map[p].nh += toNum(r[errNewHiresKey]) })
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([period, d]) => ({ period, rate: d.start ? Number((((d.end - d.nh) / d.start) * 100).toFixed(1)) : 0 }))
  }, [errFiltered, errStartKey, errEndKey, errNewHiresKey])
  const errFig2 = useMemo(() => {
    const map: Record<string, { start: number; end: number; nh: number }> = {}
    errFiltered.forEach(r => { const unit = (r["delivery unit"] as string | undefined)?.trim() ?? "Unknown"; if (!map[unit]) map[unit] = { start: 0, end: 0, nh: 0 }; map[unit].start += toNum(r[errStartKey]); map[unit].end += toNum(r[errEndKey]); map[unit].nh += toNum(r[errNewHiresKey]) })
    return Object.entries(map).map(([unit, d]) => ({ unit, rate: d.start ? Number((((d.end - d.nh) / d.start) * 100).toFixed(1)) : 0 }))
  }, [errFiltered, errStartKey, errEndKey, errNewHiresKey])
  const errFig3 = useMemo(() => {
    const map: Record<string, { start: number; end: number; nh: number }> = {}
    errFiltered.forEach(r => { const unit = (r["delivery unit"] as string | undefined)?.trim() ?? "Unknown"; if (!map[unit]) map[unit] = { start: 0, end: 0, nh: 0 }; map[unit].start += toNum(r[errStartKey]); map[unit].end += toNum(r[errEndKey]); map[unit].nh += toNum(r[errNewHiresKey]) })
    return Object.entries(map).map(([unit, d]) => ({ unit, "Start Cohort": d.start, "Retained Cohort": Math.max(0, d.end - d.nh), rate: d.start ? Number((((d.end - d.nh) / d.start) * 100).toFixed(1)) : 0 }))
  }, [errFiltered, errStartKey, errEndKey, errNewHiresKey])
  const errHeadline = useMemo(() => {
    const start = errFiltered.reduce((s, r) => s + toNum(r[errStartKey]), 0)
    const end   = errFiltered.reduce((s, r) => s + toNum(r[errEndKey]),   0)
    const nh    = errFiltered.reduce((s, r) => s + toNum(r[errNewHiresKey]), 0)
    const ret   = end - nh
    return { start, retained: ret, rate: start ? Number(((ret / start) * 100).toFixed(1)) : 0 }
  }, [errFiltered, errStartKey, errEndKey, errNewHiresKey])

  const errC = (r: number) => r >= 95 ? "#10b981" : r >= 90 ? "#f59e0b" : "#ef4444"

  // ══════════════════════════════════════════════════════════
  //  ITS DERIVED
  // ══════════════════════════════════════════════════════════
  const itsYears        = useMemo(() => uniq(itsRows.map(r => (r["survey period"] as string | undefined)?.slice(0, 4))), [itsRows])
  const itsValueOptions = useMemo((): string[] => {
    switch (itsFilterType) {
      case "Survey Period": return uniq(itsRows.map(r => r["survey period"] as string | undefined))
      case "Function":      return uniq(itsRows.map(r => r["function"]     as string | undefined))
      case "Role Level":    return uniq(itsRows.map(r => r["role level"]   as string | undefined))
      case "Location":      return uniq(itsRows.map(r => r["location"]     as string | undefined))
      case "Tenure Band":   return uniq(itsRows.map(r => r["tenure band"]  as string | undefined))
      default: return []
    }
  }, [itsFilterType, itsRows])
  const itsVisibleFigs  = useMemo(() => itsFilterType ? ITS_FILTER_AFFECTS[itsFilterType] ?? [] : ["Fig 1", "Fig 2", "Fig 3"], [itsFilterType])
  const itsYearFiltered = useMemo(() => itsYear ? itsRows.filter(r => (r["survey period"] as string | undefined)?.startsWith(itsYear)) : itsRows, [itsRows, itsYear])
  const itsFiltered     = useMemo(() => {
    if (!itsFilterType || !itsFilterValue) return itsYearFiltered
    return itsYearFiltered.filter(r => {
      switch (itsFilterType) {
        case "Survey Period": return r["survey period"] === itsFilterValue
        case "Function":      return r["function"]      === itsFilterValue
        case "Role Level":    return r["role level"]    === itsFilterValue
        case "Location":      return r["location"]      === itsFilterValue
        case "Tenure Band":   return r["tenure band"]   === itsFilterValue
        default: return true
      }
    })
  }, [itsYearFiltered, itsFilterType, itsFilterValue])

  const itsFig1     = useMemo(() => { const map: Record<string, { fav: number; total: number }> = {}; itsFiltered.forEach(r => { const p = (r["survey period"] as string | undefined) ?? "Unknown"; if (!map[p]) map[p] = { fav: 0, total: 0 }; map[p].total++; if (isAgree(r[itsQ1Key])) map[p].fav++ }); return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([period, d]) => ({ period, rate: pct(d.fav, d.total) })) }, [itsFiltered, itsQ1Key])
  const itsFig2     = useMemo(() => { const map: Record<string, { fav: number; total: number }> = {}; itsFiltered.forEach(r => { const band = (r["tenure band"] as string | undefined)?.trim() ?? "Unknown"; if (!map[band]) map[band] = { fav: 0, total: 0 }; map[band].total++; if (isAgree(r[itsQ1Key])) map[band].fav++ }); return Object.entries(map).map(([band, d]) => ({ band, rate: pct(d.fav, d.total) })) }, [itsFiltered, itsQ1Key])
  const itsFig3     = useMemo(() => { const map: Record<string, { fav: number; unfav: number }> = {}; itsFiltered.forEach(r => { const p = (r["survey period"] as string | undefined) ?? "Unknown"; if (!map[p]) map[p] = { fav: 0, unfav: 0 }; if (isAgree(r[itsQ1Key])) map[p].fav++; else map[p].unfav++ }); return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([period, d]) => ({ period, "Favorable": d.fav, "Unfavorable": d.unfav })) }, [itsFiltered, itsQ1Key])
  const itsHeadline = useMemo(() => { const fav = itsFiltered.filter(r => isAgree(r[itsQ1Key])).length; const total = itsFiltered.length; const scores = itsFiltered.map(r => toLikert(r[itsQ1Key])).filter((v): v is number => v !== null); return { rate: pct(fav, total), mean: avgArr(scores), favorable: fav, total } }, [itsFiltered, itsQ1Key])
  const itsC        = (r: number) => r >= 80 ? "#8b5cf6" : r >= 60 ? "#f59e0b" : "#ef4444"

  // ══════════════════════════════════════════════════════════
  //  NER DERIVED
  // ══════════════════════════════════════════════════════════
  const nerYears        = useMemo(() => uniq(nerRows.map(r => (r["reporting period"] as string | undefined)?.slice(0, 4))), [nerRows])
  const nerValueOptions = useMemo((): string[] => {
    switch (nerFilterType) {
      case "Reporting Period": return uniq(nerRows.map(r => r["reporting period"] as string | undefined))
      case "Delivery Unit":    return uniq(nerRows.map(r => r["delivery unit"]    as string | undefined))
      case "Location":         return uniq(nerRows.map(r => r["location"]         as string | undefined))
      default: return []
    }
  }, [nerFilterType, nerRows])
  const nerVisibleFigs  = useMemo(() => nerFilterType ? NER_FILTER_AFFECTS[nerFilterType] ?? [] : ["Fig 1", "Fig 2", "Fig 3"], [nerFilterType])
  const nerYearFiltered = useMemo(() => nerYear ? nerRows.filter(r => (r["reporting period"] as string | undefined)?.startsWith(nerYear)) : nerRows, [nerRows, nerYear])
  const nerFiltered     = useMemo(() => {
    if (!nerFilterType || !nerFilterValue) return nerYearFiltered
    return nerYearFiltered.filter(r => {
      switch (nerFilterType) {
        case "Reporting Period": return r["reporting period"] === nerFilterValue
        case "Delivery Unit":    return r["delivery unit"]    === nerFilterValue
        case "Location":         return r["location"]         === nerFilterValue
        default: return true
      }
    })
  }, [nerYearFiltered, nerFilterType, nerFilterValue])

  const nerFig1     = useMemo(() => { const map: Record<string, number> = {}; nerFiltered.forEach(r => { const p = (r["reporting period"] as string | undefined) ?? "Unknown"; if (!map[p]) map[p] = 0; map[p] += toNum(r[nerReferralsKey]) }); return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([period, count]) => ({ period, count })) }, [nerFiltered, nerReferralsKey])
  const nerFig2     = useMemo(() => { const map: Record<string, number> = {}; nerFiltered.forEach(r => { const unit = (r["delivery unit"] as string | undefined)?.trim() ?? "Unknown"; if (!map[unit]) map[unit] = 0; map[unit] += toNum(r[nerReferralsKey]) }); return Object.entries(map).map(([unit, count]) => ({ unit, count })) }, [nerFiltered, nerReferralsKey])
  const nerFig3     = useMemo(() => { const map: Record<string, { p: number; a: number }> = {}; nerFiltered.forEach(r => { const unit = (r["delivery unit"] as string | undefined)?.trim() ?? "Unknown"; if (!map[unit]) map[unit] = { p: 0, a: 0 }; map[unit].p += toNum(r[nerParticipKey]); map[unit].a += toNum(r[nerActiveKey]) }); return Object.entries(map).filter(([, d]) => d.a > 0).map(([unit, d]) => ({ unit, rate: pct(d.p, d.a) })) }, [nerFiltered, nerParticipKey, nerActiveKey])
  const nerHeadline = useMemo(() => { const count = nerFiltered.reduce((s, r) => s + toNum(r[nerReferralsKey]), 0); const particip = nerFiltered.reduce((s, r) => s + toNum(r[nerParticipKey]), 0); const active = nerFiltered.reduce((s, r) => s + toNum(r[nerActiveKey]), 0); return { count, particip, active, rate: active ? pct(particip, active) : null } }, [nerFiltered, nerReferralsKey, nerParticipKey, nerActiveKey])

  // ── Tabs ──────────────────────────────────────────────────
  const TABS = [
    { key: "ei",  label: "Engagement Index / eNPS",  accent: "#6366f1", loaded: eiLoaded },
    { key: "vtr", label: "Voluntary Turnover",        accent: "#ef4444", loaded: vtrLoaded },
    { key: "err", label: "Employee Retention",        accent: "#10b981", loaded: errLoaded },
    { key: "its", label: "Intent to Stay",            accent: "#8b5cf6", loaded: itsLoaded },
    { key: "ner", label: "Employee Referrals",        accent: "#f59e0b", loaded: nerLoaded },
  ] as const

  // ── Render ────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "'DM Sans', sans-serif", padding: "3px 24px 60px" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; }
        select { font-family: inherit; }
        @media print { .no-print { display: none !important; } }
      `}</style>

      <div style={{ maxWidth: 1100, margin: "0 auto" }}>

        {/* Syncing indicator */}
        {rehydrating && (
          <div style={{ fontSize: 11, color: "#94a3b8", display: "flex", alignItems: "center", gap: 6, marginBottom: 16 }}>
            <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "#6366f1", animation: "pulse 1s infinite" }} />
            Syncing from database…
            <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.3} }`}</style>
          </div>
        )}

        {/* KPI row */}
        {summaryMetrics.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 24 }}>
            {summaryMetrics.map(m => (
              <Card key={m.metric} style={{ padding: "16px 20px" }}>
                <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6 }}>{m.metric}</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                  <span style={{ fontSize: 28, fontWeight: 800, color: m.accent, lineHeight: 1 }}>{m.value}</span>
                  <span style={{ fontSize: 12, color: m.accent + "99", fontWeight: 600 }}>{m.unit}</span>
                </div>
                {m.sub && <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 3 }}>{m.sub}</div>}
              </Card>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="no-print" style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              style={{ padding: "8px 20px", borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: "pointer", border: "none", transition: "all .18s", background: activeTab === t.key ? t.accent : "#fff", color: activeTab === t.key ? "#fff" : t.loaded ? "#475569" : "#cbd5e1", opacity: t.loaded ? 1 : 0.45, boxShadow: activeTab === t.key ? `0 4px 14px ${t.accent}45` : "0 1px 3px rgba(0,0,0,.06)" }}>
              {t.loaded ? "●" : "○"} {t.label}
            </button>
          ))}
        </div>

        {/* ── EI ── */}
        {activeTab === "ei" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {!eiLoaded ? <Card><EmptyState label="Engagement Index / eNPS" /></Card> : (
              <>
                <TwoDropFilter filterKeys={Object.keys(EI_FILTER_AFFECTS)} affectsMap={EI_FILTER_AFFECTS} years={eiYears} filterType={eiFilterType} filterValue={eiFilterValue} selectedYear={eiYear} onFilterType={setEiFilterType} onFilterValue={setEiFilterValue} onYear={setEiYear} onClear={() => { setEiFilterType(""); setEiFilterValue(""); setEiYear("") }} accent="#6366f1" valueOptions={eiValueOptions} />
                <div className="no-print"><ExportBar onCSV={() => exportCSV(eiFiltered as object[], "EI_data")} onXLSX={() => exportXLSX(eiFiltered as object[], "EI_data")} /></div>
                <Card>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 14 }}>Engagement Index / eNPS — Summary</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10 }}>
                    <StatPill label="Engagement Index" value={`${eiHeadline.index}%`}  accent="#6366f1" sub="Avg favorability Q1–Q5" />
                    <StatPill label="eNPS"             value={eiHeadline.eNPS ?? "—"} accent={eiHeadline.eNPS != null && eiHeadline.eNPS >= 0 ? "#6366f1" : "#ef4444"} sub="Promoters − Detractors %" />
                    <StatPill label="Promoters (9–10)" value={eiHeadline.promoters}    accent="#10b981" />
                    <StatPill label="Passives (7–8)"   value={eiHeadline.passives}     accent="#f59e0b" />
                    <StatPill label="Detractors (0–6)" value={eiHeadline.detractors}   accent="#ef4444" />
                    <StatPill label="Total Responses"  value={eiHeadline.responses}    accent="#6366f1" />
                  </div>
                </Card>
                {eiVisibleFigs.includes("Fig 1") && (<FigCard fig="Fig 1" title="Engagement Index by Survey Period" subtitle="Line chart · quarterly engagement movement">{eiFig1.length < 2 ? <EmptyChart msg="Need ≥2 survey periods to show trend" /> : (<ResponsiveContainer width="100%" height={280}><LineChart data={eiFig1} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}><CartesianGrid strokeDasharray="4 4" stroke="#f1f5f9" /><XAxis dataKey="period" tick={{ fill: "#94a3b8", fontSize: 12 }} /><YAxis domain={[0, 100]} tick={{ fill: "#94a3b8", fontSize: 12 }} unit="%" /><Tooltip content={<CT unit="%" />} /><Line type="monotone" dataKey="index" name="Engagement Index" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 5, fill: "#6366f1", strokeWidth: 0 }} activeDot={{ r: 7 }} /></LineChart></ResponsiveContainer>)}</FigCard>)}
                {eiVisibleFigs.includes("Fig 2") && (<FigCard fig="Fig 2" title="eNPS by Survey Period" subtitle="Line chart · employee advocacy trend">{eiFig2.length < 2 ? <EmptyChart msg="Need ≥2 survey periods to show trend" /> : (<ResponsiveContainer width="100%" height={280}><LineChart data={eiFig2} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}><CartesianGrid strokeDasharray="4 4" stroke="#f1f5f9" /><XAxis dataKey="period" tick={{ fill: "#94a3b8", fontSize: 12 }} /><YAxis domain={[-100, 100]} tick={{ fill: "#94a3b8", fontSize: 12 }} /><Tooltip content={<CT />} /><Line type="monotone" dataKey="eNPS" name="eNPS" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 5, fill: "#6366f1", strokeWidth: 0 }} activeDot={{ r: 7 }} /></LineChart></ResponsiveContainer>)}</FigCard>)}
                {eiVisibleFigs.includes("Fig 3") && (<FigCard fig="Fig 3" title="Engagement Driver Scores" subtitle="Horizontal bar · Purpose, Enablement, Commitment, Growth, Belonging">{eiFig3.every(d => d.favorability === 0) ? <EmptyChart msg="No driver score data" /> : (<ResponsiveContainer width="100%" height={Math.max(200, eiFig3.length * 56)}><BarChart layout="vertical" data={eiFig3} margin={{ top: 4, right: 60, left: 10, bottom: 4 }}><CartesianGrid strokeDasharray="4 4" stroke="#f1f5f9" horizontal={false} /><XAxis type="number" domain={[0, 100]} tick={{ fill: "#94a3b8", fontSize: 11 }} unit="%" /><YAxis type="category" dataKey="driver" tick={{ fill: "#475569", fontSize: 12 }} width={100} /><Tooltip content={<CT unit="%" />} /><Bar dataKey="favorability" name="Favorability %" radius={[0, 6, 6, 0]}>{eiFig3.map((d, i) => <Cell key={i} fill={d.favorability >= 70 ? "#6366f1" : d.favorability >= 50 ? "#f59e0b" : "#ef4444"} />)}</Bar></BarChart></ResponsiveContainer>)}</FigCard>)}
                {eiVisibleFigs.includes("Fig 4") && (<FigCard fig="Fig 4" title="eNPS Distribution by Survey Period" subtitle="Stacked column · Promoter / Passive / Detractor mix">{eiFig4.length === 0 ? <EmptyChart msg="No eNPS distribution data" /> : (<ResponsiveContainer width="100%" height={300}><BarChart data={eiFig4} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}><CartesianGrid strokeDasharray="4 4" stroke="#f1f5f9" /><XAxis dataKey="period" tick={{ fill: "#475569", fontSize: 12 }} /><YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} /><Tooltip content={<CT />} /><Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} /><Bar dataKey="Promoters" stackId="a" fill="#10b981" /><Bar dataKey="Passives" stackId="a" fill="#f59e0b" /><Bar dataKey="Detractors" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer>)}</FigCard>)}
              </>
            )}
          </div>
        )}

        {/* ── VTR ── */}
        {activeTab === "vtr" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {!vtrLoaded ? <Card><EmptyState label="Voluntary Turnover Rate" /></Card> : (
              <>
                <TwoDropFilter filterKeys={Object.keys(VTR_FILTER_AFFECTS)} affectsMap={VTR_FILTER_AFFECTS} years={vtrYears} filterType={vtrFilterType} filterValue={vtrFilterValue} selectedYear={vtrYear} onFilterType={setVtrFilterType} onFilterValue={setVtrFilterValue} onYear={setVtrYear} onClear={() => { setVtrFilterType(""); setVtrFilterValue(""); setVtrYear("") }} accent="#ef4444" valueOptions={vtrValueOptions} />
                <div className="no-print"><ExportBar onCSV={() => exportCSV(vtrFiltered as object[], "VTR_data")} onXLSX={() => exportXLSX(vtrFiltered as object[], "VTR_data")} /></div>
                <Card>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 14 }}>Voluntary Turnover Rate — Summary</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
                    <StatPill label="VTR" value={`${vtrHeadline.rate}%`} accent="#ef4444" sub="(Separations ÷ Headcount) × 100" />
                    <StatPill label="Voluntary Separations" value={vtrHeadline.sep} accent="#ef4444" />
                    <StatPill label="Avg Headcount" value={vtrHeadline.hc.toLocaleString()} accent="#ef4444" />
                    <StatPill label="Benchmark" value="< 10% target" accent={vtrHeadline.rate < 10 ? "#10b981" : "#ef4444"} sub={vtrHeadline.rate < 10 ? "✓ Within range" : "⚠️ Elevated"} />
                  </div>
                </Card>
                {vtrVisibleFigs.includes("Fig 1") && (<FigCard fig="Fig 1" title="Voluntary Turnover Rate by Quarter" subtitle="Line chart">{vtrFig1.length < 2 ? <EmptyChart msg="Need ≥2 reporting periods" /> : (<ResponsiveContainer width="100%" height={280}><LineChart data={vtrFig1} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}><CartesianGrid strokeDasharray="4 4" stroke="#f1f5f9" /><XAxis dataKey="period" tick={{ fill: "#94a3b8", fontSize: 12 }} /><YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} unit="%" /><Tooltip content={<CT unit="%" />} /><Line type="monotone" dataKey="rate" name="VTR" stroke="#ef4444" strokeWidth={2.5} dot={{ r: 5, fill: "#ef4444", strokeWidth: 0 }} activeDot={{ r: 7 }} /></LineChart></ResponsiveContainer>)}</FigCard>)}
                {vtrVisibleFigs.includes("Fig 2") && (<FigCard fig="Fig 2" title="Voluntary Turnover Rate by Delivery Unit" subtitle="Horizontal bar">{vtrFig2.length === 0 ? <EmptyChart msg="No delivery unit data" /> : (<ResponsiveContainer width="100%" height={Math.max(200, vtrFig2.length * 52)}><BarChart layout="vertical" data={vtrFig2} margin={{ top: 4, right: 60, left: 10, bottom: 4 }}><CartesianGrid strokeDasharray="4 4" stroke="#f1f5f9" horizontal={false} /><XAxis type="number" tick={{ fill: "#94a3b8", fontSize: 11 }} unit="%" /><YAxis type="category" dataKey="unit" tick={{ fill: "#475569", fontSize: 12 }} width={140} /><Tooltip content={<CT unit="%" />} /><Bar dataKey="rate" name="VTR" radius={[0, 6, 6, 0]}>{vtrFig2.map((d, i) => <Cell key={i} fill="#ef4444" />)}</Bar></BarChart></ResponsiveContainer>)}</FigCard>)}
                {vtrVisibleFigs.includes("Fig 3") && (<FigCard fig="Fig 3" title="Headcount vs. Voluntary Separations by Unit" subtitle="Clustered column">{vtrFig3.length === 0 ? <EmptyChart msg="No data" /> : (<ResponsiveContainer width="100%" height={300}><BarChart data={vtrFig3} margin={{ top: 10, right: 20, left: 0, bottom: 60 }}><CartesianGrid strokeDasharray="4 4" stroke="#f1f5f9" /><XAxis dataKey="unit" tick={{ fill: "#475569", fontSize: 11 }} angle={-35} textAnchor="end" interval={0} /><YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} /><Tooltip content={<CT />} /><Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} /><Bar dataKey="Avg Headcount" fill="#94a3b8" fillOpacity={0.6} radius={[4, 4, 0, 0]} /><Bar dataKey="Voluntary Separations" fill="#ef4444" fillOpacity={0.85} radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer>)}</FigCard>)}
              </>
            )}
          </div>
        )}

        {/* ── ERR ── */}
        {activeTab === "err" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {!errLoaded ? <Card><EmptyState label="Employee Retention Rate" /></Card> : (
              <>
                <TwoDropFilter filterKeys={Object.keys(ERR_FILTER_AFFECTS)} affectsMap={ERR_FILTER_AFFECTS} years={errYears} filterType={errFilterType} filterValue={errFilterValue} selectedYear={errYear} onFilterType={setErrFilterType} onFilterValue={setErrFilterValue} onYear={setErrYear} onClear={() => { setErrFilterType(""); setErrFilterValue(""); setErrYear("") }} accent="#10b981" valueOptions={errValueOptions} />
                <div className="no-print"><ExportBar onCSV={() => exportCSV(errFiltered as object[], "ERR_data")} onXLSX={() => exportXLSX(errFiltered as object[], "ERR_data")} /></div>
                <Card>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 14 }}>Employee Retention Rate — Summary</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
                    <StatPill label="Retention Rate" value={`${errHeadline.rate}%`} accent="#10b981" sub="(End − New Hires) ÷ Start × 100" />
                    <StatPill label="Start Cohort"   value={errHeadline.start.toLocaleString()} accent="#10b981" />
                    <StatPill label="Retained"       value={errHeadline.retained.toLocaleString()} accent="#10b981" />
                    <StatPill label="Target"         value="≥ 95%" accent={errHeadline.rate >= 95 ? "#10b981" : "#ef4444"} sub={errHeadline.rate >= 95 ? "✓ On target" : "⚠️ Below target"} />
                  </div>
                </Card>
                {errVisibleFigs.includes("Fig 1") && (<FigCard fig="Fig 1" title="Retention Rate by Quarter" subtitle="Line chart">{errFig1.length < 2 ? <EmptyChart msg="Need ≥2 reporting periods" /> : (<ResponsiveContainer width="100%" height={280}><LineChart data={errFig1} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}><CartesianGrid strokeDasharray="4 4" stroke="#f1f5f9" /><XAxis dataKey="period" tick={{ fill: "#94a3b8", fontSize: 12 }} /><YAxis domain={[80, 100]} tick={{ fill: "#94a3b8", fontSize: 12 }} unit="%" /><Tooltip content={<CT unit="%" />} /><Line type="monotone" dataKey="rate" name="Retention Rate" stroke="#10b981" strokeWidth={2.5} dot={{ r: 5, fill: "#10b981", strokeWidth: 0 }} activeDot={{ r: 7 }} /></LineChart></ResponsiveContainer>)}</FigCard>)}
                {errVisibleFigs.includes("Fig 2") && (<FigCard fig="Fig 2" title="Retention Rate by Delivery Unit" subtitle="Horizontal bar">{errFig2.length === 0 ? <EmptyChart msg="No delivery unit data" /> : (<ResponsiveContainer width="100%" height={Math.max(200, errFig2.length * 52)}><BarChart layout="vertical" data={errFig2} margin={{ top: 4, right: 60, left: 10, bottom: 4 }}><CartesianGrid strokeDasharray="4 4" stroke="#f1f5f9" horizontal={false} /><XAxis type="number" domain={[80, 100]} tick={{ fill: "#94a3b8", fontSize: 11 }} unit="%" /><YAxis type="category" dataKey="unit" tick={{ fill: "#475569", fontSize: 12 }} width={140} /><Tooltip content={<CT unit="%" />} /><Bar dataKey="rate" name="Retention Rate" radius={[0, 6, 6, 0]}>{errFig2.map((d, i) => <Cell key={i} fill={errC(d.rate)} />)}</Bar></BarChart></ResponsiveContainer>)}</FigCard>)}
                {errVisibleFigs.includes("Fig 3") && (<FigCard fig="Fig 3" title="Start Cohort vs. Retained Cohort by Unit" subtitle="Clustered column">{errFig3.length === 0 ? <EmptyChart msg="No data" /> : (<ResponsiveContainer width="100%" height={300}><BarChart data={errFig3} margin={{ top: 10, right: 20, left: 0, bottom: 60 }}><CartesianGrid strokeDasharray="4 4" stroke="#f1f5f9" /><XAxis dataKey="unit" tick={{ fill: "#475569", fontSize: 11 }} angle={-35} textAnchor="end" interval={0} /><YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} /><Tooltip content={<CT />} /><Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} /><Bar dataKey="Start Cohort" fill="#94a3b8" fillOpacity={0.6} radius={[4, 4, 0, 0]} /><Bar dataKey="Retained Cohort" radius={[4, 4, 0, 0]}>{errFig3.map((d, i) => <Cell key={i} fill={errC(d.rate)} />)}</Bar></BarChart></ResponsiveContainer>)}</FigCard>)}
              </>
            )}
          </div>
        )}

        {/* ── ITS ── */}
        {activeTab === "its" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {!itsLoaded ? <Card><EmptyState label="Intent to Stay" /></Card> : (
              <>
                <TwoDropFilter filterKeys={Object.keys(ITS_FILTER_AFFECTS)} affectsMap={ITS_FILTER_AFFECTS} years={itsYears} filterType={itsFilterType} filterValue={itsFilterValue} selectedYear={itsYear} onFilterType={setItsFilterType} onFilterValue={setItsFilterValue} onYear={setItsYear} onClear={() => { setItsFilterType(""); setItsFilterValue(""); setItsYear("") }} accent="#8b5cf6" valueOptions={itsValueOptions} />
                <div className="no-print"><ExportBar onCSV={() => exportCSV(itsFiltered as object[], "ITS_data")} onXLSX={() => exportXLSX(itsFiltered as object[], "ITS_data")} /></div>
                <Card>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 14 }}>Intent to Stay — Summary</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
                    <StatPill label="ITS Rate"       value={`${itsHeadline.rate}%`}    accent="#8b5cf6" sub="Agree + Strongly Agree %" />
                    <StatPill label="Mean Score"     value={`${itsHeadline.mean} / 5`} accent="#8b5cf6" sub="Likert avg" />
                    <StatPill label="Favorable"      value={itsHeadline.favorable}     accent="#8b5cf6" />
                    <StatPill label="Total Responses" value={itsHeadline.total}        accent="#8b5cf6" />
                  </div>
                </Card>
                {itsVisibleFigs.includes("Fig 1") && (<FigCard fig="Fig 1" title="Intent to Stay by Survey Period" subtitle="Line chart">{itsFig1.length < 2 ? <EmptyChart msg="Need ≥2 survey periods" /> : (<ResponsiveContainer width="100%" height={280}><LineChart data={itsFig1} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}><CartesianGrid strokeDasharray="4 4" stroke="#f1f5f9" /><XAxis dataKey="period" tick={{ fill: "#94a3b8", fontSize: 12 }} /><YAxis domain={[0, 100]} tick={{ fill: "#94a3b8", fontSize: 12 }} unit="%" /><Tooltip content={<CT unit="%" />} /><Line type="monotone" dataKey="rate" name="ITS Rate" stroke="#8b5cf6" strokeWidth={2.5} dot={{ r: 5, fill: "#8b5cf6", strokeWidth: 0 }} activeDot={{ r: 7 }} /></LineChart></ResponsiveContainer>)}</FigCard>)}
                {itsVisibleFigs.includes("Fig 2") && (<FigCard fig="Fig 2" title="Intent to Stay by Tenure Band" subtitle="Horizontal bar">{itsFig2.length === 0 ? <EmptyChart msg="No tenure band data" /> : (<ResponsiveContainer width="100%" height={Math.max(200, itsFig2.length * 52)}><BarChart layout="vertical" data={itsFig2} margin={{ top: 4, right: 60, left: 10, bottom: 4 }}><CartesianGrid strokeDasharray="4 4" stroke="#f1f5f9" horizontal={false} /><XAxis type="number" domain={[0, 100]} tick={{ fill: "#94a3b8", fontSize: 11 }} unit="%" /><YAxis type="category" dataKey="band" tick={{ fill: "#475569", fontSize: 12 }} width={100} /><Tooltip content={<CT unit="%" />} /><Bar dataKey="rate" name="ITS Rate" radius={[0, 6, 6, 0]}>{itsFig2.map((d, i) => <Cell key={i} fill={itsC(d.rate)} />)}</Bar></BarChart></ResponsiveContainer>)}</FigCard>)}
                {itsVisibleFigs.includes("Fig 3") && (<FigCard fig="Fig 3" title="Favorable vs. Unfavorable Intent to Stay Mix" subtitle="Stacked column">{itsFig3.length === 0 ? <EmptyChart msg="No data" /> : (<ResponsiveContainer width="100%" height={300}><BarChart data={itsFig3} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}><CartesianGrid strokeDasharray="4 4" stroke="#f1f5f9" /><XAxis dataKey="period" tick={{ fill: "#475569", fontSize: 12 }} /><YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} /><Tooltip content={<CT />} /><Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} /><Bar dataKey="Favorable" stackId="a" fill="#8b5cf6" /><Bar dataKey="Unfavorable" stackId="a" fill="#e2e8f0" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer>)}</FigCard>)}
              </>
            )}
          </div>
        )}

        {/* ── NER ── */}
        {activeTab === "ner" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {!nerLoaded ? <Card><EmptyState label="Employee Referrals" /></Card> : (
              <>
                <TwoDropFilter filterKeys={Object.keys(NER_FILTER_AFFECTS)} affectsMap={NER_FILTER_AFFECTS} years={nerYears} filterType={nerFilterType} filterValue={nerFilterValue} selectedYear={nerYear} onFilterType={setNerFilterType} onFilterValue={setNerFilterValue} onYear={setNerYear} onClear={() => { setNerFilterType(""); setNerFilterValue(""); setNerYear("") }} accent="#f59e0b" valueOptions={nerValueOptions} />
                <div className="no-print"><ExportBar onCSV={() => exportCSV(nerFiltered as object[], "NER_data")} onXLSX={() => exportXLSX(nerFiltered as object[], "NER_data")} /></div>
                <Card>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 14 }}>Employee Referrals — Summary</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
                    <StatPill label="Total Referrals"         value={nerHeadline.count} accent="#f59e0b" sub="Primary count metric" />
                    <StatPill label="Referral Rate"           value={nerHeadline.rate != null ? `${nerHeadline.rate}%` : "—"} accent="#f59e0b" sub="Participants ÷ Active × 100" />
                    <StatPill label="Participating Employees" value={nerHeadline.particip} accent="#f59e0b" />
                    <StatPill label="Active Employees"        value={nerHeadline.active.toLocaleString()} accent="#f59e0b" />
                  </div>
                </Card>
                {nerVisibleFigs.includes("Fig 1") && (<FigCard fig="Fig 1" title="Number of Employee Referrals by Quarter" subtitle="Line chart">{nerFig1.length < 2 ? <EmptyChart msg="Need ≥2 reporting periods" /> : (<ResponsiveContainer width="100%" height={280}><LineChart data={nerFig1} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}><CartesianGrid strokeDasharray="4 4" stroke="#f1f5f9" /><XAxis dataKey="period" tick={{ fill: "#94a3b8", fontSize: 12 }} /><YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} /><Tooltip content={<CT unit=" referrals" />} /><Line type="monotone" dataKey="count" name="Referrals" stroke="#f59e0b" strokeWidth={2.5} dot={{ r: 5, fill: "#f59e0b", strokeWidth: 0 }} activeDot={{ r: 7 }} /></LineChart></ResponsiveContainer>)}</FigCard>)}
                {nerVisibleFigs.includes("Fig 2") && (<FigCard fig="Fig 2" title="Number of Employee Referrals by Delivery Unit" subtitle="Horizontal bar">{nerFig2.length === 0 ? <EmptyChart msg="No delivery unit data" /> : (<ResponsiveContainer width="100%" height={Math.max(200, nerFig2.length * 52)}><BarChart layout="vertical" data={nerFig2} margin={{ top: 4, right: 60, left: 10, bottom: 4 }}><CartesianGrid strokeDasharray="4 4" stroke="#f1f5f9" horizontal={false} /><XAxis type="number" tick={{ fill: "#94a3b8", fontSize: 11 }} /><YAxis type="category" dataKey="unit" tick={{ fill: "#475569", fontSize: 12 }} width={140} /><Tooltip content={<CT unit=" referrals" />} /><Bar dataKey="count" name="Referrals" fill="#f59e0b" fillOpacity={0.85} radius={[0, 6, 6, 0]} /></BarChart></ResponsiveContainer>)}</FigCard>)}
                {nerVisibleFigs.includes("Fig 3") && (<FigCard fig="Fig 3" title="Referral Rate (%) by Delivery Unit" subtitle="Bar chart">{nerFig3.length === 0 ? <EmptyChart msg="No referral rate data — ensure file includes Total Active Employees column" /> : (<ResponsiveContainer width="100%" height={Math.max(200, nerFig3.length * 52)}><BarChart layout="vertical" data={nerFig3} margin={{ top: 4, right: 60, left: 10, bottom: 4 }}><CartesianGrid strokeDasharray="4 4" stroke="#f1f5f9" horizontal={false} /><XAxis type="number" tick={{ fill: "#94a3b8", fontSize: 11 }} unit="%" /><YAxis type="category" dataKey="unit" tick={{ fill: "#475569", fontSize: 12 }} width={140} /><Tooltip content={<CT unit="%" />} /><Bar dataKey="rate" name="Referral Rate" fill="#f59e0b" fillOpacity={0.85} radius={[0, 6, 6, 0]} /></BarChart></ResponsiveContainer>)}</FigCard>)}
              </>
            )}
          </div>
        )}

      </div>

      <div style={{ textAlign: "center", marginTop: 52, fontSize: 11, color: "#cbd5e1" }}>
        EX Engagement &amp; Retention Reports · Powered by Supabase
      </div>
    </div>
  )
}