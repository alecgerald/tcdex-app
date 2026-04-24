"use client"

import { useState, useRef, useEffect } from "react"
import * as XLSX from "xlsx"
import { createClient } from "@/utils/supabase/client"

const supabase = createClient()

// ─── Types ───────────────────────────────────────────────
interface RowObject {
  [key: string]: string | number | null
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
const nk = (k: string) => k.trim().toLowerCase().replace(/\s+/g, " ")

const parseSheet = (file: File): Promise<RowObject[]> =>
  new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (evt) => {
      const arrayBuffer = evt.target?.result
      if (!arrayBuffer) return resolve([])
      const wb = XLSX.read(arrayBuffer, { type: "array", cellDates: true, dateNF: "yyyy-mm-dd" })
      const rows = XLSX.utils.sheet_to_json<RowObject>(wb.Sheets[wb.SheetNames[0]], { defval: null })
      const norm = rows.map((row) => {
        const obj: RowObject = {}
        Object.keys(row).forEach((k) => { 
          const v = row[k] as any
          obj[nk(k)] = v instanceof Date ? v.toISOString().slice(0, 10) : v
        })
        return obj
      })
      resolve(norm)
    }
    reader.readAsArrayBuffer(file)
  })

const safeNum = (v: any): number | null => {
  if (v === null || v === undefined || v === "" || v === "#DIV/0!") return null
  const n = Number(v)
  return isNaN(n) ? null : n
}

// Finds a row value by trying exact key or partial word match.
function findVal(r: RowObject, ...candidates: string[]): string {
  for (const c of candidates) {
    const norm = nk(c)
    if (r[norm] !== null && r[norm] !== undefined) return r[norm]!.toString()
    const words = norm.split(/\s+/).filter(w => w.length > 2)
    const hit = Object.entries(r).find(([k]) => words.every(w => k.includes(w)))
    if (hit) return hit[1]?.toString() || ""
  }
  return ''
}

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
              {unit && value !== null && <span style={{ fontSize: 14, fontWeight: 600, color: accent + "aa" }}>{unit}</span>}
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

// ─── LL30 / LL60 Logic Helpers ─────────────────────────────
const LL30_QUESTIONS = [
    { id: "q4", count: 5 }, { id: "q7", count: 3 }, { id: "q10", count: 5 },
    { id: "q13", count: 5 }, { id: "q22", count: 4 }, { id: "q25", count: 8 },
    { id: "q28", count: 4 }, { id: "q31", count: 5 }, { id: "q38", count: 7 }
]

function calcLL30Favorability(rows: any[]) {
    let totalScore = 0; let totalQuestions = 0
    rows.forEach(r => {
        LL30_QUESTIONS.forEach(q => {
            for (let i = 1; i <= q.count; i++) {
                const val = safeNum(r[`${q.id}_${i}`])
                if (val !== null) { totalScore += val; totalQuestions++ }
            }
        })
    })
    return totalQuestions ? Number(((totalScore / (totalQuestions * 4)) * 100).toFixed(1)) : null
}

const LL60_DIMENSIONS = [
    "motivation_engagement", "manager_relationship", "team_belonging",
    "workload_stress", "growth_future_outlook", "recognition_value"
]

function calcLL60Positivity(rows: any[]) {
    let positive = 0; let total = 0
    rows.forEach(r => {
        LL60_DIMENSIONS.forEach(d => {
            const val = (r[d] || "").toString().toLowerCase()
            if (val.includes("positive")) positive++
            if (val) total++
        })
    })
    return total ? Number(((positive / total) * 100).toFixed(1)) : null
}

