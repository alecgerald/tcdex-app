"use client"

import { Filter, Download, Search, X, FileDown, Loader2 } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"

interface FilterState {
  year: string
  quarters: string[]
  units: string[]
  modes: string[]
  priorities: string[]
  statuses: string[]
  leadSearch: string
  buSearch: string
}

interface Props {
  filters: FilterState
  onChange: (f: FilterState) => void
  onExport: () => void
  onExportPdf?: () => void
  isPdfExporting?: boolean
  uniqueYears: number[]
  uniqueBUs: string[]
}

const ALL_QUARTERS = ["Q1", "Q2", "Q3", "Q4"]
const ALL_UNITS = ["TD", "LSE", "DEIB", "EX", "Comms"]
const ALL_MODES = ["VILT", "ILT", "Self-paced", "Hybrid"]
const ALL_PRIORITIES = ["HIGH", "MEDIUM", "LOW"]
const ALL_STATUSES = ["COMPLETED", "IN_PROGRESS", "NOT_STARTED"]

function ChipGroup({
  options,
  selected,
  colorMap,
  onChange,
}: {
  options: string[]
  selected: string[]
  colorMap?: Record<string, string>
  onChange: (s: string[]) => void
}) {
  const toggle = (v: string) => {
    onChange(selected.includes(v) ? selected.filter(x => x !== v) : [...selected, v])
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(o => {
        const active = selected.includes(o)
        const customColor = colorMap?.[o]
        return (
          <button
            key={o}
            onClick={() => toggle(o)}
            className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-all ${
              active
                ? customColor
                  ? `${customColor} border-transparent text-white`
                  : "bg-[#0046ab] text-white border-[#0046ab]"
                : "bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400"
            }`}
          >
            {o}
          </button>
        )
      })}
    </div>
  )
}

export default function FilterBar({ filters, onChange, onExport, onExportPdf, isPdfExporting, uniqueYears, uniqueBUs }: Props) {
  const set = (patch: Partial<FilterState>) => onChange({ ...filters, ...patch })
  const hasActive =
    filters.year !== "all" ||
    filters.quarters.length > 0 ||
    filters.units.length > 0 ||
    filters.modes.length > 0 ||
    filters.priorities.length > 0 ||
    filters.statuses.length > 0 ||
    !!filters.leadSearch ||
    !!filters.buSearch

  const reset = () =>
    onChange({ year: "all", quarters: [], units: [], modes: [], priorities: [], statuses: [], leadSearch: "", buSearch: "" })

  return (
    <Card className="border shadow-sm bg-white dark:bg-zinc-900 sticky top-0 z-30">
      <CardContent className="p-4 space-y-3">
        {/* Row 1: Year + search inputs + actions */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-zinc-500 shrink-0">
            <Filter className="h-4 w-4" />
            <span className="text-sm font-bold">Filters</span>
            {hasActive && (
              <Badge className="bg-[#0046ab] text-white text-[10px] h-4 px-1.5">Active</Badge>
            )}
          </div>

          <Select value={filters.year} onValueChange={v => set({ year: v })}>
            <SelectTrigger className="w-[110px] h-8 text-xs"><SelectValue placeholder="Year" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Years</SelectItem>
              {uniqueYears.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>

          <div className="relative w-[170px]">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-zinc-400" />
            <Input
              placeholder="Program Lead..."
              className="pl-8 h-8 text-xs"
              value={filters.leadSearch}
              onChange={e => set({ leadSearch: e.target.value })}
            />
          </div>

          <div className="relative w-[170px]">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-zinc-400" />
            <Input
              placeholder="Business Unit..."
              className="pl-8 h-8 text-xs"
              value={filters.buSearch}
              onChange={e => set({ buSearch: e.target.value })}
            />
          </div>

          <div className="ml-auto flex gap-2">
            {hasActive && (
              <Button variant="ghost" size="sm" className="h-8 text-xs gap-1.5 text-zinc-500" onClick={reset}>
                <X className="h-3.5 w-3.5" />Reset
              </Button>
            )}
            <Button size="sm" className="h-8 text-xs bg-[#0046ab] hover:bg-[#003a8f] text-white gap-1.5" onClick={onExport}>
              <Download className="h-3.5 w-3.5" />Export Excel
            </Button>
            {onExportPdf && (
              <Button
                size="sm"
                disabled={isPdfExporting}
                className="h-8 text-xs bg-rose-600 hover:bg-rose-700 text-white gap-1.5 disabled:opacity-70"
                onClick={onExportPdf}
              >
                {isPdfExporting
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <FileDown className="h-3.5 w-3.5" />
                }
                {isPdfExporting ? "Generating…" : "Export PDF"}
              </Button>
            )}
          </div>
        </div>

        {/* Row 2: Chip filters */}
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide">Quarter</span>
            <ChipGroup options={ALL_QUARTERS} selected={filters.quarters} onChange={v => set({ quarters: v })} />
          </div>
          <div className="w-px h-6 bg-zinc-200 self-center hidden sm:block" />
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide">Unit</span>
            <ChipGroup options={ALL_UNITS} selected={filters.units} onChange={v => set({ units: v })} />
          </div>
          <div className="w-px h-6 bg-zinc-200 self-center hidden sm:block" />
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide">Mode</span>
            <ChipGroup options={ALL_MODES} selected={filters.modes} onChange={v => set({ modes: v })} />
          </div>
          <div className="w-px h-6 bg-zinc-200 self-center hidden sm:block" />
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide">Priority</span>
            <ChipGroup
              options={ALL_PRIORITIES}
              selected={filters.priorities}
              colorMap={{ HIGH: "bg-red-500", MEDIUM: "bg-amber-500", LOW: "bg-emerald-600" }}
              onChange={v => set({ priorities: v })}
            />
          </div>
          <div className="w-px h-6 bg-zinc-200 self-center hidden sm:block" />
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide">Status</span>
            <ChipGroup options={ALL_STATUSES} selected={filters.statuses} onChange={v => set({ statuses: v })} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
