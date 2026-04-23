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
        border: `1.5px dashed ${drag ? "#f59e0b" : loaded ? "#22c55e" : "#cbd5e1"}`,
        borderRadius: 10, padding: "12px 10px", cursor: "pointer",
        background: drag ? "#fffbeb" : loaded ? "#f0fdf4" : "#f8fafc",
        textAlign: "center", fontSize: 12,
        color: loaded ? "#16a34a" : "#94a3b8",
        transition: "all .2s", marginBottom: 16, userSelect: "none",
      }}
    >
      <input ref={ref} type="file" accept=".xlsx,.xls,.csv" hidden onChange={e => handle(e.target.files?.[0])} />
      {loaded ? <><span style={{ fontSize: 16 }}>✓</span> File loaded</> : <><span style={{ fontSize: 16 }}>↑</span><br />Drop or click to upload<br />.xlsx / .xls / .csv</>}
    </div>
  )
}

function MetricCard({ icon, title, subtitle, value, unit, accent, onFile, loaded, detail }: MetricCardProps) {
  return (
    <div
      style={{ background: "#fff", borderRadius: 16, boxShadow: "0 1px 3px rgba(0,0,0,.06), 0 4px 16px rgba(0,0,0,.06)", overflow: "hidden", display: "flex", flexDirection: "column", transition: "box-shadow .2s, transform .2s" }}
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
        <div style={{ background: `linear-gradient(135deg, ${accent}10, ${accent}05)`, border: "1px solid " + accent + "22", borderRadius: 12, padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
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

function BenchmarkRow({ label, value, target, accent, unit = "%" }: { label: string; value: number; target: number; accent: string; unit?: string }) {
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

// ─── LIKERT helpers ───────────────────────────────────────
const LIKERT: Record<string, number> = { "strongly agree": 5, "agree": 4, "neutral": 3, "disagree": 2, "strongly disagree": 1 }
const toLikert = (v: string | number | undefined): number | null => {
  if (typeof v === "number") return v
  return LIKERT[(v as string || "").trim().toLowerCase()] ?? null
}

export default function PerfDashboard() {
  const [uploadOrder, setUploadOrder] = useState<string[]>([])

  const [perfMetrics, setPerfMetrics] = useState(() => {
    try {
      const s = localStorage.getItem("perfMetricsData")
      return s ? JSON.parse(s) : {
        mei:  { value: null, responses: 0, favorability: null, loaded: false },
        epii: { value: null, reviewed: 0, improved: 0, loaded: false },
      }
    } catch {
      return {
        mei:  { value: null, responses: 0, favorability: null, loaded: false },
        epii: { value: null, reviewed: 0, improved: 0, loaded: false },
      }
    }
  })

  useEffect(() => { localStorage.setItem("perfMetricsData", JSON.stringify(perfMetrics)) }, [perfMetrics])

  // ─── MEI Handler ─────────────────────────────────────────
  // Columns: survey date, function, role level, location, manager tenure,
  //          q1 clarity, q2 support, q3 fairness, q4 feedback,
  //          q5 psychological safety, q6 inclusion, q7 improvement comment
  const handleMei = async (file: File) => {
    const rows = await parseSheet(file)
    if (!rows.length) { alert("File is empty."); return }

    const keys = Object.keys(rows[0])
    const qKeys = ["q1 clarity", "q2 support", "q3 fairness", "q4 feedback", "q5 psychological safety", "q6 inclusion"]
    const resolvedQKeys = qKeys.map(q => keys.find(k => k.startsWith(q.substring(0, 6))) ?? q)

    // Merge with existing
    const existing: RowObject[] = JSON.parse(localStorage.getItem("meiRawRows") || "[]")
    const makeKey = (r: RowObject) => `${r["survey date"] ?? ""}|${r["function"] ?? ""}|${r["role level"] ?? ""}|${r["location"] ?? ""}`
    const existingKeys = new Set(existing.map(makeKey))
    const merged = [...existing, ...rows.filter(r => !existingKeys.has(makeKey(r)))]
    localStorage.setItem("meiRawRows", JSON.stringify(merged))

    // Calculate MEI: avg of all Likert responses, converted to 0-100 favorability
    let totalScore = 0; let totalItems = 0
    merged.forEach(r => {
      resolvedQKeys.forEach(k => {
        const score = toLikert(r[k])
        if (score !== null) { totalScore += score; totalItems++ }
      })
    })
    const avgLikert   = totalItems ? totalScore / totalItems : 0          // 1–5
    const favorability = totalItems ? Number(((avgLikert - 1) / 4 * 100).toFixed(1)) : null // map 1-5 → 0-100%

    setPerfMetrics((prev: typeof perfMetrics) => ({
      ...prev,
      mei: { value: favorability, responses: merged.length, favorability, loaded: true }
    }))
    setUploadOrder(prev => [...prev.filter(k => k !== "mei"), "mei"])
  }

  // ─── EPII Handler ─────────────────────────────────────────
  // Columns: review cycle, delivery unit, job family,
  //          total number of employees reviewed,
  //          number of employees showing performance improvement,
  //          performance improvement rate (%), linked training intervention
  const handleEpii = async (file: File) => {
    const rows = await parseSheet(file)
    if (!rows.length) { alert("File is empty."); return }

    const keys = Object.keys(rows[0])
    const reviewedKey  = keys.find(k => k.includes("total number of employees reviewed"))    ?? ""
    const improvedKey  = keys.find(k => k.includes("number of employees showing performance")) ?? ""

    if (!reviewedKey || !improvedKey) {
      alert("Missing columns: Total Number of Employees Reviewed / Number of Employees Showing Performance Improvement")
      return
    }

    const existing: RowObject[] = JSON.parse(localStorage.getItem("epiiRawRows") || "[]")
    const makeKey = (r: RowObject) => `${r["review cycle"] ?? ""}|${(r["delivery unit"] ?? "").toString().trim()}|${(r["job family"] ?? "").toString().trim()}`
    const existingKeys = new Set(existing.map(makeKey))
    const merged = [...existing, ...rows.filter(r => !existingKeys.has(makeKey(r)))]
    localStorage.setItem("epiiRawRows", JSON.stringify(merged))

    const totalReviewed = merged.reduce((s, r) => s + Number(r[reviewedKey] || 0), 0)
    const totalImproved = merged.reduce((s, r) => s + Number(r[improvedKey] || 0), 0)
    const rate = totalReviewed ? Number(((totalImproved / totalReviewed) * 100).toFixed(1)) : null

    setPerfMetrics((prev: typeof perfMetrics) => ({
      ...prev,
      epii: { value: rate, reviewed: totalReviewed, improved: totalImproved, loaded: true }
    }))
    setUploadOrder(prev => [...prev.filter(k => k !== "epii"), "epii"])
  }

  // ─── Clear metric ─────────────────────────────────────────
  const clearMetric = (key: string) => {
    const defaults: Record<string, object> = {
      mei:  { value: null, responses: 0, favorability: null, loaded: false },
      epii: { value: null, reviewed: 0, improved: 0, loaded: false },
    }
    setPerfMetrics((prev: typeof perfMetrics) => {
      const updated = { ...prev, [key]: defaults[key] }
      localStorage.setItem("perfMetricsData", JSON.stringify(updated))
      return updated
    })
    const lsKeys: Record<string, string[]> = {
      mei:  ["meiRawRows"],
      epii: ["epiiRawRows"],
    }
    lsKeys[key]?.forEach(k => localStorage.removeItem(k))
    setUploadOrder(prev => prev.filter(k => k !== key))
  }

  const anyLoaded = perfMetrics.mei.loaded || perfMetrics.epii.loaded

  const perfMetricCards = [
    {
      key: "mei", icon: "MEI",
      title: "Manager Effectiveness Index",
      subtitle: "Aggregate favorability across 6 effectiveness dimensions",
      value: perfMetrics.mei.value,
      unit: perfMetrics.mei.value != null ? "%" : "",
      accent: "#f59e0b",
      onFile: handleMei, loaded: perfMetrics.mei.loaded,
      detail: "Survey-based favorability",
    },
    {
      key: "epii", icon: "PIR",
      title: "Performance Improvement Rate",
      subtitle: "Employees showing improvement across review cycles",
      value: perfMetrics.epii.value,
      unit: perfMetrics.epii.value != null ? "%" : "",
      accent: "#10b981",
      onFile: handleEpii, loaded: perfMetrics.epii.loaded,
      detail: "Improved ÷ Reviewed",
    },
  ]

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>

      {/* Status pills */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 28 }}>
        {perfMetricCards.map(m => (
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
        {perfMetricCards.map(({ key: _k, ...m }) => <MetricCard key={m.title} {...m} />)}
      </div>

      {/* Summary snapshot */}
      {anyLoaded && (
        <>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 14 }}>📊 Summary Snapshot</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

            {perfMetrics.mei.loaded && (
              <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 1px 3px rgba(0,0,0,.06), 0 4px 16px rgba(0,0,0,.06)", padding: "18px 22px", position: "relative" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#f59e0b", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 10 }}> Manager Effectiveness Index</div>
                <BenchmarkRow label="Overall Favorability (MEI)" value={perfMetrics.mei.value ?? 0} target={100} accent="#f59e0b" unit="%" />
                <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>{perfMetrics.mei.responses} survey responses</div>
                <button onClick={() => clearMetric("mei")} style={{ position: "absolute", top: 12, right: 12, background: "#ef4444", color: "#fff", border: "none", borderRadius: "50%", width: 18, height: 18, fontSize: 10, cursor: "pointer" }} title="Clear">×</button>
              </div>
            )}

            {perfMetrics.epii.loaded && (
              <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 1px 3px rgba(0,0,0,.06), 0 4px 16px rgba(0,0,0,.06)", padding: "18px 22px", position: "relative" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#10b981", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 10 }}> Performance Improvement Rate</div>
                <BenchmarkRow label="Performance Improvement Rate" value={perfMetrics.epii.value ?? 0} target={100} accent="#10b981" unit="%" />
                <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
                  {perfMetrics.epii.improved} of {perfMetrics.epii.reviewed} employees showed improvement
                </div>
                <button onClick={() => clearMetric("epii")} style={{ position: "absolute", top: 12, right: 12, background: "#ef4444", color: "#fff", border: "none", borderRadius: "50%", width: 18, height: 18, fontSize: 10, cursor: "pointer" }} title="Clear">×</button>
              </div>
            )}

          </div>
        </>
      )}
    </div>
  )
}