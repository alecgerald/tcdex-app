"use client"

import { useState, useRef, useEffect } from "react"
import * as XLSX from "xlsx"
import { createClient } from "@/utils/supabase/client"

const supabase = createClient()

// ─── Types ────────────────────────────────────────────────────────────────────
type CellValue = string | number | null
interface RowObject {
  [key: string]: CellValue
}
// Raw XLSX cells can be Date objects before we normalise them
type RawCell = CellValue | Date

interface UploadZoneProps {
  onFile: (file: File) => void
  loaded: boolean
  accent: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const nk = (k: string) => k.trim().toLowerCase().replace(/\s+/g, " ")

const parseSheet = (file: File): Promise<RowObject[]> =>
  new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (evt) => {
      const buf = evt.target?.result
      if (!buf) return resolve([])
      const wb = XLSX.read(buf, { type: "array", cellDates: true, dateNF: "yyyy-mm-dd" })
      const rows = XLSX.utils.sheet_to_json<Record<string, RawCell>>(wb.Sheets[wb.SheetNames[0]], { defval: null })
      const norm = rows.map((row) => {
        const obj: RowObject = {}
        Object.keys(row).forEach((k) => {
          const v: RawCell = row[k]
          obj[nk(k)] = v instanceof Date ? v.toISOString().slice(0, 10) : (v as CellValue)
        })
        return obj
      })
      resolve(norm)
    }
    reader.readAsArrayBuffer(file)
  })

const safeNum = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "" || v === "#DIV/0!") return null
  const n = Number(v)
  return isNaN(n) ? null : n
}

const avg = (nums: (number | null)[]): number | null => {
  const valid = nums.filter((n): n is number => n !== null)
  return valid.length ? Number((valid.reduce((a, b) => a + b, 0) / valid.length).toFixed(4)) : null
}

// ─── NHE Category Calculations (from raw scores stored in Supabase) ───────────
// 1–4 Likert scale: pct = ((score - 1) / 3) * 100
// OOE is 1–5 scale: pct = ((score - 1) / 4) * 100

interface CategoryResult {
  label: string
  avgScore: number | null
  pct: number | null
  promoterPct: number | null
  count: number
  isOOE: boolean
}

const LL30_CATS = [
  { id: "fde",   label: "First-Day Exp & Orientation",     questions: ["q4_1","q4_2","q4_3","q4_4","q4_5"], isOOE: false },
  { id: "rc",    label: "Role Clarity & Expectations",      questions: ["q7_1","q7_2","q7_3"],             isOOE: false },
  { id: "ms",    label: "Manager Support & Feedback",       questions: ["q10_1","q10_2","q10_3","q10_4","q10_5"], isOOE: false },
  { id: "tc",    label: "Team Culture & Belonging",         questions: ["q13_1","q13_2","q13_3","q13_4","q13_5"], isOOE: false },
  { id: "tools", label: "Tools & Systems",                  questions: ["q22_1","q22_2","q22_3","q22_4"],  isOOE: false },
  { id: "cwt",   label: "Company-wide Training",            questions: ["q25_1","q25_2","q25_3","q25_4","q25_5","q25_6","q25_7","q25_8"], isOOE: false },
  { id: "dut",   label: "DU-Specific Training",             questions: ["q28_1","q28_2","q28_3","q28_4"],  isOOE: false },
  { id: "pgfo",  label: "Growth & Future Outlook",          questions: ["q31_1","q31_2","q31_3","q31_4","q31_5"], isOOE: false },
  { id: "ooe",   label: "Overall Onboarding Experience",    questions: ["q34_1"],                          isOOE: true  },
  { id: "hrsf",  label: "HR & Support Functions",           questions: ["q38_1","q38_2","q38_3","q38_4","q38_5","q38_6","q38_7"], isOOE: false },
]

