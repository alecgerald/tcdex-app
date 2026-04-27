"use client"

import { useState, useRef, useEffect } from "react"
import * as XLSX from "xlsx"
import { createClient } from "@/utils/supabase/client"

const supabase = createClient()

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

// ─── Default metric state ─────────────────────────────────
const DEFAULT_METRICS = {
  ei:  { engagementIndex: null as number | null, eNPS: null as number | null, responses: 0, promoters: 0, passives: 0, detractors: 0, loaded: false },
  vtr: { rate: null as number | null, separations: 0, headcount: 0, loaded: false },
  err: { rate: null as number | null, startCount: 0, retained: 0, loaded: false },
  its: { rate: null as number | null, responses: 0, loaded: false },
  ner: { referralCount: 0, referralRate: null as number | null, participants: 0, activeEmployees: 0, loaded: false },
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
            width: 42, height: 42, borderRadius: 12,
            background: `linear-gradient(135deg, ${accent}30, ${accent}10)`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 16, fontWeight: 800, color: accent, letterSpacing: "0.5px"
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

// ─── EngRetDashboard ──────────────────────────────────────
export default function EngRetDashboard() {
  const [uploadOrder, setUploadOrder] = useState<string[]>([])
  const [metrics, setMetrics]         = useState(DEFAULT_METRICS)
  const [rehydrating, setRehydrating] = useState(true)
  const [currentUser, setCurrentUser] = useState<string>("system")
  // ─── Error state (matches onboarding / perf dashboards) ──
  const [error, setError]             = useState<string | null>(null)

  // ─── Step 1: Resolve real auth user on mount ─────────────
  useEffect(() => {
    const resolveUser = async () => {
      const { data } = await supabase.auth.getUser()
      if (data?.user?.id) setCurrentUser(data.user.id)
    }
    resolveUser()
  }, [])

  // ─── Step 2: Parallel rehydration from Supabase on mount ─
  useEffect(() => {
    const rehydrate = async () => {
      setRehydrating(true)
      try {
        await Promise.all([
          rehydrateEi(),
          rehydrateVtr(),
          rehydrateErr(),
          rehydrateIts(),
          rehydrateNer(),
        ])
      } finally {
        setRehydrating(false)
      }
    }
    rehydrate()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Rehydration helpers ───────────────────────────────────

  const rehydrateEi = async () => {
    const { data } = await supabase
      .from("engagement_survey_responses")
      .select("q1_purpose, q2_enablement, q3_commitment, q4_growth, q5_belonging, q6_enps")

    if (!data || !data.length) return

    const engKeys = ["q1_purpose", "q2_enablement", "q3_commitment", "q4_growth", "q5_belonging"]
    let total = 0, count = 0
    data.forEach(r => engKeys.forEach(k => {
      const s = toLikert((r as any)[k])
      if (s !== null) { total += s; count++ }
    }))
    const avgLikert       = count ? total / count : 0
    const engagementIndex = count ? Number(((avgLikert - 1) / 4 * 100).toFixed(1)) : null

    let promoters = 0, passives = 0, detractors = 0, eNpsResponses = 0
    data.forEach(r => {
      const score = Number(r.q6_enps ?? NaN)
      if (!isNaN(score)) {
        eNpsResponses++
        if (score >= 9) promoters++
        else if (score >= 7) passives++
        else detractors++
      }
    })
    const eNPS = eNpsResponses ? Number(((promoters - detractors) / eNpsResponses * 100).toFixed(1)) : null

    setMetrics(prev => ({ ...prev, ei: { engagementIndex, eNPS, responses: data.length, promoters, passives, detractors, loaded: true } }))
    setUploadOrder(prev => prev.includes("ei") ? prev : [...prev, "ei"])
  }

  const rehydrateVtr = async () => {
    const { data } = await supabase
      .from("voluntary_turnover")
      .select("avg_headcount, voluntary_separations")

    if (!data || !data.length) return

    const headcount    = data.reduce((s, r) => s + (r.avg_headcount         || 0), 0)
    const separations  = data.reduce((s, r) => s + (r.voluntary_separations || 0), 0)
    const rate         = headcount ? Number(((separations / headcount) * 100).toFixed(2)) : null

    setMetrics(prev => ({ ...prev, vtr: { rate, separations, headcount, loaded: true } }))
    setUploadOrder(prev => prev.includes("vtr") ? prev : [...prev, "vtr"])
  }

  const rehydrateErr = async () => {
    const { data } = await supabase
      .from("employee_retention")
      .select("employees_start, employees_end, new_hires")

    if (!data || !data.length) return

    const totalStart    = data.reduce((s, r) => s + (r.employees_start || 0), 0)
    const totalEnd      = data.reduce((s, r) => s + (r.employees_end   || 0), 0)
    const totalNewHires = data.reduce((s, r) => s + (r.new_hires       || 0), 0)
    const retained      = totalEnd - totalNewHires
    const rate          = totalStart ? Number(((retained / totalStart) * 100).toFixed(2)) : null

    setMetrics(prev => ({ ...prev, err: { rate, startCount: totalStart, retained, loaded: true } }))
    setUploadOrder(prev => prev.includes("err") ? prev : [...prev, "err"])
  }

  const rehydrateIts = async () => {
    const { data } = await supabase
      .from("intent_to_stay_responses")
      .select("q1_intent_to_stay")

    if (!data || !data.length) return

    const favorable = data.filter(r => isAgree(r.q1_intent_to_stay ?? "")).length
    const rate      = Number(((favorable / data.length) * 100).toFixed(1))

    setMetrics(prev => ({ ...prev, its: { rate, responses: data.length, loaded: true } }))
    setUploadOrder(prev => prev.includes("its") ? prev : [...prev, "its"])
  }

  const rehydrateNer = async () => {
    const { data } = await supabase
  .from("employee_referrals")
  .select("referral_count, employees_referred, total_employees, referral_rate")

    if (!data || !data.length) return

    const totalReferrals    = data.reduce((s, r) => s + (r.referral_count      || 0), 0)
    const totalParticipants = data.reduce((s, r) => s + (r.employees_referred  || 0), 0)
    const totalActive       = data.reduce((s, r) => s + (r.total_employees     || 0), 0)
const referralRate = data.some(r => r.referral_rate != null)
  ? Number((data.reduce((s, r) => s + (Number(r.referral_rate) || 0), 0) / data.length).toFixed(2))
  : null

    setMetrics(prev => ({ ...prev, ner: { referralCount: totalReferrals, referralRate, participants: totalParticipants, activeEmployees: totalActive, loaded: true } }))
    setUploadOrder(prev => prev.includes("ner") ? prev : [...prev, "ner"])
  }

  // ─── EI / eNPS Handler ───────────────────────────────────
  const handleEi = async (file: File) => {
    setError(null)
    try {
      const rows = await parseSheet(file)
      if (!rows.length) throw new Error("File is empty.")

      const keys = Object.keys(rows[0])

      // ── Column validation ─────────────────────────────────
      const hasQ1 = keys.some(k => k.startsWith("q1"))
      const hasQ2 = keys.some(k => k.startsWith("q2"))
      const hasQ3 = keys.some(k => k.startsWith("q3"))
      const hasQ4 = keys.some(k => k.startsWith("q4"))
      const hasQ5 = keys.some(k => k.startsWith("q5"))

      if (!hasQ1 || !hasQ2 || !hasQ3 || !hasQ4 || !hasQ5) {
        const missing = [
          !hasQ1 && "Q1 Purpose",
          !hasQ2 && "Q2 Enablement",
          !hasQ3 && "Q3 Commitment",
          !hasQ4 && "Q4 Growth",
          !hasQ5 && "Q5 Belonging",
        ].filter(Boolean).join(", ")
        throw new Error(`File does not appear to be an Engagement Survey export. Missing columns: ${missing}.`)
      }

      const engQKeys        = ["q1 purpose", "q2 enablement", "q3 commitment", "q4 growth", "q5 belonging"]
      const resolvedEngKeys = engQKeys.map(q => keys.find(k => k.startsWith(q.substring(0, 6))) ?? q)
      const eNpsKey         = keys.find(k => k.includes("enps") || (k.includes("q6") && k.includes("0-10"))) ?? "q6 enps (0-10)"

      const { data: eiBatch, error: eiBatchError } = await supabase
        .from("ex_batches")
        .insert({
          filename: file.name, upload_type: "engagement_survey", uploaded_by: currentUser,
          status: "processed", records_parsed: rows.length, records_imported: rows.length, records_rejected: 0,
        })
        .select().single()

      if (eiBatchError || !eiBatch) throw new Error("Failed to create upload batch. Please try again.")

      const { error: eiInsertError } = await supabase
        .from("engagement_survey_responses")
        .insert(rows.map(r => ({
          batch_id:               eiBatch.batch_id,
          survey_period:          r["survey period"]          || null,
          function:               r["function"]               || null,
          role_level:             r["role level"]             || null,
          location:               r["location"]               || null,
          tenure_band:            r["tenure band"]            || null,
          q1_purpose:             r[resolvedEngKeys[0]]       || null,
          q2_enablement:          r[resolvedEngKeys[1]]       || null,
          q3_commitment:          r[resolvedEngKeys[2]]       || null,
          q4_growth:              r[resolvedEngKeys[3]]       || null,
          q5_belonging:           r[resolvedEngKeys[4]]       || null,
          q6_enps:                r[eNpsKey] != null ? Number(r[eNpsKey]) : null,
          q7_improvement_comment: r["q7 improvement comment"] || null,
        })))

      if (eiInsertError) throw new Error("Failed to save Engagement Survey responses. Please try again.")

      await rehydrateEi()
      setUploadOrder(prev => [...prev.filter(k => k !== "ei"), "ei"])

    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.")
    }
  }

  // ─── VTR Handler ─────────────────────────────────────────
  const handleVtr = async (file: File) => {
    setError(null)
    try {
      const rows = await parseSheet(file)
      if (!rows.length) throw new Error("File is empty.")

      const keys           = Object.keys(rows[0])
      const headcountKey   = keys.find(k => k.includes("average headcount"))     ?? ""
      const separationsKey = keys.find(k => k.includes("voluntary separations")) ?? ""

      // ── Column validation ─────────────────────────────────
      if (!headcountKey && !separationsKey) {
        throw new Error(
          "File does not appear to be a Voluntary Turnover export. Missing columns: " +
          "Average Headcount During the Same Period, Number of Voluntary Separations During the Period."
        )
      }
      if (!headcountKey)   throw new Error("Missing column: Average Headcount During the Same Period.")
      if (!separationsKey) throw new Error("Missing column: Number of Voluntary Separations During the Period.")

      const { data: vtrBatch, error: vtrBatchError } = await supabase
        .from("ex_batches")
        .insert({
          filename: file.name, upload_type: "voluntary_turnover", uploaded_by: currentUser,
          status: "processed", records_parsed: rows.length, records_imported: rows.length, records_rejected: 0,
        })
        .select().single()

      if (vtrBatchError || !vtrBatch) throw new Error("Failed to create upload batch. Please try again.")

      const { error: vtrInsertError } = await supabase
        .from("voluntary_turnover")
        .insert(rows.map(r => ({
          batch_id:              vtrBatch.batch_id,
          reporting_period:      String(r["reporting period"] || "Unknown"),
          delivery_unit:         r["delivery unit"]           || null,
          job_family:            r["job family"]              || null,
          tenure_band:           r["tenure band"]             || null,
          avg_headcount:         Number(r[headcountKey])      || 0,
          voluntary_separations: Number(r[separationsKey])    || 0,
        })))

      if (vtrInsertError) throw new Error("Failed to save Voluntary Turnover records. Please try again.")

      await rehydrateVtr()
      setUploadOrder(prev => [...prev.filter(k => k !== "vtr"), "vtr"])

    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.")
    }
  }

  // ─── ERR Handler ─────────────────────────────────────────
  const handleErr = async (file: File) => {
    setError(null)
    try {
      const rows = await parseSheet(file)
      if (!rows.length) throw new Error("File is empty.")

      const keys        = Object.keys(rows[0])
      const startKey    = keys.find(k => k.includes("employees at start")) ?? ""
      const endKey      = keys.find(k => k.includes("employees at end"))   ?? ""
      const newHiresKey = keys.find(k => k.includes("new hires during"))   ?? ""

      // ── Column validation ─────────────────────────────────
      const missingCols = [
        !startKey    && "Employees at Start of Period",
        !endKey      && "Employees at End of Period",
        !newHiresKey && "New Hires During Period",
      ].filter(Boolean)

      if (missingCols.length === 3) {
        throw new Error("File does not appear to be an Employee Retention export. Missing columns: " + missingCols.join(", ") + ".")
      }
      if (missingCols.length > 0) {
        throw new Error("Missing column" + (missingCols.length > 1 ? "s" : "") + ": " + missingCols.join(", ") + ".")
      }

      const { data: errBatch, error: errBatchError } = await supabase
        .from("ex_batches")
        .insert({
          filename: file.name, upload_type: "employee_retention", uploaded_by: currentUser,
          status: "processed", records_parsed: rows.length, records_imported: rows.length, records_rejected: 0,
        })
        .select().single()

      if (errBatchError || !errBatch) throw new Error("Failed to create upload batch. Please try again.")

      const { error: errInsertError } = await supabase
        .from("employee_retention")
        .insert(rows.map(r => ({
          batch_id:         errBatch.batch_id,
          reporting_period: String(r["reporting period"] || "Unknown"),
          delivery_unit:    r["delivery unit"]            || null,
          employees_start:  Number(r[startKey])           || 0,
          employees_end:    Number(r[endKey])              || 0,
          new_hires:        Number(r[newHiresKey])         || 0,
        })))

      if (errInsertError) throw new Error("Failed to save Employee Retention records. Please try again.")

      await rehydrateErr()
      setUploadOrder(prev => [...prev.filter(k => k !== "err"), "err"])

    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.")
    }
  }

  // ─── ITS Handler ─────────────────────────────────────────
  const handleIts = async (file: File) => {
    setError(null)
    try {
      const rows = await parseSheet(file)
      if (!rows.length) throw new Error("File is empty.")

      const keys   = Object.keys(rows[0])
      const itsKey = keys.find(k => k.includes("intent to stay") || (k.startsWith("q1") && k.includes("intent"))) ?? ""

      // ── Column validation ─────────────────────────────────
      if (!itsKey) {
        throw new Error("File does not appear to be an Intent to Stay export. Missing column: Q1 Intent to Stay.")
      }

      const { data: itsBatch, error: itsBatchError } = await supabase
        .from("ex_batches")
        .insert({
          filename: file.name, upload_type: "intent_to_stay", uploaded_by: currentUser,
          status: "processed", records_parsed: rows.length, records_imported: rows.length, records_rejected: 0,
        })
        .select().single()

      if (itsBatchError || !itsBatch) throw new Error("Failed to create upload batch. Please try again.")

      const { error: itsInsertError } = await supabase
        .from("intent_to_stay_responses")
        .insert(rows.map(r => ({
          batch_id:           itsBatch.batch_id,
          survey_period:      r["survey period"]  || null,
          function:           r["function"]        || null,
          role_level:         r["role level"]      || null,
          location:           r["location"]        || null,
          tenure_band:        r["tenure band"]     || null,
          q1_intent_to_stay:  r[itsKey]            || null,
          q2_prefer_continue: r["q2 prefer to continue career here"] || null,
          response_date: r["response date"]
            ? (() => { try { const d = new Date(String(r["response date"])); return isNaN(d.getTime()) ? null : d.toISOString().split("T")[0] } catch { return null } })()
            : null,
        })))

      if (itsInsertError) throw new Error("Failed to save Intent to Stay responses. Please try again.")

      await rehydrateIts()
      setUploadOrder(prev => [...prev.filter(k => k !== "its"), "its"])

    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.")
    }
  }

  // ─── NER Handler ─────────────────────────────────────────
  const handleNer = async (file: File) => {
    setError(null)
    try {
      const rows = await parseSheet(file)
      if (!rows.length) throw new Error("File is empty.")

      const keys            = Object.keys(rows[0])
      const referralsKey    = keys.find(k => k.includes("number of employee referrals"))             ?? ""
      const participantsKey = keys.find(k =>
  k.includes("at least one") ||
  k.includes("employees who made") ||
  k.includes("employees referred")
) ?? ""
console.log("participantsKey resolved:", participantsKey)
console.log("sample row value:", rows[0][participantsKey])
      const activeKey       = keys.find(k => k.includes("total active employees"))                   ?? ""
console.log("NER keys:", Object.keys(rows[0]))
      
      // ── Column validation ─────────────────────────────────
      if (!referralsKey) {
        throw new Error("File does not appear to be an Employee Referrals export. Missing column: Number of Employee Referrals.")
      }

      const { data: nerBatch, error: nerBatchError } = await supabase
        .from("ex_batches")
        .insert({
          filename: file.name, upload_type: "employee_referrals", uploaded_by: currentUser,
          status: "processed", records_parsed: rows.length, records_imported: rows.length, records_rejected: 0,
        })
        .select().single()

      if (nerBatchError || !nerBatch) throw new Error("Failed to create upload batch. Please try again.")

      const { error: nerInsertError } = await supabase
        .from("employee_referrals")
        .insert(rows.map(r => ({
          batch_id:           nerBatch.batch_id,
          reporting_period:   String(r["reporting period"] || "Unknown"),
          delivery_unit:      r["delivery unit"]            || null,
          location:           r["location"]                 || null,
          referral_count:     Number(r[referralsKey])       || 0,
          employees_referred: r[participantsKey] != null ? Number(r[participantsKey]) || 0 : 0,
          total_employees:    r[activeKey]       != null ? Number(r[activeKey])       || 0 : 0,
        })))

      if (nerInsertError) throw new Error("Failed to save Employee Referral records. Please try again.")

      await rehydrateNer()
      setUploadOrder(prev => [...prev.filter(k => k !== "ner"), "ner"])

    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.")
    }
  }

  // ─── Clear metric — delete from Supabase + reset state ───
  const clearMetric = async (key: string) => {
    const tableMap: Record<string, string> = {
      ei:  "engagement_survey_responses",
      vtr: "voluntary_turnover",
      err: "employee_retention",
      its: "intent_to_stay_responses",
      ner: "employee_referrals",
    }
    const uploadTypeMap: Record<string, string> = {
      ei:  "engagement_survey",
      vtr: "voluntary_turnover",
      err: "employee_retention",
      its: "intent_to_stay",
      ner: "employee_referrals",
    }

    const table      = tableMap[key]
    const uploadType = uploadTypeMap[key]

    if (table && uploadType) {
      const { data: batches } = await supabase
        .from("ex_batches")
        .select("batch_id")
        .eq("upload_type", uploadType)

      if (batches && batches.length > 0) {
        const batchIds = batches.map(b => b.batch_id)
        await supabase.from(table).delete().in("batch_id", batchIds)
        await supabase.from("ex_batches").delete().in("batch_id", batchIds)
      }
    }

    const defaults: typeof DEFAULT_METRICS = {
      ...DEFAULT_METRICS,
      [key]: DEFAULT_METRICS[key as keyof typeof DEFAULT_METRICS],
    }
    setMetrics(prev => ({ ...prev, [key]: defaults[key as keyof typeof DEFAULT_METRICS] }))
    setUploadOrder(prev => prev.filter(k => k !== key))
  }

  const anyLoaded = metrics.ei.loaded || metrics.vtr.loaded || metrics.err.loaded || metrics.its.loaded || metrics.ner.loaded

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

      {/* ── Error banner (matches onboarding / perf dashboards) ── */}
      {error && (
        <div style={{
          background: "#fef2f2",
          border: "1px solid #fca5a5",
          borderRadius: 10,
          padding: "12px 16px",
          marginBottom: 20,
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
        }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 8, flex: 1 }}>
            <span style={{ fontSize: 15, flexShrink: 0, marginTop: 1 }}>⚠</span>
            <span style={{ fontSize: 12, color: "#b91c1c", lineHeight: 1.5 }}>{error}</span>
          </div>
          <button
            onClick={() => setError(null)}
            style={{
              background: "none", border: "none", cursor: "pointer",
              color: "#b91c1c", fontSize: 16, lineHeight: 1, flexShrink: 0,
              padding: "0 2px",
            }}
            title="Dismiss"
          >×</button>
        </div>
      )}

      {/* Syncing indicator */}
      {rehydrating && (
        <div style={{ fontSize: 11, color: "#94a3b8", display: "flex", alignItems: "center", gap: 6, marginBottom: 16 }}>
          <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "#6366f1", animation: "pulse 1s infinite" }} />
          Syncing from database…
          <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.3} }`}</style>
        </div>
      )}

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

            {metrics.ei.loaded && (
              <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 1px 3px rgba(0,0,0,.06), 0 4px 16px rgba(0,0,0,.06)", padding: "18px 22px", position: "relative" }}>
  <div style={{ fontSize: 11, fontWeight: 700, color: "#6366f1", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 10 }}>
    Engagement Index
  </div>

  <BenchmarkRow 
    label="Engagement Index (Favorability)" 
    value={metrics.ei.engagementIndex ?? 0} 
    target={100} 
    accent="#6366f1" 
    unit="%" 
  />

  {/* ✅ Keep this */}
  <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 10 }}>
    {metrics.ei.responses} survey responses
  </div>

  <button 
    onClick={() => clearMetric("ei")} 
    style={{ position: "absolute", top: 12, right: 12, background: "#ef4444", color: "#fff", border: "none", borderRadius: "50%", width: 18, height: 18, fontSize: 10, cursor: "pointer" }} 
    title="Clear"
  >
    ×
  </button>
</div>
            )}

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

            {metrics.err.loaded && (
              <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 1px 3px rgba(0,0,0,.06), 0 4px 16px rgba(0,0,0,.06)", padding: "18px 22px", position: "relative" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#10b981", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 10 }}>Employee Retention Rate</div>
                <BenchmarkRow label="Retention Rate" value={metrics.err.rate ?? 0} target={100} accent="#10b981" unit="%" />
                <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
                  {metrics.err.retained} of {metrics.err.startCount} employees retained through end of period
                </div>
                {(metrics.err.rate ?? 100) < 90 && (
                  <div style={{ fontSize: 11, color: "#b91c1c", background: "#fef2f2", borderRadius: 6, padding: "5px 8px", marginTop: 6 }}>Retention rate below 90% — investigate root causes</div>
                )}
                <button onClick={() => clearMetric("err")} style={{ position: "absolute", top: 12, right: 12, background: "#ef4444", color: "#fff", border: "none", borderRadius: "50%", width: 18, height: 18, fontSize: 10, cursor: "pointer" }} title="Clear">×</button>
              </div>
            )}

            {metrics.its.loaded && (
              <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 1px 3px rgba(0,0,0,.06), 0 4px 16px rgba(0,0,0,.06)", padding: "18px 22px", position: "relative" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#8b5cf6", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 10 }}> Intent to Stay</div>
                <BenchmarkRow label="Intent to Stay Rate" value={metrics.its.rate ?? 0} target={100} accent="#8b5cf6" unit="%" />
                <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
                  {metrics.its.responses} pulse survey responses · leading retention indicator
                </div>
                {(metrics.its.rate ?? 100) < 70 && (
                  <div style={{ fontSize: 11, color: "#7c3aed", background: "#faf5ff", borderRadius: 6, padding: "5px 8px", marginTop: 6 }}>Low intent to stay — early action planning recommended</div>
                )}
                <button onClick={() => clearMetric("its")} style={{ position: "absolute", top: 12, right: 12, background: "#ef4444", color: "#fff", border: "none", borderRadius: "50%", width: 18, height: 18, fontSize: 10, cursor: "pointer" }} title="Clear">×</button>
              </div>
            )}

            {metrics.ner.loaded && (
  <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 1px 3px rgba(0,0,0,.06), 0 4px 16px rgba(0,0,0,.06)", padding: "18px 22px", position: "relative" }}>
    
    <div style={{ fontSize: 11, fontWeight: 700, color: "#f59e0b", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 10 }}>
      Employee Referrals
    </div>

    {/* ✅ Keep this */}
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#475569", marginBottom: 12 }}>
      <span>Total Referrals</span>
      <span style={{ fontWeight: 700, color: "#f59e0b" }}>
        {metrics.ner.referralCount}
      </span>
    </div>

    {/* ✅ Keep this */}
    {metrics.ner.referralRate != null && (
      <BenchmarkRow 
        label="Referral Rate (Employees Participating)" 
        value={metrics.ner.referralRate} 
        target={20} 
        accent="#f59e0b" 
        unit="%" 
      />
    )}

    <button 
      onClick={() => clearMetric("ner")} 
      style={{ position: "absolute", top: 12, right: 12, background: "#ef4444", color: "#fff", border: "none", borderRadius: "50%", width: 18, height: 18, fontSize: 10, cursor: "pointer" }} 
      title="Clear"
    >
      ×
    </button>

  </div>
)}

          </div>
        </>
      )}
    </div>
  )
}