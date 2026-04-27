"use client"

import { useEffect, useState, useMemo } from "react"
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend,
  CartesianGrid, ResponsiveContainer, LineChart, Line, Cell,
} from "recharts"
import { createClient } from "@/utils/supabase/client"

const supabase = createClient()

// ─── Types ───────────────────────────────────────────────
interface EicrRow {
  reporting_period: string
  exit_type: string | null
  delivery_unit: string | null
  tenure_band: string | null
  total_exits: number
  completed_interviews: number
  completion_rate: number
  waived_cases: number
}

interface OesRow {
  exit_date: string
  exit_type: string | null
  delivery_unit: string | null
  tenure_band: string | null
  q1_respect: string | null
  q2_clarity: string | null
  q3_fairness: string | null
  q4_overall_experience: string | null
  open_comment: string | null
}

// ─── Helpers ─────────────────────────────────────────────
const LIKERT: Record<string, number> = {
  "strongly agree": 5, agree: 4, neutral: 3, disagree: 2, "strongly disagree": 1,
}
const toLikert = (v: string | null | undefined): number | null => {
  if (!v) return null
  return LIKERT[v.trim().toLowerCase()] ?? null
}
const toNum = (v?: number | null): number => Number(v || 0)
const uniq = (arr: (string | null | undefined)[]): string[] =>
  [...new Set(arr.filter((v): v is string => !!v && v.trim() !== ""))].sort()
const pct = (num: number, den: number): number =>
  den ? Number(((num / den) * 100).toFixed(1)) : 0

const MONTH_LABELS: Record<string, string> = {
  "01": "Jan", "02": "Feb", "03": "Mar", "04": "Apr",
  "05": "May", "06": "Jun", "07": "Jul", "08": "Aug",
  "09": "Sep", "10": "Oct", "11": "Nov", "12": "Dec",
}

// ─── OES question definitions ─────────────────────────────
const OES_Q_DEFS = [
  { key: "q1_respect",            label: "Respect" },
  { key: "q2_clarity",            label: "Clarity" },
  { key: "q3_fairness",           label: "Fairness" },
  { key: "q4_overall_experience", label: "Overall Experience" },
]

// ─── Filter configs ───────────────────────────────────────
const EICR_FILTER_AFFECTS: Record<string, string[]> = {
  "Reporting Period": ["Fig 1", "Fig 2", "Fig 3"],
  "Exit Type":        ["Fig 1", "Fig 2", "Fig 3"],
  "Delivery Unit":    ["Fig 2", "Fig 3"],
  "Tenure Band":      ["Fig 2", "Fig 3"],
}
const OES_FILTER_AFFECTS: Record<string, string[]> = {
  "Exit Type":     ["Fig 1", "Fig 2", "Fig 3"],
  "Delivery Unit": ["Fig 2", "Fig 3"],
  "Tenure Band":   ["Fig 2", "Fig 3"],
}

// ─── UI Primitives ────────────────────────────────────────
function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: "#fff", borderRadius: 16,
      boxShadow: "0 1px 4px rgba(0,0,0,.06), 0 4px 20px rgba(0,0,0,.07)",
      padding: "24px 26px", ...style,
    }}>
      {children}
    </div>
  )
}

function EmptyState({ label }: { label: string }) {
  return (
    <div style={{ textAlign: "center", padding: "56px 24px", color: "#cbd5e1", fontSize: 13 }}>
      <div style={{ fontSize: 40, marginBottom: 10 }}>📭</div>
      No <strong>{label}</strong> data uploaded yet.<br />Go to the dashboard and upload a file first.
    </div>
  )
}

function LoadingState() {
  return (
    <div style={{ textAlign: "center", padding: "56px 24px", color: "#94a3b8", fontSize: 13 }}>
      <div style={{ fontSize: 32, marginBottom: 10 }}>⏳</div>
      Loading from database…
    </div>
  )
}

function EmptyChart({ msg }: { msg: string }) {
  return (
    <div style={{
      height: 150, display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      color: "#cbd5e1", fontSize: 13,
      background: "#fafafa", borderRadius: 10, border: "1px dashed #e2e8f0",
    }}>
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

function CT({ active, payload, label, unit }: {
  active?: boolean
  payload?: { color: string; name: string; value: number | string }[]
  label?: string
  unit?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: "10px 14px", fontSize: 12, boxShadow: "0 4px 20px rgba(0,0,0,.10)" }}>
      <div style={{ fontWeight: 700, color: "#0f172a", marginBottom: 4 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color }}>
          {p.name}: <strong>{typeof p.value === "number" ? p.value.toFixed(1) : p.value}{unit ?? ""}</strong>
        </div>
      ))}
    </div>
  )
}

