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
        border: `1.5px dashed ${drag ? "#6366f1" : loaded ? "#22c55e" : "#cbd5e1"}`,
        borderRadius: 10, padding: "12px 10px", cursor: "pointer",
        background: drag ? "#eef2ff" : loaded ? "#f0fdf4" : "#f8fafc",
        textAlign: "center", fontSize: 12,
        color: loaded ? "#16a34a" : "#94a3b8",
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

// ─── LIKERT helpers ─────────────────────────────────────────────────────────
const LIKERT: Record<string, number> = {
  "strongly agree": 5, "agree": 4, "neutral": 3, "disagree": 2, "strongly disagree": 1,
}
const toLikert = (v: string | number | undefined): number | null => {
  if (typeof v === "number") return v
  return LIKERT[(v as string || "").trim().toLowerCase()] ?? null
}

// ─── State shape ─────────────────────────────────────────────────────────────
interface OffboardingMetrics {
  eicr: { value: number | null; exits: number; completed: number; waived: number; loaded: boolean }
  oes:  { value: number | null; responses: number; itemScores: Record<string, number>; loaded: boolean }
}

const defaultState: OffboardingMetrics = {
  eicr: { value: null, exits: 0, completed: 0, waived: 0, loaded: false },
  oes:  { value: null, responses: 0, itemScores: {}, loaded: false },
}

