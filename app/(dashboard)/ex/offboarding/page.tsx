"use client"

import { useState, useRef, useEffect } from "react"
import * as XLSX from "xlsx"
import { createClient } from "@/utils/supabase/client"

const supabase = createClient()

// ─── Types ───────────────────────────────────────────────
interface RowObject { [key: string]: string | number | null }
interface UploadZoneProps { onFile: (file: File) => void; loaded: boolean }
interface MetricCardProps {
  icon: string; title: string; subtitle: string
  value: string | number | null; unit?: string; accent: string
  onFile: (file: File) => void; loaded: boolean; detail?: string
}

// ─── Helpers ─────────────────────────────────────────────
const nk = (k: string) => k.trim().toLowerCase().replace(/\s+/g, " ")

const parseSheet = (file: File): Promise<RowObject[]> =>
  new Promise(resolve => {
    const reader = new FileReader()
    reader.onload = evt => {
      const arrayBuffer = evt.target?.result
      if (!arrayBuffer) return resolve([])
      const wb = XLSX.read(arrayBuffer, { type: "array", cellDates: true, dateNF: "yyyy-mm-dd" })
      const rows = XLSX.utils.sheet_to_json<RowObject>(wb.Sheets[wb.SheetNames[0]], { defval: null })
      resolve(rows.map(row => {
        const obj: RowObject = {}
        Object.keys(row).forEach(k => { 
          const v = row[k] as any
          obj[nk(k)] = v instanceof Date ? v.toISOString().slice(0, 10) : v
        })
        return obj
      }))
    }
    reader.readAsArrayBuffer(file)
  })

const safeNum = (v: any): number | null => {
  if (v === null || v === undefined || v === "" || v === "#DIV/0!") return null
  const n = Number(v)
  return isNaN(n) ? null : n
}

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

// ─── LIKERT helpers ───────────────────────────────────────
const LIKERT: Record<string, number> = { "strongly agree": 5, "agree": 4, "neutral": 3, "disagree": 2, "strongly disagree": 1 }
const toLikert = (v: any): number | null => {
  if (typeof v === "number") return v
  const s = (v || "").toString().trim().toLowerCase()
  return LIKERT[s] ?? safeNum(v)
}

// ─── Components ──────────────────────────────────────────
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
            width: 42, height: 42, borderRadius: 12, background: `linear-gradient(135deg, ${accent}30, ${accent}10)`,
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 800, color: accent, letterSpacing: "0.5px"
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
              {unit && value !== null && <span style={{ fontSize: 14, fontWeight: 600, color: accent + "aa" }}>{unit}</span>}
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