function FigCard({ fig, title, subtitle, children }: {
  fig: string; title: string; subtitle: string; children: React.ReactNode
}) {
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

// ─── Simple Filter Bar (EICR) ─────────────────────────────
function SimpleFilterBar({
  filterKeys, affectsMap, filterType, filterValue,
  onFilterType, onFilterValue, onClear, accent, valueOptions,
}: {
  filterKeys: string[]; affectsMap: Record<string, string[]>
  filterType: string; filterValue: string
  onFilterType: (v: string) => void; onFilterValue: (v: string) => void
  onClear: () => void; accent: string; valueOptions: string[]
}) {
  const affects  = filterType ? affectsMap[filterType] ?? [] : []
  const hasActive = !!filterType

  const CHEVRON = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2.5'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`
  const sel = (active: boolean, w = 200): React.CSSProperties => ({
    padding: "9px 36px 9px 14px", borderRadius: 10, fontSize: 13, fontWeight: 600,
    border: active ? `1.5px solid ${accent}` : "1.5px solid #e2e8f0",
    backgroundColor: active ? accent + "08" : "#fff",
    backgroundImage: CHEVRON, backgroundRepeat: "no-repeat",
    backgroundPosition: "right 12px center", backgroundSize: "12px 12px",
    color: active ? accent : "#64748b", cursor: "pointer", outline: "none",
    minWidth: w, boxShadow: active ? `0 0 0 3px ${accent}15` : "none",
    transition: "border .15s, box-shadow .15s, color .15s",
    appearance: "none" as const, WebkitAppearance: "none" as const,
  })
  const lbl = (txt: string) => (
    <label style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" as const, letterSpacing: ".06em" }}>{txt}</label>
  )

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
              {affects.map(fig => (
                <span key={fig} style={{ fontSize: 11, fontWeight: 700, background: accent + "15", color: accent, border: `1px solid ${accent}30`, borderRadius: 6, padding: "3px 10px" }}>{fig}</span>
              ))}
            </div>
          )}
          {hasActive && (
            <button onClick={onClear} style={{ padding: "8px 14px", borderRadius: 8, fontSize: 11, fontWeight: 700, border: "1px solid #e2e8f0", background: "#f8fafc", color: "#94a3b8", cursor: "pointer" }}>
              ✕ Clear
            </button>
          )}
        </div>
      </div>

      {hasActive && (
        <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid #f1f5f9", fontSize: 12, color: "#64748b", display: "flex", gap: 6, flexWrap: "wrap" }}>
          <span style={{ background: "#f1f5f9", borderRadius: 6, padding: "2px 8px" }}>{filterType}: <strong>{filterValue || "All"}</strong></span>
        </div>
      )}
    </Card>
  )
}

