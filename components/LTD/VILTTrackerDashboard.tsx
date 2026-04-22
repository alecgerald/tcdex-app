"use client";

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Loader2, 
  Users, 
  CheckCircle2, 
  TrendingUp,
  Search,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  Trash2,
  Download
} from 'lucide-react';
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { cn } from "@/lib/utils";
import * as XLSX from 'xlsx';

interface VILTRecord {
  id: string;
  email: string;
  name: string;
  department: string;
  year: string;
  cohort: string;
  modules: Record<string, boolean>;
  overall_status: string;
  updated_at: string;
}

interface Session {
  year: string;
  cohort: string;
}

const MODULE_KEYS = ["M1", "M2A", "M2B", "M3E", "M3F-B1", "M4"];
const ITEMS_PER_PAGE = 15;

const supabase = createClient();

const VILTTrackerDashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [records, setRecords] = useState<VILTRecord[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const fetchSessions = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('vilt_tracker').select('year, cohort');
      if (error) throw error;
      const uniqueSessions: Session[] = [];
      const seen = new Set();
      (data || []).forEach(item => {
        const key = `${item.year}-${item.cohort}`;
        if (item.year && item.cohort && !seen.has(key)) {
          seen.add(key);
          uniqueSessions.push({ year: item.year, cohort: item.cohort });
        }
      });
      uniqueSessions.sort((a, b) => a.year !== b.year ? b.year.localeCompare(a.year) : a.cohort.localeCompare(b.cohort));
      setSessions(uniqueSessions);
      if (uniqueSessions.length > 0 && !selectedSession) setSelectedSession(uniqueSessions[0]);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load sessions.");
    }
  }, [selectedSession]);

  const fetchRecords = useCallback(async () => {
    if (!selectedSession) { setLoading(false); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.from('vilt_tracker').select('*').eq('year', selectedSession.year).eq('cohort', selectedSession.cohort).order('name');
      if (error) throw error;
      setRecords(data || []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load records.");
    } finally {
      setLoading(false);
    }
  }, [selectedSession]);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);
  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  const summary = useMemo(() => {
    const total = records.length;
    const completed = records.filter(r => r.overall_status === 'Completed').length;
    return { total, completed, rate: total > 0 ? ((completed / total) * 100).toFixed(1) : "0.0" };
  }, [records]);

  const paginatedRecords = useMemo(() => {
    const filtered = records.filter(r => r.name.toLowerCase().includes(searchQuery.toLowerCase()) || r.department.toLowerCase().includes(searchQuery.toLowerCase()));
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return { data: filtered.slice(start, start + ITEMS_PER_PAGE), total: filtered.length };
  }, [records, searchQuery, currentPage]);

  if (loading && records.length === 0 && sessions.length > 0) return <div className="flex h-[400px] items-center justify-center w-full"><Loader2 className="h-10 w-10 animate-spin text-[#0046ab]" /></div>;

  return (
    <div className="w-full space-y-10 pb-12">
      <div className="space-y-6">
        <div className="flex items-center justify-between"><div className="flex items-center gap-3"><LayoutGrid className="h-5 w-5 text-[#0046ab]" /><h2 className="text-sm font-black uppercase tracking-widest text-zinc-500">Select Session</h2></div></div>
        <div className="flex flex-nowrap overflow-x-auto gap-4 pb-4 -mx-1 px-1">
          {sessions.map((session) => (
            <button key={`${session.year}-${session.cohort}`} onClick={() => { setSelectedSession(session); setCurrentPage(1); }} className={cn("flex-shrink-0 min-w-[160px] p-6 rounded-2xl border transition-all text-left", selectedSession?.year === session.year && selectedSession?.cohort === session.cohort ? "bg-[#0046ab] border-[#0046ab] text-white shadow-lg" : "bg-white border-zinc-100 hover:border-[#0046ab]/30 text-zinc-800")}>
              <div className="text-[11px] font-black uppercase tracking-wider mb-2 opacity-70">{session.year}</div>
              <div className="text-base font-black uppercase">{session.cohort}</div>
            </button>
          ))}
        </div>
      </div>

      {sessions.length === 0 ? (<Card className="p-16 text-center shadow-sm border-zinc-100 rounded-3xl"><div className="flex flex-col items-center gap-6"><div className="bg-zinc-50 p-8 rounded-full"><Users className="h-12 w-12 text-zinc-300" /></div><h3 className="text-base font-black uppercase tracking-widest">No Sessions Found</h3></div></Card>) : (
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card><CardHeader className="pb-3 p-6"><CardTitle className="text-[11px] font-black uppercase text-zinc-500">Attendance Rate</CardTitle></CardHeader><CardContent className="p-6 pt-0"><div className="text-4xl font-black">{summary.rate}%</div></CardContent></Card>
            <Card><CardHeader className="pb-3 p-6"><CardTitle className="text-[11px] font-black uppercase text-zinc-500">Completed</CardTitle></CardHeader><CardContent className="p-6 pt-0"><div className="text-4xl font-black">{summary.completed}</div></CardContent></Card>
            <Card><CardHeader className="pb-3 p-6"><CardTitle className="text-[11px] font-black uppercase text-zinc-500">Total Enrolled</CardTitle></CardHeader><CardContent className="p-6 pt-0"><div className="text-4xl font-black">{summary.total}</div></CardContent></Card>
          </div>
          <Card className="shadow-sm border-zinc-100 rounded-3xl overflow-hidden"><CardHeader className="p-8 border-b bg-zinc-50/50 flex flex-row items-center justify-between"><h3 className="text-xl font-black uppercase tracking-tight">{selectedSession?.cohort} <span className="text-[#0046ab]">{selectedSession?.year}</span></h3><div className="relative w-[320px]"><Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400" /><Input placeholder="Search participant..." className="pl-12 h-12" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} /></div></CardHeader><CardContent className="p-0"><Table><TableHeader className="bg-zinc-50/50"><TableRow><TableHead className="pl-8 text-sm font-black uppercase">Participant</TableHead><TableHead className="text-sm font-black uppercase">Department</TableHead><TableHead className="text-right pr-8 text-sm font-black uppercase">Status</TableHead></TableRow></TableHeader><TableBody>{paginatedRecords.data.map((r) => (<TableRow key={r.id} className="border-zinc-100"><TableCell className="pl-8 py-6"><div className="flex flex-col"><span className="text-base font-medium">{r.name}</span><span className="text-xs text-[#0046ab] font-black uppercase">{r.email}</span></div></TableCell><TableCell><Badge variant="secondary" className="font-black uppercase">{r.department}</Badge></TableCell><TableCell className="text-right pr-8"><Badge className={cn("font-black uppercase", r.overall_status === 'Completed' ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-rose-50 text-rose-500 border-rose-100")}>{r.overall_status}</Badge></TableCell></TableRow>))}</TableBody></Table></CardContent></Card>
        </div>
      )}
    </div>
  );
};

export default VILTTrackerDashboard;
