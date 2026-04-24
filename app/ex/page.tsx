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

// ─── Lifecycle phases ─────────────────────────────────────
const PHASES = [
  { key: "hiring",      label: "Hiring",                   icon: "", description: "Candidate experience, offer outcomes, recruitment speed & early retention", active: true },
  { key: "onboarding",  label: "Onboarding",               icon: "", description: "New hire integration, ramp-up, and early engagement",                       active: true },
  { key: "performance", label: "Performance & Manager Exp.", icon: "", description: "Performance reviews, manager effectiveness, and team health",               active: true },
  { key: "engagement",  label: "Engagement and Retention", icon: "", description: "Employee sentiment, pulse surveys, and recognition",                         active: true },
  { key: "wellbeing",   label: "Wellbeing",                icon: "", description: "Voluntary attrition, burnout signals, and wellbeing programs",                active: true },
  { key: "offboarding", label: "Offboarding",              icon: "", description: "Exit survey insights, knowledge transfer, and alumni engagement",             active: true },
] as const

type PhaseKey = typeof PHASES[number]["key"]

// ─── Default metrics state ────────────────────────────────
const defaultMetrics = {
  ce:       { value: null as number | null, loaded: false, responses: 0 },
  oar:      { value: null as number | null, loaded: false },
  tth:      { value: null as number | null, loaded: false },
  turnover: { value: null as number | null, loaded: false, rate90: null as number | null },
}

// ─── helpers ─────────────────────────────────────────────
const normalizeKey = (k: string) => k.trim().toLowerCase()