// ─── OBDashboard ─────────────────────────────────────────
export default function OBDashboard() {
  const [rehydrating, setRehydrating] = useState(true)
  const [uploading, setUploading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [obMetrics, setObMetrics] = useState({
    ttp:  { avgDays: null as number | null, confirmRate: null as number | null, confirmed: 0, total: 0, loaded: false },
    nhe:  { favorability: null as number | null, responses: 0, loaded: false },
    ll60: {
      overallPositivity: null as number | null, avgRating: null as number | null, avgRecommend: null as number | null,
      sessionCount: 0, participantCount: 0, loaded: false,
    },
    tcr:  { rate: null as number | null, enrolled: 0, completed: 0, loaded: false },
  })

  useEffect(() => {
    const run = async () => {
      setRehydrating(true)
      await Promise.all([fetchTtp(), fetchNhe(), fetchLL60(), fetchTcr()])
      setRehydrating(false)
    }
    run()
  }, [])

  // ─── Fetchers ─────────────────────────────────────────────
  const fetchTtp = async () => {
    const { data } = await supabase.from("time_to_productivity").select("*")
    if (!data?.length) return
    const confirmed = data.filter(r => r.productivity_confirmed === "Yes")
    const avg = confirmed.length ? confirmed.reduce((s, r) => s + (r.ttp_days || 0), 0) / confirmed.length : 0
    setObMetrics(p => ({
        ...p, ttp: {
            avgDays: confirmed.length ? Number(avg.toFixed(1)) : null,
            confirmRate: Number(((confirmed.length / data.length) * 100).toFixed(1)),
            confirmed: confirmed.length,
            total: data.length,
            loaded: true
        }
    }))
  }

  const fetchNhe = async () => {
    const { data } = await supabase.from("onboarding_30_day_survey").select("*")
    if (!data?.length) return
    setObMetrics(p => ({ ...p, nhe: { favorability: calcLL30Favorability(data), responses: data.length, loaded: true } }))
  }

  const fetchLL60 = async () => {
    const { data } = await supabase.from("onboarding_60_day_sessions").select("*")
    if (!data?.length) return
    const avgRating = data.reduce((s, r) => s + (r.avg_journey_rating || 0), 0) / data.length
    const avgRec = data.reduce((s, r) => s + (r.recommend_percent || 0), 0) / data.length
    const participants = data.reduce((s, r) => s + (r.participant_count || 0), 0)
    setObMetrics(p => ({
        ...p, ll60: {
            overallPositivity: calcLL60Positivity(data),
            avgRating: Number(avgRating.toFixed(1)),
            avgRecommend: Number(avgRec.toFixed(1)),
            sessionCount: data.length,
            participantCount: participants,
            loaded: true
        }
    }))
  }

  const fetchTcr = async () => {
    const { data } = await supabase.from("training_completion").select("total_enrolled, total_completed")
    if (!data?.length) return
    const enrolled = data.reduce((s, r) => s + (r.total_enrolled || 0), 0)
    const completed = data.reduce((s, r) => s + (r.total_completed || 0), 0)
    setObMetrics(p => ({ ...p, tcr: { rate: enrolled ? Number(((completed / enrolled) * 100).toFixed(1)) : 0, enrolled, completed, loaded: true } }))
  }

  // ─── Batch Helper ──────────────────────────────────────────
  const createBatch = async (filename: string, uploadType: string, count: number) => {
    const { data, error } = await supabase
      .from("ex_batches")
      .insert({ filename, upload_type: uploadType, uploaded_by: "system", records_parsed: count, records_imported: count })
      .select().single()
    if (error) throw new Error("Batch tracking failed: " + error.message)
    return data.batch_id
  }

  // ─── Handlers ─────────────────────────────────────────────
  const handleTtp = async (file: File) => {
    setUploading("ttp"); setError(null)
    try {
      const rows = await parseSheet(file)
      if (!rows.length) throw new Error("File is empty.")
      const batchId = await createBatch(file.name, "time_to_productivity", rows.length)
      const { error: insErr } = await supabase.from("time_to_productivity").insert(
        rows.map(r => ({
          batch_id: batchId,
          employee_id: findVal(r, "employee id", "employee_id"),
          start_date: findVal(r, "start date", "start_date"),
          role_job_family: findVal(r, "role", "job family"),
          delivery_unit: findVal(r, "delivery unit", "bu"),
          productivity_threshold: findVal(r, "threshold"),
          productivity_confirmed: findVal(r, "confirmed"),
          confirmation_date: findVal(r, "confirmation date"),
          confirmed_by: findVal(r, "confirmed by"),
          ttp_days: safeNum(findVal(r, "days", "ttp")),
        }))
      )
      if (insErr) throw insErr
      await fetchTtp()
    } catch (e: any) { setError(e.message) } finally { setUploading(null) }
  }

  const handleNhe = async (file: File) => {
    setUploading("nhe"); setError(null)
    try {
      const rows = await parseSheet(file)
      if (!rows.length) throw new Error("File is empty.")
      const batchId = await createBatch(file.name, "onboarding_30_day_survey", rows.length)
      const { error: insErr } = await supabase.from("onboarding_30_day_survey").insert(
        rows.map(r => {
            const mapped: any = {
                batch_id: batchId,
                first_name: r["first name"],
                last_name: r["last name"],
                email: r["email"],
                submission_date: r["date"],
                delivery_unit: r["delivery unit"],
                job_title: r["job title"],
                project_name: r["project name"],
                location: r["location"],
                supervisor_name: findVal(r, "supervisor", "immediate supervisor"),
                job_band: r["job band"],
                employee_code: r["employee code"],
                hire_date: r["hire date"],
                q1: safeNum(r["q1"]), q2: safeNum(r["q2"]), q3: safeNum(r["q3"]),
                q34_1: safeNum(r["q34_1"] || r["q34.1"]),
            }
            LL30_QUESTIONS.forEach(q => {
                for (let i = 1; i <= q.count; i++) {
                    mapped[`${q.id}_${i}`] = safeNum(r[`${q.id}_${i}`] || r[`${q.id}.${i}`])
                }
            })
            return mapped
        })
      )
      if (insErr) throw insErr
      await fetchNhe()
    } catch (e: any) { setError(e.message) } finally { setUploading(null) }
  }

  const handleLL60 = async (file: File) => {
    setUploading("ll60"); setError(null)
    try {
      const rows = await parseSheet(file)
      if (!rows.length) throw new Error("File is empty.")
      const batchId = await createBatch(file.name, "onboarding_60_day_sessions", rows.length)
      const { error: insErr } = await supabase.from("onboarding_60_day_sessions").insert(
        rows.map(r => ({
          batch_id: batchId,
          session_id: findVal(r, "session id"),
          session_date: findVal(r, "session date"),
          hire_period: findVal(r, "hire period"),
          session_type: findVal(r, "session type"),
          participant_count: safeNum(findVal(r, "participant count")),
          delivery_unit: findVal(r, "delivery unit"),
          location: findVal(r, "location"),
          facilitator_names: findVal(r, "facilitator"),
          motivation_engagement: findVal(r, "motivation"),
          manager_relationship: findVal(r, "manager relationship"),
          team_belonging: findVal(r, "team belonging"),
          workload_stress: findVal(r, "workload"),
          growth_future_outlook: findVal(r, "growth"),
          recognition_value: findVal(r, "recognition"),
          avg_journey_rating: safeNum(findVal(r, "journey rating")),
          recommend_percent: safeNum(findVal(r, "recommend")),
          overall_retention_risk: findVal(r, "retention risk"),
        }))
      )
      if (insErr) throw insErr
      await fetchLL60()
    } catch (e: any) { setError(e.message) } finally { setUploading(null) }
  }

  const handleTcr = async (file: File) => {
    setUploading("tcr"); setError(null)
    try {
      const rows = await parseSheet(file)
      if (!rows.length) throw new Error("File is empty.")
      const batchId = await createBatch(file.name, "training_completion", rows.length)
      const enrollKey = Object.keys(rows[0]).find(k => k.includes("enrolled in required training")) ?? "total enrolled"
      const completedKey = Object.keys(rows[0]).find(k => k.includes("completed all required training")) ?? "total completed"
      const { error: insErr } = await supabase.from("training_completion").insert(
        rows.map(r => ({
          batch_id: batchId,
          cohort: r["cohort"],
          role_job_family: findVal(r, "role", "job family"),
          training_modality: r["training modality"],
          total_enrolled: safeNum(r[enrollKey]),
          total_completed: safeNum(r[completedKey]),
          completion_deadline: r["deadline"],
        }))
      )
      if (insErr) throw insErr
      await fetchTcr()
    } catch (e: any) { setError(e.message) } finally { setUploading(null) }
  }

  const clearMetric = async (key: string) => {
    const tableMap: Record<string, string> = { 
        ttp: "time_to_productivity", 
        nhe: "onboarding_30_day_survey", 
        ll60: "onboarding_60_day_sessions", 
        tcr: "training_completion" 
    }
    const typeMap: Record<string, string> = { 
        ttp: "time_to_productivity", 
        nhe: "onboarding_30_day_survey", 
        ll60: "onboarding_60_day_sessions", 
        tcr: "training_completion" 
    }
    
    const { data: batches } = await supabase.from("ex_batches").select("batch_id").eq("upload_type", typeMap[key])
    if (batches?.length) {
      const ids = batches.map(b => b.batch_id)
      await supabase.from(tableMap[key]).delete().in("batch_id", ids)
      await supabase.from("ex_batches").delete().in("batch_id", ids)
    }

    setObMetrics(p => ({ ...p, [key]: { loaded: false, value: null, responses: 0, confirmed: 0, total: 0 } } as any))
  }

  const anyLoaded = obMetrics.ttp.loaded || obMetrics.nhe.loaded || obMetrics.ll60.loaded || obMetrics.tcr.loaded

  const obMetricCards = [
    { key: "ttp", icon: "TTP", title: "Time to Productivity", subtitle: "Avg. days to productive", value: obMetrics.ttp.avgDays, unit: " days", accent: "#f59e0b", onFile: handleTtp, loaded: obMetrics.ttp.loaded, detail: "Lower is better" },
    { key: "nhe", icon: "30", title: "30-Day Experience", subtitle: "LaunchLens30 · Favorability", value: obMetrics.nhe.favorability, unit: "%", accent: "#8b5cf6", onFile: handleNhe, loaded: obMetrics.nhe.loaded, detail: "Survey metrics" },
    { key: "ll60", icon: "60", title: "60-Day Experience", subtitle: "LaunchLens60 · Positivity", value: obMetrics.ll60.overallPositivity, unit: "%", accent: "#10b981", onFile: handleLL60, loaded: obMetrics.ll60.loaded, detail: "Retention drivers" },
    { key: "tcr", icon: "TCR", title: "Training Completion", subtitle: "Mandatory onboarding", value: obMetrics.tcr.rate, unit: "%", accent: "#06b6d4", onFile: handleTcr, loaded: obMetrics.tcr.loaded, detail: "Target ≥ 90%" },
  ]

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {error && (
        <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 10, padding: "10px 14px", fontSize: 12, color: "#dc2626", marginBottom: 16, display: "flex", justifyContent: "space-between" }}>
          <span>⚠ {error}</span>
          <button onClick={() => setError(null)} style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", fontWeight: 700 }}>×</button>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 28 }}>
        {obMetricCards.map(m => (
          <div key={m.key} style={{
            fontSize: 11, fontWeight: 600, padding: "4px 12px", borderRadius: 20,
            background: m.loaded ? m.accent + "18" : "#f1f5f9", color: m.loaded ? m.accent : "#94a3b8",
            border: `1px solid ${m.loaded ? m.accent + "30" : "#e2e8f0"}`, display: "flex", alignItems: "center", gap: 5,
          }}>
            <span style={{ fontSize: 13 }}>{m.loaded ? "●" : "○"}</span> {m.title}
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 20, marginBottom: 36 }}>
        {obMetricCards.map(({ key: _k, ...m }) => <MetricCard key={m.title} {...m} />)}
      </div>

      {anyLoaded && (
        <>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 14 }}>📊 Onboarding Phase Summary</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {obMetrics.ttp.loaded && (
              <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 1px 3px rgba(0,0,0,.06), 0 4px 16px rgba(0,0,0,.06)", padding: "18px 22px", position: "relative" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#f59e0b", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 10 }}> Time to Productivity</div>
                <BenchmarkRow label="Avg. Days to Productive" value={obMetrics.ttp.avgDays ?? 0} target={90} accent="#f59e0b" unit=" days" />
                <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>{obMetrics.ttp.confirmed} of {obMetrics.ttp.total} confirmed</div>
                <button onClick={() => clearMetric("ttp")} style={{ position: "absolute", top: 12, right: 12, background: "#ef4444", color: "#fff", border: "none", borderRadius: "50%", width: 18, height: 18, fontSize: 10, cursor: "pointer" }}>×</button>
              </div>
            )}
            {obMetrics.nhe.loaded && (
              <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 1px 3px rgba(0,0,0,.06), 0 4px 16px rgba(0,0,0,.06)", padding: "18px 22px", position: "relative" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#8b5cf6", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 10 }}> LaunchLens 30-Day Experience</div>
                <BenchmarkRow label="Overall Favorability" value={obMetrics.nhe.favorability ?? 0} target={100} accent="#8b5cf6" unit="%" />
                <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>{obMetrics.nhe.responses} responses</div>
                <button onClick={() => clearMetric("nhe")} style={{ position: "absolute", top: 12, right: 12, background: "#ef4444", color: "#fff", border: "none", borderRadius: "50%", width: 18, height: 18, fontSize: 10, cursor: "pointer" }}>×</button>
              </div>
            )}
            {obMetrics.ll60.loaded && (
              <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 1px 3px rgba(0,0,0,.06), 0 4px 16px rgba(0,0,0,.06)", padding: "18px 22px", position: "relative" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#10b981", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 10 }}> LaunchLens 60-Day Experience</div>
                <BenchmarkRow label="Positive Signal Rate" value={obMetrics.ll60.overallPositivity ?? 0} target={100} accent="#10b981" unit="%" />
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, fontSize: 12, color: "#475569" }}>
                  <span>⭐ {obMetrics.ll60.avgRating ?? "—"} / 5</span>
                  <span>👍 {obMetrics.ll60.avgRecommend ?? "—"}% rec.</span>
                </div>
                <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 8 }}>{obMetrics.ll60.participantCount} participants · {obMetrics.ll60.sessionCount} sessions</div>
                <button onClick={() => clearMetric("ll60")} style={{ position: "absolute", top: 12, right: 12, background: "#ef4444", color: "#fff", border: "none", borderRadius: "50%", width: 18, height: 18, fontSize: 10, cursor: "pointer" }}>×</button>
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