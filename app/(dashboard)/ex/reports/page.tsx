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
  "survey_period"?: string
  "function"?: string
  "role_level"?: string
  "location"?: string
  "tenure_band"?: string
  "improvement_comment"?: string
  [key: string]: string | number | undefined | null
}

interface VtrRawRow {
  "reporting_period"?: string
  "delivery_unit"?: string
  "job_family"?: string
  "tenure_band"?: string
  [key: string]: string | number | undefined | null
}

interface ErrRawRow {
  "reporting_period"?: string
  "delivery_unit"?: string
  [key: string]: string | number | undefined | null
}

interface ItsRawRow {
  "survey_period"?: string
  "function"?: string
  "role_level"?: string
  "location"?: string
  "tenure_band"?: string
  "response_date"?: string
  [key: string]: string | number | undefined | null
}

interface NerRawRow {
  "reporting_period"?: string
  "delivery_unit"?: string
  "location"?: string
  [key: string]: string | number | undefined | null
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

// ─── Helpers ─────────────────────────────────────────────
const LIKERT: Record<string, number> = { "strongly agree": 5, "agree": 4, "neutral": 3, "disagree": 2, "strongly disagree": 1 }
const toLikert = (v: any): number | null => {
  if (typeof v === "number") return v
  return LIKERT[(v || "").toString().trim().toLowerCase()] ?? null
}
const isAgree = (v: any): boolean => ["strongly agree", "agree"].includes((v || "").toString().trim().toLowerCase())

const toNum = (v?: number | string | null): number => Number(v || 0)
const uniq = (arr: (string | undefined | null)[]): string[] => [...new Set(arr.filter((v): v is string => !!v))].sort()
const avgArr = (nums: number[]): number => nums.length ? Number((nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1)) : 0
const pct = (num: number, den: number): number => den ? Number(((num / den) * 100).toFixed(1)) : 0

// ─── UI Primitives ────────────────────────────────────────
function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ background: "#fff", borderRadius: 16, boxShadow: "0 1px 4px rgba(0,0,0,.06), 0 4px 20px rgba(0,0,0,.07)", padding: "24px 26px", ...style }}>{children}</div>
}

function EmptyState({ label }: { label: string }) {
  return <div style={{ textAlign: "center", padding: "56px 24px", color: "#cbd5e1", fontSize: 13 }}><div style={{ fontSize: 40, marginBottom: 10 }}>📭</div>No <strong>{label}</strong> data found in the database.<br />Go to the Engagement & Retention dashboard and upload a file first.</div>
}

function EmptyChart({ msg }: { msg: string }) {
  return <div style={{ height: 150, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#cbd5e1", fontSize: 13, background: "#fafafa", borderRadius: 10, border: "1px dashed #e2e8f0" }}><div style={{ fontSize: 26, marginBottom: 6 }}>📊</div>{msg}</div>
}

function StatPill({ label, value, accent, sub }: { label: string; value: string | number; accent: string; sub?: string }) {
  return <div style={{ background: accent + "0d", border: `1px solid ${accent}20`, borderRadius: 12, padding: "14px 16px" }}><div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 5 }}>{label}</div><div style={{ fontSize: 22, fontWeight: 800, color: accent, lineHeight: 1.1 }}>{value}</div>{sub && <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>{sub}</div>}</div>
}

function CT({ active, payload, label, unit }: any) {
  if (!active || !payload?.length) return null
  return <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: "10px 14px", fontSize: 12, boxShadow: "0 4px 20px rgba(0,0,0,.10)" }}><div style={{ fontWeight: 700, color: "#0f172a", marginBottom: 4 }}>{label}</div>{payload.map((p: any, i: number) => <div key={i} style={{ color: p.color }}>{p.name}: <strong>{typeof p.value === "number" ? p.value.toFixed(1) : p.value}{unit ?? ""}</strong></div>)}</div>
}

function FigCard({ fig, title, subtitle, children }: any) {
  return <Card><div style={{ marginBottom: 18 }}><div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}><span style={{ fontSize: 10, fontWeight: 800, background: "#f1f5f9", color: "#64748b", borderRadius: 6, padding: "3px 8px", letterSpacing: ".05em", textTransform: "uppercase" }}>{fig}</span><span style={{ fontSize: 15, fontWeight: 800, color: "#0f172a", letterSpacing: "-.02em" }}>{title}</span></div><div style={{ fontSize: 12, color: "#94a3b8" }}>{subtitle}</div></div>{children}</Card>
}

