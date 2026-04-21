"use client"

import { useEffect, useState, useMemo } from "react"
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend,
  CartesianGrid, ResponsiveContainer, LineChart, Line, Cell,
} from "recharts"

// ─── Types ───────────────────────────────────────────────
interface EwiRawRow {
  "survey period"?: string
  "function"?: string
  "role level"?: string
  "location"?: string
  "tenure band"?: string
  "q1 physical health"?: string | number
  "q2 work environment"?: string | number
  "q3 stress management"?: string | number
  "q4 manager support"?: string | number
  "q5 work life balance"?: string | number
  "q6 inclusion & support"?: string | number
  "q7 relationships"?: string | number
  [key: string]: string | number | undefined
}

interface UwpRawRow {
  "reporting period"?: string
  "program type"?: string
  "program name"?: string
  "total eligible employees"?: string | number
  [key: string]: string | number | undefined
}

// ─── Helpers ─────────────────────────────────────────────
const LIKERT: Record<string, number> = {
  "strongly agree": 5, agree: 4, neutral: 3, disagree: 2, "strongly disagree": 1,
}
const toLikert = (v: string | number | undefined): number | null => {
  if (typeof v === "number") return v
  return LIKERT[(v as string || "").trim().toLowerCase()] ?? null
}
const toNum = (v?: string | number): number => Number(v || 0)
const uniq = (arr: (string | undefined)[]): string[] =>
  [...new Set(arr.filter((v): v is string => !!v && v.trim() !== ""))].sort()
const pct = (num: number, den: number): number =>
  den ? Number(((num / den) * 100).toFixed(1)) : 0

const Q_PREFIXES = ["q1", "q2", "q3", "q4", "q5", "q6", "q7"]

const resolveEwiKeys = (rows: EwiRawRow[]): string[] => {
  if (!rows.length) return Q_PREFIXES
  const allKeys = [...new Set(rows.flatMap(r => Object.keys(r)))]
  return Q_PREFIXES.map(p => allKeys.find(k => k.startsWith(p)) ?? p)
}

const avgOf = (rows: EwiRawRow[], indices: number[]): number | null => {
  const keys = resolveEwiKeys(rows)
  const resolved = indices.map(i => keys[i])
  const vals = rows.flatMap(r =>
    resolved.map(k => toLikert(r[k])).filter((v): v is number => v !== null)
  )
  return vals.length ? Number((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2)) : null
}

// ─── Filter configs ───────────────────────────────────────
const EWI_FILTER_AFFECTS: Record<string, string[]> = {
  "Survey Period": ["Fig 1", "Fig 2", "Fig 3"],
  "Function":      ["Fig 1", "Fig 2", "Fig 3"],
  "Role Level":    ["Fig 2", "Fig 3"],
  "Location":      ["Fig 2", "Fig 3"],
  "Tenure Band":   ["Fig 2", "Fig 3"],
}

const UWP_FILTER_AFFECTS: Record<string, string[]> = {
  "Reporting Period": ["Fig 1", "Fig 2", "Fig 3"],
  "Program Type":     ["Fig 1", "Fig 2", "Fig 3"],
  "Program Name":     ["Fig 2", "Fig 3"],
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
    <div style={{
      background: accent + "0d", border: `1px solid ${accent}20`,
      borderRadius: 12, padding: "14px 16px",
    }}>
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
    <div style={{
      background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10,
      padding: "10px 14px", fontSize: 12, boxShadow: "0 4px 20px rgba(0,0,0,.10)",
    }}>
      <div style={{ fontWeight: 700, color: "#0f172a", marginBottom: 4 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color }}>
          {p.name}: <strong>{typeof p.value === "number" ? p.value.toFixed(2) : p.value}{unit ?? ""}</strong>
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
          <span style={{
            fontSize: 10, fontWeight: 800, background: "#f1f5f9", color: "#64748b",
            borderRadius: 6, padding: "3px 8px", letterSpacing: ".05em", textTransform: "uppercase",
          }}>{fig}</span>
          <span style={{ fontSize: 15, fontWeight: 800, color: "#0f172a", letterSpacing: "-.02em" }}>{title}</span>
        </div>
        <div style={{ fontSize: 12, color: "#94a3b8" }}>{subtitle}</div>
      </div>
      {children}
    </Card>
  )
}

