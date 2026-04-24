"use client"

import { useState, useRef, useEffect, useMemo } from "react"
import * as XLSX from "xlsx"
import OBDashboard from "./onboarding/page"
import PerfDashboard from "./performance/page";
import EngDashboard from "./engagement/page";
import WellbeingDashboard from "./wellbeing/page";
import OffboardingDashboard from "./offboarding/page";

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

// ─── Lifecycle phases ─────────────────────────────────────
const PHASES = [
  {
    key: "hiring",
    label: "Hiring",
    icon: "🤝",
    description: "Candidate experience, offer outcomes, recruitment speed & early retention",
    active: true,
  },
  {
    key: "onboarding",
    label: "Onboarding",
    icon: "🚀",
    description: "New hire integration, ramp-up, and early engagement",
    active: true,
  },
  {
    key: "performance",
    label: "Performance & Manager Exp.",
    icon: "📈",
    description: "Performance reviews, manager effectiveness, and team health",
    active: true,
  },
  {
    key: "engagement",
    label: "Engagement and Retention",
    icon: "💎",
    description: "Employee sentiment, pulse surveys, and recognition",
    active: true,
  },
  {
    key: "wellbeing",
    label: "Wellbeing",
    icon: "🧘",
    description: "Voluntary attrition, burnout signals, and wellbeing programs",
    active: true,
  },
  {
    key: "offboarding",
    label: "Offboarding",
    icon: "🚪",
    description: "Exit survey insights, knowledge transfer, and alumni engagement",
    active: true,
  },
] as const

type PhaseKey = typeof PHASES[number]["key"]

// ─── helpers ─────────────────────────────────────────────
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
        border: `1.5px dashed ${drag ? "#6366f1" : loaded ? "#22c55e" : "#cbd5e1"}`,
        borderRadius: 10, padding: "12px 10px", cursor: "pointer",
        background: drag ? "#eef2ff" : loaded ? "#f0fdf4" : "#f8fafc",
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
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 14, color: "#0f172a", lineHeight: 1.2 }}>{title}</div>
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
              <span style={{ fontSize: 32, fontWeight: 800, color: accent, fontFamily: "'DM Sans', sans-serif", lineHeight: 1 }}>{value ?? "—"}</span>
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
function BenchmarkRow({ label, value, target, accent }: { label: string; value: number; target: number; accent: string }) {
  const pct = Math.min(100, Math.round((value / target) * 100))
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#475569", marginBottom: 4 }}>
        <span>{label}</span>
        <span style={{ fontWeight: 700, color: accent }}>{value}{label.includes("Days") || label.includes("days") ? " days" : "%"}</span>
      </div>
      <div style={{ height: 6, borderRadius: 4, background: "#f1f5f9", overflow: "hidden" }}>
        <div style={{ width: pct + "%", height: "100%", borderRadius: 4, background: accent, transition: "width .6s ease" }} />
      </div>
    </div>
  )
}

// ─── Coming Soon placeholder ──────────────────────────────
function ComingSoon({ phase }: { phase: typeof PHASES[number] }) {
  return (
    <div style={{
      maxWidth: 1100, margin: "0 auto",
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", padding: "80px 24px", textAlign: "center",
    }}>
      <div style={{
        width: 72, height: 72, borderRadius: 20,
        background: "linear-gradient(135deg, #f1f5f9, #e2e8f0)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 36, marginBottom: 20,
      }}>
        {phase.icon}
      </div>
      <div style={{ fontSize: 20, fontWeight: 800, color: "#0f172a", letterSpacing: "-.02em", marginBottom: 8 }}>
        {phase.label}
      </div>
      <div style={{ fontSize: 13, color: "#94a3b8", maxWidth: 360, lineHeight: 1.6, marginBottom: 20 }}>
        {phase.description}
      </div>
      <div style={{
        fontSize: 11, fontWeight: 700, color: "#94a3b8",
        background: "#f1f5f9", border: "1px solid #e2e8f0",
        borderRadius: 20, padding: "5px 16px", letterSpacing: ".05em", textTransform: "uppercase",
      }}>
        Coming in a future phase
      </div>
    </div>
  )
}

