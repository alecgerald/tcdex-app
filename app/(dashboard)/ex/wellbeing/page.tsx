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
            maxWidth: 340, boxShadow: "0 4px 12px rgba(0,0,0,.1)", fontSize: 13, color: c.color,
          }}>
            <span style={{ flex: 1 }}>{t.message}</span>
            <button onClick={() => onDismiss(t.id)} style={{ background: "none", border: "none", cursor: "pointer", color: c.color, fontSize: 16, lineHeight: 1 }}>×</button>
          </div>
        )
      })}
    </div>
  )
}

// ─── Toast hook ───────────────────────────────────────────
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
      } catch (e) {
        reject(e)
      }
    }
    reader.onerror = () => reject(new Error("Failed to read file"))
    reader.readAsArrayBuffer(file)
  })

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
        border: `1.5px dashed ${drag ? "#7C3AED" : loaded ? "#059669" : loading ? "#94a3b8" : "#cbd5e1"}`,
        borderRadius: 10, padding: "12px 10px", cursor: loading ? "not-allowed" : "pointer",
        background: drag ? "#F5F3FF" : loaded ? "#ECFDF5" : loading ? "#f8fafc" : "#f8fafc",
        textAlign: "center", fontSize: 12,
        color: loaded ? "#059669" : loading ? "#94a3b8" : "#94a3b8",
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
    <div style={{
      background: "#fff", borderRadius: 16,
      boxShadow: "0 1px 3px rgba(0,0,0,.06), 0 4px 16px rgba(0,0,0,.06)",
      overflow: "hidden", display: "flex", flexDirection: "column", transition: "box-shadow .2s, transform .2s",
    }}
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

// ─── EWI helpers ─────────────────────────────────────────
const Q_KEYS_PREFIXES = ["q1", "q2", "q3", "q4", "q5", "q6", "q7"]

const resolveQKeys = (rows: RowObject[]): string[] => {
  if (!rows.length) return Q_KEYS_PREFIXES
  const allKeys = [...new Set(rows.flatMap(r => Object.keys(r)))]
  return Q_KEYS_PREFIXES.map(prefix => allKeys.find(k => k.startsWith(prefix)) ?? prefix)
}

function computeEwiOverall(rows: RowObject[]): number | null {
  const resolved = resolveQKeys(rows)
  const vals = rows.flatMap(r =>
    resolved.map(k => toLikert(r[k] as string | number | undefined)).filter((v): v is number => v !== null)
  )
  return vals.length ? Number((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2)) : null
}

// ─── Flexible column finder ───────────────────────────────
function findCol(keys: string[], ...fragments: string[]): string {
  return keys.find(k => fragments.every(f => k.includes(f.toLowerCase()))) ?? ""
}

// ─── State shape ─────────────────────────────────────────
interface WellbeingMetrics {
  ewi: {
    value: number | null
    loaded: boolean
    loading: boolean
  }
  uwp: {
    value: number | null
    loaded: boolean
    loading: boolean
  }
}

const defaultState: WellbeingMetrics = {
  ewi: { value: null, loaded: false, loading: false },
  uwp: { value: null, loaded: false, loading: false },
}

// ─── Helper to map Supabase EWI row → RowObject ───────────
const mapEwiRow = (r: any): RowObject => ({
  "survey period":        r.survey_period        ?? "",
  "function":             r.function             ?? "",
  "role level":           r.role_level           ?? "",
  "location":             r.location             ?? "",
  "tenure band":          r.tenure_band          ?? "",
  "q1 physical health":   r.q1_physical_health   ?? "",
  "q2 work environment":  r.q2_work_environment  ?? "",
  "q3 stress management": r.q3_stress_management ?? "",
  "q4 manager support":   r.q4_manager_support   ?? "",
  "q5 work life balance": r.q5_work_life_balance ?? "",
  "q6 inclusion support": r.q6_inclusion_support ?? "",
  "q7 relationships":     r.q7_relationships     ?? "",
})