// ─── Shared Filter Bar (no month range) ──────────────────
function PeriodFilterBar({
  filterKeys, affectsMap, years, allPeriods,
  filterType, filterValue, selectedYear, selectedPeriod,
  onFilterType, onFilterValue, onYear, onPeriod, onClear,
  accent, valueOptions,
}: {
  filterKeys: string[]; affectsMap: Record<string, string[]>
  years: string[]; allPeriods: string[]
  filterType: string; filterValue: string
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
    backgroundColor: active ? accent + "08" : "#fff",
    backgroundImage: CHEVRON, backgroundRepeat: "no-repeat",
    backgroundPosition: "right 12px center", backgroundSize: "12px 12px",
    color: active ? accent : "#64748b", cursor: "pointer", outline: "none",
    minWidth: w, boxShadow: active ? `0 0 0 3px ${accent}15` : "none",
    transition: "border .15s, box-shadow .15s, color .15s",
    appearance: "none" as const, WebkitAppearance: "none" as const,
  })

  const lbl = (txt: string) => (
    <label style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" as const, letterSpacing: ".06em" }}>
      {txt}
    </label>
  )

  return (
    <Card style={{ padding: "20px 24px" }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>

        {/* Category filter */}
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {lbl("Filter By")}
          <select value={filterType} onChange={e => { onFilterType(e.target.value); onFilterValue("") }} style={sel(!!filterType)}>
            <option value="">— Select filter —</option>
            {filterKeys.map(k => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>

        {/* Year */}
        {years.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {lbl("Year")}
            <select value={selectedYear} onChange={e => { onYear(e.target.value); onPeriod("") }} style={sel(!!selectedYear, 160)}>
              <option value="">All Years</option>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        )}

        {/* Period (Quarter, H1/H2, etc.) */}
        {allPeriods.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {lbl("Period")}
            <select value={selectedPeriod} onChange={e => { onPeriod(e.target.value); onYear("") }} style={sel(!!selectedPeriod, 180)}>
              <option value="">All Periods</option>
              {allPeriods.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        )}

        {/* Filter value */}
        {filterType && valueOptions.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {lbl(filterType)}
            <select value={filterValue} onChange={e => onFilterValue(e.target.value)} style={sel(!!filterValue)}>
              <option value="">All</option>
              {valueOptions.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
        )}

        {/* Affects badges + clear */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 2 }}>
          {filterType && affects.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 11, color: "#94a3b8" }}>Shows:</span>
              {affects.map(fig => (
                <span key={fig} style={{
                  fontSize: 11, fontWeight: 700,
                  background: accent + "15", color: accent,
                  border: `1px solid ${accent}30`, borderRadius: 6, padding: "3px 10px",
                }}>{fig}</span>
              ))}
            </div>
          )}
          {hasActive && (
            <button onClick={onClear} style={{
              padding: "8px 14px", borderRadius: 8, fontSize: 11, fontWeight: 700,
              border: "1px solid #e2e8f0", background: "#f8fafc", color: "#94a3b8",
              cursor: "pointer", whiteSpace: "nowrap",
            }}>
              ✕ Clear
            </button>
          )}
        </div>
      </div>

      {/* Active filter summary */}
      {hasActive && (
        <div style={{
          marginTop: 12, paddingTop: 10, borderTop: "1px solid #f1f5f9",
          fontSize: 12, color: "#64748b", display: "flex", gap: 6, flexWrap: "wrap",
        }}>
          {selectedYear    && <span style={{ background: "#f1f5f9", borderRadius: 6, padding: "2px 8px" }}>Year: <strong>{selectedYear}</strong></span>}
          {selectedPeriod  && <span style={{ background: "#f1f5f9", borderRadius: 6, padding: "2px 8px" }}>Period: <strong>{selectedPeriod}</strong></span>}
          {filterType      && <span style={{ background: "#f1f5f9", borderRadius: 6, padding: "2px 8px" }}>{filterType}: <strong>{filterValue || "All"}</strong></span>}
        </div>
      )}
    </Card>
  )
}

