"use client"

import { useState, useRef, useEffect } from "react"
import * as XLSX from "xlsx"

interface RowObject { [key: string]: string | number }

interface UploadZoneProps { onFile: (file: File) => void; loaded: boolean }

interface MetricCardProps {
  icon: string; title: string; subtitle: string
  value: string | number | null; unit?: string; accent: string
  onFile: (file: File) => void; loaded: boolean; detail?: string
}

const normalizeKey = (k: string) => k.trim().toLowerCase()

const parseSheet = (file: File): Promise<RowObject[]> =>
  new Promise(resolve => {
    const reader = new FileReader()
    reader.onload = evt => {
      const arrayBuffer = evt.target?.result
      if (!arrayBuffer) return resolve([])
      const wb = XLSX.read(arrayBuffer, { type: "array" })
      const rows = XLSX.utils.sheet_to_json<RowObject>(wb.Sheets[wb.SheetNames[0]])
      resolve(rows.map(row => {
        const obj: RowObject = {}
        Object.keys(row).forEach(k => { obj[normalizeKey(k)] = row[k] })
        return obj
      }))
    }
    reader.readAsArrayBuffer(file)
  })

function UploadZone({ onFile, loaded }: UploadZoneProps) {
  const ref = useRef<HTMLInputElement>(null)
  const [drag, setDrag] = useState(false)
  const handle = (file?: File) => { if (file) onFile(file) }
  return (
    <div
      onClick={() => ref.current?.click()}
      onDragOver={e => { e.preventDefault(); setDrag(true) }}
      onDragLeave={() => setDrag(false)}
      onDrop={e => { e.preventDefault(); setDrag(false); handle(e.dataTransfer.files[0]) }}
      style={{
        border: `1.5px dashed ${drag ? "#7C3AED" : loaded ? "#059669" : "#cbd5e1"}`,
        borderRadius: 10, padding: "12px 10px", cursor: "pointer",
        background: drag ? "#F5F3FF" : loaded ? "#ECFDF5" : "#f8fafc",
        textAlign: "center", fontSize: 12,
        color: loaded ? "#059669" : "#94a3b8",
        transition: "all .2s", marginBottom: 16, userSelect: "none",
      }}
    >
      <input ref={ref} type="file" accept=".xlsx,.xls,.csv" hidden onChange={e => handle(e.target.files?.[0])} />
      {loaded
        ? <><span style={{ fontSize: 16 }}>✓</span> File loaded</>
        : <><span style={{ fontSize: 16 }}>↑</span><br />Drop or click to upload<br />.xlsx / .xls / .csv</>}
    </div>
  )
}

