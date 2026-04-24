"use client"

import { useEffect, useState, useMemo } from "react"
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend,
  CartesianGrid, ResponsiveContainer, LineChart, Line, Cell,
} from "recharts"

import { createClient } from "@/utils/supabase/client"

const supabase = createClient()
// ─── Types ───────────────────────────────────────────────
interface MeiRawRow {
  "survey date"?: string; "function"?: string; "role level"?: string
  "location"?: string; "manager tenure"?: string
  "q7 improvement comment"?: string
  [key: string]: string | number | undefined
}
interface EpiiRawRow {
  "review cycle"?: string; "delivery unit"?: string; "job family"?: string
  "linked training intervention"?: string
  [key: string]: string | number | undefined
}

// ─── Helpers ─────────────────────────────────────────────
const LIKERT: Record<string, number> = { "strongly agree": 5, agree: 4, neutral: 3, disagree: 2, "strongly disagree": 1 }
const toLikert = (v: string | number | undefined): number | null => {
  if (typeof v === "number") return v
  return LIKERT[(v as string || "").trim().toLowerCase()] ?? null
}
const toNum = (v?: string | number): number => Number(v || 0)
const uniq = (arr: (string | undefined)[]): string[] =>
  [...new Set(arr.filter((v): v is string => !!v && v.trim() !== ""))].sort()
const avgArr = (nums: number[]): number =>
  nums.length ? Number((nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1)) : 0
const pct = (num: number, den: number): number =>
  den ? Number(((num / den) * 100).toFixed(1)) : 0
const likertToFav = (avg: number): number => Number(((avg - 1) / 4 * 100).toFixed(1))

// ─── Filter configs ───────────────────────────────────────
const MEI_FILTER_AFFECTS: Record<string, string[]> = {
  "Survey Period":   ["Fig 1", "Fig 2", "Fig 3"],
  "Function":        ["Fig 1", "Fig 2", "Fig 3"],
  "Role Level":      ["Fig 2", "Fig 3"],
  "Location":        ["Fig 2", "Fig 3"],
  "Manager Tenure":  ["Fig 2", "Fig 3"],
}

const EPII_FILTER_AFFECTS: Record<string, string[]> = {
  "Review Cycle":            ["Fig 1", "Fig 2", "Fig 3"],
  "Delivery Unit":           ["Fig 2", "Fig 3"],
  "Job Family":              ["Fig 2", "Fig 3"],
  "Training Intervention":   ["Fig 3"],
}