// ─── OffboardingDashboard ─────────────────────────────────────
export default function OffboardingDashboard() {
  const [rehydrating, setRehydrating] = useState(true)
  const [uploading, setUploading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [metrics, setMetrics] = useState({
    eicr: { value: null as number | null, exits: 0, completed: 0, waived: 0, loaded: false },
    oes:  { value: null as number | null, responses: 0, itemScores: {} as Record<string, number>, loaded: false },
  })

  useEffect(() => {
    const run = async () => {
      setRehydrating(true)
      await Promise.all([fetchEicr(), fetchOes()])
      setRehydrating(false)
    }
    run()
  }, [])

  // ─── Fetchers ─────────────────────────────────────────────
  const fetchEicr = async () => {
    const { data } = await supabase.from("exit_interview_completion_rate").select("*")
    if (!data?.length) return
    const exits = data.reduce((s, r) => s + (r.total_employee_exits || 0), 0)
    const completed = data.reduce((s, r) => s + (r.completed_exit_interviews || 0), 0)
    const waived = data.reduce((s, r) => s + (r.waived_unreachable_cases || 0), 0)
    setMetrics(prev => ({ ...prev, eicr: { value: exits ? Number(((completed / exits) * 100).toFixed(1)) : 0, exits, completed, waived, loaded: true }}))
  }

  const fetchOes = async () => {
    const { data } = await supabase.from("offboarding_experience_score").select("*")
    if (!data?.length) return
    const qKeys = ["q1_respect", "q2_clarity", "q3_fairness", "q4_overall_experience"]
    let tFav = 0; let tItems = 0; const itemFav: Record<string, number> = {}
    qKeys.forEach(k => {
        let fav = 0; let n = 0
        data.forEach(r => {
            const s = toLikert(r[k])
            if (s !== null) { n++; if (s >= 4) fav++ }
        })
        itemFav[k.replace("q", "Q").replace("_", " ")] = n ? Number(((fav / n) * 100).toFixed(1)) : 0
        if (k !== "q4_overall_experience") { tFav += fav; tItems += n }
    })
    setMetrics(prev => ({ ...prev, oes: { value: tItems ? Number(((tFav / tItems) * 100).toFixed(1)) : 0, responses: data.length, itemScores: itemFav, loaded: true }}))
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
  const handleEicr = async (file: File) => {
    setUploading("eicr"); setError(null)
    try {
      const rows = await parseSheet(file)
      if (!rows.length) throw new Error("File is empty.")
      const batchId = await createBatch(file.name, "exit_interview_completion_rate", rows.length)
      const { error: insErr } = await supabase.from("exit_interview_completion_rate").insert(
        rows.map(r => ({
          batch_id: batchId,
          reporting_period: findVal(r, "period"),
          exit_type: findVal(r, "exit type"),
          delivery_unit: findVal(r, "delivery unit", "bu"),
          total_employee_exits: safeNum(findVal(r, "total", "exits")),
          completed_exit_interviews: safeNum(findVal(r, "completed")),
          waived_unreachable_cases: safeNum(findVal(r, "waived")),
        }))
      )
      if (insErr) throw insErr
      await fetchEicr()
    } catch (e: any) { setError(e.message) } finally { setUploading(null) }
  }

  const handleOes = async (file: File) => {
    setUploading("oes"); setError(null)
    try {
      const rows = await parseSheet(file)
      if (!rows.length) throw new Error("File is empty.")
      const batchId = await createBatch(file.name, "offboarding_experience_score", rows.length)
      const { error: insErr } = await supabase.from("offboarding_experience_score").insert(
        rows.map(r => ({
          batch_id: batchId,
          exit_date: findVal(r, "date"),
          exit_type: findVal(r, "type"),
          delivery_unit: findVal(r, "delivery unit", "bu"),
          tenure_band: findVal(r, "tenure band"),
          q1_respect: toLikert(findVal(r, "q1", "respect")),
          q2_clarity: toLikert(findVal(r, "q2", "clarity")),
          q3_fairness: toLikert(findVal(r, "q3", "fairness")),
          q4_overall_experience: toLikert(findVal(r, "q4", "overall")),
          open_comment: findVal(r, "comment"),
        }))
      )
      if (insErr) throw insErr
      await fetchOes()
    } catch (e: any) { setError(e.message) } finally { setUploading(null) }
  }

  const clearMetric = async (key: string) => {
    const tableMap: Record<string, string> = { eicr: "exit_interview_completion_rate", oes: "offboarding_experience_score" }
    const { data: batches } = await supabase.from("ex_batches").select("batch_id").eq("upload_type", tableMap[key])
    if (batches?.length) {
      const ids = batches.map(b => b.batch_id)
      await supabase.from(tableMap[key]).delete().in("batch_id", ids)
      await supabase.from("ex_batches").delete().in("batch_id", ids)
    }
    setMetrics(prev => ({ ...prev, [key]: { loaded: false, value: null, exits: 0, completed: 0, waived: 0, responses: 0, itemScores: {} } } as any))
  }

  const anyLoaded = metrics.eicr.loaded || metrics.oes.loaded

  const metricCards = [
    { key: "eicr", icon: "ECR", title: "Exit Interview Completion Rate", subtitle: "Eligible exits that completed an interview or survey", value: metrics.eicr.value, unit: "%", accent: "#6366f1", onFile: handleEicr, loaded: metrics.eicr.loaded, detail: "Completed ÷ Total Exits" },
    { key: "oes", icon: "OES", title: "Offboarding Experience Score", subtitle: "Favorable ratings on respect, clarity, and fairness", value: metrics.oes.value, unit: "%", accent: "#0ea5e9", onFile: handleOes, loaded: metrics.oes.loaded, detail: "Agree / Strongly Agree rate" },
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
        {metricCards.map(m => (
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
        {metricCards.map(({ key: _k, ...m }) => <MetricCard key={m.title} {...m} />)}
      </div>

      {anyLoaded && (
        <>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 14 }}>📊 Summary Snapshot</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {metrics.eicr.loaded && (
              <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 1px 3px rgba(0,0,0,.06), 0 4px 16px rgba(0,0,0,.06)", padding: "18px 22px", position: "relative" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#6366f1", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 10 }}>🚪 Exit Interview Completion Rate</div>
                <BenchmarkRow label="Completion Rate (EICR)" value={metrics.eicr.value ?? 0} target={100} accent="#6366f1" unit="%" />
                <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>{metrics.eicr.completed} of {metrics.eicr.exits} exits completed</div>
                <button onClick={() => clearMetric("eicr")} style={{ position: "absolute", top: 12, right: 12, background: "#ef4444", color: "#fff", border: "none", borderRadius: "50%", width: 18, height: 18, fontSize: 10, cursor: "pointer" }} title="Clear">×</button>
              </div>
            )}
            {metrics.oes.loaded && (
              <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 1px 3px rgba(0,0,0,.06), 0 4px 16px rgba(0,0,0,.06)", padding: "18px 22px", position: "relative" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#0ea5e9", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 10 }}>⭐ Offboarding Experience Score</div>
                <BenchmarkRow label="Overall OES" value={metrics.oes.value ?? 0} target={100} accent="#0ea5e9" unit="%" />
                <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>{metrics.oes.responses} survey responses</div>
                <button onClick={() => clearMetric("oes")} style={{ position: "absolute", top: 12, right: 12, background: "#ef4444", color: "#fff", border: "none", borderRadius: "50%", width: 18, height: 18, fontSize: 10, cursor: "pointer" }} title="Clear">×</button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}