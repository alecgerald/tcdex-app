"use client"

import { useState, useRef, useEffect } from "react"
import * as XLSX from "xlsx"
import { createClient } from "@/utils/supabase/client"

const supabase = createClient()

interface RowObject { [key: string]: string | number }
interface UploadZoneProps { onFile: (file: File) => void; loaded: boolean; loading?: boolean }
interface MetricCardProps {
  icon: string; title: string; subtitle: string
  value: string | number | null; unit?: string; accent: string
  onFile: (file: File) => void; loaded: boolean; loading?: boolean; detail?: string
}

// ─── Toast ────────────────────────────────────────────────
type ToastType = "error" | "success" | "info"
interface Toast { id: number; message: string; type: ToastType }

function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  const colors: Record<ToastType, { bg: string; border: string; color: string }> = {
    error:   { bg: "#FEF2F2", border: "#FCA5A5", color: "#B91C1C" },
    success: { bg: "#F0FDF4", border: "#86EFAC", color: "#15803D" },
    info:    { bg: "#EFF6FF", border: "#93C5FD", color: "#1D4ED8" },
  }
  return (
    <div style={{ position: "fixed", bottom: 24, right: 24, display: "flex", flexDirection: "column", gap: 8, zIndex: 9999 }}>
      {toasts.map(t => {
        const c = colors[t.type]
        return (
          <div key={t.id} style={{
            background: c.bg, border: `1px solid ${c.border}`, borderRadius: 10,
            padding: "10px 14px", display: "flex", alignItems: "center", gap: 10,
            maxWidth: 360, boxShadow: "0 4px 12px rgba(0,0,0,.1)", fontSize: 13, color: c.color,
          }}>
            <span style={{ flex: 1, whiteSpace: "pre-wrap" }}>{t.message}</span>
            <button onClick={() => onDismiss(t.id)} style={{ background: "none", border: "none", cursor: "pointer", color: c.color, fontSize: 16, lineHeight: 1 }}>×</button>
          </div>
        )
      })}
    </div>
  )
}

let toastId = 0
function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([])
  const dismiss = (id: number) => setToasts(p => p.filter(t => t.id !== id))
  const show = (message: string, type: ToastType = "info", duration = 5000) => {
    const id = ++toastId
    setToasts(p => [...p, { id, message, type }])
    setTimeout(() => dismiss(id), duration)
  }
  return { toasts, dismiss, show }
}

// ─── Helpers ──────────────────────────────────────────────
const normalizeKey = (k: string) => k.trim().toLowerCase().replace(/\s+/g, " ")

const parseSheet = (file: File): Promise<RowObject[]> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = evt => {
      try {
        const arrayBuffer = evt.target?.result
        if (!arrayBuffer) return resolve([])
        const wb = XLSX.read(arrayBuffer, { type: "array" })
        const rows = XLSX.utils.sheet_to_json<RowObject>(wb.Sheets[wb.SheetNames[0]])
        resolve(rows.map(row => {
          const obj: RowObject = {}
          Object.keys(row).forEach(k => { obj[normalizeKey(k)] = row[k] })
          return obj
        }))
      } catch (e) { reject(e) }
    }
    reader.onerror = () => reject(new Error("Failed to read file"))
    reader.readAsArrayBuffer(file)
  })

function findCol(keys: string[], ...fragments: string[]): string {
  return keys.find(k => fragments.every(f => k.includes(f.toLowerCase()))) ?? ""
}

// ─── Likert helpers ───────────────────────────────────────
const LIKERT: Record<string, number> = {
  "strongly agree": 5, "agree": 4, "neutral": 3, "disagree": 2, "strongly disagree": 1,
}
const toLikert = (v: string | number | undefined): number | null => {
  if (v === null || v === undefined || v === "") return null
  if (typeof v === "number" && v >= 1 && v <= 5) return v
  const mapped = LIKERT[(String(v)).trim().toLowerCase()]
  return mapped !== undefined ? mapped : null
}

