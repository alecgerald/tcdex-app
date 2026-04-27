"use client"

import { useEffect, useState, useMemo } from "react"
import OnboardingReportsPage from "../onboarding/reports/page"
import PerformanceReportsPage from "../performance/reports/page"
import EngRetReportsPage from "../engagement/reports/page"
import WellbeingReportsPage from "../wellbeing/reports/page" 
import OffboardingReportsPage from "../offboarding/reports/page"

import * as XLSX from "xlsx"
import { createClient } from "@/utils/supabase/client"

const supabase = createClient()
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend,
  CartesianGrid, ResponsiveContainer, LineChart, Line,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  Cell,
} from "recharts"

// ─── Types ────────────────────────────────────────────────
interface MetricData {
  metric: string; value: number; unit?: string; accent: string; responses?: number
}
interface CeRawRow {
  outcome: string
  "q1 overall (0-10)": number
  "q2 clarity": string; "q3 timeliness": string; "q4 respect": string
  "q5 role understanding": string; "q6 inclusion": string
  "q7 improvement opportunity"?: string
  "job family"?: string; "hiring bu"?: string; location?: string
  stage?: string; "response date"?: string
}
interface OarRawRow {
  period?: string; "hiring bu"?: string; hiringbu?: string
  location?: string; "candidate type"?: string; "job family"?: string; level?: string
  "total number of offers extended"?: number | string
  "number of offers accepted"?: number | string
}
interface TthRawRow {
  "reporting period"?: string
  "job family"?: string; "hiring source"?: string
  "hiring bu"?: string; level?: string
  "accepted hires count"?: number | string
  "total calendar days to hire"?: number | string
}
interface TthPeriodData { rows: TthRawRow[] }
interface TurnoverRawRow {
  "hire cohort"?: string; "delivery unit"?: string; "job family"?: string
  "hiring source"?: string
  "new hires in cohort"?: number | string
  "number of new hires who left within 12 months"?: number | string
  "number of new hires who left within 90 days"?: number | string
}
interface TurnoverPeriodData {
  rows: TurnoverRawRow[]; totalCohort: number; totalLeft: number; rate: number; rate90: number | null
}

// ─── Helpers ─────────────────────────────────────────────
const LIKERT: Record<string, number> = {
  "strongly agree": 5, agree: 4, neutral: 3, disagree: 2, "strongly disagree": 1,
}
const toScore = (v?: string): number | null => LIKERT[(v ?? "").trim().toLowerCase()] ?? null
const toNum = (v?: number | string): number => Number(v || 0)
const uniq = (arr: (string | undefined)[]): string[] =>
  [...new Set(arr.filter((v): v is string => !!v))].sort()
const monthToQ = (ym: string): string => {
  const [y, m] = ym.split("-").map(Number)
  return `${y} Q${Math.ceil(m / 3)}`
}
const avgArr = (nums: number[]): number =>
  nums.length ? Number((nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1)) : 0
const pct = (num: number, den: number): number =>
  den ? Number(((num / den) * 100).toFixed(1)) : 0

// ─── Export helpers ───────────────────────────────────────
function exportCSV(data: object[], filename: string) {
  const ws = XLSX.utils.json_to_sheet(data)
  const blob = new Blob([XLSX.utils.sheet_to_csv(ws)], { type: "text/csv" })
  const a = document.createElement("a")
  a.href = URL.createObjectURL(blob); a.download = filename + ".csv"; a.click()
}
function exportXLSX(data: object[], filename: string) {
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), "Sheet1")
  XLSX.writeFile(wb, filename + ".xlsx")
}

// ─── CE filter config ─────────────────────────────────────
// Maps each filter type → which figure numbers it affects
const CE_FILTER_AFFECTS: Record<string, string[]> = {
  "Survey Period":              ["Fig 1", "Fig 2", "Fig 3"],
  "Application Outcome":        ["Fig 3"],
  "Job Family":                 ["Fig 2", "Fig 3", "Fig 4"],
  "Hiring BU":                  ["Fig 2", "Fig 3", "Fig 4"],
  "Location":                   ["Fig 2", "Fig 3", "Fig 4"],
  "Recruitment Stage Reached":  ["Fig 2", "Fig 3", "Fig 4"],
  "Response Date":              ["Fig 1", "Fig 2", "Fig 3"],
}

const CE_FILTER_KEYS = Object.keys(CE_FILTER_AFFECTS)

// OAR filter config
const OAR_FILTER_AFFECTS: Record<string, string[]> = {
  "Reporting Period": ["Fig 1", "Fig 2"],
  "Hiring BU":        ["Fig 3"],
  "Location":         ["Fig 4"],
  "Candidate Type":   ["Fig 2", "Fig 3", "Fig 4"],
  "Job Family":       ["Fig 2", "Fig 3", "Fig 4"],
  "Level":            ["Fig 2", "Fig 3", "Fig 4"],
}

// TTH filter config
const TTH_FILTER_AFFECTS: Record<string, string[]> = {
  "Reporting Period": ["Fig 1"],
  "Hiring BU":        ["Fig 2", "Fig 3"],
  "Job Family":       ["Fig 2", "Fig 3"],
  "Level":            ["Fig 2", "Fig 3"],
  "Hiring Source":    ["Fig 3"],
}

// Turnover filter config
const TUR_FILTER_AFFECTS: Record<string, string[]> = {
  "Hire Cohort":   ["Fig 1"],
  "Delivery Unit": ["Fig 2", "Fig 3"],
  "Job Family":    ["Fig 2", "Fig 3"],
  "Hiring Source": ["Fig 2", "Fig 3"],
}

// ─── UI Primitives ────────────────────────────────────────
function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: "#fff", borderRadius: 16,
      boxShadow: "0 1px 4px rgba(0,0,0,.06), 0 4px 20px rgba(0,0,0,.07)",
      padding: "24px 26px", ...style,
    }}>
      {children}
    </div>
  )
}

function EmptyState({ label }: { label: string }) {
  return (
    <div style={{ textAlign: "center", padding: "56px 24px", color: "#cbd5e1", fontSize: 13 }}>
      <div style={{ fontSize: 40, marginBottom: 10 }}>📭</div>
      No <strong>{label}</strong> data uploaded yet.<br />
      Go to the dashboard and upload a file first.
    </div>
  )
}

function EmptyChart({ msg }: { msg: string }) {
  return (
    <div style={{
      height: 150, display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      color: "#cbd5e1", fontSize: 13,
      background: "#fafafa", borderRadius: 10, border: "1px dashed #e2e8f0",
    }}>
      <div style={{ fontSize: 26, marginBottom: 6 }}>📊</div>
      {msg}
    </div>
  )
}

function StatPill({ label, value, accent, sub }: {
  label: string; value: string | number; accent: string; sub?: string
}) {
  return (
    <div style={{
      background: accent + "0d", border: `1px solid ${accent}20`,
      borderRadius: 12, padding: "14px 16px",
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 5 }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color: accent, lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

function Alert({ msg, tone = "danger" }: { msg: string; tone?: "danger" | "warn" | "info" }) {
  const s = {
    danger: { color: "#b91c1c", bg: "#fef2f2", border: "#fecaca" },
    warn:   { color: "#92400e", bg: "#fffbeb", border: "#fde68a" },
    info:   { color: "#1e40af", bg: "#eff6ff", border: "#bfdbfe" },
  }[tone]
  return (
    <div style={{
      padding: "10px 14px", background: s.bg,
      border: `1px solid ${s.border}`, borderRadius: 10,
      fontSize: 12, color: s.color, lineHeight: 1.5,
    }}>
      {msg}
    </div>
  )
}

function CT({ active, payload, label, unit }: {
  active?: boolean
  payload?: { color: string; name: string; value: number | string }[]
  label?: string; unit?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10,
      padding: "10px 14px", fontSize: 12, boxShadow: "0 4px 20px rgba(0,0,0,.10)",
    }}>
      <div style={{ fontWeight: 700, color: "#0f172a", marginBottom: 4 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color }}>
          {p.name}: <strong>{typeof p.value === "number" ? p.value.toFixed(1) : p.value}{unit ?? ""}</strong>
        </div>
      ))}
    </div>
  )
}

