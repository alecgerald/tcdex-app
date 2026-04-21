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

// ─── LIKERT helpers ───────────────────────────────────────
const LIKERT: Record<string, number> = {
  "strongly agree": 5, "agree": 4, "neutral": 3, "disagree": 2, "strongly disagree": 1,
}
const toLikert = (v: string | number | undefined): number | null => {
  if (typeof v === "number") return v
  return LIKERT[(v as string || "").trim().toLowerCase()] ?? null
}
const isAgree = (v: string | number | undefined): boolean =>
  ["strongly agree", "agree"].includes((v as string || "").trim().toLowerCase())

// ─── EngRetDashboard ─────────────────────────────────────
export default function EngRetDashboard() {
  const [uploadOrder, setUploadOrder] = useState<string[]>([])

  const [metrics, setMetrics] = useState(() => {
    try {
      const s = localStorage.getItem("engRetMetricsData")
      return s ? JSON.parse(s) : {
        ei:   { engagementIndex: null, eNPS: null, responses: 0, promoters: 0, passives: 0, detractors: 0, loaded: false },
        vtr:  { rate: null, separations: 0, headcount: 0, loaded: false },
        err:  { rate: null, startCount: 0, retained: 0, loaded: false },
        its:  { rate: null, responses: 0, loaded: false },
        ner:  { referralCount: 0, referralRate: null, loaded: false },
      }
    } catch {
      return {
        ei:   { engagementIndex: null, eNPS: null, responses: 0, promoters: 0, passives: 0, detractors: 0, loaded: false },
        vtr:  { rate: null, separations: 0, headcount: 0, loaded: false },
        err:  { rate: null, startCount: 0, retained: 0, loaded: false },
        its:  { rate: null, responses: 0, loaded: false },
        ner:  { referralCount: 0, referralRate: null, loaded: false },
      }
    }
  })

  useEffect(() => {
    localStorage.setItem("engRetMetricsData", JSON.stringify(metrics))
  }, [metrics])

  // ─── EI / eNPS Handler ───────────────────────────────────
  // Columns: survey period, function, role level, location, tenure band,
  //          q1 purpose, q2 enablement, q3 commitment, q4 growth, q5 belonging,
  //          q6 enps (0-10), q7 improvement comment
  const handleEi = async (file: File) => {
    const rows = await parseSheet(file)
    if (!rows.length) { alert("File is empty."); return }

    const keys = Object.keys(rows[0])
    const engQKeys = ["q1 purpose", "q2 enablement", "q3 commitment", "q4 growth", "q5 belonging"]
    const resolvedEngKeys = engQKeys.map(q =>
      keys.find(k => k.startsWith(q.substring(0, 6))) ?? q
    )
    const eNpsKey = keys.find(k => k.includes("enps") || (k.includes("q6") && k.includes("0-10"))) ?? "q6 enps (0-10)"

    // Merge
    const existing: RowObject[] = JSON.parse(localStorage.getItem("eiRawRows") || "[]")
    const makeKey = (r: RowObject) => `${r["survey period"] ?? ""}|${r["function"] ?? ""}|${r["role level"] ?? ""}|${r["location"] ?? ""}|${r["tenure band"] ?? ""}`
    const existingKeys = new Set(existing.map(makeKey))
    const merged = [...existing, ...rows.filter(r => !existingKeys.has(makeKey(r)))]
    localStorage.setItem("eiRawRows", JSON.stringify(merged))

    // Engagement Index: avg Likert across Q1–Q5, mapped 1-5 → 0-100%
    let totalScore = 0; let totalItems = 0
    merged.forEach(r => {
      resolvedEngKeys.forEach(k => {
        const score = toLikert(r[k])
        if (score !== null) { totalScore += score; totalItems++ }
      })
    })
    const avgLikert       = totalItems ? totalScore / totalItems : 0
    const engagementIndex = totalItems ? Number(((avgLikert - 1) / 4 * 100).toFixed(1)) : null

    // eNPS: Promoters (9-10) - Detractors (0-6), Passives (7-8)
    let promoters = 0; let passives = 0; let detractors = 0; let eNpsResponses = 0
    merged.forEach(r => {
      const score = Number(r[eNpsKey] ?? NaN)
      if (!isNaN(score)) {
        eNpsResponses++
        if (score >= 9)      promoters++
        else if (score >= 7) passives++
        else                 detractors++
      }
    })
    const eNPS = eNpsResponses
      ? Number(((promoters - detractors) / eNpsResponses * 100).toFixed(1))
      : null

    setMetrics((prev: typeof metrics) => ({
      ...prev,
      ei: {
        engagementIndex,
        eNPS,
        responses:  merged.length,
        promoters,
        passives,
        detractors,
        loaded: true,
      }
    }))
    setUploadOrder(prev => [...prev.filter(k => k !== "ei"), "ei"])
  }

  // ─── VTR Handler ─────────────────────────────────────────
  // Columns: reporting period, delivery unit, job family, tenure band,
  //          average headcount during the same period,
  //          number of voluntary separations during the period,
  //          voluntary turnover rate (%)
  const handleVtr = async (file: File) => {
    const rows = await parseSheet(file)
    if (!rows.length) { alert("File is empty."); return }

    const keys = Object.keys(rows[0])
    const headcountKey   = keys.find(k => k.includes("average headcount"))            ?? ""
    const separationsKey = keys.find(k => k.includes("voluntary separations"))        ?? ""

    if (!headcountKey || !separationsKey) {
      alert("Missing columns: Average Headcount During the Same Period / Number of Voluntary Separations During the Period")
      return
    }

    const existing: RowObject[] = JSON.parse(localStorage.getItem("vtrRawRows") || "[]")
    const makeKey = (r: RowObject) => `${r["reporting period"] ?? ""}|${(r["delivery unit"] ?? "").toString().trim()}|${(r["job family"] ?? "").toString().trim()}|${(r["tenure band"] ?? "").toString().trim()}`
    const existingKeys = new Set(existing.map(makeKey))
    const merged = [...existing, ...rows.filter(r => !existingKeys.has(makeKey(r)))]
    localStorage.setItem("vtrRawRows", JSON.stringify(merged))

    const totalHeadcount   = merged.reduce((s, r) => s + Number(r[headcountKey]   || 0), 0)
    const totalSeparations = merged.reduce((s, r) => s + Number(r[separationsKey] || 0), 0)
    const rate = totalHeadcount
      ? Number(((totalSeparations / totalHeadcount) * 100).toFixed(2))
      : null

    setMetrics((prev: typeof metrics) => ({
      ...prev,
      vtr: { rate, separations: totalSeparations, headcount: totalHeadcount, loaded: true }
    }))
    setUploadOrder(prev => [...prev.filter(k => k !== "vtr"), "vtr"])
  }

  // ─── ERR Handler ─────────────────────────────────────────
  // Columns: reporting period, delivery unit,
  //          employees at start of period,
  //          employees at end of period,
  //          new hires during period,
  //          employee retention rate (%)
  const handleErr = async (file: File) => {
    const rows = await parseSheet(file)
    if (!rows.length) { alert("File is empty."); return }

    const keys = Object.keys(rows[0])
    const startKey    = keys.find(k => k.includes("employees at start"))    ?? ""
    const endKey      = keys.find(k => k.includes("employees at end"))      ?? ""
    const newHiresKey = keys.find(k => k.includes("new hires during"))      ?? ""

    if (!startKey || !endKey || !newHiresKey) {
      alert("Missing columns: Employees at Start of Period / Employees at End of Period / New Hires During Period")
      return
    }

    const existing: RowObject[] = JSON.parse(localStorage.getItem("errRawRows") || "[]")
    const makeKey = (r: RowObject) => `${r["reporting period"] ?? ""}|${(r["delivery unit"] ?? "").toString().trim()}`
    const existingKeys = new Set(existing.map(makeKey))
    const merged = [...existing, ...rows.filter(r => !existingKeys.has(makeKey(r)))]
    localStorage.setItem("errRawRows", JSON.stringify(merged))

    // ERR = (End - New Hires) / Start × 100
    const totalStart    = merged.reduce((s, r) => s + Number(r[startKey]    || 0), 0)
    const totalEnd      = merged.reduce((s, r) => s + Number(r[endKey]      || 0), 0)
    const totalNewHires = merged.reduce((s, r) => s + Number(r[newHiresKey] || 0), 0)
    const retained      = totalEnd - totalNewHires
    const rate = totalStart
      ? Number(((retained / totalStart) * 100).toFixed(2))
      : null

    setMetrics((prev: typeof metrics) => ({
      ...prev,
      err: { rate, startCount: totalStart, retained, loaded: true }
    }))
    setUploadOrder(prev => [...prev.filter(k => k !== "err"), "err"])
  }

  // ─── ITS Handler ─────────────────────────────────────────
  // Columns: survey period, function, role level, location, tenure band,
  //          q1 intent to stay, q2 prefer to continue career here (optional),
  //          response date
  const handleIts = async (file: File) => {
    const rows = await parseSheet(file)
    if (!rows.length) { alert("File is empty."); return }

    const keys = Object.keys(rows[0])
    const itsKey = keys.find(k => k.includes("intent to stay") || (k.startsWith("q1") && k.includes("intent"))) ?? "q1 intent to stay"

    if (!keys.some(k => k.includes("intent to stay") || (k.startsWith("q1") && k.includes("intent")))) {
      alert("Missing column: Q1 Intent to Stay"); return
    }

    const existing: RowObject[] = JSON.parse(localStorage.getItem("itsRawRows") || "[]")
    const makeKey = (r: RowObject) => `${r["survey period"] ?? ""}|${r["function"] ?? ""}|${r["role level"] ?? ""}|${r["location"] ?? ""}|${r["response date"] ?? ""}`
    const existingKeys = new Set(existing.map(makeKey))
    const merged = [...existing, ...rows.filter(r => !existingKeys.has(makeKey(r)))]
    localStorage.setItem("itsRawRows", JSON.stringify(merged))

    // ITS Rate = (agree + strongly agree) / total × 100
    const favorable = merged.filter(r => isAgree(r[itsKey])).length
    const rate = merged.length
      ? Number(((favorable / merged.length) * 100).toFixed(1))
      : null

    setMetrics((prev: typeof metrics) => ({
      ...prev,
      its: { rate, responses: merged.length, loaded: true }
    }))
    setUploadOrder(prev => [...prev.filter(k => k !== "its"), "its"])
  }

  // ─── NER Handler ─────────────────────────────────────────
  // Columns: reporting period, delivery unit, location,
  //          number of employee referrals,
  //          number of employees who made at least one referral,
  //          total active employees,
  //          referral rate (%)
  const handleNer = async (file: File) => {
    const rows = await parseSheet(file)
    if (!rows.length) { alert("File is empty."); return }

    const keys = Object.keys(rows[0])
    const referralsKey     = keys.find(k => k.includes("number of employee referrals"))              ?? ""
    const participantsKey  = keys.find(k => k.includes("employees who made at least one referral"))  ?? ""
    const activeKey        = keys.find(k => k.includes("total active employees"))                    ?? ""

    if (!referralsKey) {
      alert("Missing column: Number of Employee Referrals"); return
    }

    const existing: RowObject[] = JSON.parse(localStorage.getItem("nerRawRows") || "[]")
    const makeKey = (r: RowObject) => `${r["reporting period"] ?? ""}|${(r["delivery unit"] ?? "").toString().trim()}|${(r["location"] ?? "").toString().trim()}`
    const existingKeys = new Set(existing.map(makeKey))
    const merged = [...existing, ...rows.filter(r => !existingKeys.has(makeKey(r)))]
    localStorage.setItem("nerRawRows", JSON.stringify(merged))

    const totalReferrals   = merged.reduce((s, r) => s + Number(r[referralsKey]    || 0), 0)
    const totalParticipants = participantsKey ? merged.reduce((s, r) => s + Number(r[participantsKey] || 0), 0) : 0
    const totalActive       = activeKey       ? merged.reduce((s, r) => s + Number(r[activeKey]       || 0), 0) : 0
    const referralRate = totalActive
      ? Number(((totalParticipants / totalActive) * 100).toFixed(2))
      : null

    setMetrics((prev: typeof metrics) => ({
      ...prev,
      ner: { referralCount: totalReferrals, referralRate, participants: totalParticipants, activeEmployees: totalActive, loaded: true }
    }))
    setUploadOrder(prev => [...prev.filter(k => k !== "ner"), "ner"])
  }

  // ─── Clear metric ─────────────────────────────────────────
  const clearMetric = (key: string) => {
    const defaults: Record<string, object> = {
      ei:  { engagementIndex: null, eNPS: null, responses: 0, promoters: 0, passives: 0, detractors: 0, loaded: false },
      vtr: { rate: null, separations: 0, headcount: 0, loaded: false },
      err: { rate: null, startCount: 0, retained: 0, loaded: false },
      its: { rate: null, responses: 0, loaded: false },
      ner: { referralCount: 0, referralRate: null, participants: 0, activeEmployees: 0, loaded: false },
    }
    setMetrics((prev: typeof metrics) => {
      const updated = { ...prev, [key]: defaults[key] }
      localStorage.setItem("engRetMetricsData", JSON.stringify(updated))
      return updated
    })
    const lsKeys: Record<string, string[]> = {
      ei:  ["eiRawRows"],
      vtr: ["vtrRawRows"],
      err: ["errRawRows"],
      its: ["itsRawRows"],
      ner: ["nerRawRows"],
    }
    lsKeys[key]?.forEach(k => localStorage.removeItem(k))
    setUploadOrder(prev => prev.filter(k => k !== key))
  }

  const anyLoaded = metrics.ei.loaded || metrics.vtr.loaded || metrics.err.loaded || metrics.its.loaded || metrics.ner.loaded

  // ─── Metric card configs ──────────────────────────────────
  const metricCards = [
    {
      key: "ei", icon: "EI",
      title: "Engagement Index / eNPS",
      subtitle: "Quarterly pulse · Q1–Q5 favorability + employee advocacy",
      value: metrics.ei.engagementIndex,
      unit: metrics.ei.engagementIndex != null ? "%" : "",
      accent: "#6366f1",
      onFile: handleEi, loaded: metrics.ei.loaded,
      detail: "Engagement favorability",
    },
    {
      key: "vtr", icon: "VTR",
      title: "Voluntary Turnover Rate",
      subtitle: "Employee-initiated separations during the period",
      value: metrics.vtr.rate,
      unit: metrics.vtr.rate != null ? "%" : "",
      accent: "#ef4444",
      onFile: handleVtr, loaded: metrics.vtr.loaded,
      detail: "Lower is better",
    },
    {
      key: "err", icon: "ERR",
      title: "Employee Retention Rate",
      subtitle: "Start-cohort employees retained through period end",
      value: metrics.err.rate,
      unit: metrics.err.rate != null ? "%" : "",
      accent: "#10b981",
      onFile: handleErr, loaded: metrics.err.loaded,
      detail: "Higher is better",
    },
    {
      key: "its", icon: "IS",
      title: "Intent to Stay",
      subtitle: "Leading retention signal · favorable Q1 responses",
      value: metrics.its.rate,
      unit: metrics.its.rate != null ? "%" : "",
      accent: "#8b5cf6",
      onFile: handleIts, loaded: metrics.its.loaded,
      detail: "Agree + Strongly Agree",
    },
    {
      key: "ner", icon: "ER",
      title: "Employee Referrals",
      subtitle: "Candidates referred by current employees",
      value: metrics.ner.referralCount || null,
      unit: metrics.ner.referralCount > 0 ? " referrals" : "",
      accent: "#f59e0b",
      onFile: handleNer, loaded: metrics.ner.loaded,
      detail: "Employee advocacy count",
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

            {/* EI / eNPS */}
            {metrics.ei.loaded && (
              <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 1px 3px rgba(0,0,0,.06), 0 4px 16px rgba(0,0,0,.06)", padding: "18px 22px", position: "relative" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#6366f1", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 10 }}> Engagement Index / eNPS</div>
                <BenchmarkRow label="Engagement Index (Favorability)" value={metrics.ei.engagementIndex ?? 0} target={100} accent="#6366f1" unit="%" />
                {/* eNPS display — can be negative so don't use bar */}
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#475569", marginBottom: 12 }}>
                  <span>eNPS Score</span>
                  <span style={{ fontWeight: 700, color: (metrics.ei.eNPS ?? 0) >= 0 ? "#6366f1" : "#ef4444" }}>
                    {metrics.ei.eNPS ?? "—"}
                  </span>
                </div>
                {/* eNPS breakdown */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 10 }}>
                  {[
                    { label: "Promoters (9–10)",  val: metrics.ei.promoters,  color: "#10b981" },
                    { label: "Passives (7–8)",    val: metrics.ei.passives,   color: "#f59e0b" },
                    { label: "Detractors (0–6)",  val: metrics.ei.detractors, color: "#ef4444" },
                  ].map(d => (
                    <div key={d.label} style={{ background: "#f8fafc", borderRadius: 8, padding: "8px 10px", border: "1px solid #e2e8f0" }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", marginBottom: 2 }}>{d.label}</div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: d.color }}>{d.val}</div>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 11, color: "#94a3b8" }}>{metrics.ei.responses} survey responses</div>
                <button onClick={() => clearMetric("ei")} style={{ position: "absolute", top: 12, right: 12, background: "#ef4444", color: "#fff", border: "none", borderRadius: "50%", width: 18, height: 18, fontSize: 10, cursor: "pointer" }} title="Clear">×</button>
              </div>
            )}

            {/* VTR */}
            {metrics.vtr.loaded && (
              <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 1px 3px rgba(0,0,0,.06), 0 4px 16px rgba(0,0,0,.06)", padding: "18px 22px", position: "relative" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#ef4444", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 10 }}> Voluntary Turnover Rate</div>
                <BenchmarkRow label="Voluntary Turnover Rate" value={metrics.vtr.rate ?? 0} target={20} accent="#ef4444" unit="%" />
                <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
                  {metrics.vtr.separations} voluntary separation{metrics.vtr.separations !== 1 ? "s" : ""} from an avg headcount of {metrics.vtr.headcount.toLocaleString()}
                </div>
                {(metrics.vtr.rate ?? 0) >= 10 && (
                  <div style={{ fontSize: 11, color: "#b91c1c", background: "#fef2f2", borderRadius: 6, padding: "5px 8px", marginTop: 6 }}>Elevated turnover — review retention risk signals</div>
                )}
                <button onClick={() => clearMetric("vtr")} style={{ position: "absolute", top: 12, right: 12, background: "#ef4444", color: "#fff", border: "none", borderRadius: "50%", width: 18, height: 18, fontSize: 10, cursor: "pointer" }} title="Clear">×</button>
              </div>
            )}

            {/* ERR */}
            {metrics.err.loaded && (
              <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 1px 3px rgba(0,0,0,.06), 0 4px 16px rgba(0,0,0,.06)", padding: "18px 22px", position: "relative" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#10b981", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 10 }}>Employee Retention Rate</div>
                <BenchmarkRow label="Retention Rate" value={metrics.err.rate ?? 0} target={100} accent="#10b981" unit="%" />
                <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
                  {metrics.err.retained} of {metrics.err.startCount} employees retained through end of period
                </div>
                {(metrics.err.rate ?? 100) < 90 && (
                  <div style={{ fontSize: 11, color: "#b91c1c", background: "#fef2f2", borderRadius: 6, padding: "5px 8px", marginTop: 6 }}> Retention rate below 90% — investigate root causes</div>
                )}
                <button onClick={() => clearMetric("err")} style={{ position: "absolute", top: 12, right: 12, background: "#ef4444", color: "#fff", border: "none", borderRadius: "50%", width: 18, height: 18, fontSize: 10, cursor: "pointer" }} title="Clear">×</button>
              </div>
            )}

            {/* ITS */}
            {metrics.its.loaded && (
              <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 1px 3px rgba(0,0,0,.06), 0 4px 16px rgba(0,0,0,.06)", padding: "18px 22px", position: "relative" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#8b5cf6", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 10 }}>🔮 Intent to Stay</div>
                <BenchmarkRow label="Intent to Stay Rate" value={metrics.its.rate ?? 0} target={100} accent="#8b5cf6" unit="%" />
                <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
                  {metrics.its.responses} pulse survey responses · leading retention indicator
                </div>
                {(metrics.its.rate ?? 100) < 70 && (
                  <div style={{ fontSize: 11, color: "#7c3aed", background: "#faf5ff", borderRadius: 6, padding: "5px 8px", marginTop: 6 }}> Low intent to stay — early action planning recommended</div>
                )}
                <button onClick={() => clearMetric("its")} style={{ position: "absolute", top: 12, right: 12, background: "#ef4444", color: "#fff", border: "none", borderRadius: "50%", width: 18, height: 18, fontSize: 10, cursor: "pointer" }} title="Clear">×</button>
              </div>
            )}

            {/* NER */}
            {metrics.ner.loaded && (
              <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 1px 3px rgba(0,0,0,.06), 0 4px 16px rgba(0,0,0,.06)", padding: "18px 22px", position: "relative" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#f59e0b", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 10 }}> Employee Referrals</div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#475569", marginBottom: 12 }}>
                  <span>Total Referrals</span>
                  <span style={{ fontWeight: 700, color: "#f59e0b" }}>{metrics.ner.referralCount}</span>
                </div>
                {metrics.ner.referralRate != null && (
                  <BenchmarkRow label="Referral Rate (Employees Participating)" value={metrics.ner.referralRate} target={20} accent="#f59e0b" unit="%" />
                )}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
                  <div style={{ background: "#f8fafc", borderRadius: 8, padding: "8px 10px", border: "1px solid #e2e8f0" }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", marginBottom: 2 }}>Participating Employees</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: "#f59e0b" }}>{metrics.ner.participants ?? 0}</div>
                  </div>
                  <div style={{ background: "#f8fafc", borderRadius: 8, padding: "8px 10px", border: "1px solid #e2e8f0" }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", marginBottom: 2 }}>Active Employees</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: "#f59e0b" }}>{(metrics.ner.activeEmployees ?? 0).toLocaleString()}</div>
                  </div>
                </div>
                <button onClick={() => clearMetric("ner")} style={{ position: "absolute", top: 12, right: 12, background: "#ef4444", color: "#fff", border: "none", borderRadius: "50%", width: 18, height: 18, fontSize: 10, cursor: "pointer" }} title="Clear">×</button>
              </div>
            )}

          </div>
        </>
      )}
    </div>
  )
}