// ─── Excel serial date → ISO string ──────────────────────
function excelDateToISO(val: string | number): string | null {
  if (!val) return null
  if (typeof val === "string" && val.match(/^\d{4}-\d{2}-\d{2}/)) return val.substring(0, 10)
  const n = Number(val)
  if (!isNaN(n) && n > 1000) {
    const d = new Date(Math.round((n - 25569) * 86400 * 1000))
    return d.toISOString().substring(0, 10)
  }
  // Try parsing string dates like "01/15/2024"
  const parsed = new Date(val as string)
  if (!isNaN(parsed.getTime())) return parsed.toISOString().substring(0, 10)
  return null
}

// ─── UploadZone ───────────────────────────────────────────
function UploadZone({ onFile, loaded, loading }: UploadZoneProps) {
  const ref = useRef<HTMLInputElement>(null)
  const [drag, setDrag] = useState(false)
  const handle = (file?: File) => { if (file && !loading) onFile(file) }
  return (
    <div
      onClick={() => !loading && ref.current?.click()}
      onDragOver={e => { e.preventDefault(); if (!loading) setDrag(true) }}
      onDragLeave={() => setDrag(false)}
      onDrop={e => { e.preventDefault(); setDrag(false); handle(e.dataTransfer.files[0]) }}
      style={{
        border: `1.5px dashed ${drag ? "#6366f1" : loaded ? "#22c55e" : loading ? "#94a3b8" : "#cbd5e1"}`,
        borderRadius: 10, padding: "12px 10px", cursor: loading ? "not-allowed" : "pointer",
        background: drag ? "#eef2ff" : loaded ? "#f0fdf4" : "#f8fafc",
        textAlign: "center", fontSize: 12,
        color: loaded ? "#16a34a" : "#94a3b8",
        transition: "all .2s", marginBottom: 16, userSelect: "none",
        opacity: loading ? 0.6 : 1,
      }}
    >
      <input ref={ref} type="file" accept=".xlsx,.xls,.csv" hidden onChange={e => handle(e.target.files?.[0])} />
      {loading
        ? <><span style={{ fontSize: 16 }}>⏳</span><br />Uploading…</>
        : loaded
        ? <><span style={{ fontSize: 16 }}>✓</span> File loaded — drop a new file to replace</>
        : <><span style={{ fontSize: 16 }}>↑</span><br />Drop or click to upload<br />.xlsx / .xls / .csv</>}
    </div>
  )
}