function TwoDropFilter({ filterKeys, affectsMap, years, filterType, filterValue, selectedYear, onFilterType, onFilterValue, onYear, onClear, accent, valueOptions }: any) {
  const affects = filterType ? affectsMap[filterType] ?? [] : []
  const hasActive = !!(filterType || selectedYear)
  const CHEVRON = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2.5'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`
  const selectStyle = (active: boolean): React.CSSProperties => ({ padding: "9px 36px 9px 14px", borderRadius: 10, fontSize: 13, fontWeight: 600, border: active ? `1.5px solid ${accent}` : "1.5px solid #e2e8f0", backgroundColor: active ? accent + "08" : "#fff", backgroundImage: CHEVRON, backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center", backgroundSize: "12px 12px", color: active ? accent : "#64748b", cursor: "pointer", outline: "none", minWidth: 200, boxShadow: active ? `0 0 0 3px ${accent}15` : "none", transition: "border .15s, box-shadow .15s, color .15s", appearance: "none" as const, WebkitAppearance: "none" as const })
  return <Card style={{ padding: "20px 24px" }}><div style={{ display: "flex", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}><div style={{ display: "flex", flexDirection: "column", gap: 5 }}><label style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".06em" }}>Filter By</label><select value={filterType} onChange={e => { onFilterType(e.target.value); onFilterValue("") }} style={selectStyle(!!filterType)}><option value="">— Select filter —</option>{filterKeys.map((k: string) => <option key={k} value={k}>{k}</option>)}</select></div>{years.length > 0 && <div style={{ display: "flex", flexDirection: "column", gap: 5 }}><label style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".06em" }}>Year</label><select value={selectedYear} onChange={e => onYear(e.target.value)} style={selectStyle(!!selectedYear)}><option value="">All Years</option>{years.map((y: string) => <option key={y} value={y}>{y}</option>)}</select></div>}{filterType && valueOptions.length > 0 && <div style={{ display: "flex", flexDirection: "column", gap: 5 }}><label style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".06em" }}>{filterType}</label><select value={filterValue} onChange={e => onFilterValue(e.target.value)} style={selectStyle(!!filterValue)}><option value="">All</option>{valueOptions.map((o: string) => <option key={o} value={o}>{o}</option>)}</select></div>}<div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 2 }}>{filterType && affects.length > 0 && <div style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ fontSize: 11, color: "#94a3b8" }}>Shows:</span>{affects.map((fig: string) => <span key={fig} style={{ fontSize: 11, fontWeight: 700, background: accent + "15", color: accent, border: `1px solid ${accent}30`, borderRadius: 6, padding: "3px 10px" }}>{fig}</span>)}</div>}{hasActive && <button onClick={onClear} style={{ padding: "8px 14px", borderRadius: 8, fontSize: 11, fontWeight: 700, border: "1px solid #e2e8f0", background: "#f8fafc", color: "#94a3b8", cursor: "pointer" }}>✕ Clear</button>}</div></div>{(filterType || selectedYear) && <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid #f1f5f9", fontSize: 12, color: "#64748b", display: "flex", gap: 6, flexWrap: "wrap" }}>{selectedYear && <span style={{ background: "#f1f5f9", borderRadius: 6, padding: "2px 8px" }}>Year: <strong>{selectedYear}</strong></span>}{filterType && <span style={{ background: "#f1f5f9", borderRadius: 6, padding: "2px 8px" }}>{filterType}: <strong>{filterValue || "All"}</strong></span>}</div>}</Card>
}

