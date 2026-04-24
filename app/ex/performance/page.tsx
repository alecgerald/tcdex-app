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

// ─── Default metrics state ────────────────────────────────
const defaultPerfMetrics = {
  mei:  { value: null as number | null, responses: 0, favorability: null as number | null, loaded: false },
  epii: { value: null as number | null, reviewed: 0, improved: 0, loaded: false },
}

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

// ─── LIKERT helpers ───────────────────────────────────────
const LIKERT: Record<string, number> = { "strongly agree": 5, "agree": 4, "neutral": 3, "disagree": 2, "strongly disagree": 1 }
const toLikert = (v: string | number | undefined): number | null => {
  if (typeof v === "number") return v
  return LIKERT[(v as string || "").trim().toLowerCase()] ?? null
}

export default function PerfDashboard() {
  const [uploadOrder, setUploadOrder]   = useState<string[]>([])
  const [perfMetrics, setPerfMetrics]   = useState(defaultPerfMetrics)
  const [rehydrating, setRehydrating]   = useState(true)
  const [currentUser, setCurrentUser]   = useState<string>("system")

  // ─── Resolve real auth user on mount ─────────────────────
  useEffect(() => {
    const resolveUser = async () => {
      const { data } = await supabase.auth.getUser()
      if (data?.user?.id) setCurrentUser(data.user.id)
    }
    resolveUser()
  }, [])

  // ─── Rehydrate both KPIs from Supabase on mount ───────────
  useEffect(() => {
    const rehydrate = async () => {
      setRehydrating(true)
      try {
        await Promise.all([rehydrateMei(), rehydrateEpii()])
      } finally {
        setRehydrating(false)
      }
    }
    rehydrate()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Rehydration helpers ───────────────────────────────────

  const rehydrateMei = async () => {
    const { data: meiData } = await supabase
      .from("manager_effectiveness_responses")
      .select("q1_clarity, q2_support, q3_fairness, q4_feedback, q5_psychological_safety, q6_inclusion")

    if (!meiData || !meiData.length) return

    let totalScore = 0; let totalItems = 0
    meiData.forEach(r => {
      [r.q1_clarity, r.q2_support, r.q3_fairness, r.q4_feedback, r.q5_psychological_safety, r.q6_inclusion].forEach(v => {
        const score = toLikert(v)
        if (score !== null) { totalScore += score; totalItems++ }
      })
    })
    const avgLikert    = totalItems ? totalScore / totalItems : 0
    const favorability = totalItems ? Number(((avgLikert - 1) / 4 * 100).toFixed(1)) : null

    setPerfMetrics(prev => ({
      ...prev,
      mei: { value: favorability, responses: meiData.length, favorability, loaded: true },
    }))
    setUploadOrder(prev => prev.includes("mei") ? prev : [...prev, "mei"])
  }

  const rehydrateEpii = async () => {
    const { data: epiiData } = await supabase
      .from("employee_performance_improvement")
      .select("total_employees, employees_improved")

    if (!epiiData || !epiiData.length) return

    const totalReviewed = epiiData.reduce((s, r) => s + (r.total_employees   || 0), 0)
    const totalImproved = epiiData.reduce((s, r) => s + (r.employees_improved || 0), 0)
    const rate          = totalReviewed ? Number(((totalImproved / totalReviewed) * 100).toFixed(1)) : null

    setPerfMetrics(prev => ({
      ...prev,
      epii: { value: rate, reviewed: totalReviewed, improved: totalImproved, loaded: true },
    }))
    setUploadOrder(prev => prev.includes("epii") ? prev : [...prev, "epii"])
  }

  // ─── MEI Handler ─────────────────────────────────────────
  const handleMei = async (file: File) => {
    const rows = await parseSheet(file)
    if (!rows.length) { alert("File is empty."); return }

    const keys        = Object.keys(rows[0])
    const qKeys       = ["q1 clarity", "q2 support", "q3 fairness", "q4 feedback", "q5 psychological safety", "q6 inclusion"]
    const resolvedQKeys = qKeys.map(q => keys.find(k => k.startsWith(q.substring(0, 6))) ?? q)

    const { data: meiBatch, error: meiBatchError } = await supabase
      .from("ex_batches")
      .insert({
        filename: file.name,
        upload_type: "manager_effectiveness",
        uploaded_by: currentUser,
        status: "processed",
        records_parsed: rows.length,
        records_imported: rows.length,
        records_rejected: 0,
      })
      .select()
      .single()

    if (meiBatchError || !meiBatch) { console.error("MEI batch error:", meiBatchError); return }

    const meiRowsToInsert = rows.map(r => ({
      batch_id: meiBatch.batch_id,
      survey_date: r["survey date"]
        ? (() => { try { const d = new Date(String(r["survey date"]).trim()); return isNaN(d.getTime()) ? null : d.toISOString().split("T")[0] } catch { return null } })()
        : null,
      function:                r["function"]              || null,
      role_level:              r["role level"]            || null,
      location:                r["location"]              || null,
      manager_tenure:          r["manager tenure"]        || null,
      q1_clarity:              r[resolvedQKeys[0]]        || null,
      q2_support:              r[resolvedQKeys[1]]        || null,
      q3_fairness:             r[resolvedQKeys[2]]        || null,
      q4_feedback:             r[resolvedQKeys[3]]        || null,
      q5_psychological_safety: r[resolvedQKeys[4]]        || null,
      q6_inclusion:            r[resolvedQKeys[5]]        || null,
      q7_improvement_comment:  r["q7 improvement comment"] || null,
    }))

    const { error: meiInsertError } = await supabase
      .from("manager_effectiveness_responses")
      .insert(meiRowsToInsert)

    if (meiInsertError) { console.error("MEI insert error:", meiInsertError); return }

    // Rehydrate MEI fully from Supabase (includes all previous batches)
    await rehydrateMei()
    setUploadOrder(prev => [...prev.filter(k => k !== "mei"), "mei"])
  }

  // ─── EPII Handler ─────────────────────────────────────────
  const handleEpii = async (file: File) => {
    const rows = await parseSheet(file)
    if (!rows.length) { alert("File is empty."); return }

    const keys        = Object.keys(rows[0])
    const reviewedKey = keys.find(k => k.includes("total number of employees reviewed"))     ?? ""
    const improvedKey = keys.find(k => k.includes("number of employees showing performance")) ?? ""

    if (!reviewedKey || !improvedKey) {
      alert("Missing columns: Total Number of Employees Reviewed / Number of Employees Showing Performance Improvement")
      return
    }

    const { data: epiiBatch, error: epiiBatchError } = await supabase
      .from("ex_batches")
      .insert({
        filename: file.name,
        upload_type: "employee_performance_improvement",
        uploaded_by: currentUser,
        status: "processed",
        records_parsed: rows.length,
        records_imported: rows.length,
        records_rejected: 0,
      })
      .select()
      .single()

    if (epiiBatchError || !epiiBatch) { console.error("EPII batch error:", epiiBatchError); return }

    const epiiRowsToInsert = rows.map(r => ({
      batch_id:              epiiBatch.batch_id,
      review_cycle:          String(r["review cycle"] || "Unknown"),
      delivery_unit:         r["delivery unit"]                || null,
      job_family:            r["job family"]                   || null,
      total_employees:       Number(r[reviewedKey])            || 0,
      employees_improved:    Number(r[improvedKey])            || 0,
      training_intervention: r["linked training intervention"] || null,
    }))

    const { error: epiiInsertError } = await supabase
      .from("employee_performance_improvement")
      .insert(epiiRowsToInsert)

    if (epiiInsertError) { console.error("EPII insert error:", epiiInsertError); return }

    // Rehydrate EPII fully from Supabase (includes all previous batches)
    await rehydrateEpii()
    setUploadOrder(prev => [...prev.filter(k => k !== "epii"), "epii"])
  }

  // ─── Clear metric — delete from Supabase + reset state ───
  const clearMetric = async (key: string) => {
    const supabaseConfig: Record<string, { dataTable: string; uploadType: string }> = {
      mei:  { dataTable: "manager_effectiveness_responses",  uploadType: "manager_effectiveness" },
      epii: { dataTable: "employee_performance_improvement", uploadType: "employee_performance_improvement" },
    }

    const config = supabaseConfig[key]
    if (config) {
      const { data: batches } = await supabase
        .from("ex_batches")
        .select("batch_id")
        .eq("upload_type", config.uploadType)

      if (batches && batches.length > 0) {
        const batchIds = batches.map((b: { batch_id: string }) => b.batch_id)
        await supabase.from(config.dataTable).delete().in("batch_id", batchIds)
        await supabase.from("ex_batches").delete().in("batch_id", batchIds)
      }
    }

    // Reset in-memory state only — no localStorage
    setPerfMetrics(prev => ({
      ...prev,
      [key]: key === "mei"
        ? { value: null, responses: 0, favorability: null, loaded: false }
        : { value: null, reviewed: 0, improved: 0, loaded: false },
    }))
    setUploadOrder(prev => prev.filter(k => k !== key))
  }

  const anyLoaded = perfMetrics.mei.loaded || perfMetrics.epii.loaded

  const perfMetricCards = [
    {
      key: "mei", icon: "MEI",
      title: "Manager Effectiveness Index",
      subtitle: "Aggregate favorability across 6 effectiveness dimensions",
      value: perfMetrics.mei.value,
      unit: perfMetrics.mei.value != null ? "%" : "",
      accent: "#f59e0b",
      onFile: handleMei, loaded: perfMetrics.mei.loaded,
      detail: "Survey-based favorability",
    },
    {
      key: "epii", icon: "PIR",
      title: "Performance Improvement Rate",
      subtitle: "Employees showing improvement across review cycles",
      value: perfMetrics.epii.value,
      unit: perfMetrics.epii.value != null ? "%" : "",
      accent: "#10b981",
      onFile: handleEpii, loaded: perfMetrics.epii.loaded,
      detail: "Improved ÷ Reviewed",
    },
  ]

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>

      {/* Syncing indicator */}
      {rehydrating && (
        <div style={{ fontSize: 11, color: "#94a3b8", display: "flex", alignItems: "center", gap: 6, marginBottom: 16 }}>
          <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "#f59e0b", animation: "pulse 1s infinite" }} />
          Syncing from database…
          <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.3} }`}</style>
        </div>
      )}

      {/* Status pills */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 28 }}>
        {perfMetricCards.map(m => (
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
        {perfMetricCards.map(({ key: _k, ...m }) => <MetricCard key={m.title} {...m} />)}
      </div>

      {/* Summary snapshot */}
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
                <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
                  {perfMetrics.epii.improved} of {perfMetrics.epii.reviewed} employees showed improvement
                </div>
                <button onClick={() => clearMetric("epii")} style={{ position: "absolute", top: 12, right: 12, background: "#ef4444", color: "#fff", border: "none", borderRadius: "50%", width: 18, height: 18, fontSize: 10, cursor: "pointer" }} title="Clear">×</button>
              </div>
            )}

          </div>
        </>
      )}
    </div>
  )
}