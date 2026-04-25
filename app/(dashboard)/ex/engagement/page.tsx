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
const isAgree = (v: any): boolean => ["strongly agree", "agree"].includes((v || "").toString().trim().toLowerCase())

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

// ─── EngRetDashboard ─────────────────────────────────────
export default function EngRetDashboard() {
  const [rehydrating, setRehydrating] = useState(true)
  const [uploading, setUploading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [metrics, setMetrics] = useState({
    ei:   { engagementIndex: null as number | null, eNPS: null as number | null, responses: 0, promoters: 0, passives: 0, detractors: 0, loaded: false },
    vtr:  { rate: null as number | null, separations: 0, headcount: 0, loaded: false },
    err:  { rate: null as number | null, startCount: 0, retained: 0, loaded: false },
    its:  { rate: null as number | null, responses: 0, loaded: false },
    ner:  { referralCount: 0, referralRate: null as number | null, participants: 0, activeEmployees: 0, loaded: false },
  })

  useEffect(() => {
    const run = async () => {
      setRehydrating(true)
      await Promise.all([fetchEi(), fetchVtr(), fetchErr(), fetchIts(), fetchNer()])
      setRehydrating(false)
    }
    run()
  }, [])

  // ─── Fetchers ─────────────────────────────────────────────
  const fetchEi = async () => {
    const { data } = await supabase.from("engagement_index_enps").select("*")
    if (!data?.length) return
    const engQKeys = ["q1_purpose", "q2_enablement", "q3_commitment", "q4_growth", "q5_belonging"]
    let tScore = 0; let tItems = 0; let p = 0; let pa = 0; let d = 0; let npsResp = 0
    data.forEach(r => {
      engQKeys.forEach(k => { const s = toLikert(r[k]); if (s !== null) { tScore += s; tItems++ } })
      const nps = safeNum(r.q6_enps)
      if (nps !== null) { npsResp++; if (nps >= 9) p++; else if (nps >= 7) pa++; else d++ }
    })
    const avg = tItems ? tScore / tItems : 0
    setMetrics(prev => ({ ...prev, ei: {
      engagementIndex: tItems ? Number(((avg - 1) / 4 * 100).toFixed(1)) : null,
      eNPS: npsResp ? Number(((p - d) / npsResp * 100).toFixed(1)) : null,
      responses: data.length, promoters: p, passives: pa, detractors: d, loaded: true
    }}))
  }

  const fetchVtr = async () => {
    const { data } = await supabase.from("voluntary_turnover_rate").select("*")
    if (!data?.length) return
    const h = data.reduce((s, r) => s + (r.average_headcount || 0), 0)
    const sep = data.reduce((s, r) => s + (r.voluntary_separations || 0), 0)
    setMetrics(prev => ({ ...prev, vtr: { rate: h ? Number(((sep / h) * 100).toFixed(2)) : 0, separations: sep, headcount: h, loaded: true }}))
  }

  const fetchErr = async () => {
    const { data } = await supabase.from("employee_retention_rate").select("*")
    if (!data?.length) return
    const st = data.reduce((s, r) => s + (r.employees_at_start || 0), 0)
    const en = data.reduce((s, r) => s + (r.employees_at_end || 0), 0)
    const nh = data.reduce((s, r) => s + (r.new_hires || 0), 0)
    const ret = en - nh
    setMetrics(prev => ({ ...prev, err: { rate: st ? Number(((ret / st) * 100).toFixed(2)) : 0, startCount: st, retained: ret, loaded: true }}))
  }

  const fetchIts = async () => {
    const { data } = await supabase.from("intent_to_stay").select("*")
    if (!data?.length) return
    const fav = data.filter(r => isAgree(r.q1_intent_to_stay)).length
    setMetrics(prev => ({ ...prev, its: { rate: data.length ? Number(((fav / data.length) * 100).toFixed(1)) : 0, responses: data.length, loaded: true }}))
  }

  const fetchNer = async () => {
    const { data } = await supabase.from("employee_referrals").select("*")
    if (!data?.length) return
    const ref = data.reduce((s, r) => s + (r.referral_count || 0), 0)
    const part = data.reduce((s, r) => s + (r.participating_employees || 0), 0)
    const act = data.reduce((s, r) => s + (r.total_active_employees || 0), 0)
    setMetrics(prev => ({ ...prev, ner: { referralCount: ref, referralRate: act ? Number(((part / act) * 100).toFixed(2)) : 0, participants: part, activeEmployees: act, loaded: true }}))
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
  const handleEi = async (file: File) => {
    setUploading("ei"); setError(null)
    try {
      const rows = await parseSheet(file)
      if (!rows.length) throw new Error("File is empty.")
      const batchId = await createBatch(file.name, "engagement_index_enps", rows.length)
      const { error: insErr } = await supabase.from("engagement_index_enps").insert(
        rows.map(r => ({
          batch_id: batchId,
          survey_period: findVal(r, "period"),
          function: findVal(r, "function"),
          role_level: findVal(r, "role level", "level"),
          location: findVal(r, "location"),
          tenure_band: findVal(r, "tenure band"),
          q1_purpose: toLikert(findVal(r, "q1", "purpose")),
          q2_enablement: toLikert(findVal(r, "q2", "enablement")),
          q3_commitment: toLikert(findVal(r, "q3", "commitment")),
          q4_growth: toLikert(findVal(r, "q4", "growth")),
          q5_belonging: toLikert(findVal(r, "q5", "belonging")),
          q6_enps: safeNum(findVal(r, "q6", "enps")),
          improvement_comment: findVal(r, "q7", "comment"),
        }))
      )
      if (insErr) throw insErr
      await fetchEi()
    } catch (e: any) { setError(e.message) } finally { setUploading(null) }
  }

  const handleVtr = async (file: File) => {
    setUploading("vtr"); setError(null)
    try {
      const rows = await parseSheet(file)
      if (!rows.length) throw new Error("File is empty.")
      const batchId = await createBatch(file.name, "voluntary_turnover_rate", rows.length)
      const { error: insErr } = await supabase.from("voluntary_turnover_rate").insert(
        rows.map(r => ({
          batch_id: batchId,
          reporting_period: findVal(r, "period"),
          delivery_unit: findVal(r, "delivery unit", "bu"),
          job_family: findVal(r, "job family"),
          tenure_band: findVal(r, "tenure band"),
          average_headcount: safeNum(findVal(r, "headcount")),
          voluntary_separations: safeNum(findVal(r, "separations")),
        }))
      )
      if (insErr) throw insErr
      await fetchVtr()
    } catch (e: any) { setError(e.message) } finally { setUploading(null) }
  }

  const handleErr = async (file: File) => {
    setUploading("err"); setError(null)
    try {
      const rows = await parseSheet(file)
      if (!rows.length) throw new Error("File is empty.")
      const batchId = await createBatch(file.name, "employee_retention_rate", rows.length)
      const { error: insErr } = await supabase.from("employee_retention_rate").insert(
        rows.map(r => ({
          batch_id: batchId,
          reporting_period: findVal(r, "period"),
          delivery_unit: findVal(r, "delivery unit", "bu"),
          employees_at_start: safeNum(findVal(r, "start")),
          employees_at_end: safeNum(findVal(r, "end")),
          new_hires: safeNum(findVal(r, "new hires")),
        }))
      )
      if (insErr) throw insErr
      await fetchErr()
    } catch (e: any) { setError(e.message) } finally { setUploading(null) }
  }

  const handleIts = async (file: File) => {
    setUploading("its"); setError(null)
    try {
      const rows = await parseSheet(file)
      if (!rows.length) throw new Error("File is empty.")
      const batchId = await createBatch(file.name, "intent_to_stay", rows.length)
      const { error: insErr } = await supabase.from("intent_to_stay").insert(
        rows.map(r => ({
          batch_id: batchId,
          survey_period: findVal(r, "period"),
          function: findVal(r, "function"),
          role_level: findVal(r, "role level", "level"),
          location: findVal(r, "location"),
          tenure_band: findVal(r, "tenure band"),
          q1_intent_to_stay: findVal(r, "q1", "intent to stay"),
          q2_prefer_to_continue: findVal(r, "q2", "continue"),
          response_date: findVal(r, "date"),
        }))
      )
      if (insErr) throw insErr
      await fetchIts()
    } catch (e: any) { setError(e.message) } finally { setUploading(null) }
  }

  const handleNer = async (file: File) => {
    setUploading("ner"); setError(null)
    try {
      const rows = await parseSheet(file)
      if (!rows.length) throw new Error("File is empty.")
      const batchId = await createBatch(file.name, "employee_referrals", rows.length)
      const { error: insErr } = await supabase.from("employee_referrals").insert(
        rows.map(r => ({
          batch_id: batchId,
          reporting_period: findVal(r, "period"),
          delivery_unit: findVal(r, "delivery unit", "bu"),
          location: findVal(r, "location"),
          referral_count: safeNum(findVal(r, "referrals")),
          participating_employees: safeNum(findVal(r, "participants", "made at least one")),
          total_active_employees: safeNum(findVal(r, "active employees")),
        }))
      )
      if (insErr) throw insErr
      await fetchNer()
    } catch (e: any) { setError(e.message) } finally { setUploading(null) }
  }

  const clearMetric = async (key: string) => {
    const tableMap: Record<string, string> = { ei: "engagement_index_enps", vtr: "voluntary_turnover_rate", err: "employee_retention_rate", its: "intent_to_stay", ner: "employee_referrals" }
    const { data: batches } = await supabase.from("ex_batches").select("batch_id").eq("upload_type", tableMap[key])
    if (batches?.length) {
      const ids = batches.map(b => b.batch_id)
      await supabase.from(tableMap[key]).delete().in("batch_id", ids)
      await supabase.from("ex_batches").delete().in("batch_id", ids)
    }
    setMetrics(prev => ({ ...prev, [key]: { loaded: false, value: null, responses: 0, promoters: 0, passives: 0, detractors: 0, rate: null, separations: 0, headcount: 0, startCount: 0, retained: 0, referralCount: 0, referralRate: null, participants: 0, activeEmployees: 0 } } as any))
  }

  const anyLoaded = metrics.ei.loaded || metrics.vtr.loaded || metrics.err.loaded || metrics.its.loaded || metrics.ner.loaded

  const metricCards = [
    { key: "ei", icon: "EI", title: "Engagement Index / eNPS", subtitle: "Quarterly pulse · Q1–Q5 favorability + advocacy", value: metrics.ei.engagementIndex, unit: "%", accent: "#6366f1", onFile: handleEi, loaded: metrics.ei.loaded, detail: "Engagement favorability" },
    { key: "vtr", icon: "VTR", title: "Voluntary Turnover Rate", subtitle: "Employee-initiated separations during period", value: metrics.vtr.rate, unit: "%", accent: "#ef4444", onFile: handleVtr, loaded: metrics.vtr.loaded, detail: "Lower is better" },
    { key: "err", icon: "ERR", title: "Employee Retention Rate", subtitle: "Start-cohort employees retained through period end", value: metrics.err.rate, unit: "%", accent: "#10b981", onFile: handleErr, loaded: metrics.err.loaded, detail: "Higher is better" },
    { key: "its", icon: "IS", title: "Intent to Stay", subtitle: "Leading retention signal · favorable Q1 responses", value: metrics.its.rate, unit: "%", accent: "#8b5cf6", onFile: handleIts, loaded: metrics.its.loaded, detail: "Agree + Strongly Agree" },
    { key: "ner", icon: "ER", title: "Employee Referrals", subtitle: "Candidates referred by current employees", value: metrics.ner.referralCount || null, unit: " referrals", accent: "#f59e0b", onFile: handleNer, loaded: metrics.ner.loaded, detail: "Employee advocacy count" },
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
            {metrics.ei.loaded && (
              <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 1px 3px rgba(0,0,0,.06), 0 4px 16px rgba(0,0,0,.06)", padding: "18px 22px", position: "relative" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#6366f1", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 10 }}> Engagement Index / eNPS</div>
                <BenchmarkRow label="Engagement Index (Favorability)" value={metrics.ei.engagementIndex ?? 0} target={100} accent="#6366f1" unit="%" />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#475569", marginBottom: 12 }}>
                  <span>eNPS Score</span>
                  <span style={{ fontWeight: 700, color: (metrics.ei.eNPS ?? 0) >= 0 ? "#6366f1" : "#ef4444" }}>{metrics.ei.eNPS ?? "—"}</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 10 }}>
                  {[
                    { label: "Promoters (9–10)", val: metrics.ei.promoters, color: "#10b981" },
                    { label: "Passives (7–8)", val: metrics.ei.passives, color: "#f59e0b" },
                    { label: "Detractors (0–6)", val: metrics.ei.detractors, color: "#ef4444" },
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
            {metrics.vtr.loaded && (
              <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 1px 3px rgba(0,0,0,.06), 0 4px 16px rgba(0,0,0,.06)", padding: "18px 22px", position: "relative" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#ef4444", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 10 }}> Voluntary Turnover Rate</div>
                <BenchmarkRow label="Voluntary Turnover Rate" value={metrics.vtr.rate ?? 0} target={20} accent="#ef4444" unit="%" />
                <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>{metrics.vtr.separations} voluntary separations from an avg headcount of {metrics.vtr.headcount.toLocaleString()}</div>
                <button onClick={() => clearMetric("vtr")} style={{ position: "absolute", top: 12, right: 12, background: "#ef4444", color: "#fff", border: "none", borderRadius: "50%", width: 18, height: 18, fontSize: 10, cursor: "pointer" }} title="Clear">×</button>
              </div>
            )}
            {metrics.err.loaded && (
              <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 1px 3px rgba(0,0,0,.06), 0 4px 16px rgba(0,0,0,.06)", padding: "18px 22px", position: "relative" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#10b981", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 10 }}>Employee Retention Rate</div>
                <BenchmarkRow label="Retention Rate" value={metrics.err.rate ?? 0} target={100} accent="#10b981" unit="%" />
                <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>{metrics.err.retained} of {metrics.err.startCount} employees retained</div>
                <button onClick={() => clearMetric("err")} style={{ position: "absolute", top: 12, right: 12, background: "#ef4444", color: "#fff", border: "none", borderRadius: "50%", width: 18, height: 18, fontSize: 10, cursor: "pointer" }} title="Clear">×</button>
              </div>
            )}
            {metrics.its.loaded && (
              <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 1px 3px rgba(0,0,0,.06), 0 4px 16px rgba(0,0,0,.06)", padding: "18px 22px", position: "relative" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#8b5cf6", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 10 }}>🔮 Intent to Stay</div>
                <BenchmarkRow label="Intent to Stay Rate" value={metrics.its.rate ?? 0} target={100} accent="#8b5cf6" unit="%" />
                <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>{metrics.its.responses} pulse survey responses</div>
                <button onClick={() => clearMetric("its")} style={{ position: "absolute", top: 12, right: 12, background: "#ef4444", color: "#fff", border: "none", borderRadius: "50%", width: 18, height: 18, fontSize: 10, cursor: "pointer" }} title="Clear">×</button>
              </div>
            )}
            {metrics.ner.loaded && (
              <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 1px 3px rgba(0,0,0,.06), 0 4px 16px rgba(0,0,0,.06)", padding: "18px 22px", position: "relative" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#f59e0b", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 10 }}> Employee Referrals</div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#475569", marginBottom: 12 }}>
                  <span>Total Referrals</span>
                  <span style={{ fontWeight: 700, color: "#f59e0b" }}>{metrics.ner.referralCount}</span>
                </div>
                <BenchmarkRow label="Referral Rate" value={metrics.ner.referralRate ?? 0} target={20} accent="#f59e0b" unit="%" />
                <button onClick={() => clearMetric("ner")} style={{ position: "absolute", top: 12, right: 12, background: "#ef4444", color: "#fff", border: "none", borderRadius: "50%", width: 18, height: 18, fontSize: 10, cursor: "pointer" }} title="Clear">×</button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}