// ─── Month-Range Filter Bar (OES) ─────────────────────────
function MonthRangeFilterBar({
  filterKeys, affectsMap, years, allMonths,
  filterType, filterValue, selectedYear, monthFrom, monthTo,
  onFilterType, onFilterValue, onYear, onMonthFrom, onMonthTo, onClear,
  accent, valueOptions,
}: {
  filterKeys: string[]; affectsMap: Record<string, string[]>; years: string[]
  allMonths: string[]; filterType: string; filterValue: string
  selectedYear: string; monthFrom: string; monthTo: string
  onFilterType: (v: string) => void; onFilterValue: (v: string) => void
  onYear: (v: string) => void; onMonthFrom: (v: string) => void
  onMonthTo: (v: string) => void; onClear: () => void
  accent: string; valueOptions: string[]
}) {
  const affects    = filterType ? affectsMap[filterType] ?? [] : []
  const usingRange = !!(monthFrom || monthTo)
  const hasActive  = !!(filterType || selectedYear || usingRange)

  const CHEVRON = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2.5'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`
  const sel = (active: boolean, w = 200): React.CSSProperties => ({
    padding: "9px 36px 9px 14px", borderRadius: 10, fontSize: 13, fontWeight: 600,
    border: active ? `1.5px solid ${accent}` : "1.5px solid #e2e8f0",
    backgroundColor: active ? accent + "08" : "#fff",
    backgroundImage: CHEVRON, backgroundRepeat: "no-repeat",
    backgroundPosition: "right 12px center", backgroundSize: "12px 12px",
    color: active ? accent : "#64748b", cursor: "pointer", outline: "none",
    minWidth: w, boxShadow: active ? `0 0 0 3px ${accent}15` : "none",
    transition: "border .15s, box-shadow .15s, color .15s",
    appearance: "none" as const, WebkitAppearance: "none" as const,
  })
  const lbl = (txt: string) => (
    <label style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" as const, letterSpacing: ".06em" }}>{txt}</label>
  )

  const filteredMonths = selectedYear ? allMonths.filter(ym => ym.startsWith(selectedYear)) : allMonths
  const monthOpts = filteredMonths.map(ym => {
    const [y, m] = ym.split("-")
    return { value: ym, label: `${MONTH_LABELS[m] ?? m} ${y}` }
  })
  const fromOpts = monthTo   ? monthOpts.filter(o => o.value <= monthTo)   : monthOpts
  const toOpts   = monthFrom ? monthOpts.filter(o => o.value >= monthFrom) : monthOpts

  const rangeLabel = () => {
    const fmt = (ym: string) => { const [y, m] = ym.split("-"); return `${MONTH_LABELS[m] ?? m} ${y}` }
    return `${monthFrom ? fmt(monthFrom) : "Earliest"} → ${monthTo ? fmt(monthTo) : "Latest"}`
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
              {affects.map(fig => (
                <span key={fig} style={{ fontSize: 11, fontWeight: 700, background: accent + "15", color: accent, border: `1px solid ${accent}30`, borderRadius: 6, padding: "3px 10px" }}>{fig}</span>
              ))}
            </div>
          )}
          {hasActive && (
            <button onClick={onClear} style={{ padding: "8px 14px", borderRadius: 8, fontSize: 11, fontWeight: 700, border: "1px solid #e2e8f0", background: "#f8fafc", color: "#94a3b8", cursor: "pointer", whiteSpace: "nowrap" }}>
              ✕ Clear
            </button>
          )}
        </div>
      </div>

      {allMonths.length > 0 && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid #f1f5f9", display: "flex", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".06em", alignSelf: "center" }}>📅 Month Range</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {lbl("From")}
            <select value={monthFrom} onChange={e => onMonthFrom(e.target.value)} style={sel(!!monthFrom, 190)}>
              <option value="">Earliest</option>
              {fromOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div style={{ alignSelf: "flex-end", paddingBottom: 10, color: "#cbd5e1", fontSize: 18, fontWeight: 300 }}>→</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {lbl("To")}
            <select value={monthTo} onChange={e => onMonthTo(e.target.value)} style={sel(!!monthTo, 190)}>
              <option value="">Latest</option>
              {toOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          {usingRange && (
            <div style={{ alignSelf: "flex-end", paddingBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, background: accent + "12", color: accent, border: `1px solid ${accent}25`, borderRadius: 20, padding: "4px 12px" }}>
                📅 {rangeLabel()}
              </span>
            </div>
          )}
        </div>
      )}

      {hasActive && (
        <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid #f1f5f9", fontSize: 12, color: "#64748b", display: "flex", gap: 6, flexWrap: "wrap" }}>
          {selectedYear && !usingRange && <span style={{ background: "#f1f5f9", borderRadius: 6, padding: "2px 8px" }}>Year: <strong>{selectedYear}</strong></span>}
          {usingRange && <span style={{ background: "#f1f5f9", borderRadius: 6, padding: "2px 8px" }}>Range: <strong>{rangeLabel()}</strong></span>}
          {filterType && <span style={{ background: "#f1f5f9", borderRadius: 6, padding: "2px 8px" }}>{filterType}: <strong>{filterValue || "All"}</strong></span>}
        </div>
      )}
    </Card>
  )
}