function MetricCard({ icon, title, subtitle, value, unit, accent, onFile, loaded, detail }: MetricCardProps) {
  return (
    <div
      style={{
        background: "#fff", borderRadius: 16,
        boxShadow: "0 1px 3px rgba(0,0,0,.06), 0 4px 16px rgba(0,0,0,.06)",
        overflow: "hidden", display: "flex", flexDirection: "column",
        transition: "box-shadow .2s, transform .2s",
      }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 8px 32px rgba(0,0,0,.12)"; e.currentTarget.style.transform = "translateY(-2px)" }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,.06), 0 4px 16px rgba(0,0,0,.06)"; e.currentTarget.style.transform = "translateY(0)" }}
    >
      <div style={{ height: 4, background: accent }} />
      <div style={{ padding: "20px 22px 22px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 16 }}>
          <div style={{
            width: 42,
            height: 42,
            borderRadius: 12,
            background: `linear-gradient(135deg, ${accent}30, ${accent}10)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 16,
            fontWeight: 800,
            color: accent,
            letterSpacing: "0.5px"
          }}>
            {icon}
          </div>
          
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: "#0f172a", lineHeight: 1.2 }}>{title}</div>
            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{subtitle}</div>
          </div>
        </div>
        <UploadZone onFile={onFile} loaded={loaded} />
        <div style={{
          background: `linear-gradient(135deg, ${accent}10, ${accent}05)`,
          border: "1px solid " + accent + "22",
          borderRadius: 12, padding: "14px 16px",
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#64748b", letterSpacing: ".04em", textTransform: "uppercase", marginBottom: 4 }}>Result</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
              <span style={{ fontSize: 32, fontWeight: 800, color: accent, lineHeight: 1 }}>{value ?? "—"}</span>
              {unit && <span style={{ fontSize: 14, fontWeight: 600, color: accent + "aa" }}>{unit}</span>}
            </div>
          </div>
          {detail && <div style={{ fontSize: 11, color: "#94a3b8", textAlign: "right", maxWidth: 90, lineHeight: 1.4 }}>{detail}</div>}
        </div>
      </div>
    </div>
  )
}

function BenchmarkRow({
  label, value, target, accent, unit = "%",
}: { label: string; value: number; target: number; accent: string; unit?: string }) {
  const pct = Math.min(100, Math.round((value / target) * 100))
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#475569", marginBottom: 4 }}>
        <span>{label}</span>
        <span style={{ fontWeight: 700, color: accent }}>{value}{unit}</span>
      </div>
      <div style={{ height: 6, borderRadius: 4, background: "#f1f5f9", overflow: "hidden" }}>
        <div style={{ width: pct + "%", height: "100%", borderRadius: 4, background: accent, transition: "width .6s ease" }} />
      </div>
    </div>
  )
}

// ─── Likert helpers ────────────────────────────────────────────────────────────
const LIKERT: Record<string, number> = {
  "strongly agree": 5, "agree": 4, "neutral": 3, "disagree": 2, "strongly disagree": 1,
}
const toLikert = (v: string | number | undefined): number | null => {
  if (typeof v === "number") return v
  return LIKERT[(v as string || "").trim().toLowerCase()] ?? null
}

// ─── EWI helpers ────────────────────────────────────────────────────────────
const Q_KEYS_PREFIXES = ["q1", "q2", "q3", "q4", "q5", "q6", "q7"]

const resolveQKeys = (rows: RowObject[]): string[] => {
  if (!rows.length) return []
  const allKeys = [...new Set(rows.flatMap(r => Object.keys(r)))]
  return Q_KEYS_PREFIXES.map(prefix =>
    allKeys.find(k => k.startsWith(prefix)) ?? prefix
  )
}

function computeEwiScores(rows: RowObject[]) {
  const resolved = resolveQKeys(rows)
  const avgQ = (keys: string[]) => {
    const vals = rows.flatMap(r => keys.map(k => toLikert(r[k] as string | number | undefined)).filter((v): v is number => v !== null))
    return vals.length ? Number((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2)) : null
  }
  return {
    physical: avgQ(resolved.slice(0, 2)),
    mental:   avgQ(resolved.slice(2, 5)),
    social:   avgQ(resolved.slice(5, 7)),
    overall:  avgQ(resolved),
  }
}

type SegKey = "all" | "function" | "role level" | "location" | "tenure band"

// ─── State shape ────────────────────────────────────────────────────────────
interface WellbeingMetrics {
  ewi: {
    value: number | null
    physical: number | null
    mental: number | null
    social: number | null
    responses: number
    rows: RowObject[]
    loaded: boolean
  }
  uwp: {
    value: number | null
    participants: number
    eligible: number
    programCount: number
    avgUsesPerEmployee: number | null
    programs: Array<{ name: string; type: string; rate: number; participants: number; eligible: number }>
    loaded: boolean
  }
}

const defaultState: WellbeingMetrics = {
  ewi: { value: null, physical: null, mental: null, social: null, responses: 0, rows: [], loaded: false },
  uwp: { value: null, participants: 0, eligible: 0, programCount: 0, avgUsesPerEmployee: null, programs: [], loaded: false },
}

export default function WellbeingDashboard() {
  const [metrics, setMetrics] = useState<WellbeingMetrics>(() => {
    try {
      const s = localStorage.getItem("wellbeingMetricsData")
      return s ? JSON.parse(s) : defaultState
    } catch { return defaultState }
  })

  const [activeSeg, setActiveSeg] = useState<SegKey>("all")

  useEffect(() => {
    localStorage.setItem("wellbeingMetricsData", JSON.stringify(metrics))
  }, [metrics])

  // ─── EWI Handler ─────────────────────────────────────────────────────────
  // Expected columns (case-insensitive):
  //   Survey Period | Function | Role Level | Location | Tenure Band |
  //   Q1 Physical Health | Q2 Work Environment | Q3 Stress Management |
  //   Q4 Manager Support | Q5 Work Life Balance | Q6 Inclusion & Support | Q7 Relationships
  const handleEwi = async (file: File) => {
    const rows = await parseSheet(file)
    if (!rows.length) { alert("File is empty."); return }

    const existing: RowObject[] = metrics.ewi.rows
    const makeKey = (r: RowObject) =>
      `${r["survey period"] ?? ""}|${(r["function"] ?? "").toString().trim()}|${(r["role level"] ?? "").toString().trim()}|${(r["location"] ?? "").toString().trim()}`
    const existingKeys = new Set(existing.map(makeKey))
    const merged = [...existing, ...rows.filter(r => !existingKeys.has(makeKey(r)))]

    const scores = computeEwiScores(merged)
    
    localStorage.setItem("ewiRawRows", JSON.stringify(merged))

    setMetrics(prev => ({
      ...prev,
      ewi: {
        value: scores.overall,
        physical: scores.physical,
        mental: scores.mental,
        social: scores.social,
        responses: merged.length,
        rows: merged,
        loaded: true,
      },
    }))
  }

  // ─── UWP Handler ─────────────────────────────────────────────────────────
  // Expected columns (case-insensitive):
  //   Reporting Period | Program Type | Program Name |
  //   Total Eligible Employees | Number of Employees Who Used at Least One Wellbeing Program |
  //   Wellbeing Program Utilization Rate (%) | Total Program Usage Instances (Optional)
  const handleUwp = async (file: File) => {
    const rows = await parseSheet(file)
    if (!rows.length) { alert("File is empty."); return }

    const keys = Object.keys(rows[0])
    const eligKey   = keys.find(k => k.includes("total eligible")) ?? ""
    const partKey   = keys.find(k => k.includes("number of employees who used")) ?? ""
    const nameKey   = keys.find(k => k.includes("program name")) ?? ""
    const typeKey   = keys.find(k => k.includes("program type")) ?? ""
    const instKey   = keys.find(k => k.includes("total program usage")) ?? ""

    if (!eligKey || !partKey) {
      alert("Missing columns: 'Total Eligible Employees' and/or 'Number of Employees Who Used at Least One Wellbeing Program'")
      return
    }

    const existing: RowObject[] = JSON.parse(localStorage.getItem("uwpRawRows") || "[]")
    const makeKey = (r: RowObject) =>
      `${r["reporting period"] ?? ""}|${(r[typeKey] ?? "").toString().trim()}|${(r[nameKey] ?? "").toString().trim()}`
    const existingKeys = new Set(existing.map(makeKey))
    const merged = [...existing, ...rows.filter(r => !existingKeys.has(makeKey(r)))]
    localStorage.setItem("uwpRawRows", JSON.stringify(merged))

    const totalElig = merged.reduce((s, r) => s + Number(r[eligKey] || 0), 0)
    const totalPart = merged.reduce((s, r) => s + Number(r[partKey] || 0), 0)
    const totalInst = instKey ? merged.reduce((s, r) => s + Number(r[instKey] || 0), 0) : null
    const rate = totalElig ? Number(((totalPart / totalElig) * 100).toFixed(1)) : null

    const programs = merged.map(r => {
      const elig = Number(r[eligKey] || 0)
      const part = Number(r[partKey] || 0)
      return {
        name: (r[nameKey] || r[typeKey] || "Program").toString(),
        type: (r[typeKey] || "").toString(),
        rate: elig ? Number(((part / elig) * 100).toFixed(1)) : 0,
        participants: part,
        eligible: elig,
      }
    })

    setMetrics(prev => ({
      ...prev,
      uwp: {
        value: rate,
        participants: totalPart,
        eligible: totalElig,
        programCount: merged.length,
        avgUsesPerEmployee: totalInst && totalElig ? Number((totalInst / totalElig).toFixed(2)) : null,
        programs,
        loaded: true,
      },
    }))
  }

  // ─── Clear helpers ────────────────────────────────────────────────────────
  const clearEwi = () => {
  localStorage.removeItem("ewiRawRows")   // ← ADD THIS
  setMetrics(prev => ({ ...prev, ewi: defaultState.ewi }))
  setActiveSeg("all")
}

  const clearUwp = () => {
    localStorage.removeItem("uwpRawRows")
    setMetrics(prev => ({ ...prev, uwp: defaultState.uwp }))
  }

  // ─── Segmentation ─────────────────────────────────────────────────────────
  const segKeys: SegKey[] = ["all", "function", "role level", "location", "tenure band"]

  const getSegmentedBreakdown = () => {
    if (activeSeg === "all" || !metrics.ewi.rows.length) return []
    const groups: Record<string, RowObject[]> = {}
    metrics.ewi.rows.forEach(r => {
      const key = (r[activeSeg] ?? "Unknown").toString().trim()
      if (!groups[key]) groups[key] = []
      groups[key].push(r)
    })
    return Object.entries(groups)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([label, rows]) => ({
        label,
        n: rows.length,
        suppressed: rows.length < 3,
        ...computeEwiScores(rows),
      }))
  }

  const anyLoaded = metrics.ewi.loaded || metrics.uwp.loaded

  const metricCards = [
    {
      key: "ewi", icon: "EWI",
      title: "Employee Wellbeing Index",
      subtitle: "Composite score from Q1–Q7 survey (5-point Likert)",
      value: metrics.ewi.value != null ? metrics.ewi.value.toFixed(2) : null,
      unit: metrics.ewi.value != null ? "/ 5" : "",
      accent: "#7C3AED",
      onFile: handleEwi, loaded: metrics.ewi.loaded,
      detail: "Avg of all 7 items",
    },
    {
      key: "uwp", icon: "WPU",
      title: "Wellbeing Program Utilization",
      subtitle: "Participation rate across approved wellbeing programs",
      value: metrics.uwp.value != null ? metrics.uwp.value : null,
      unit: metrics.uwp.value != null ? "%" : "",
      accent: "#059669",
      onFile: handleUwp, loaded: metrics.uwp.loaded,
      detail: "Participants ÷ Eligible",
    },
  ]

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>

      {/* Status pills */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 28 }}>
        {metricCards.map(m => (
          <div key={m.key} style={{
            fontSize: 11, fontWeight: 600, padding: "4px 12px", borderRadius: 20,
            background: m.loaded ? m.accent + "18" : "#f1f5f9",
            color: m.loaded ? m.accent : "#94a3b8",
            border: `1px solid ${m.loaded ? m.accent + "30" : "#e2e8f0"}`,
            display: "flex", alignItems: "center", gap: 5,
          }}>
            <span style={{ fontSize: 13 }}>{m.loaded ? "●" : "○"}</span> {m.title}
          </div>
        ))}
      </div>

      {/* Metric cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 20, marginBottom: 36 }}>
        {metricCards.map(({ key: _k, ...m }) => <MetricCard key={m.title} {...m} />)}
      </div>

      {/* Summary snapshot */}
      {anyLoaded && (
        <>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 14 }}>📊 Summary Snapshot</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

            {/* EWI Detail */}
            {metrics.ewi.loaded && (
  <div style={{
    background: "#fff",
    borderRadius: 14,
    boxShadow: "0 1px 3px rgba(0,0,0,.06), 0 4px 16px rgba(0,0,0,.06)",
    padding: "18px 22px",
    position: "relative"
  }}>
    <button onClick={clearEwi} style={{
      position: "absolute", top: 12, right: 12,
      background: "#ef4444", color: "#fff",
      border: "none", borderRadius: "50%",
      width: 18, height: 18, fontSize: 10, cursor: "pointer"
    }}>×</button>

    <div style={{
  fontSize: 11,
  fontWeight: 700,
  color: "#7C3AED",
  textTransform: "uppercase",
  letterSpacing: ".05em",
  marginBottom: 10
}}>
  Employee Wellbeing Index
</div>

<BenchmarkRow
  label="Overall Wellbeing Score"
  value={metrics.ewi.value ?? 0}
  target={5}
  accent="#7C3AED"
  unit=" / 5"
/>

{/* Clean breakdown */}
<div style={{
  display: "flex",
  justifyContent: "space-between",
  fontSize: 12,
  color: "#475569",
  marginTop: 8
}}>
  <span>Physical: {metrics.ewi.physical ?? "—"}</span>
  <span>Mental: {metrics.ewi.mental ?? "—"}</span>
  <span>Social: {metrics.ewi.social ?? "—"}</span>
</div>

<div style={{ fontSize: 11, color: "#94a3b8", marginTop: 8 }}>
  {metrics.ewi.responses} responses
</div>
  </div>
)}

            {/* UWP Detail */}
            {metrics.uwp.loaded && (
  <div style={{
    background: "#fff",
    borderRadius: 14,
    boxShadow: "0 1px 3px rgba(0,0,0,.06), 0 4px 16px rgba(0,0,0,.06)",
    padding: "18px 22px",
    position: "relative"
  }}>
    <button onClick={clearUwp} style={{
      position: "absolute", top: 12, right: 12,
      background: "#ef4444", color: "#fff",
      border: "none", borderRadius: "50%",
      width: 18, height: 18, fontSize: 10, cursor: "pointer"
    }}>×</button>

    <div style={{
      fontSize: 11, fontWeight: 700, color: "#059669",
      textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 10
    }}>
       Program Utilization
    </div>

    {/* Main KPI */}
    <BenchmarkRow
      label="Utilization Rate"
      value={metrics.uwp.value ?? 0}
      target={100}
      accent="#059669"
      unit="%"
    />

    {/* Context */}
    <div style={{
      display: "flex",
      justifyContent: "space-between",
      fontSize: 12,
      color: "#475569",
      marginTop: 8
    }}>
      <span>{metrics.uwp.participants} used</span>
      <span>{metrics.uwp.eligible} eligible</span>
    </div>

    <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 6 }}>
      {metrics.uwp.programCount} programs tracked
    </div>
  </div>

            )}

          </div>
        </>
      )}

    </div>
  )
}