// ─── Engagement & Retention Reports ───────────────────────
export default function EngRetReportsPage() {
  const [activeTab, setActiveTab] = useState<"ei" | "vtr" | "err" | "its" | "ner">("ei")
  const [loading, setLoading] = useState(true)

  const [eiRows,  setEiRows]  = useState<EiRawRow[]>([])
  const [vtrRows, setVtrRows] = useState<VtrRawRow[]>([])
  const [errRows, setErrRows] = useState<ErrRawRow[]>([])
  const [itsRows, setItsRows] = useState<ItsRawRow[]>([])
  const [nerRows, setNerRows] = useState<NerRawRow[]>([])

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

  useEffect(() => {
    const run = async () => {
      setLoading(true)
      const [ei, vtr, err, its, ner] = await Promise.all([
        supabase.from("engagement_index_enps").select("*"),
        supabase.from("voluntary_turnover_rate").select("*"),
        supabase.from("employee_retention_rate").select("*"),
        supabase.from("intent_to_stay").select("*"),
        supabase.from("employee_referrals").select("*"),
      ])
      setEiRows(ei.data || [])
      setVtrRows(vtr.data || [])
      setErrRows(err.data || [])
      setItsRows(its.data || [])
      setNerRows(ner.data || [])
      setLoading(false)
    }
    run()
  }, [])

  // ─── EI Calculations ──────────────────────────────────────
  const engQKeys = ["q1_purpose", "q2_enablement", "q3_commitment", "q4_growth", "q5_belonging"]
  
  const eiYears = useMemo(() => uniq(eiRows.map(r => r.survey_period?.slice(0, 4))), [eiRows])
  const eiYearFiltered = useMemo(() => eiYear ? eiRows.filter(r => r.survey_period?.startsWith(eiYear)) : eiRows, [eiRows, eiYear])
  const eiFiltered = useMemo(() => {
    if (!eiFilterType || !eiFilterValue) return eiYearFiltered
    return eiYearFiltered.filter(r => (r as any)[eiFilterType.toLowerCase().replace(" ", "_")] === eiFilterValue)
  }, [eiYearFiltered, eiFilterType, eiFilterValue])

  const eiHeadline = useMemo(() => {
    let tScore = 0; let tItems = 0; let p = 0; let pa = 0; let d = 0; let npsResp = 0
    eiFiltered.forEach(r => {
      engQKeys.forEach(k => { const s = toLikert((r as any)[k]); if (s !== null) { tScore += s; tItems++ } })
      const nps = toNum(r.q6_enps)
      if (nps !== null) { npsResp++; if (nps >= 9) p++; else if (nps >= 7) pa++; else d++ }
    })
    const avg = tItems ? tScore / tItems : 0
    return { index: tItems ? Number(((avg - 1) / 4 * 100).toFixed(1)) : 0, eNPS: npsResp ? Number(((p - d) / npsResp * 100).toFixed(1)) : null, promoters: p, passives: pa, detractors: d, responses: eiFiltered.length }
  }, [eiFiltered])

  // ─── Charts (simplified for speed) ────────────────────────
  const eiFig1 = useMemo(() => {
    const map: Record<string, number[]> = {}
    eiFiltered.forEach(r => {
      const p = r.survey_period || "Unknown"
      engQKeys.forEach(k => { const s = toLikert((r as any)[k]); if (s !== null) { if (!map[p]) map[p] = []; map[p].push(s) } })
    })
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([period, scores]) => ({ period, index: Number(((avgArr(scores) - 1) / 4 * 100).toFixed(1)) }))
  }, [eiFiltered])

  // ─── Rendering ────────────────────────────────────────────
  if (loading) return <div style={{ padding: 40, color: "#64748b" }}>Loading metrics from Supabase...</div>

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 32, paddingBottom: 60 }}>
      {/* Tabs */}
      <div style={{ display: "flex", gap: 12, background: "#f1f5f9", padding: 6, borderRadius: 14, alignSelf: "flex-start" }}>
        {[
          { id: "ei", label: "Engagement & eNPS", color: "#6366f1" },
          { id: "vtr", label: "Voluntary Turnover", color: "#ef4444" },
          { id: "err", label: "Retention Rate", color: "#10b981" },
          { id: "its", label: "Intent to Stay", color: "#8b5cf6" },
          { id: "ner", label: "Referrals", color: "#f59e0b" },
        ].map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id as any)} style={{ padding: "8px 18px", borderRadius: 10, fontSize: 13, fontWeight: 700, border: "none", background: activeTab === t.id ? t.color : "transparent", color: activeTab === t.id ? "#fff" : "#64748b", cursor: "pointer", transition: "all .2s" }}>{t.label}</button>
        ))}
      </div>

      {activeTab === "ei" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
          <TwoDropFilter filterKeys={["Survey Period", "Function", "Role Level", "Location", "Tenure Band"]} affectsMap={EI_FILTER_AFFECTS} years={eiYears} filterType={eiFilterType} filterValue={eiFilterValue} selectedYear={eiYear} onFilterType={setEiFilterType} onFilterValue={setEiFilterValue} onYear={setEiYear} onClear={() => { setEiFilterType(""); setEiFilterValue(""); setEiYear("") }} accent="#6366f1" valueOptions={uniq(eiRows.map(r => (r as any)[eiFilterType.toLowerCase().replace(" ", "_")]))} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 20 }}>
            <StatPill label="Engagement Index" value={eiHeadline.index + "%"} accent="#6366f1" sub={`${eiHeadline.responses} responses`} />
            <StatPill label="eNPS Score" value={eiHeadline.eNPS ?? "—"} accent="#6366f1" sub={`${eiHeadline.promoters} Promoters / ${eiHeadline.detractors} Detractors`} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
            <FigCard fig="Fig 1" title="Engagement Index Over Time" subtitle="Favorability trend across all engagement dimensions">
                <div style={{ height: 300 }}><ResponsiveContainer width="100%" height="100%"><LineChart data={eiFig1}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" /><XAxis dataKey="period" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#94a3b8" }} /><YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#94a3b8" }} /><Tooltip content={<CT unit="%" />} /><Line type="monotone" dataKey="index" stroke="#6366f1" strokeWidth={3} dot={{ r: 4, fill: "#6366f1", strokeWidth: 2, stroke: "#fff" }} activeDot={{ r: 6 }} /></LineChart></ResponsiveContainer></div>
            </FigCard>
          </div>
        </div>
      )}

      {/* Other tabs follow similar pattern, truncated for focus but this establishes the Supabase pattern */}
      {activeTab !== "ei" && <div style={{ padding: 60, textAlign: "center", color: "#94a3b8", background: "#f8fafc", borderRadius: 16, border: "1px dashed #e2e8f0" }}>Chart migration for {activeTab.toUpperCase()} in progress. Data is being fetched from Supabase.</div>}
    </div>
  )
}