"use client"

import { useState, useRef, useEffect } from "react"
import * as XLSX from "xlsx"

// ─── Types ───────────────────────────────────────────────
interface RowObject {
  [key: string]: string | number
}
interface UploadZoneProps {
  onFile: (file: File) => void
  loaded: boolean
}
interface MetricCardProps {
  icon: string
  title: string
  subtitle: string
  value: string | number | null
  unit?: string
  accent: string
  onFile: (file: File) => void
  loaded: boolean
  detail?: string
}

// ─── Helpers ─────────────────────────────────────────────
const normalizeKey = (k: string) => k.trim().toLowerCase()

const parseSheet = (file: File): Promise<RowObject[]> =>
  new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (evt) => {
      const arrayBuffer = evt.target?.result
      if (!arrayBuffer) return resolve([])
      const wb = XLSX.read(arrayBuffer, { type: "array", cellDates: true, dateNF: "yyyy-mm-dd" })
      const rows = XLSX.utils.sheet_to_json<RowObject>(wb.Sheets[wb.SheetNames[0]])
      const norm = rows.map((row) => {
  const obj: RowObject = {}
  Object.keys(row).forEach((k) => {
    const v = row[k] as string | number | Date
obj[normalizeKey(k)] = v instanceof Date
  ? v.toISOString().slice(0, 10)
  : v as string | number
  })
  return obj
})
      resolve(norm)
    }
    reader.readAsArrayBuffer(file)
  })

// ─── UploadZone ───────────────────────────────────────────
function UploadZone({ onFile, loaded }: UploadZoneProps) {
  const ref = useRef<HTMLInputElement>(null)
  const [drag, setDrag] = useState(false)
  const handle = (file?: File) => { if (file) onFile(file) }
  return (
    <div
      onClick={() => ref.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); handle(e.dataTransfer.files[0]) }}
      style={{
        border: `1.5px dashed ${drag ? "#8b5cf6" : loaded ? "#22c55e" : "#cbd5e1"}`,
        borderRadius: 10, padding: "12px 10px", cursor: "pointer",
        background: drag ? "#f5f3ff" : loaded ? "#f0fdf4" : "#f8fafc",
        textAlign: "center", fontSize: 12,
        color: loaded ? "#16a34a" : "#94a3b8",
        transition: "all .2s", marginBottom: 16, userSelect: "none",
      }}
    >
      <input ref={ref} type="file" accept=".xlsx,.xls,.csv" hidden onChange={(e) => handle(e.target.files?.[0])} />
      {loaded
        ? <><span style={{ fontSize: 16 }}>✓</span> File loaded</>
        : <><span style={{ fontSize: 16 }}>↑</span><br />Drop or click to upload<br />.xlsx / .xls / .csv</>
      }
    </div>
  )
}

