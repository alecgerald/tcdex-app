"use client"

import { useState, useEffect, useMemo } from "react"
import { createClient } from "@/utils/supabase/client"
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend,
  CartesianGrid, ResponsiveContainer, LineChart, Line,
  PieChart, Pie, Cell, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis,
} from "recharts"

const supabase = createClient()

// ═══════════════════════════════════════════════════════════
//  TYPES
// ═══════════════════════════════════════════════════════════

interface TtpRow {
  employee_id:            string | null
  start_date:             string | null
  role_job_family:        string | null
  delivery_unit:          string | null
  productivity_confirmed: string | null
  confirmed_by:           string | null
  ttp_days:               number | null
}

interface NheRow {
  submission_date: string | null
  delivery_unit:   string | null
  location:        string | null
  job_title:       string | null
  supervisor_name: string | null
  q4_1: number | null;  q4_2: number | null;  q4_3: number | null;  q4_4: number | null;  q4_5: number | null
  q7_1: number | null;  q7_2: number | null;  q7_3: number | null
  q10_1: number | null; q10_2: number | null; q10_3: number | null; q10_4: number | null; q10_5: number | null
  q13_1: number | null; q13_2: number | null; q13_3: number | null; q13_4: number | null; q13_5: number | null
  q22_1: number | null; q22_2: number | null; q22_3: number | null; q22_4: number | null
  q25_1: number | null; q25_2: number | null; q25_3: number | null; q25_4: number | null
  q25_5: number | null; q25_6: number | null; q25_7: number | null; q25_8: number | null
  q28_1: number | null; q28_2: number | null; q28_3: number | null; q28_4: number | null
  q31_1: number | null; q31_2: number | null; q31_3: number | null; q31_4: number | null; q31_5: number | null
  q34_1: number | null
  q38_1: number | null; q38_2: number | null; q38_3: number | null; q38_4: number | null
  q38_5: number | null; q38_6: number | null; q38_7: number | null
}

interface Ll60Row {
  session_date:           string | null
  hire_period:            string | null
  session_type:           string | null
  participant_count:      number | null
  delivery_unit:          string | null
  location:               string | null
  motivation_engagement:  string | null
  manager_relationship:   string | null
  team_belonging:         string | null
  workload_stress:        string | null
  growth_future_outlook:  string | null
  recognition_value:      string | null
  avg_journey_rating:     number | null
  recommend_percent:      number | null
  overall_retention_risk: string | null
}

interface TcrRow {
  cohort:            string | null
  role_job_family:   string | null
  training_modality: string | null
  total_enrolled:    number | null
  total_completed:   number | null
  completion_deadline: string | null
}

// ═══════════════════════════════════════════════════════════
//  NHE SCORING ENGINE (from raw Supabase scores)
// ═══════════════════════════════════════════════════════════

const LL30_CATS = [
  { id: "fde",   label: "First-Day Exp & Orientation",  questions: ["q4_1","q4_2","q4_3","q4_4","q4_5"]                                          as const, isOOE: false },
  { id: "rc",    label: "Role Clarity & Expectations",   questions: ["q7_1","q7_2","q7_3"]                                                         as const, isOOE: false },
  { id: "ms",    label: "Manager Support & Feedback",    questions: ["q10_1","q10_2","q10_3","q10_4","q10_5"]                                       as const, isOOE: false },
  { id: "tc",    label: "Team Culture & Belonging",      questions: ["q13_1","q13_2","q13_3","q13_4","q13_5"]                                       as const, isOOE: false },
  { id: "tools", label: "Tools & Systems",               questions: ["q22_1","q22_2","q22_3","q22_4"]                                              as const, isOOE: false },
  { id: "cwt",   label: "Company-wide Training",         questions: ["q25_1","q25_2","q25_3","q25_4","q25_5","q25_6","q25_7","q25_8"]               as const, isOOE: false },
  { id: "dut",   label: "DU-Specific Training",          questions: ["q28_1","q28_2","q28_3","q28_4"]                                              as const, isOOE: false },
  { id: "pgfo",  label: "Growth & Future Outlook",       questions: ["q31_1","q31_2","q31_3","q31_4","q31_5"]                                       as const, isOOE: false },
  { id: "ooe",   label: "Overall Onboarding Experience", questions: ["q34_1"]                                                                       as const, isOOE: true  },
  { id: "hrsf",  label: "HR & Support Functions",        questions: ["q38_1","q38_2","q38_3","q38_4","q38_5","q38_6","q38_7"]                       as const, isOOE: false },
]

interface CatResult {
  label: string; avgPct: number; promoterPct: number; count: number
}

function rowAvgForCat(r: NheRow, questions: readonly string[]): number | null {
  const vals = questions.map(q => r[q as keyof NheRow] as number | null).filter((v): v is number => v !== null && v >= 1)
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
}

function calcNheCats(rows: NheRow[]): Record<string, CatResult> {
  const result: Record<string, CatResult> = {}
  LL30_CATS.forEach(cat => {
    let totalPct = 0, count = 0, promoters = 0
    rows.forEach(r => {
      const ra = rowAvgForCat(r, cat.questions)
      if (ra === null) return
      count++
      const p = cat.isOOE ? ((ra - 1) / 4) * 100 : ((ra - 1) / 3) * 100
      totalPct += p
      if (cat.isOOE ? ra >= 5 : ra >= 4) promoters++
    })
    if (count > 0) result[cat.id] = {
      label: cat.label,
      avgPct: Number((totalPct / count).toFixed(1)),
      promoterPct: Math.round((promoters / count) * 100),
      count,
    }
  })
  return result
}

// ═══════════════════════════════════════════════════════════
//  LL60 CONFIG
// ═══════════════════════════════════════════════════════════

const LL60_DIMENSIONS: { key: keyof Ll60Row; label: string; short: string }[] = [
  { key: "motivation_engagement",  label: "Motivation & Engagement",  short: "Motivation"  },
  { key: "manager_relationship",   label: "Manager Relationship",      short: "Manager"     },
  { key: "team_belonging",         label: "Team Belonging",            short: "Belonging"   },
  { key: "workload_stress",        label: "Workload & Stress",         short: "Workload"    },
  { key: "growth_future_outlook",  label: "Growth & Future Outlook",   short: "Growth"      },
  { key: "recognition_value",      label: "Recognition & Value",       short: "Recognition" },
]

function parseSignal(raw: string | null): "positive" | "neutral" | "negative" {
  const v = (raw ?? "").trim().toLowerCase()
  if (v.includes("positive")) return "positive"
  if (v.includes("negative") || v.includes("risk signal")) return "negative"
  return "neutral"
}

// ═══════════════════════════════════════════════════════════
//  FILTER CONFIG
// ═══════════════════════════════════════════════════════════