export default function WellbeingDashboard() {
  const [metrics, setMetrics] = useState<WellbeingMetrics>(defaultState)
  const [rehydrating, setRehydrating] = useState(true)
  const { toasts, dismiss, show } = useToast()

  // ─── Get current user id ──────────────────────────────────
  const getUserId = async (): Promise<string> => {
    const { data: { user } } = await supabase.auth.getUser()
    return user?.id ?? "anonymous"
  }

  // ─── Rehydrate from Supabase on mount ────────────────────
  useEffect(() => {
    const rehydrate = async () => {
      setRehydrating(true)
      try {
        const { data: ewiData, error: ewiErr } = await supabase
          .from("employee_wellbeing_responses")
          .select("q1_physical_health, q2_work_environment, q3_stress_management, q4_manager_support, q5_work_life_balance, q6_inclusion_support, q7_relationships")

        if (ewiErr) throw new Error(`EWI fetch: ${ewiErr.message}`)

        if (ewiData && ewiData.length > 0) {
          const rows  = ewiData.map(mapEwiRow)
          const value = computeEwiOverall(rows)
          setMetrics(prev => ({ ...prev, ewi: { value, loaded: true, loading: false } }))
        }

        const { data: uwpData, error: uwpErr } = await supabase
          .from("wellbeing_program_utilization")
          .select("total_eligible, participants")

        if (uwpErr) throw new Error(`UWP fetch: ${uwpErr.message}`)

        if (uwpData && uwpData.length > 0) {
          const totalElig = uwpData.reduce((s, r) => s + (r.total_eligible || 0), 0)
          const totalPart = uwpData.reduce((s, r) => s + (r.participants    || 0), 0)
          const value     = totalElig ? Number(((totalPart / totalElig) * 100).toFixed(1)) : null
          setMetrics(prev => ({ ...prev, uwp: { value, loaded: true, loading: false } }))
        }
      } catch (e: any) {
        show(`Failed to load saved data: ${e.message}`, "error")
      } finally {
        setRehydrating(false)
      }
    }
    rehydrate()
  }, [])

  // ─── EWI Handler ─────────────────────────────────────────
  const handleEwi = async (file: File) => {
    setMetrics(prev => ({ ...prev, ewi: { ...prev.ewi, loading: true } }))
    try {
      let rows: RowObject[]
      try {
        rows = await parseSheet(file)
      } catch {
        show("Could not read file. Make sure it's a valid .xlsx, .xls, or .csv.", "error")
        return
      }
if (!rows.length) { show("The file appears to be empty.", "error"); return }
rows = rows.filter(r => {
  const resolved = resolveQKeys(rows)
  return resolved.some(k => toLikert(r[k] as string | number | undefined) !== null)
})
if (!rows.length) { show("The file appears to be empty after filtering blank rows.", "error"); return }
      const resolvedKeys = resolveQKeys(rows)
      const missingQ = resolvedKeys.filter(k => k.match(/^q[1-7]$/) && !rows.some(r => k in r))
      if (missingQ.length > 0) {
        show(`Missing survey columns: ${missingQ.join(", ")}. Check your column headers match Q1–Q7.`, "error")
        return
      }

      const uploadedBy = await getUserId()

      const { data: batch, error: batchError } = await supabase
        .from("ex_batches")
        .insert({ filename: file.name, upload_type: "employee_wellbeing", uploaded_by: uploadedBy, status: "processed", records_parsed: rows.length, records_imported: rows.length, records_rejected: 0 })
        .select()
        .single()

      if (batchError || !batch) throw new Error(batchError?.message ?? "Failed to create batch record")

      const { error: insertError } = await supabase
        .from("employee_wellbeing_responses")
        .insert(rows.map(r => ({
          batch_id:             batch.batch_id,
          survey_period:        String(r["survey period"] || "Unknown"),
          function:             r["function"]   || null,
          role_level:           r["role level"] || null,
          location:             r["location"]   || null,
          tenure_band:          r["tenure band"] || null,
          q1_physical_health:   r[resolvedKeys[0]] || null,
          q2_work_environment:  r[resolvedKeys[1]] || null,
          q3_stress_management: r[resolvedKeys[2]] || null,
          q4_manager_support:   r[resolvedKeys[3]] || null,
          q5_work_life_balance: r[resolvedKeys[4]] || null,
          q6_inclusion_support: r[resolvedKeys[5]] || null,
          q7_relationships:     r[resolvedKeys[6]] || null,
        })))

      if (insertError) {
        await supabase.from("ex_batches").delete().eq("batch_id", batch.batch_id)
        throw new Error(insertError.message)
      }

      const { data: allData, error: fetchErr } = await supabase
        .from("employee_wellbeing_responses")
        .select("q1_physical_health, q2_work_environment, q3_stress_management, q4_manager_support, q5_work_life_balance, q6_inclusion_support, q7_relationships")

      if (fetchErr) throw new Error(fetchErr.message)

      const allRows = (allData ?? []).map(mapEwiRow)
      const value   = computeEwiOverall(allRows)

      setMetrics(prev => ({ ...prev, ewi: { value, loaded: true, loading: false } }))
      show(`EWI: ${rows.length} responses imported successfully.`, "success")
    } catch (e: any) {
      show(`EWI upload failed: ${e.message}`, "error")
      setMetrics(prev => ({ ...prev, ewi: { ...prev.ewi, loading: false } }))
    }
  }

  // ─── UWP Handler ─────────────────────────────────────────
  const handleUwp = async (file: File) => {
    setMetrics(prev => ({ ...prev, uwp: { ...prev.uwp, loading: true } }))
    try {
      let rows: RowObject[]
      try {
        rows = await parseSheet(file)
      } catch {
        show("Could not read file. Make sure it's a valid .xlsx, .xls, or .csv.", "error")
        return
      }
      if (!rows.length) { show("The file appears to be empty.", "error"); return }

      const keys    = Object.keys(rows[0])
      const eligKey = findCol(keys, "eligible") || findCol(keys, "total eligible")
      const partKey = findCol(keys, "employees who used") || findCol(keys, "participants") || findCol(keys, "number of employees")
      const nameKey = findCol(keys, "program name") || findCol(keys, "name")
      const typeKey = findCol(keys, "program type") || findCol(keys, "type")
      const instKey = findCol(keys, "usage instances") || findCol(keys, "total program usage") || findCol(keys, "total usage")

      const missing: string[] = []
      if (!eligKey) missing.push("Total Eligible (e.g. 'Total Eligible Employees')")
      if (!partKey) missing.push("Participants (e.g. 'Number of Employees Who Used…' or 'Participants')")
      if (missing.length) {
        show(`Missing required columns:\n• ${missing.join("\n• ")}\n\nFound: ${keys.join(", ")}`, "error", 10000)
        setMetrics(prev => ({ ...prev, uwp: { ...prev.uwp, loading: false } }))
        return
      }

      const uploadedBy = await getUserId()

      const { data: batch, error: batchError } = await supabase
        .from("ex_batches")
        .insert({ filename: file.name, upload_type: "wellbeing_program_utilization", uploaded_by: uploadedBy, status: "processed", records_parsed: rows.length, records_imported: rows.length, records_rejected: 0 })
        .select()
        .single()

      if (batchError || !batch) throw new Error(batchError?.message ?? "Failed to create batch record")

      const { error: insertError } = await supabase
        .from("wellbeing_program_utilization")
        .insert(rows.map(r => ({
          batch_id:              batch.batch_id,
          reporting_period:      String(r["reporting period"] || r["period"] || "Unknown"),
          program_type:          r[typeKey] ? String(r[typeKey]) : null,
          program_name:          r[nameKey] ? String(r[nameKey]) : null,
          total_eligible:        Number(r[eligKey]) || 0,
          participants:          Number(r[partKey]) || 0,
          total_usage_instances: instKey && r[instKey] ? Number(r[instKey]) : null,
        })))

      if (insertError) {
        await supabase.from("ex_batches").delete().eq("batch_id", batch.batch_id)
        throw new Error(insertError.message)
      }

      const { data: allData, error: fetchErr } = await supabase
        .from("wellbeing_program_utilization")
        .select("total_eligible, participants")

      if (fetchErr) throw new Error(fetchErr.message)

      const totalElig = allData?.reduce((s, r) => s + (r.total_eligible || 0), 0) ?? 0
      const totalPart = allData?.reduce((s, r) => s + (r.participants    || 0), 0) ?? 0
      const value     = totalElig ? Number(((totalPart / totalElig) * 100).toFixed(1)) : null

      setMetrics(prev => ({ ...prev, uwp: { value, loaded: true, loading: false } }))
      show(`UWP: ${rows.length} program rows imported successfully.`, "success")
    } catch (e: any) {
      show(`UWP upload failed: ${e.message}`, "error")
      setMetrics(prev => ({ ...prev, uwp: { ...prev.uwp, loading: false } }))
    }
  }

  // ─── Clear helpers ────────────────────────────────────────
  const clearEwi = async () => {
    try {
      const { data: batches } = await supabase.from("ex_batches").select("batch_id").eq("upload_type", "employee_wellbeing")
      if (batches?.length) {
        const ids = batches.map(b => b.batch_id)
        await supabase.from("employee_wellbeing_responses").delete().in("batch_id", ids)
        await supabase.from("ex_batches").delete().in("batch_id", ids)
      }
      setMetrics(prev => ({ ...prev, ewi: defaultState.ewi }))
      show("EWI data cleared.", "info")
    } catch (e: any) {
      show(`Clear failed: ${e.message}`, "error")
    }
  }

  const clearUwp = async () => {
    try {
      const { data: batches } = await supabase.from("ex_batches").select("batch_id").eq("upload_type", "wellbeing_program_utilization")
      if (batches?.length) {
        const ids = batches.map(b => b.batch_id)
        await supabase.from("wellbeing_program_utilization").delete().in("batch_id", ids)
        await supabase.from("ex_batches").delete().in("batch_id", ids)
      }
      setMetrics(prev => ({ ...prev, uwp: defaultState.uwp }))
      show("UWP data cleared.", "info")
    } catch (e: any) {
      show(`Clear failed: ${e.message}`, "error")
    }
  }

  const anyLoaded = metrics.ewi.loaded || metrics.uwp.loaded

  const metricCards = [
    {
      key: "ewi", icon: "EWI",
      title: "Employee Wellbeing Index",
      subtitle: "Composite score from Q1–Q7 survey (5-point Likert)",
      value: metrics.ewi.value != null ? metrics.ewi.value.toFixed(2) : null,
      unit: "/ 5",
      accent: "#7C3AED",
      onFile: handleEwi, loaded: metrics.ewi.loaded, loading: metrics.ewi.loading,
      detail: "Avg of all 7 items",
    },
    {
      key: "uwp", icon: "WPU",
      title: "Wellbeing Program Utilization",
      subtitle: "Participation rate across approved wellbeing programs",
      value: metrics.uwp.value != null ? metrics.uwp.value : null,
      unit: "%",
      accent: "#059669",
      onFile: handleUwp, loaded: metrics.uwp.loaded, loading: metrics.uwp.loading,
      detail: "Participants ÷ Eligible",
    },
  ]

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      <ToastContainer toasts={toasts} onDismiss={dismiss} />

      {/* Syncing indicator */}
      {rehydrating && (
        <div style={{ fontSize: 11, color: "#94a3b8", display: "flex", alignItems: "center", gap: 6, marginBottom: 16 }}>
          <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "#7C3AED", animation: "pulse 1s infinite" }} />
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

            {/* EWI */}
            {metrics.ewi.loaded && (
              <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 1px 3px rgba(0,0,0,.06), 0 4px 16px rgba(0,0,0,.06)", padding: "18px 22px", position: "relative" }}>
                <button onClick={clearEwi} title="Clear EWI data" style={{ position: "absolute", top: 12, right: 12, background: "#ef4444", color: "#fff", border: "none", borderRadius: "50%", width: 18, height: 18, fontSize: 10, cursor: "pointer" }}>×</button>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#7C3AED", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 10 }}>Employee Wellbeing Index</div>
                <BenchmarkRow label="Overall Wellbeing Score" value={metrics.ewi.value ?? 0} target={5} accent="#7C3AED" unit=" / 5" />
              </div>
            )}

            {/* UWP */}
            {metrics.uwp.loaded && (
              <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 1px 3px rgba(0,0,0,.06), 0 4px 16px rgba(0,0,0,.06)", padding: "18px 22px", position: "relative" }}>
                <button onClick={clearUwp} title="Clear UWP data" style={{ position: "absolute", top: 12, right: 12, background: "#ef4444", color: "#fff", border: "none", borderRadius: "50%", width: 18, height: 18, fontSize: 10, cursor: "pointer" }}>×</button>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#059669", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 10 }}>Program Utilization</div>
                <BenchmarkRow label="Utilization Rate" value={metrics.uwp.value ?? 0} target={100} accent="#059669" unit="%" />
              </div>
            )}

          </div>
        </>
      )}
    </div>
  )
}