export default function OffboardingDashboard() {
  const [uploadOrder, setUploadOrder] = useState<string[]>([])

  const [metrics, setMetrics] = useState<OffboardingMetrics>(() => {
    try {
      const s = localStorage.getItem("offboardingMetricsData")
      return s ? JSON.parse(s) : defaultState
    } catch { return defaultState }
  })

  useEffect(() => {
    localStorage.setItem("offboardingMetricsData", JSON.stringify(metrics))
  }, [metrics])

  // ─── EICR Handler ─────────────────────────────────────────────────────────
  // Required columns:
  //   Reporting Period | Exit Type | Delivery Unit |
  //   Total Number of Employee Exits |
  //   Number of Completed Exit Interviews |
  //   Exit Interview Completion Rate (%) | Waived / Unreachable Cases
  const handleEicr = async (file: File) => {
    const rows = await parseSheet(file)
    if (!rows.length) { alert("File is empty."); return }

    const keys = Object.keys(rows[0])
    const exitsKey     = keys.find(k => k.includes("total number of employee exits")) ?? ""
    const completedKey = keys.find(k => k.includes("number of completed exit interviews")) ?? ""
    const waivedKey    = keys.find(k => k.includes("waived")) ?? ""

    if (!exitsKey || !completedKey) {
      alert("Missing columns: 'Total Number of Employee Exits' and/or 'Number of Completed Exit Interviews'")
      return
    }

    const existing: RowObject[] = JSON.parse(localStorage.getItem("eicrRawRows") || "[]")
    const makeKey = (r: RowObject) =>
      `${r["reporting period"] ?? ""}|${(r["exit type"] ?? "").toString().trim()}|${(r["delivery unit"] ?? "").toString().trim()}`
    const existingKeys = new Set(existing.map(makeKey))
    const merged = [...existing, ...rows.filter(r => !existingKeys.has(makeKey(r)))]
    localStorage.setItem("eicrRawRows", JSON.stringify(merged))

    const totalExits     = merged.reduce((s, r) => s + Number(r[exitsKey]     || 0), 0)
    const totalCompleted = merged.reduce((s, r) => s + Number(r[completedKey] || 0), 0)
    const totalWaived    = waivedKey ? merged.reduce((s, r) => s + Number(r[waivedKey] || 0), 0) : 0
    const rate = totalExits ? Number(((totalCompleted / totalExits) * 100).toFixed(1)) : null

    setMetrics(prev => ({
      ...prev,
      eicr: { value: rate, exits: totalExits, completed: totalCompleted, waived: totalWaived, loaded: true }
    }))
    setUploadOrder(prev => [...prev.filter(k => k !== "eicr"), "eicr"])
  }

  // ─── OES Handler ──────────────────────────────────────────────────────────
  // Required columns:
  //   Exit Date | Exit Type | Delivery Unit | Tenure Band |
  //   Q1 Respect | Q2 Clarity | Q3 Fairness | Q4 Overall Experience |
  //   Open Comment
  const OES_Q_KEYS = [
    { key: "q1 respect",           label: "Respect" },
    { key: "q2 clarity",           label: "Clarity" },
    { key: "q3 fairness",          label: "Fairness" },
    { key: "q4 overall experience", label: "Overall Experience" },
  ]

  const handleOes = async (file: File) => {
    const rows = await parseSheet(file)
    if (!rows.length) { alert("File is empty."); return }

    const keys = Object.keys(rows[0])
    const resolvedQKeys = OES_Q_KEYS.map(q => ({
      label: q.label,
      resolved: keys.find(k => k.startsWith(q.key.substring(0, 6))) ?? q.key,
    }))

    const existing: RowObject[] = JSON.parse(localStorage.getItem("oesRawRows") || "[]")
    const makeKey = (r: RowObject) =>
      `${r["exit date"] ?? ""}|${(r["exit type"] ?? "").toString().trim()}|${(r["delivery unit"] ?? "").toString().trim()}`
    const existingKeys = new Set(existing.map(makeKey))
    const merged = [...existing, ...rows.filter(r => !existingKeys.has(makeKey(r)))]
    localStorage.setItem("oesRawRows", JSON.stringify(merged))

    // OES = % of responses that are Agree or Strongly Agree across all items (excl. Q4)
    // Also compute per-item favorability for the detail view
    const coreKeys = resolvedQKeys.filter(q => !q.label.includes("Overall"))
    let totalFav = 0; let totalItems = 0
    const itemFav: Record<string, number> = {}

    resolvedQKeys.forEach(q => {
      let fav = 0; let n = 0
      merged.forEach(r => {
        const score = toLikert(r[q.resolved] as string | number | undefined)
        if (score !== null) { n++; if (score >= 4) fav++ }
      })
      itemFav[q.label] = n ? Number(((fav / n) * 100).toFixed(1)) : 0
      if (!q.label.includes("Overall")) { totalFav += fav; totalItems += n }
    })
    void coreKeys // suppress unused lint

    const oes = totalItems ? Number(((totalFav / totalItems) * 100).toFixed(1)) : null

    setMetrics(prev => ({
      ...prev,
      oes: { value: oes, responses: merged.length, itemScores: itemFav, loaded: true }
    }))
    setUploadOrder(prev => [...prev.filter(k => k !== "oes"), "oes"])
  }

  // ─── Clear metric ─────────────────────────────────────────────────────────
  const clearMetric = (key: string) => {
    const defaults: Record<string, object> = {
      eicr: { value: null, exits: 0, completed: 0, waived: 0, loaded: false },
      oes:  { value: null, responses: 0, itemScores: {}, loaded: false },
    }
    setMetrics(prev => {
      const updated = { ...prev, [key]: defaults[key] } as OffboardingMetrics
      localStorage.setItem("offboardingMetricsData", JSON.stringify(updated))
      return updated
    })
    const lsKeys: Record<string, string[]> = {
      eicr: ["eicrRawRows"],
      oes:  ["oesRawRows"],
    }
    lsKeys[key]?.forEach(k => localStorage.removeItem(k))
    setUploadOrder(prev => prev.filter(k => k !== key))
  }

  const anyLoaded = metrics.eicr.loaded || metrics.oes.loaded

  const metricCards = [
    {
      key: "eicr", icon: "ECR",
      title: "Exit Interview Completion Rate",
      subtitle: "Eligible exits that completed an exit interview or survey",
      value: metrics.eicr.value,
      unit: metrics.eicr.value != null ? "%" : "",
      accent: "#6366f1",
      onFile: handleEicr, loaded: metrics.eicr.loaded,
      detail: "Completed ÷ Total Exits",
    },
    {
      key: "oes", icon: "OES",
      title: "Offboarding Experience Score",
      subtitle: "Favorable ratings on respect, clarity, and fairness",
      value: metrics.oes.value,
      unit: metrics.oes.value != null ? "%" : "",
      accent: "#0ea5e9",
      onFile: handleOes, loaded: metrics.oes.loaded,
      detail: "Agree / Strongly Agree rate",
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

            {metrics.eicr.loaded && (
              <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 1px 3px rgba(0,0,0,.06), 0 4px 16px rgba(0,0,0,.06)", padding: "18px 22px", position: "relative" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#6366f1", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 10 }}>🚪 Exit Interview Completion Rate</div>
                <BenchmarkRow label="Completion Rate (EICR)" value={metrics.eicr.value ?? 0} target={100} accent="#6366f1" unit="%" />
                <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4, display: "flex", gap: 16 }}>
                  <span>{metrics.eicr.completed} of {metrics.eicr.exits} exits completed</span>
                  {metrics.eicr.waived > 0 && <span>{metrics.eicr.waived} waived / unreachable</span>}
                </div>
                <button onClick={() => clearMetric("eicr")} style={{ position: "absolute", top: 12, right: 12, background: "#ef4444", color: "#fff", border: "none", borderRadius: "50%", width: 18, height: 18, fontSize: 10, cursor: "pointer" }} title="Clear">×</button>
              </div>
            )}

            {metrics.oes.loaded && (
              <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 1px 3px rgba(0,0,0,.06), 0 4px 16px rgba(0,0,0,.06)", padding: "18px 22px", position: "relative" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#0ea5e9", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 10 }}>⭐ Offboarding Experience Score</div>
                <BenchmarkRow label="Overall OES" value={metrics.oes.value ?? 0} target={100} accent="#0ea5e9" unit="%" />

                {/* Per-dimension breakdown */}
                {Object.entries(metrics.oes.itemScores).length > 0 && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #f1f5f9" }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", marginBottom: 8, textTransform: "uppercase", letterSpacing: ".04em" }}>Favorability by Dimension</div>
                    {Object.entries(metrics.oes.itemScores).map(([label, score]) => (
                      <BenchmarkRow key={label} label={label} value={score} target={100} accent="#0ea5e9" unit="%" />
                    ))}
                  </div>
                )}

                <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
                  {metrics.oes.responses} survey responses
                </div>
                <button onClick={() => clearMetric("oes")} style={{ position: "absolute", top: 12, right: 12, background: "#ef4444", color: "#fff", border: "none", borderRadius: "50%", width: 18, height: 18, fontSize: 10, cursor: "pointer" }} title="Clear">×</button>
              </div>
            )}

          </div>
        </>
      )}

     

    </div>
  )
}