// ═══════════════════════════════════════════════════════════
//  MAIN
// ═══════════════════════════════════════════════════════════
export default function WellbeingReportsPage() {
  const [wellbeingData, setWellbeingData] = useState<any>(null)
  const [ewiRows, setEwiRows] = useState<EwiRawRow[]>([])
  const [uwpRows, setUwpRows] = useState<UwpRawRow[]>([])
  const [activeTab, setActiveTab] = useState<"ewi" | "uwp">("ewi")

  // EWI filter state
  const [ewiFilterType,  setEwiFilterType]  = useState("")
  const [ewiFilterValue, setEwiFilterValue] = useState("")
  const [ewiYear,        setEwiYear]        = useState("")
  const [ewiPeriod,      setEwiPeriod]      = useState("")

  // UWP filter state
  const [uwpFilterType,  setUwpFilterType]  = useState("")
  const [uwpFilterValue, setUwpFilterValue] = useState("")
  const [uwpYear,        setUwpYear]        = useState("")
  const [uwpPeriod,      setUwpPeriod]      = useState("")

  useEffect(() => {
    const s = localStorage.getItem("wellbeingMetricsData")
    if (s) setWellbeingData(JSON.parse(s))
    setEwiRows(JSON.parse(localStorage.getItem("ewiRawRows") || "[]"))
    setUwpRows(JSON.parse(localStorage.getItem("uwpRawRows") || "[]"))
  }, [])

  const ewiLoaded = !!wellbeingData?.ewi?.loaded
  const uwpLoaded = !!wellbeingData?.uwp?.loaded

  // ── EWI DERIVED ──────────────────────────────────────────

  const ewiAllPeriods = useMemo(() =>
    uniq(ewiRows.map(r => (r["survey period"] as string || "").trim()))
  , [ewiRows])

  const ewiYears = useMemo(() =>
    uniq(ewiRows.map(r => {
      const p = (r["survey period"] as string || "").trim()
      const m = p.match(/\b(20\d{2})\b/)
      return m ? m[1] : ""
    }).filter(Boolean))
  , [ewiRows])

  const ewiValueOptions = useMemo((): string[] => {
    switch (ewiFilterType) {
      case "Function":   return uniq(ewiRows.map(r => (r["function"] as string || "").trim()))
      case "Role Level": return uniq(ewiRows.map(r => (r["role level"] as string || "").trim()))
      case "Location":   return uniq(ewiRows.map(r => (r["location"] as string || "").trim()))
      case "Tenure Band":return uniq(ewiRows.map(r => (r["tenure band"] as string || "").trim()))
      default: return []
    }
  }, [ewiFilterType, ewiRows])

  const ewiVisibleFigs = useMemo(() =>
    ewiFilterType ? EWI_FILTER_AFFECTS[ewiFilterType] ?? [] : ["Fig 1", "Fig 2", "Fig 3"]
  , [ewiFilterType])

  // Period / year filtering
  const ewiPeriodFiltered = useMemo(() => {
    let rows = ewiRows
    if (ewiPeriod) {
      rows = rows.filter(r => (r["survey period"] as string || "").trim() === ewiPeriod)
    } else if (ewiYear) {
      rows = rows.filter(r => (r["survey period"] as string || "").includes(ewiYear))
    }
    return rows
  }, [ewiRows, ewiYear, ewiPeriod])

  const ewiFiltered = useMemo(() => {
    if (!ewiFilterType || !ewiFilterValue) return ewiPeriodFiltered
    return ewiPeriodFiltered.filter(r => {
      switch (ewiFilterType) {
        case "Survey Period": return (r["survey period"] as string || "").trim() === ewiFilterValue
        case "Function":      return (r["function"] as string || "").trim() === ewiFilterValue
        case "Role Level":    return (r["role level"] as string || "").trim() === ewiFilterValue
        case "Location":      return (r["location"] as string || "").trim() === ewiFilterValue
        case "Tenure Band":   return (r["tenure band"] as string || "").trim() === ewiFilterValue
        default: return true
      }
    })
  }, [ewiPeriodFiltered, ewiFilterType, ewiFilterValue])

  // Fig 1 — Overall EWI trend by survey period (line)
  const ewiFig1 = useMemo(() => {
    const map: Record<string, EwiRawRow[]> = {}
    ewiFiltered.forEach(r => {
      const p = (r["survey period"] as string || "").trim()
      if (!p) return
      if (!map[p]) map[p] = []
      map[p].push(r)
    })
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([period, rows]) => {
      const keys = resolveEwiKeys(rows as any)
      const avg = (indices: number[]) => {
        const resolved = indices.map(i => keys[i])
        const vals = rows.flatMap(r =>
          resolved.map(k => toLikert(r[k])).filter((v): v is number => v !== null)
        )
        return vals.length ? Number((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2)) : 0
      }
      return { period, overall: avg([0,1,2,3,4,5,6]), physical: avg([0,1]), mental: avg([2,3,4]), social: avg([5,6]) }
    })
  }, [ewiFiltered])

  // Fig 2 — EWI dimension breakdown (horizontal bar)
  const ewiFig2 = useMemo(() => {
    const keys = resolveEwiKeys(ewiFiltered as any)
    const avg = (indices: number[]) => {
      const resolved = indices.map(i => keys[i])
      const vals = ewiFiltered.flatMap(r =>
        resolved.map(k => toLikert(r[k])).filter((v): v is number => v !== null)
      )
      return vals.length ? Number((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2)) : 0
    }
    return [
      { dimension: "Physical",           score: avg([0, 1]) },
      { dimension: "Mental & Emotional", score: avg([2, 3, 4]) },
      { dimension: "Social & Belonging", score: avg([5, 6]) },
    ]
  }, [ewiFiltered])

  const ewiLowestDim = useMemo(() => [...ewiFig2].sort((a, b) => a.score - b.score)[0], [ewiFig2])

  // Fig 3 — EWI by segment (function / role level / location / tenure band)
  // Default to function breakdown; respects filter
  const ewiSegKey = useMemo(() => {
    if (ewiFilterType === "Role Level") return "role level"
    if (ewiFilterType === "Location")   return "location"
    if (ewiFilterType === "Tenure Band") return "tenure band"
    return "function"
  }, [ewiFilterType])

  const ewiFig3 = useMemo(() => {
    const map: Record<string, EwiRawRow[]> = {}
    ewiFiltered.forEach(r => {
      const k = (r[ewiSegKey] as string || "Unknown").trim()
      if (!map[k]) map[k] = []
      map[k].push(r)
    })
    return Object.entries(map)
      .map(([seg, rows]) => ({
        segment: seg,
        score: avgOf(rows, [0,1,2,3,4,5,6]) ?? 0,
        n: rows.length,
        suppressed: rows.length < 3,
      }))
      .filter(d => !d.suppressed)
  }, [ewiFiltered, ewiSegKey])

  const ewiHeadline = useMemo(() => {
    const keys = resolveEwiKeys(ewiFiltered as any)
    const avg = (indices: number[]) => {
      const resolved = indices.map(i => keys[i])
      const vals = ewiFiltered.flatMap(r =>
        resolved.map(k => toLikert(r[k])).filter((v): v is number => v !== null)
      )
      return vals.length ? Number((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2)) : null
    }
    return {
      overall:  avg([0,1,2,3,4,5,6]),
      physical: avg([0,1]),
      mental:   avg([2,3,4]),
      social:   avg([5,6]),
      responses: ewiFiltered.length,
    }
  }, [ewiFiltered])

  const ewiColor = (v: number) => v >= 4 ? "#7C3AED" : v >= 3 ? "#f59e0b" : "#ef4444"

  // ── UWP DERIVED ──────────────────────────────────────────
  const uwpEligKey = useMemo(() => {
    if (!uwpRows.length) return ""
    return Object.keys(uwpRows[0]).find(k => k.includes("total eligible")) ?? ""
  }, [uwpRows])

  const uwpPartKey = useMemo(() => {
    if (!uwpRows.length) return ""
    return Object.keys(uwpRows[0]).find(k => k.includes("number of employees who used")) ?? ""
  }, [uwpRows])

  const uwpInstKey = useMemo(() => {
    if (!uwpRows.length) return ""
    return Object.keys(uwpRows[0]).find(k => k.includes("total program usage")) ?? ""
  }, [uwpRows])

  const uwpAllPeriods = useMemo(() =>
    uniq(uwpRows.map(r => (r["reporting period"] as string || "").trim()))
  , [uwpRows])

  const uwpYears = useMemo(() =>
    uniq(uwpRows.map(r => {
      const p = (r["reporting period"] as string || "").trim()
      const m = p.match(/\b(20\d{2})\b/)
      return m ? m[1] : ""
    }).filter(Boolean))
  , [uwpRows])

  const uwpValueOptions = useMemo((): string[] => {
    switch (uwpFilterType) {
      case "Reporting Period": return uniq(uwpRows.map(r => (r["reporting period"] as string || "").trim()))
      case "Program Type":     return uniq(uwpRows.map(r => (r["program type"] as string || "").trim()))
      case "Program Name":     return uniq(uwpRows.map(r => (r["program name"] as string || "").trim()))
      default: return []
    }
  }, [uwpFilterType, uwpRows])

  const uwpVisibleFigs = useMemo(() =>
    uwpFilterType ? UWP_FILTER_AFFECTS[uwpFilterType] ?? [] : ["Fig 1", "Fig 2", "Fig 3"]
  , [uwpFilterType])

  const uwpPeriodFiltered = useMemo(() => {
    let rows = uwpRows
    if (uwpPeriod) {
      rows = rows.filter(r => (r["reporting period"] as string || "").trim() === uwpPeriod)
    } else if (uwpYear) {
      rows = rows.filter(r => (r["reporting period"] as string || "").includes(uwpYear))
    }
    return rows
  }, [uwpRows, uwpYear, uwpPeriod])

  const uwpFiltered = useMemo(() => {
    if (!uwpFilterType || !uwpFilterValue) return uwpPeriodFiltered
    return uwpPeriodFiltered.filter(r => {
      switch (uwpFilterType) {
        case "Reporting Period": return (r["reporting period"] as string || "").trim() === uwpFilterValue
        case "Program Type":     return (r["program type"] as string || "").trim() === uwpFilterValue
        case "Program Name":     return (r["program name"] as string || "").trim() === uwpFilterValue
        default: return true
      }
    })
  }, [uwpPeriodFiltered, uwpFilterType, uwpFilterValue])

  // Fig 1 — Utilization rate by program type (horizontal bar)
  const uwpFig1 = useMemo(() => {
    const map: Record<string, { elig: number; part: number }> = {}
    uwpFiltered.forEach(r => {
      const type = (r["program type"] as string || "Unknown").trim()
      if (!map[type]) map[type] = { elig: 0, part: 0 }
      map[type].elig += toNum(r[uwpEligKey])
      map[type].part += toNum(r[uwpPartKey])
    })
    return Object.entries(map).map(([type, d]) => ({
      type, rate: pct(d.part, d.elig), participants: d.part, eligible: d.elig,
    }))
  }, [uwpFiltered, uwpEligKey, uwpPartKey])

  // Fig 2 — Participants by program name (column chart)
  const uwpFig2 = useMemo(() => {
    const map: Record<string, { part: number; elig: number }> = {}
    uwpFiltered.forEach(r => {
      const name = (r["program name"] as string || r["program type"] as string || "Program").trim()
      if (!map[name]) map[name] = { part: 0, elig: 0 }
      map[name].part += toNum(r[uwpPartKey])
      map[name].elig += toNum(r[uwpEligKey])
    })
    return Object.entries(map).map(([name, d]) => ({
      name, participants: d.part, eligible: d.elig, rate: pct(d.part, d.elig),
    }))
  }, [uwpFiltered, uwpPartKey, uwpEligKey])

  // Fig 3 — Utilization rate by quarter/period (line chart)
  const uwpFig3 = useMemo(() => {
    const map: Record<string, { elig: number; part: number }> = {}
    uwpFiltered.forEach(r => {
      const period = (r["reporting period"] as string || "").trim()
      if (!period) return
      if (!map[period]) map[period] = { elig: 0, part: 0 }
      map[period].elig += toNum(r[uwpEligKey])
      map[period].part += toNum(r[uwpPartKey])
    })
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([period, d]) => ({
      period, rate: pct(d.part, d.elig),
    }))
  }, [uwpFiltered, uwpEligKey, uwpPartKey])

  const uwpHeadline = useMemo(() => {
    const elig = uwpFiltered.reduce((s, r) => s + toNum(r[uwpEligKey]), 0)
    const part = uwpFiltered.reduce((s, r) => s + toNum(r[uwpPartKey]), 0)
    const inst = uwpInstKey ? uwpFiltered.reduce((s, r) => s + toNum(r[uwpInstKey]), 0) : 0
    return {
      rate: pct(part, elig),
      participants: part,
      eligible: elig,
      programCount: uniq(uwpFiltered.map(r => (r["program name"] as string || "").trim())).length,
      avgUses: inst && elig ? Number((inst / elig).toFixed(2)) : null,
    }
  }, [uwpFiltered, uwpEligKey, uwpPartKey, uwpInstKey])

  const uwpColor = (v: number) => v >= 30 ? "#059669" : v >= 15 ? "#f59e0b" : "#ef4444"

  // ── TABS ──────────────────────────────────────────────────
  const TABS = [
    { key: "ewi",  label: "Employee Wellbeing Index",       accent: "#7C3AED", loaded: ewiLoaded },
    { key: "uwp",  label: "Wellbeing Program Utilization",  accent: "#059669", loaded: uwpLoaded },
  ] as const

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>

      {/* KPI row */}
      {wellbeingData && (ewiLoaded || uwpLoaded) && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12, marginBottom: 8 }}>
          {ewiLoaded && (
            <Card style={{ padding: "16px 20px" }}>
              <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6 }}>Employee Wellbeing Index</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                <span style={{ fontSize: 30, fontWeight: 800, color: "#7C3AED", lineHeight: 1 }}>{wellbeingData.ewi.value?.toFixed(2) ?? "—"}</span>
                <span style={{ fontSize: 12, color: "#7C3AED", fontWeight: 600 }}>/ 5</span>
              </div>
              <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 3 }}>{wellbeingData.ewi.responses} responses</div>
            </Card>
          )}
          {uwpLoaded && (
            <Card style={{ padding: "16px 20px" }}>
              <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6 }}>Program Utilization Rate</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                <span style={{ fontSize: 30, fontWeight: 800, color: "#059669", lineHeight: 1 }}>{wellbeingData.uwp.value ?? "—"}</span>
                <span style={{ fontSize: 12, color: "#05966999", fontWeight: 600 }}>%</span>
              </div>
              <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 3 }}>{wellbeingData.uwp.participants} / {wellbeingData.uwp.eligible} employees</div>
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
              opacity: t.loaded ? 1 : 0.45,
              boxShadow: activeTab === t.key ? `0 4px 14px ${t.accent}45` : "0 1px 3px rgba(0,0,0,.06)",
            }}>
            {t.loaded ? "●" : "○"} {t.label}
          </button>
        ))}
      </div>

      {/* ── EWI ── */}
      {activeTab === "ewi" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {!ewiLoaded ? <Card><EmptyState label="Employee Wellbeing Index" /></Card> : (
            <>
              <PeriodFilterBar
                filterKeys={Object.keys(EWI_FILTER_AFFECTS)}
                affectsMap={EWI_FILTER_AFFECTS}
                years={ewiYears}
                allPeriods={ewiAllPeriods}
                filterType={ewiFilterType}
                filterValue={ewiFilterValue}
                selectedYear={ewiYear}
                selectedPeriod={ewiPeriod}
                onFilterType={setEwiFilterType}
                onFilterValue={setEwiFilterValue}
                onYear={setEwiYear}
                onPeriod={setEwiPeriod}
                onClear={() => { setEwiFilterType(""); setEwiFilterValue(""); setEwiYear(""); setEwiPeriod("") }}
                accent="#7C3AED"
                valueOptions={ewiValueOptions}
              />

              {/* Summary */}
              <Card>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 14 }}>Employee Wellbeing Index — Summary</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10 }}>
                  <StatPill label="Overall EWI"        value={ewiHeadline.overall?.toFixed(2) ?? "—"} accent="#7C3AED" sub="Avg of Q1–Q7 (out of 5)" />
                  <StatPill label="Survey Responses"   value={ewiHeadline.responses}                   accent="#7C3AED" />
                  <StatPill label="Physical"           value={ewiHeadline.physical?.toFixed(2) ?? "—"} accent="#7C3AED" sub="Q1 + Q2 avg" />
                  <StatPill label="Mental & Emotional" value={ewiHeadline.mental?.toFixed(2) ?? "—"}   accent="#7C3AED" sub="Q3 + Q4 + Q5 avg" />
                  <StatPill label="Social & Belonging" value={ewiHeadline.social?.toFixed(2) ?? "—"}   accent="#7C3AED" sub="Q6 + Q7 avg" />
                  {ewiLowestDim?.score >= 0 && (
                    <StatPill label="Lowest Dimension" value={ewiLowestDim.dimension} accent="#ef4444" sub={`${ewiLowestDim.score.toFixed(2)} / 5`} />
                  )}
                </div>
              </Card>

              {/* Fig 1 — Trend by period */}
              {ewiVisibleFigs.includes("Fig 1") && (
                <FigCard fig="Fig 1" title="Employee Wellbeing Index by Survey Period" subtitle="Line chart · trend over time · affected by: Survey Period, Function">
                  {ewiFig1.length < 2 ? <EmptyChart msg="Need ≥2 survey periods to show trend" /> : (
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={ewiFig1} margin={{ top: 10, right: 30, left: 0, bottom: 10 }}>
                        <CartesianGrid strokeDasharray="4 4" stroke="#f1f5f9" />
                        <XAxis dataKey="period" tick={{ fill: "#94a3b8", fontSize: 12 }} />
                        <YAxis domain={[1, 5]} tick={{ fill: "#94a3b8", fontSize: 12 }} />
                        <Tooltip content={<CT />} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Line type="monotone" dataKey="overall"  name="Overall EWI"       stroke="#7C3AED" strokeWidth={2.5} dot={{ r: 5, fill: "#7C3AED",  strokeWidth: 0 }} activeDot={{ r: 7 }} />
                        <Line type="monotone" dataKey="physical" name="Physical"           stroke="#3b82f6" strokeWidth={1.5} dot={{ r: 4, fill: "#3b82f6",  strokeWidth: 0 }} strokeDasharray="5 3" />
                        <Line type="monotone" dataKey="mental"   name="Mental & Emotional" stroke="#f59e0b" strokeWidth={1.5} dot={{ r: 4, fill: "#f59e0b",  strokeWidth: 0 }} strokeDasharray="5 3" />
                        <Line type="monotone" dataKey="social"   name="Social & Belonging" stroke="#10b981" strokeWidth={1.5} dot={{ r: 4, fill: "#10b981",  strokeWidth: 0 }} strokeDasharray="5 3" />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </FigCard>
              )}

              {/* Fig 2 — Dimension breakdown */}
              {ewiVisibleFigs.includes("Fig 2") && (
                <FigCard fig="Fig 2" title="EWI Score by Wellbeing Dimension" subtitle="Horizontal bar · affected by: Survey Period, Function, Role Level, Location, Tenure Band">
                  {ewiFig2.every(d => d.score === 0) ? <EmptyChart msg="No scores in current selection" /> : (
                    <ResponsiveContainer width="100%" height={Math.max(160, ewiFig2.length * 60)}>
                      <BarChart layout="vertical" data={ewiFig2} margin={{ top: 4, right: 60, left: 10, bottom: 4 }}>
                        <CartesianGrid strokeDasharray="4 4" stroke="#f1f5f9" horizontal={false} />
                        <XAxis type="number" domain={[0, 5]} tick={{ fill: "#94a3b8", fontSize: 11 }} />
                        <YAxis type="category" dataKey="dimension" tick={{ fill: "#475569", fontSize: 12 }} width={140} />
                        <Tooltip content={<CT />} />
                        <Bar dataKey="score" name="Avg Score" radius={[0, 6, 6, 0]}>
                          {ewiFig2.map((d, i) => (
                            <Cell key={i}
                              fill={d.dimension === ewiLowestDim?.dimension ? "#ef4444" : "#7C3AED"}
                              fillOpacity={d.dimension === ewiLowestDim?.dimension ? 1 : 0.75}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </FigCard>
              )}

              {/* Fig 3 — EWI by segment */}
              {ewiVisibleFigs.includes("Fig 3") && (
                <FigCard
                  fig="Fig 3"
                  title={`EWI Score by ${ewiSegKey === "function" ? "Function" : ewiSegKey.split(" ").map(w => w[0].toUpperCase() + w.slice(1)).join(" ")}`}
                  subtitle="Horizontal bar · affected by: Survey Period, Function, Role Level, Location, Tenure Band · groups <3 responses suppressed"
                >
                  {ewiFig3.length === 0 ? <EmptyChart msg="No segment data (or all groups suppressed <3 responses)" /> : (
                    <ResponsiveContainer width="100%" height={Math.max(220, ewiFig3.length * 52)}>
                      <BarChart layout="vertical" data={ewiFig3} margin={{ top: 4, right: 60, left: 10, bottom: 4 }}>
                        <CartesianGrid strokeDasharray="4 4" stroke="#f1f5f9" horizontal={false} />
                        <XAxis type="number" domain={[0, 5]} tick={{ fill: "#94a3b8", fontSize: 11 }} />
                        <YAxis type="category" dataKey="segment" tick={{ fill: "#475569", fontSize: 12 }} width={130} />
                        <Tooltip content={<CT />} />
                        <Bar dataKey="score" name="EWI Score" radius={[0, 6, 6, 0]}>
                          {ewiFig3.map((d, i) => <Cell key={i} fill={ewiColor(d.score)} />)}
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

      {/* ── UWP ── */}
      {activeTab === "uwp" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {!uwpLoaded ? <Card><EmptyState label="Wellbeing Program Utilization" /></Card> : (
            <>
              <PeriodFilterBar
                filterKeys={Object.keys(UWP_FILTER_AFFECTS)}
                affectsMap={UWP_FILTER_AFFECTS}
                years={uwpYears}
                allPeriods={uwpAllPeriods}
                filterType={uwpFilterType}
                filterValue={uwpFilterValue}
                selectedYear={uwpYear}
                selectedPeriod={uwpPeriod}
                onFilterType={setUwpFilterType}
                onFilterValue={setUwpFilterValue}
                onYear={setUwpYear}
                onPeriod={setUwpPeriod}
                onClear={() => { setUwpFilterType(""); setUwpFilterValue(""); setUwpYear(""); setUwpPeriod("") }}
                accent="#059669"
                valueOptions={uwpValueOptions}
              />

              {/* Summary */}
              <Card>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 14 }}>Wellbeing Program Utilization — Summary</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10 }}>
                  <StatPill label="Utilization Rate"     value={`${uwpHeadline.rate}%`}    accent="#059669" sub="Participants ÷ Eligible" />
                  <StatPill label="Employees Participated" value={uwpHeadline.participants} accent="#059669" />
                  <StatPill label="Total Eligible"       value={uwpHeadline.eligible}       accent="#059669" />
                  <StatPill label="Programs Tracked"     value={uwpHeadline.programCount}   accent="#059669" />
                  {uwpHeadline.avgUses !== null && (
                    <StatPill label="Avg Uses / Employee" value={uwpHeadline.avgUses}       accent="#059669" sub="Optional metric" />
                  )}
                </div>
              </Card>

              {/* Fig 1 — Utilization rate by program type (horizontal bar) */}
              {uwpVisibleFigs.includes("Fig 1") && (
                <FigCard fig="Fig 1" title="Wellbeing Program Utilization Rate (%) by Program Type" subtitle="Horizontal bar · best for showing which wellbeing categories have the strongest uptake · affected by: Reporting Period, Program Type">
                  {uwpFig1.length === 0 ? <EmptyChart msg="No program type data in current selection" /> : (
                    <ResponsiveContainer width="100%" height={Math.max(200, uwpFig1.length * 56)}>
                      <BarChart layout="vertical" data={uwpFig1} margin={{ top: 4, right: 60, left: 10, bottom: 4 }}>
                        <CartesianGrid strokeDasharray="4 4" stroke="#f1f5f9" horizontal={false} />
                        <XAxis type="number" domain={[0, 100]} tick={{ fill: "#94a3b8", fontSize: 11 }} unit="%" />
                        <YAxis type="category" dataKey="type" tick={{ fill: "#475569", fontSize: 12 }} width={140} />
                        <Tooltip content={<CT unit="%" />} />
                        <Bar dataKey="rate" name="Utilization Rate" radius={[0, 6, 6, 0]}>
                          {uwpFig1.map((d, i) => <Cell key={i} fill={uwpColor(d.rate)} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </FigCard>
              )}

              {/* Fig 2 — Participants by program name (column chart) */}
              {uwpVisibleFigs.includes("Fig 2") && (
                <FigCard fig="Fig 2" title="Participants by Program" subtitle="Column chart · adoption volume at program level · affected by: Program Name">
                  {uwpFig2.length === 0 ? <EmptyChart msg="No program data in current selection" /> : (
                    <ResponsiveContainer width="100%" height={320}>
                      <BarChart data={uwpFig2} margin={{ top: 10, right: 20, left: 0, bottom: 70 }}>
                        <CartesianGrid strokeDasharray="4 4" stroke="#f1f5f9" />
                        <XAxis dataKey="name" tick={{ fill: "#475569", fontSize: 11 }} angle={-35} textAnchor="end" interval={0} />
                        <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} />
                        <Tooltip content={<CT />} />
                        <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                        <Bar dataKey="eligible"     name="Total Eligible"    fill="#94a3b8" fillOpacity={0.5} radius={[4, 4, 0, 0]} />
                        <Bar dataKey="participants" name="Participants"       fill="#059669" fillOpacity={0.85} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </FigCard>
              )}

              {/* Fig 3 — Utilization rate trend by period (line chart) */}
              {uwpVisibleFigs.includes("Fig 3") && (
                <FigCard fig="Fig 3" title="Wellbeing Program Utilization Rate (%) by Quarter" subtitle="Line chart · tracking whether wellbeing program use is improving over time · affected by: Reporting Period">
                  {uwpFig3.length < 2 ? <EmptyChart msg="Need ≥2 reporting periods to show trend" /> : (
                    <ResponsiveContainer width="100%" height={280}>
                      <LineChart data={uwpFig3} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                        <CartesianGrid strokeDasharray="4 4" stroke="#f1f5f9" />
                        <XAxis dataKey="period" tick={{ fill: "#94a3b8", fontSize: 12 }} />
                        <YAxis domain={[0, 100]} tick={{ fill: "#94a3b8", fontSize: 12 }} unit="%" />
                        <Tooltip content={<CT unit="%" />} />
                        <Line type="monotone" dataKey="rate" name="Utilization Rate" stroke="#059669" strokeWidth={2.5} dot={{ r: 5, fill: "#059669", strokeWidth: 0 }} activeDot={{ r: 7 }} />
                      </LineChart>
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