const TTP_FILTER_AFFECTS:  Record<string, string[]> = {
  "Start Date": ["Fig 1","Fig 2","Fig 3"], "Onboarding Cohort": ["Fig 1","Fig 2","Fig 3"],
  "Delivery Unit": ["Fig 2","Fig 3"], "Role / Job Family": ["Fig 2","Fig 3"],
  "Productivity Confirmed": ["Fig 3"], "Manager": ["Fig 2"],
}
const NHE_FILTER_AFFECTS: Record<string, string[]> = {
  "Delivery Unit": ["Fig 1","Fig 2","Fig 3","Fig 4"], "Location": ["Fig 1","Fig 2","Fig 3","Fig 4"],
  "Manager": ["Fig 1","Fig 2","Fig 3","Fig 4"],
}
const LL60_FILTER_AFFECTS: Record<string, string[]> = {
  "Session Date": ["Fig 1","Fig 2","Fig 3","Fig 4","Fig 5"],
  "Delivery Unit": ["Fig 1","Fig 2","Fig 3","Fig 4","Fig 5"],
  "Session Type": ["Fig 1","Fig 2","Fig 3","Fig 4","Fig 5"],
  "Work Arrangement": ["Fig 1","Fig 2","Fig 3","Fig 4","Fig 5"],
  "Hire Period": ["Fig 1","Fig 2","Fig 3","Fig 4","Fig 5"],
  "Retention Risk": ["Fig 3","Fig 5"],
}
const TCR_FILTER_AFFECTS: Record<string, string[]> = {
  "Cohort": ["Fig 1","Fig 2"], "Role / Job Family": ["Fig 2","Fig 3"],
  "Training Modality": ["Fig 3"], "Completion Deadline": ["Fig 1","Fig 2"],
}

// ═══════════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════════

const toNum = (v: number | null | undefined): number => v ?? 0
const uniq = (arr: (string | null | undefined)[]): string[] =>
  [...new Set(arr.filter((v): v is string => !!v))].sort()
const avgArr = (nums: number[]): number =>
  nums.length ? Number((nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1)) : 0
const pct = (num: number, den: number): number =>
  den ? Number(((num / den) * 100).toFixed(1)) : 0

const MONTH_LABELS: Record<string, string> = {
  "01":"January","02":"February","03":"March","04":"April",
  "05":"May","06":"June","07":"July","08":"August",
  "09":"September","10":"October","11":"November","12":"December",
}

// ═══════════════════════════════════════════════════════════
//  UI PRIMITIVES
// ═══════════════════════════════════════════════════════════

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
      No <strong>{label}</strong> data found.<br />Go to the Onboarding dashboard and upload a file first.
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