// ─── Figure Card ─────────────────────────────────────────
function FigCard({ fig, title, subtitle, children }: {
  fig: string; title: string; subtitle: string; children: React.ReactNode
}) {
  return (
    <Card>
      <div style={{ marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <span style={{
            fontSize: 10, fontWeight: 800, background: "#f1f5f9", color: "#64748b",
            borderRadius: 6, padding: "3px 8px", letterSpacing: ".05em", textTransform: "uppercase",
          }}>
            {fig}
          </span>
          <span style={{ fontSize: 15, fontWeight: 800, color: "#0f172a", letterSpacing: "-.02em" }}>
            {title}
          </span>
        </div>
        <div style={{ fontSize: 12, color: "#94a3b8" }}>{subtitle}</div>
      </div>
      {children}
    </Card>
  )
}

// ─── Two-Dropdown Filter Bar ──────────────────────────────
// Drop 1: filter type (e.g. "Job Family")
// Drop 2: year from response date (always 2nd dropdown)
// Shows "Affects: Fig X, Fig Y" badge after selection
function TwoDropFilter({
  filterKeys,         // e.g. ["Survey Period", "Job Family", ...]
  affectsMap,         // CE_FILTER_AFFECTS
  years,              // unique years from response date
  filterType,
  filterValue,
  selectedYear,
  onFilterType,
  onFilterValue,
  onYear,
  onClear,
  accent,
  valueOptions,       // options for the second content dropdown (dynamic per filter type)
}: {
  filterKeys: string[]
  affectsMap: Record<string, string[]>
  years: string[]
  filterType: string
  filterValue: string
  selectedYear: string
  onFilterType: (v: string) => void
  onFilterValue: (v: string) => void
  onYear: (v: string) => void
  onClear: () => void
  accent: string
  valueOptions: string[]
}) {
  const affects = filterType ? affectsMap[filterType] ?? [] : []
  const hasActive = !!(filterType || selectedYear)

  const CHEVRON = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2.5'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`

  const selectStyle = (active: boolean): React.CSSProperties => ({
    padding: "9px 36px 9px 14px",
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 600,
    border: active ? `1.5px solid ${accent}` : "1.5px solid #e2e8f0",
    backgroundColor: active ? accent + "08" : "#fff",
    backgroundImage: CHEVRON,
    backgroundRepeat: "no-repeat",
    backgroundPosition: "right 12px center",
    backgroundSize: "12px 12px",
    color: active ? accent : "#64748b",
    cursor: "pointer",
    outline: "none",
    minWidth: 200,
    boxShadow: active ? `0 0 0 3px ${accent}15` : "none",
    transition: "border .15s, box-shadow .15s, color .15s",
    appearance: "none" as const,
    WebkitAppearance: "none" as const,
  })

  return (
    <Card style={{ padding: "20px 24px" }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>

        {/* ── Dropdown 1: Filter type ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <label style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".06em" }}>
            Filter By
          </label>
          <select
            value={filterType}
            onChange={e => { onFilterType(e.target.value); onFilterValue("") }}
            style={selectStyle(!!filterType)}
          >
            <option value="">— Select filter —</option>
            {filterKeys.map(k => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>

        {/* ── Dropdown 2: Year (always visible) ── */}
        {years.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <label style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".06em" }}>
              Year
            </label>
            <select
              value={selectedYear}
              onChange={e => onYear(e.target.value)}
              style={selectStyle(!!selectedYear)}
            >
              <option value="">All Years</option>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        )}

        {/* ── Dropdown 3: Value for chosen filter (only if filter type chosen & has options) ── */}
        {filterType && valueOptions.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <label style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".06em" }}>
              {filterType}
            </label>
            <select
              value={filterValue}
              onChange={e => onFilterValue(e.target.value)}
              style={selectStyle(!!filterValue)}
            >
              <option value="">All</option>
              {valueOptions.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
        )}

        {/* ── Affects badge + Clear ── */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 2 }}>
          {filterType && affects.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 11, color: "#94a3b8" }}>Shows:</span>
              {affects.map(fig => (
                <span key={fig} style={{
                  fontSize: 11, fontWeight: 700,
                  background: accent + "15", color: accent,
                  border: `1px solid ${accent}30`,
                  borderRadius: 6, padding: "3px 10px",
                }}>
                  {fig}
                </span>
              ))}
            </div>
          )}
          {hasActive && (
            <button
              onClick={onClear}
              style={{
                padding: "8px 14px", borderRadius: 8, fontSize: 11, fontWeight: 700,
                border: "1px solid #e2e8f0", background: "#f8fafc", color: "#94a3b8",
                cursor: "pointer", whiteSpace: "nowrap",
              }}
            >
              ✕ Clear
            </button>
          )}
        </div>
      </div>

      {/* Active filter summary line */}
      {(filterType || selectedYear) && (
        <div style={{
          marginTop: 14, paddingTop: 12, borderTop: "1px solid #f1f5f9",
          fontSize: 12, color: "#64748b", display: "flex", gap: 6, flexWrap: "wrap",
        }}>
          {selectedYear && (
            <span style={{ background: "#f1f5f9", borderRadius: 6, padding: "2px 8px" }}>
              Year: <strong>{selectedYear}</strong>
            </span>
          )}
          {filterType && (
            <span style={{ background: "#f1f5f9", borderRadius: 6, padding: "2px 8px" }}>
              {filterType}: <strong>{filterValue || "All"}</strong>
            </span>
          )}
        </div>
      )}
    </Card>
  )
}