function calcNheFromSupabaseRows(rows: Record<string, number | null>[]): {
  categoryResults: Record<string, CategoryResult>
  overallFavorability: number | null
  respondentCount: number
} {
  const categoryResults: Record<string, CategoryResult> = {}
  let cumPct = 0
  let validCats = 0

  LL30_CATS.forEach((cat) => {
    let totalPct = 0
    let count = 0
    let promoters = 0

    rows.forEach((r) => {
      const scores = cat.questions.map((q) => r[q] ?? null)
      const rowAvg = avg(scores)
      if (rowAvg === null || rowAvg < 1) return
      count++
      const pct = cat.isOOE
        ? ((rowAvg - 1) / 4) * 100
        : ((rowAvg - 1) / 3) * 100
      totalPct += pct
      if (cat.isOOE) { if (rowAvg >= 5) promoters++ }
      else           { if (rowAvg >= 4) promoters++ }
    })

    if (count > 0) {
      const avgPct = Number((totalPct / count).toFixed(1))
      categoryResults[cat.id] = {
        label: cat.label,
        avgScore: null,
        pct: avgPct,
        promoterPct: Math.round((promoters / count) * 100),
        count,
        isOOE: cat.isOOE,
      }
      cumPct += avgPct
      validCats++
    }
  })

  return {
    categoryResults,
    overallFavorability: validCats ? Number((cumPct / validCats).toFixed(1)) : null,
    respondentCount: rows.length,
  }
}

// ─── LL60 helpers (unchanged) ─────────────────────────────────────────────────
const LL60_DIMENSIONS = [
  "motivation_engagement", "manager_relationship", "team_belonging",
  "workload_stress", "growth_future_outlook", "recognition_value",
]

function calcLL60FromSupabaseRows(rows: Record<string, unknown>[]) {
  let totalSigPositive = 0, totalSig = 0
  let totalRating = 0, ratingCount = 0
  let totalRecommend = 0, recommendCount = 0
  const riskCounts = { low: 0, medium: 0, high: 0 }
  let participantCount = 0

  rows.forEach((r) => {
    const pc = Number(r.participant_count ?? 0)
    if (!isNaN(pc)) participantCount += pc
    const rating = Number(r.avg_journey_rating)
    if (!isNaN(rating) && rating >= 1) { totalRating += rating; ratingCount++ }
    const rec = Number(r.recommend_percent)
    if (!isNaN(rec)) { totalRecommend += rec; recommendCount++ }
    const risk = (r.overall_retention_risk as string ?? "").trim().toLowerCase()
    if (risk === "low") riskCounts.low++
    else if (risk === "medium") riskCounts.medium++
    else if (risk === "high") riskCounts.high++

    LL60_DIMENSIONS.forEach((d) => {
      const val = ((r[d] as string) ?? "").trim().toLowerCase()
      totalSig++
      if (val.includes("positive")) totalSigPositive++
    })
  })

  return {
    overallPositivity: totalSig ? Number(((totalSigPositive / totalSig) * 100).toFixed(1)) : null,
    avgRating: ratingCount ? Number((totalRating / ratingCount).toFixed(1)) : null,
    avgRecommend: recommendCount ? Number((totalRecommend / recommendCount).toFixed(1)) : null,
    riskCounts,
    sessionCount: rows.length,
    participantCount,
  }
}

// ─── findVal (LL60 Excel key lookup) ─────────────────────────────────────────
function findVal(r: RowObject, ...candidates: string[]): string {
  for (const c of candidates) {
    const norm = nk(c)
    if (r[norm] !== undefined && r[norm] !== null) return String(r[norm])
    const swapped = norm.includes("–") ? norm.replace(/–/g, "-") : norm.replace(/-/g, "–")
    if (r[swapped] !== undefined && r[swapped] !== null) return String(r[swapped])
    const words = norm.split(/\s+/).filter((w) => w.length > 2)
    const hit = Object.entries(r).find(([k]) => words.every((w) => k.includes(w)))
    if (hit) return String(hit[1] ?? "")
  }
  return ""
}

