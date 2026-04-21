"use client"

import { useState, useEffect, useMemo } from "react"
import * as XLSX from "xlsx"
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend,
  CartesianGrid, ResponsiveContainer, LineChart, Line,
  PieChart, Pie, Cell, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis,
} from "recharts"

// ─── Types ────────────────────────────────────────────────
interface MetricData {
  metric: string; value: number; unit?: string; accent: string; sub?: string
}
interface TtpRawRow {
  "employee id"?: string; "start date"?: string; "role / job family"?: string
  "delivery unit"?: string; "productivity confirmed"?: string
  "confirmation date"?: string; "confirmed by"?: string
  [key: string]: string | number | undefined
}
interface NheRawRow { [key: string]: string | number | undefined }
interface TcrRawRow {
  "cohort"?: string; "role / job family"?: string
  "training modality"?: string; "completion deadline"?: string
  [key: string]: string | number | undefined
}

// LL60 raw row — mirrors the sheet after normalizeKey()
interface Ll60RawRow {
  "session id"?: string
  "session date"?: string
  "cycle / hire period"?: string
  "session type"?: string
  "participant count"?: string | number
  "delivery unit"?: string
  "location / work arrangement"?: string
  "facilitator name(s)"?: string
  "motivation & engagement"?: string
  "manager relationship"?: string
  "team belonging"?: string
  "workload & stress"?: string
  "growth & future outlook"?: string
  "recognition & value"?: string
  "overall retention risk"?: string
  [key: string]: string | number | undefined
}

// ─── LaunchLens30 category config ─────────────────────────
const LL_CATEGORIES = [
  { id: "fde",   label: "First-Day Exp & Orientation", isOOE: false },
  { id: "rc",    label: "Role Clarity & Expectations",  isOOE: false },
  { id: "ms",    label: "Manager Support & Feedback",   isOOE: false },
  { id: "tc",    label: "Team Culture & Belonging",     isOOE: false },
  { id: "tools", label: "Tools & Systems",              isOOE: false },
  { id: "cwt",   label: "Company-wide Training",        isOOE: false },
  { id: "dut",   label: "DU-Specific Training",         isOOE: false },
  { id: "pgfo",  label: "Growth & Future Outlook",      isOOE: false },
  { id: "ooe",   label: "Overall Experience (OOE)",     isOOE: true  },
  { id: "hrsf",  label: "HR & Support Functions",       isOOE: false },
]

// ─── LL60 dimension config ────────────────────────────────
const LL60_DIMENSIONS = [
  { key: "motivation & engagement",  label: "Motivation & Engagement",  short: "Motivation"  },
  { key: "manager relationship",     label: "Manager Relationship",      short: "Manager"     },
  { key: "team belonging",           label: "Team Belonging",            short: "Belonging"   },
  { key: "workload & stress",        label: "Workload & Stress",         short: "Workload"    },
  { key: "growth & future outlook",  label: "Growth & Future Outlook",   short: "Growth"      },
  { key: "recognition & value",      label: "Recognition & Value",       short: "Recognition" },
]

// ─── Filter affect maps ───────────────────────────────────
const TTP_FILTER_AFFECTS: Record<string, string[]> = {
  "Start Date":             ["Fig 1", "Fig 2", "Fig 3"],
  "Onboarding Cohort":      ["Fig 1", "Fig 2", "Fig 3"],
  "Delivery Unit":          ["Fig 2", "Fig 3"],
  "Role / Job Family":      ["Fig 2", "Fig 3"],
  "Productivity Confirmed": ["Fig 3"],
  "Manager":                ["Fig 2"],
}
const NHE_FILTER_AFFECTS: Record<string, string[]> = {
  "Delivery Unit":     ["Fig 1", "Fig 2", "Fig 3", "Fig 4"],
  "Role / Job Family": ["Fig 1", "Fig 2", "Fig 3", "Fig 4"],
  "Location":          ["Fig 1", "Fig 2", "Fig 3", "Fig 4"],
  "Manager":           ["Fig 1", "Fig 2", "Fig 3", "Fig 4"],
}
const TCR_FILTER_AFFECTS: Record<string, string[]> = {
  "Cohort":              ["Fig 1", "Fig 2"],
  "Role / Job Family":   ["Fig 2", "Fig 3"],
  "Training Modality":   ["Fig 3"],
  "Completion Deadline": ["Fig 1", "Fig 2"],
}
const LL60_FILTER_AFFECTS: Record<string, string[]> = {
  "Session Date":        ["Fig 1", "Fig 2", "Fig 3", "Fig 4", "Fig 5"],
  "Delivery Unit":       ["Fig 1", "Fig 2", "Fig 3", "Fig 4", "Fig 5"],
  "Session Type":        ["Fig 1", "Fig 2", "Fig 3", "Fig 4", "Fig 5"],
  "Work Arrangement":    ["Fig 1", "Fig 2", "Fig 3", "Fig 4", "Fig 5"],
  "Hire Period":         ["Fig 1", "Fig 2", "Fig 3", "Fig 4", "Fig 5"],
  "Retention Risk":      ["Fig 3", "Fig 5"],
}

// ─── Helpers ─────────────────────────────────────────────
const toNum = (v?: number | string): number => Number(v || 0)
const uniq = (arr: (string | undefined)[]): string[] =>
  [...new Set(arr.filter((v): v is string => !!v))].sort()
const avgArr = (nums: number[]): number =>
  nums.length ? Number((nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1)) : 0
const pct = (num: number, den: number): number =>
  den ? Number(((num / den) * 100).toFixed(1)) : 0

const MONTH_LABELS: Record<string, string> = {
  "01": "January", "02": "February", "03": "March", "04": "April",
  "05": "May", "06": "June", "07": "July", "08": "August",
  "09": "September", "10": "October", "11": "November", "12": "December",
}

// findVal: robust key lookup with en-dash/hyphen swap + partial word match
function findVal(r: Record<string, string | number | undefined>, ...candidates: string[]): string {
  for (const c of candidates) {
    const norm = c.trim().toLowerCase()
    if (r[norm] !== undefined) return (r[norm] ?? "").toString()
    const swapped = norm.includes("–") ? norm.replace(/–/g, "-") : norm.replace(/-/g, "–")
    if (r[swapped] !== undefined) return (r[swapped] ?? "").toString()
    const words = norm.split(/\s+/).filter(w => w.length > 2)
    const hit = Object.entries(r).find(([k]) => words.every(w => k.includes(w)))
    if (hit) return (hit[1] ?? "").toString()
  }
  return ""
}