// ─── CE Filter Bar (month-range aware) ───────────────────
const MONTH_LABELS: Record<string, string> = {
  "01": "January", "02": "February", "03": "March", "04": "April",
  "05": "May",     "06": "June",     "07": "July",  "08": "August",
  "09": "September","10": "October", "11": "November","12": "December",
}
function CeFilterBar({
  filterKeys, affectsMap, years, allMonths,
  filterType, filterValue, selectedYear, monthFrom, monthTo,
  onFilterType, onFilterValue, onYear, onMonthFrom, onMonthTo, onClear, valueOptions,
}: {
  filterKeys: string[]; affectsMap: Record<string, string[]>; years: string[]
  allMonths: string[]; filterType: string; filterValue: string
  selectedYear: string; monthFrom: string; monthTo: string
  onFilterType: (v: string) => void; onFilterValue: (v: string) => void
  onYear: (v: string) => void; onMonthFrom: (v: string) => void
  onMonthTo: (v: string) => void; onClear: () => void; valueOptions: string[]
}) {
  const affects   = filterType ? affectsMap[filterType] ?? [] : []
  const usingRange = !!(monthFrom || monthTo)
  const hasActive  = !!(filterType || selectedYear || usingRange)
  const ACCENT = "#6366f1"
  const CHEVRON = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2.5'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`
  const sel = (active: boolean, w = 200): React.CSSProperties => ({
    padding: "9px 36px 9px 14px", borderRadius: 10, fontSize: 13, fontWeight: 600,
    border: active ? `1.5px solid ${ACCENT}` : "1.5px solid #e2e8f0",
    backgroundColor: active ? ACCENT + "08" : "#fff", backgroundImage: CHEVRON,
    backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center", backgroundSize: "12px 12px",
    color: active ? ACCENT : "#64748b", cursor: "pointer", outline: "none", minWidth: w,
    boxShadow: active ? `0 0 0 3px ${ACCENT}15` : "none",
    transition: "border .15s, box-shadow .15s, color .15s",
    appearance: "none" as const, WebkitAppearance: "none" as const,
  })
  const lbl = (txt: string) => (
    <label style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" as const, letterSpacing: ".06em" }}>{txt}</label>
  )
  // Month options from allMonths — show "MMM YYYY" label but value stays "YYYY-MM"
  // Filter months to selected year first, then show only month name (no year)
  const filteredMonths = selectedYear
    ? allMonths.filter(ym => ym.startsWith(selectedYear))
    : allMonths
  const seenMonths = new Set<string>()
const monthOpts = filteredMonths
  .map(ym => { const [, m] = ym.split("-"); return { value: ym, label: MONTH_LABELS[m] ?? m, m } })
  .filter(o => { if (seenMonths.has(o.m)) return false; seenMonths.add(o.m); return true })
  .map(o => ({ value: o.value, label: o.label }))
  // Clamp: monthTo options must be >= monthFrom
  const toOpts  = monthFrom ? monthOpts.filter(o => o.value >= monthFrom) : monthOpts
  // Clamp: monthFrom options must be <= monthTo
  const fromOpts = monthTo  ? monthOpts.filter(o => o.value <= monthTo)   : monthOpts

  const activeRangeLabel = () => {
    if (!monthFrom && !monthTo) return null
    const toMonth = (ym: string) => MONTH_LABELS[ym.split("-")[1]] ?? ym.split("-")[1]
    const fLabel = monthFrom ? toMonth(monthFrom) : "Start"
    const tLabel = monthTo   ? toMonth(monthTo)   : "Latest"
    return `${fLabel} → ${tLabel}`
  }
  return (
    <Card style={{ padding: "20px 24px" }}>
      {/* ── Row 1: Category filter + year + value ── */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {lbl("Filter By")}
          <select value={filterType} onChange={e => { onFilterType(e.target.value); onFilterValue("") }} style={sel(!!filterType)}>
            <option value="">— Select filter —</option>
            {filterKeys.map(k => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>
        {years.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {lbl("Year")}
            <select value={selectedYear} onChange={e => onYear(e.target.value)} style={sel(!!selectedYear, 160)}>
              <option value="">All Years</option>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        )}
        {filterType && valueOptions.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {lbl(filterType)}
            <select value={filterValue} onChange={e => onFilterValue(e.target.value)} style={sel(!!filterValue)}>
              <option value="">All</option>
              {valueOptions.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 2 }}>
          {filterType && affects.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 11, color: "#94a3b8" }}>Shows:</span>
              {affects.map(fig => (
                <span key={fig} style={{ fontSize: 11, fontWeight: 700, background: ACCENT + "15", color: ACCENT, border: `1px solid ${ACCENT}30`, borderRadius: 6, padding: "3px 10px" }}>{fig}</span>
              ))}
            </div>
          )}
          {hasActive && (
            <button onClick={onClear} style={{ padding: "8px 14px", borderRadius: 8, fontSize: 11, fontWeight: 700, border: "1px solid #e2e8f0", background: "#f8fafc", color: "#94a3b8", cursor: "pointer", whiteSpace: "nowrap" }}>✕ Clear</button>
          )}
        </div>
      </div>
      {/* ── Row 2: Month range (always shown when months exist) ── */}
      {allMonths.length > 0 && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid #f1f5f9", display: "flex", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 2, alignSelf: "center" }}>
            📅 Month Range
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {lbl("From")}
            <select
              value={monthFrom}
              onChange={e => { onMonthFrom(e.target.value) }}
              style={sel(!!monthFrom, 190)}
            >
              <option value="">Earliest</option>
              {fromOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div style={{ alignSelf: "flex-end", paddingBottom: 10, color: "#cbd5e1", fontSize: 18, fontWeight: 300 }}>→</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {lbl("To")}
            <select
              value={monthTo}
              onChange={e => { onMonthTo(e.target.value) }}
              style={sel(!!monthTo, 190)}
            >
              <option value="">Latest</option>
              {toOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          {usingRange && (
            <div style={{ alignSelf: "flex-end", paddingBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, background: ACCENT + "12", color: ACCENT, border: `1px solid ${ACCENT}25`, borderRadius: 20, padding: "4px 12px" }}>
                📅 {activeRangeLabel()}
              </span>
            </div>
          )}
        </div>
      )}
      {/* ── Active filter summary ── */}
      {(filterType || selectedYear || usingRange) && (
        <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid #f1f5f9", fontSize: 12, color: "#64748b", display: "flex", gap: 6, flexWrap: "wrap" }}>
          {selectedYear && !usingRange && <span style={{ background: "#f1f5f9", borderRadius: 6, padding: "2px 8px" }}>Year: <strong>{selectedYear}</strong></span>}
          {usingRange && <span style={{ background: "#f1f5f9", borderRadius: 6, padding: "2px 8px" }}>Date range: <strong>{activeRangeLabel()}</strong></span>}
          {filterType && <span style={{ background: "#f1f5f9", borderRadius: 6, padding: "2px 8px" }}>{filterType}: <strong>{filterValue || "All"}</strong></span>}
        </div>
      )}
    </Card>
  )
}
// ─── Export bar ───────────────────────────────────────────
function ExportBar({ onCSV, onXLSX }: { onCSV: () => void; onXLSX: () => void }) {
  return (
    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
      {[
        { label: "↓ CSV",  fn: onCSV },
        { label: "↓ XLSX", fn: onXLSX },
        { label: "↓ PDF",  fn: () => window.print() },
      ].map(b => (
        <button
          key={b.label}
          onClick={b.fn}
          style={{
            padding: "6px 14px", borderRadius: 8, fontSize: 11, fontWeight: 600,
            border: "1px solid #e2e8f0", background: "#fff", color: "#475569",
            cursor: "pointer",
          }}
        >
          {b.label}
        </button>
      ))}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
//  MAIN
// ═══════════════════════════════════════════════════════════
export default function ReportsPage() {
  const [summaryMetrics, setSummaryMetrics] = useState<MetricData[]>([])
  const [ceRows,   setCeRows]   = useState<CeRawRow[]>([])
  const [oarRows,  setOarRows]  = useState<OarRawRow[]>([])
  const [tthData,  setTthData]  = useState<Record<string, TthPeriodData>>({})
  const [turData,  setTurData]  = useState<Record<string, TurnoverPeriodData>>({})
  const [activePhase, setActivePhase] = useState<"hiring" | "onboarding" | "performance" | "engagement" | "wellbeing" | "offboarding">("hiring")
  const [activeTab, setActiveTab] = useState<"ce" | "oar" | "tth" | "turnover">("ce")
  

  // ── CE filter state ──────────────────────────────────────
  const [ceFilterType,  setCeFilterType]  = useState("")  // e.g. "Job Family"
  const [ceFilterValue, setCeFilterValue] = useState("")  // e.g. "Operations"
  const [ceYear,        setCeYear]        = useState("")  // e.g. "2026"
  const [ceMonthFrom,   setCeMonthFrom]   = useState("")  // e.g. "2026-01"
  const [ceMonthTo,     setCeMonthTo]     = useState("")  // e.g. "2026-06"
  const [ceTimeView, setCeTimeView] = useState<"quarter" | "month">("quarter")

  // ── OAR filter state ─────────────────────────────────────
  const [oarFilterType,  setOarFilterType]  = useState("")
  const [oarFilterValue, setOarFilterValue] = useState("")
  const [oarYear,        setOarYear]        = useState("")

  // ── TTH filter state ─────────────────────────────────────
  const [tthFilterType,  setTthFilterType]  = useState("")
  const [tthFilterValue, setTthFilterValue] = useState("")
  const [tthYear,        setTthYear]        = useState("")

  // ── Turnover filter state ────────────────────────────────
  const [turFilterType,  setTurFilterType]  = useState("")
  const [turFilterValue, setTurFilterValue] = useState("")
  const [turYear,        setTurYear]        = useState("")

  // ── Load data ────────────────────────────────────────────
  useEffect(() => {
    const loadFromSupabase = async () => {
      const arr: MetricData[] = []

      // ── CE ──────────────────────────────────────────────
      const { data: ceData } = await supabase
        .from("candidate_experience_responses")
        .select("*")
        .order("response_date", { ascending: true })

      if (ceData && ceData.length > 0) {
        const avgQ1 = ceData.reduce((s, r) => s + (r.q1_overall || 0), 0) / ceData.length
        arr.push({ metric: "Candidate Experience", value: Number(avgQ1.toFixed(1)), unit: "/ 10", accent: "#6366f1", responses: ceData.length })
        setCeRows(ceData.map(r => ({
          outcome: (r.outcome || "").toString().trim().toLowerCase(),
          "q1 overall (0-10)": r.q1_overall,
          "q2 clarity": r.q2_clarity,
          "q3 timeliness": r.q3_timeliness,
          "q4 respect": r.q4_respect,
          "q5 role understanding": r.q5_role_understanding,
          "q6 inclusion": r.q6_inclusion,
          "q7 improvement opportunity": r.q7_improvement,
          "job family": r.job_family,
          "hiring bu": r.hiring_bu,
          location: r.location,
          stage: r.stage,
          "response date": r.response_date,
        })))
      }

      // ── OAR ─────────────────────────────────────────────
      const { data: oarData } = await supabase
        .from("offer_acceptance_rate")
        .select("*")

      if (oarData && oarData.length > 0) {
        const totalExt = oarData.reduce((s, r) => s + (r.offers_extended || 0), 0)
        const totalAcc = oarData.reduce((s, r) => s + (r.offers_accepted || 0), 0)
        const oarRate = totalExt ? Number(((totalAcc / totalExt) * 100).toFixed(1)) : 0
        arr.push({ metric: "Offer Acceptance Rate", value: oarRate, unit: "%", accent: "#10b981" })
        setOarRows(oarData.map(r => ({
          period: r.reporting_period,
          "hiring bu": r.hiring_bu,
          hiringbu: r.hiring_bu,
          location: r.location,
          "candidate type": r.candidate_type,
          "job family": r.job_family,
          level: r.level,
          "total number of offers extended": r.offers_extended,
          "number of offers accepted": r.offers_accepted,
        })))
      }

      // ── TTH ─────────────────────────────────────────────
      const { data: tthRaw } = await supabase
        .from("time_to_hire")
        .select("*")

      if (tthRaw && tthRaw.length > 0) {
        const totalHires = tthRaw.reduce((s, r) => s + (r.accepted_hires_count || 0), 0)
        const totalDays  = tthRaw.reduce((s, r) => s + (r.total_calendar_days || 0), 0)
        const avgTth = totalHires ? Number((totalDays / totalHires).toFixed(1)) : 0
        arr.push({ metric: "Avg. Days to Hire", value: avgTth, unit: " days", accent: "#3b82f6" })

        // Group by period for tthData structure
        const grouped: Record<string, { rows: TthRawRow[] }> = {}
        tthRaw.forEach(r => {
          const p = r.reporting_period || "Unknown"
          if (!grouped[p]) grouped[p] = { rows: [] }
          grouped[p].rows.push({
            "reporting period": r.reporting_period,
            "hiring bu": r.hiring_bu,
            "job family": r.job_family,
            level: r.level,
            "hiring source": r.hiring_source,
            "accepted hires count": r.accepted_hires_count,
            "total calendar days to hire": r.total_calendar_days,
          })
        })
        setTthData(grouped)
      }

      // ── Turnover ─────────────────────────────────────────
      const { data: turRaw } = await supabase
        .from("new_hire_turnover")
        .select("*")

      if (turRaw && turRaw.length > 0) {
        const totalCohort = turRaw.reduce((s, r) => s + (r.new_hires || 0), 0)
        const totalLeft   = turRaw.reduce((s, r) => s + (r.early_exits || 0), 0)
        const turRate = totalCohort ? Number(((totalLeft / totalCohort) * 100).toFixed(1)) : 0
        arr.push({ metric: "New Hire Turnover", value: turRate, unit: "%", accent: "#ec4899" })

        // Group by hire_cohort for turData structure
        const grouped: Record<string, TurnoverPeriodData> = {}
        turRaw.forEach(r => {
          const c = r.hire_cohort || "Unknown"
          if (!grouped[c]) grouped[c] = { rows: [], totalCohort: 0, totalLeft: 0, rate: 0, rate90: null }
          grouped[c].rows.push({
            "hire cohort": r.hire_cohort,
            "delivery unit": r.delivery_unit,
            "job family": r.job_family,
            "hiring source": r.hiring_source,
            "new hires in cohort": r.new_hires,
            "number of new hires who left within 12 months": r.early_exits,
          })
          grouped[c].totalCohort += r.new_hires || 0
          grouped[c].totalLeft   += r.early_exits || 0
        })
        Object.values(grouped).forEach(g => {
          g.rate = g.totalCohort ? Number(((g.totalLeft / g.totalCohort) * 100).toFixed(1)) : 0
        })
        setTurData(grouped)
      }

      setSummaryMetrics(arr)
    }

    loadFromSupabase()
  }, [])

  // ═══════════════════════════════════════════════════════════
  //  CE DERIVED DATA
  // ═══════════════════════════════════════════════════════════
  const ceLoaded = summaryMetrics.some(m => m.metric === "Candidate Experience")
  const ceMeta   = summaryMetrics.find(m => m.metric === "Candidate Experience")

  // Available years from response date
  const ceYears = useMemo(() =>
    uniq(ceRows.map(r => r["response date"]?.slice(0, 4)))
  , [ceRows])

  // All unique year-month values for range picker (e.g. "2026-01")
  const ceAllMonths = useMemo(() =>
    uniq(ceRows.map(r => r["response date"]?.slice(0, 7)).filter(Boolean))
  , [ceRows])

  // Value options for whichever filter type is selected
  const ceValueOptions = useMemo((): string[] => {
    if (!ceFilterType) return []
    switch (ceFilterType) {
      
      case "Application Outcome":
        return uniq(ceRows.map(r => r.outcome ? r.outcome.charAt(0).toUpperCase() + r.outcome.slice(1) : undefined))
      case "Job Family":
        return uniq(ceRows.map(r => r["job family"]))
      case "Hiring BU":
        return uniq(ceRows.map(r => r["hiring bu"]))
      case "Location":
        return uniq(ceRows.map(r => r.location))
      case "Recruitment Stage Reached":
        return uniq(ceRows.map(r => r.stage))
      case "Response Date":
        return uniq(ceRows.map(r => r["response date"]))
      default:
        return []
    }
  }, [ceFilterType, ceRows])

  // Which figures to show:
  // - If a filter type is selected, show only that filter's affected figures
  // - If no filter type, show all figures
  // - Year filter alone shows all figures (it just narrows the data)
  const ceVisibleFigs = useMemo((): string[] => {
    if (ceFilterType) return CE_FILTER_AFFECTS[ceFilterType] ?? []
    return ["Fig 1", "Fig 2", "Fig 3", "Fig 4"]
  }, [ceFilterType])

  // Apply year + month-range filter (month range takes priority over plain year)
  const ceYearFiltered = useMemo(() => {
    let rows = ceRows
    if (ceMonthFrom || ceMonthTo) {
      rows = rows.filter(r => {
        const ym = r["response date"]?.slice(0, 7) ?? ""
        if (!ym) return false
        if (ceMonthFrom && ym < ceMonthFrom) return false
        if (ceMonthTo   && ym > ceMonthTo)   return false
        return true
      })
    } else if (ceYear) {
      rows = rows.filter(r => r["response date"]?.startsWith(ceYear))
    }
    return rows
}, [ceRows, ceYear, ceMonthFrom, ceMonthTo])

  // Then apply filter type + value
  const ceFiltered = useMemo(() => {
    if (!ceFilterType || !ceFilterValue) return ceYearFiltered
    return ceYearFiltered.filter(r => {
      switch (ceFilterType) {
        case "Survey Period":
          return r["response date"] ? monthToQ(r["response date"].slice(0, 7)) === ceFilterValue : false
        case "Application Outcome":
          return (r.outcome?.charAt(0).toUpperCase() + r.outcome?.slice(1)) === ceFilterValue
        case "Job Family":
          return r["job family"] === ceFilterValue
        case "Hiring BU":
          return r["hiring bu"] === ceFilterValue
        case "Location":
          return r.location === ceFilterValue
        case "Recruitment Stage Reached":
          return r.stage === ceFilterValue
        case "Response Date":
          return r["response date"] === ceFilterValue
        default:
          return true
      }
    })
  }, [ceYearFiltered, ceFilterType, ceFilterValue])

  // ── CE chart data ─────────────────────────────────────────
  const DIMS = [
    { key: "q2 clarity" as keyof CeRawRow,             label: "Clarity" },
    { key: "q3 timeliness" as keyof CeRawRow,           label: "Timeliness" },
    { key: "q4 respect" as keyof CeRawRow,              label: "Respect" },
    { key: "q5 role understanding" as keyof CeRawRow,   label: "Role Understanding" },
    { key: "q6 inclusion" as keyof CeRawRow,            label: "Inclusion" },
  ]

  // Fig 1 — CE by Survey Period (line)
  const ceFig1 = useMemo(() => {
  const map: Record<string, number[]> = {}

  ceFiltered.forEach(r => {
    if (!r["response date"]) return

    const ym = r["response date"].slice(0, 7)

    const key =
      ceTimeView === "quarter"
        ? monthToQ(ym)
        : ym // YYYY-MM

    if (!map[key]) map[key] = []
    map[key].push(toNum(r["q1 overall (0-10)"]))
  })

  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, s]) => ({ period, avg: avgArr(s) }))
}, [ceFiltered, ceTimeView])

  // Fig 2 — Diagnostic dimensions (bar + radar)
  const ceFig2 = useMemo(() =>
    DIMS.map(({ key, label }) => {
      const scores = ceFiltered
        .map(r => toScore(r[key] as string))
        .filter((v): v is number => v !== null)
      return { label, avg: avgArr(scores), fullMark: 5 }
    })
  , [ceFiltered])

  const ceLowest = useMemo(() => [...ceFig2].sort((a, b) => a.avg - b.avg)[0], [ceFig2])

  // Fig 3 — CE by Application Outcome
  const ceFig3 = useMemo(() => {
    const avg = (rows: CeRawRow[]) => avgArr(rows.map(r => toNum(r["q1 overall (0-10)"])))
    const h  = ceFiltered.filter(r => r.outcome === "hired")
    const nh = ceFiltered.filter(r => r.outcome === "not hired")
    return [
      { outcome: "Hired",     score: avg(h),  count: h.length },
      { outcome: "Not Hired", score: avg(nh), count: nh.length },
    ].filter(d => d.count > 0)
  }, [ceFiltered])

  // Fig 4 — Q7 Improvement Feedback
  const ceFig4 = useMemo(() =>
    ceFiltered.filter(r => r["q7 improvement opportunity"])
  , [ceFiltered])

  const ceAvg = useMemo(() =>
    avgArr(ceFiltered.map(r => toNum(r["q1 overall (0-10)"])))
  , [ceFiltered])

  // ═══════════════════════════════════════════════════════════
  //  OAR DERIVED DATA
  // ═══════════════════════════════════════════════════════════
  const oarLoaded = summaryMetrics.some(m => m.metric === "Offer Acceptance Rate")
  const oarMeta   = summaryMetrics.find(m => m.metric === "Offer Acceptance Rate")

  const oarYears = useMemo(() =>
    uniq(oarRows.map(r => r.period?.slice(0, 4)))
  , [oarRows])

  const oarValueOptions = useMemo((): string[] => {
    if (!oarFilterType) return []
    switch (oarFilterType) {
      case "Reporting Period": return uniq(oarRows.map(r => r.period))
      case "Hiring BU":        return uniq(oarRows.map(r => r["hiring bu"] || r.hiringbu))
      case "Location":         return uniq(oarRows.map(r => r.location))
      case "Candidate Type":   return uniq(oarRows.map(r => r["candidate type"]))
      case "Job Family":       return uniq(oarRows.map(r => r["job family"]))
      case "Level":            return uniq(oarRows.map(r => r.level))
      default: return []
    }
  }, [oarFilterType, oarRows])

  const oarVisibleFigs = useMemo((): string[] => {
    if (oarFilterType) return OAR_FILTER_AFFECTS[oarFilterType] ?? []
    return ["Fig 1", "Fig 2", "Fig 3", "Fig 4"]
  }, [oarFilterType])

  const oarYearFiltered = useMemo(() =>
    oarYear ? oarRows.filter(r => r.period?.startsWith(oarYear)) : oarRows
  , [oarRows, oarYear])

  const oarFiltered = useMemo(() => {
    if (!oarFilterType || !oarFilterValue) return oarYearFiltered
    return oarYearFiltered.filter(r => {
      switch (oarFilterType) {
        case "Reporting Period": return r.period === oarFilterValue
        case "Hiring BU":       return (r["hiring bu"] || r.hiringbu) === oarFilterValue
        case "Location":        return r.location === oarFilterValue
        case "Candidate Type":  return r["candidate type"] === oarFilterValue
        case "Job Family":      return r["job family"] === oarFilterValue
        case "Level":           return r.level === oarFilterValue
        default: return true
      }
    })
  }, [oarYearFiltered, oarFilterType, oarFilterValue])

  const oarFig1 = useMemo(() => {
    const periods = uniq(oarFiltered.map(r => r.period))
    return periods.map(period => {
      const rows = oarFiltered.filter(r => r.period === period)
      const ext = rows.reduce((s, r) => s + toNum(r["total number of offers extended"]), 0)
      const acc = rows.reduce((s, r) => s + toNum(r["number of offers accepted"]), 0)
      return { period, rate: pct(acc, ext) }
    })
  }, [oarFiltered])

  const oarFig2 = useMemo(() => {
    const map: Record<string, { ext: number; acc: number }> = {}
    oarFiltered.forEach(r => {
      const bu = (r["hiring bu"] || r.hiringbu || "Unknown") as string
      if (!map[bu]) map[bu] = { ext: 0, acc: 0 }
      map[bu].ext += toNum(r["total number of offers extended"])
      map[bu].acc += toNum(r["number of offers accepted"])
    })
    return Object.entries(map)
      .map(([bu, d]) => ({ bu, extended: d.ext, accepted: d.acc, rate: pct(d.acc, d.ext) }))
      .filter(d => d.extended > 0)
  }, [oarFiltered])

  const oarFig3 = useMemo(() => {
    const map: Record<string, { ext: number; acc: number }> = {}
    oarFiltered.forEach(r => {
      const bu = (r["hiring bu"] || r.hiringbu || "Unknown") as string
      if (!map[bu]) map[bu] = { ext: 0, acc: 0 }
      map[bu].ext += toNum(r["total number of offers extended"])
      map[bu].acc += toNum(r["number of offers accepted"])
    })
    return Object.entries(map).map(([bu, d]) => ({ bu, rate: pct(d.acc, d.ext) }))
  }, [oarFiltered])

  const oarFig4 = useMemo(() => {
    const map: Record<string, { ext: number; acc: number }> = {}
    oarFiltered.forEach(r => {
      const loc = (r.location || "Unknown") as string
      if (!map[loc]) map[loc] = { ext: 0, acc: 0 }
      map[loc].ext += toNum(r["total number of offers extended"])
      map[loc].acc += toNum(r["number of offers accepted"])
    })
    return Object.entries(map).map(([location, d]) => ({ location, rate: pct(d.acc, d.ext) }))
  }, [oarFiltered])

  const oarTotals = useMemo(() => {
    const ext = oarFiltered.reduce((s, r) => s + toNum(r["total number of offers extended"]), 0)
    const acc = oarFiltered.reduce((s, r) => s + toNum(r["number of offers accepted"]), 0)
    return { ext, acc, rate: pct(acc, ext) }
  }, [oarFiltered])

  const oarC = (r: number) => r >= 80 ? "#10b981" : r >= 50 ? "#10b981" : "#ef4444"

  // ═══════════════════════════════════════════════════════════
  //  TTH DERIVED DATA
  // ═══════════════════════════════════════════════════════════
  const tthLoaded  = summaryMetrics.some(m => m.metric === "Avg. Days to Hire")
  const tthPeriods = useMemo(() => Object.keys(tthData).sort(), [tthData])
  const allTthRows = useMemo((): TthRawRow[] =>
    Object.values(tthData).flatMap(d => d.rows || [])
  , [tthData])

  const tthYears = useMemo(() =>
    uniq(tthPeriods.map(p => p.slice(0, 4)))
  , [tthPeriods])

  const tthValueOptions = useMemo((): string[] => {
    if (!tthFilterType) return []
    switch (tthFilterType) {
      case "Reporting Period": return tthPeriods
      case "Hiring BU":        return uniq(allTthRows.map(r => r["hiring bu"]))
      case "Job Family":       return uniq(allTthRows.map(r => r["job family"]))
      case "Level":            return uniq(allTthRows.map(r => r.level))
      case "Hiring Source":    return uniq(allTthRows.map(r => r["hiring source"]))
      default: return []
    }
  }, [tthFilterType, tthPeriods, allTthRows])

  const tthVisibleFigs = useMemo((): string[] => {
    if (tthFilterType) return TTH_FILTER_AFFECTS[tthFilterType] ?? []
    return ["Fig 1", "Fig 2", "Fig 3"]
  }, [tthFilterType])

  const tthYearFiltered = useMemo(() =>
    tthYear ? allTthRows.filter(r => {
      // TTH rows don't have dates; filter by period key if year matches
      const matchedPeriods = tthPeriods.filter(p => p.startsWith(tthYear))
      return matchedPeriods.some(p => tthData[p]?.rows.includes(r))
    }) : allTthRows
  , [allTthRows, tthYear, tthPeriods, tthData])

  const tthFiltered = useMemo(() => {
    if (!tthFilterType || !tthFilterValue) return tthYearFiltered
    if (tthFilterType === "Reporting Period") return tthData[tthFilterValue]?.rows || []
    return tthYearFiltered.filter(r => {
      switch (tthFilterType) {
        case "Hiring BU":     return r["hiring bu"]    === tthFilterValue
        case "Job Family":    return r["job family"]   === tthFilterValue
        case "Level":         return r.level           === tthFilterValue
        case "Hiring Source": return r["hiring source"] === tthFilterValue
        default: return true
      }
    })
  }, [tthYearFiltered, tthFilterType, tthFilterValue, tthData])

  const calcTth = (rows: TthRawRow[]) => {
    const hires = rows.reduce((s, r) => s + toNum(r["accepted hires count"]), 0)
    const days  = rows.reduce((s, r) => s + toNum(r["total calendar days to hire"]), 0)
    return { avg: hires ? Number((days / hires).toFixed(1)) : 0, hires, days }
  }

  const tthFig1 = useMemo(() =>
    tthPeriods
      .filter(p => !tthYear || p.startsWith(tthYear))
      .filter(p => !tthFilterValue || tthFilterType !== "Reporting Period" || p === tthFilterValue)
      .map(p => ({ period: p, avg: calcTth(tthData[p]?.rows || []).avg }))
  , [tthData, tthPeriods, tthYear, tthFilterType, tthFilterValue])

  const tthFig2 = useMemo(() => {
    const map: Record<string, { hires: number; days: number }> = {}
    tthFiltered.forEach(r => {
      const k = (r["job family"] as string || "Unknown").trim()
      if (!map[k]) map[k] = { hires: 0, days: 0 }
      map[k].hires += toNum(r["accepted hires count"])
      map[k].days  += toNum(r["total calendar days to hire"])
    })
    return Object.entries(map).map(([jobFamily, d]) => ({
      jobFamily, avg: d.hires ? Number((d.days / d.hires).toFixed(1)) : 0,
    }))
  }, [tthFiltered])

  const tthFig3 = useMemo(() => {
    const map: Record<string, { hires: number; days: number }> = {}
    tthFiltered.forEach(r => {
      const k = (r["hiring source"] as string || "Unknown").trim()
      if (!map[k]) map[k] = { hires: 0, days: 0 }
      map[k].hires += toNum(r["accepted hires count"])
      map[k].days  += toNum(r["total calendar days to hire"])
    })
    return Object.entries(map).map(([source, d]) => ({
      source, avg: d.hires ? Number((d.days / d.hires).toFixed(1)) : 0,
    }))
  }, [tthFiltered])

  const tthHeadline = useMemo(() => calcTth(tthFiltered), [tthFiltered])

  // ═══════════════════════════════════════════════════════════
  //  TURNOVER DERIVED DATA
  // ═══════════════════════════════════════════════════════════
  const turLoaded  = summaryMetrics.some(m => m.metric === "New Hire Turnover")
  const turCohorts = useMemo(() => Object.keys(turData).sort(), [turData])
  const allTurRows = useMemo((): TurnoverRawRow[] =>
    Object.values(turData).flatMap(d => d.rows || [])
  , [turData])

  // Resolve actual cohort column key — handles multi-line headers like
  // "New Hires in Cohort\n(Total Number of New Hires in the Same Period)"
  // which normalizes to "(total number of new hires in the same period)"
  const turCohortKey = useMemo(() => {
    const keys = allTurRows.length ? Object.keys(allTurRows[0]) : []
    return keys.find(k => k.startsWith("new hires in cohort"))
        ?? keys.find(k => k.includes("total number of new hires"))
        ?? "new hires in cohort"
  }, [allTurRows])

  const turYears = useMemo(() =>
    uniq(turCohorts.map(c => c.slice(0, 4)))
  , [turCohorts])

  const turValueOptions = useMemo((): string[] => {
    if (!turFilterType) return []
    switch (turFilterType) {
      case "Hire Cohort":   return turCohorts
      case "Delivery Unit": return uniq(allTurRows.map(r => r["delivery unit"]))
      case "Job Family":    return uniq(allTurRows.map(r => r["job family"]))
      case "Hiring Source": return uniq(allTurRows.map(r => r["hiring source"]))
      default: return []
    }
  }, [turFilterType, turCohorts, allTurRows])

  const turVisibleFigs = useMemo((): string[] => {
    if (turFilterType) return TUR_FILTER_AFFECTS[turFilterType] ?? []
    return ["Fig 1", "Fig 2", "Fig 3"]
  }, [turFilterType])

  const turYearFiltered = useMemo(() =>
    turYear ? allTurRows.filter(r => r["hire cohort"]?.startsWith(turYear)) : allTurRows
  , [allTurRows, turYear])

  const turFiltered = useMemo(() => {
    if (!turFilterType || !turFilterValue) return turYearFiltered
    if (turFilterType === "Hire Cohort") return turData[turFilterValue]?.rows || []
    return turYearFiltered.filter(r => {
      switch (turFilterType) {
        case "Delivery Unit": return r["delivery unit"]  === turFilterValue
        case "Job Family":    return r["job family"]     === turFilterValue
        case "Hiring Source": return r["hiring source"]  === turFilterValue
        default: return true
      }
    })
  }, [turYearFiltered, turFilterType, turFilterValue, turData])

  const turFig1 = useMemo(() =>
    turCohorts
      .filter(c => !turYear || c.startsWith(turYear))
      .filter(c => !turFilterValue || turFilterType !== "Hire Cohort" || c === turFilterValue)
      .map(c => ({ cohort: c, rate: turData[c]?.rate ?? 0 }))
  , [turData, turCohorts, turYear, turFilterType, turFilterValue])

  const turFig2 = useMemo(() => {
    const map: Record<string, { c: number; e: number }> = {}
    turFiltered.forEach(r => {
      const k = (r["delivery unit"] as string || "Unknown").trim()
      if (!map[k]) map[k] = { c: 0, e: 0 }
      map[k].c += toNum(r[turCohortKey])
      map[k].e += toNum(r["number of new hires who left within 12 months"])
    })
    return Object.entries(map).map(([unit, d]) => ({
      unit, cohort: d.c, exits: d.e, rate: pct(d.e, d.c),
    }))
  }, [turFiltered])

  const turFig3 = turFig2
  // Turnover: good (≤10%) → pink neutral, warn (≤20%) → amber, bad (>20%) → red
  const turC = (r: number) => r <= 10 ? "#ec4899" : r <= 20 ? "#ec4899" : "#ec4899"
  // TTH: fast (≤30d) → blue neutral, slow (≤60d) → amber, very slow (>60d) → red
  const tthC = (avg: number) => avg <= 30 ? "#3b82f6" : avg <= 60 ? "#f59e0b" : "#ef4444"

  const turHeadline = useMemo(() => {
    const c   = turFiltered.reduce((s, r) => s + toNum(r[turCohortKey]), 0)
    const e   = turFiltered.reduce((s, r) => s + toNum(r["number of new hires who left within 12 months"]), 0)
    const l90 = turFiltered.reduce((s, r) => s + toNum(r["number of new hires who left within 90 days"]), 0)
    return { cohort: c, exits: e, rate: pct(e, c), rate90: c && l90 > 0 ? pct(l90, c) : null }
  }, [turFiltered])

  // ─── Tabs ────────────────────────────────────────────────
  const TABS = [
    { key: "ce",       label: "Candidate Experience",  accent: "#6366f1", loaded: ceLoaded },
    { key: "oar",      label: "Offer Acceptance Rate", accent: "#10b981", loaded: oarLoaded },
    { key: "tth",      label: "Time to Hire",          accent: "#3b82f6", loaded: tthLoaded },
    { key: "turnover", label: "New Hire Turnover",     accent: "#ec4899", loaded: turLoaded },
  ] as const

  // ─── Render ──────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; }
        select { font-family: inherit; }
        @media print { .no-print { display: none !important; } }
      `}</style>

      {/* ── Sticky white top header — matches dashboard layout ── */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e2e8f0", padding: "0 24px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>

          {/* Brand row */}
          <div style={{ display: "flex", alignItems: "center", gap: 14, paddingTop: 24, paddingBottom: 16 }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: "linear-gradient(135deg, #6366f1, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, boxShadow: "0 4px 14px #6366f140", flexShrink: 0 }}>📋</div>
            <div>
              <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#0f172a", letterSpacing: "-.02em" }}>EX Reports</h1>
              <p style={{ margin: 0, fontSize: 12, color: "#94a3b8", marginTop: 2 }}>Employee Experience · Phase 1 MVP</p>
            </div>
          </div>

          {/* ── Lifecycle phase tabs — same underline style as dashboard ── */}
          <div style={{ display: "flex", gap: 0, overflowX: "auto", marginBottom: -1 }}>
            {([
              { key: "hiring",      label: "Hiring",                    icon: "", active: true  },
              { key: "onboarding",  label: "Onboarding",                icon: "", active: true  },
              { key: "performance", label: "Performance & Manager Exp.", icon: "", active: true  },
              { key: "engagement",  label: "Engagement and Retention",  icon: "", active: true },
              { key: "wellbeing",   label: "Wellbeing",                 icon: "", active: true },
              { key: "offboarding", label: "Offboarding",               icon: "", active: true },
            ] as const).map(phase => {
              const isActive = activePhase === phase.key
              return (
                <button
                  key={phase.key}
                  onClick={() => phase.active && setActivePhase(phase.key as "hiring" | "onboarding" | "performance" | "engagement" | "wellbeing" | "offboarding")}
                  style={{
                    display: "flex", alignItems: "center", gap: 7,
                    padding: "12px 20px", background: "transparent", border: "none",
                    borderBottom: isActive ? "2px solid #6366f1" : "2px solid transparent",
                    cursor: phase.active ? "pointer" : "default",
                    opacity: phase.active ? 1 : 0.4,
                    color: isActive ? "#6366f1" : "#64748b",
                    fontSize: 13, fontWeight: isActive ? 700 : 500,
                    fontFamily: "'DM Sans', sans-serif", whiteSpace: "nowrap",
                    transition: "all .18s",
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

      {/* ── Onboarding reports ── */}
      {activePhase === "onboarding" && <div style={{ padding: "36px 24px 60px" }}><OnboardingReportsPage /></div>}

      {/* ── Performance & Manager Exp. reports ── */}
      {activePhase === "performance" && <div style={{ padding: "36px 24px 60px" }}><PerformanceReportsPage /></div>}

      {/* ── Engagement & Retention Exp. reports ── */}
      {activePhase === "engagement" && <div style={{ padding: "36px 24px 60px" }}><EngRetReportsPage/></div>}
  
      {activePhase === "wellbeing" && <div style={{ padding: "36px 24px 60px" }}><WellbeingReportsPage /></div>}
     
      {activePhase === "offboarding" && <div style={{ padding: "36px 24px 60px" }}><OffboardingReportsPage /></div>}
      
      {/* ── Hiring reports ── */}
      {activePhase === "hiring" && <div style={{ padding: "36px 24px 60px" }}><div style={{ maxWidth: 1100, margin: "0 auto" }}>


        {/* KPI row */}
        {summaryMetrics.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12, marginBottom: 24 }}>
            {summaryMetrics.map(m => (
              <Card key={m.metric} style={{ padding: "16px 20px" }}>
                <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6 }}>{m.metric}</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                  <span style={{ fontSize: 30, fontWeight: 800, color: m.accent, lineHeight: 1 }}>{m.value}</span>
                  <span style={{ fontSize: 12, color: m.accent + "99", fontWeight: 600 }}>{m.unit}</span>
                </div>
                {m.responses !== undefined && (
                  <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 3 }}>{m.responses} responses</div>
                )}
              </Card>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="no-print" style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              style={{
                padding: "8px 20px", borderRadius: 20, fontSize: 12, fontWeight: 700,
                cursor: "pointer", border: "none", transition: "all .18s",
                background: activeTab === t.key ? t.accent : "#fff",
                color: activeTab === t.key ? "#fff" : t.loaded ? "#475569" : "#cbd5e1",
                opacity: t.loaded ? 1 : 0.45,
                boxShadow: activeTab === t.key ? `0 4px 14px ${t.accent}45` : "0 1px 3px rgba(0,0,0,.06)",
              }}
            >
              {t.loaded ? "●" : "○"} {t.label}
            </button>
          ))}
        </div>

        {/* ══════════════════════════════════════
            CANDIDATE EXPERIENCE
        ══════════════════════════════════════ */}
        {activeTab === "ce" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {!ceLoaded ? <Card><EmptyState label="Candidate Experience" /></Card> : (
              <>
                {/* CE Filter — with month range */}
                <CeFilterBar
                  filterKeys={CE_FILTER_KEYS}
                  affectsMap={CE_FILTER_AFFECTS}
                  years={ceYears}
                  allMonths={ceAllMonths}
                  filterType={ceFilterType}
                  filterValue={ceFilterValue}
                  selectedYear={ceYear}
                  monthFrom={ceMonthFrom}
                  monthTo={ceMonthTo}
                  onFilterType={setCeFilterType}
                  onFilterValue={setCeFilterValue}
                  onYear={setCeYear}
                  onMonthFrom={setCeMonthFrom}
                  onMonthTo={setCeMonthTo}
                  onClear={() => { setCeFilterType(""); setCeFilterValue(""); setCeYear(""); setCeMonthFrom(""); setCeMonthTo("") }}
                  valueOptions={ceValueOptions}
                />
 
                {/* Export */}
                <div className="no-print">
                  <ExportBar
                    onCSV={() => exportCSV(ceFiltered as object[], "CE_data")}
                    onXLSX={() => exportXLSX(ceFiltered as object[], "CE_data")}
                  />
                </div>

                

                {/* Headline summary — always visible */}
                <Card>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 14 }}>
                    Candidate Experience — Summary
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10 }}>
                    <StatPill label="Overall CE Score"   value={`${ceMeta?.value ?? "—"} / 10`} accent="#6366f1" sub={`${ceMeta?.responses ?? 0} total responses`} />
                    <StatPill label="Filtered Responses" value={ceFiltered.length}               accent="#6366f1" />
                    <StatPill label="Filtered Avg Q1"    value={ceAvg > 0 ? `${ceAvg} / 10` : "—"} accent="#6366f1" />
                    {ceLowest?.avg > 0 && (
                      <StatPill label="Lowest Dimension" value={ceLowest.label} accent="#ef4444" sub={`${ceLowest.avg} / 5`} />
                    )}
                    {ceFig3.map(d => (
                      <StatPill
                        key={d.outcome}
                        label={`${d.outcome} Avg`}
                        value={`${d.score} / 10`}
                        accent={d.outcome === "Hired" ? "#10b981" : "#f59e0b"}
                        sub={`${d.count} resp.`}
                      />
                    ))}
                  </div>
                </Card>

                {/* Fig 1 — CE Score by Survey Period */}
{ceVisibleFigs.includes("Fig 1") && (
  <FigCard
    fig="Fig 1"
    title="Overall CE Score by Survey Period"
    subtitle={`Line chart · tracks score changes across ${
      ceTimeView === "quarter" ? "quarters" : "months"
    } · affected by: Survey Period, Response Date`}
  >
    {/* 🔥 TOGGLE (ADD THIS) */}
    <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
      <div style={{ display: "flex", gap: 6, background: "#f8fafc", padding: 4, borderRadius: 10 }}>
        <button
          onClick={() => setCeTimeView("quarter")}
          style={{
            padding: "4px 10px",
            borderRadius: 8,
            border: "none",
            fontSize: 12,
            cursor: "pointer",
            background: ceTimeView === "quarter" ? "#6366f1" : "transparent",
            color: ceTimeView === "quarter" ? "#fff" : "#64748b",
            fontWeight: 600
          }}
        >
          Quarter
        </button>

        <button
          onClick={() => setCeTimeView("month")}
          style={{
            padding: "4px 10px",
            borderRadius: 8,
            border: "none",
            fontSize: 12,
            cursor: "pointer",
            background: ceTimeView === "month" ? "#6366f1" : "transparent",
            color: ceTimeView === "month" ? "#fff" : "#64748b",
            fontWeight: 600
          }}
        >
          Month
        </button>
      </div>
    </div>

    {/* Chart */}
    {ceFig1.length < 2
      ? <EmptyChart msg="Need data across ≥2 periods to show trend" />
      : (
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={ceFig1} margin={{ top: 10, right: 30, left: 0, bottom: 10 }}>
            <CartesianGrid strokeDasharray="4 4" stroke="#f1f5f9" />
            <XAxis dataKey="period" tick={{ fill: "#94a3b8", fontSize: 12 }} />
            <YAxis domain={[0, 10]} tick={{ fill: "#94a3b8", fontSize: 12 }} />
            <Tooltip content={<CT unit=" / 10" />} />
            <Line
              type="monotone"
              dataKey="avg"
              name="CE Score"
              stroke="#6366f1"
              strokeWidth={2.5}
              dot={{ r: 5, fill: "#6366f1", strokeWidth: 0 }}
              activeDot={{ r: 7 }}
            />
          </LineChart>
        </ResponsiveContainer>
      )
    }
  </FigCard>
)}

                {/* Fig 2 — Diagnostic Dimensions */}
                {ceVisibleFigs.includes("Fig 2") && (
                  <FigCard
                    fig="Fig 2"
                    title="Average Diagnostic Scores by Experience Dimension"
                    subtitle="Horizontal bar + radar · scale 1–5 · affected by: Survey Period, Job Family, BU, Location, Stage"
                  >
                    {ceFig2.every(d => d.avg === 0)
                      ? <EmptyChart msg="No diagnostic scores in current selection" />
                      : (
                        <>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                            <ResponsiveContainer width="100%" height={280}>
                              <BarChart layout="vertical" data={ceFig2} margin={{ top: 4, right: 30, left: 10, bottom: 4 }}>
                                <CartesianGrid strokeDasharray="4 4" stroke="#f1f5f9" horizontal={false} />
                                <XAxis type="number" domain={[0, 5]} tick={{ fill: "#94a3b8", fontSize: 11 }} />
                                <YAxis type="category" dataKey="label" tick={{ fill: "#475569", fontSize: 12 }} width={110} />
                                <Tooltip content={<CT unit=" / 5" />} />
                                <Bar dataKey="avg" name="Avg Score" radius={[0, 6, 6, 0]}>
                                  {ceFig2.map((d, i) => (
                                    <Cell
                                      key={i}
                                      fill={d.label === ceLowest?.label ? "#ef4444" : "#6366f1"}
                                      fillOpacity={d.label === ceLowest?.label ? 1 : 0.7}
                                    />
                                  ))}
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                            <ResponsiveContainer width="100%" height={280}>
                              <RadarChart data={ceFig2}>
                                <PolarGrid stroke="#e2e8f0" />
                                <PolarAngleAxis dataKey="label" tick={{ fill: "#475569", fontSize: 11 }} />
                                <PolarRadiusAxis domain={[0, 5]} tick={{ fill: "#94a3b8", fontSize: 10 }} />
                                <Radar name="Score" dataKey="avg" stroke="#6366f1" fill="#6366f1" fillOpacity={0.2} strokeWidth={2} />
                                <Tooltip content={<CT unit=" / 5" />} />
                              </RadarChart>
                            </ResponsiveContainer>
                          </div>
                        </>
                      )
                    }
                  </FigCard>
                )}

                {/* Fig 3 — CE by Application Outcome */}
                {ceVisibleFigs.includes("Fig 3") && (
                  <FigCard
                    fig="Fig 3"
                    title="Candidate Experience by Application Outcome"
                    subtitle="Clustered bar · hired vs. not-hired Q1 scores · affected by: all filters"
                  >
                    {ceFig3.length === 0
                      ? <EmptyChart msg="No outcome data in current selection" />
                      : (
                        <>
                          <ResponsiveContainer width="100%" height={240}>
                            <BarChart data={ceFig3} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                              <CartesianGrid strokeDasharray="4 4" stroke="#f1f5f9" />
                              <XAxis dataKey="outcome" tick={{ fill: "#475569", fontSize: 13, fontWeight: 600 }} />
                              <YAxis domain={[0, 10]} tick={{ fill: "#94a3b8", fontSize: 12 }} />
                              <Tooltip content={<CT unit=" / 10" />} />
                              <Bar dataKey="score" name="Avg Q1 Score" radius={[8, 8, 0, 0]}>
                                {ceFig3.map((d, i) => (
                                  <Cell key={i} fill={d.outcome === "Hired" ? "#6366f1" : "#94a3b8"} />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                          <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                            {ceFig3.map(d => (
                              <div
                                key={d.outcome}
                                style={{
                                  flex: 1,
                                  background: d.outcome === "Hired" ? "#6366f108" : "#f8fafc",
                                  border: `1px solid ${d.outcome === "Hired" ? "#6366f122" : "#e2e8f0"}`,
                                  borderRadius: 12, padding: "12px 14px",
                                }}
                              >
                                <div style={{ fontSize: 11, fontWeight: 700, color: d.outcome === "Hired" ? "#6366f1" : "#94a3b8", marginBottom: 3 }}>
                                  {d.outcome}
                                </div>
                                <div style={{ fontSize: 20, fontWeight: 800, color: d.outcome === "Hired" ? "#6366f1" : "#475569" }}>
                                  {d.score}<span style={{ fontSize: 12, opacity: .5, marginLeft: 3 }}>/ 10</span>
                                </div>
                                <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                                  {d.count} respondent{d.count !== 1 ? "s" : ""}
                                </div>
                              </div>
                            ))}
                          </div>
                        </>
                      )
                    }
                  </FigCard>
                )}

                {/* Fig 4 — Q7 Improvement Feedback */}
                {ceVisibleFigs.includes("Fig 4") && (
                  <FigCard
                    fig="Fig 4"
                    title="Improvement Opportunity Themes (Q7)"
                    subtitle="Open-ended feedback · affected by: Job Family, Hiring BU, Location, Recruitment Stage"
                  >
                    {ceFig4.length === 0
                      ? <EmptyChart msg="No Q7 feedback in current selection" />
                      : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          {ceFig4.map((r, i) => (
                            <div
                              key={i}
                              style={{
                                padding: "11px 14px", background: "#f8fafc",
                                border: "1px solid #e2e8f0", borderRadius: 10,
                                fontSize: 13, color: "#475569",
                                borderLeft: "3px solid #6366f1",
                              }}
                            >
                              <span style={{ fontSize: 11, color: "#94a3b8", display: "block", marginBottom: 4 }}>
                                {r.outcome} · {r.stage ?? "—"} · {r["job family"] ?? "—"} · {r["response date"] ?? "—"}
                              </span>
                              "{r["q7 improvement opportunity"]}"
                            </div>
                          ))}
                          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
                            {ceFig4.length} comment{ceFig4.length !== 1 ? "s" : ""} received
                          </div>
                        </div>
                      )
                    }
                  </FigCard>
                )}
              </>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════
            OFFER ACCEPTANCE RATE
        ══════════════════════════════════════ */}
        {activeTab === "oar" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {!oarLoaded ? <Card><EmptyState label="Offer Acceptance Rate" /></Card> : (
              <>
                <TwoDropFilter
                  filterKeys={Object.keys(OAR_FILTER_AFFECTS)}
                  affectsMap={OAR_FILTER_AFFECTS}
                  years={oarYears}
                  filterType={oarFilterType}
                  filterValue={oarFilterValue}
                  selectedYear={oarYear}
                  onFilterType={setOarFilterType}
                  onFilterValue={setOarFilterValue}
                  onYear={setOarYear}
                  onClear={() => { setOarFilterType(""); setOarFilterValue(""); setOarYear("") }}
                  accent="#10b981"
                  valueOptions={oarValueOptions}
                />

                

                <Card>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 14 }}>
                    Offer Acceptance Rate — Summary
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10 }}>
                    <StatPill label="OAR"             value={`${oarTotals.rate}%`} accent="#10b981" sub="(Accepted ÷ Extended) × 100" />
                    <StatPill label="Offers Extended" value={oarTotals.ext}         accent="#10b981" />
                    <StatPill label="Offers Accepted" value={oarTotals.acc}         accent="#10b981" />
                    <StatPill label="Target"          value="≥ 80%"                 accent="#f59e0b" />
                  </div>
                </Card>

                {oarVisibleFigs.includes("Fig 1") && (
                  <FigCard fig="Fig 1" title="OAR by Reporting Period" subtitle="Line chart · trend over time · affected by: Reporting Period">
                    {oarFig1.length < 2
                      ? <EmptyChart msg="Need ≥2 reporting periods to show trend" />
                      : (
                        <ResponsiveContainer width="100%" height={280}>
                          <LineChart data={oarFig1} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                            <CartesianGrid strokeDasharray="4 4" stroke="#f1f5f9" />
                            <XAxis dataKey="period" tick={{ fill: "#94a3b8", fontSize: 12 }} />
                            <YAxis domain={[0, 100]} tick={{ fill: "#94a3b8", fontSize: 12 }} unit="%" />
                            <Tooltip content={<CT unit="%" />} />
                            <Line type="monotone" dataKey="rate" name="OAR" stroke="#10b981" strokeWidth={2.5} dot={{ r: 5, fill: "#10b981", strokeWidth: 0 }} activeDot={{ r: 7 }} />
                          </LineChart>
                        </ResponsiveContainer>
                      )
                    }
                  </FigCard>
                )}

                {oarVisibleFigs.includes("Fig 2") && (
                  <FigCard fig="Fig 2" title="Offers Extended vs. Offers Accepted by BU" subtitle="Clustered column · affected by: Reporting Period, Candidate Type, Job Family, Level">
                    {oarFig2.length === 0 ? <EmptyChart msg="No data in current selection" /> : (
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={oarFig2} margin={{ top: 10, right: 20, left: 0, bottom: 60 }}>
                          <CartesianGrid strokeDasharray="4 4" stroke="#f1f5f9" />
                          <XAxis dataKey="bu" tick={{ fill: "#475569", fontSize: 11 }} angle={-35} textAnchor="end" interval={0} />
                          <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} />
                          <Tooltip content={<CT />} />
                          <Legend verticalAlign="top" align="right" wrapperStyle={{ fontSize: 12, paddingBottom: 8 }} />
                          <Bar dataKey="extended" name="Offers Extended" fill="#94a3b8" fillOpacity={0.6} radius={[4, 4, 0, 0]} />
                          <Bar dataKey="accepted" name="Offers Accepted" fill="#10b981" fillOpacity={0.85} radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </FigCard>
                )}

                {oarVisibleFigs.includes("Fig 3") && (
                  <FigCard fig="Fig 3" title="OAR by Hiring BU" subtitle="Horizontal bar · affected by: Hiring BU, Candidate Type, Job Family, Level">
                    {oarFig3.length === 0 ? <EmptyChart msg="No BU data in current selection" /> : (
                      <>
                        <ResponsiveContainer width="100%" height={Math.max(200, oarFig3.length * 50)}>
                          <BarChart layout="vertical" data={oarFig3} margin={{ top: 4, right: 60, left: 10, bottom: 4 }}>
                            <CartesianGrid strokeDasharray="4 4" stroke="#f1f5f9" horizontal={false} />
                            <XAxis type="number" domain={[0, 100]} tick={{ fill: "#94a3b8", fontSize: 11 }} unit="%" />
                            <YAxis type="category" dataKey="bu" tick={{ fill: "#475569", fontSize: 12 }} width={130} />
                            <Tooltip content={<CT unit="%" />} />
                            <Bar dataKey="rate" name="Acceptance Rate" radius={[0, 6, 6, 0]}>
                              {oarFig3.map((d, i) => <Cell key={i} fill={oarC(d.rate)} />)}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
                          {oarFig3.map((d, i) => (
                            <span key={i} style={{ fontSize: 11, fontWeight: 700, background: oarC(d.rate) + "18", color: oarC(d.rate), border: `1px solid ${oarC(d.rate)}28`, borderRadius: 20, padding: "3px 11px" }}>
                              {d.bu}: {d.rate.toFixed(1)}%
                            </span>
                          ))}
                        </div>
                      </>
                    )}
                  </FigCard>
                )}

                {oarVisibleFigs.includes("Fig 4") && (
                  <FigCard fig="Fig 4" title="OAR by Location" subtitle="Bar chart · site-level differences · affected by: Location, Candidate Type, Job Family, Level">
                    {oarFig4.length === 0 ? <EmptyChart msg="No location data in current selection" /> : (
                      <ResponsiveContainer width="100%" height={260}>
                        <BarChart data={oarFig4} margin={{ top: 10, right: 20, left: 0, bottom: 40 }}>
                          <CartesianGrid strokeDasharray="4 4" stroke="#f1f5f9" />
                          <XAxis dataKey="location" tick={{ fill: "#475569", fontSize: 11 }} angle={-25} textAnchor="end" interval={0} />
                          <YAxis domain={[0, 100]} tick={{ fill: "#94a3b8", fontSize: 12 }} unit="%" />
                          <Tooltip content={<CT unit="%" />} />
                          <Bar dataKey="rate" name="Acceptance Rate" radius={[6, 6, 0, 0]}>
                            {oarFig4.map((d, i) => <Cell key={i} fill={oarC(d.rate)} />)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </FigCard>
                )}
              </>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════
            TIME TO HIRE
        ══════════════════════════════════════ */}
        {activeTab === "tth" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {!tthLoaded ? <Card><EmptyState label="Time to Hire" /></Card> : (
              <>
                <TwoDropFilter
                  filterKeys={Object.keys(TTH_FILTER_AFFECTS)}
                  affectsMap={TTH_FILTER_AFFECTS}
                  years={tthYears}
                  filterType={tthFilterType}
                  filterValue={tthFilterValue}
                  selectedYear={tthYear}
                  onFilterType={setTthFilterType}
                  onFilterValue={setTthFilterValue}
                  onYear={setTthYear}
                  onClear={() => { setTthFilterType(""); setTthFilterValue(""); setTthYear("") }}
                  accent="#3b82f6"
                  valueOptions={tthValueOptions}
                />

               

                <Card>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 14 }}>Time to Hire — Summary</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10 }}>
                    <StatPill label="Avg TTH"             value={`${tthHeadline.avg} days`} accent="#3b82f6" sub="Total days ÷ accepted hires" />
                    <StatPill label="Accepted Hires"      value={tthHeadline.hires}          accent="#3b82f6" />
                    <StatPill label="Total Calendar Days" value={tthHeadline.days}           accent="#3b82f6" />
                  </div>
                </Card>

                {tthVisibleFigs.includes("Fig 1") && (
                  <FigCard fig="Fig 1" title="Average Time to Hire by Quarter" subtitle="Line chart · quarter-over-quarter speed · affected by: Reporting Period">
                    {tthFig1.length === 0 ? <EmptyChart msg="No period data available" /> : (
                      <ResponsiveContainer width="100%" height={280}>
                        <LineChart data={tthFig1} margin={{ top: 10, right: 60, left: 0, bottom: 10 }}>
                          <CartesianGrid strokeDasharray="4 4" stroke="#e2e8f0" />
                          <XAxis dataKey="period" tick={{ fill: "#94a3b8", fontSize: 12 }} />
                          <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} />
                          <Tooltip content={<CT unit=" days" />} />
                          <Line type="monotone" dataKey="avg" name="Avg TTH" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 5, fill: "#3b82f6", strokeWidth: 0 }} activeDot={{ r: 7 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    )}
                  </FigCard>
                )}

                {tthVisibleFigs.includes("Fig 2") && (
                  <FigCard fig="Fig 2" title="Average TTH by Job Family" subtitle="Horizontal bar · affected by: Hiring BU, Job Family, Level">
                    {tthFig2.length === 0 ? <EmptyChart msg="No job family data" /> : (
                      <ResponsiveContainer width="100%" height={Math.max(200, tthFig2.length * 46)}>
                        <BarChart layout="vertical" data={tthFig2} margin={{ top: 10, right: 20, left: 80, bottom: 10 }}>
                          <CartesianGrid strokeDasharray="4 4" stroke="#e2e8f0" horizontal={false} />
                          <XAxis type="number" tick={{ fill: "#94a3b8", fontSize: 12 }} />
                          <YAxis type="category" dataKey="jobFamily" tick={{ fill: "#475569", fontSize: 12 }} width={130} />
                          <Tooltip content={<CT unit=" days" />} />
                          <Bar dataKey="avg" name="Avg Days" radius={[0, 6, 6, 0]}>
                            {tthFig2.map((d, i) => <Cell key={i} fill={tthC(d.avg)} />)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </FigCard>
                )}

                {tthVisibleFigs.includes("Fig 3") && (
                  <FigCard fig="Fig 3" title="Time to Hire by Hiring Source" subtitle="Bar chart · affected by: Hiring Source, BU, Job Family, Level">
                    {tthFig3.length === 0 ? <EmptyChart msg="No hiring source data" /> : (
                      <ResponsiveContainer width="100%" height={260}>
                        <BarChart data={tthFig3} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                          <CartesianGrid strokeDasharray="4 4" stroke="#e2e8f0" />
                          <XAxis dataKey="source" tick={{ fill: "#475569", fontSize: 12 }} />
                          <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} />
                          <Tooltip content={<CT unit=" days" />} />
                          <Bar dataKey="avg" name="Avg Days" radius={[8, 8, 0, 0]}>
                            {tthFig3.map((d, i) => <Cell key={i} fill={tthC(d.avg)} />)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </FigCard>
                )}
              </>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════
            NEW HIRE TURNOVER
        ══════════════════════════════════════ */}
        {activeTab === "turnover" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {!turLoaded ? <Card><EmptyState label="New Hire Turnover" /></Card> : (
              <>
                <TwoDropFilter
                  filterKeys={Object.keys(TUR_FILTER_AFFECTS)}
                  affectsMap={TUR_FILTER_AFFECTS}
                  years={turYears}
                  filterType={turFilterType}
                  filterValue={turFilterValue}
                  selectedYear={turYear}
                  onFilterType={setTurFilterType}
                  onFilterValue={setTurFilterValue}
                  onYear={setTurYear}
                  onClear={() => { setTurFilterType(""); setTurFilterValue(""); setTurYear("") }}
                  accent="#ec4899"
                  valueOptions={turValueOptions}
                />

              

                <Card>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 14 }}>New Hire Turnover — Summary</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10 }}>
                    <StatPill label="12-Month NH-TR"    value={`${turHeadline.rate}%`} accent="#ec4899" sub="(Exits ÷ Cohort) × 100" />
                    <StatPill label="Cohort Size"        value={turHeadline.cohort}     accent="#ec4899" />
                    <StatPill label="Early-Tenure Exits" value={turHeadline.exits}      accent="#ec4899" />
                    {turHeadline.rate90 != null && (
                      <StatPill label="90-Day Rate" value={`${turHeadline.rate90}%`} accent="#f59e0b" sub="Supplementary view" />
                    )}
                  </div>
                </Card>

                {turVisibleFigs.includes("Fig 1") && (
                  <FigCard fig="Fig 1" title="12-Month NH-TR by Hire Cohort" subtitle="Line chart · cohort-over-cohort trend · affected by: Hire Cohort">
                    {turFig1.length < 2 ? <EmptyChart msg="Need ≥2 cohorts to show trend" /> : (
                      <ResponsiveContainer width="100%" height={280}>
                        <LineChart data={turFig1} margin={{ top: 10, right: 60, left: 0, bottom: 10 }}>
                          <CartesianGrid strokeDasharray="4 4" stroke="#f1f5f9" />
                          <XAxis dataKey="cohort" tick={{ fill: "#94a3b8", fontSize: 12 }} />
                          <YAxis domain={[0, 100]} tick={{ fill: "#94a3b8", fontSize: 12 }} unit="%" />
                          <Tooltip content={<CT unit="%" />} />
                          <Line type="monotone" dataKey="rate" name="Turnover Rate" stroke="#ec4899" strokeWidth={2.5} dot={{ r: 5, fill: "#ec4899", strokeWidth: 0 }} activeDot={{ r: 7 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    )}
                  </FigCard>
                )}

                {turVisibleFigs.includes("Fig 2") && (
                  <FigCard fig="Fig 2" title="NH-TR by Delivery Unit" subtitle="Horizontal bar · affected by: Delivery Unit, Job Family, Hiring Source">
                    {turFig2.length === 0 ? <EmptyChart msg="No delivery unit data" /> : (
                      <ResponsiveContainer width="100%" height={Math.max(200, turFig2.length * 50)}>
                        <BarChart layout="vertical" data={turFig2} margin={{ top: 4, right: 60, left: 10, bottom: 4 }}>
                          <CartesianGrid strokeDasharray="4 4" stroke="#f1f5f9" horizontal={false} />
                          <XAxis type="number" domain={[0, 100]} tick={{ fill: "#94a3b8", fontSize: 11 }} unit="%" />
                          <YAxis type="category" dataKey="unit" tick={{ fill: "#475569", fontSize: 12 }} width={130} />
                          <Tooltip content={<CT unit="%" />} />
                          <Bar dataKey="rate" name="Turnover Rate" radius={[0, 6, 6, 0]}>
                            {turFig2.map((d, i) => <Cell key={i} fill={turC(d.rate)} />)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </FigCard>
                )}

                {turVisibleFigs.includes("Fig 3") && (
                  <FigCard fig="Fig 3" title="Cohort Size vs Early Exits by Delivery Unit" subtitle="Clustered column · affected by: Delivery Unit, Job Family, Hiring Source">
                    {turFig3.length === 0 ? <EmptyChart msg="No data in current selection" /> : (
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={turFig3} margin={{ top: 10, right: 20, left: 0, bottom: 60 }}>
                          <CartesianGrid strokeDasharray="4 4" stroke="#f1f5f9" />
                          <XAxis dataKey="unit" tick={{ fill: "#475569", fontSize: 11 }} angle={-35} textAnchor="end" interval={0} />
                          <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} />
                          <Tooltip content={<CT />} />
                          <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                          <Bar dataKey="cohort" name="Cohort Size" fill="#94a3b8" fillOpacity={0.6} radius={[4, 4, 0, 0]} />
                          <Bar dataKey="exits"  name="Early Exits" radius={[4, 4, 0, 0]}>
                            {turFig3.map((d, i) => <Cell key={i} fill={turC(d.rate)} />)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </FigCard>
                )}
              </>
            )}
          </div>
        )}

      </div></div>}

      <div style={{ textAlign: "center", padding: "40px 0", fontSize: 11, color: "#cbd5e1" }}>
        
      </div>
    </div>
  )
}