// ═══════════════════════════════════════════════════════════
//  MAIN
// ═══════════════════════════════════════════════════════════
export default function OffboardingReportsPage() {
  const [eicrRows,    setEicrRows]    = useState<EicrRow[]>([])
  const [oesRows,     setOesRows]     = useState<OesRow[]>([])
  const [eicrLoading, setEicrLoading] = useState(true)
  const [oesLoading,  setOesLoading]  = useState(true)
  const [error,       setError]       = useState<string | null>(null)
  const [activeTab,   setActiveTab]   = useState<"eicr" | "oes">("eicr")

  // EICR filter state
  const [eicrFilterType,  setEicrFilterType]  = useState("")
  const [eicrFilterValue, setEicrFilterValue] = useState("")

  // OES filter state
  const [oesFilterType,  setOesFilterType]  = useState("")
  const [oesFilterValue, setOesFilterValue] = useState("")
  const [oesYear,        setOesYear]        = useState("")
  const [oesMonthFrom,   setOesMonthFrom]   = useState("")
  const [oesMonthTo,     setOesMonthTo]     = useState("")

  // ── Fetch from Supabase ───────────────────────────────────
  useEffect(() => {
    const fetchEicr = async () => {
      setEicrLoading(true)
      try {
        const { data, error } = await supabase
          .from("exit_interview_completion")
          .select("reporting_period, exit_type, delivery_unit, tenure_band, total_exits, completed_interviews, completion_rate, waived_cases")
          .order("reporting_period", { ascending: true })

        if (error) throw new Error(error.message)
        setEicrRows(data ?? [])
      } catch (e: any) {
        setError(`Failed to load EICR data: ${e.message}`)
      } finally {
        setEicrLoading(false)
      }
    }

    const fetchOes = async () => {
      setOesLoading(true)
      try {
        const { data, error } = await supabase
          .from("offboarding_experience_responses")
          .select("exit_date, exit_type, delivery_unit, tenure_band, q1_respect, q2_clarity, q3_fairness, q4_overall_experience, open_comment")
          .order("exit_date", { ascending: true })

        if (error) throw new Error(error.message)
        setOesRows(data ?? [])
      } catch (e: any) {
        setError(`Failed to load OES data: ${e.message}`)
      } finally {
        setOesLoading(false)
      }
    }

    fetchEicr()
    fetchOes()
  }, [])

  const eicrLoaded = !eicrLoading && eicrRows.length > 0
  const oesLoaded  = !oesLoading  && oesRows.length > 0

  // ── EICR DERIVED ─────────────────────────────────────────
  const eicrValueOptions = useMemo((): string[] => {
    switch (eicrFilterType) {
      case "Reporting Period": return uniq(eicrRows.map(r => r.reporting_period))
      case "Exit Type":        return uniq(eicrRows.map(r => r.exit_type))
      case "Delivery Unit":    return uniq(eicrRows.map(r => r.delivery_unit))
      case "Tenure Band":      return uniq(eicrRows.map(r => r.tenure_band))
      default: return []
    }
  }, [eicrFilterType, eicrRows])

  const eicrVisibleFigs = useMemo(() =>
    eicrFilterType ? EICR_FILTER_AFFECTS[eicrFilterType] ?? [] : ["Fig 1", "Fig 2", "Fig 3"]
  , [eicrFilterType])

  const eicrFiltered = useMemo(() => {
    if (!eicrFilterType || !eicrFilterValue) return eicrRows
    return eicrRows.filter(r => {
      switch (eicrFilterType) {
        case "Reporting Period": return r.reporting_period       === eicrFilterValue
        case "Exit Type":        return r.exit_type              === eicrFilterValue
        case "Delivery Unit":    return r.delivery_unit          === eicrFilterValue
        case "Tenure Band":      return r.tenure_band            === eicrFilterValue
        default: return true
      }
    })
  }, [eicrRows, eicrFilterType, eicrFilterValue])

  // Fig 1 — Completion rate by reporting period (line)
  const eicrFig1 = useMemo(() => {
    const map: Record<string, { exits: number; completed: number }> = {}
    eicrFiltered.forEach(r => {
      const p = r.reporting_period || "Unknown"
      if (!map[p]) map[p] = { exits: 0, completed: 0 }
      map[p].exits     += toNum(r.total_exits)
      map[p].completed += toNum(r.completed_interviews)
    })
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([period, d]) => ({
      period, rate: pct(d.completed, d.exits),
    }))
  }, [eicrFiltered])

  // Fig 2 — Eligible vs Completed by Delivery Unit (clustered column)
  const eicrFig2 = useMemo(() => {
    const map: Record<string, { exits: number; completed: number; waived: number }> = {}
    eicrFiltered.forEach(r => {
      const du = r.delivery_unit || "Unknown"
      if (!map[du]) map[du] = { exits: 0, completed: 0, waived: 0 }
      map[du].exits     += toNum(r.total_exits)
      map[du].completed += toNum(r.completed_interviews)
      map[du].waived    += toNum(r.waived_cases)
    })
    return Object.entries(map).map(([unit, d]) => ({ unit, ...d }))
  }, [eicrFiltered])

  // Fig 3 — Completion rate by Delivery Unit (horizontal bar)
  const eicrFig3 = useMemo(() =>
    eicrFig2.map(d => ({ unit: d.unit, rate: pct(d.completed, d.exits) }))
      .sort((a, b) => b.rate - a.rate)
  , [eicrFig2])

  const eicrHeadline = useMemo(() => {
    const exits     = eicrFiltered.reduce((s, r) => s + toNum(r.total_exits), 0)
    const completed = eicrFiltered.reduce((s, r) => s + toNum(r.completed_interviews), 0)
    const waived    = eicrFiltered.reduce((s, r) => s + toNum(r.waived_cases), 0)
    return { exits, completed, waived, rate: pct(completed, exits) }
  }, [eicrFiltered])

  // Global EICR for KPI card
  const globalEicrRate = useMemo(() => {
    const exits     = eicrRows.reduce((s, r) => s + toNum(r.total_exits), 0)
    const completed = eicrRows.reduce((s, r) => s + toNum(r.completed_interviews), 0)
    return pct(completed, exits)
  }, [eicrRows])

  const eicrColor = (v: number) => v >= 80 ? "#6366f1" : v >= 60 ? "#f59e0b" : "#ef4444"

  // ── OES DERIVED ──────────────────────────────────────────
  const oesAllMonths = useMemo(() =>
    uniq(oesRows.map(r => r.exit_date?.slice(0, 7)))
  , [oesRows])

  const oesYears = useMemo(() =>
    uniq(oesRows.map(r => r.exit_date?.slice(0, 4)))
  , [oesRows])

  const oesValueOptions = useMemo((): string[] => {
    switch (oesFilterType) {
      case "Exit Type":     return uniq(oesRows.map(r => r.exit_type))
      case "Delivery Unit": return uniq(oesRows.map(r => r.delivery_unit))
      case "Tenure Band":   return uniq(oesRows.map(r => r.tenure_band))
      default: return []
    }
  }, [oesFilterType, oesRows])

  const oesVisibleFigs = useMemo(() =>
    oesFilterType ? OES_FILTER_AFFECTS[oesFilterType] ?? [] : ["Fig 1", "Fig 2", "Fig 3"]
  , [oesFilterType])

  const oesDateFiltered = useMemo(() => {
    let rows = oesRows
    if (oesMonthFrom || oesMonthTo) {
      rows = rows.filter(r => {
        const ym = r.exit_date?.slice(0, 7) ?? ""
        if (!ym) return false
        if (oesMonthFrom && ym < oesMonthFrom) return false
        if (oesMonthTo   && ym > oesMonthTo)   return false
        return true
      })
    } else if (oesYear) {
      rows = rows.filter(r => r.exit_date?.startsWith(oesYear))
    }
    return rows
  }, [oesRows, oesYear, oesMonthFrom, oesMonthTo])

  const oesFiltered = useMemo(() => {
    if (!oesFilterType || !oesFilterValue) return oesDateFiltered
    return oesDateFiltered.filter(r => {
      switch (oesFilterType) {
        case "Exit Type":     return r.exit_type     === oesFilterValue
        case "Delivery Unit": return r.delivery_unit === oesFilterValue
        case "Tenure Band":   return r.tenure_band   === oesFilterValue
        default: return true
      }
    })
  }, [oesDateFiltered, oesFilterType, oesFilterValue])

  // OES score helpers
  const calcFav = (rows: OesRow[], key: keyof OesRow) => {
    let fav = 0; let n = 0
    rows.forEach(r => {
      const s = toLikert(r[key] as string | null)
      if (s !== null) { n++; if (s >= 4) fav++ }
    })
    return n ? pct(fav, n) : 0
  }

  const calcOverallFav = (rows: OesRow[]) => {
    // Composite: Q1 + Q2 + Q3 only (exclude Q4 Overall Experience from composite)
    const coreKeys: (keyof OesRow)[] = ["q1_respect", "q2_clarity", "q3_fairness"]
    let fav = 0; let n = 0
    rows.forEach(r => coreKeys.forEach(k => {
      const s = toLikert(r[k] as string | null)
      if (s !== null) { n++; if (s >= 4) fav++ }
    }))
    return n ? pct(fav, n) : 0
  }

  // Fig 1 — OES trend by month
  const oesFig1 = useMemo(() => {
    const map: Record<string, OesRow[]> = {}
    oesFiltered.forEach(r => {
      const ym = r.exit_date?.slice(0, 7)
      if (!ym) return
      if (!map[ym]) map[ym] = []
      map[ym].push(r)
    })
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([ym, rows]) => {
      const [y, m] = ym.split("-")
      return { period: `${MONTH_LABELS[m] ?? m} ${y}`, oes: calcOverallFav(rows) }
    })
  }, [oesFiltered])

  // Fig 2 — Favorability by dimension (horizontal bar)
  const oesFig2 = useMemo(() =>
    OES_Q_DEFS.map(q => ({
      dimension: q.label,
      fav: calcFav(oesFiltered, q.key as keyof OesRow),
    }))
  , [oesFiltered])

  const oesLowestDim = useMemo(() => [...oesFig2].sort((a, b) => a.fav - b.fav)[0], [oesFig2])

  // Fig 3 — Favorability by exit type (clustered bar)
  const oesFig3 = useMemo(() => {
    const exitTypes = uniq(oesFiltered.map(r => r.exit_type))
    return exitTypes.map(et => {
      const rows = oesFiltered.filter(r => r.exit_type === et)
      const entry: Record<string, string | number> = { exitType: et }
      OES_Q_DEFS.forEach(q => { entry[q.label] = calcFav(rows, q.key as keyof OesRow) })
      return entry
    })
  }, [oesFiltered])

  const oesHeadline = useMemo(() => ({
    oes:       calcOverallFav(oesFiltered),
    responses: oesFiltered.length,
    lowestDim: oesLowestDim,
  }), [oesFiltered, oesLowestDim])

  const globalOesScore = useMemo(() => calcOverallFav(oesRows), [oesRows])

  const oesComments = useMemo(() =>
    oesFiltered.filter(r => r.open_comment?.trim())
  , [oesFiltered])

  const OES_COLORS = ["#0ea5e9", "#0ea5e9", "#0ea5e9", "#0ea5e9"]

  const TABS = [
    { key: "eicr", label: "Exit Interview Completion Rate", accent: "#6366f1", loaded: eicrLoaded, loading: eicrLoading },
    { key: "oes",  label: "Offboarding Experience Score",   accent: "#0ea5e9", loaded: oesLoaded,  loading: oesLoading  },
  ] as const

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>

      {/* Error banner */}
      {error && (
        <div style={{ background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: 10, padding: "12px 16px", fontSize: 13, color: "#B91C1C", display: "flex", justifyContent: "space-between" }}>
          {error}
          <button onClick={() => setError(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#B91C1C", fontSize: 16 }}>×</button>
        </div>
      )}

      {/* KPI row — global unfiltered numbers */}
      {(eicrLoaded || oesLoaded) && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12, marginBottom: 8 }}>
          {eicrLoaded && (
            <Card style={{ padding: "16px 20px" }}>
              <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6 }}>Exit Interview Completion Rate</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                <span style={{ fontSize: 30, fontWeight: 800, color: "#6366f1", lineHeight: 1 }}>{globalEicrRate}</span>
                <span style={{ fontSize: 12, color: "#6366f199", fontWeight: 600 }}>%</span>
              </div>
              <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 3 }}>
                {eicrRows.reduce((s, r) => s + toNum(r.completed_interviews), 0)} / {eicrRows.reduce((s, r) => s + toNum(r.total_exits), 0)} exits
              </div>
            </Card>
          )}
          {oesLoaded && (
            <Card style={{ padding: "16px 20px" }}>
              <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6 }}>Offboarding Experience Score</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                <span style={{ fontSize: 30, fontWeight: 800, color: "#0ea5e9", lineHeight: 1 }}>{globalOesScore}</span>
                <span style={{ fontSize: 12, color: "#0ea5e999", fontWeight: 600 }}>%</span>
              </div>
              <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 3 }}>{oesRows.length} survey responses</div>
            </Card>
          )}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            style={{
              padding: "8px 20px", borderRadius: 20, fontSize: 12, fontWeight: 700,
              cursor: "pointer", border: "none", transition: "all .18s",
              background: activeTab === t.key ? t.accent : "#fff",
              color: activeTab === t.key ? "#fff" : t.loaded ? "#475569" : "#cbd5e1",
              opacity: t.loading ? 0.6 : 1,
              boxShadow: activeTab === t.key ? `0 4px 14px ${t.accent}45` : "0 1px 3px rgba(0,0,0,.06)",
            }}>
            {t.loading ? "◌" : t.loaded ? "●" : "○"} {t.label}
          </button>
        ))}
      </div>

      {/* ── EICR Tab ── */}
      {activeTab === "eicr" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {eicrLoading ? (
            <Card><LoadingState /></Card>
          ) : !eicrLoaded ? (
            <Card><EmptyState label="Exit Interview Completion Rate" /></Card>
          ) : (
            <>
              <SimpleFilterBar
                filterKeys={Object.keys(EICR_FILTER_AFFECTS)}
                affectsMap={EICR_FILTER_AFFECTS}
                filterType={eicrFilterType}
                filterValue={eicrFilterValue}
                onFilterType={setEicrFilterType}
                onFilterValue={setEicrFilterValue}
                onClear={() => { setEicrFilterType(""); setEicrFilterValue("") }}
                accent="#6366f1"
                valueOptions={eicrValueOptions}
              />

              <Card>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 14 }}>Exit Interview Completion Rate — Summary</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10 }}>
                  <StatPill label="Completion Rate"      value={`${eicrHeadline.rate}%`} accent="#6366f1" sub="Completed ÷ Total Exits" />
                  <StatPill label="Total Exits"          value={eicrHeadline.exits}       accent="#6366f1" />
                  <StatPill label="Completed Interviews" value={eicrHeadline.completed}   accent="#6366f1" />
                  {eicrHeadline.waived > 0 && (
                    <StatPill label="Waived / Unreachable" value={eicrHeadline.waived} accent="#94a3b8" sub="Excluded from rate" />
                  )}
                </div>
              </Card>

              {eicrVisibleFigs.includes("Fig 1") && (
                <FigCard fig="Fig 1" title="Exit Interview Completion Rate by Quarter" subtitle="Line chart · participation trend over time · affected by: Reporting Period, Exit Type">
                  {eicrFig1.length < 2 ? <EmptyChart msg="Need ≥2 reporting periods to show trend" /> : (
                    <ResponsiveContainer width="100%" height={280}>
                      <LineChart data={eicrFig1} margin={{ top: 10, right: 30, left: 0, bottom: 10 }}>
                        <CartesianGrid strokeDasharray="4 4" stroke="#f1f5f9" />
                        <XAxis dataKey="period" tick={{ fill: "#94a3b8", fontSize: 12 }} />
                        <YAxis domain={[0, 100]} tick={{ fill: "#94a3b8", fontSize: 12 }} unit="%" />
                        <Tooltip content={<CT unit="%" />} />
                        <Line type="monotone" dataKey="rate" name="Completion Rate" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 5, fill: "#6366f1", strokeWidth: 0 }} activeDot={{ r: 7 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </FigCard>
              )}

              {eicrVisibleFigs.includes("Fig 2") && (
                <FigCard fig="Fig 2" title="Eligible vs. Completed by Delivery Unit" subtitle="Clustered column · coverage gaps by unit · affected by: Delivery Unit, Tenure Band">
                  {eicrFig2.length === 0 ? <EmptyChart msg="No delivery unit data in current selection" /> : (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={eicrFig2} margin={{ top: 10, right: 20, left: 0, bottom: 60 }}>
                        <CartesianGrid strokeDasharray="4 4" stroke="#f1f5f9" />
                        <XAxis dataKey="unit" tick={{ fill: "#475569", fontSize: 11 }} angle={-35} textAnchor="end" interval={0} />
                        <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} />
                        <Tooltip content={<CT />} />
                        <Legend verticalAlign="top" align="right" wrapperStyle={{ fontSize: 12, paddingBottom: 8 }} />
                        <Bar dataKey="exits"     name="Eligible Exits"       fill="#94a3b8" fillOpacity={0.55} radius={[4, 4, 0, 0]} />
                        <Bar dataKey="completed" name="Completed Interviews" fill="#6366f1" fillOpacity={0.85} radius={[4, 4, 0, 0]} />
                        {eicrFig2.some(d => d.waived > 0) && (
                          <Bar dataKey="waived" name="Waived / Unreachable" fill="#f59e0b" fillOpacity={0.7} radius={[4, 4, 0, 0]} />
                        )}
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </FigCard>
              )}

              {eicrVisibleFigs.includes("Fig 3") && (
                <FigCard fig="Fig 3" title="Completion Rate by Delivery Unit" subtitle="Horizontal bar · participation gaps by unit · affected by: Delivery Unit, Tenure Band">
                  {eicrFig3.length === 0 ? <EmptyChart msg="No delivery unit data in current selection" /> : (
                    <>
                      <ResponsiveContainer width="100%" height={Math.max(200, eicrFig3.length * 50)}>
                        <BarChart layout="vertical" data={eicrFig3} margin={{ top: 4, right: 60, left: 10, bottom: 4 }}>
                          <CartesianGrid strokeDasharray="4 4" stroke="#f1f5f9" horizontal={false} />
                          <XAxis type="number" domain={[0, 100]} tick={{ fill: "#94a3b8", fontSize: 11 }} unit="%" />
                          <YAxis type="category" dataKey="unit" tick={{ fill: "#475569", fontSize: 12 }} width={140} />
                          <Tooltip content={<CT unit="%" />} />
                          <Bar dataKey="rate" name="Completion Rate" radius={[0, 6, 6, 0]}>
                            {eicrFig3.map((d, i) => <Cell key={i} fill={eicrColor(d.rate)} />)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
                        {eicrFig3.map((d, i) => (
                          <span key={i} style={{ fontSize: 11, fontWeight: 700, background: eicrColor(d.rate) + "18", color: eicrColor(d.rate), border: `1px solid ${eicrColor(d.rate)}28`, borderRadius: 20, padding: "3px 11px" }}>
                            {d.unit}: {d.rate.toFixed(1)}%
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

      {/* ── OES Tab ── */}
      {activeTab === "oes" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {oesLoading ? (
            <Card><LoadingState /></Card>
          ) : !oesLoaded ? (
            <Card><EmptyState label="Offboarding Experience Score" /></Card>
          ) : (
            <>
              <MonthRangeFilterBar
                filterKeys={Object.keys(OES_FILTER_AFFECTS)}
                affectsMap={OES_FILTER_AFFECTS}
                years={oesYears}
                allMonths={oesAllMonths}
                filterType={oesFilterType}
                filterValue={oesFilterValue}
                selectedYear={oesYear}
                monthFrom={oesMonthFrom}
                monthTo={oesMonthTo}
                onFilterType={setOesFilterType}
                onFilterValue={setOesFilterValue}
                onYear={setOesYear}
                onMonthFrom={setOesMonthFrom}
                onMonthTo={setOesMonthTo}
                onClear={() => { setOesFilterType(""); setOesFilterValue(""); setOesYear(""); setOesMonthFrom(""); setOesMonthTo("") }}
                accent="#0ea5e9"
                valueOptions={oesValueOptions}
              />

              <Card>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 14 }}>Offboarding Experience Score — Summary</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10 }}>
                  <StatPill label="OES Favorability" value={`${oesHeadline.oes}%`}  accent="#0ea5e9" sub="Agree / Strongly Agree" />
                  <StatPill label="Survey Responses" value={oesHeadline.responses}   accent="#0ea5e9" />
                  {oesHeadline.lowestDim && (
                    <StatPill label="Lowest Dimension" value={oesHeadline.lowestDim.dimension} accent="#ef4444" sub={`${oesHeadline.lowestDim.fav}% favorable`} />
                  )}
                </div>
              </Card>

              {oesVisibleFigs.includes("Fig 1") && (
                <FigCard fig="Fig 1" title="Offboarding Experience Score by Month" subtitle="Line chart · experience quality trend · affected by: Exit Type">
                  {oesFig1.length < 2 ? <EmptyChart msg="Need ≥2 months to show trend" /> : (
                    <ResponsiveContainer width="100%" height={280}>
                      <LineChart data={oesFig1} margin={{ top: 10, right: 30, left: 0, bottom: 10 }}>
                        <CartesianGrid strokeDasharray="4 4" stroke="#f1f5f9" />
                        <XAxis dataKey="period" tick={{ fill: "#94a3b8", fontSize: 12 }} />
                        <YAxis domain={[0, 100]} tick={{ fill: "#94a3b8", fontSize: 12 }} unit="%" />
                        <Tooltip content={<CT unit="%" />} />
                        <Line type="monotone" dataKey="oes" name="OES" stroke="#0ea5e9" strokeWidth={2.5} dot={{ r: 5, fill: "#0ea5e9", strokeWidth: 0 }} activeDot={{ r: 7 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </FigCard>
              )}

              {oesVisibleFigs.includes("Fig 2") && (
                <FigCard fig="Fig 2" title="Favorability by Offboarding Dimension" subtitle="Horizontal bar · respect, clarity, fairness, overall experience · affected by: Exit Type, Delivery Unit, Tenure Band">
                  {oesFig2.every(d => d.fav === 0) ? <EmptyChart msg="No scores in current selection" /> : (
                    <ResponsiveContainer width="100%" height={Math.max(200, oesFig2.length * 54)}>
                      <BarChart layout="vertical" data={oesFig2} margin={{ top: 4, right: 60, left: 10, bottom: 4 }}>
                        <CartesianGrid strokeDasharray="4 4" stroke="#f1f5f9" horizontal={false} />
                        <XAxis type="number" domain={[0, 100]} tick={{ fill: "#94a3b8", fontSize: 11 }} unit="%" />
                        <YAxis type="category" dataKey="dimension" tick={{ fill: "#475569", fontSize: 12 }} width={140} />
                        <Tooltip content={<CT unit="%" />} />
                        <Bar dataKey="fav" name="Favorability" radius={[0, 6, 6, 0]}>
                          {oesFig2.map((d, i) => (
                            <Cell key={i}
                              fill={d.dimension === oesLowestDim?.dimension ? "#0ea5e9" : OES_COLORS[i % OES_COLORS.length]}
                              fillOpacity={d.dimension === oesLowestDim?.dimension ? 1 : 0.8}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </FigCard>
              )}

              {oesVisibleFigs.includes("Fig 3") && (
                <FigCard fig="Fig 3" title="Offboarding Experience by Exit Type" subtitle="Clustered bar · process differences across exit groups · affected by: Exit Type, Delivery Unit, Tenure Band">
                  {oesFig3.length === 0 ? <EmptyChart msg="No exit type data in current selection" /> : (
                    <ResponsiveContainer width="100%" height={Math.max(260, oesFig3.length * 90)}>
                      <BarChart data={oesFig3} margin={{ top: 10, right: 20, left: 0, bottom: 40 }}>
                        <CartesianGrid strokeDasharray="4 4" stroke="#f1f5f9" />
                        <XAxis dataKey="exitType" tick={{ fill: "#475569", fontSize: 12 }} />
                        <YAxis domain={[0, 100]} tick={{ fill: "#94a3b8", fontSize: 12 }} unit="%" />
                        <Tooltip content={<CT unit="%" />} />
                        <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                        {OES_Q_DEFS.map((q, i) => (
                          <Bar key={q.label} dataKey={q.label} name={q.label} fill={OES_COLORS[i % OES_COLORS.length]} fillOpacity={0.85} radius={[4, 4, 0, 0]} />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </FigCard>
              )}

              {oesComments.length > 0 && (
                <FigCard fig="Qualitative" title="Open Comments" subtitle="Verbatim exit feedback — aggregate view only">
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {oesComments.map((r, i) => (
                      <div key={i} style={{ padding: "11px 14px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, fontSize: 13, color: "#475569", borderLeft: "3px solid #0ea5e9" }}>
                        <span style={{ fontSize: 11, color: "#94a3b8", display: "block", marginBottom: 4 }}>
                          {[r.exit_type, r.delivery_unit, r.tenure_band, r.exit_date].filter(Boolean).join(" · ")}
                        </span>
                        "{r.open_comment}"
                      </div>
                    ))}
                    <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>{oesComments.length} comment{oesComments.length !== 1 ? "s" : ""}</div>
                  </div>
                </FigCard>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}