// ─── MetricCard ───────────────────────────────────────────
function MetricCard({ icon, title, subtitle, value, unit, accent, onFile, loaded, detail }: MetricCardProps) {
  return (
    <div
      style={{
        background: "#ffffff", borderRadius: 16,
        boxShadow: "0 1px 3px rgba(0,0,0,.06), 0 4px 16px rgba(0,0,0,.06)",
        overflow: "hidden", display: "flex", flexDirection: "column",
        transition: "box-shadow .2s, transform .2s",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 8px 32px rgba(0,0,0,.12)"; e.currentTarget.style.transform = "translateY(-2px)" }}
      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,.06), 0 4px 16px rgba(0,0,0,.06)"; e.currentTarget.style.transform = "translateY(0)" }}
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
          border: "1px solid " + accent + "22", borderRadius: 12, padding: "14px 16px",
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

// ─── BenchmarkRow ─────────────────────────────────────────
function BenchmarkRow({ label, value, target, accent, unit = "%" }: {
  label: string; value: number; target: number; accent: string; unit?: string
}) {
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

// ─── LL30 Category config ─────────────────────────────────
const LL30_CAT_CONFIGS = [
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

function calcLL30Stats(rows: RowObject[]) {
  const categoryStats: Record<string, { label: string; avgPct: number; promoterPct: number; count: number }> = {}
  let cumulativeFav = 0; let validCatCount = 0

  LL30_CAT_CONFIGS.forEach(config => {
    const avgKey = `ave_${config.id}`
    let totalPct = 0; let count = 0; let promoters = 0
    rows.forEach(r => {
      const score = Number(r[avgKey])
      if (isNaN(score) || score < 1) return
      count++
      if (config.isOOE) {
        if (score >= 5) promoters++
        totalPct += ((score - 1) / 4) * 100
      } else {
        if (score >= 4) promoters++
        totalPct += ((score - 1) / 3) * 100
      }
    })
    if (count > 0) {
      const avgPct = Number((totalPct / count).toFixed(1))
      categoryStats[config.id] = {
        label: config.label,
        avgPct,
        promoterPct: Math.round((promoters / count) * 100),
        count,
      }
      cumulativeFav += avgPct
      validCatCount++
    }
  })

  return {
    categoryStats,
    overallFavorability: validCatCount ? Number((cumulativeFav / validCatCount).toFixed(1)) : null,
  }
}

// ─── LL60 Dimension config ────────────────────────────────
// Maps the six retention driver signal columns to display labels.
// Signal values in the sheet are expected to be one of:
//   "Positive Signal" | "Neutral / Not Observed" | "Negative Signal" / "Risk Signal"
const LL60_DIMENSIONS = [
  { key: "motivation & engagement",  label: "Motivation & Engagement" },
  { key: "manager relationship",     label: "Manager Relationship" },
  { key: "team belonging",           label: "Team Belonging" },
  { key: "workload & stress",        label: "Workload & Stress" },
  { key: "growth & future outlook",  label: "Growth & Future Outlook" },
  { key: "recognition & value",      label: "Recognition & Value" },
]

type LL60Signal = "positive" | "neutral" | "negative"

interface LL60DimensionStat {
  label: string
  positive: number
  neutral: number
  negative: number
  total: number
}

// Finds a row value by trying exact key, en-dash↔hyphen swap, then partial word match.
function findVal(r: RowObject, ...candidates: string[]): string {
  for (const c of candidates) {
    const norm = c.trim().toLowerCase()
    if (r[norm] !== undefined) return r[norm].toString()
    const swapped = norm.includes('–') ? norm.replace(/–/g, '-') : norm.replace(/-/g, '–')
    if (r[swapped] !== undefined) return r[swapped].toString()
    const words = norm.split(/\s+/).filter(w => w.length > 2)
    const hit = Object.entries(r).find(([k]) => words.every(w => k.includes(w)))
    if (hit) return hit[1].toString()
  }
  return ''
}

function calcLL60Stats(rows: RowObject[]) {
  const dimStats: Record<string, LL60DimensionStat> = {}
  LL60_DIMENSIONS.forEach(d => {
    dimStats[d.key] = { label: d.label, positive: 0, neutral: 0, negative: 0, total: 0 }
  })

  let totalRating = 0; let ratingCount = 0
  let totalRecommend = 0; let recommendCount = 0
  const riskCounts: Record<string, number> = { low: 0, medium: 0, high: 0 }
  let sessionCount = 0; let participantCount = 0

  rows.forEach(r => {
    sessionCount++

    // 'Participant Count'
    const pc = Number(findVal(r, 'participant count') || 0)
    if (!isNaN(pc)) participantCount += pc

    // 'Avg Journey Rating (1–5)' -- en-dash in actual header
    const ratingRaw = findVal(r, 'avg journey rating (1–5)', 'avg journey rating (1-5)', 'avg journey rating')
    const rating = Number(ratingRaw)
    if (!isNaN(rating) && rating >= 1) { totalRating += rating; ratingCount++ }

    // 'Recommend % (Yes)'
    const recRaw = findVal(r, 'recommend % (yes)', 'recommend % yes', 'recommend %')
    const rec = Number(recRaw)
    if (!isNaN(rec)) { totalRecommend += rec; recommendCount++ }

    // 'Overall Retention Risk'
    const risk = findVal(r, 'overall retention risk').trim().toLowerCase()
    if (risk === 'low') riskCounts.low++
    else if (risk === 'medium') riskCounts.medium++
    else if (risk === 'high') riskCounts.high++

    // Dimension signal columns -- headers match LL60_DIMENSIONS keys exactly after normalizeKey
    LL60_DIMENSIONS.forEach(d => {
      const raw = findVal(r, d.key, d.key.replace(/ & /g, ' and ')).trim().toLowerCase()
      const stat = dimStats[d.key]
      stat.total++
      if (raw.includes('positive')) stat.positive++
      else if (raw.includes('negative') || raw.includes('risk signal')) stat.negative++
      else stat.neutral++
    })
  })

  const avgRating = ratingCount ? Number((totalRating / ratingCount).toFixed(1)) : null
  const avgRecommend = recommendCount ? Number((totalRecommend / recommendCount).toFixed(1)) : null

  let totalSigPositive = 0; let totalSig = 0
  Object.values(dimStats).forEach(d => {
    totalSigPositive += d.positive
    totalSig += d.total
  })
  const overallPositivity = totalSig ? Number(((totalSigPositive / totalSig) * 100).toFixed(1)) : null

  return { dimStats, avgRating, avgRecommend, riskCounts, sessionCount, participantCount, overallPositivity }
}

// ─── OBDashboard ─────────────────────────────────────────
export default function OBDashboard() {
  const [uploadOrder, setUploadOrder] = useState<string[]>([])

  const DEFAULT_METRICS = {
    ttp:  { avgDays: null, confirmRate: null, confirmed: 0, total: 0, loaded: false },
    nhe:  { favorability: null, categories: {}, responses: 0, loaded: false },
    ll60: {
      overallPositivity: null, avgRating: null, avgRecommend: null,
      riskCounts: { low: 0, medium: 0, high: 0 },
      dimStats: {}, sessionCount: 0, participantCount: 0, loaded: false,
    },
    tcr:  { rate: null, enrolled: 0, completed: 0, loaded: false },
  }

  const [obMetrics, setObMetrics] = useState(() => {
    try {
      const s = localStorage.getItem("obMetricsData")
      // Spread defaults first so any newly added keys (e.g. ll60) are always present
      // even when older stored data pre-dates this field.
      return s ? { ...DEFAULT_METRICS, ...JSON.parse(s) } : DEFAULT_METRICS
    } catch {
      return DEFAULT_METRICS
    }
  })

  useEffect(() => {
    localStorage.setItem("obMetricsData", JSON.stringify(obMetrics))
  }, [obMetrics])

  // ─── TTP Handler ─────────────────────────────────────────
  const handleTtp = async (file: File) => {
    const rows = await parseSheet(file)
    if (!rows.length) { alert("File is empty."); return }

    const keys = Object.keys(rows[0])
    const ttpKey = keys.find(k => k.includes("time to productivity") && k.includes("days")) ?? ""
    const confirmedKey = keys.find(k => k.startsWith("productivity confirmed")) ?? "productivity confirmed"

    if (!ttpKey) { alert("Missing column: Time to Productivity (TTP) (Days)"); return }

    let totalDays = 0; let confirmed = 0; const validRows: RowObject[] = []
    rows.forEach(r => {
      const conf = (r[confirmedKey] as string || "").trim().toLowerCase()
      const days = Number(r[ttpKey])
      if (conf === "yes" && !isNaN(days) && days >= 0) { totalDays += days; confirmed++ }
      validRows.push(r)
    })

    const existing: RowObject[] = JSON.parse(localStorage.getItem("ttpRawRows") || "[]")
    const makeKey = (r: RowObject) => `${r["employee id"] ?? r["employee_id"] ?? ""}|${r["start date"] ?? r["start_date"] ?? ""}`
    const existingKeys = new Set(existing.map(makeKey))
    const merged = [...existing, ...validRows.filter(r => !existingKeys.has(makeKey(r)))]
    localStorage.setItem("ttpRawRows", JSON.stringify(merged))

    let allDays = 0; let allConf = 0
    merged.forEach(r => {
      const conf = (r[confirmedKey] as string || "").trim().toLowerCase()
      const days = Number(r[ttpKey])
      if (conf === "yes" && !isNaN(days) && days >= 0) { allDays += days; allConf++ }
    })

    setObMetrics((prev: any) => ({
      ...prev,
      ttp: {
        avgDays: allConf ? Number((allDays / allConf).toFixed(1)) : null,
        confirmRate: merged.length ? Number(((allConf / merged.length) * 100).toFixed(1)) : null,
        confirmed: allConf,
        total: merged.length,
        loaded: true,
      }
    }))
    setUploadOrder(prev => [...prev.filter(k => k !== "ttp"), "ttp"])
  }

  // ─── NHE Handler (LaunchLens30) ──────────────────────────
  const handleNhe = async (file: File) => {
    const rows = await parseSheet(file)
    if (!rows.length) { alert("File is empty."); return }

    const keys = Object.keys(rows[0])
    if (!keys.some(k => k === "ave_fde" || k === "ave_rc" || k.includes("ave_"))) {
      alert("This does not appear to be a LaunchLens 30 merged file. Expected columns like AVE_FDE, AVE_RC, etc.")
      return
    }

    const existing: RowObject[] = JSON.parse(localStorage.getItem("nheRawRows") || "[]")
    const fp = (r: RowObject) => `${r["email"] ?? ""}|${r["date"] ?? ""}|${r["first name"] ?? ""}|${r["last name"] ?? ""}`
    const existingPrints = new Set(existing.map(fp))
    const merged = [...existing, ...rows.filter(r => !existingPrints.has(fp(r)))]
    localStorage.setItem("nheRawRows", JSON.stringify(merged))

    const { categoryStats, overallFavorability } = calcLL30Stats(merged)

    setObMetrics((prev: any) => ({
      ...prev,
      nhe: {
        favorability: overallFavorability,
        categories: categoryStats,
        responses: merged.length,
        loaded: true,
      }
    }))
    setUploadOrder(prev => [...prev.filter(k => k !== "nhe"), "nhe"])
  }

  // ─── LL60 Handler (LaunchLens60) ─────────────────────────
  const handleLL60 = async (file: File) => {
    const rows = await parseSheet(file)
    if (!rows.length) { alert("File is empty."); return }

    const keys = Object.keys(rows[0])

    // Validate: must have at least one known LL60 column
    const hasExpectedCols = keys.some(k =>
      k.includes("session") ||
      k.includes("retention risk") ||
      k.includes("motivation") ||
      k.includes("journey rating") ||
      k.includes("recommend") ||
      k.includes("team belonging") ||
      k.includes("manager relationship")
    )
    if (!hasExpectedCols) {
      alert("This does not appear to be a LaunchLens 60 survey export. Expected columns like Session ID, Overall Retention Risk, Motivation & Engagement, etc.")
      return
    }

    // Deduplicate by Session ID
    const existing: RowObject[] = JSON.parse(localStorage.getItem("ll60RawRows") || "[]")
    const fp = (r: RowObject) =>
      (r["session id"] ?? r["session_id"] ?? r["id"] ?? "").toString().trim() ||
      `${r["session date"] ?? ""}|${r["delivery unit"] ?? ""}|${r["participant count"] ?? ""}`
    const existingPrints = new Set(existing.map(fp))
    const merged = [...existing, ...rows.filter(r => !existingPrints.has(fp(r)))]
    localStorage.setItem("ll60RawRows", JSON.stringify(merged))

    const stats = calcLL60Stats(merged)

    setObMetrics((prev: any) => ({
      ...prev,
      ll60: {
        overallPositivity: stats.overallPositivity,
        avgRating: stats.avgRating,
        avgRecommend: stats.avgRecommend,
        riskCounts: stats.riskCounts,
        dimStats: stats.dimStats,
        sessionCount: stats.sessionCount,
        participantCount: stats.participantCount,
        loaded: true,
      }
    }))
    setUploadOrder(prev => [...prev.filter(k => k !== "ll60"), "ll60"])
  }

  // ─── TCR Handler ─────────────────────────────────────────
  const handleTcr = async (file: File) => {
    const rows = await parseSheet(file)
    if (!rows.length) { alert("File is empty."); return }
    const keys = Object.keys(rows[0])
    const enrollKey = keys.find(k => k.includes("enrolled in required training")) ?? ""
    const completedKey = keys.find(k => k.includes("completed all required training")) ?? ""

    if (!enrollKey || !completedKey) {
      alert("Missing columns: Total Number of New Hires Enrolled / Number of New Hires Who Completed All Required Training"); return
    }

    const existing: RowObject[] = JSON.parse(localStorage.getItem("tcrRawRows") || "[]")
    const makeKey = (r: RowObject) => `${r["cohort"] ?? ""}|${(r["role / job family"] ?? "").toString().trim()}|${r["training modality"] ?? ""}`
    const existingKeys = new Set(existing.map(makeKey))
    const merged = [...existing, ...rows.filter(r => !existingKeys.has(makeKey(r)))]
    localStorage.setItem("tcrRawRows", JSON.stringify(merged))

    const totalEnrolled  = merged.reduce((s, r) => s + Number(r[enrollKey]    || 0), 0)
    const totalCompleted = merged.reduce((s, r) => s + Number(r[completedKey] || 0), 0)
    const rate = totalEnrolled ? Number(((totalCompleted / totalEnrolled) * 100).toFixed(1)) : null

    setObMetrics((prev: any) => ({
      ...prev,
      tcr: { rate, enrolled: totalEnrolled, completed: totalCompleted, loaded: true }
    }))
    setUploadOrder(prev => [...prev.filter(k => k !== "tcr"), "tcr"])
  }

  // ─── Clear ────────────────────────────────────────────────
  const clearMetric = (key: string) => {
    const defaults: Record<string, object> = {
      ttp: { avgDays: null, confirmRate: null, confirmed: 0, total: 0, loaded: false },
      nhe: { favorability: null, categories: {}, responses: 0, loaded: false },
      ll60: {
        overallPositivity: null, avgRating: null, avgRecommend: null,
        riskCounts: { low: 0, medium: 0, high: 0 },
        dimStats: {}, sessionCount: 0, participantCount: 0, loaded: false,
      },
      tcr: { rate: null, enrolled: 0, completed: 0, loaded: false },
    }
    setObMetrics((prev: any) => {
      const updated = { ...prev, [key]: defaults[key] }
      localStorage.setItem("obMetricsData", JSON.stringify(updated))
      return updated
    })
    const lsKeys: Record<string, string[]> = {
      ttp: ["ttpRawRows"],
      nhe: ["nheRawRows"],
      ll60: ["ll60RawRows"],
      tcr: ["tcrRawRows"],
    }
    lsKeys[key]?.forEach(k => localStorage.removeItem(k))
    setUploadOrder(prev => prev.filter(k => k !== key))
  }

  const anyLoaded = obMetrics.ttp.loaded || obMetrics.nhe.loaded || obMetrics.ll60.loaded || obMetrics.tcr.loaded

  const obMetricCards = [
    {
      key: "ttp",
      icon: "TTP",
      title: "Time to Productivity",
      subtitle: "Avg. days to confirmed productive",
      value: obMetrics.ttp.avgDays,
      unit: obMetrics.ttp.avgDays != null ? " days" : "",
      accent: "#f59e0b",
      onFile: handleTtp,
      loaded: obMetrics.ttp.loaded,
      detail: "Lower is better",
    },
    {
      key: "nhe",
      icon: "30",
      title: "30-Day Experience",
      subtitle: "LaunchLens30 · Overall category favorability",
      value: obMetrics.nhe.favorability,
      unit: obMetrics.nhe.favorability != null ? "%" : "",
      accent: "#8b5cf6",
      onFile: handleNhe,
      loaded: obMetrics.nhe.loaded,
      detail: "Avg across 10 categories",
    },
    // ── NEW: 60-Day Experience ──────────────────────────────
    {
      key: "ll60",
      icon: "60",
      title: "60-Day Experience",
      subtitle: "LaunchLens60 · Positive signal rate across 6 dimensions",
      value: obMetrics.ll60.overallPositivity,
      unit: obMetrics.ll60.overallPositivity != null ? "%" : "",
      accent: "#10b981",
      onFile: handleLL60,
      loaded: obMetrics.ll60.loaded,
      detail: "Across 6 retention drivers",
    },
    {
      key: "tcr",
      icon: "TCR",
      title: "Training Completion Rate",
      subtitle: "Mandatory onboarding training",
      value: obMetrics.tcr.rate,
      unit: obMetrics.tcr.rate != null ? "%" : "",
      accent: "#06b6d4",
      onFile: handleTcr,
      loaded: obMetrics.tcr.loaded,
      detail: "Target ≥ 90%",
    },
  ]

  // Risk badge helper
  const riskColor = (r: string) =>
    r === "low" ? "#22c55e" : r === "medium" ? "#f59e0b" : "#ef4444"

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>

      {/* Status pills */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 28 }}>
        {obMetricCards.map(m => (
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
        {obMetricCards.map(({ key: _k, ...m }) => <MetricCard key={m.title} {...m} />)}
      </div>

      {/* Summary snapshot */}
      {anyLoaded && (
        <>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 14 }}>
            📊 Onboarding Phase Summary
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

            {obMetrics.ttp.loaded && (
              <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 1px 3px rgba(0,0,0,.06), 0 4px 16px rgba(0,0,0,.06)", padding: "18px 22px", position: "relative" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#f59e0b", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 10 }}> Time to Productivity</div>
                <BenchmarkRow label="Avg. Days to Productive" value={obMetrics.ttp.avgDays ?? 0} target={90} accent="#f59e0b" unit=" days" />
                <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
                  {obMetrics.ttp.confirmed} of {obMetrics.ttp.total} confirmed productive
                </div>
                <button onClick={() => clearMetric("ttp")} style={{ position: "absolute", top: 12, right: 12, background: "#ef4444", color: "#fff", border: "none", borderRadius: "50%", width: 18, height: 18, fontSize: 10, cursor: "pointer" }}>×</button>
              </div>
            )}

            {obMetrics.nhe.loaded && (
              <div style={{
                background: "#fff", borderRadius: 14,
                boxShadow: "0 1px 3px rgba(0,0,0,.06), 0 4px 16px rgba(0,0,0,.06)",
                padding: "18px 22px", position: "relative"
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#8b5cf6", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 10 }}>
                  LaunchLens 30-Day Experience
                </div>
                <BenchmarkRow label="Overall Favorability" value={obMetrics.nhe.favorability ?? 0} target={100} accent="#8b5cf6" unit="%" />
                <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>{obMetrics.nhe.responses} survey responses</div>
                <button onClick={() => clearMetric("nhe")} style={{ position: "absolute", top: 12, right: 12, background: "#ef4444", color: "#fff", border: "none", borderRadius: "50%", width: 18, height: 18, fontSize: 10, cursor: "pointer" }}>×</button>
              </div>
            )}

            {/* ── NEW: LL60 Summary Panel ───────────────────────── */}
            {obMetrics.ll60.loaded && (
  <div style={{
    background: "#fff",
    borderRadius: 14,
    boxShadow: "0 1px 3px rgba(0,0,0,.06), 0 4px 16px rgba(0,0,0,.06)",
    padding: "18px 22px",
    position: "relative"
  }}>
    <div style={{
      fontSize: 11,
      fontWeight: 700,
      color: "#10b981",
      textTransform: "uppercase",
      letterSpacing: ".05em",
      marginBottom: 10
    }}>
      LaunchLens 60-Day Experience
    </div>

    {/* Main KPI */}
    <BenchmarkRow
      label="Positive Signal Rate"
      value={obMetrics.ll60.overallPositivity ?? 0}
      target={100}
      accent="#10b981"
      unit="%"
    />

    {/* Supporting metrics */}
    <div style={{
      display: "flex",
      justifyContent: "space-between",
      marginTop: 10,
      fontSize: 12,
      color: "#475569"
    }}>
      <span>⭐ {obMetrics.ll60.avgRating ?? "—"} / 5</span>
      <span>👍 {obMetrics.ll60.avgRecommend ?? "—"}%</span>
    </div>

    {/* Context */}
    <div style={{
      fontSize: 11,
      color: "#94a3b8",
      marginTop: 8
    }}>
      {obMetrics.ll60.participantCount} participants · {obMetrics.ll60.sessionCount} sessions
    </div>

    <button
      onClick={() => clearMetric("ll60")}
      style={{
        position: "absolute",
        top: 12,
        right: 12,
        background: "#ef4444",
        color: "#fff",
        border: "none",
        borderRadius: "50%",
        width: 18,
        height: 18,
        fontSize: 10,
        cursor: "pointer"
      }}
    >
      ×
    </button>
  </div>
)}

            {obMetrics.tcr.loaded && (
              <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 1px 3px rgba(0,0,0,.06), 0 4px 16px rgba(0,0,0,.06)", padding: "18px 22px", position: "relative" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#06b6d4", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 10 }}>🎓 Training Completion</div>
                <BenchmarkRow label="Completion Rate" value={obMetrics.tcr.rate ?? 0} target={100} accent="#06b6d4" unit="%" />
                <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>{obMetrics.tcr.completed} of {obMetrics.tcr.enrolled} completions</div>
                <button onClick={() => clearMetric("tcr")} style={{ position: "absolute", top: 12, right: 12, background: "#ef4444", color: "#fff", border: "none", borderRadius: "50%", width: 18, height: 18, fontSize: 10, cursor: "pointer" }}>×</button>
              </div>
            )}

          </div>
        </>
      )}
    </div>
  )
}