// ─── Month label map ──────────────────────────────────────
const MONTH_LABELS: Record<string, string> = {
  "01": "January", "02": "February", "03": "March", "04": "April",
  "05": "May",     "06": "June",     "07": "July",  "08": "August",
  "09": "September","10": "October", "11": "November","12": "December",
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
      No <strong>{label}</strong> data uploaded yet.<br />Go to the dashboard and upload a file first.
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

// ─── Month-Range Filter Bar (MEI only) ───────────────────
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
    backgroundColor: active ? accent + "08" : "#fff", backgroundImage: CHEVRON,
    backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center", backgroundSize: "12px 12px",
    color: active ? accent : "#64748b", cursor: "pointer", outline: "none",
    minWidth: w, boxShadow: active ? `0 0 0 3px ${accent}15` : "none",
    transition: "border .15s, box-shadow .15s, color .15s",
    appearance: "none" as const, WebkitAppearance: "none" as const,
  })

  const lbl = (txt: string) => (
    <label style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" as const, letterSpacing: ".06em" }}>{txt}</label>
  )

  const filteredMonths = selectedYear
    ? allMonths.filter(ym => ym.startsWith(selectedYear))
    : allMonths
  const monthOpts = filteredMonths.map(ym => {
    const [, m] = ym.split("-")
    return { value: ym, label: MONTH_LABELS[m] ?? m }
  })
  const toOpts   = monthFrom ? monthOpts.filter(o => o.value >= monthFrom) : monthOpts
  const fromOpts = monthTo   ? monthOpts.filter(o => o.value <= monthTo)   : monthOpts

  const activeRangeLabel = () => {
    if (!monthFrom && !monthTo) return null
    const toMonth = (ym: string) => MONTH_LABELS[ym.split("-")[1]] ?? ym.split("-")[1]
    const fLabel = monthFrom ? toMonth(monthFrom) : "Start"
    const tLabel = monthTo   ? toMonth(monthTo)   : "Latest"
    return `${fLabel} → ${tLabel}`
  }

  return (
    <Card style={{ padding: "20px 24px" }}>
      {/* Row 1: Category filter + year + value */}
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

      {/* Row 2: Month range */}
      {allMonths.length > 0 && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid #f1f5f9", display: "flex", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 2, alignSelf: "center" }}>
            📅 Month Range
          </div>
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
              <span style={{ fontSize: 11, fontWeight: 700, background: accent + "12", color: accent, border: `1px solid ${accent}25`, borderRadius: 20, padding: "4px 12px" }}>
                📅 {activeRangeLabel()}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Active filter summary */}
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

// ─── EPII Filter Bar (H1/H2 periods, no monthly range) ───
function EpiiFilterBar({
  filterKeys, affectsMap, years,
  filterType, filterValue, selectedYear, selectedPeriod,
  onFilterType, onFilterValue, onYear, onPeriod, onClear,
  accent, valueOptions,
}: {
  filterKeys: string[]; affectsMap: Record<string, string[]>; years: string[]
  allPeriods: string[]; filterType: string; filterValue: string
  selectedYear: string; selectedPeriod: string
  onFilterType: (v: string) => void; onFilterValue: (v: string) => void
  onYear: (v: string) => void; onPeriod: (v: string) => void; onClear: () => void
  accent: string; valueOptions: string[]
}) {
  const affects   = filterType ? affectsMap[filterType] ?? [] : []
  const hasActive = !!(filterType || selectedYear || selectedPeriod)

  const CHEVRON = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2.5'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`

  const sel = (active: boolean, w = 200): React.CSSProperties => ({
    padding: "9px 36px 9px 14px", borderRadius: 10, fontSize: 13, fontWeight: 600,
    border: active ? `1.5px solid ${accent}` : "1.5px solid #e2e8f0",
    backgroundColor: active ? accent + "08" : "#fff", backgroundImage: CHEVRON,
    backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center", backgroundSize: "12px 12px",
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
      {/* Row 1: Category filter + year + value */}
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
            <select value={selectedYear} onChange={e => { onYear(e.target.value); onPeriod("") }} style={sel(!!selectedYear, 160)}>
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

      {/* Active filter summary */}
      {hasActive && (
        <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid #f1f5f9", fontSize: 12, color: "#64748b", display: "flex", gap: 6, flexWrap: "wrap" }}>
          {selectedYear && <span style={{ background: "#f1f5f9", borderRadius: 6, padding: "2px 8px" }}>Year: <strong>{selectedYear}</strong></span>}
          {selectedPeriod && <span style={{ background: "#f1f5f9", borderRadius: 6, padding: "2px 8px" }}>Period: <strong>{selectedPeriod}</strong></span>}
          {filterType && <span style={{ background: "#f1f5f9", borderRadius: 6, padding: "2px 8px" }}>{filterType}: <strong>{filterValue || "All"}</strong></span>}
        </div>
      )}
    </Card>
  )
}

// ═══════════════════════════════════════════════════════════
//  MAIN
// ═══════════════════════════════════════════════════════════
export default function PerfReportsPage() {
  const [perfSummary, setPerfSummary] = useState<any>(null)
  const [meiRows, setMeiRows]   = useState<MeiRawRow[]>([])
  const [epiiRows, setEpiiRows] = useState<EpiiRawRow[]>([])
  const [activeTab, setActiveTab] = useState<"mei" | "epii">("mei")

  // MEI filter state
  const [meiFilterType,  setMeiFilterType]  = useState("")
  const [meiFilterValue, setMeiFilterValue] = useState("")
  const [meiYear,        setMeiYear]        = useState("")
  const [meiMonthFrom,   setMeiMonthFrom]   = useState("")
  const [meiMonthTo,     setMeiMonthTo]     = useState("")

  // EPII filter state — no month range, uses H1/H2 periods instead
  const [epiiFilterType,  setEpiiFilterType]  = useState("")
  const [epiiFilterValue, setEpiiFilterValue] = useState("")
  const [epiiYear,        setEpiiYear]        = useState("")
  const [epiiPeriod,      setEpiiPeriod]      = useState("") // e.g. "2024 H1"

  useEffect(() => {
  const loadFromSupabase = async () => {
    // Load MEI rows
    const { data: meiData } = await supabase
      .from("manager_effectiveness_responses")
      .select("survey_date, function, role_level, location, manager_tenure, q1_clarity, q2_support, q3_fairness, q4_feedback, q5_psychological_safety, q6_inclusion, q7_improvement_comment")

    if (meiData) {
      // Remap snake_case columns back to the flat key shape your charts expect
      const mapped = meiData.map(r => ({
        "survey date": r.survey_date ?? "",
        "function": r.function ?? "",
        "role level": r.role_level ?? "",
        "location": r.location ?? "",
        "manager tenure": r.manager_tenure ?? "",
        "q1 clarity": r.q1_clarity ?? "",
        "q2 support": r.q2_support ?? "",
        "q3 fairness": r.q3_fairness ?? "",
        "q4 feedback": r.q4_feedback ?? "",
        "q5 psychological safety": r.q5_psychological_safety ?? "",
        "q6 inclusion": r.q6_inclusion ?? "",
        "q7 improvement comment": r.q7_improvement_comment ?? "",
      }))
      setMeiRows(mapped)

      // Recompute summary pill
      let total = 0, count = 0
      meiData.forEach(r => {
        [r.q1_clarity, r.q2_support, r.q3_fairness, r.q4_feedback, r.q5_psychological_safety, r.q6_inclusion].forEach(v => {
          const s = toLikert(v); if (s !== null) { total += s; count++ }
        })
      })
      const fav = count ? Number(((total / count - 1) / 4 * 100).toFixed(1)) : null
      setPerfSummary((prev: any) => ({
        ...prev,
        mei: { value: fav, responses: meiData.length, loaded: !!meiData.length }
      }))
    }

    // Load EPII rows
    const { data: epiiData } = await supabase
      .from("employee_performance_improvement")
      .select("review_cycle, delivery_unit, job_family, total_employees, employees_improved, training_intervention")

    if (epiiData) {
      const mapped = epiiData.map(r => ({
        "review cycle": r.review_cycle ?? "",
        "delivery unit": r.delivery_unit ?? "",
        "job family": r.job_family ?? "",
        "total number of employees reviewed": r.total_employees ?? 0,
        "number of employees showing performance improvement": r.employees_improved ?? 0,
        "linked training intervention": r.training_intervention ?? "",
      }))
      setEpiiRows(mapped)

      const rev = epiiData.reduce((s, r) => s + (r.total_employees || 0), 0)
      const imp = epiiData.reduce((s, r) => s + (r.employees_improved || 0), 0)
      const rate = rev ? Number(((imp / rev) * 100).toFixed(1)) : null
      setPerfSummary((prev: any) => ({
        ...prev,
        epii: { value: rate, reviewed: rev, improved: imp, loaded: !!epiiData.length }
      }))
    }
  }

  loadFromSupabase()
}, [])

  const meiLoaded  = !!perfSummary?.mei?.loaded
  const epiiLoaded = !!perfSummary?.epii?.loaded

  // ── MEI DERIVED ─────────────────────────────────────────
  const MEI_Q_PREFIXES = ["q1", "q2", "q3", "q4", "q5", "q6"]
  const MEI_Q_LABELS   = ["Clarity", "Support", "Fairness", "Feedback", "Psych Safety", "Inclusion"]

  const meiQKeys = useMemo(() => {
    if (!meiRows.length) return MEI_Q_PREFIXES
    const keys = Object.keys(meiRows[0])
    return MEI_Q_PREFIXES.map(p => keys.find(k => k.startsWith(p)) ?? p)
  }, [meiRows])

  const meiAllMonths = useMemo(() =>
    uniq(meiRows.map(r => (r["survey date"] as string || "").slice(0, 7)).filter(Boolean))
  , [meiRows])

  const meiYears = useMemo(() =>
    uniq(meiRows.map(r => (r["survey date"] as string || "").slice(0, 4)))
  , [meiRows])

  const meiValueOptions = useMemo((): string[] => {
    switch (meiFilterType) {
      case "Function":       return uniq(meiRows.map(r => (r["function"] as string || "").trim()))
      case "Role Level":     return uniq(meiRows.map(r => (r["role level"] as string || "").trim()))
      case "Location":       return uniq(meiRows.map(r => (r["location"] as string || "").trim()))
      case "Manager Tenure": return uniq(meiRows.map(r => (r["manager tenure"] as string || "").trim()))
      default: return []
    }
  }, [meiFilterType, meiRows])

  const meiVisibleFigs = useMemo(() =>
    meiFilterType ? MEI_FILTER_AFFECTS[meiFilterType] ?? [] : ["Fig 1", "Fig 2", "Fig 3"]
  , [meiFilterType])

  const meiYearFiltered = useMemo(() => {
    let rows = meiRows
    if (meiMonthFrom || meiMonthTo) {
      rows = rows.filter(r => {
        const ym = (r["survey date"] as string || "").slice(0, 7)
        if (!ym) return false
        if (meiMonthFrom && ym < meiMonthFrom) return false
        if (meiMonthTo   && ym > meiMonthTo)   return false
        return true
      })
    } else if (meiYear) {
      rows = rows.filter(r => (r["survey date"] as string || "").startsWith(meiYear))
    }
    return rows
  }, [meiRows, meiYear, meiMonthFrom, meiMonthTo])

  const meiFiltered = useMemo(() => {
    if (!meiFilterType || !meiFilterValue) return meiYearFiltered
    return meiYearFiltered.filter(r => {
      switch (meiFilterType) {
        case "Survey Period":  return (r["survey date"] as string || "").startsWith(meiFilterValue)
        case "Function":       return (r["function"] as string || "").trim() === meiFilterValue
        case "Role Level":     return (r["role level"] as string || "").trim() === meiFilterValue
        case "Location":       return (r["location"] as string || "").trim() === meiFilterValue
        case "Manager Tenure": return (r["manager tenure"] as string || "").trim() === meiFilterValue
        default: return true
      }
    })
  }, [meiYearFiltered, meiFilterType, meiFilterValue])

  const meiCalcFav = (rows: MeiRawRow[]) => {
    let total = 0; let count = 0
    rows.forEach(r => meiQKeys.forEach(k => { const s = toLikert(r[k]); if (s !== null) { total += s; count++ } }))
    return count ? likertToFav(total / count) : 0
  }

  const meiFig1 = useMemo(() => {
    const map: Record<string, MeiRawRow[]> = {}
    meiFiltered.forEach(r => {
      const period = (r["survey date"] as string || "").slice(0, 7)
      if (!period) return
      if (!map[period]) map[period] = []
      map[period].push(r)
    })
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([period, rows]) => ({ period, fav: meiCalcFav(rows) }))
  }, [meiFiltered, meiQKeys])

  const meiFig2 = useMemo(() =>
    meiQKeys.map((k, i) => {
      const scores = meiFiltered.map(r => toLikert(r[k])).filter((v): v is number => v !== null)
      return { dimension: MEI_Q_LABELS[i] ?? k, fav: scores.length ? likertToFav(avgArr(scores)) : 0 }
    })
  , [meiFiltered, meiQKeys])

  const meiLowest = useMemo(() => [...meiFig2].sort((a, b) => a.fav - b.fav)[0], [meiFig2])

  const meiFig3 = useMemo(() => {
    const map: Record<string, MeiRawRow[]> = {}
    meiFiltered.forEach(r => {
      const fn = (r["function"] as string || "Unknown").trim()
      if (!map[fn]) map[fn] = []
      map[fn].push(r)
    })
    return Object.entries(map).map(([fn, rows]) => ({ function: fn, fav: meiCalcFav(rows) }))
  }, [meiFiltered, meiQKeys])

  const meiComments = useMemo(() => meiFiltered.filter(r => r["q7 improvement comment"]), [meiFiltered])

  const meiHeadline = useMemo(() => ({
    fav: meiCalcFav(meiFiltered), responses: meiFiltered.length
  }), [meiFiltered, meiQKeys])

  const meiC = (v: number) => v >= 75 ? "#6366f1" : v >= 50 ? "#6366f1" : "#ef4444"

  // ── EPII DERIVED ─────────────────────────────────────────
  const epiiReviewedKey = useMemo(() => {
    if (!epiiRows.length) return ""
    return Object.keys(epiiRows[0]).find(k => k.includes("total number of employees reviewed")) ?? ""
  }, [epiiRows])

  const epiiImprovedKey = useMemo(() => {
    if (!epiiRows.length) return ""
    return Object.keys(epiiRows[0]).find(k => k.includes("number of employees showing performance")) ?? ""
  }, [epiiRows])

  // Derive unique H1/H2 period labels from review cycle field
  // Expects values like "2024 H1", "2024 H2", "H1 2024", etc.
  // Falls back to the raw review cycle value if no H1/H2 pattern found
  const epiiAllPeriods = useMemo(() =>
    uniq(epiiRows.map(r => (r["review cycle"] as string || "").trim()).filter(Boolean))
  , [epiiRows])

  const epiiYears = useMemo(() =>
    uniq(epiiRows.map(r => {
      const cycle = (r["review cycle"] as string || "").trim()
      const match = cycle.match(/\b(20\d{2})\b/)
      return match ? match[1] : ""
    }).filter(Boolean))
  , [epiiRows])

  const epiiValueOptions = useMemo((): string[] => {
    switch (epiiFilterType) {
      case "Review Cycle":          return uniq(epiiRows.map(r => r["review cycle"] as string))
      case "Delivery Unit":         return uniq(epiiRows.map(r => (r["delivery unit"] as string || "").trim()))
      case "Job Family":            return uniq(epiiRows.map(r => (r["job family"] as string || "").trim()))
      case "Training Intervention": return uniq(epiiRows.map(r => (r["linked training intervention"] as string || "").trim()))
      default: return []
    }
  }, [epiiFilterType, epiiRows])

  const epiiVisibleFigs = useMemo(() =>
    epiiFilterType ? EPII_FILTER_AFFECTS[epiiFilterType] ?? [] : ["Fig 1", "Fig 2", "Fig 3"]
  , [epiiFilterType])

  // Apply year OR period filter (no month range)
  const epiiYearFiltered = useMemo(() => {
    let rows = epiiRows
    if (epiiPeriod) {
      // Filter by exact period match on review cycle
      rows = rows.filter(r => (r["review cycle"] as string || "").trim() === epiiPeriod)
    } else if (epiiYear) {
      // Filter rows whose review cycle contains the selected year
      rows = rows.filter(r => (r["review cycle"] as string || "").includes(epiiYear))
    }
    return rows
  }, [epiiRows, epiiYear, epiiPeriod])

  const epiiFiltered = useMemo(() => {
    if (!epiiFilterType || !epiiFilterValue) return epiiYearFiltered
    return epiiYearFiltered.filter(r => {
      switch (epiiFilterType) {
        case "Review Cycle":          return r["review cycle"] === epiiFilterValue
        case "Delivery Unit":         return (r["delivery unit"] as string || "").trim() === epiiFilterValue
        case "Job Family":            return (r["job family"] as string || "").trim() === epiiFilterValue
        case "Training Intervention": return (r["linked training intervention"] as string || "").trim() === epiiFilterValue
        default: return true
      }
    })
  }, [epiiYearFiltered, epiiFilterType, epiiFilterValue])

  const epiiFig1 = useMemo(() => {
    const cycles = uniq(epiiFiltered.map(r => r["review cycle"] as string))
    return cycles.map(c => {
      const rows = epiiFiltered.filter(r => r["review cycle"] === c)
      const rev  = rows.reduce((s, r) => s + toNum(r[epiiReviewedKey]), 0)
      const imp  = rows.reduce((s, r) => s + toNum(r[epiiImprovedKey]), 0)
      return { cycle: c, rate: pct(imp, rev) }
    })
  }, [epiiFiltered, epiiReviewedKey, epiiImprovedKey])

  const epiiFig2 = useMemo(() => {
    const map: Record<string, { rev: number; imp: number }> = {}
    epiiFiltered.forEach(r => {
      const du = (r["delivery unit"] as string || "Unknown").trim()
      if (!map[du]) map[du] = { rev: 0, imp: 0 }
      map[du].rev += toNum(r[epiiReviewedKey])
      map[du].imp += toNum(r[epiiImprovedKey])
    })
    return Object.entries(map).map(([du, d]) => ({ unit: du, reviewed: d.rev, improved: d.imp, rate: pct(d.imp, d.rev) }))
  }, [epiiFiltered, epiiReviewedKey, epiiImprovedKey])

  const epiiFig3 = epiiFig2

  const epiiHeadline = useMemo(() => {
    const rev = epiiFiltered.reduce((s, r) => s + toNum(r[epiiReviewedKey]), 0)
    const imp = epiiFiltered.reduce((s, r) => s + toNum(r[epiiImprovedKey]), 0)
    return { reviewed: rev, improved: imp, rate: pct(imp, rev) }
  }, [epiiFiltered, epiiReviewedKey, epiiImprovedKey])

  const epiiC = (v: number) => v >= 60 ? "#10b981" : v >= 40 ? "#f59e0b" : "#ef4444"

  const TABS = [
    { key: "mei",  label: "Manager Effectiveness Index",  accent: "#6366f1", loaded: meiLoaded },
    { key: "epii", label: "Performance Improvement Rate", accent: "#10b981", loaded: epiiLoaded },
  ] as const

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>

      {/* KPI row */}
      {perfSummary && (meiLoaded || epiiLoaded) && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12, marginBottom: 8 }}>
          {meiLoaded && (
            <Card style={{ padding: "16px 20px" }}>
              <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6 }}>Manager Effectiveness Index</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                <span style={{ fontSize: 30, fontWeight: 800, color: "#6366f1", lineHeight: 1 }}>{perfSummary.mei.value ?? "—"}</span>
                <span style={{ fontSize: 12, color: "#6366f1", fontWeight: 600 }}>%</span>
              </div>
              <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 3 }}>{perfSummary.mei.responses} responses</div>
            </Card>
          )}
          {epiiLoaded && (
            <Card style={{ padding: "16px 20px" }}>
              <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6 }}>Performance Improvement Rate</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                <span style={{ fontSize: 30, fontWeight: 800, color: "#10b981", lineHeight: 1 }}>{perfSummary.epii.value ?? "—"}</span>
                <span style={{ fontSize: 12, color: "#10b98199", fontWeight: 600 }}>%</span>
              </div>
              <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 3 }}>{perfSummary.epii.improved} / {perfSummary.epii.reviewed} employees</div>
            </Card>
          )}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            style={{ padding: "8px 20px", borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: "pointer", border: "none", transition: "all .18s", background: activeTab === t.key ? t.accent : "#fff", color: activeTab === t.key ? "#fff" : t.loaded ? "#475569" : "#cbd5e1", opacity: t.loaded ? 1 : 0.45, boxShadow: activeTab === t.key ? `0 4px 14px ${t.accent}45` : "0 1px 3px rgba(0,0,0,.06)" }}>
            {t.loaded ? "●" : "○"} {t.label}
          </button>
        ))}
      </div>

      {/* ── MEI ── */}
      {activeTab === "mei" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {!meiLoaded ? <Card><EmptyState label="Manager Effectiveness Index" /></Card> : (
            <>
              <MonthRangeFilterBar
                filterKeys={Object.keys(MEI_FILTER_AFFECTS)}
                affectsMap={MEI_FILTER_AFFECTS}
                years={meiYears}
                allMonths={meiAllMonths}
                filterType={meiFilterType}
                filterValue={meiFilterValue}
                selectedYear={meiYear}
                monthFrom={meiMonthFrom}
                monthTo={meiMonthTo}
                onFilterType={setMeiFilterType}
                onFilterValue={setMeiFilterValue}
                onYear={setMeiYear}
                onMonthFrom={setMeiMonthFrom}
                onMonthTo={setMeiMonthTo}
                onClear={() => { setMeiFilterType(""); setMeiFilterValue(""); setMeiYear(""); setMeiMonthFrom(""); setMeiMonthTo("") }}
                accent="#6366f1"
                valueOptions={meiValueOptions}
              />

              <Card>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 14 }}>Manager Effectiveness Index — Summary</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10 }}>
                  <StatPill label="MEI Favorability"   value={`${meiHeadline.fav}%`}       accent="#6366f1" sub="Across all 6 dimensions" />
                  <StatPill label="Survey Responses"   value={meiHeadline.responses}         accent="#6366f1" />
                  {meiLowest?.fav >= 0 && <StatPill label="Lowest Dimension" value={meiLowest.dimension} accent="#ef4444" sub={`${meiLowest.fav}% favorability`} />}
                </div>
              </Card>

              {meiVisibleFigs.includes("Fig 1") && (
                <FigCard fig="Fig 1" title="Manager Effectiveness Index by Survey Period" subtitle="Line chart · trend over time · affected by: Survey Period, Function">
                  {meiFig1.length < 2 ? <EmptyChart msg="Need ≥2 survey periods to show trend" /> : (
                    <ResponsiveContainer width="100%" height={280}>
                      <LineChart data={meiFig1} margin={{ top: 10, right: 30, left: 0, bottom: 10 }}>
                        <CartesianGrid strokeDasharray="4 4" stroke="#f1f5f9" />
                        <XAxis dataKey="period" tick={{ fill: "#94a3b8", fontSize: 12 }} />
                        <YAxis domain={[0, 100]} tick={{ fill: "#94a3b8", fontSize: 12 }} unit="%" />
                        <Tooltip content={<CT unit="%" />} />
                        <Line type="monotone" dataKey="fav" name="MEI" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 5, fill: "#6366f1", strokeWidth: 0 }} activeDot={{ r: 7 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </FigCard>
              )}

              {meiVisibleFigs.includes("Fig 2") && (
                <FigCard fig="Fig 2" title="Favorability by Manager Effectiveness Dimension" subtitle="Horizontal bar · affected by: Survey Period, Function, Role Level, Location, Manager Tenure">
                  {meiFig2.every(d => d.fav === 0) ? <EmptyChart msg="No scores in current selection" /> : (
                    <ResponsiveContainer width="100%" height={Math.max(200, meiFig2.length * 48)}>
                      <BarChart layout="vertical" data={meiFig2} margin={{ top: 4, right: 60, left: 10, bottom: 4 }}>
                        <CartesianGrid strokeDasharray="4 4" stroke="#f1f5f9" horizontal={false} />
                        <XAxis type="number" domain={[0, 100]} tick={{ fill: "#94a3b8", fontSize: 11 }} unit="%" />
                        <YAxis type="category" dataKey="dimension" tick={{ fill: "#475569", fontSize: 12 }} width={120} />
                        <Tooltip content={<CT unit="%" />} />
                        <Bar dataKey="fav" name="Favorability" radius={[0, 6, 6, 0]}>
                          {meiFig2.map((d, i) => <Cell key={i} fill={d.dimension === meiLowest?.dimension ? "#ef4444" : "#6366f1"} fillOpacity={d.dimension === meiLowest?.dimension ? 1 : 0.75} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </FigCard>
              )}

              {meiVisibleFigs.includes("Fig 3") && (
                <FigCard fig="Fig 3" title="Manager Effectiveness by Function" subtitle="Clustered bar · affected by: Survey Period, Function, Role Level, Location">
                  {meiFig3.length === 0 ? <EmptyChart msg="No function data in current selection" /> : (
                    <ResponsiveContainer width="100%" height={Math.max(220, meiFig3.length * 52)}>
                      <BarChart layout="vertical" data={meiFig3} margin={{ top: 4, right: 60, left: 10, bottom: 4 }}>
                        <CartesianGrid strokeDasharray="4 4" stroke="#f1f5f9" horizontal={false} />
                        <XAxis type="number" domain={[0, 100]} tick={{ fill: "#94a3b8", fontSize: 11 }} unit="%" />
                        <YAxis type="category" dataKey="function" tick={{ fill: "#475569", fontSize: 12 }} width={130} />
                        <Tooltip content={<CT unit="%" />} />
                        <Bar dataKey="fav" name="MEI Favorability" radius={[0, 6, 6, 0]}>
                          {meiFig3.map((d, i) => <Cell key={i} fill={meiC(d.fav)} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </FigCard>
              )}

              {meiComments.length > 0 && (
                <FigCard fig="Qualitative" title="Improvement Themes (Q7)" subtitle="Open-ended feedback from survey respondents">
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {meiComments.map((r, i) => (
                      <div key={i} style={{ padding: "11px 14px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, fontSize: 13, color: "#475569", borderLeft: "3px solid #6366f1" }}>
                        <span style={{ fontSize: 11, color: "#94a3b8", display: "block", marginBottom: 4 }}>{r["function"]} · {r["role level"]} · {r["survey date"]}</span>
                        "{r["q7 improvement comment"]}"
                      </div>
                    ))}
                    <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>{meiComments.length} comment{meiComments.length !== 1 ? "s" : ""}</div>
                  </div>
                </FigCard>
              )}
            </>
          )}
        </div>
      )}

      {/* ── EPII ── */}
      {activeTab === "epii" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {!epiiLoaded ? <Card><EmptyState label="Performance Improvement Rate" /></Card> : (
            <>
              <EpiiFilterBar
                filterKeys={Object.keys(EPII_FILTER_AFFECTS)}
                affectsMap={EPII_FILTER_AFFECTS}
                years={epiiYears}
                allPeriods={epiiAllPeriods}
                filterType={epiiFilterType}
                filterValue={epiiFilterValue}
                selectedYear={epiiYear}
                selectedPeriod={epiiPeriod}
                onFilterType={setEpiiFilterType}
                onFilterValue={setEpiiFilterValue}
                onYear={setEpiiYear}
                onPeriod={setEpiiPeriod}
                onClear={() => { setEpiiFilterType(""); setEpiiFilterValue(""); setEpiiYear(""); setEpiiPeriod("") }}
                accent="#10b981"
                valueOptions={epiiValueOptions}
              />

              <Card>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 14 }}>Performance Improvement Rate — Summary</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10 }}>
                  <StatPill label="Improvement Rate"    value={`${epiiHeadline.rate}%`}    accent="#10b981" sub="Improved ÷ Reviewed" />
                  <StatPill label="Employees Reviewed"  value={epiiHeadline.reviewed}       accent="#10b981" />
                  <StatPill label="Showing Improvement" value={epiiHeadline.improved}       accent="#10b981" />
                </div>
              </Card>

              {epiiVisibleFigs.includes("Fig 1") && (
                <FigCard fig="Fig 1" title="Improvement Rate by Review Cycle" subtitle="Line chart · trend over time · affected by: Review Cycle">
                  {epiiFig1.length < 2 ? <EmptyChart msg="Need ≥2 review cycles to show trend" /> : (
                    <ResponsiveContainer width="100%" height={280}>
                      <LineChart data={epiiFig1} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                        <CartesianGrid strokeDasharray="4 4" stroke="#f1f5f9" />
                        <XAxis dataKey="cycle" tick={{ fill: "#94a3b8", fontSize: 12 }} />
                        <YAxis domain={[0, 100]} tick={{ fill: "#94a3b8", fontSize: 12 }} unit="%" />
                        <Tooltip content={<CT unit="%" />} />
                        <Line type="monotone" dataKey="rate" name="Improvement Rate" stroke="#10b981" strokeWidth={2.5} dot={{ r: 5, fill: "#10b981", strokeWidth: 0 }} activeDot={{ r: 7 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </FigCard>
              )}

              {epiiVisibleFigs.includes("Fig 2") && (
                <FigCard fig="Fig 2" title="Employees Improved vs. Comparable Population by Delivery Unit" subtitle="Clustered column · affected by: Delivery Unit, Job Family">
                  {epiiFig2.length === 0 ? <EmptyChart msg="No delivery unit data" /> : (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={epiiFig2} margin={{ top: 10, right: 20, left: 0, bottom: 60 }}>
                        <CartesianGrid strokeDasharray="4 4" stroke="#f1f5f9" />
                        <XAxis dataKey="unit" tick={{ fill: "#475569", fontSize: 11 }} angle={-35} textAnchor="end" interval={0} />
                        <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} />
                        <Tooltip content={<CT />} />
                        <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                        <Bar dataKey="reviewed" name="Employees Reviewed" fill="#94a3b8" fillOpacity={0.6} radius={[4, 4, 0, 0]} />
                        <Bar dataKey="improved" name="Showing Improvement" fill="#10b981" fillOpacity={0.85} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </FigCard>
              )}

              {epiiVisibleFigs.includes("Fig 3") && (
                <FigCard fig="Fig 3" title="Improvement Rate by Delivery Unit" subtitle="Horizontal bar · affected by: Delivery Unit, Job Family, Training Intervention">
                  {epiiFig3.length === 0 ? <EmptyChart msg="No delivery unit data" /> : (
                    <ResponsiveContainer width="100%" height={Math.max(200, epiiFig3.length * 50)}>
                      <BarChart layout="vertical" data={epiiFig3} margin={{ top: 4, right: 60, left: 10, bottom: 4 }}>
                        <CartesianGrid strokeDasharray="4 4" stroke="#f1f5f9" horizontal={false} />
                        <XAxis type="number" domain={[0, 100]} tick={{ fill: "#94a3b8", fontSize: 11 }} unit="%" />
                        <YAxis type="category" dataKey="unit" tick={{ fill: "#475569", fontSize: 12 }} width={130} />
                        <Tooltip content={<CT unit="%" />} />
                        <Bar dataKey="rate" name="Improvement Rate" radius={[0, 6, 6, 0]}>
                          {epiiFig3.map((d, i) => <Cell key={i} fill={epiiC(d.rate)} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </FigCard>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}