function excelSerialToYM(val: unknown): string {
  const n = Number(val)
  if (!isNaN(n) && n > 40000) {
    // Excel serial → JS date
    const date = new Date(Math.round((n - 25569) * 86400 * 1000))
    return date.toISOString().slice(0, 7)
  }
  return String(val ?? "").slice(0, 7)
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
      No <strong>{label}</strong> data uploaded yet.<br />Go to the Onboarding dashboard and upload a file first.
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

// ─── Month-Range Filter Bar ───────────────────────────────
function MonthRangeFilterBar({ filterKeys, affectsMap, years, allMonths, filterType, filterValue, selectedYear, monthFrom, monthTo, onFilterType, onFilterValue, onYear, onMonthFrom, onMonthTo, onClear, accent, valueOptions }: {
  filterKeys: string[]; affectsMap: Record<string, string[]>; years: string[]; allMonths: string[]
  filterType: string; filterValue: string; selectedYear: string; monthFrom: string; monthTo: string
  onFilterType: (v: string) => void; onFilterValue: (v: string) => void; onYear: (v: string) => void
  onMonthFrom: (v: string) => void; onMonthTo: (v: string) => void; onClear: () => void
  accent: string; valueOptions: string[]
}) {
  const affects = filterType ? affectsMap[filterType] ?? [] : []
  const usingRange = !!(monthFrom || monthTo)
  const hasActive = !!(filterType || selectedYear || usingRange)
  const CHEVRON = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2.5'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`
  const sel = (active: boolean, w = 200): React.CSSProperties => ({
    padding: "9px 36px 9px 14px", borderRadius: 10, fontSize: 13, fontWeight: 600,
    border: active ? `1.5px solid ${accent}` : "1.5px solid #e2e8f0",
    backgroundColor: active ? accent + "08" : "#fff", backgroundImage: CHEVRON,
    backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center", backgroundSize: "12px 12px",
    color: active ? accent : "#64748b", cursor: "pointer", outline: "none", minWidth: w,
    boxShadow: active ? `0 0 0 3px ${accent}15` : "none", transition: "border .15s, box-shadow .15s, color .15s",
    appearance: "none" as const, WebkitAppearance: "none" as const,
  })
  const lbl = (txt: string) => <label style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" as const, letterSpacing: ".06em" }}>{txt}</label>
  const filteredMonths = selectedYear
    ? allMonths.filter(ym => ym.startsWith(selectedYear))
    : allMonths
  const monthOpts = filteredMonths.map(ym => { const [, m] = ym.split("-"); return { value: ym, label: MONTH_LABELS[m] ?? m } })
  const toOpts = monthFrom ? monthOpts.filter(o => o.value >= monthFrom) : monthOpts
  const fromOpts = monthTo ? monthOpts.filter(o => o.value <= monthTo) : monthOpts
  const activeRangeLabel = () => {
    if (!monthFrom && !monthTo) return null
    const toMonth = (ym: string) => MONTH_LABELS[ym.split("-")[1]] ?? ym.split("-")[1]
    const fLabel = monthFrom ? toMonth(monthFrom) : "Start"
    const tLabel = monthTo ? toMonth(monthTo) : "Latest"
    return `${fLabel} → ${tLabel}`
  }
  return (
    <Card style={{ padding: "20px 24px" }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {lbl("Filter By")}
          <select value={filterType} onChange={e => { onFilterType(e.target.value); onFilterValue("") }} style={sel(!!filterType)}>
            <option value="">— Select filter —</option>
            {filterKeys.map(k => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>
        {years.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {lbl("Year")}
            <select value={selectedYear} onChange={e => onYear(e.target.value)} style={sel(!!selectedYear, 160)}>
              <option value="">All Years</option>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        )}
        {filterType && valueOptions.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {lbl(filterType)}
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
              {affects.map(fig => <span key={fig} style={{ fontSize: 11, fontWeight: 700, background: accent + "15", color: accent, border: `1px solid ${accent}30`, borderRadius: 6, padding: "3px 10px" }}>{fig}</span>)}
            </div>
          )}
          {hasActive && <button onClick={onClear} style={{ padding: "8px 14px", borderRadius: 8, fontSize: 11, fontWeight: 700, border: "1px solid #e2e8f0", background: "#f8fafc", color: "#94a3b8", cursor: "pointer", whiteSpace: "nowrap" }}>✕ Clear</button>}
        </div>
      </div>
      {allMonths.length > 0 && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid #f1f5f9", display: "flex", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 2, alignSelf: "center" }}>📅 Month Range</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {lbl("From")}
            <select value={monthFrom} onChange={e => { onMonthFrom(e.target.value) }} style={sel(!!monthFrom, 190)}>
              <option value="">Earliest</option>
              {fromOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div style={{ alignSelf: "flex-end", paddingBottom: 10, color: "#cbd5e1", fontSize: 18, fontWeight: 300 }}>→</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {lbl("To")}
            <select value={monthTo} onChange={e => { onMonthTo(e.target.value) }} style={sel(!!monthTo, 190)}>
              <option value="">Latest</option>
              {toOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          {usingRange && (
            <div style={{ alignSelf: "flex-end", paddingBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, background: accent + "12", color: accent, border: `1px solid ${accent}25`, borderRadius: 20, padding: "4px 12px" }}>📅 {activeRangeLabel()}</span>
            </div>
          )}
        </div>
      )}
      {(filterType || selectedYear || usingRange) && (
        <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid #f1f5f9", fontSize: 12, color: "#64748b", display: "flex", gap: 6, flexWrap: "wrap" }}>
          {selectedYear && !usingRange && <span style={{ background: "#f1f5f9", borderRadius: 6, padding: "2px 8px" }}>Year: <strong>{selectedYear}</strong></span>}
          {usingRange && <span style={{ background: "#f1f5f9", borderRadius: 6, padding: "2px 8px" }}>Date range: <strong>{activeRangeLabel()}</strong></span>}
          {filterType && <span style={{ background: "#f1f5f9", borderRadius: 6, padding: "2px 8px" }}>{filterType}: <strong>{filterValue || "All"}</strong></span>}
        </div>
      )}
    </Card>
  )
}

// ─── Simple Filter Bar ────────────────────────────────────
function SimpleFilterBar({ filterKeys, affectsMap, filterType, filterValue, onFilterType, onFilterValue, onClear, accent, valueOptions }: {
  filterKeys: string[]; affectsMap: Record<string, string[]>
  filterType: string; filterValue: string
  onFilterType: (v: string) => void; onFilterValue: (v: string) => void
  onClear: () => void; accent: string; valueOptions: string[]
}) {
  const affects = filterType ? affectsMap[filterType] ?? [] : []
  const CHEVRON = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2.5'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`
  const sel = (active: boolean): React.CSSProperties => ({
    padding: "9px 36px 9px 14px", borderRadius: 10, fontSize: 13, fontWeight: 600,
    border: active ? `1.5px solid ${accent}` : "1.5px solid #e2e8f0",
    backgroundColor: active ? accent + "08" : "#fff", backgroundImage: CHEVRON,
    backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center", backgroundSize: "12px 12px",
    color: active ? accent : "#64748b", cursor: "pointer", outline: "none", minWidth: 200,
    boxShadow: active ? `0 0 0 3px ${accent}15` : "none", transition: "border .15s, box-shadow .15s, color .15s",
    appearance: "none" as const, WebkitAppearance: "none" as const,
  })
  const lbl = (txt: string) => <label style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" as const, letterSpacing: ".06em" }}>{txt}</label>
  return (
    <Card style={{ padding: "20px 24px" }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {lbl("Filter By")}
          <select value={filterType} onChange={e => { onFilterType(e.target.value); onFilterValue("") }} style={sel(!!filterType)}>
            <option value="">— Select filter —</option>
            {filterKeys.map(k => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>
        {filterType && valueOptions.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {lbl(filterType)}
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
              {affects.map(fig => <span key={fig} style={{ fontSize: 11, fontWeight: 700, background: accent + "15", color: accent, border: `1px solid ${accent}30`, borderRadius: 6, padding: "3px 10px" }}>{fig}</span>)}
            </div>
          )}
          {filterType && <button onClick={onClear} style={{ padding: "8px 14px", borderRadius: 8, fontSize: 11, fontWeight: 700, border: "1px solid #e2e8f0", background: "#f8fafc", color: "#94a3b8", cursor: "pointer", whiteSpace: "nowrap" }}>✕ Clear</button>}
        </div>
      </div>
      {filterType && (
        <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid #f1f5f9", fontSize: 12, color: "#64748b", display: "flex", gap: 6, flexWrap: "wrap" }}>
          <span style={{ background: "#f1f5f9", borderRadius: 6, padding: "2px 8px" }}>{filterType}: <strong>{filterValue || "All"}</strong></span>
        </div>
      )}
    </Card>
  )
}

// ─── LaunchLens30 scoring helper ──────────────────────────
function calcCategoryStats(rows: NheRawRow[]) {
  const result: Record<string, { label: string; avgPct: number; promoterPct: number; count: number }> = {}
  LL_CATEGORIES.forEach(cat => {
    const avgKey = `ave_${cat.id}`
    let totalPct = 0; let count = 0; let promoters = 0
    rows.forEach(r => {
      const score = Number(r[avgKey])
      if (isNaN(score) || score === 0) return
      count++
      if (cat.isOOE) { if (score === 5) promoters++; totalPct += ((score - 1) / 4) * 100 }
      else           { if (score === 4) promoters++; totalPct += ((score - 1) / 3) * 100 }
    })
    if (count > 0) result[cat.id] = { label: cat.label, avgPct: Number((totalPct / count).toFixed(1)), promoterPct: Math.round((promoters / count) * 100), count }
  })
  return result

}

// ─── LL60 signal parsing helper ───────────────────────────
function parseSignal(raw: string): "positive" | "neutral" | "negative" {
  const v = raw.trim().toLowerCase()
  if (v.includes("positive")) return "positive"
  if (v.includes("negative") || v.includes("risk signal")) return "negative"
  return "neutral"
}

// ═══════════════════════════════════════════════════════════
//  MAIN
// ═══════════════════════════════════════════════════════════
export default function OnboardingReportsPage() {
  const [activeTab, setActiveTab] = useState<"ttp" | "nhe" | "ll60" | "tcr">("ttp")
  const [summaryMetrics, setSummaryMetrics] = useState<MetricData[]>([])

  const [ttpRows,    setTtpRows]    = useState<TtpRawRow[]>([])
  const [nheRawRows, setNheRawRows] = useState<NheRawRow[]>([])
  const [ll60Rows,   setLl60Rows]   = useState<Ll60RawRow[]>([])
  const [tcrRows,    setTcrRows]    = useState<TcrRawRow[]>([])

  // TTP filters
  const [ttpFilterType,  setTtpFilterType]  = useState("")
  const [ttpFilterValue, setTtpFilterValue] = useState("")
  const [ttpYear,        setTtpYear]        = useState("")
  const [ttpMonthFrom,   setTtpMonthFrom]   = useState("")
  const [ttpMonthTo,     setTtpMonthTo]     = useState("")

  // NHE filters
  const [nheFilterType,  setNheFilterType]  = useState("")
  const [nheFilterValue, setNheFilterValue] = useState("")
  const [nheYear,      setNheYear]      = useState("")
  const [nheMonthFrom, setNheMonthFrom] = useState("")
  const [nheMonthTo,   setNheMonthTo]   = useState("")
 
  // LL60 filters
  const [ll60FilterType,  setLl60FilterType]  = useState("")
  const [ll60FilterValue, setLl60FilterValue] = useState("")
  const [ll60Year,      setLl60Year]      = useState("")
  const [ll60MonthFrom, setLl60MonthFrom] = useState("")
  const [ll60MonthTo,   setLl60MonthTo]   = useState("")

  // TCR filters
  const [tcrFilterType,  setTcrFilterType]  = useState("")
  const [tcrFilterValue, setTcrFilterValue] = useState("")
  const [tcrYear,        setTcrYear]        = useState("")


  useEffect(() => {
    const ob = localStorage.getItem("obMetricsData")
    if (ob) {
      const d = JSON.parse(ob)
      const arr: MetricData[] = []
      if (d.ttp?.loaded)  arr.push({ metric: "Avg. Time to Productivity", value: d.ttp.avgDays ?? 0,           unit: " days", accent: "#10b981", sub: `${d.ttp.confirmed} of ${d.ttp.total} confirmed` })
      if (d.nhe?.loaded)  arr.push({ metric: "30-Day Exp. Favorability",  value: d.nhe.favorability ?? 0,      unit: "%",     accent: "#8b5cf6", sub: `${d.nhe.responses} responses` })
      if (d.ll60?.loaded) arr.push({ metric: "60-Day Positive Signal",    value: d.ll60.overallPositivity ?? 0, unit: "%",     accent: "#10b981", sub: `${d.ll60.sessionCount} sessions · ${d.ll60.participantCount} participants` })
      if (d.tcr?.loaded)  arr.push({ metric: "Training Completion Rate",  value: d.tcr.rate ?? 0,              unit: "%",     accent: "#06b6d4", sub: `${d.tcr.completed} of ${d.tcr.enrolled} enrolled` })
      setSummaryMetrics(arr)
    }
    setTtpRows(JSON.parse(localStorage.getItem("ttpRawRows") || "[]"))
    setNheRawRows(JSON.parse(localStorage.getItem("nheRawRows") || "[]"))
    setLl60Rows(JSON.parse(localStorage.getItem("ll60RawRows") || "[]"))
    setTcrRows(JSON.parse(localStorage.getItem("tcrRawRows") || "[]"))
  }, [])

  const ttpLoaded  = summaryMetrics.some(m => m.metric === "Avg. Time to Productivity")
  const nheLoaded  = summaryMetrics.some(m => m.metric === "30-Day Exp. Favorability")
  const ll60Loaded = summaryMetrics.some(m => m.metric === "60-Day Positive Signal")
  const tcrLoaded  = summaryMetrics.some(m => m.metric === "Training Completion Rate")

  // ─── Dynamic column keys ──────────────────────────────────
  const ttpKey       = useMemo(() => { if (!ttpRows.length) return ""; return Object.keys(ttpRows[0]).find(k => k.includes("time to productivity") && k.includes("days")) ?? "" }, [ttpRows])
  const confirmedKey = useMemo(() => { if (!ttpRows.length) return "productivity confirmed"; return Object.keys(ttpRows[0]).find(k => k.startsWith("productivity confirmed")) ?? "productivity confirmed" }, [ttpRows])
  const tcrEnrollKey    = useMemo(() => { if (!tcrRows.length) return ""; return Object.keys(tcrRows[0]).find(k => k.includes("enrolled in required training")) ?? "" }, [tcrRows])
  const tcrCompletedKey = useMemo(() => { if (!tcrRows.length) return ""; return Object.keys(tcrRows[0]).find(k => k.includes("completed all required training")) ?? "" }, [tcrRows])

  // ═══════ TTP ═══════
  const ttpAllMonths   = useMemo(() => uniq(ttpRows.map(r => (r["start date"] as string | undefined)?.slice(0, 7)).filter(Boolean)), [ttpRows])
  const ttpYears       = useMemo(() => uniq(ttpRows.map(r => (r["start date"] as string | undefined)?.slice(0, 4))), [ttpRows])
  const ttpVisibleFigs = useMemo(() => ttpFilterType ? TTP_FILTER_AFFECTS[ttpFilterType] ?? [] : ["Fig 1", "Fig 2", "Fig 3"], [ttpFilterType])

  const ttpValueOptions = useMemo((): string[] => {
    switch (ttpFilterType) {
      case "Onboarding Cohort":      return uniq(ttpRows.map(r => (r["start date"] as string | undefined)?.slice(0, 7)))
      case "Delivery Unit":          return uniq(ttpRows.map(r => r["delivery unit"] as string | undefined))
      case "Role / Job Family":      return uniq(ttpRows.map(r => r["role / job family"] as string | undefined))
      case "Productivity Confirmed": return ["Yes", "Not yet"]
      case "Manager":                return uniq(ttpRows.map(r => r["confirmed by"] as string | undefined))
      default: return []
    }
  }, [ttpFilterType, ttpRows])

  const ttpYearFiltered = useMemo(() => {
    let rows = ttpRows
    if (ttpMonthFrom || ttpMonthTo) {
      rows = rows.filter(r => { const ym = (r["start date"] as string | undefined)?.slice(0, 7) ?? ""; if (!ym) return false; if (ttpMonthFrom && ym < ttpMonthFrom) return false; if (ttpMonthTo && ym > ttpMonthTo) return false; return true })
    } else if (ttpYear) {
      rows = rows.filter(r => (r["start date"] as string | undefined)?.startsWith(ttpYear))
    }
    return rows
  }, [ttpRows, ttpYear, ttpMonthFrom, ttpMonthTo])

  const ttpFiltered = useMemo(() => {
    if (!ttpFilterType || !ttpFilterValue) return ttpYearFiltered
    return ttpYearFiltered.filter(r => {
      switch (ttpFilterType) {
        case "Onboarding Cohort":      return (r["start date"] as string | undefined)?.startsWith(ttpFilterValue)
        case "Delivery Unit":          return r["delivery unit"] === ttpFilterValue
        case "Role / Job Family":      return r["role / job family"] === ttpFilterValue
        case "Productivity Confirmed": return (r[confirmedKey] as string || "").trim().toLowerCase() === ttpFilterValue.toLowerCase()
        case "Manager":                return r["confirmed by"] === ttpFilterValue
        default: return true
      }
    })
  }, [ttpYearFiltered, ttpFilterType, ttpFilterValue, confirmedKey])

  const ttpFig1 = useMemo(() => {
    const map: Record<string, number[]> = {}
    ttpFiltered.forEach(r => { const cohort = (r["start date"] as string | undefined)?.slice(0, 7) ?? "Unknown"; const days = toNum(r[ttpKey]); const conf = (r[confirmedKey] as string || "").trim().toLowerCase(); if (conf === "yes" && days > 0) { if (!map[cohort]) map[cohort] = []; map[cohort].push(days) } })
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([cohort, days]) => ({ cohort, avg: avgArr(days) }))
  }, [ttpFiltered, ttpKey, confirmedKey])

  const ttpFig2 = useMemo(() => {
    const map: Record<string, number[]> = {}
    ttpFiltered.forEach(r => { const role = (r["role / job family"] as string | undefined)?.trim() ?? "Unknown"; const days = toNum(r[ttpKey]); const conf = (r[confirmedKey] as string || "").trim().toLowerCase(); if (conf === "yes" && days > 0) { if (!map[role]) map[role] = []; map[role].push(days) } })
    return Object.entries(map).map(([role, days]) => ({ role, avg: avgArr(days) }))
  }, [ttpFiltered, ttpKey, confirmedKey])

  const ttpFig3 = useMemo(() => {
    const confirmed = ttpFiltered.filter(r => (r[confirmedKey] as string || "").trim().toLowerCase() === "yes").length
    return [{ name: "Productive", value: confirmed, color: "#10b981" }, { name: "Not Yet", value: ttpFiltered.length - confirmed, color: "#e2e8f0" }].filter(d => d.value > 0)
  }, [ttpFiltered, confirmedKey])

  const ttpHeadline = useMemo(() => {
    const confirmed = ttpFiltered.filter(r => (r[confirmedKey] as string || "").trim().toLowerCase() === "yes")
    const days = confirmed.map(r => toNum(r[ttpKey])).filter(d => d > 0)
    const sorted = [...days].sort((a, b) => a - b)
    const median = sorted.length ? (sorted.length % 2 === 0 ? (sorted[sorted.length/2-1]+sorted[sorted.length/2])/2 : sorted[Math.floor(sorted.length/2)]) : 0
    return { avg: avgArr(days), median: Number(median.toFixed(1)), confirmed: confirmed.length, total: ttpFiltered.length, confirmRate: ttpFiltered.length ? pct(confirmed.length, ttpFiltered.length) : 0 }
  }, [ttpFiltered, ttpKey, confirmedKey])

  const ttpC = (d: number) => d <= 30 ? "#22c55e" : d <= 60 ? "#22c55e" : "#ef4444"

  // ═══════ NHE ═══════
  const nheColKeys         = useMemo(() => nheRawRows.length ? Object.keys(nheRawRows[0]) : [], [nheRawRows])
  const nheDeliveryUnitKey = useMemo(() => nheColKeys.find(k => k.includes("delivery unit")) ?? "", [nheColKeys])
  const nheRoleKey         = useMemo(() => nheColKeys.find(k => (k.includes("role") || k.includes("job family")) && !k.startsWith("ave_")) ?? "", [nheColKeys])
  const nheLocationKey     = useMemo(() => nheColKeys.find(k => k.includes("location")) ?? "", [nheColKeys])
  const nheManagerKey      = useMemo(() => nheColKeys.find(k => k.includes("manager") && !k.startsWith("ave_")) ?? "", [nheColKeys])
  const nheDateKey = useMemo(() => 
  nheColKeys.find(k => k.includes("response") && k.includes("date")) ?? 
  nheColKeys.find(k => k === "date") ?? 
  nheColKeys.find(k => k.includes("date")) ?? ""
, [nheColKeys])
  const nheAllMonths = useMemo(() => 
  uniq(nheRawRows.map(r => nheDateKey ? excelSerialToYM(r[nheDateKey]) : "").filter(Boolean))
, [nheRawRows, nheDateKey])
const nheYears = useMemo(() => 
  uniq(nheRawRows.map(r => nheDateKey ? excelSerialToYM(r[nheDateKey]).slice(0, 4) : "").filter(Boolean))
, [nheRawRows, nheDateKey])

  const nheAvailableFilterKeys = useMemo(() => {
    const keys: string[] = []
    if (nheDeliveryUnitKey) keys.push("Delivery Unit")
    if (nheRoleKey)         keys.push("Role / Job Family")
    if (nheLocationKey)     keys.push("Location")
    if (nheManagerKey)      keys.push("Manager")
    return keys
  }, [nheDeliveryUnitKey, nheRoleKey, nheLocationKey, nheManagerKey])

  const nheValueOptions = useMemo((): string[] => {
    switch (nheFilterType) {
      case "Delivery Unit":     return nheDeliveryUnitKey ? uniq(nheRawRows.map(r => r[nheDeliveryUnitKey] as string | undefined)) : []
      case "Role / Job Family": return nheRoleKey         ? uniq(nheRawRows.map(r => r[nheRoleKey]         as string | undefined)) : []
      case "Location":          return nheLocationKey     ? uniq(nheRawRows.map(r => r[nheLocationKey]     as string | undefined)) : []
      case "Manager":           return nheManagerKey      ? uniq(nheRawRows.map(r => r[nheManagerKey]      as string | undefined)) : []
      default: return []
    }
  }, [nheFilterType, nheRawRows, nheDeliveryUnitKey, nheRoleKey, nheLocationKey, nheManagerKey])

  const nheVisibleFigs = useMemo(() => nheFilterType ? NHE_FILTER_AFFECTS[nheFilterType] ?? [] : ["Fig 1", "Fig 2", "Fig 3", "Fig 4"], [nheFilterType])

  const nheFiltered = useMemo(() => {
    let base = nheRawRows
    if (nheDateKey) {
      if (nheMonthFrom || nheMonthTo) {
        base = base.filter(r => {
const ym = excelSerialToYM(r[nheDateKey])
          if (!ym) return false
          if (nheMonthFrom && ym < nheMonthFrom) return false
          if (nheMonthTo   && ym > nheMonthTo)   return false
          return true
        })
      } else if (nheYear) {
        base = base.filter(r => (r[nheDateKey] as string || "").startsWith(nheYear))
      }
    }
    if (!nheFilterType || !nheFilterValue) return base
    return base.filter(r => {
      switch (nheFilterType) {
        case "Delivery Unit":     return nheDeliveryUnitKey ? (r[nheDeliveryUnitKey] as string || "") === nheFilterValue : true
        case "Role / Job Family": return nheRoleKey         ? (r[nheRoleKey]         as string || "") === nheFilterValue : true
        case "Location":          return nheLocationKey     ? (r[nheLocationKey]     as string || "") === nheFilterValue : true
        case "Manager":           return nheManagerKey      ? (r[nheManagerKey]      as string || "") === nheFilterValue : true
        default: return true
      }
    })
}, [nheRawRows, nheFilterType, nheFilterValue, nheDeliveryUnitKey, nheRoleKey, nheLocationKey, nheManagerKey, nheDateKey, nheYear, nheMonthFrom, nheMonthTo])
  const nheCategoryStats = useMemo(() => calcCategoryStats(nheFiltered), [nheFiltered])
  const nheFig1 = useMemo(() =>
    LL_CATEGORIES.filter(c => nheCategoryStats[c.id]).map(c => ({
      label: nheCategoryStats[c.id].label,
      favorability: nheCategoryStats[c.id].avgPct,
      promoter: nheCategoryStats[c.id].promoterPct,
      id: c.id,
    })).sort((a, b) => b.favorability - a.favorability)
  , [nheCategoryStats])

  const nheFig3 = useMemo(() =>
    LL_CATEGORIES.filter(c => nheCategoryStats[c.id]).map(c => ({
      subject: c.label.split(" ").slice(0, 2).join(" "),
      fullLabel: c.label,
      value: nheCategoryStats[c.id].avgPct,
      fullMark: 100,
    }))
  , [nheCategoryStats])

  const nheFig4 = useMemo(() => ({
    strengths: nheFig1.slice(0, 3),
    risks:     nheFig1.slice(-3).reverse(),
  }), [nheFig1])

  const nheHeadline = useMemo(() => {
    const vals = Object.values(nheCategoryStats).map(c => c.avgPct)
    return { overall: vals.length ? avgArr(vals) : 0, responses: nheFiltered.length, topCategory: nheFig1[0] ?? null, bottomCategory: nheFig1[nheFig1.length - 1] ?? null }
  }, [nheCategoryStats, nheFiltered, nheFig1])

const nheC = (v: number, isLowest: boolean) => isLowest ? "#ef4444" : "#22c55e"

  // ═══════ LL60 ═══════
  const ll60FilterOptions = useMemo((): Record<string, string[]> => ({
    "Session Date":     uniq(ll60Rows.map(r => findVal(r as any, "session date").slice(0, 7)).filter(Boolean)),
    "Delivery Unit":    uniq(ll60Rows.map(r => findVal(r as any, "delivery unit")).filter(Boolean)),
    "Session Type":     uniq(ll60Rows.map(r => findVal(r as any, "session type")).filter(Boolean)),
    "Work Arrangement": uniq(ll60Rows.map(r => findVal(r as any, "location / work arrangement")).filter(Boolean)),
    "Hire Period":      uniq(ll60Rows.map(r => findVal(r as any, "cycle / hire period")).filter(Boolean)),
    "Retention Risk":   ["Low", "Medium", "High"],
  }), [ll60Rows])

  const ll60ValueOptions = useMemo(() => ll60FilterOptions[ll60FilterType] ?? [], [ll60FilterOptions, ll60FilterType])
  
  const ll60AllMonths = useMemo(() => 
  uniq(ll60Rows.map(r => findVal(r as any, "session date").slice(0, 7)).filter(Boolean))
, [ll60Rows])

const ll60Years = useMemo(() => 
  uniq(ll60Rows.map(r => findVal(r as any, "session date").slice(0, 4)).filter(Boolean))
, [ll60Rows])

  const ll60VisibleFigs  = useMemo(() => ll60FilterType ? LL60_FILTER_AFFECTS[ll60FilterType] ?? [] : ["Fig 1", "Fig 2", "Fig 3", "Fig 4", "Fig 5"], [ll60FilterType])

  const ll60Filtered = useMemo(() => {
  let rows = ll60Rows

  // Month range / year filter
  if (ll60MonthFrom || ll60MonthTo) {
    rows = rows.filter(r => {
      const ym = findVal(r as any, "session date").slice(0, 7)
      if (!ym) return false
      if (ll60MonthFrom && ym < ll60MonthFrom) return false
      if (ll60MonthTo   && ym > ll60MonthTo)   return false
      return true
    })
  } else if (ll60Year) {
    rows = rows.filter(r => findVal(r as any, "session date").startsWith(ll60Year))
  }

  // Existing filter logic
  if (!ll60FilterType || !ll60FilterValue) return rows
  return rows.filter(r => {
    const rv = ll60FilterValue.toLowerCase()
    switch (ll60FilterType) {
      case "Session Date":     return findVal(r as any, "session date").startsWith(ll60FilterValue)
      case "Delivery Unit":    return findVal(r as any, "delivery unit").toLowerCase() === rv
      case "Session Type":     return findVal(r as any, "session type").toLowerCase() === rv
      case "Work Arrangement": return findVal(r as any, "location / work arrangement").toLowerCase() === rv
      case "Hire Period":      return findVal(r as any, "cycle / hire period").toLowerCase() === rv
      case "Retention Risk":   return findVal(r as any, "overall retention risk").toLowerCase() === rv
      default: return true
    }
  })
}, [ll60Rows, ll60FilterType, ll60FilterValue, ll60Year, ll60MonthFrom, ll60MonthTo])

  // Headline stats
  const ll60Headline = useMemo(() => {
    let totalRating = 0; let ratingCount = 0
    let totalRec = 0; let recCount = 0
    let totalParticipants = 0
    const riskCounts = { low: 0, medium: 0, high: 0 }
    ll60Filtered.forEach(r => {
      const pc = Number(findVal(r as any, "participant count") || 0)
      if (!isNaN(pc)) totalParticipants += pc
      const rating = Number(findVal(r as any, "avg journey rating (1–5)", "avg journey rating (1-5)", "avg journey rating"))
      if (!isNaN(rating) && rating >= 1) { totalRating += rating; ratingCount++ }
      const rec = Number(findVal(r as any, "recommend % (yes)", "recommend % yes", "recommend %"))
      if (!isNaN(rec)) { totalRec += rec; recCount++ }
      const risk = findVal(r as any, "overall retention risk").trim().toLowerCase()
      if (risk === "low") riskCounts.low++
      else if (risk === "medium") riskCounts.medium++
      else if (risk === "high") riskCounts.high++
    })
    return {
      sessions: ll60Filtered.length,
      participants: totalParticipants,
      avgRating: ratingCount ? Number((totalRating / ratingCount).toFixed(1)) : null,
      avgRecommend: recCount ? Number((totalRec / recCount).toFixed(1)) : null,
      riskCounts,
    }
  }, [ll60Filtered])

  // Fig 1 — Signal breakdown per dimension (stacked bar)
  const ll60Fig1 = useMemo(() =>
    LL60_DIMENSIONS.map(d => {
      let pos = 0; let neu = 0; let neg = 0
      ll60Filtered.forEach(r => {
        const sig = parseSignal(findVal(r as any, d.key, d.key.replace(/ & /g, " and ")))
        if (sig === "positive") pos++
        else if (sig === "negative") neg++
        else neu++
      })
      const total = pos + neu + neg || 1
      return {
        label: d.label,
        short: d.short,
        Positive: Math.round((pos / total) * 100),
        Neutral:  Math.round((neu / total) * 100),
        Negative: Math.round((neg / total) * 100),
        posCount: pos, neuCount: neu, negCount: neg,
      }
    })
  , [ll60Filtered])

  // Fig 2 — Radar chart (positive signal % per dimension)
  const ll60Fig2 = useMemo(() =>
    LL60_DIMENSIONS.map(d => {
      let pos = 0; let total = 0
      ll60Filtered.forEach(r => {
        const sig = parseSignal(findVal(r as any, d.key, d.key.replace(/ & /g, " and ")))
        total++
        if (sig === "positive") pos++
      })
      return { subject: d.short, value: total ? Math.round((pos / total) * 100) : 0, fullMark: 100 }
    })
  , [ll60Filtered])

  // Fig 3 — Retention risk pie
  const ll60Fig3 = useMemo(() => [
    { name: "Low Risk",    value: ll60Headline.riskCounts.low,    color: "#22c55e" },

    { name: "High Risk",   value: ll60Headline.riskCounts.high,   color: "#ef4444" },
  ].filter(d => d.value > 0), [ll60Headline])

  // Fig 4 — Signal trend by session date (line chart — positive signal rate over time)
  const ll60Fig4 = useMemo(() => {
    const map: Record<string, { pos: number; total: number }> = {}
    ll60Filtered.forEach(r => {
      const date = findVal(r as any, "session date").slice(0, 7)
      if (!date) return
      if (!map[date]) map[date] = { pos: 0, total: 0 }
      LL60_DIMENSIONS.forEach(d => {
        const sig = parseSignal(findVal(r as any, d.key, d.key.replace(/ & /g, " and ")))
        map[date].total++
        if (sig === "positive") map[date].pos++
      })
    })
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([date, v]) => ({
      date,
      "Positive Signal %": v.total ? Math.round((v.pos / v.total) * 100) : 0,
    }))
  }, [ll60Filtered])

  // Fig 5 — Signal breakdown by Delivery Unit (grouped bar)
  const ll60Fig5 = useMemo(() => {
    const map: Record<string, { pos: number; neu: number; neg: number }> = {}
    ll60Filtered.forEach(r => {
      const du = findVal(r as any, "delivery unit") || "Unknown"
      if (!map[du]) map[du] = { pos: 0, neu: 0, neg: 0 }
      LL60_DIMENSIONS.forEach(d => {
        const sig = parseSignal(findVal(r as any, d.key, d.key.replace(/ & /g, " and ")))
        if (sig === "positive") map[du].pos++
        else if (sig === "negative") map[du].neg++
        else map[du].neu++
      })
    })
    return Object.entries(map).map(([du, v]) => {
      const total = v.pos + v.neu + v.neg || 1
      return {
        du,
        Positive: Math.round((v.pos / total) * 100),
        Neutral:  Math.round((v.neu / total) * 100),
        Negative: Math.round((v.neg / total) * 100),
      }
    })
  }, [ll60Filtered])

  const ll60SigC = (pct: number) => pct >= 75 ? "#22c55e" : pct >= 50 ? "#10b981" : pct >= 30 ? "#10b981" : "#ef4444"

  // ═══════ TCR ═══════
  const tcrAllMonths   = useMemo(() => uniq(tcrRows.map(r => (r["cohort"] as string | undefined)?.slice(0, 7)).filter(Boolean)), [tcrRows])
  const tcrYears       = useMemo(() => uniq(tcrRows.map(r => (r["cohort"] as string | undefined)?.slice(0, 4))), [tcrRows])
  const tcrVisibleFigs = useMemo(() => tcrFilterType ? TCR_FILTER_AFFECTS[tcrFilterType] ?? [] : ["Fig 1", "Fig 2", "Fig 3"], [tcrFilterType])

  const tcrValueOptions = useMemo((): string[] => {
    switch (tcrFilterType) {
      case "Cohort":              return uniq(tcrRows.map(r => r["cohort"] as string | undefined))
      case "Role / Job Family":   return uniq(tcrRows.map(r => r["role / job family"] as string | undefined))
      case "Training Modality":   return uniq(tcrRows.map(r => r["training modality"] as string | undefined))
      case "Completion Deadline": return uniq(tcrRows.map(r => r["completion deadline"] as string | undefined))
      default: return []
    }
  }, [tcrFilterType, tcrRows])

  const tcrYearFiltered = useMemo(() => {
  let rows = tcrRows

  if (tcrYear) {
    rows = rows.filter(r =>
      (r["cohort"] as string | undefined)?.startsWith(tcrYear)
    )
  }

  return rows
}, [tcrRows, tcrYear])

  const tcrFiltered = useMemo(() => {
    if (!tcrFilterType || !tcrFilterValue) return tcrYearFiltered
    return tcrYearFiltered.filter(r => {
      switch (tcrFilterType) {
        case "Cohort":              return r["cohort"]             === tcrFilterValue
        case "Role / Job Family":   return r["role / job family"]  === tcrFilterValue
        case "Training Modality":   return r["training modality"]  === tcrFilterValue
        case "Completion Deadline": return r["completion deadline"] === tcrFilterValue
        default: return true
      }
    })
  }, [tcrYearFiltered, tcrFilterType, tcrFilterValue])

  const tcrFig1 = useMemo(() => {
    const map: Record<string, { e: number; c: number }> = {}
    tcrFiltered.forEach(r => { const k = (r["cohort"] as string | undefined) ?? "Unknown"; if (!map[k]) map[k] = { e: 0, c: 0 }; map[k].e += toNum(r[tcrEnrollKey]); map[k].c += toNum(r[tcrCompletedKey]) })
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([cohort, d]) => ({ cohort, rate: pct(d.c, d.e) }))
  }, [tcrFiltered, tcrEnrollKey, tcrCompletedKey])

  const tcrFig2 = useMemo(() => {
    const map: Record<string, { e: number; c: number }> = {}
    tcrFiltered.forEach(r => { const k = (r["role / job family"] as string | undefined)?.trim() ?? "Unknown"; if (!map[k]) map[k] = { e: 0, c: 0 }; map[k].e += toNum(r[tcrEnrollKey]); map[k].c += toNum(r[tcrCompletedKey]) })
    return Object.entries(map).map(([role, d]) => ({ role, Enrolled: d.e, Completed: d.c, rate: pct(d.c, d.e) }))
  }, [tcrFiltered, tcrEnrollKey, tcrCompletedKey])

  const tcrFig3 = useMemo(() => {
    const map: Record<string, { e: number; c: number }> = {}
    tcrFiltered.forEach(r => { const k = (r["training modality"] as string | undefined)?.trim() ?? "Unknown"; if (!map[k]) map[k] = { e: 0, c: 0 }; map[k].e += toNum(r[tcrEnrollKey]); map[k].c += toNum(r[tcrCompletedKey]) })
    return Object.entries(map).map(([modality, d]) => ({ modality, rate: pct(d.c, d.e) }))
  }, [tcrFiltered, tcrEnrollKey, tcrCompletedKey])

  const tcrHeadline = useMemo(() => {
    const enrolled  = tcrFiltered.reduce((s, r) => s + toNum(r[tcrEnrollKey]), 0)
    const completed = tcrFiltered.reduce((s, r) => s + toNum(r[tcrCompletedKey]), 0)
    return { enrolled, completed, rate: pct(completed, enrolled) }
  }, [tcrFiltered, tcrEnrollKey, tcrCompletedKey])

  const tcrC = (r: number) => r >= 90 ? "#06b6d4" : "#06b6d4"

  const TABS = [
    { key: "ttp",  label: "Time to Productivity", accent: "#10b981", loaded: ttpLoaded  },
    { key: "nhe",  label: "30-Day Experience",     accent: "#8b5cf6", loaded: nheLoaded  },
    { key: "ll60", label: "60-Day Experience",     accent: "#10b981", loaded: ll60Loaded },
    { key: "tcr",  label: "Training Completion",   accent: "#06b6d4", loaded: tcrLoaded  },
  ] as const

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "'DM Sans', sans-serif", padding: "5px 24px 60px" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap'); * { box-sizing: border-box; } select { font-family: inherit; }`}</style>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>

        {/* KPI row */}
        {summaryMetrics.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 24 }}>
            {summaryMetrics.map(m => (
              <Card key={m.metric} style={{ padding: "16px 20px" }}>
                <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6 }}>{m.metric}</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                  <span style={{ fontSize: 30, fontWeight: 800, color: m.accent, lineHeight: 1 }}>{m.value}</span>
                  <span style={{ fontSize: 12, color: m.accent + "99", fontWeight: 600 }}>{m.unit}</span>
                </div>
                {m.sub && <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 3 }}>{m.sub}</div>}
              </Card>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)} style={{ padding: "8px 20px", borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: "pointer", border: "none", transition: "all .18s", background: activeTab === t.key ? t.accent : "#fff", color: activeTab === t.key ? "#fff" : t.loaded ? "#475569" : "#cbd5e1", opacity: t.loaded ? 1 : 0.45, boxShadow: activeTab === t.key ? `0 4px 14px ${t.accent}45` : "0 1px 3px rgba(0,0,0,.06)" }}>
              {t.loaded ? "●" : "○"} {t.label}
            </button>
          ))}
        </div>

        {/* ══════════ TTP ══════════ */}
        {activeTab === "ttp" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {!ttpLoaded ? <Card><EmptyState label="Time to Productivity" /></Card> : (
              <>
                <MonthRangeFilterBar filterKeys={Object.keys(TTP_FILTER_AFFECTS)} affectsMap={TTP_FILTER_AFFECTS} years={ttpYears} allMonths={ttpAllMonths} filterType={ttpFilterType} filterValue={ttpFilterValue} selectedYear={ttpYear} monthFrom={ttpMonthFrom} monthTo={ttpMonthTo} onFilterType={setTtpFilterType} onFilterValue={setTtpFilterValue} onYear={setTtpYear} onMonthFrom={setTtpMonthFrom} onMonthTo={setTtpMonthTo} onClear={() => { setTtpFilterType(""); setTtpFilterValue(""); setTtpYear(""); setTtpMonthFrom(""); setTtpMonthTo("") }} accent="#10b981" valueOptions={ttpValueOptions} />
                <Card>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 14 }}>Time to Productivity — Summary</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
                    <StatPill label="Avg TTP"              value={`${ttpHeadline.avg} days`}     accent="#10b981" sub="Confirmed productive only" />
                    <StatPill label="Median TTP"           value={`${ttpHeadline.median} days`}  accent="#10b981" />
                    <StatPill label="Confirmed Productive" value={ttpHeadline.confirmed}          accent="#22c55e" sub={`of ${ttpHeadline.total} new hires`} />
                    <StatPill label="Confirmation Rate"    value={`${ttpHeadline.confirmRate}%`} accent="#10b981" />
                  </div>
                </Card>
                {ttpVisibleFigs.includes("Fig 1") && (
                  <FigCard fig="Fig 1" title="Average Time to Productivity by Cohort" subtitle="Line chart · ramp-up trend over hire cohorts">
                    {ttpFig1.length < 2 ? <EmptyChart msg="Need ≥2 cohorts to show trend" /> : (
                      <ResponsiveContainer width="100%" height={280}>
                        <LineChart data={ttpFig1} margin={{ top: 10, right: 30, left: 0, bottom: 10 }}>
                          <CartesianGrid strokeDasharray="4 4" stroke="#f1f5f9" />
                          <XAxis dataKey="cohort" tick={{ fill: "#94a3b8", fontSize: 12 }} />
                          <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} />
                          <Tooltip content={<CT unit=" days" />} />
                          <Line type="monotone" dataKey="avg" name="Avg TTP" stroke="#10b981" strokeWidth={2.5} dot={{ r: 5, fill: "#10b981", strokeWidth: 0 }} activeDot={{ r: 7 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    )}
                  </FigCard>
                )}
                {ttpVisibleFigs.includes("Fig 2") && (
                  <FigCard fig="Fig 2" title="Time to Productivity by Role Family" subtitle="Horizontal bar · ramp-up speed comparison across roles">
                    {ttpFig2.length === 0 ? <EmptyChart msg="No confirmed role data in current selection" /> : (
                      <>
                        <ResponsiveContainer width="100%" height={Math.max(200, ttpFig2.length * 52)}>
                          <BarChart layout="vertical" data={ttpFig2} margin={{ top: 4, right: 60, left: 10, bottom: 4 }}>
                            <CartesianGrid strokeDasharray="4 4" stroke="#f1f5f9" horizontal={false} />
                            <XAxis type="number" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                            <YAxis type="category" dataKey="role" tick={{ fill: "#475569", fontSize: 12 }} width={150} />
                            <Tooltip content={<CT unit=" days" />} />
                            <Bar dataKey="avg" name="Avg Days" radius={[0, 6, 6, 0]}>{ttpFig2.map((d, i) => <Cell key={i} fill={ttpC(d.avg)} />)}</Bar>
                          </BarChart>
                        </ResponsiveContainer>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
                          {ttpFig2.map((d, i) => <span key={i} style={{ fontSize: 11, fontWeight: 700, background: ttpC(d.avg) + "18", color: ttpC(d.avg), border: `1px solid ${ttpC(d.avg)}28`, borderRadius: 20, padding: "3px 11px" }}>{d.role}: {d.avg} days</span>)}
                        </div>
                      </>
                    )}
                  </FigCard>
                )}
                {ttpVisibleFigs.includes("Fig 3") && (
                  <FigCard fig="Fig 3" title="Productive vs. Not Yet Productive" subtitle="Donut chart · current confirmation status in selection">
                    {ttpFig3.length === 0 ? <EmptyChart msg="No data in current selection" /> : (
                      <div style={{ display: "flex", alignItems: "center", gap: 40, flexWrap: "wrap" }}>
                        <ResponsiveContainer width={240} height={240}>
                          <PieChart>
                            <Pie data={ttpFig3} cx="50%" cy="50%" innerRadius={65} outerRadius={100} dataKey="value" paddingAngle={3}>{ttpFig3.map((d, i) => <Cell key={i} fill={d.color} />)}</Pie>
                            <Tooltip formatter={(value) => [value ?? 0, "Count"]} />
                          </PieChart>
                        </ResponsiveContainer>
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                          {ttpFig3.map((d, i) => (
                            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <div style={{ width: 12, height: 12, borderRadius: 3, background: d.color, flexShrink: 0 }} />
                              <div>
                                <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{d.name}</div>
                                <div style={{ fontSize: 20, fontWeight: 800, color: d.color }}>{d.value}<span style={{ fontSize: 12, fontWeight: 600, color: "#94a3b8", marginLeft: 6 }}>({ttpFiltered.length ? pct(d.value, ttpFiltered.length) : 0}%)</span></div>
                              </div>
                            </div>
                          ))}
                          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>{ttpFiltered.length} total new hires in selection</div>
                        </div>
                      </div>
                    )}
                  </FigCard>
                )}
              </>
            )}
          </div>
        )}

        {/* ══════════ NHE ══════════ */}
        {activeTab === "nhe" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {!nheLoaded ? <Card><EmptyState label="30-Day Experience (LaunchLens30)" /></Card> : (
              <>
                {nheAvailableFilterKeys.length > 0 && (
<MonthRangeFilterBar
  filterKeys={nheAvailableFilterKeys}
  affectsMap={NHE_FILTER_AFFECTS}
  years={nheYears}
  allMonths={nheAllMonths}
  filterType={nheFilterType}
  filterValue={nheFilterValue}
  selectedYear={nheYear}
  monthFrom={nheMonthFrom}
  monthTo={nheMonthTo}
  onFilterType={setNheFilterType}
  onFilterValue={setNheFilterValue}
  onYear={setNheYear}
  onMonthFrom={setNheMonthFrom}
  onMonthTo={setNheMonthTo}
  onClear={() => { setNheFilterType(""); setNheFilterValue(""); setNheYear(""); setNheMonthFrom(""); setNheMonthTo("") }}
  accent="#8b5cf6"
  valueOptions={nheValueOptions}
/>                )}
                <Card>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 14 }}>LaunchLens 30-Day Experience — Summary</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
                    <StatPill label="Overall Favorability" value={`${nheHeadline.overall}%`}  accent="#8b5cf6" sub="Avg across all 10 categories" />
                    <StatPill label="Survey Responses"     value={nheHeadline.responses}       accent="#8b5cf6" />
                    {nheHeadline.topCategory    && <StatPill label="Top Strength"    value={nheHeadline.topCategory.label.split("&")[0].trim()}    accent="#22c55e" sub={`${nheHeadline.topCategory.favorability}% fav.`} />}
                    {nheHeadline.bottomCategory && <StatPill label="Needs Attention" value={nheHeadline.bottomCategory.label.split("&")[0].trim()} accent="#ef4444" sub={`${nheHeadline.bottomCategory.favorability}% fav.`} />}
                  </div>
                </Card>
                {nheVisibleFigs.includes("Fig 1") && (
                  <FigCard fig="Fig 1" title="Category Favorability — All 10 Dimensions" subtitle="Sorted horizontal bar · green = strong, red = needs attention">
                    {nheFig1.length === 0 ? <EmptyChart msg="No category data in current selection" /> : (
                      <ResponsiveContainer width="100%" height={Math.max(260, nheFig1.length * 48)}>
                        <BarChart layout="vertical" data={nheFig1} margin={{ top: 4, right: 80, left: 10, bottom: 4 }}>
                          <CartesianGrid strokeDasharray="4 4" stroke="#f1f5f9" horizontal={false} />
                          <XAxis type="number" domain={[0, 100]} tick={{ fill: "#94a3b8", fontSize: 11 }} unit="%" />
                          <YAxis type="category" dataKey="label" tick={{ fill: "#475569", fontSize: 11 }} width={200} />
                          <Tooltip content={<CT unit="%" />} />
                          <Bar dataKey="favorability" name="Favorability %" radius={[0, 6, 6, 0]}>{nheFig1.map((d, i) => <Cell key={i} fill={nheC(d.favorability, i === nheFig1.length - 1)} />)}</Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </FigCard>
                )}
                {nheVisibleFigs.includes("Fig 2") && (
                  <FigCard fig="Fig 2" title="Favorability % vs. Promoter % by Category" subtitle="Clustered bar · identifies categories with high favorability but low promoter rate">
                    {nheFig1.length === 0 ? <EmptyChart msg="No data in current selection" /> : (
                      <ResponsiveContainer width="100%" height={Math.max(280, nheFig1.length * 52)}>
                        <BarChart layout="vertical" data={nheFig1} margin={{ top: 4, right: 30, left: 10, bottom: 4 }}>
                          <CartesianGrid strokeDasharray="4 4" stroke="#f1f5f9" horizontal={false} />
                          <XAxis type="number" domain={[0, 100]} tick={{ fill: "#94a3b8", fontSize: 11 }} unit="%" />
                          <YAxis type="category" dataKey="label" tick={{ fill: "#475569", fontSize: 11 }} width={200} />
                          <Tooltip content={<CT unit="%" />} />
                          <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                          <Bar dataKey="favorability" name="Favorability %" fill="#8b5cf6" fillOpacity={0.85} radius={[0, 4, 4, 0]} />
                          <Bar dataKey="promoter"     name="Promoter %"     fill="#22c55e" fillOpacity={0.75} radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </FigCard>
                )}
                {nheVisibleFigs.includes("Fig 3") && (
                  <FigCard fig="Fig 3 " title="Top Strengths & Lowest Areas" subtitle="Focus panel · what to sustain vs. what needs attention">
                    {nheFig1.length === 0 ? <EmptyChart msg="No data in current selection" /> : (
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: "#22c55e", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 12 }}>🟢 Top Strengths</div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                            {nheFig4.strengths.map((d, i) => (
                              <div key={i} style={{ padding: "12px 14px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, borderLeft: "3px solid #22c55e" }}>
                                <div style={{ fontSize: 12, fontWeight: 700, color: "#15803d", marginBottom: 4 }}>{d.label}</div>
                                <div style={{ display: "flex", gap: 12, alignItems: "baseline" }}>
                                  <span style={{ fontSize: 20, fontWeight: 800, color: "#22c55e" }}>{d.favorability}%</span>
                                  <span style={{ fontSize: 11, color: "#94a3b8" }}>Fav · {d.promoter}% Promoter</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: "#ef4444", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 12 }}>🔴 Lowest Areas</div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                            {nheFig4.risks.map((d, i) => (
                              <div key={i} style={{ padding: "12px 14px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, borderLeft: "3px solid #ef4444" }}>
                                <div style={{ fontSize: 12, fontWeight: 700, color: "#b91c1c", marginBottom: 4 }}>{d.label}</div>
                                <div style={{ display: "flex", gap: 12, alignItems: "baseline" }}>
                                  <span style={{ fontSize: 20, fontWeight: 800, color: "#ef4444" }}>{d.favorability}%</span>
                                  <span style={{ fontSize: 11, color: "#94a3b8" }}>Fav · {d.promoter}% Promoter</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </FigCard>
                )}
              </>
            )}
          </div>
        )}

        {/* ══════════ LL60 ══════════ */}
        {activeTab === "ll60" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {!ll60Loaded ? <Card><EmptyState label="60-Day Experience (LaunchLens60)" /></Card> : (
              <>
                {/* Filter bar */}
                <MonthRangeFilterBar
  filterKeys={Object.keys(LL60_FILTER_AFFECTS)}
  affectsMap={LL60_FILTER_AFFECTS}
  years={ll60Years}
  allMonths={ll60AllMonths}
  filterType={ll60FilterType}
  filterValue={ll60FilterValue}
  selectedYear={ll60Year}
  monthFrom={ll60MonthFrom}
  monthTo={ll60MonthTo}
  onFilterType={setLl60FilterType}
  onFilterValue={setLl60FilterValue}
  onYear={setLl60Year}
  onMonthFrom={setLl60MonthFrom}
  onMonthTo={setLl60MonthTo}
  onClear={() => {
    setLl60FilterType(""); setLl60FilterValue("")
    setLl60Year(""); setLl60MonthFrom(""); setLl60MonthTo("")
  }}
  accent="#10b981"
  valueOptions={ll60ValueOptions}
/>

                {/* Summary pills */}
                <Card>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 14 }}>LaunchLens 60-Day Experience — Summary</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
                    <StatPill label="Sessions"           value={ll60Headline.sessions}                                                accent="#10b981" sub={`${ll60Headline.participants} participants`} />
                    <StatPill label="Avg Journey Rating" value={ll60Headline.avgRating != null ? `${ll60Headline.avgRating} / 5` : "—"} accent="#10b981" />
                    <StatPill label="Recommend Rate"     value={ll60Headline.avgRecommend != null ? `${ll60Headline.avgRecommend}%` : "—"} accent="#10b981" />
                    <StatPill label="Low Risk Sessions"  value={ll60Headline.riskCounts.low}   accent="#22c55e" sub="Retention risk: Low"    />
                    <StatPill label="High Risk"          value={ll60Headline.riskCounts.high}   accent="#ef4444" sub="Retention risk: High"   />
                  </div>
                </Card>

{/* Fig 1 — Positive signal trend over time */}
                {ll60VisibleFigs.includes("Fig 1") && (
                  <FigCard fig="Fig 1" title="Positive Signal Rate Trend Over Time" subtitle="Line chart · rolling positive signal % across session dates — tracks experience momentum">
                    {ll60Fig4.length < 2 ? <EmptyChart msg="Need sessions across ≥2 dates to show trend" /> : (
                      <ResponsiveContainer width="100%" height={280}>
                        <LineChart data={ll60Fig4} margin={{ top: 10, right: 30, left: 0, bottom: 10 }}>
                          <CartesianGrid strokeDasharray="4 4" stroke="#f1f5f9" />
                          <XAxis 
  dataKey="date" 
  tick={{ fill: "#94a3b8", fontSize: 12 }} 
  tickFormatter={(val) => val}
  type="category"
/>
                          <YAxis domain={[0, 100]} tick={{ fill: "#94a3b8", fontSize: 12 }} unit="%" />
                          <Tooltip content={<CT unit="%" />} />
                          <Line type="monotone" dataKey="Positive Signal %" stroke="#10b981" strokeWidth={2.5} dot={{ r: 5, fill: "#10b981", strokeWidth: 0 }} activeDot={{ r: 7 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    )}
                  </FigCard>
                )}

                
                {/* Fig 2 — Radar chart */}
                {ll60VisibleFigs.includes("Fig 2") && (
                  <FigCard fig="Fig 2" title="Retention Driver Health — Radar View" subtitle="Radar chart · positive signal % across all 6 dimensions; outer = stronger">
                    {ll60Fig2.every(d => d.value === 0) ? <EmptyChart msg="No signal data in current selection" /> : (
                      <div style={{ display: "flex", justifyContent: "center" }}>
                        <ResponsiveContainer width="100%" height={360}>
                          <RadarChart data={ll60Fig2} margin={{ top: 20, right: 30, bottom: 20, left: 30 }}>
                            <PolarGrid stroke="#e2e8f0" />
                            <PolarAngleAxis dataKey="subject" tick={{ fill: "#475569", fontSize: 12, fontWeight: 600 }} />
                            <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fill: "#94a3b8", fontSize: 10 }} tickCount={5} />
                            <Radar name="Positive Signal %" dataKey="value" stroke="#10b981" fill="#10b981" fillOpacity={0.22} strokeWidth={2.5} dot={{ r: 5, fill: "#10b981", strokeWidth: 0 }} />
                            <Tooltip formatter={(v) => [`${v}%`, "Positive Signal"]} />
                            <Legend wrapperStyle={{ fontSize: 12 }} />
                          </RadarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </FigCard>
                )}

                {/* Fig 3 — Retention risk donut */}
                {ll60VisibleFigs.includes("Fig 3") && (
                  <FigCard fig="Fig 3" title="Overall Retention Risk Distribution" subtitle="Donut chart · proportion of sessions by risk level">
                    {ll60Fig3.length === 0 ? <EmptyChart msg="No retention risk data in current selection" /> : (
                      <div style={{ display: "flex", alignItems: "center", gap: 40, flexWrap: "wrap" }}>
                        <ResponsiveContainer width={240} height={240}>
                          <PieChart>
                            <Pie data={ll60Fig3} cx="50%" cy="50%" innerRadius={65} outerRadius={100} dataKey="value" paddingAngle={3}>
                              {ll60Fig3.map((d, i) => <Cell key={i} fill={d.color} />)}
                            </Pie>
                            <Tooltip formatter={(v) => [v, "Sessions"]} />
                          </PieChart>
                        </ResponsiveContainer>
                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                          {ll60Fig3.map((d, i) => (
                            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <div style={{ width: 12, height: 12, borderRadius: 3, background: d.color, flexShrink: 0 }} />
                              <div>
                                <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{d.name}</div>
                                <div style={{ fontSize: 20, fontWeight: 800, color: d.color }}>
                                  {d.value}
                                  <span style={{ fontSize: 12, fontWeight: 600, color: "#94a3b8", marginLeft: 6 }}>
                                    ({ll60Filtered.length ? Math.round((d.value / ll60Filtered.length) * 100) : 0}% of sessions)
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>{ll60Filtered.length} sessions in selection</div>
                        </div>
                      </div>
                    )}
                  </FigCard>
                )}

                {/* Fig 4 — Stacked bar: signal breakdown per dimension */}
                {ll60VisibleFigs.includes("Fig 4") && (
                  <FigCard fig="Fig 4" title="Signal Breakdown by Retention Driver" subtitle="Stacked bar · % of sessions signalling Positive / Neutral / Negative per dimension">
                    {ll60Fig1.length === 0 ? <EmptyChart msg="No signal data in current selection" /> : (
                      <>
                        <ResponsiveContainer width="100%" height={Math.max(260, ll60Fig1.length * 52)}>
                          <BarChart layout="vertical" data={ll60Fig1} margin={{ top: 4, right: 20, left: 10, bottom: 4 }}>
                            <CartesianGrid strokeDasharray="4 4" stroke="#f1f5f9" horizontal={false} />
                            <XAxis type="number" domain={[0, 100]} tick={{ fill: "#94a3b8", fontSize: 11 }} unit="%" />
                            <YAxis type="category" dataKey="label" tick={{ fill: "#475569", fontSize: 11 }} width={190} />
                            <Tooltip content={<CT unit="%" />} />
                            <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
                            <Bar dataKey="Positive" stackId="s" fill="#22c55e" fillOpacity={0.88} />
                            <Bar dataKey="Neutral"  stackId="s" fill="#94a3b8" fillOpacity={0.55} />
                            <Bar dataKey="Negative" stackId="s" fill="#ef4444" fillOpacity={0.80} radius={[0, 6, 6, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                        {/* Per-dimension badges */}
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
                          {ll60Fig1.map((d, i) => (
                            <span key={i} style={{ fontSize: 11, fontWeight: 700, background: ll60SigC(d.Positive) + "18", color: ll60SigC(d.Positive), border: `1px solid ${ll60SigC(d.Positive)}28`, borderRadius: 20, padding: "3px 11px" }}>
                              {d.short}: {d.Positive}% +
                            </span>
                          ))}
                        </div>
                      </>
                    )}
                  </FigCard>
                )}


                {/* Fig 5 — Signal breakdown by Delivery Unit */}
                {ll60VisibleFigs.includes("Fig 5") && (
                  <FigCard fig="Fig 5" title="Signal Distribution by Delivery Unit" subtitle="Clustered bar · compare positive / neutral / negative signal mix across teams">
                    {ll60Fig5.length === 0 ? <EmptyChart msg="No delivery unit data in current selection" /> : (
                      <>
                        <ResponsiveContainer width="100%" height={Math.max(240, ll60Fig5.length * 64)}>
                          <BarChart layout="vertical" data={ll60Fig5} margin={{ top: 4, right: 20, left: 10, bottom: 4 }}>
                            <CartesianGrid strokeDasharray="4 4" stroke="#f1f5f9" horizontal={false} />
                            <XAxis type="number" domain={[0, 100]} tick={{ fill: "#94a3b8", fontSize: 11 }} unit="%" />
                            <YAxis type="category" dataKey="du" tick={{ fill: "#475569", fontSize: 12 }} width={120} />
                            <Tooltip content={<CT unit="%" />} />
                            <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
                            <Bar dataKey="Positive" fill="#22c55e" fillOpacity={0.85} radius={[0, 0, 0, 0]} />
                            <Bar dataKey="Neutral"  fill="#94a3b8" fillOpacity={0.55} />
                            <Bar dataKey="Negative" fill="#ef4444" fillOpacity={0.80} radius={[0, 6, 6, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
                          {ll60Fig5.map((d, i) => (
                            <span key={i} style={{ fontSize: 11, fontWeight: 700, background: ll60SigC(d.Positive) + "18", color: ll60SigC(d.Positive), border: `1px solid ${ll60SigC(d.Positive)}28`, borderRadius: 20, padding: "3px 11px" }}>
                              {d.du}: {d.Positive}% positive
                            </span>
                          ))}
                        </div>
                      </>
                    )}
                  </FigCard>
                )}
              </>
            )}
          </div>
        )}

        {/* ══════════ TCR ══════════ */}
        {activeTab === "tcr" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {!tcrLoaded ? <Card><EmptyState label="Training Completion Rate" /></Card> : (
              <>
                <MonthRangeFilterBar
  filterKeys={Object.keys(TCR_FILTER_AFFECTS)}
  affectsMap={TCR_FILTER_AFFECTS}
  years={tcrYears}
  allMonths={[]} // disable months
  filterType={tcrFilterType}
  filterValue={tcrFilterValue}
  selectedYear={tcrYear}
  monthFrom=""   // disable
  monthTo=""     // disable
  onFilterType={setTcrFilterType}
  onFilterValue={setTcrFilterValue}
  onYear={setTcrYear}
  onMonthFrom={() => {}} // no-op
  onMonthTo={() => {}}   // no-op
  onClear={() => {
    setTcrFilterType("")
    setTcrFilterValue("")
    setTcrYear("")
  }}
  accent="#06b6d4"
  valueOptions={tcrValueOptions}
/>
                <Card>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 14 }}>Training Completion Rate — Summary</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
                    <StatPill label="Completion Rate"    value={`${tcrHeadline.rate}%`} accent="#06b6d4" sub="(Completed ÷ Enrolled) × 100" />
                    <StatPill label="Enrolled Learners"  value={tcrHeadline.enrolled}    accent="#06b6d4" />
                    <StatPill label="Completed Learners" value={tcrHeadline.completed}   accent="#06b6d4" />
                  </div>
                </Card>
                {tcrVisibleFigs.includes("Fig 1") && (
                  <FigCard fig="Fig 1" title="Training Completion Rate by Cohort" subtitle="Line chart · mandatory training completion trend over cohorts">
                    {tcrFig1.length < 2 ? <EmptyChart msg="Need ≥2 cohorts to show trend" /> : (
                      <ResponsiveContainer width="100%" height={280}>
                        <LineChart data={tcrFig1} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                          <CartesianGrid strokeDasharray="4 4" stroke="#f1f5f9" />
                          <XAxis dataKey="cohort" tick={{ fill: "#94a3b8", fontSize: 12 }} />
                          <YAxis domain={[0, 100]} tick={{ fill: "#94a3b8", fontSize: 12 }} unit="%" />
                          <Tooltip content={<CT unit="%" />} />
                          <Line type="monotone" dataKey="rate" name="Completion Rate" stroke="#06b6d4" strokeWidth={2.5} dot={{ r: 5, fill: "#06b6d4", strokeWidth: 0 }} activeDot={{ r: 7 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    )}
                  </FigCard>
                )}
                {tcrVisibleFigs.includes("Fig 2") && (
                  <FigCard fig="Fig 2" title="Assigned vs. Completed Learners by Role" subtitle="Clustered column · compliance gap by role family">
                    {tcrFig2.length === 0 ? <EmptyChart msg="No role data in current selection" /> : (
                      <>
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart data={tcrFig2} margin={{ top: 10, right: 20, left: 0, bottom: 60 }}>
                            <CartesianGrid strokeDasharray="4 4" stroke="#f1f5f9" />
                            <XAxis dataKey="role" tick={{ fill: "#475569", fontSize: 11 }} angle={-35} textAnchor="end" interval={0} />
                            <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} />
                            <Tooltip content={<CT />} />
                            <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                            <Bar dataKey="Enrolled"  fill="#94a3b8" fillOpacity={0.6} radius={[4, 4, 0, 0]} />
                            <Bar dataKey="Completed" radius={[4, 4, 0, 0]}>{tcrFig2.map((d, i) => <Cell key={i} fill={tcrC(d.rate)} />)}</Bar>
                          </BarChart>
                        </ResponsiveContainer>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
                          {tcrFig2.map((d, i) => <span key={i} style={{ fontSize: 11, fontWeight: 700, background: tcrC(d.rate) + "18", color: tcrC(d.rate), border: `1px solid ${tcrC(d.rate)}28`, borderRadius: 20, padding: "3px 11px" }}>{d.role}: {d.rate.toFixed(1)}%</span>)}
                        </div>
                      </>
                    )}
                  </FigCard>
                )}
                {tcrVisibleFigs.includes("Fig 3") && (
                  <FigCard fig="Fig 3" title="Training Completion Rate by Training Modality" subtitle="Horizontal bar · identifies underperforming training formats">
                    {tcrFig3.length === 0 ? <EmptyChart msg="No modality data in current selection" /> : (
                      <>
                        <ResponsiveContainer width="100%" height={Math.max(180, tcrFig3.length * 56)}>
                          <BarChart layout="vertical" data={tcrFig3} margin={{ top: 4, right: 60, left: 10, bottom: 4 }}>
                            <CartesianGrid strokeDasharray="4 4" stroke="#f1f5f9" horizontal={false} />
                            <XAxis type="number" domain={[0, 100]} tick={{ fill: "#94a3b8", fontSize: 11 }} unit="%" />
                            <YAxis type="category" dataKey="modality" tick={{ fill: "#475569", fontSize: 12 }} width={140} />
                            <Tooltip content={<CT unit="%" />} />
                            <Bar dataKey="rate" name="Completion Rate" radius={[0, 6, 6, 0]}>{tcrFig3.map((d, i) => <Cell key={i} fill={tcrC(d.rate)} />)}</Bar>
                          </BarChart>
                        </ResponsiveContainer>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
                          {tcrFig3.map((d, i) => <span key={i} style={{ fontSize: 11, fontWeight: 700, background: tcrC(d.rate) + "18", color: tcrC(d.rate), border: `1px solid ${tcrC(d.rate)}28`, borderRadius: 20, padding: "3px 11px" }}>{d.modality}: {d.rate.toFixed(1)}%</span>)}
                        </div>
                      </>
                    )}
                  </FigCard>
                )}
              </>
            )}
          </div>
        )}

      </div>
      <div style={{ textAlign: "center", marginTop: 52, fontSize: 11, color: "#cbd5e1" }}>EX Onboarding Dashboard · Phase 1 MVP · Data persists in local storage</div>
    </div>
  )
}