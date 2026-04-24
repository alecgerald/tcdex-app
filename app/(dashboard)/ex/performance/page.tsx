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

// ─── PerfDashboard ─────────────────────────────────────────
export default function PerfDashboard() {
  const [rehydrating, setRehydrating] = useState(true)
  const [uploading, setUploading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [perfMetrics, setPerfMetrics] = useState({
    mei:  { value: null as number | null, responses: 0, favorability: null as number | null, loaded: false },
    epii: { value: null as number | null, reviewed: 0, improved: 0, loaded: false },
  })

  useEffect(() => {
    const run = async () => {
      setRehydrating(true)
      await Promise.all([fetchMei(), fetchEpii()])
      setRehydrating(false)
    }
    run()
  }, [])

  // ─── Fetchers ─────────────────────────────────────────────
  const fetchMei = async () => {
    const { data } = await supabase.from("manager_effectiveness_index").select("*")
    if (!data?.length) return
    const qKeys = ["q1_clarity", "q2_support", "q3_fairness", "q4_feedback", "q5_psychological_safety", "q6_inclusion"]
    let totalScore = 0; let totalItems = 0
    data.forEach(r => {
        qKeys.forEach(k => {
            const score = toLikert(r[k])
            if (score !== null) { totalScore += score; totalItems++ }
        })
    })
    const avgLikert = totalItems ? totalScore / totalItems : 0
    const favorability = totalItems ? Number(((avgLikert - 1) / 4 * 100).toFixed(1)) : null
    setPerfMetrics(p => ({ ...p, mei: { value: favorability, responses: data.length, favorability, loaded: true } }))
  }

  const fetchEpii = async () => {
    const { data } = await supabase.from("performance_improvement_rate").select("*")
    if (!data?.length) return
    const reviewed = data.reduce((s, r) => s + (r.employees_reviewed || 0), 0)
    const improved = data.reduce((s, r) => s + (r.employees_improved || 0), 0)
    setPerfMetrics(p => ({ ...p, epii: { value: reviewed ? Number(((improved / reviewed) * 100).toFixed(1)) : 0, reviewed, improved, loaded: true } }))
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
  const handleMei = async (file: File) => {
    setUploading("mei"); setError(null)
    try {
      const rows = await parseSheet(file)
      if (!rows.length) throw new Error("File is empty.")
      const batchId = await createBatch(file.name, "manager_effectiveness_index", rows.length)
      const { error: insErr } = await supabase.from("manager_effectiveness_index").insert(
        rows.map(r => ({
          batch_id: batchId,
          survey_date: findVal(r, "date"),
          function: findVal(r, "function"),
          role_level: findVal(r, "role level", "level"),
          location: findVal(r, "location"),
          manager_tenure: findVal(r, "manager tenure"),
          q1_clarity: toLikert(findVal(r, "q1", "clarity")),
          q2_support: toLikert(findVal(r, "q2", "support")),
          q3_fairness: toLikert(findVal(r, "q3", "fairness")),
          q4_feedback: toLikert(findVal(r, "q4", "feedback")),
          q5_psychological_safety: toLikert(findVal(r, "q5", "psychological")),
          q6_inclusion: toLikert(findVal(r, "q6", "inclusion")),
          improvement_comment: findVal(r, "q7", "comment"),
        }))
      )
      if (insErr) throw insErr
      await fetchMei()
    } catch (e: any) { setError(e.message) } finally { setUploading(null) }
  }

  const handleEpii = async (file: File) => {
    setUploading("epii"); setError(null)
    try {
      const rows = await parseSheet(file)
      if (!rows.length) throw new Error("File is empty.")
      const batchId = await createBatch(file.name, "performance_improvement_rate", rows.length)
      const { error: insErr } = await supabase.from("performance_improvement_rate").insert(
        rows.map(r => ({
          batch_id: batchId,
          review_cycle: findVal(r, "review cycle", "cycle"),
          delivery_unit: findVal(r, "delivery unit", "bu"),
          job_family: findVal(r, "job family"),
          employees_reviewed: safeNum(findVal(r, "reviewed")),
          employees_improved: safeNum(findVal(r, "improved")),
          linked_training: findVal(r, "training", "intervention"),
        }))
      )
      if (insErr) throw insErr
      await fetchEpii()
    } catch (e: any) { setError(e.message) } finally { setUploading(null) }
  }

  const clearMetric = async (key: string) => {
    const tableMap: Record<string, string> = { mei: "manager_effectiveness_index", epii: "performance_improvement_rate" }
    const { data: batches } = await supabase.from("ex_batches").select("batch_id").eq("upload_type", tableMap[key])
    if (batches?.length) {
      const ids = batches.map(b => b.batch_id)
      await supabase.from(tableMap[key]).delete().in("batch_id", ids)
      await supabase.from("ex_batches").delete().in("batch_id", ids)
    }
    setPerfMetrics(p => ({ ...p, [key]: { loaded: false, value: null, responses: 0, favorability: null, reviewed: 0, improved: 0 } } as any))
  }

  const anyLoaded = perfMetrics.mei.loaded || perfMetrics.epii.loaded

  const perfMetricCards = [
    { key: "mei", icon: "MEI", title: "Manager Effectiveness Index", subtitle: "Aggregate favorability across 6 dimensions", value: perfMetrics.mei.value, unit: "%", accent: "#f59e0b", onFile: handleMei, loaded: perfMetrics.mei.loaded, detail: "Survey-based favorability" },
    { key: "epii", icon: "PIR", title: "Performance Improvement Rate", subtitle: "Employees showing improvement across cycles", value: perfMetrics.epii.value, unit: "%", accent: "#10b981", onFile: handleEpii, loaded: perfMetrics.epii.loaded, detail: "Improved ÷ Reviewed" },
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
        {perfMetricCards.map(m => (
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
        {perfMetricCards.map(({ key: _k, ...m }) => <MetricCard key={m.title} {...m} />)}
      </div>

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
                <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>{perfMetrics.epii.improved} of {perfMetrics.epii.reviewed} employees showed improvement</div>
                <button onClick={() => clearMetric("epii")} style={{ position: "absolute", top: 12, right: 12, background: "#ef4444", color: "#fff", border: "none", borderRadius: "50%", width: 18, height: 18, fontSize: 10, cursor: "pointer" }} title="Clear">×</button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}