// ─── Default state ────────────────────────────────────────────────────────────
type ObMetrics = {
  ttp:  { avgDays: number | null; confirmRate: number | null; confirmed: number; total: number; loaded: boolean }
  nhe:  { favorability: number | null; categories: Record<string, CategoryResult>; responses: number; loaded: boolean }
  ll60: { overallPositivity: number | null; avgRating: number | null; avgRecommend: number | null; riskCounts: { low: number; medium: number; high: number }; sessionCount: number; participantCount: number; loaded: boolean }
  tcr:  { rate: number | null; enrolled: number; completed: number; loaded: boolean }
}

const DEFAULT_METRICS: ObMetrics = {
  ttp:  { avgDays: null, confirmRate: null, confirmed: 0, total: 0, loaded: false },
  nhe:  { favorability: null, categories: {}, responses: 0, loaded: false },
  ll60: { overallPositivity: null, avgRating: null, avgRecommend: null, riskCounts: { low: 0, medium: 0, high: 0 }, sessionCount: 0, participantCount: 0, loaded: false },
  tcr:  { rate: null, enrolled: 0, completed: 0, loaded: false },
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function UploadZone({ onFile, loaded, accent }: UploadZoneProps) {
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
        border: `1.5px dashed ${drag ? accent : loaded ? "#22c55e" : "#cbd5e1"}`,
        borderRadius: 10, padding: "12px 10px", cursor: "pointer",
        background: drag ? accent + "10" : loaded ? "#f0fdf4" : "#f8fafc",
        textAlign: "center", fontSize: 12,
        color: loaded ? "#16a34a" : "#94a3b8",
        transition: "all .2s", marginBottom: 16, userSelect: "none",
      }}
    >
      <input ref={ref} type="file" accept=".xlsx,.xls,.csv" hidden
        onChange={(e) => handle(e.target.files?.[0])} />
      {loaded
        ? <><span style={{ fontSize: 16 }}>✓</span> File loaded — upload new to append</>
        : <><span style={{ fontSize: 16 }}>↑</span><br />Drop or click to upload<br />.xlsx / .xls / .csv</>}
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

function MetricCard({ icon, title, subtitle, value, unit, accent, onFile, loaded, detail }: {
  icon: string; title: string; subtitle: string; value: number | null;
  unit?: string; accent: string; onFile: (f: File) => void; loaded: boolean; detail?: string
}) {
  return (
    <div style={{
      background: "#fff", borderRadius: 16,
      boxShadow: "0 1px 3px rgba(0,0,0,.06), 0 4px 16px rgba(0,0,0,.06)",
      overflow: "hidden", display: "flex", flexDirection: "column", transition: "box-shadow .2s, transform .2s",
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
            fontSize: 14, fontWeight: 800, color: accent, letterSpacing: "0.5px",
          }}>{icon}</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: "#0f172a", lineHeight: 1.2 }}>{title}</div>
            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{subtitle}</div>
          </div>
        </div>
        <UploadZone onFile={onFile} loaded={loaded} accent={accent} />
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