const parseSheet = (file: File): Promise<RowObject[]> =>
  new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (evt) => {
      const arrayBuffer = evt.target?.result
      if (!arrayBuffer) return resolve([])
      const wb = XLSX.read(arrayBuffer, { type: "array" })
      const rows = XLSX.utils.sheet_to_json<RowObject>(wb.Sheets[wb.SheetNames[0]])
      const norm = rows.map((row) => {
        const obj: RowObject = {}
        Object.keys(row).forEach((k) => { obj[normalizeKey(k)] = row[k] })
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
            width: 42, height: 42, borderRadius: 12,
            background: `linear-gradient(135deg, ${accent}30, ${accent}10)`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 16, fontWeight: 800, color: accent, letterSpacing: "0.5px"
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
function BenchmarkRow({ label, value, target, accent }: { label: string; value: number; target: number; accent: string }) {
  const pct = Math.min(100, Math.round((value / target) * 100))
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#475569", marginBottom: 4 }}>
        <span>{label}</span>
        <span style={{ fontWeight: 700, color: accent }}>{value}{label.includes("Days") ? " days" : "%"}</span>
      </div>
      <div style={{ height: 6, borderRadius: 4, background: "#f1f5f9", overflow: "hidden" }}>
        <div style={{ width: pct + "%", height: "100%", borderRadius: 4, background: accent, transition: "width .6s ease" }} />
      </div>
    </div>
  )
}

// ─── ComingSoon ───────────────────────────────────────────
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
      <div style={{ fontSize: 20, fontWeight: 800, color: "#0f172a", letterSpacing: "-.02em", marginBottom: 8 }}>{phase.label}</div>
      <div style={{ fontSize: 13, color: "#94a3b8", maxWidth: 360, lineHeight: 1.6, marginBottom: 20 }}>{phase.description}</div>
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
  const [activePhase, setActivePhase]   = useState<PhaseKey>("hiring")
  const [uploadOrder, setUploadOrder]   = useState<string[]>([])
  const [mounted, setMounted]           = useState(false)
  const [rehydrating, setRehydrating]   = useState(true)
  const [currentUser, setCurrentUser]   = useState<string>("system")
  const [ceRows, setCeRows]             = useState<any[]>([])
  const [metricsData, setMetricsData]   = useState(defaultMetrics)

  // ─── Step 4: Resolve real auth user on mount ──────────────
  useEffect(() => {
    const resolveUser = async () => {
      const { data } = await supabase.auth.getUser()
      if (data?.user?.id) setCurrentUser(data.user.id)
    }
    resolveUser()
  }, [])

  // ─── Step 5: Rehydrate all 4 KPIs from Supabase on mount ─
  useEffect(() => {
    const rehydrate = async () => {
      setRehydrating(true)
      try {
        await Promise.all([rehydrateCe(), rehydrateOar(), rehydrateTth(), rehydrateTurnover()])
      } finally {
        setRehydrating(false)
        setMounted(true)
      }
    }
    rehydrate()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Rehydration helpers ───────────────────────────────────

  const rehydrateCe = async () => {
    const { data } = await supabase
      .from("candidate_experience_responses")
      .select("*")
    if (!data || !data.length) return
    setCeRows(data)
    const avg = data.reduce((s, r) => s + (r.q1_overall || 0), 0) / data.length
    setMetricsData(prev => ({
      ...prev,
      ce: { value: Number(avg.toFixed(1)), loaded: true, responses: data.length },
    }))
    setUploadOrder(prev => prev.includes("ce") ? prev : [...prev, "ce"])
  }

  const rehydrateOar = async () => {
    const { data } = await supabase
      .from("offer_acceptance_rate")
      .select("offers_extended, offers_accepted")
    if (!data || !data.length) return
    const ext = data.reduce((s, r) => s + (r.offers_extended || 0), 0)
    const acc = data.reduce((s, r) => s + (r.offers_accepted || 0), 0)
    const oar = ext ? Number(((acc / ext) * 100).toFixed(2)) : 0
    setMetricsData(prev => ({ ...prev, oar: { value: oar, loaded: true } }))
    setUploadOrder(prev => prev.includes("oar") ? prev : [...prev, "oar"])
  }

  const rehydrateTth = async () => {
    const { data } = await supabase
      .from("time_to_hire")
      .select("accepted_hires_count, total_calendar_days")
    if (!data || !data.length) return
    const hires = data.reduce((s, r) => s + (r.accepted_hires_count || 0), 0)
    const days  = data.reduce((s, r) => s + (r.total_calendar_days  || 0), 0)
    const avg   = hires ? Number((days / hires).toFixed(1)) : 0
    setMetricsData(prev => ({ ...prev, tth: { value: avg, loaded: true } }))
    setUploadOrder(prev => prev.includes("tth") ? prev : [...prev, "tth"])
  }

  const rehydrateTurnover = async () => {
    const { data } = await supabase
      .from("new_hire_turnover")
      .select("new_hires, early_exits")
    if (!data || !data.length) return
    const cohort = data.reduce((s, r) => s + (r.new_hires    || 0), 0)
    const exits  = data.reduce((s, r) => s + (r.early_exits  || 0), 0)
    const rate   = cohort ? Number(((exits / cohort) * 100).toFixed(1)) : 0
    setMetricsData(prev => ({ ...prev, turnover: { value: rate, loaded: true, rate90: null } }))
    setUploadOrder(prev => prev.includes("turnover") ? prev : [...prev, "turnover"])
  }

  // ─── CE Handler ──────────────────────────────────────────
  const handleCe = async (file: File) => {
    const rows = await parseSheet(file)
    if (!rows.length) return

    const allowedOutcomes = ["hired", "not hired"]
    const allowedLikert   = ["strongly agree", "agree", "neutral", "disagree", "strongly disagree"]
    const validRows: RowObject[] = []
    const warnings: string[] = []

    rows.forEach((r, i) => {
      const rowNum  = i + 2
      const outcome = (r["outcome"] as string | undefined)?.trim().toLowerCase() ?? ""
      const q1      = Number(r["q1 overall (0-10)"] ?? NaN)
      let rowValid  = true

      if (!allowedOutcomes.includes(outcome)) { warnings.push(`Row ${rowNum}: invalid outcome`); rowValid = false }
      if (isNaN(q1) || q1 < 0 || q1 > 10)    { warnings.push(`Row ${rowNum}: Q1 must be 0–10`); rowValid = false }

      ;["q2 clarity", "q3 timeliness", "q4 respect", "q5 role understanding", "q6 inclusion"].forEach((f, idx) => {
        const val = (r[f] as string | undefined)?.trim().toLowerCase() ?? ""
        if (val && !allowedLikert.includes(val)) warnings.push(`Row ${rowNum}: Q${idx + 2} invalid Likert`)
      })

      if (rowValid) validRows.push(r)
    })

    if (!validRows.length) { alert("No valid rows.\n\n" + warnings.slice(0, 5).join("\n")); return }

    const { data: batch, error: batchError } = await supabase
      .from("ex_batches")
      .insert({
        filename: file.name, upload_type: "candidate_experience",
        uploaded_by: currentUser, status: "processed",
        records_parsed: validRows.length, records_imported: validRows.length, records_rejected: warnings.length,
      })
      .select().single()

    if (batchError || !batch) { console.error("Batch insert error:", batchError); return }

    const rowsToInsert = validRows.map((r) => ({
      batch_id: batch.batch_id,
      response_date: r["response date"]
        ? (() => { try { const d = new Date(String(r["response date"]).trim()); return isNaN(d.getTime()) ? null : d.toISOString().split("T")[0] } catch { return null } })()
        : null,
      outcome:           r["outcome"]?.toString().toLowerCase(),
      q1_overall:        Number(r["q1 overall (0-10)"]) || null,
      q2_clarity:        r["q2 clarity"]             || null,
      q3_timeliness:     r["q3 timeliness"]          || null,
      q4_respect:        r["q4 respect"]             || null,
      q5_role_understanding: r["q5 role understanding"] || null,
      q6_inclusion:      r["q6 inclusion"]            || null,
      q7_improvement:    r["q7 improvement opportunity"] || null,
      job_family:        r["job family"]              || null,
      hiring_bu:         r["hiring bu"]               || null,
      location:          r["location"]                || null,
      stage:             r["stage"]                   || null,
      uploaded_by:       currentUser,
    }))

    const { error: insertError } = await supabase.from("candidate_experience_responses").insert(rowsToInsert)
    if (insertError) { console.error("Insert error:", insertError); return }

    // Rehydrate CE fully from Supabase (includes all previous batches)
    await rehydrateCe()
    setUploadOrder(prev => [...prev.filter(k => k !== "ce"), "ce"])
    if (warnings.length) console.warn("CE warnings:", warnings)
  }

  // ─── OAR Handler ─────────────────────────────────────────
  const handleOar = async (file: File) => {
    const rows = await parseSheet(file)
    if (!rows.length) { alert("File is empty."); return }

    const required = ["total number of offers extended", "number of offers accepted"]
    const missing  = required.filter(c => !(c in rows[0]))
    if (missing.length) { alert(`Missing columns: ${missing.join(", ")}`); return }

    for (let i = 0; i < rows.length; i++) {
      const ext = Number(rows[i]["total number of offers extended"])
      const acc = Number(rows[i]["number of offers accepted"])
      if (isNaN(ext) || isNaN(acc))                         { alert(`Row ${i + 2}: must be numeric`); return }
      if (!Number.isInteger(ext) || !Number.isInteger(acc)) { alert(`Row ${i + 2}: must be whole numbers`); return }
      if (ext < 0 || acc < 0)                               { alert(`Row ${i + 2}: cannot be negative`); return }
      if (acc > ext)                                         { alert(`Row ${i + 2}: accepted > extended`); return }
    }

    const { data: oarBatch, error: oarBatchError } = await supabase
      .from("ex_batches")
      .insert({
        filename: file.name, upload_type: "offer_acceptance_rate",
        uploaded_by: currentUser, status: "processed",
        records_parsed: rows.length, records_imported: rows.length, records_rejected: 0,
      })
      .select().single()

    if (oarBatchError || !oarBatch) { console.error("OAR batch error:", oarBatchError); return }

    const oarRows = rows.map(r => ({
      batch_id:        oarBatch.batch_id,
      reporting_period: String(r["reporting period"] || ""),
      hiring_bu:       r["hiring bu"] || r["hiringbu"] || null,
      location:        r["location"]  || null,
      candidate_type:  r["candidate type"] || null,
      job_family:      r["job family"] || null,
      level:           r["level"]     || null,
      offers_extended: Number(r["total number of offers extended"]) || 0,
      offers_accepted: Number(r["number of offers accepted"])       || 0,
    }))

    const { error: oarInsertError } = await supabase.from("offer_acceptance_rate").insert(oarRows)
    if (oarInsertError) { console.error("OAR insert error:", oarInsertError); return }

    // Rehydrate OAR fully from Supabase
    await rehydrateOar()
    setUploadOrder(prev => [...prev.filter(k => k !== "oar"), "oar"])
  }

  // ─── TTH Handler ─────────────────────────────────────────
  const handleTth = async (file: File) => {
    const rows = await parseSheet(file)
    if (!rows.length) { alert("File is empty."); return }

    const required = ["reporting period", "accepted hires count", "total calendar days to hire"]
    const missing  = required.filter(c => !(c in rows[0]))
    if (missing.length) { alert(`Missing columns: ${missing.join(", ")}`); return }

    for (let i = 0; i < rows.length; i++) {
      const h = Number(rows[i]["accepted hires count"])
      const d = Number(rows[i]["total calendar days to hire"])
      if (isNaN(h) || isNaN(d)) { alert(`Row ${i + 2}: must be numeric`); return }
      if (h < 0 || d < 0)       { alert(`Row ${i + 2}: cannot be negative`); return }
    }

    const { data: tthBatch, error: tthBatchError } = await supabase
      .from("ex_batches")
      .insert({
        filename: file.name, upload_type: "time_to_hire",
        uploaded_by: currentUser, status: "processed",
        records_parsed: rows.length, records_imported: rows.length, records_rejected: 0,
      })
      .select().single()

    if (tthBatchError || !tthBatch) { console.error("TTH batch error:", tthBatchError); return }

    const tthRows = rows.map(r => ({
      batch_id:           tthBatch.batch_id,
      reporting_period:   String(r["reporting period"] || ""),
      hiring_bu:          r["hiring bu"]    || null,
      job_family:         r["job family"]   || null,
      level:              r["level"]        || null,
      hiring_source:      r["hiring source"] || null,
      accepted_hires_count: Number(r["accepted hires count"])         || 0,
      total_calendar_days:  Number(r["total calendar days to hire"])  || 0,
    }))

    const { error: tthInsertError } = await supabase.from("time_to_hire").insert(tthRows)
    if (tthInsertError) { console.error("TTH insert error:", tthInsertError); return }

    // Rehydrate TTH fully from Supabase
    await rehydrateTth()
    setUploadOrder(prev => [...prev.filter(k => k !== "tth"), "tth"])
  }

  // ─── Turnover Handler ─────────────────────────────────────
  const handleTur = async (file: File) => {
    const rows = await parseSheet(file)
    if (!rows.length) { alert("File is empty."); return }

    const firstRowKeys = Object.keys(rows[0])
    const hasCohort    = firstRowKeys.some(k => k.startsWith("new hires in cohort") || k.includes("total number of new hires"))
    const hasLeft      = firstRowKeys.some(k => k.startsWith("number of new hires who left within 12 months"))
    const missing: string[] = []
    if (!hasCohort) missing.push("new hires in cohort / (total number of new hires in the same period)")
    if (!hasLeft)   missing.push("number of new hires who left within 12 months")
    if (missing.length) { alert(`Missing columns: ${missing.join(", ")}`); return }

    const cohortKey = firstRowKeys.find(k => k.startsWith("new hires in cohort") || k.includes("total number of new hires")) ?? "new hires in cohort"
    const leftKey   = firstRowKeys.find(k => k.startsWith("number of new hires who left within 12 months")) ?? "number of new hires who left within 12 months"

    for (let i = 0; i < rows.length; i++) {
      const c = Number(rows[i][cohortKey])
      const l = Number(rows[i][leftKey])
      if (isNaN(c) || isNaN(l)) { alert(`Row ${i + 2}: must be numeric`); return }
      if (c < 0 || l < 0)       { alert(`Row ${i + 2}: cannot be negative`); return }
      if (l > c)                 { alert(`Row ${i + 2}: exits > cohort`); return }
    }

    const { data: turBatch, error: turBatchError } = await supabase
      .from("ex_batches")
      .insert({
        filename: file.name, upload_type: "new_hire_turnover",
        uploaded_by: currentUser, status: "processed",
        records_parsed: rows.length, records_imported: rows.length, records_rejected: 0,
      })
      .select().single()

    if (turBatchError || !turBatch) { console.error("Turnover batch error:", turBatchError); return }

    const turRowsToInsert = rows.map(r => ({
      batch_id:       turBatch.batch_id,
      hire_cohort:    String(r["hire cohort"] || "Unknown"),
      delivery_unit:  r["delivery unit"]  || null,
      job_family:     r["job family"]     || null,
      hiring_source:  r["hiring source"]  || null,
      new_hires:      Number(r[cohortKey]) || 0,
      early_exits:    Number(r[leftKey])   || 0,
    }))

    const { error: turInsertError } = await supabase.from("new_hire_turnover").insert(turRowsToInsert)
    if (turInsertError) { console.error("Turnover insert error:", turInsertError); return }

    // Rehydrate turnover fully from Supabase (also pick up 90-day rate from this upload)
    const has90   = "number of new hires who left within 90 days" in rows[0]
    const totalC  = rows.reduce((s, r) => s + Number(r[cohortKey] || 0), 0)
    const left90  = has90 ? rows.reduce((s, r) => s + Number(r["number of new hires who left within 90 days"] || 0), 0) : null
    const rate90  = has90 && totalC ? Number(((left90! / totalC) * 100).toFixed(1)) : null

    await rehydrateTurnover()

    // Patch in rate90 after rehydration since it's not stored in DB
    if (rate90 !== null) {
      setMetricsData(prev => ({ ...prev, turnover: { ...prev.turnover, rate90 } }))
    }

    setUploadOrder(prev => [...prev.filter(k => k !== "turnover"), "turnover"])
  }

  // ─── Step 6: Clear metric — delete from Supabase + reset state ─
  const clearMetric = async (key: string) => {
    const tableMap: Record<string, { table: string; uploadType: string }> = {
      ce:       { table: "candidate_experience_responses", uploadType: "candidate_experience" },
      oar:      { table: "offer_acceptance_rate",          uploadType: "offer_acceptance_rate" },
      tth:      { table: "time_to_hire",                   uploadType: "time_to_hire" },
      turnover: { table: "new_hire_turnover",              uploadType: "new_hire_turnover" },
    }

    const target = tableMap[key]
    if (target) {
      const { data: batches } = await supabase
        .from("ex_batches")
        .select("batch_id")
        .eq("upload_type", target.uploadType)

      if (batches && batches.length > 0) {
        const batchIds = batches.map(b => b.batch_id)
        await supabase.from(target.table).delete().in("batch_id", batchIds)
        await supabase.from("ex_batches").delete().in("batch_id", batchIds)
      }
    }

    // Reset in-memory state
    if (key === "ce") setCeRows([])

    setMetricsData(prev => ({
      ...prev,
      [key]: key === "ce"
        ? { value: null, loaded: false, responses: 0 }
        : key === "turnover"
        ? { value: null, loaded: false, rate90: null }
        : { value: null, loaded: false },
    }))
    setUploadOrder(prev => prev.filter(k => k !== key))
  }

  const anyLoaded = Object.values(metricsData).some((m: any) => m.loaded)

  const outcomeData = useMemo(() => {
    if (!ceRows.length) return []
    const h  = ceRows.filter(r => (r.outcome as string)?.toLowerCase() === "hired")
    const nh = ceRows.filter(r => (r.outcome as string)?.toLowerCase() === "not hired")
    const avgQ1 = (rs: any[]) => rs.length ? Number((rs.reduce((s, r) => s + Number(r.q1_overall || 0), 0) / rs.length).toFixed(1)) : 0
    return [
      { outcome: "Hired",     score: avgQ1(h),  count: h.length },
      { outcome: "Not Hired", score: avgQ1(nh), count: nh.length },
    ].filter(d => d.count > 0)
  }, [ceRows])

  const hiringMetrics = [
    { icon: "CE",  title: "Candidate Experience",  subtitle: "Avg. Candidate Experience",    value: metricsData.ce.value,       unit: metricsData.ce.value != null ? "/ 10" : "",   accent: "#6366f1", onFile: handleCe,  loaded: metricsData.ce.loaded,       detail: "Survey-based\naverage score", key: "ce" },
    { icon: "OAR", title: "Offer Acceptance Rate", subtitle: "Percentage of Accepted Offers", value: metricsData.oar.value,      unit: metricsData.oar.value != null ? "%" : "",     accent: "#10b981", onFile: handleOar, loaded: metricsData.oar.loaded,      detail: "Target ≥ 80%",               key: "oar" },
    { icon: "TTH", title: "Time to Hire",           subtitle: "Application → Offer Accept",   value: metricsData.tth.value,      unit: metricsData.tth.value != null ? "days" : "",  accent: "#3b82f6", onFile: handleTth, loaded: metricsData.tth.loaded,      detail: "Lower is better",            key: "tth" },
    { icon: "NHT", title: "New Hire Turnover",      subtitle: "Exits within 12 months",       value: metricsData.turnover.value, unit: metricsData.turnover.value != null ? "%" : "", accent: "#ec4899", onFile: handleTur, loaded: metricsData.turnover.loaded, detail: "Lower is better",            key: "turnover" },
  ]

  if (!mounted) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(160deg, #f8fafc 0%, #f1f5f9 100%)", fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>🧑‍💼</div>
        <div style={{ fontSize: 14, color: "#94a3b8", fontWeight: 600 }}>Loading dashboard…</div>
      </div>
    </div>
  )

  // ─── Render ───────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(160deg, #f8fafc 0%, #f1f5f9 100%)", fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');`}</style>

      {/* ── Top header ── */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e2e8f0", padding: "0 24px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>

          {/* Brand row */}
          <div style={{ display: "flex", alignItems: "center", gap: 14, paddingTop: 24, paddingBottom: 16 }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: "linear-gradient(135deg, #6366f1, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, boxShadow: "0 4px 14px #6366f140", flexShrink: 0 }}>🧑‍💼</div>
            <div>
              <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#0f172a", letterSpacing: "-.02em" }}>Employee Experience</h1>
              <p style={{ margin: 0, fontSize: 12, color: "#94a3b8", marginTop: 2 }}>Talent IQ</p>
            </div>
            {rehydrating && (
              <div style={{ marginLeft: "auto", fontSize: 11, color: "#94a3b8", display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "#6366f1", animation: "pulse 1s infinite" }} />
                Syncing from database…
              </div>
            )}
          </div>

          {/* ── Lifecycle phase tabs ── */}
          <div style={{ display: "flex", gap: 0, overflowX: "auto", marginBottom: -1 }}>
            {PHASES.map((phase) => {
              const isActive = activePhase === phase.key
              return (
                <button
                  key={phase.key}
                  onClick={() => setActivePhase(phase.key as PhaseKey)}
                  style={{
                    display: "flex", alignItems: "center", gap: 7,
                    padding: "12px 20px", background: "transparent", border: "none",
                    borderBottom: isActive ? "2px solid #6366f1" : "2px solid transparent",
                    cursor: phase.active ? "pointer" : "default",
                    opacity: phase.active ? 1 : 0.4,
                    color: isActive ? "#6366f1" : "#64748b",
                    fontSize: 13, fontWeight: isActive ? 700 : 500,
                    fontFamily: "'DM Sans', sans-serif", whiteSpace: "nowrap",
                    transition: "all .18s", position: "relative",
                  }}
                >
                  <span style={{ fontSize: 15 }}>{phase.icon}</span>
                  {phase.label}
                  {isActive && (
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981", display: "inline-block", marginLeft: 2 }} />
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── Phase content ── */}
      {activePhase === "hiring" ? (
        <div style={{ padding: "36px 24px 60px" }}>
          <div style={{ maxWidth: 1100, margin: "0 auto" }}>

            {/* Status pills */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 28 }}>
              {hiringMetrics.map(m => (
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
              {hiringMetrics.map(({ key: _k, ...m }) => <MetricCard key={m.title} {...m} />)}
            </div>

            {/* Summary snapshot */}
            {anyLoaded && (
              <>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 14, letterSpacing: "-.01em" }}>
                  📊 Summary Snapshot
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {[
                    metricsData.ce.loaded && (
                      <div key="ce" style={{ background: "#fff", borderRadius: 14, boxShadow: "0 1px 3px rgba(0,0,0,.06), 0 4px 16px rgba(0,0,0,.06)", padding: "18px 22px", position: "relative" }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#6366f1", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 10 }}> Candidate Experience</div>
                        <BenchmarkRow label="Candidate Experience Score" value={metricsData.ce.value ?? 0} target={10} accent="#6366f1" />
                        <div style={{ fontSize: 11, color: "#94a3b8", marginTop: -4, marginBottom: 8 }}>
                          {metricsData.ce.responses} response{metricsData.ce.responses !== 1 ? "s" : ""}
                        </div>
                        {outcomeData.length > 0 && (
                          <div style={{ display: "flex", gap: 8 }}>
                            {outcomeData.map(d => (
                              <div key={d.outcome} style={{ flex: 1, background: "#f8fafc", borderRadius: 8, padding: "8px 10px", border: "1px solid #e2e8f0" }}>
                                <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", marginBottom: 2 }}>{d.outcome}</div>
                                <div style={{ fontSize: 16, fontWeight: 800, color: "#6366f1" }}>{d.score} <span style={{ fontSize: 10, opacity: 0.6 }}>/ 10</span></div>
                                <div style={{ fontSize: 10, color: "#94a3b8" }}>{d.count} resp.</div>
                              </div>
                            ))}
                          </div>
                        )}
                        <button onClick={() => clearMetric("ce")} style={{ position: "absolute", top: 12, right: 12, background: "#ef4444", color: "#fff", border: "none", borderRadius: "50%", width: 18, height: 18, fontSize: 10, cursor: "pointer" }} title="Clear">×</button>
                      </div>
                    ),
                    metricsData.oar.loaded && (
                      <div key="oar" style={{ background: "#fff", borderRadius: 14, boxShadow: "0 1px 3px rgba(0,0,0,.06), 0 4px 16px rgba(0,0,0,.06)", padding: "18px 22px", position: "relative" }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#10b981", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 10 }}> Offer Acceptance Rate</div>
                        <BenchmarkRow label="Offer Acceptance Rate (%)" value={metricsData.oar.value ?? 0} target={100} accent="#10b981" />
                        {(metricsData.oar.value ?? 0) < 80 && (
                          <div style={{ fontSize: 11, color: "#b91c1c", background: "#fef2f2", borderRadius: 6, padding: "5px 8px", marginTop: 4 }}>⚠️ Below 80% target</div>
                        )}
                        <button onClick={() => clearMetric("oar")} style={{ position: "absolute", top: 12, right: 12, background: "#ef4444", color: "#fff", border: "none", borderRadius: "50%", width: 18, height: 18, fontSize: 10, cursor: "pointer" }} title="Clear">×</button>
                      </div>
                    ),
                    metricsData.tth.loaded && (
                      <div key="tth" style={{ background: "#fff", borderRadius: 14, boxShadow: "0 1px 3px rgba(0,0,0,.06), 0 4px 16px rgba(0,0,0,.06)", padding: "18px 22px", position: "relative" }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#3b82f6", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 10 }}> Time to Hire</div>
                        <BenchmarkRow label="Avg. Days to Hire" value={metricsData.tth.value ?? 0} target={60} accent="#3b82f6" />
                        <button onClick={() => clearMetric("tth")} style={{ position: "absolute", top: 12, right: 12, background: "#ef4444", color: "#fff", border: "none", borderRadius: "50%", width: 18, height: 18, fontSize: 10, cursor: "pointer" }} title="Clear">×</button>
                      </div>
                    ),
                    metricsData.turnover.loaded && (
                      <div key="turnover" style={{ background: "#fff", borderRadius: 14, boxShadow: "0 1px 3px rgba(0,0,0,.06), 0 4px 16px rgba(0,0,0,.06)", padding: "18px 22px", position: "relative" }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#ec4899", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 10 }}> New Hire Turnover</div>
                        <BenchmarkRow label="12-Month New Hire Turnover (%)" value={metricsData.turnover.value ?? 0} target={30} accent="#ec4899" />
                        {metricsData.turnover.rate90 != null && (
                          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>90-Day Rate: <strong style={{ color: "#ec4899" }}>{metricsData.turnover.rate90}%</strong></div>
                        )}
                        <button onClick={() => clearMetric("turnover")} style={{ position: "absolute", top: 12, right: 12, background: "#ef4444", color: "#fff", border: "none", borderRadius: "50%", width: 18, height: 18, fontSize: 10, cursor: "pointer" }} title="Clear">×</button>
                      </div>
                    ),
                  ]
                    .filter(Boolean)
                    .sort((a: any, b: any) => uploadOrder.indexOf(b.key) - uploadOrder.indexOf(a.key))
                  }
                </div>
              </>
            )}
          </div>
        </div>
      ) : activePhase === "onboarding" ? (
        <div style={{ padding: "36px 24px 60px" }}><div style={{ maxWidth: 1100, margin: "0 auto" }}><OBDashboard /></div></div>
      ) : activePhase === "performance" ? (
        <div style={{ padding: "36px 24px 60px" }}><div style={{ maxWidth: 1100, margin: "0 auto" }}><PerfDashboard /></div></div>
      ) : activePhase === "engagement" ? (
        <div style={{ padding: "36px 24px 60px" }}><div style={{ maxWidth: 1100, margin: "0 auto" }}><EngDashboard /></div></div>
      ) : activePhase === "wellbeing" ? (
        <div style={{ padding: "36px 24px 60px" }}><div style={{ maxWidth: 1100, margin: "0 auto" }}><WellbeingDashboard /></div></div>
      ) : activePhase === "offboarding" ? (
        <div style={{ padding: "36px 24px 60px" }}><div style={{ maxWidth: 1100, margin: "0 auto" }}><OffboardingDashboard /></div></div>
      ) : (
        <ComingSoon phase={PHASES.find(p => p.key === activePhase)!} />
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  )
}