// ─── EXDashboard ──────────────────────────────────────────
export default function EXDashboard() {
  const [activePhase, setActivePhase] = useState<PhaseKey>("hiring")
  const [mounted, setMounted] = useState(false)
  const [rehydrating, setRehydrating] = useState(true)
  const [uploading, setUploading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  
  const [hiringMetrics, setHiringMetrics] = useState({
    ce:       { value: null as number | null, loaded: false, responses: 0 },
    oar:      { value: null as number | null, loaded: false },
    tth:      { value: null as number | null, loaded: false },
    turnover: { value: null as number | null, loaded: false, rate90: null as number | null },
  })

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!mounted) return
    const run = async () => {
      setRehydrating(true)
      await Promise.all([fetchCe(), fetchOar(), fetchTth(), fetchTur()])
      setRehydrating(false)
    }
    run()
  }, [mounted])

  // ─── Fetchers ─────────────────────────────────────────────
  const fetchCe = async () => {
    const { data, error } = await supabase.from("candidate_experience").select("q1_overall")
    if (error || !data?.length) return
    const avg = data.reduce((s, r) => s + (r.q1_overall || 0), 0) / data.length
    setHiringMetrics(p => ({ ...p, ce: { value: Number(avg.toFixed(1)), loaded: true, responses: data.length } }))
  }

  const fetchOar = async () => {
    const { data, error } = await supabase.from("offer_acceptance_rate").select("offers_extended, offers_accepted")
    if (error || !data?.length) return
    const ext = data.reduce((s, r) => s + (r.offers_extended || 0), 0)
    const acc = data.reduce((s, r) => s + (r.offers_accepted || 0), 0)
    setHiringMetrics(p => ({ ...p, oar: { value: ext ? Number(((acc / ext) * 100).toFixed(1)) : 0, loaded: true } }))
  }

  const fetchTth = async () => {
    const { data, error } = await supabase.from("time_to_hire").select("accepted_hires_count, total_calendar_days")
    if (error || !data?.length) return
    const hires = data.reduce((s, r) => s + (r.accepted_hires_count || 0), 0)
    const days  = data.reduce((s, r) => s + (r.total_calendar_days || 0), 0)
    setHiringMetrics(p => ({ ...p, tth: { value: hires ? Number((days / hires).toFixed(1)) : 0, loaded: true } }))
  }

  const fetchTur = async () => {
    const { data, error } = await supabase.from("new_hire_turnover").select("new_hires_count, left_within_12_months, left_within_90_days")
    if (error || !data?.length) return
    const hires = data.reduce((s, r) => s + (r.new_hires_count || 0), 0)
    const left12 = data.reduce((s, r) => s + (r.left_within_12_months || 0), 0)
    const left90 = data.reduce((s, r) => s + (r.left_within_90_days || 0), 0)
    setHiringMetrics(p => ({
      ...p,
      turnover: {
        value: hires ? Number(((left12 / hires) * 100).toFixed(1)) : 0,
        rate90: hires ? Number(((left90 / hires) * 100).toFixed(1)) : null,
        loaded: true
      }
    }))
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
  const handleCe = async (file: File) => {
    setUploading("ce"); setError(null)
    try {
      const rows = await parseSheet(file)
      if (!rows.length) throw new Error("File is empty.")
      const batchId = await createBatch(file.name, "candidate_experience", rows.length)
      const { error: insErr } = await supabase.from("candidate_experience").insert(
        rows.map(r => ({
          batch_id: batchId,
          response_date: r["response date"]?.toString() || null,
          outcome: r["outcome"]?.toString().toLowerCase() || null,
          q1_overall: safeNum(r["q1 overall (0-10)"]),
          q2_clarity: r["q2 clarity"]?.toString() || null,
          q3_timeliness: r["q3 timeliness"]?.toString() || null,
          q4_respect: r["q4 respect"]?.toString() || null,
          q5_role_understanding: r["q5 role understanding"]?.toString() || null,
          q6_inclusion: r["q6 inclusion"]?.toString() || null,
          q7_improvement: r["q7 improvement comment"]?.toString() || null,
        }))
      )
      if (insErr) throw insErr
      await fetchCe()
    } catch (e: any) { setError(e.message) } finally { setUploading(null) }
  }

  const handleOar = async (file: File) => {
    setUploading("oar"); setError(null)
    try {
      const rows = await parseSheet(file)
      if (!rows.length) throw new Error("File is empty.")
      const batchId = await createBatch(file.name, "offer_acceptance_rate", rows.length)
      const { error: insErr } = await supabase.from("offer_acceptance_rate").insert(
        rows.map(r => ({
          batch_id: batchId,
          reporting_period: r["reporting period"]?.toString() || null,
          offers_extended: safeNum(r["total number of offers extended"]),
          offers_accepted: safeNum(r["number of offers accepted"]),
          hiring_bu: r["hiring bu"]?.toString() || null,
          location: r["location"]?.toString() || null,
          job_family: r["job family"]?.toString() || null,
          job_level: r["level"]?.toString() || null,
        }))
      )
      if (insErr) throw insErr
      await fetchOar()
    } catch (e: any) { setError(e.message) } finally { setUploading(null) }
  }

  const handleTth = async (file: File) => {
    setUploading("tth"); setError(null)
    try {
      const rows = await parseSheet(file)
      if (!rows.length) throw new Error("File is empty.")
      const batchId = await createBatch(file.name, "time_to_hire", rows.length)
      const { error: insErr } = await supabase.from("time_to_hire").insert(
        rows.map(r => ({
          batch_id: batchId,
          reporting_period: r["reporting period"]?.toString() || null,
          accepted_hires_count: safeNum(r["accepted hires count"]),
          total_calendar_days: safeNum(r["total calendar days to hire"]),
        }))
      )
      if (insErr) throw insErr
      await fetchTth()
    } catch (e: any) { setError(e.message) } finally { setUploading(null) }
  }

  const handleTur = async (file: File) => {
    setUploading("turnover"); setError(null)
    try {
      const rows = await parseSheet(file)
      if (!rows.length) throw new Error("File is empty.")
      const batchId = await createBatch(file.name, "new_hire_turnover", rows.length)
      const cohortKey = Object.keys(rows[0]).find(k => k.startsWith("new hires in cohort") || k.includes("total number of new hires")) ?? "new hires in cohort"
      const { error: insErr } = await supabase.from("new_hire_turnover").insert(
        rows.map(r => ({
          batch_id: batchId,
          hire_cohort: r["hire cohort"]?.toString() || null,
          new_hires_count: safeNum(r[cohortKey]),
          left_within_12_months: safeNum(r["number of new hires who left within 12 months"]),
          left_within_90_days: safeNum(r["number of new hires who left within 90 days"]),
        }))
      )
      if (insErr) throw insErr
      await fetchTur()
    } catch (e: any) { setError(e.message) } finally { setUploading(null) }
  }

  const clearMetric = async (key: string) => {
    const tableMap: Record<string, string> = { ce: "candidate_experience", oar: "offer_acceptance_rate", tth: "time_to_hire", turnover: "new_hire_turnover" }
    const typeMap: Record<string, string> = { ce: "candidate_experience", oar: "offer_acceptance_rate", tth: "time_to_hire", turnover: "new_hire_turnover" }
    
    // Cascading delete via ex_batches
    const { data: batches } = await supabase.from("ex_batches").select("batch_id").eq("upload_type", typeMap[key])
    if (batches?.length) {
      const ids = batches.map(b => b.batch_id)
      await supabase.from(tableMap[key]).delete().in("batch_id", ids)
      await supabase.from("ex_batches").delete().in("batch_id", ids)
    }

    setHiringMetrics(p => ({ ...p, [key]: { value: null, loaded: false, responses: 0, rate90: null } }))
  }

  const anyLoaded = Object.values(hiringMetrics).some(m => m.loaded)

  const cards = [
    { icon: "CE", title: "Candidate Experience",  subtitle: "Avg. Candidate Experience", value: hiringMetrics.ce.value,       unit: hiringMetrics.ce.value != null ? "/ 10" : "",  accent: "#6366f1", onFile: handleCe,  loaded: hiringMetrics.ce.loaded,       detail: "Survey-based\naverage score", key: "ce" },
    { icon: "OAR", title: "Offer Acceptance Rate", subtitle: "Percentage of Accepted Offers",   value: hiringMetrics.oar.value,      unit: hiringMetrics.oar.value != null ? "%" : "",    accent: "#10b981", onFile: handleOar, loaded: hiringMetrics.oar.loaded,      detail: "Target ≥ 80%",               key: "oar" },
    { icon: "TTH", title: "Time to Hire",           subtitle: "Application → Offer Accept",   value: hiringMetrics.tth.value,      unit: hiringMetrics.tth.value != null ? "days" : "", accent: "#3b82f6", onFile: handleTth, loaded: hiringMetrics.tth.loaded,      detail: "Lower is better",            key: "tth" },
    { icon: "NHT", title: "New Hire Turnover",      subtitle: "Exits within 12 months",       value: hiringMetrics.turnover.value, unit: hiringMetrics.turnover.value != null ? "%" : "", accent: "#ec4899", onFile: handleTur, loaded: hiringMetrics.turnover.loaded, detail: "Lower is better",            key: "turnover" },
  ]
  
  if (!mounted) return null

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(160deg, #f8fafc 0%, #f1f5f9 100%)", fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap'); @keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}`}</style>

      {/* ── Top header ── */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e2e8f0", padding: "0 24px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, paddingTop: 24, paddingBottom: 16 }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: "linear-gradient(135deg, #6366f1, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, boxShadow: "0 4px 14px #6366f140", flexShrink: 0 }}>🧑‍💼</div>
            <div style={{ flex: 1 }}>
              <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#0f172a", letterSpacing: "-.02em" }}>Employee Experience</h1>
              <p style={{ margin: 0, fontSize: 12, color: "#94a3b8", marginTop: 2 }}>Talent IQ · {rehydrating ? "Syncing..." : "Cloud Connected"}</p>
            </div>
            {rehydrating && <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#6366f1", animation: "pulse 1s infinite" }} />}
          </div>

          <div style={{ display: "flex", gap: 0, overflowX: "auto", marginBottom: -1 }}>
            {PHASES.map((phase) => {
              const isActive = activePhase === phase.key
              return (
                <button key={phase.key} onClick={() => setActivePhase(phase.key as PhaseKey)}
                  style={{
                    display: "flex", alignItems: "center", gap: 7, padding: "12px 20px", background: "transparent", border: "none",
                    borderBottom: isActive ? "2px solid #6366f1" : "2px solid transparent", cursor: "pointer",
                    color: isActive ? "#6366f1" : "#64748b", fontSize: 13, fontWeight: isActive ? 700 : 500, fontFamily: "'DM Sans', sans-serif",
                    whiteSpace: "nowrap", transition: "all .18s", position: "relative",
                  }}
                >
                  <span style={{ fontSize: 15 }}>{phase.icon}</span>
                  {phase.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div style={{ padding: "36px 24px 60px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          
          {error && (
            <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 10, padding: "10px 14px", fontSize: 12, color: "#dc2626", marginBottom: 16, display: "flex", justifyContent: "space-between" }}>
              <span>⚠ {error}</span>
              <button onClick={() => setError(null)} style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", fontWeight: 700 }}>×</button>
            </div>
          )}

          {activePhase === "hiring" ? (
            <>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 28 }}>
                {cards.map(m => (
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
                {cards.map(({ key: _k, ...m }) => <MetricCard key={m.title} {...m} />)}
              </div>

              {anyLoaded && (
                <>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 14 }}>📊 Summary Snapshot</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {hiringMetrics.ce.loaded && (
                      <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 1px 3px rgba(0,0,0,.06), 0 4px 16px rgba(0,0,0,.06)", padding: "18px 22px", position: "relative" }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#6366f1", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 10 }}> Candidate Experience</div>
                        <BenchmarkRow label="Candidate Experience Score" value={hiringMetrics.ce.value ?? 0} target={10} accent="#6366f1" />
                        <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>{hiringMetrics.ce.responses} responses</div>
                        <button onClick={() => clearMetric("ce")} style={{ position: "absolute", top: 12, right: 12, background: "#ef4444", color: "#fff", border: "none", borderRadius: "50%", width: 18, height: 18, fontSize: 10, cursor: "pointer" }}>×</button>
                      </div>
                    )}
                    {hiringMetrics.oar.loaded && (
                      <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 1px 3px rgba(0,0,0,.06), 0 4px 16px rgba(0,0,0,.06)", padding: "18px 22px", position: "relative" }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#10b981", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 10 }}> Offer Acceptance Rate</div>
                        <BenchmarkRow label="Offer Acceptance Rate (%)" value={hiringMetrics.oar.value ?? 0} target={100} accent="#10b981" />
                        <button onClick={() => clearMetric("oar")} style={{ position: "absolute", top: 12, right: 12, background: "#ef4444", color: "#fff", border: "none", borderRadius: "50%", width: 18, height: 18, fontSize: 10, cursor: "pointer" }}>×</button>
                      </div>
                    )}
                    {hiringMetrics.tth.loaded && (
                      <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 1px 3px rgba(0,0,0,.06), 0 4px 16px rgba(0,0,0,.06)", padding: "18px 22px", position: "relative" }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#3b82f6", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 10 }}> Time to Hire</div>
                        <BenchmarkRow label="Avg. Days to Hire" value={hiringMetrics.tth.value ?? 0} target={60} accent="#3b82f6" />
                        <button onClick={() => clearMetric("tth")} style={{ position: "absolute", top: 12, right: 12, background: "#ef4444", color: "#fff", border: "none", borderRadius: "50%", width: 18, height: 18, fontSize: 10, cursor: "pointer" }}>×</button>
                      </div>
                    )}
                    {hiringMetrics.turnover.loaded && (
                      <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 1px 3px rgba(0,0,0,.06), 0 4px 16px rgba(0,0,0,.06)", padding: "18px 22px", position: "relative" }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#ec4899", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 10 }}> New Hire Turnover</div>
                        <BenchmarkRow label="12-Month Turnover (%)" value={hiringMetrics.turnover.value ?? 0} target={30} accent="#ec4899" />
                        {hiringMetrics.turnover.rate90 != null && <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>90-Day Rate: {hiringMetrics.turnover.rate90}%</div>}
                        <button onClick={() => clearMetric("turnover")} style={{ position: "absolute", top: 12, right: 12, background: "#ef4444", color: "#fff", border: "none", borderRadius: "50%", width: 18, height: 18, fontSize: 10, cursor: "pointer" }}>×</button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </>
          ) : activePhase === "onboarding" ? <OBDashboard /> :
              activePhase === "performance" ? <PerfDashboard /> :
              activePhase === "engagement" ? <EngDashboard /> :
              activePhase === "wellbeing" ? <WellbeingDashboard /> :
              activePhase === "offboarding" ? <OffboardingDashboard /> :
              <ComingSoon phase={PHASES.find(p => p.key === activePhase)!} />
          }
        </div>
      </div>
    </div>
  )
}