// ─── Main Dashboard ──────────────────────────────────────────────────────────
export default function OBDashboard() {
  const [metrics, setMetrics]       = useState<ObMetrics>(DEFAULT_METRICS)
  const [rehydrating, setRehydrating] = useState(true)
  const [uploading, setUploading]   = useState<string | null>(null)
  const [error, setError]           = useState<string | null>(null)

  useEffect(() => {
    const run = async () => {
      setRehydrating(true)
      await Promise.all([fetchTtp(), fetchNhe(), fetchLl60(), fetchTcr()])
      setRehydrating(false)
    }
    run()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ─── Fetch helpers (Supabase → computed state) ───────────────────────────

  const fetchTtp = async () => {
    const { data, error } = await supabase
      .from("time_to_productivity")
      .select("productivity_confirmed, ttp_days")
    if (error || !data?.length) return
    const confirmed = data.filter((r) => (r.productivity_confirmed ?? "").trim().toLowerCase() === "yes")
    const validDays  = confirmed.map((r) => r.ttp_days).filter((d): d is number => d !== null && d >= 0)
    const avgDays    = validDays.length ? Number((validDays.reduce((a, b) => a + b, 0) / validDays.length).toFixed(1)) : null
    const confirmRate = data.length ? Number(((confirmed.length / data.length) * 100).toFixed(1)) : null
    setMetrics((p) => ({ ...p, ttp: { avgDays, confirmRate, confirmed: confirmed.length, total: data.length, loaded: true } }))
  }

  const fetchNhe = async () => {
    // Select only the raw score columns we need for computation
    const { data, error } = await supabase
      .from("onboarding_30_day_survey")
      .select(`
        q4_1, q4_2, q4_3, q4_4, q4_5,
        q7_1, q7_2, q7_3,
        q10_1, q10_2, q10_3, q10_4, q10_5,
        q13_1, q13_2, q13_3, q13_4, q13_5,
        q22_1, q22_2, q22_3, q22_4,
        q25_1, q25_2, q25_3, q25_4, q25_5, q25_6, q25_7, q25_8,
        q28_1, q28_2, q28_3, q28_4,
        q31_1, q31_2, q31_3, q31_4, q31_5,
        q34_1,
        q38_1, q38_2, q38_3, q38_4, q38_5, q38_6, q38_7
      `)
    if (error || !data?.length) return
    const { categoryResults, overallFavorability, respondentCount } = calcNheFromSupabaseRows(
      data as Record<string, number | null>[]
    )
    setMetrics((p) => ({
      ...p,
      nhe: { favorability: overallFavorability, categories: categoryResults, responses: respondentCount, loaded: true },
    }))
  }

  const fetchLl60 = async () => {
    const { data, error } = await supabase
      .from("onboarding_60_day_sessions")
      .select("participant_count, avg_journey_rating, recommend_percent, overall_retention_risk, motivation_engagement, manager_relationship, team_belonging, workload_stress, growth_future_outlook, recognition_value")
    if (error || !data?.length) return
    const stats = calcLL60FromSupabaseRows(data)
    setMetrics((p) => ({ ...p, ll60: { ...stats, loaded: true } }))
  }

  const fetchTcr = async () => {
    const { data, error } = await supabase
      .from("training_completion")
      .select("total_enrolled, total_completed")
    if (error || !data?.length) return
    const enrolled  = data.reduce((s, r) => s + (r.total_enrolled  || 0), 0)
    const completed = data.reduce((s, r) => s + (r.total_completed || 0), 0)
    const rate      = enrolled ? Number(((completed / enrolled) * 100).toFixed(1)) : null
    setMetrics((p) => ({ ...p, tcr: { rate, enrolled, completed, loaded: true } }))
  }

  // ─── Upload helpers (batch insert → re-fetch) ────────────────────────────

  const createBatch = async (filename: string, uploadType: string, count: number) => {
    const { data, error } = await supabase
      .from("ex_batches")
      .insert({ filename, upload_type: uploadType, uploaded_by: "system", status: "processed", records_parsed: count, records_imported: count, records_rejected: 0 })
      .select()
      .single()
    if (error || !data) throw new Error("Batch creation failed: " + error?.message)
    return data.batch_id as string
  }

  // ── TTP ──────────────────────────────────────────────────────────────────
  const handleTtp = async (file: File) => {
    setUploading("ttp"); setError(null)
    try {
      const rows = await parseSheet(file)
      if (!rows.length) throw new Error("File is empty.")
      const keys         = Object.keys(rows[0])
      const confirmedKey = keys.find((k) => k.startsWith("productivity confirmed")) ?? "productivity confirmed"
      const confDateKey  = keys.find((k) => k.includes("confirmation date"))        ?? ""
      const confirmedByKey = keys.find((k) => k.includes("confirmed by"))           ?? ""
      const ttpKey       = keys.find((k) => k.includes("time to productivity") && k.includes("days")) ?? ""

      const batchId = await createBatch(file.name, "time_to_productivity", rows.length)
      const safeDate = (v: unknown): string | null => {
  if (!v) return null
  const trimmed = String(v).trim()
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return null
  const [, y, m, d] = match.map(Number)
  const date = new Date(y, m - 1, d)
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null
  return trimmed
}

const { error: insErr } = await supabase.from("time_to_productivity").insert(
  rows.map((r) => ({
    batch_id:               batchId,
    employee_id:            r["employee id"]?.toString()          || null,
    start_date:             safeDate(r["start date"]),
    role_job_family:        r["role / job family"]?.toString()    || null,
    delivery_unit:          r["delivery unit"]?.toString()        || null,
    productivity_threshold: r["productivity threshold"]?.toString() || null,
    productivity_confirmed: r[confirmedKey]?.toString()           || null,
    confirmation_date:      confDateKey    ? safeDate(r[confDateKey])    : null,
    confirmed_by:           confirmedByKey ? r[confirmedByKey]?.toString() || null : null,
    ttp_days:               ttpKey ? safeNum(r[ttpKey]) : null,
  }))
)
      if (insErr) throw new Error("Insert failed: " + insErr.message)
      await fetchTtp()
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setUploading(null)
    }
  }

  // ── NHE (LaunchLens30) — maps raw Q scores correctly ─────────────────────
  const handleNhe = async (file: File) => {
    setUploading("nhe"); setError(null)
    try {
      const rows = await parseSheet(file)
      if (!rows.length) throw new Error("File is empty.")

      // Validate by checking for at least one expected raw column
      const keys = Object.keys(rows[0])
      const hasRaw = keys.some((k) =>
        /^q\d+[._]\d+$/.test(k) || k === "q1" || k === "q2" || k === "q3" ||
        k.startsWith("ave_") || k.includes("ave_fde")
      )
      if (!hasRaw) throw new Error("File does not appear to be a LaunchLens 30 export. Expected Q4.1, Q4.2 … columns.")

      const batchId = await createBatch(file.name, "onboarding_30_day_survey", rows.length)

      const { error: insErr } = await supabase.from("onboarding_30_day_survey").insert(
        rows.map((r) => {
          // Normalise dot-notation keys (q4.1 → q4_1)
          const get = (col: string): number | null => {
            const dotKey = col.replace("_", ".")     // q4_1 → q4.1
            const val = r[col] ?? r[dotKey] ?? null
            return safeNum(val)
          }

          return {
            batch_id:        batchId,
            // ── Demographic / metadata ───────────────────────────────────
            first_name:      r["first name"]?.toString()                   || null,
            last_name:       r["last name"]?.toString()                    || null,
            email:           r["email"]?.toString()                        || null,
            // Date + Time are separate columns in the file; combine into submission_date if needed
            submission_date: r["date"]?.toString()                         || null,
            delivery_unit:   r["delivery unit"]?.toString()                || null,
            job_title:       r["job title"]?.toString()                    || null,
            project_name:    r["project name"]?.toString()                 || null,
            location:        r["location"]?.toString()                     || null,
            supervisor_name: r["name of immediate supervisor"]?.toString() || null,
            job_band:        r["job band"]?.toString()                     || null,
            employee_code:   r["employee code"]?.toString()                || null,
            hire_date:       r["hire date"]?.toString()                    || null,
            // ── Raw scores ───────────────────────────────────────────────
            q1:    get("q1"),
            q2:    get("q2"),
            q3:    get("q3"),
            // FDE (1–4)
            q4_1:  get("q4_1"),
            q4_2:  get("q4_2"),
            q4_3:  get("q4_3"),
            q4_4:  get("q4_4"),
            q4_5:  get("q4_5"),
            // RC (1–4)
            q7_1:  get("q7_1"),
            q7_2:  get("q7_2"),
            q7_3:  get("q7_3"),
            // MS (1–4)
            q10_1: get("q10_1"),
            q10_2: get("q10_2"),
            q10_3: get("q10_3"),
            q10_4: get("q10_4"),
            q10_5: get("q10_5"),
            // TC (1–4)
            q13_1: get("q13_1"),
            q13_2: get("q13_2"),
            q13_3: get("q13_3"),
            q13_4: get("q13_4"),
            q13_5: get("q13_5"),
            // Tools (1–4)
            q22_1: get("q22_1"),
            q22_2: get("q22_2"),
            q22_3: get("q22_3"),
            q22_4: get("q22_4"),
            // CWT (1–4)
            q25_1: get("q25_1"),
            q25_2: get("q25_2"),
            q25_3: get("q25_3"),
            q25_4: get("q25_4"),
            q25_5: get("q25_5"),
            q25_6: get("q25_6"),
            q25_7: get("q25_7"),
            q25_8: get("q25_8"),
            // DUT (1–4)
            q28_1: get("q28_1"),
            q28_2: get("q28_2"),
            q28_3: get("q28_3"),
            q28_4: get("q28_4"),
            // PGFO (1–4)
            q31_1: get("q31_1"),
            q31_2: get("q31_2"),
            q31_3: get("q31_3"),
            q31_4: get("q31_4"),
            q31_5: get("q31_5"),
            // OOE (1–5)
            q34_1: get("q34_1"),
            // HRSF (1–4)
            q38_1: get("q38_1"),
            q38_2: get("q38_2"),
            q38_3: get("q38_3"),
            q38_4: get("q38_4"),
            q38_5: get("q38_5"),
            q38_6: get("q38_6"),
            q38_7: get("q38_7"),
          }
        })
      )
      if (insErr) throw new Error("Insert failed: " + insErr.message)
      await fetchNhe()
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setUploading(null)
    }
  }

  // ── LL60 ─────────────────────────────────────────────────────────────────
  const handleLL60 = async (file: File) => {
    setUploading("ll60"); setError(null)
    try {
      const rows = await parseSheet(file)
      if (!rows.length) throw new Error("File is empty.")
      const keys = Object.keys(rows[0])
      const hasExpected = keys.some((k) =>
        k.includes("session") || k.includes("retention risk") || k.includes("motivation") ||
        k.includes("journey rating") || k.includes("recommend") || k.includes("team belonging") ||
        k.includes("manager relationship")
      )
      if (!hasExpected) throw new Error("File does not appear to be a LaunchLens 60 export.")

      const batchId = await createBatch(file.name, "onboarding_60_day_sessions", rows.length)
      const { error: insErr } = await supabase.from("onboarding_60_day_sessions").insert(
        rows.map((r) => ({
          batch_id:               batchId,
          session_id:             findVal(r, "session id")                    || null,
          session_date:           findVal(r, "session date")                  || null,
          hire_period:            findVal(r, "cycle / hire period")           || null,
          session_type:           findVal(r, "session type")                  || null,
          participant_count:      safeNum(findVal(r, "participant count")),
          delivery_unit:          findVal(r, "delivery unit")                 || null,
          location:               findVal(r, "location / work arrangement")   || null,
          facilitator_names:      findVal(r, "facilitator name(s)")           || null,
          motivation_engagement:  findVal(r, "motivation & engagement")       || null,
          manager_relationship:   findVal(r, "manager relationship")          || null,
          team_belonging:         findVal(r, "team belonging")                || null,
          workload_stress:        findVal(r, "workload & stress")             || null,
          growth_future_outlook:  findVal(r, "growth & future outlook")       || null,
          recognition_value:      findVal(r, "recognition & value")           || null,
          avg_journey_rating:     safeNum(findVal(r, "avg journey rating (1–5)", "avg journey rating (1-5)", "avg journey rating")),
          recommend_percent:      safeNum(findVal(r, "recommend % (yes)", "recommend % yes", "recommend %")),
          overall_retention_risk: findVal(r, "overall retention risk")        || null,
        }))
      )
      if (insErr) throw new Error("Insert failed: " + insErr.message)
      await fetchLl60()
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setUploading(null)
    }
  }

  // ── TCR ──────────────────────────────────────────────────────────────────
  const handleTcr = async (file: File) => {
    setUploading("tcr"); setError(null)
    try {
      const rows = await parseSheet(file)
      if (!rows.length) throw new Error("File is empty.")
      const keys         = Object.keys(rows[0])
      const enrollKey    = keys.find((k) => k.includes("enrolled in required training"))    ?? ""
      const completedKey = keys.find((k) => k.includes("completed all required training"))  ?? ""
      if (!enrollKey || !completedKey) throw new Error("Missing columns: enrolled / completed training.")

      const batchId = await createBatch(file.name, "training_completion", rows.length)
      const { error: insErr } = await supabase.from("training_completion").insert(
        rows.map((r) => ({
          batch_id:            batchId,
          cohort:              r["cohort"]?.toString()            || "Unknown",
          role_job_family:     r["role / job family"]?.toString() || null,
          training_modality:   r["training modality"]?.toString() || null,
          total_enrolled:      safeNum(r[enrollKey])              ?? 0,
          total_completed:     safeNum(r[completedKey])           ?? 0,
          completion_deadline: r["completion deadline"]?.toString() || null,
        }))
      )
      if (insErr) throw new Error("Insert failed: " + insErr.message)
      await fetchTcr()
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setUploading(null)
    }
  }

  // ─── Clear metric (delete all batches of that type) ───────────────────────
  const clearMetric = async (key: string) => {
    const uploadTypeMap: Record<string, { uploadType: string; table: string }> = {
      ttp:  { uploadType: "time_to_productivity",       table: "time_to_productivity" },
      nhe:  { uploadType: "onboarding_30_day_survey",   table: "onboarding_30_day_survey" },
      ll60: { uploadType: "onboarding_60_day_sessions", table: "onboarding_60_day_sessions" },
      tcr:  { uploadType: "training_completion",        table: "training_completion" },
    }
    const target = uploadTypeMap[key]
    if (!target) return

    // Cascade delete via ex_batches (data rows deleted by FK cascade)
    const { data: batches } = await supabase
      .from("ex_batches")
      .select("batch_id")
      .eq("upload_type", target.uploadType)

    if (batches?.length) {
      const ids = batches.map((b) => b.batch_id)
      await supabase.from(target.table).delete().in("batch_id", ids)
      await supabase.from("ex_batches").delete().in("batch_id", ids)
    }

    const defaults: Record<string, object> = {
      ttp:  { avgDays: null, confirmRate: null, confirmed: 0, total: 0, loaded: false },
      nhe:  { favorability: null, categories: {}, responses: 0, loaded: false },
      ll60: { overallPositivity: null, avgRating: null, avgRecommend: null, riskCounts: { low: 0, medium: 0, high: 0 }, sessionCount: 0, participantCount: 0, loaded: false },
      tcr:  { rate: null, enrolled: 0, completed: 0, loaded: false },
    }
    setMetrics((p) => ({ ...p, [key]: defaults[key] }))
  }

  // ─── Card config ──────────────────────────────────────────────────────────
  const cards = [
    { key: "ttp",  icon: "TTP", title: "Time to Productivity",     subtitle: "Avg. days to confirmed productive",                 value: metrics.ttp.avgDays,              unit: "days",  accent: "#f59e0b", onFile: handleTtp,  loaded: metrics.ttp.loaded,  detail: "Lower is better"           },
    { key: "nhe",  icon: "30",  title: "30-Day Experience",         subtitle: "LaunchLens30 · Overall favorability",               value: metrics.nhe.favorability,         unit: "%",     accent: "#8b5cf6", onFile: handleNhe,  loaded: metrics.nhe.loaded,  detail: "Avg across 10 categories"  },
    { key: "ll60", icon: "60",  title: "60-Day Experience",         subtitle: "LaunchLens60 · Positive signal rate",               value: metrics.ll60.overallPositivity,   unit: "%",     accent: "#10b981", onFile: handleLL60, loaded: metrics.ll60.loaded, detail: "Across 6 retention drivers" },
    { key: "tcr",  icon: "TCR", title: "Training Completion Rate",  subtitle: "Mandatory onboarding training",                     value: metrics.tcr.rate,                 unit: "%",     accent: "#06b6d4", onFile: handleTcr,  loaded: metrics.tcr.loaded,  detail: "Target ≥ 90%"              },
  ]

  const anyLoaded = cards.some((c) => c.loaded)

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>

      {/* Status bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {cards.map((m) => (
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
        {rehydrating && (
          <div style={{ fontSize: 11, color: "#94a3b8", display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "#8b5cf6", animation: "pulse 1s infinite" }} />
            Syncing…
            <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}`}</style>
          </div>
        )}
        {uploading && (
          <div style={{ fontSize: 11, color: "#06b6d4", display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "#06b6d4", animation: "pulse 1s infinite" }} />
            Uploading {uploading.toUpperCase()}…
          </div>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 10, padding: "10px 14px", fontSize: 12, color: "#dc2626", marginBottom: 16, display: "flex", justifyContent: "space-between" }}>
          <span>⚠ {error}</span>
          <button onClick={() => setError(null)} style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", fontWeight: 700 }}>×</button>
        </div>
      )}

      {/* Metric cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 20, marginBottom: 36 }}>
        {cards.map(({ key: _k, ...m }) => <MetricCard key={m.title} {...m} />)}
      </div>

      {/* Summary snapshot */}
      {anyLoaded && (
        <>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 14 }}>📊 Onboarding Phase Summary</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

            {metrics.ttp.loaded && (
              <SummaryCard accent="#f59e0b" label="Time to Productivity" onClear={() => clearMetric("ttp")}>
                <BenchmarkRow label="Avg. Days to Productive" value={metrics.ttp.avgDays ?? 0} target={90} accent="#f59e0b" unit=" days" />
                <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
                  {metrics.ttp.confirmed} of {metrics.ttp.total} confirmed productive · Confirm rate: {metrics.ttp.confirmRate ?? "—"}%
                </div>
              </SummaryCard>
            )}

            {metrics.nhe.loaded && (
  <SummaryCard
    accent="#8b5cf6"
    label="LaunchLens 30-Day Experience"
    onClear={() => clearMetric("nhe")}
  >
    <BenchmarkRow
      label="Overall Favorability"
      value={metrics.nhe.favorability ?? 0}
      target={100}
      accent="#8b5cf6"
    />
  </SummaryCard>
)}

            {metrics.ll60.loaded && (
  <SummaryCard
    accent="#10b981"
    label="LaunchLens 60-Day Experience"
    onClear={() => clearMetric("ll60")}
  >
    <BenchmarkRow
      label="Positive Signal Rate"
      value={metrics.ll60.overallPositivity ?? 0}
      target={100}
      accent="#10b981"
    />
  </SummaryCard>
)}

            {metrics.tcr.loaded && (
              <SummaryCard accent="#06b6d4" label="Training Completion" onClear={() => clearMetric("tcr")}>
                <BenchmarkRow label="Completion Rate" value={metrics.tcr.rate ?? 0} target={100} accent="#06b6d4" />
                <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
                  {metrics.tcr.completed} of {metrics.tcr.enrolled} completions
                </div>
              </SummaryCard>
            )}

          </div>
        </>
      )}
    </div>
  )
}

// ─── SummaryCard helper ───────────────────────────────────────────────────────
function SummaryCard({ accent, label, onClear, children }: {
  accent: string; label: string; onClear: () => void; children: React.ReactNode
}) {
  return (
    <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 1px 3px rgba(0,0,0,.06), 0 4px 16px rgba(0,0,0,.06)", padding: "18px 22px", position: "relative" }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: accent, textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 10 }}>{label}</div>
      {children}
      <button
        onClick={onClear}
        title="Clear all data for this metric"
        style={{ position: "absolute", top: 12, right: 12, background: "#ef4444", color: "#fff", border: "none", borderRadius: "50%", width: 20, height: 20, fontSize: 11, cursor: "pointer", lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center" }}
      >×</button>
    </div>
  )
}