function LoadingSpinner({ accent }: { accent: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "60px 24px", gap: 10, color: "#94a3b8", fontSize: 13 }}>
      <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: accent, animation: "pulse 1s infinite" }} />
      Loading data from database…
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}`}</style>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
//  FILTER BAR
// ═══════════════════════════════════════════════════════════

function FilterBar({
  filterKeys, affectsMap, years, allMonths,
  filterType, filterValue, selectedYear, monthFrom, monthTo,
  onFilterType, onFilterValue, onYear, onMonthFrom, onMonthTo, onClear,
  accent, valueOptions,
}: {
  filterKeys: string[]; affectsMap: Record<string, string[]>; years: string[]; allMonths: string[]
  filterType: string; filterValue: string; selectedYear: string; monthFrom: string; monthTo: string
  onFilterType: (v: string) => void; onFilterValue: (v: string) => void; onYear: (v: string) => void
  onMonthFrom: (v: string) => void; onMonthTo: (v: string) => void; onClear: () => void
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
    color: active ? accent : "#64748b", cursor: "pointer", outline: "none", minWidth: w,
    boxShadow: active ? `0 0 0 3px ${accent}15` : "none",
    transition: "border .15s, box-shadow .15s, color .15s",
    appearance: "none" as const, WebkitAppearance: "none" as const,
  })
  const lbl = (txt: string) => (
    <label style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" as const, letterSpacing: ".06em" }}>{txt}</label>
  )

  const filteredMonths = selectedYear ? allMonths.filter(ym => ym.startsWith(selectedYear)) : allMonths
  const monthOpts      = filteredMonths.map(ym => { const [, m] = ym.split("-"); return { value: ym, label: MONTH_LABELS[m] ?? m } })
  const fromOpts       = monthTo   ? monthOpts.filter(o => o.value <= monthTo)   : monthOpts
  const toOpts         = monthFrom ? monthOpts.filter(o => o.value >= monthFrom) : monthOpts

  const activeRangeLabel = () => {
    const toMonth = (ym: string) => MONTH_LABELS[ym.split("-")[1]] ?? ym.split("-")[1]
    return `${monthFrom ? toMonth(monthFrom) : "Start"} → ${monthTo ? toMonth(monthTo) : "Latest"}`
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

      {/* Month range — only shown when allMonths is non-empty */}
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
          <div style={{ alignSelf: "flex-end", paddingBottom: 10, color: "#cbd5e1", fontSize: 18 }}>→</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {lbl("To")}
            <select value={monthTo} onChange={e => onMonthTo(e.target.value)} style={sel(!!monthTo, 190)}>
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

      {/* Active filter summary */}
      {hasActive && (
        <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid #f1f5f9", fontSize: 12, color: "#64748b", display: "flex", gap: 6, flexWrap: "wrap" }}>
          {selectedYear && !usingRange && <span style={{ background: "#f1f5f9", borderRadius: 6, padding: "2px 8px" }}>Year: <strong>{selectedYear}</strong></span>}
          {usingRange && <span style={{ background: "#f1f5f9", borderRadius: 6, padding: "2px 8px" }}>Range: <strong>{activeRangeLabel()}</strong></span>}
          {filterType && <span style={{ background: "#f1f5f9", borderRadius: 6, padding: "2px 8px" }}>{filterType}: <strong>{filterValue || "All"}</strong></span>}
        </div>
      )}
    </Card>
  )
}

// ═══════════════════════════════════════════════════════════
//  MAIN
// ═══════════════════════════════════════════════════════════

export default function OnboardingReportsPage() {
  const [activeTab, setActiveTab] = useState<"ttp" | "nhe" | "ll60" | "tcr">("ttp")

  // ── Raw data from Supabase ──────────────────────────────
  const [ttpRows,  setTtpRows]  = useState<TtpRow[]>([])
  const [nheRows,  setNheRows]  = useState<NheRow[]>([])
  const [ll60Rows, setLl60Rows] = useState<Ll60Row[]>([])
  const [tcrRows,  setTcrRows]  = useState<TcrRow[]>([])

  // ── Loading / error ─────────────────────────────────────
  const [loading, setLoading] = useState<Record<string, boolean>>({ ttp: true, nhe: true, ll60: true, tcr: true })
  const [error,   setError]   = useState<string | null>(null)

  // ── Filter state ────────────────────────────────────────
  const [ttpFT,  setTtpFT]  = useState(""); const [ttpFV,  setTtpFV]  = useState(""); const [ttpYr, setTtpYr] = useState(""); const [ttpMF, setTtpMF] = useState(""); const [ttpMT, setTtpMT] = useState("")
  const [nheFT,  setNheFT]  = useState(""); const [nheFV,  setNheFV]  = useState(""); const [nheYr, setNheYr] = useState(""); const [nheMF, setNheMF] = useState(""); const [nheMT, setNheMT] = useState("")
  const [l6FT,   setL6FT]   = useState(""); const [l6FV,   setL6FV]   = useState(""); const [l6Yr,  setL6Yr]  = useState(""); const [l6MF,  setL6MF]  = useState(""); const [l6MT,  setL6MT]  = useState("")
  const [tcrFT,  setTcrFT]  = useState(""); const [tcrFV,  setTcrFV]  = useState(""); const [tcrYr, setTcrYr] = useState("")

  // ── Fetch all on mount ──────────────────────────────────
  useEffect(() => {
    fetchTtp(); fetchNhe(); fetchLl60(); fetchTcr()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const setLoaded = (key: string) => setLoading(p => ({ ...p, [key]: false }))

  const fetchTtp = async () => {
    const { data, error } = await supabase
      .from("time_to_productivity")
      .select("employee_id, start_date, role_job_family, delivery_unit, productivity_confirmed, confirmed_by, ttp_days")
    if (error) { setError("Failed to load TTP data: " + error.message); setLoaded("ttp"); return }
    setTtpRows(data ?? [])
    setLoaded("ttp")
  }

  const fetchNhe = async () => {
    const { data, error } = await supabase
      .from("onboarding_30_day_survey")
      .select(`submission_date, delivery_unit, location, job_title, supervisor_name,
        q4_1, q4_2, q4_3, q4_4, q4_5,
        q7_1, q7_2, q7_3,
        q10_1, q10_2, q10_3, q10_4, q10_5,
        q13_1, q13_2, q13_3, q13_4, q13_5,
        q22_1, q22_2, q22_3, q22_4,
        q25_1, q25_2, q25_3, q25_4, q25_5, q25_6, q25_7, q25_8,
        q28_1, q28_2, q28_3, q28_4,
        q31_1, q31_2, q31_3, q31_4, q31_5,
        q34_1,
        q38_1, q38_2, q38_3, q38_4, q38_5, q38_6, q38_7`)
    if (error) { setError("Failed to load NHE data: " + error.message); setLoaded("nhe"); return }
    setNheRows((data ?? []) as NheRow[])
    setLoaded("nhe")
  }

  const fetchLl60 = async () => {
    const { data, error } = await supabase
      .from("onboarding_60_day_sessions")
      .select("session_date, hire_period, session_type, participant_count, delivery_unit, location, motivation_engagement, manager_relationship, team_belonging, workload_stress, growth_future_outlook, recognition_value, avg_journey_rating, recommend_percent, overall_retention_risk")
    if (error) { setError("Failed to load LL60 data: " + error.message); setLoaded("ll60"); return }
    setLl60Rows((data ?? []) as Ll60Row[])
    setLoaded("ll60")
  }

  const fetchTcr = async () => {
    const { data, error } = await supabase
      .from("training_completion")
      .select("cohort, role_job_family, training_modality, total_enrolled, total_completed, completion_deadline")
    if (error) { setError("Failed to load TCR data: " + error.message); setLoaded("tcr"); return }
    setTcrRows((data ?? []) as TcrRow[])
    setLoaded("tcr")
  }

  const isLoading = (k: string) => loading[k]
  const ttpLoaded  = !loading.ttp  && ttpRows.length  > 0
  const nheLoaded  = !loading.nhe  && nheRows.length  > 0
  const ll60Loaded = !loading.ll60 && ll60Rows.length > 0
  const tcrLoaded  = !loading.tcr  && tcrRows.length  > 0

  // ═══════ KPI SUMMARY ROW ═══════════════════════════════
  const kpiSummary = useMemo(() => {
    const arr = []
    if (ttpLoaded) {
      const confirmed = ttpRows.filter(r => (r.productivity_confirmed ?? "").trim().toLowerCase() === "yes")
      const days = confirmed.map(r => r.ttp_days).filter((d): d is number => d !== null && d >= 0)
      const avg = days.length ? Number((days.reduce((a, b) => a + b, 0) / days.length).toFixed(1)) : 0
      arr.push({ metric: "Avg. Time to Productivity", value: avg, unit: " days", accent: "#10b981", sub: `${confirmed.length} of ${ttpRows.length} confirmed` })
    }
    if (nheLoaded) {
      const cats = calcNheCats(nheRows)
      const vals = Object.values(cats).map(c => c.avgPct)
      const overall = vals.length ? Number((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1)) : 0
      arr.push({ metric: "30-Day Exp. Favorability", value: overall, unit: "%", accent: "#8b5cf6", sub: `${nheRows.length} responses` })
    }
    if (ll60Loaded) {
      let totalSigPos = 0, totalSig = 0
      ll60Rows.forEach(r => {
        LL60_DIMENSIONS.forEach(d => {
          totalSig++
          if (parseSignal(r[d.key] as string | null) === "positive") totalSigPos++
        })
      })
      const positivity = totalSig ? Number(((totalSigPos / totalSig) * 100).toFixed(1)) : 0
      const sessions = ll60Rows.length
      const participants = ll60Rows.reduce((s, r) => s + toNum(r.participant_count), 0)
      arr.push({ metric: "60-Day Positive Signal", value: positivity, unit: "%", accent: "#10b981", sub: `${sessions} sessions · ${participants} participants` })
    }
    if (tcrLoaded) {
      const enrolled  = tcrRows.reduce((s, r) => s + toNum(r.total_enrolled), 0)
      const completed = tcrRows.reduce((s, r) => s + toNum(r.total_completed), 0)
      arr.push({ metric: "Training Completion Rate", value: pct(completed, enrolled), unit: "%", accent: "#06b6d4", sub: `${completed} of ${enrolled} enrolled` })
    }
    return arr
  }, [ttpLoaded, nheLoaded, ll60Loaded, tcrLoaded, ttpRows, nheRows, ll60Rows, tcrRows])

  // ═══════ TTP DERIVED ════════════════════════════════════

  const ttpAllMonths = useMemo(() => uniq(ttpRows.map(r => r.start_date?.slice(0, 7) ?? null)), [ttpRows])
  const ttpYears     = useMemo(() => uniq(ttpRows.map(r => r.start_date?.slice(0, 4) ?? null)), [ttpRows])

  const ttpValueOptions = useMemo((): string[] => {
    switch (ttpFT) {
      case "Onboarding Cohort":      return uniq(ttpRows.map(r => r.start_date?.slice(0, 7) ?? null))
      case "Delivery Unit":          return uniq(ttpRows.map(r => r.delivery_unit))
      case "Role / Job Family":      return uniq(ttpRows.map(r => r.role_job_family))
      case "Productivity Confirmed": return ["yes", "no"]
      case "Manager":                return uniq(ttpRows.map(r => r.confirmed_by))
      default: return []
    }
  }, [ttpFT, ttpRows])

  const ttpFiltered = useMemo(() => {
    let rows = ttpRows
    if (ttpMF || ttpMT) {
      rows = rows.filter(r => { const ym = r.start_date?.slice(0, 7) ?? ""; return (!ttpMF || ym >= ttpMF) && (!ttpMT || ym <= ttpMT) })
    } else if (ttpYr) {
      rows = rows.filter(r => r.start_date?.startsWith(ttpYr))
    }
    if (!ttpFT || !ttpFV) return rows
    return rows.filter(r => {
      switch (ttpFT) {
        case "Onboarding Cohort":      return r.start_date?.startsWith(ttpFV)
        case "Delivery Unit":          return r.delivery_unit === ttpFV
        case "Role / Job Family":      return r.role_job_family === ttpFV
        case "Productivity Confirmed": return (r.productivity_confirmed ?? "").toLowerCase() === ttpFV
        case "Manager":                return r.confirmed_by === ttpFV
        default: return true
      }
    })
  }, [ttpRows, ttpFT, ttpFV, ttpYr, ttpMF, ttpMT])

  const ttpVisibleFigs = useMemo(() => ttpFT ? TTP_FILTER_AFFECTS[ttpFT] ?? [] : ["Fig 1","Fig 2","Fig 3"], [ttpFT])

  const ttpHeadline = useMemo(() => {
    const confirmed = ttpFiltered.filter(r => (r.productivity_confirmed ?? "").trim().toLowerCase() === "yes")
    const days = confirmed.map(r => r.ttp_days).filter((d): d is number => d !== null && d >= 0)
    const sorted = [...days].sort((a, b) => a - b)
    const median = sorted.length ? (sorted.length % 2 === 0 ? (sorted[sorted.length/2-1]+sorted[sorted.length/2])/2 : sorted[Math.floor(sorted.length/2)]) : 0
    return { avg: avgArr(days), median: Number(median.toFixed(1)), confirmed: confirmed.length, total: ttpFiltered.length, confirmRate: pct(confirmed.length, ttpFiltered.length) }
  }, [ttpFiltered])

  const ttpFig1 = useMemo(() => {
    const map: Record<string, number[]> = {}
    ttpFiltered.forEach(r => {
      if ((r.productivity_confirmed ?? "").trim().toLowerCase() !== "yes") return
      const cohort = r.start_date?.slice(0, 7) ?? "Unknown"
      const days = r.ttp_days ?? 0
      if (days > 0) { if (!map[cohort]) map[cohort] = []; map[cohort].push(days) }
    })
    return Object.entries(map).sort(([a],[b]) => a.localeCompare(b)).map(([cohort, days]) => ({ cohort, avg: avgArr(days) }))
  }, [ttpFiltered])

  const ttpFig2 = useMemo(() => {
    const map: Record<string, number[]> = {}
    ttpFiltered.forEach(r => {
      if ((r.productivity_confirmed ?? "").trim().toLowerCase() !== "yes") return
      const role = r.role_job_family?.trim() ?? "Unknown"
      const days = r.ttp_days ?? 0
      if (days > 0) { if (!map[role]) map[role] = []; map[role].push(days) }
    })
    return Object.entries(map).map(([role, days]) => ({ role, avg: avgArr(days) }))
  }, [ttpFiltered])

  const ttpFig3 = useMemo(() => {
    const confirmed = ttpFiltered.filter(r => (r.productivity_confirmed ?? "").trim().toLowerCase() === "yes").length
    return [
      { name: "Productive", value: confirmed, color: "#10b981" },
      { name: "Not Yet", value: ttpFiltered.length - confirmed, color: "#e2e8f0" },
    ].filter(d => d.value > 0)
  }, [ttpFiltered])

  const ttpC = (d: number) => d <= 45 ? "#22c55e" : d <= 75 ? "#22c55e" : "#ef4444"

  // ═══════ NHE DERIVED ════════════════════════════════════

  const nheAllMonths = useMemo(() => uniq(nheRows.map(r => r.submission_date?.slice(0, 7) ?? null)), [nheRows])
  const nheYears     = useMemo(() => uniq(nheRows.map(r => r.submission_date?.slice(0, 4) ?? null)), [nheRows])

  const nheValueOptions = useMemo((): string[] => {
    switch (nheFT) {
      case "Delivery Unit": return uniq(nheRows.map(r => r.delivery_unit))
      case "Location":      return uniq(nheRows.map(r => r.location))
      case "Manager":       return uniq(nheRows.map(r => r.supervisor_name))
      default: return []
    }
  }, [nheFT, nheRows])

  const nheFiltered = useMemo(() => {
    let rows = nheRows
    if (nheMF || nheMT) {
      rows = rows.filter(r => { const ym = r.submission_date?.slice(0, 7) ?? ""; return (!nheMF || ym >= nheMF) && (!nheMT || ym <= nheMT) })
    } else if (nheYr) {
      rows = rows.filter(r => r.submission_date?.startsWith(nheYr))
    }
    if (!nheFT || !nheFV) return rows
    return rows.filter(r => {
      switch (nheFT) {
        case "Delivery Unit": return r.delivery_unit === nheFV
        case "Location":      return r.location      === nheFV
        case "Manager":       return r.supervisor_name === nheFV
        default: return true
      }
    })
  }, [nheRows, nheFT, nheFV, nheYr, nheMF, nheMT])

  const nheVisibleFigs = useMemo(() => nheFT ? NHE_FILTER_AFFECTS[nheFT] ?? [] : ["Fig 1","Fig 2","Fig 3","Fig 4"], [nheFT])
  const nheCats        = useMemo(() => calcNheCats(nheFiltered), [nheFiltered])

  const nheFig1 = useMemo(() =>
    LL30_CATS.filter(c => nheCats[c.id]).map(c => ({
      label: nheCats[c.id].label, id: c.id,
      favorability: nheCats[c.id].avgPct,
      promoter:     nheCats[c.id].promoterPct,
    })).sort((a, b) => b.favorability - a.favorability)
  , [nheCats])

  const nheFig3 = useMemo(() =>
    LL30_CATS.filter(c => nheCats[c.id]).map(c => ({
      subject: c.label.split(" ").slice(0, 2).join(" "), value: nheCats[c.id].avgPct, fullMark: 100,
    }))
  , [nheCats])

  const nheHeadline = useMemo(() => {
    const vals = Object.values(nheCats).map(c => c.avgPct)
    return { overall: vals.length ? Number((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1)) : 0, responses: nheFiltered.length, topCat: nheFig1[0] ?? null, bottomCat: nheFig1[nheFig1.length - 1] ?? null }
  }, [nheCats, nheFiltered, nheFig1])

  const nheC = (_v: number, isLowest: boolean) => isLowest ? "#ef4444" : "#22c55e"

  // ═══════ LL60 DERIVED ═══════════════════════════════════

  const ll60AllMonths = useMemo(() => uniq(ll60Rows.map(r => r.session_date?.slice(0, 7) ?? null)), [ll60Rows])
  const ll60Years     = useMemo(() => uniq(ll60Rows.map(r => r.session_date?.slice(0, 4) ?? null)), [ll60Rows])

  const ll60ValueOptions = useMemo((): string[] => {
    switch (l6FT) {
      case "Session Date":     return uniq(ll60Rows.map(r => r.session_date?.slice(0, 7) ?? null))
      case "Delivery Unit":    return uniq(ll60Rows.map(r => r.delivery_unit))
      case "Session Type":     return uniq(ll60Rows.map(r => r.session_type))
      case "Work Arrangement": return uniq(ll60Rows.map(r => r.location))
      case "Hire Period":      return uniq(ll60Rows.map(r => r.hire_period))
      case "Retention Risk":   return ["low", "medium", "high"]
      default: return []
    }
  }, [l6FT, ll60Rows])

  const ll60Filtered = useMemo(() => {
    let rows = ll60Rows
    if (l6MF || l6MT) {
      rows = rows.filter(r => { const ym = r.session_date?.slice(0, 7) ?? ""; return (!l6MF || ym >= l6MF) && (!l6MT || ym <= l6MT) })
    } else if (l6Yr) {
      rows = rows.filter(r => r.session_date?.startsWith(l6Yr))
    }
    if (!l6FT || !l6FV) return rows
    const rv = l6FV.toLowerCase()
    return rows.filter(r => {
      switch (l6FT) {
        case "Session Date":     return r.session_date?.startsWith(l6FV)
        case "Delivery Unit":    return (r.delivery_unit ?? "").toLowerCase() === rv
        case "Session Type":     return (r.session_type  ?? "").toLowerCase() === rv
        case "Work Arrangement": return (r.location      ?? "").toLowerCase() === rv
        case "Hire Period":      return (r.hire_period   ?? "").toLowerCase() === rv
        case "Retention Risk":   return (r.overall_retention_risk ?? "").toLowerCase() === rv
        default: return true
      }
    })
  }, [ll60Rows, l6FT, l6FV, l6Yr, l6MF, l6MT])

  const ll60VisibleFigs = useMemo(() => l6FT ? LL60_FILTER_AFFECTS[l6FT] ?? [] : ["Fig 1","Fig 2","Fig 3","Fig 4","Fig 5"], [l6FT])

  const ll60Headline = useMemo(() => {
    let totalRating = 0, ratingCount = 0, totalRec = 0, recCount = 0, totalParts = 0
    const riskCounts = { low: 0, medium: 0, high: 0 }
    ll60Filtered.forEach(r => {
      totalParts += toNum(r.participant_count)
      if (r.avg_journey_rating != null && r.avg_journey_rating >= 1) { totalRating += r.avg_journey_rating; ratingCount++ }
      if (r.recommend_percent  != null) { totalRec += r.recommend_percent; recCount++ }
      const risk = (r.overall_retention_risk ?? "").toLowerCase()
      if (risk === "low") riskCounts.low++
      else if (risk === "medium") riskCounts.medium++
      else if (risk === "high") riskCounts.high++
    })
    return {
      sessions: ll60Filtered.length, participants: totalParts,
      avgRating: ratingCount ? Number((totalRating / ratingCount).toFixed(1)) : null,
      avgRecommend: recCount ? Number((totalRec / recCount).toFixed(1)) : null,
      riskCounts,
    }
  }, [ll60Filtered])

  // Fig 1 — Positive signal rate trend by session date
  const ll60Fig1 = useMemo(() => {
    const map: Record<string, { pos: number; total: number }> = {}
    ll60Filtered.forEach(r => {
      const date = r.session_date?.slice(0, 7)
      if (!date) return
      if (!map[date]) map[date] = { pos: 0, total: 0 }
      LL60_DIMENSIONS.forEach(d => {
        map[date].total++
        if (parseSignal(r[d.key] as string | null) === "positive") map[date].pos++
      })
    })
    return Object.entries(map).sort(([a],[b]) => a.localeCompare(b))
      .map(([date, v]) => ({ date, "Positive Signal %": v.total ? Math.round((v.pos / v.total) * 100) : 0 }))
  }, [ll60Filtered])

  // Fig 2 — Radar
  const ll60Fig2 = useMemo(() =>
    LL60_DIMENSIONS.map(d => {
      let pos = 0, total = 0
      ll60Filtered.forEach(r => { total++; if (parseSignal(r[d.key] as string | null) === "positive") pos++ })
      return { subject: d.short, value: total ? Math.round((pos / total) * 100) : 0, fullMark: 100 }
    })
  , [ll60Filtered])

  // Fig 3 — Risk donut
  const ll60Fig3 = useMemo(() => [
    { name: "Low Risk",  value: ll60Headline.riskCounts.low,  color: "#22c55e" },
    { name: "Med Risk",  value: ll60Headline.riskCounts.medium, color: "#f59e0b" },
    { name: "High Risk", value: ll60Headline.riskCounts.high, color: "#ef4444" },
  ].filter(d => d.value > 0), [ll60Headline])

  // Fig 4 — Stacked bar by dimension
  const ll60Fig4 = useMemo(() =>
    LL60_DIMENSIONS.map(d => {
      let pos = 0, neu = 0, neg = 0
      ll60Filtered.forEach(r => {
        const sig = parseSignal(r[d.key] as string | null)
        if (sig === "positive") pos++
        else if (sig === "negative") neg++
        else neu++
      })
      const total = pos + neu + neg || 1
      return { label: d.label, short: d.short, Positive: Math.round((pos/total)*100), Neutral: Math.round((neu/total)*100), Negative: Math.round((neg/total)*100) }
    })
  , [ll60Filtered])

  // Fig 5 — Signal by DU
  const ll60Fig5 = useMemo(() => {
    const map: Record<string, { pos: number; neu: number; neg: number }> = {}
    ll60Filtered.forEach(r => {
      const du = r.delivery_unit ?? "Unknown"
      if (!map[du]) map[du] = { pos: 0, neu: 0, neg: 0 }
      LL60_DIMENSIONS.forEach(d => {
        const sig = parseSignal(r[d.key] as string | null)
        if (sig === "positive") map[du].pos++
        else if (sig === "negative") map[du].neg++
        else map[du].neu++
      })
    })
    return Object.entries(map).map(([du, v]) => {
      const total = v.pos + v.neu + v.neg || 1
      return { du, Positive: Math.round((v.pos/total)*100), Neutral: Math.round((v.neu/total)*100), Negative: Math.round((v.neg/total)*100) }
    })
  }, [ll60Filtered])

  const ll60SigC = (p: number) => p >= 75 ? "#22c55e" : p >= 50 ? "#10b981" : "#ef4444"

  // ═══════ TCR DERIVED ════════════════════════════════════

  const tcrYears = useMemo(() => uniq(tcrRows.map(r => r.cohort?.slice(0, 4) ?? null)), [tcrRows])

  const tcrValueOptions = useMemo((): string[] => {
    switch (tcrFT) {
      case "Cohort":              return uniq(tcrRows.map(r => r.cohort))
      case "Role / Job Family":   return uniq(tcrRows.map(r => r.role_job_family))
      case "Training Modality":   return uniq(tcrRows.map(r => r.training_modality))
      case "Completion Deadline": return uniq(tcrRows.map(r => r.completion_deadline))
      default: return []
    }
  }, [tcrFT, tcrRows])

  const tcrFiltered = useMemo(() => {
    let rows = tcrRows
    if (tcrYr) rows = rows.filter(r => r.cohort?.startsWith(tcrYr))
    if (!tcrFT || !tcrFV) return rows
    return rows.filter(r => {
      switch (tcrFT) {
        case "Cohort":              return r.cohort              === tcrFV
        case "Role / Job Family":   return r.role_job_family     === tcrFV
        case "Training Modality":   return r.training_modality   === tcrFV
        case "Completion Deadline": return r.completion_deadline === tcrFV
        default: return true
      }
    })
  }, [tcrRows, tcrFT, tcrFV, tcrYr])

  const tcrVisibleFigs = useMemo(() => tcrFT ? TCR_FILTER_AFFECTS[tcrFT] ?? [] : ["Fig 1","Fig 2","Fig 3"], [tcrFT])

  const tcrHeadline = useMemo(() => {
    const enrolled  = tcrFiltered.reduce((s, r) => s + toNum(r.total_enrolled), 0)
    const completed = tcrFiltered.reduce((s, r) => s + toNum(r.total_completed), 0)
    return { enrolled, completed, rate: pct(completed, enrolled) }
  }, [tcrFiltered])

  const tcrFig1 = useMemo(() => {
    const map: Record<string, { e: number; c: number }> = {}
    tcrFiltered.forEach(r => { const k = r.cohort ?? "Unknown"; if (!map[k]) map[k] = { e: 0, c: 0 }; map[k].e += toNum(r.total_enrolled); map[k].c += toNum(r.total_completed) })
    return Object.entries(map).sort(([a],[b]) => a.localeCompare(b)).map(([cohort, d]) => ({ cohort, rate: pct(d.c, d.e) }))
  }, [tcrFiltered])

  const tcrFig2 = useMemo(() => {
    const map: Record<string, { e: number; c: number }> = {}
    tcrFiltered.forEach(r => { const k = r.role_job_family?.trim() ?? "Unknown"; if (!map[k]) map[k] = { e: 0, c: 0 }; map[k].e += toNum(r.total_enrolled); map[k].c += toNum(r.total_completed) })
    return Object.entries(map).map(([role, d]) => ({ role, Enrolled: d.e, Completed: d.c, rate: pct(d.c, d.e) }))
  }, [tcrFiltered])

  const tcrFig3 = useMemo(() => {
    const map: Record<string, { e: number; c: number }> = {}
    tcrFiltered.forEach(r => { const k = r.training_modality?.trim() ?? "Unknown"; if (!map[k]) map[k] = { e: 0, c: 0 }; map[k].e += toNum(r.total_enrolled); map[k].c += toNum(r.total_completed) })
    return Object.entries(map).map(([modality, d]) => ({ modality, rate: pct(d.c, d.e) }))
  }, [tcrFiltered])

  const tcrC = (r: number) => r >= 90 ? "#06b6d4" : r >= 70 ? "#06b6d4" : "#ef4444"

  // ═══════════════════════════════════════════════════════════
  //  RENDER
  // ═══════════════════════════════════════════════════════════

  const TABS = [
    { key: "ttp"  as const, label: "Time to Productivity", accent: "#10b981", loaded: ttpLoaded  },
    { key: "nhe"  as const, label: "30-Day Experience",     accent: "#8b5cf6", loaded: nheLoaded  },
    { key: "ll60" as const, label: "60-Day Experience",     accent: "#10b981", loaded: ll60Loaded },
    { key: "tcr"  as const, label: "Training Completion",   accent: "#06b6d4", loaded: tcrLoaded  },
  ]

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "'DM Sans', sans-serif", padding: "5px 24px 60px" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap'); * { box-sizing: border-box; } select { font-family: inherit; }`}</style>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>

        {/* Error banner */}
        {error && (
          <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 10, padding: "10px 16px", fontSize: 12, color: "#dc2626", marginBottom: 16, display: "flex", justifyContent: "space-between" }}>
            ⚠ {error}
            <button onClick={() => setError(null)} style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", fontWeight: 700 }}>×</button>
          </div>
        )}

        {/* KPI row */}
        {kpiSummary.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 24 }}>
            {kpiSummary.map(m => (
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
            <button key={t.key} onClick={() => setActiveTab(t.key)} style={{
              padding: "8px 20px", borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: "pointer", border: "none", transition: "all .18s",
              background: activeTab === t.key ? t.accent : "#fff",
              color: activeTab === t.key ? "#fff" : t.loaded ? "#475569" : "#cbd5e1",
              opacity: isLoading(t.key) ? 0.5 : 1,
              boxShadow: activeTab === t.key ? `0 4px 14px ${t.accent}45` : "0 1px 3px rgba(0,0,0,.06)",
            }}>
              {isLoading(t.key) ? "⟳" : t.loaded ? "●" : "○"} {t.label}
            </button>
          ))}
        </div>

        {/* ══════════ TTP ══════════ */}
        {activeTab === "ttp" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {isLoading("ttp") ? <Card><LoadingSpinner accent="#10b981" /></Card> : !ttpLoaded ? <Card><EmptyState label="Time to Productivity" /></Card> : (
              <>
                <FilterBar
                  filterKeys={Object.keys(TTP_FILTER_AFFECTS)} affectsMap={TTP_FILTER_AFFECTS}
                  years={ttpYears} allMonths={ttpAllMonths}
                  filterType={ttpFT} filterValue={ttpFV} selectedYear={ttpYr} monthFrom={ttpMF} monthTo={ttpMT}
                  onFilterType={setTtpFT} onFilterValue={setTtpFV} onYear={setTtpYr} onMonthFrom={setTtpMF} onMonthTo={setTtpMT}
                  onClear={() => { setTtpFT(""); setTtpFV(""); setTtpYr(""); setTtpMF(""); setTtpMT("") }}
                  accent="#10b981" valueOptions={ttpValueOptions}
                />
                <Card>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 14 }}>Time to Productivity — Summary</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
                    <StatPill label="Avg TTP"              value={`${ttpHeadline.avg} days`}    accent="#10b981" sub="Confirmed productive only" />
                    <StatPill label="Median TTP"           value={`${ttpHeadline.median} days`} accent="#10b981" />
                    <StatPill label="Confirmed Productive" value={ttpHeadline.confirmed}         accent="#22c55e" sub={`of ${ttpHeadline.total} new hires`} />
                    <StatPill label="Confirmation Rate"    value={`${ttpHeadline.confirmRate}%`} accent="#10b981" />
                  </div>
                </Card>
                {ttpVisibleFigs.includes("Fig 1") && (
                  <FigCard fig="Fig 1" title="Average TTP by Cohort" subtitle="Line chart · ramp-up trend over hire cohorts">
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
                  <FigCard fig="Fig 2" title="TTP by Role Family" subtitle="Horizontal bar · ramp-up speed comparison across roles">
                    {ttpFig2.length === 0 ? <EmptyChart msg="No confirmed role data in selection" /> : (
                      <ResponsiveContainer width="100%" height={Math.max(200, ttpFig2.length * 52)}>
                        <BarChart layout="vertical" data={ttpFig2} margin={{ top: 4, right: 60, left: 10, bottom: 4 }}>
                          <CartesianGrid strokeDasharray="4 4" stroke="#f1f5f9" horizontal={false} />
                          <XAxis type="number" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                          <YAxis type="category" dataKey="role" tick={{ fill: "#475569", fontSize: 12 }} width={150} />
                          <Tooltip content={<CT unit=" days" />} />
                          <Bar dataKey="avg" name="Avg Days" radius={[0, 6, 6, 0]}>{ttpFig2.map((d, i) => <Cell key={i} fill={ttpC(d.avg)} />)}</Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </FigCard>
                )}
                {ttpVisibleFigs.includes("Fig 3") && (
                  <FigCard fig="Fig 3" title="Productive vs. Not Yet Productive" subtitle="Donut chart · confirmation status in current selection">
                    {ttpFig3.length === 0 ? <EmptyChart msg="No data in selection" /> : (
                      <div style={{ display: "flex", alignItems: "center", gap: 40, flexWrap: "wrap" }}>
                        <ResponsiveContainer width={240} height={240}>
                          <PieChart>
                            <Pie data={ttpFig3} cx="50%" cy="50%" innerRadius={65} outerRadius={100} dataKey="value" paddingAngle={3}>{ttpFig3.map((d, i) => <Cell key={i} fill={d.color} />)}</Pie>
                            <Tooltip formatter={(v) => [v, "Count"]} />
                          </PieChart>
                        </ResponsiveContainer>
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                          {ttpFig3.map((d, i) => (
                            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <div style={{ width: 12, height: 12, borderRadius: 3, background: d.color }} />
                              <div>
                                <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{d.name}</div>
                                <div style={{ fontSize: 20, fontWeight: 800, color: d.color }}>{d.value}<span style={{ fontSize: 12, color: "#94a3b8", marginLeft: 6 }}>({ttpFiltered.length ? pct(d.value, ttpFiltered.length) : 0}%)</span></div>
                              </div>
                            </div>
                          ))}
                          <div style={{ fontSize: 11, color: "#94a3b8" }}>{ttpFiltered.length} total in selection</div>
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
            {isLoading("nhe") ? <Card><LoadingSpinner accent="#8b5cf6" /></Card> : !nheLoaded ? <Card><EmptyState label="30-Day Experience (LaunchLens30)" /></Card> : (
              <>
                <FilterBar
                  filterKeys={Object.keys(NHE_FILTER_AFFECTS)} affectsMap={NHE_FILTER_AFFECTS}
                  years={nheYears} allMonths={nheAllMonths}
                  filterType={nheFT} filterValue={nheFV} selectedYear={nheYr} monthFrom={nheMF} monthTo={nheMT}
                  onFilterType={setNheFT} onFilterValue={setNheFV} onYear={setNheYr} onMonthFrom={setNheMF} onMonthTo={setNheMT}
                  onClear={() => { setNheFT(""); setNheFV(""); setNheYr(""); setNheMF(""); setNheMT("") }}
                  accent="#8b5cf6" valueOptions={nheValueOptions}
                />
                <Card>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 14 }}>LaunchLens 30-Day Experience — Summary</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
                    <StatPill label="Overall Favorability" value={`${nheHeadline.overall}%`} accent="#8b5cf6" sub="Avg across all 10 categories" />
                    <StatPill label="Survey Responses"     value={nheHeadline.responses}      accent="#8b5cf6" />
                    {nheHeadline.topCat    && <StatPill label="Top Strength"    value={nheHeadline.topCat.label.split("&")[0].trim()}    accent="#22c55e" sub={`${nheHeadline.topCat.favorability}% fav.`} />}
                    {nheHeadline.bottomCat && <StatPill label="Needs Attention" value={nheHeadline.bottomCat.label.split("&")[0].trim()} accent="#ef4444" sub={`${nheHeadline.bottomCat.favorability}% fav.`} />}
                  </div>
                </Card>
                {nheVisibleFigs.includes("Fig 1") && (
                  <FigCard fig="Fig 1" title="Category Favorability — All 10 Dimensions" subtitle="Sorted horizontal bar · green = strong, red = lowest">
                    {nheFig1.length === 0 ? <EmptyChart msg="No category data in selection" /> : (
                      <ResponsiveContainer width="100%" height={Math.max(260, nheFig1.length * 48)}>
                        <BarChart layout="vertical" data={nheFig1} margin={{ top: 4, right: 80, left: 10, bottom: 4 }}>
                          <CartesianGrid strokeDasharray="4 4" stroke="#f1f5f9" horizontal={false} />
                          <XAxis type="number" domain={[0, 100]} tick={{ fill: "#94a3b8", fontSize: 11 }} unit="%" />
                          <YAxis type="category" dataKey="label" tick={{ fill: "#475569", fontSize: 11 }} width={200} />
                          <Tooltip content={<CT unit="%" />} />
                          <Bar dataKey="favorability" name="Favorability %" radius={[0, 6, 6, 0]}>
                            {nheFig1.map((d, i) => <Cell key={i} fill={nheC(d.favorability, i === nheFig1.length - 1)} />)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </FigCard>
                )}
                {nheVisibleFigs.includes("Fig 2") && (
                  <FigCard fig="Fig 2" title="Favorability % vs. Promoter % by Category" subtitle="Clustered bar · identifies categories with high favorability but low promoter rate">
                    {nheFig1.length === 0 ? <EmptyChart msg="No data in selection" /> : (
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
                  <FigCard fig="Fig 3" title="Top Strengths & Lowest Areas" subtitle="Focus panel · what to sustain vs. what needs attention">
                    {nheFig1.length === 0 ? <EmptyChart msg="No data in selection" /> : (
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: "#22c55e", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 12 }}>🟢 Top Strengths</div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                            {nheFig1.slice(0, 3).map((d, i) => (
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
                            {nheFig1.slice(-3).reverse().map((d, i) => (
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
            {isLoading("ll60") ? <Card><LoadingSpinner accent="#10b981" /></Card> : !ll60Loaded ? <Card><EmptyState label="60-Day Experience (LaunchLens60)" /></Card> : (
              <>
                <FilterBar
                  filterKeys={Object.keys(LL60_FILTER_AFFECTS)} affectsMap={LL60_FILTER_AFFECTS}
                  years={ll60Years} allMonths={ll60AllMonths}
                  filterType={l6FT} filterValue={l6FV} selectedYear={l6Yr} monthFrom={l6MF} monthTo={l6MT}
                  onFilterType={setL6FT} onFilterValue={setL6FV} onYear={setL6Yr} onMonthFrom={setL6MF} onMonthTo={setL6MT}
                  onClear={() => { setL6FT(""); setL6FV(""); setL6Yr(""); setL6MF(""); setL6MT("") }}
                  accent="#10b981" valueOptions={ll60ValueOptions}
                />
                <Card>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 14 }}>LaunchLens 60-Day Experience — Summary</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
                    <StatPill label="Sessions"           value={ll60Headline.sessions}                                                          accent="#10b981" sub={`${ll60Headline.participants} participants`} />
                    <StatPill label="Avg Journey Rating" value={ll60Headline.avgRating    != null ? `${ll60Headline.avgRating} / 5`    : "—"}   accent="#10b981" />
                    <StatPill label="Recommend Rate"     value={ll60Headline.avgRecommend != null ? `${ll60Headline.avgRecommend}%`    : "—"}   accent="#10b981" />
                    <StatPill label="Low Risk"           value={ll60Headline.riskCounts.low}                                                    accent="#22c55e" sub="Retention risk: Low" />
                    <StatPill label="High Risk"          value={ll60Headline.riskCounts.high}                                                   accent="#ef4444" sub="Retention risk: High" />
                  </div>
                </Card>
                {ll60VisibleFigs.includes("Fig 1") && (
                  <FigCard fig="Fig 1" title="Positive Signal Rate Trend" subtitle="Line chart · rolling positive signal % across session dates">
                    {ll60Fig1.length < 2 ? <EmptyChart msg="Need sessions across ≥2 dates" /> : (
                      <ResponsiveContainer width="100%" height={280}>
                        <LineChart data={ll60Fig1} margin={{ top: 10, right: 30, left: 0, bottom: 10 }}>
                          <CartesianGrid strokeDasharray="4 4" stroke="#f1f5f9" />
                          <XAxis dataKey="date" tick={{ fill: "#94a3b8", fontSize: 12 }} />
                          <YAxis domain={[0, 100]} tick={{ fill: "#94a3b8", fontSize: 12 }} unit="%" />
                          <Tooltip content={<CT unit="%" />} />
                          <Line type="monotone" dataKey="Positive Signal %" stroke="#10b981" strokeWidth={2.5} dot={{ r: 5, fill: "#10b981", strokeWidth: 0 }} activeDot={{ r: 7 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    )}
                  </FigCard>
                )}
                {ll60VisibleFigs.includes("Fig 2") && (
                  <FigCard fig="Fig 2" title="Retention Driver Health — Radar View" subtitle="Radar chart · positive signal % across all 6 dimensions">
                    {ll60Fig2.every(d => d.value === 0) ? <EmptyChart msg="No signal data in selection" /> : (
                      <ResponsiveContainer width="100%" height={360}>
                        <RadarChart data={ll60Fig2} margin={{ top: 20, right: 30, bottom: 20, left: 30 }}>
                          <PolarGrid stroke="#e2e8f0" />
                          <PolarAngleAxis dataKey="subject" tick={{ fill: "#475569", fontSize: 12, fontWeight: 600 }} />
                          <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fill: "#94a3b8", fontSize: 10 }} tickCount={5} />
                          <Radar name="Positive Signal %" dataKey="value" stroke="#10b981" fill="#10b981" fillOpacity={0.22} strokeWidth={2.5} />
                          <Tooltip formatter={(v) => [`${v}%`, "Positive Signal"]} />
                          <Legend wrapperStyle={{ fontSize: 12 }} />
                        </RadarChart>
                      </ResponsiveContainer>
                    )}
                  </FigCard>
                )}
                {ll60VisibleFigs.includes("Fig 3") && (
                  <FigCard fig="Fig 3" title="Overall Retention Risk Distribution" subtitle="Donut chart · proportion of sessions by risk level">
                    {ll60Fig3.length === 0 ? <EmptyChart msg="No retention risk data in selection" /> : (
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
                              <div style={{ width: 12, height: 12, borderRadius: 3, background: d.color }} />
                              <div>
                                <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{d.name}</div>
                                <div style={{ fontSize: 20, fontWeight: 800, color: d.color }}>
                                  {d.value}<span style={{ fontSize: 12, color: "#94a3b8", marginLeft: 6 }}>({ll60Filtered.length ? Math.round((d.value / ll60Filtered.length) * 100) : 0}%)</span>
                                </div>
                              </div>
                            </div>
                          ))}
                          <div style={{ fontSize: 11, color: "#94a3b8" }}>{ll60Filtered.length} sessions in selection</div>
                        </div>
                      </div>
                    )}
                  </FigCard>
                )}
                {ll60VisibleFigs.includes("Fig 4") && (
                  <FigCard fig="Fig 4" title="Signal Breakdown by Retention Driver" subtitle="Stacked bar · % of sessions signalling Positive / Neutral / Negative per dimension">
                    {ll60Fig4.length === 0 ? <EmptyChart msg="No signal data in selection" /> : (
                      <>
                        <ResponsiveContainer width="100%" height={Math.max(260, ll60Fig4.length * 52)}>
                          <BarChart layout="vertical" data={ll60Fig4} margin={{ top: 4, right: 20, left: 10, bottom: 4 }}>
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
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
                          {ll60Fig4.map((d, i) => (
                            <span key={i} style={{ fontSize: 11, fontWeight: 700, background: ll60SigC(d.Positive) + "18", color: ll60SigC(d.Positive), border: `1px solid ${ll60SigC(d.Positive)}28`, borderRadius: 20, padding: "3px 11px" }}>
                              {d.short}: {d.Positive}% +
                            </span>
                          ))}
                        </div>
                      </>
                    )}
                  </FigCard>
                )}
                {ll60VisibleFigs.includes("Fig 5") && (
                  <FigCard fig="Fig 5" title="Signal Distribution by Delivery Unit" subtitle="Clustered bar · compare positive / neutral / negative signal mix across teams">
                    {ll60Fig5.length === 0 ? <EmptyChart msg="No delivery unit data in selection" /> : (
                      <>
                        <ResponsiveContainer width="100%" height={Math.max(240, ll60Fig5.length * 64)}>
                          <BarChart layout="vertical" data={ll60Fig5} margin={{ top: 4, right: 20, left: 10, bottom: 4 }}>
                            <CartesianGrid strokeDasharray="4 4" stroke="#f1f5f9" horizontal={false} />
                            <XAxis type="number" domain={[0, 100]} tick={{ fill: "#94a3b8", fontSize: 11 }} unit="%" />
                            <YAxis type="category" dataKey="du" tick={{ fill: "#475569", fontSize: 12 }} width={120} />
                            <Tooltip content={<CT unit="%" />} />
                            <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
                            <Bar dataKey="Positive" fill="#22c55e" fillOpacity={0.85} />
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
            {isLoading("tcr") ? <Card><LoadingSpinner accent="#06b6d4" /></Card> : !tcrLoaded ? <Card><EmptyState label="Training Completion Rate" /></Card> : (
              <>
                <FilterBar
                  filterKeys={Object.keys(TCR_FILTER_AFFECTS)} affectsMap={TCR_FILTER_AFFECTS}
                  years={tcrYears} allMonths={[]}
                  filterType={tcrFT} filterValue={tcrFV} selectedYear={tcrYr} monthFrom="" monthTo=""
                  onFilterType={setTcrFT} onFilterValue={setTcrFV} onYear={setTcrYr}
                  onMonthFrom={() => {}} onMonthTo={() => {}}
                  onClear={() => { setTcrFT(""); setTcrFV(""); setTcrYr("") }}
                  accent="#06b6d4" valueOptions={tcrValueOptions}
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
                    {tcrFig2.length === 0 ? <EmptyChart msg="No role data in selection" /> : (
                      <>
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart data={tcrFig2} margin={{ top: 10, right: 20, left: 0, bottom: 60 }}>
                            <CartesianGrid strokeDasharray="4 4" stroke="#f1f5f9" />
                            <XAxis dataKey="role" tick={{ fill: "#475569", fontSize: 11 }} angle={-35} textAnchor="end" interval={0} />
                            <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} />
                            <Tooltip content={<CT />} />
                            <Legend verticalAlign="top" align="right" wrapperStyle={{ fontSize: 12, paddingBottom: 8 }} />
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
                    {tcrFig3.length === 0 ? <EmptyChart msg="No modality data in selection" /> : (
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
      <div style={{ textAlign: "center", marginTop: 52, fontSize: 11, color: "#cbd5e1" }}></div>
    </div>
  )
}