// ─── MetricCard ───────────────────────────────────────────
function MetricCard({ icon, title, subtitle, value, unit, accent, onFile, loaded, loading, detail }: MetricCardProps) {
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
            fontSize: 16, fontWeight: 800, color: accent, letterSpacing: "0.5px",
          }}>{icon}</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: "#0f172a", lineHeight: 1.2 }}>{title}</div>
            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{subtitle}</div>
          </div>
        </div>
        <UploadZone onFile={onFile} loaded={loaded} loading={loading} />
        <div style={{
          background: `linear-gradient(135deg, ${accent}10, ${accent}05)`,
          border: "1px solid " + accent + "22", borderRadius: 12, padding: "14px 16px",
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#64748b", letterSpacing: ".04em", textTransform: "uppercase", marginBottom: 4 }}>Result</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
              <span style={{ fontSize: 32, fontWeight: 800, color: accent, lineHeight: 1 }}>{value ?? "—"}</span>
              {unit && value != null && <span style={{ fontSize: 14, fontWeight: 600, color: accent + "aa" }}>{unit}</span>}
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

// ─── OES Q definitions ────────────────────────────────────
const OES_Q_KEYS = [
  { prefix: "q1", label: "Respect" },
  { prefix: "q2", label: "Clarity" },
  { prefix: "q3", label: "Fairness" },
  { prefix: "q4", label: "Overall Experience" },
]

// ─── State shape ─────────────────────────────────────────
interface OffboardingMetrics {
  eicr: { value: number | null; exits: number; completed: number; waived: number; loaded: boolean; loading: boolean }
  oes:  { value: number | null; responses: number; itemScores: Record<string, number>; loaded: boolean; loading: boolean }
}

const defaultState: OffboardingMetrics = {
  eicr: { value: null, exits: 0, completed: 0, waived: 0, loaded: false, loading: false },
  oes:  { value: null, responses: 0, itemScores: {}, loaded: false, loading: false },
}

// ─── Map Supabase rows → computed metrics ─────────────────
function computeEicrFromDB(data: any[]) {
  const totalExits     = data.reduce((s, r) => s + (r.total_exits || 0), 0)
  const totalCompleted = data.reduce((s, r) => s + (r.completed_interviews || 0), 0)
  const totalWaived    = data.reduce((s, r) => s + (r.waived_cases || 0), 0)
  const rate = totalExits ? Number(((totalCompleted / totalExits) * 100).toFixed(1)) : null
  return { value: rate, exits: totalExits, completed: totalCompleted, waived: totalWaived }
}

function computeOesFromDB(data: any[]) {
  const dbKeys = ["q1_respect", "q2_clarity", "q3_fairness", "q4_overall_experience"]
  const labels = ["Respect", "Clarity", "Fairness", "Overall Experience"]
  const coreIdxs = [0, 1, 2] // exclude Q4 from composite

  let totalFav = 0; let totalItems = 0
  const itemScores: Record<string, number> = {}

  dbKeys.forEach((key, i) => {
    let fav = 0; let n = 0
    data.forEach(r => {
      const score = toLikert(r[key])
      if (score !== null) { n++; if (score >= 4) fav++ }
    })
    itemScores[labels[i]] = n ? Number(((fav / n) * 100).toFixed(1)) : 0
    if (coreIdxs.includes(i)) { totalFav += fav; totalItems += n }
  })

  const value = totalItems ? Number(((totalFav / totalItems) * 100).toFixed(1)) : null
  return { value, responses: data.length, itemScores }
}

// ─── Get current user ─────────────────────────────────────
async function getUserId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser()
  return user?.id ?? "anonymous"
}

export default function OffboardingDashboard() {
  const [metrics, setMetrics]     = useState<OffboardingMetrics>(defaultState)
  const [rehydrating, setRehydrating] = useState(true)
  const { toasts, dismiss, show } = useToast()

  // ─── Rehydrate from Supabase on mount ────────────────────
  useEffect(() => {
    const rehydrate = async () => {
      setRehydrating(true)
      try {
        // EICR
        const { data: eicrData, error: eicrErr } = await supabase
          .from("exit_interview_completion")
          .select("total_exits, completed_interviews, waived_cases")

        if (eicrErr) throw new Error(`EICR fetch: ${eicrErr.message}`)
        if (eicrData && eicrData.length > 0) {
          const computed = computeEicrFromDB(eicrData)
          setMetrics(prev => ({ ...prev, eicr: { ...prev.eicr, ...computed, loaded: true } }))
        }

        // OES
        const { data: oesData, error: oesErr } = await supabase
          .from("offboarding_experience_responses")
          .select("q1_respect, q2_clarity, q3_fairness, q4_overall_experience")

        if (oesErr) throw new Error(`OES fetch: ${oesErr.message}`)
        if (oesData && oesData.length > 0) {
          const computed = computeOesFromDB(oesData)
          setMetrics(prev => ({ ...prev, oes: { ...prev.oes, ...computed, loaded: true } }))
        }
      } catch (e: any) {
        show(`Failed to load saved data: ${e.message}`, "error")
      } finally {
        setRehydrating(false)
      }
    }
    rehydrate()
  }, [])

  // ─── EICR Handler ─────────────────────────────────────────
  const handleEicr = async (file: File) => {
    setMetrics(prev => ({ ...prev, eicr: { ...prev.eicr, loading: true } }))
    try {
      let rows: RowObject[]
      try { rows = await parseSheet(file) }
      catch { show("Could not read file. Make sure it's a valid .xlsx, .xls, or .csv.", "error"); return }
      if (!rows.length) { show("The file appears to be empty.", "error"); return }

      const keys        = Object.keys(rows[0])
      const exitsKey    = findCol(keys, "total number of employee exits") || findCol(keys, "total exits") || findCol(keys, "exits")
      const completedKey = findCol(keys, "number of completed exit interviews") || findCol(keys, "completed exit") || findCol(keys, "completed interviews") || findCol(keys, "completed")
      const waivedKey   = findCol(keys, "waived") || findCol(keys, "unreachable")

      const missing: string[] = []
      if (!exitsKey)     missing.push("Total Exits (e.g. 'Total Number of Employee Exits')")
      if (!completedKey) missing.push("Completed Interviews (e.g. 'Number of Completed Exit Interviews')")
      if (missing.length) {
        show(`Missing required columns:\n• ${missing.join("\n• ")}\n\nFound: ${keys.join(", ")}`, "error", 10000)
        setMetrics(prev => ({ ...prev, eicr: { ...prev.eicr, loading: false } }))
        return
      }

      const uploadedBy = await getUserId()

      const { data: batch, error: batchError } = await supabase
        .from("ex_batches")
        .insert({ filename: file.name, upload_type: "exit_interview_completion", uploaded_by: uploadedBy, status: "processed", records_parsed: rows.length, records_imported: rows.length, records_rejected: 0 })
        .select()
        .single()

      if (batchError || !batch) throw new Error(batchError?.message ?? "Failed to create batch record")

      const { error: insertError } = await supabase
        .from("exit_interview_completion")
        .insert(rows.map(r => ({
          batch_id:               batch.batch_id,
          reporting_period:       String(r["reporting period"] || r["period"] || "Unknown"),
          exit_type:              r["exit type"]     ? String(r["exit type"])     : null,
          delivery_unit:          r["delivery unit"] ? String(r["delivery unit"]) : null,
          tenure_band:            r["tenure band"]   ? String(r["tenure band"])   : null,
          total_exits:            Number(r[exitsKey])     || 0,
          completed_interviews:   Number(r[completedKey]) || 0,
          waived_cases:           waivedKey && r[waivedKey] ? Number(r[waivedKey]) : 0,
        })))

      if (insertError) {
        await supabase.from("ex_batches").delete().eq("batch_id", batch.batch_id)
        throw new Error(insertError.message)
      }

      // Refetch all and recompute
      const { data: allData, error: fetchErr } = await supabase
        .from("exit_interview_completion")
        .select("total_exits, completed_interviews, waived_cases")

      if (fetchErr) throw new Error(fetchErr.message)

      const computed = computeEicrFromDB(allData ?? [])
      setMetrics(prev => ({ ...prev, eicr: { ...computed, loaded: true, loading: false } }))
      show(`EICR: ${rows.length} rows imported successfully.`, "success")
    } catch (e: any) {
      show(`EICR upload failed: ${e.message}`, "error")
      setMetrics(prev => ({ ...prev, eicr: { ...prev.eicr, loading: false } }))
    }
  }

  // ─── OES Handler ─────────────────────────────────────────
  const handleOes = async (file: File) => {
    setMetrics(prev => ({ ...prev, oes: { ...prev.oes, loading: true } }))
    try {
      let rows: RowObject[]
      try { rows = await parseSheet(file) }
      catch { show("Could not read file. Make sure it's a valid .xlsx, .xls, or .csv.", "error"); return }
      if (!rows.length) { show("The file appears to be empty.", "error"); return }

      const keys = Object.keys(rows[0])

      // Resolve Q column keys flexibly
      const resolvedQKeys = OES_Q_KEYS.map(q => ({
        ...q,
        resolved: keys.find(k => k.startsWith(q.prefix)) ?? "",
      }))

      const missingQ = resolvedQKeys.filter(q => !q.resolved)
      if (missingQ.length) {
        show(`Missing survey columns: ${missingQ.map(q => q.prefix.toUpperCase() + " " + q.label).join(", ")}.\n\nFound: ${keys.join(", ")}`, "error", 10000)
        setMetrics(prev => ({ ...prev, oes: { ...prev.oes, loading: false } }))
        return
      }

      // Validate exit_date exists
      const dateKey = findCol(keys, "exit date") || findCol(keys, "date")
      if (!dateKey) {
        show(`Missing required column: 'Exit Date'.\n\nFound: ${keys.join(", ")}`, "error", 10000)
        setMetrics(prev => ({ ...prev, oes: { ...prev.oes, loading: false } }))
        return
      }

      const uploadedBy = await getUserId()

      const { data: batch, error: batchError } = await supabase
        .from("ex_batches")
        .insert({ filename: file.name, upload_type: "offboarding_experience", uploaded_by: uploadedBy, status: "processed", records_parsed: rows.length, records_imported: rows.length, records_rejected: 0 })
        .select()
        .single()

      if (batchError || !batch) throw new Error(batchError?.message ?? "Failed to create batch record")

      // Build insert payload — skip rows where exit_date can't be parsed (DB requires NOT NULL DATE)
      const insertPayload = rows
        .map(r => {
          const exitDate = excelDateToISO(r[dateKey] as string | number)
          if (!exitDate) return null
          return {
            batch_id:              batch.batch_id,
            exit_date:             exitDate,
            exit_type:             r["exit type"]     ? String(r["exit type"])     : null,
            delivery_unit:         r["delivery unit"] ? String(r["delivery unit"]) : null,
            tenure_band:           r["tenure band"]   ? String(r["tenure band"])   : null,
            q1_respect:            resolvedQKeys[0].resolved ? String(r[resolvedQKeys[0].resolved] ?? "") || null : null,
            q2_clarity:            resolvedQKeys[1].resolved ? String(r[resolvedQKeys[1].resolved] ?? "") || null : null,
            q3_fairness:           resolvedQKeys[2].resolved ? String(r[resolvedQKeys[2].resolved] ?? "") || null : null,
            q4_overall_experience: resolvedQKeys[3].resolved ? String(r[resolvedQKeys[3].resolved] ?? "") || null : null,
            open_comment:          r["open comment"] ? String(r["open comment"]) : null,
          }
        })
        .filter(Boolean)

      const rejected = rows.length - insertPayload.length
      if (!insertPayload.length) {
        await supabase.from("ex_batches").delete().eq("batch_id", batch.batch_id)
        show("No valid rows found — all rows were missing a parseable Exit Date.", "error")
        setMetrics(prev => ({ ...prev, oes: { ...prev.oes, loading: false } }))
        return
      }

      const { error: insertError } = await supabase
        .from("offboarding_experience_responses")
        .insert(insertPayload)

      if (insertError) {
        await supabase.from("ex_batches").delete().eq("batch_id", batch.batch_id)
        throw new Error(insertError.message)
      }

      // Update batch with actual counts
      await supabase
        .from("ex_batches")
        .update({ records_imported: insertPayload.length, records_rejected: rejected })
        .eq("batch_id", batch.batch_id)

      // Refetch all and recompute
      const { data: allData, error: fetchErr } = await supabase
        .from("offboarding_experience_responses")
        .select("q1_respect, q2_clarity, q3_fairness, q4_overall_experience")

      if (fetchErr) throw new Error(fetchErr.message)

      const computed = computeOesFromDB(allData ?? [])
      setMetrics(prev => ({ ...prev, oes: { ...computed, loaded: true, loading: false } }))

      const msg = rejected > 0
        ? `OES: ${insertPayload.length} rows imported. ${rejected} row(s) skipped — unparseable Exit Date.`
        : `OES: ${insertPayload.length} responses imported successfully.`
      show(msg, rejected > 0 ? "info" : "success")
    } catch (e: any) {
      show(`OES upload failed: ${e.message}`, "error")
      setMetrics(prev => ({ ...prev, oes: { ...prev.oes, loading: false } }))
    }
  }

  // ─── Clear helpers ────────────────────────────────────────
  const clearEicr = async () => {
    try {
      const { data: batches } = await supabase.from("ex_batches").select("batch_id").eq("upload_type", "exit_interview_completion")
      if (batches?.length) {
        const ids = batches.map(b => b.batch_id)
        await supabase.from("exit_interview_completion").delete().in("batch_id", ids)
        await supabase.from("ex_batches").delete().in("batch_id", ids)
      }
      setMetrics(prev => ({ ...prev, eicr: defaultState.eicr }))
      show("EICR data cleared.", "info")
    } catch (e: any) {
      show(`Clear failed: ${e.message}`, "error")
    }
  }

  const clearOes = async () => {
    try {
      const { data: batches } = await supabase.from("ex_batches").select("batch_id").eq("upload_type", "offboarding_experience")
      if (batches?.length) {
        const ids = batches.map(b => b.batch_id)
        await supabase.from("offboarding_experience_responses").delete().in("batch_id", ids)
        await supabase.from("ex_batches").delete().in("batch_id", ids)
      }
      setMetrics(prev => ({ ...prev, oes: defaultState.oes }))
      show("OES data cleared.", "info")
    } catch (e: any) {
      show(`Clear failed: ${e.message}`, "error")
    }
  }

  const anyLoaded = metrics.eicr.loaded || metrics.oes.loaded

  const metricCards = [
    {
      key: "eicr", icon: "ECR",
      title: "Exit Interview Completion Rate",
      subtitle: "Eligible exits that completed an exit interview or survey",
      value: metrics.eicr.value,
      unit: "%",
      accent: "#6366f1",
      onFile: handleEicr, loaded: metrics.eicr.loaded, loading: metrics.eicr.loading,
      detail: "Completed ÷ Total Exits",
    },
    {
      key: "oes", icon: "OES",
      title: "Offboarding Experience Score",
      subtitle: "Favorable ratings on respect, clarity, and fairness",
      value: metrics.oes.value,
      unit: "%",
      accent: "#0ea5e9",
      onFile: handleOes, loaded: metrics.oes.loaded, loading: metrics.oes.loading,
      detail: "Agree / Strongly Agree rate",
    },
  ]

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      <ToastContainer toasts={toasts} onDismiss={dismiss} />

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
            <span style={{ fontSize: 13 }}>{m.loading ? "◌" : m.loaded ? "●" : "○"}</span> {m.title}
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

            {/* EICR Detail */}
            {metrics.eicr.loaded && (
              <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 1px 3px rgba(0,0,0,.06), 0 4px 16px rgba(0,0,0,.06)", padding: "18px 22px", position: "relative" }}>
                <button onClick={clearEicr} title="Clear EICR data" style={{ position: "absolute", top: 12, right: 12, background: "#ef4444", color: "#fff", border: "none", borderRadius: "50%", width: 18, height: 18, fontSize: 10, cursor: "pointer" }}>×</button>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#6366f1", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 10 }}> Exit Interview Completion Rate</div>
                <BenchmarkRow label="Completion Rate (EICR)" value={metrics.eicr.value ?? 0} target={100} accent="#6366f1" unit="%" />
                <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4, display: "flex", gap: 16 }}>
                  <span><strong>{metrics.eicr.completed}</strong> of <strong>{metrics.eicr.exits}</strong> exits completed</span>
                  {metrics.eicr.waived > 0 && <span><strong>{metrics.eicr.waived}</strong> waived / unreachable</span>}
                </div>
              </div>
            )}

            {/* OES Detail */}
            {metrics.oes.loaded && (
  <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 1px 3px rgba(0,0,0,.06), 0 4px 16px rgba(0,0,0,.06)", padding: "18px 22px", position: "relative" }}>
    
    <button 
      onClick={clearOes} 
      title="Clear OES data" 
      style={{ position: "absolute", top: 12, right: 12, background: "#ef4444", color: "#fff", border: "none", borderRadius: "50%", width: 18, height: 18, fontSize: 10, cursor: "pointer" }}
    >
      ×
    </button>

    <div style={{ fontSize: 11, fontWeight: 700, color: "#0ea5e9", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 10 }}>
      Offboarding Experience Score
    </div>

    {/* ✅ Keep this */}
    <BenchmarkRow 
      label="Overall OES" 
      value={metrics.oes.value ?? 0} 
      target={100} 
      accent="#0ea5e9" 
      unit="%" 
    />

    {/* ✅ Keep this */}
    <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 8 }}>
      {metrics.oes.responses} survey responses
    </div>

  </div>
)}

          </div>
        </>
      )}
    </div>
  )
}