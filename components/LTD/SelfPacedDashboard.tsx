"use client";
import { Badge } from "@/components/ui/badge";
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, Cell, AreaChart, Area, Legend, LabelList, ReferenceLine
} from 'recharts';
import { 
  Loader2, 
  Users, 
  Calendar as CalendarIcon,
  AlertCircle,
  MousePointer2,
  CheckCircle,
  Award,
  TrendingUp,
  Info,
  Activity,
  Search,
  BookOpen,
  Layers,
  LogOut,
  Database,
  RefreshCw,
  Check,
  ChevronsUpDown,
  User,
  Clock,
  LayoutGrid,
  Trophy,
  Download
} from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { cn } from "@/lib/utils";

interface LMSCompletion {
  id: string;
  email: string;
  name: string | null;
  course_name: string;
  status: string;
  completed_at: string | null;
}

const REQUIRED_COURSE_CODES = [
  "LT001", "LE002", "LT009", "AL001", "KO004", "GAMS02", "Helpdesk01", "TRV01", "TWE07", "CE010", "CE006", "LT003", "ITS42", "RL005", "EI008", "EI001", "EI002", "EI003", "EI004", "EI005", "EI006", "EI007", "ED03", "IMPACT01", "KO007", "KO010", "HRE10"
];

const extractCourseCode = (courseName: string): string => {
  const match = courseName.match(/\(([^)]+)\)/);
  return match ? match[1].trim().toUpperCase() : courseName.trim().toUpperCase();
};

const supabase = createClient();

const SelfPacedDashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<LMSCompletion[]>([]);
  const [selectedYear, setSelectedYear] = useState<string>("all");
  const [isExporting, setIsExporting] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<string | null>(null);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [courseTableSearch, setCourseTableSearch] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: lmsData, error } = await supabase
        .from('lms_completions')
        .select('id, email, name, course_name, status, completed_at')
        .order('completed_at', { ascending: false });
      if (error) throw error;
      setRecords(lmsData || []);
    } catch (error) {
      console.error('Error fetching LMS data:', error);
      toast.error("Failed to sync records.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const processed = useMemo(() => {
    const requiredCodes = REQUIRED_COURSE_CODES.map(c => c.toUpperCase());
    const requiredSet = new Set(requiredCodes);
    const filtered = records.filter(item => {
      if (selectedYear === "all") return true;
      if (!item.completed_at) return false;
      return new Date(item.completed_at).getFullYear().toString() === selectedYear;
    });
    const completedRecords = filtered.filter(c => c.status?.toLowerCase().includes('completed') || c.status?.toLowerCase() === 'complete');
    const totalLearners = new Set(filtered.map(c => c.email.toLowerCase())).size;
    const totalParticipantsWithCompletions = new Set(completedRecords.map(c => c.email.toLowerCase())).size;
    const userProgress: Record<string, Set<string>> = {};
    completedRecords.forEach(c => {
      const email = c.email.toLowerCase();
      if (!userProgress[email]) userProgress[email] = new Set();
      const code = extractCourseCode(c.course_name);
      if (requiredSet.has(code)) userProgress[email].add(code);
    });
    let completedProgramCount = 0;
    Object.values(userProgress).forEach(codes => { if (codes.size === 27) completedProgramCount++; });
    const programCompRate = totalParticipantsWithCompletions > 0 ? (completedProgramCount / totalParticipantsWithCompletions) * 100 : 0;
    const dropOffRate = totalParticipantsWithCompletions > 0 ? ((totalParticipantsWithCompletions - completedProgramCount) / totalParticipantsWithCompletions) * 100 : 0;
    const avgPerUser = totalParticipantsWithCompletions > 0 ? completedRecords.length / totalParticipantsWithCompletions : 0;
    const overallCompletionRate = totalLearners > 0 ? (completedRecords.length / (27 * totalLearners)) * 100 : 0;
    const completionCountsMap: Record<string, number> = {};
    completedRecords.forEach(c => { const email = c.email.toLowerCase(); completionCountsMap[email] = (completionCountsMap[email] || 0) + 1; });
    const bins = { "0-5": 0, "6-10": 0, "11-15": 0, "16-20": 0, "21-25": 0, "26+": 0 };
    Object.values(completionCountsMap).forEach(count => {
      if (count <= 5) bins["0-5"]++; else if (count <= 10) bins["6-10"]++; else if (count <= 15) bins["11-15"]++; else if (count <= 20) bins["16-20"]++; else if (count <= 25) bins["21-25"]++; else bins["26+"]++;
    });
    const courseStatsMap: Record<string, { count: number, name: string }> = {};
    requiredCodes.forEach(code => {
      const recordWithTitle = records.find(r => extractCourseCode(r.course_name) === code);
      courseStatsMap[code] = { count: 0, name: recordWithTitle?.course_name.split(' (')[0] || `Module ${code}` };
    });
    completedRecords.forEach(c => { const code = extractCourseCode(c.course_name); if (courseStatsMap[code]) courseStatsMap[code].count++; });
    const allCoursesStats = Object.entries(courseStatsMap).map(([code, data]) => ({ code, name: data.name, completions: data.count, rate: totalLearners > 0 ? (data.count / totalLearners) * 100 : 0 })).sort((a, b) => b.completions - a.completions);
    return { metrics: { totalLearners, totalCompletions: completedRecords.length, avgPerUser: avgPerUser.toFixed(1), overallCompletionRate: overallCompletionRate.toFixed(1), programCompRate: programCompRate.toFixed(1), dropOffRate: dropOffRate.toFixed(1), participationRate: totalLearners > 0 ? (totalParticipantsWithCompletions / totalLearners * 100).toFixed(1) : "0" }, histogramData: Object.entries(bins).map(([range, count]) => ({ range, count })), allCoursesStats };
  }, [records, selectedYear]);

  const participants = useMemo(() => {
    const map = new Map<string, string | null>();
    records.forEach(r => { const email = r.email.toLowerCase(); if (!map.has(email)) map.set(email, r.name); });
    return Array.from(map.entries()).map(([email, name]) => ({ email, name })).sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email));
  }, [records]);

  const participantTrackData = useMemo(() => {
    if (!selectedEmail) return [];
    return REQUIRED_COURSE_CODES.map(code => {
      const record = records.find(r => r.email.toLowerCase() === selectedEmail.toLowerCase() && extractCourseCode(r.course_name) === code.toUpperCase());
      return { code, title: record?.course_name.split(' (')[0] || `Required Module ${code}`, status: record?.status || "Not started", completed_at: record?.completed_at };
    });
  }, [selectedEmail, records]);

  if (loading) return <div className="flex h-[600px] items-center justify-center w-full"><Loader2 className="h-10 w-10 animate-spin text-[#0046ab]" /></div>;

  return (
    <div className="w-full space-y-8 pb-20 px-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-6 rounded-2xl border shadow-sm">
        <div className="flex items-center gap-4"><div className="p-3 bg-blue-50 rounded-xl"><MousePointer2 className="h-6 w-6 text-[#0046ab]" /></div><div><h1 className="text-2xl font-black tracking-tight text-[#0046ab]">Self-Paced Dashboard</h1><p className="text-xs text-muted-foreground font-medium uppercase tracking-widest">Leadership Development Track Performance</p></div></div>
        <div className="flex items-center gap-3"><div className="flex items-center gap-3 bg-zinc-50 p-2 rounded-xl border h-12"><CalendarIcon className="h-3.5 w-3.5 text-zinc-400 ml-2" /><Select value={selectedYear} onValueChange={setSelectedYear}><SelectTrigger className="w-[120px] h-8 text-xs font-black border-none bg-transparent focus:ring-0"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Time</SelectItem><SelectItem value="2024">2024</SelectItem><SelectItem value="2025">2025</SelectItem></SelectContent></Select></div></div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 w-full">
        <MetricCard title="Total Learners" value={processed.metrics.totalLearners} icon={Users} color="text-blue-600" />
        <MetricCard title="Avg per User" value={processed.metrics.avgPerUser} icon={Award} color="text-indigo-600" />
        <MetricCard title="Total Rate" value={`${processed.metrics.overallCompletionRate}%`} icon={Trophy} color="text-emerald-600" />
        <MetricCard title="Participation" value={`${processed.metrics.participationRate}%`} icon={Activity} color="text-amber-600" />
        <MetricCard title="Program Comp." value={`${processed.metrics.programCompRate}%`} icon={Layers} color="text-purple-600" />
        <MetricCard title="Drop-off Rate" value={`${processed.metrics.dropOffRate}%`} icon={LogOut} color="text-rose-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-sm border-zinc-100 rounded-3xl overflow-hidden"><CardHeader className="bg-zinc-50/50 border-b p-6 pb-4"><CardTitle className="text-xs font-black uppercase text-[#0046ab] tracking-wider">Engagement Depth</CardTitle></CardHeader><CardContent className="p-6"><div className="h-[300px] w-full"><ResponsiveContainer width="100%" height="100%"><BarChart data={processed.histogramData}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" /><XAxis dataKey="range" tick={{ fontSize: 10, fontWeight: '900' }} axisLine={false} tickLine={false} /><YAxis tick={{ fontSize: 10, fontWeight: '900' }} axisLine={false} tickLine={false} /><RechartsTooltip /><Bar dataKey="count" radius={[6, 6, 0, 0]} barSize={40}>{processed.histogramData.map((entry, index) => (<Cell key={index} fill={entry.count > 10 ? '#10b981' : entry.count > 5 ? '#f59e0b' : '#ef4444'} />))}</Bar></BarChart></ResponsiveContainer></div></CardContent></Card>
        <Card className="shadow-sm border-zinc-100 rounded-3xl overflow-hidden flex flex-col"><CardHeader className="bg-zinc-50/50 border-b p-6 flex flex-row items-center justify-between"><CardTitle className="text-xs font-black uppercase text-zinc-600 tracking-wider">Required Course Metrics</CardTitle><Input placeholder="Filter..." className="w-[150px] h-8 text-xs" value={courseTableSearch} onChange={(e) => setCourseTableSearch(e.target.value)} /></CardHeader><CardContent className="p-0 flex-1"><ScrollArea className="h-[300px]"><Table><TableHeader className="bg-white sticky top-0 z-10"><TableRow><TableHead className="pl-6 text-[10px] font-black uppercase">Module</TableHead><TableHead className="text-right text-[10px] font-black uppercase">Completed</TableHead><TableHead className="text-right pr-6 text-[10px] font-black uppercase">Rate</TableHead></TableRow></TableHeader><TableBody>{processed.allCoursesStats.filter(c => c.name.toLowerCase().includes(courseTableSearch.toLowerCase()) || c.code.toLowerCase().includes(courseTableSearch.toLowerCase())).map((c) => (<TableRow key={c.code}><TableCell className="pl-6 py-3"><p className="text-xs font-bold text-zinc-800">{c.name}</p><p className="text-[9px] font-black text-[#0046ab] uppercase">{c.code}</p></TableCell><TableCell className="text-right font-black text-zinc-700 text-xs">{c.completions}</TableCell><TableCell className="text-right pr-6"><Badge variant="secondary" className="text-[10px] font-black">{c.rate.toFixed(1)}%</Badge></TableCell></TableRow>))}</TableBody></Table></ScrollArea></CardContent></Card>
      </div>
    </div>
  );
};

const MetricCard = ({ title, value, icon: Icon, color }: any) => (<Card className="shadow-sm border-zinc-100 hover:shadow-md transition-all rounded-2xl overflow-hidden group"><CardHeader className="flex flex-row items-center justify-between pb-2 p-4"><CardTitle className="text-[10px] font-black uppercase text-zinc-400 tracking-wider">{title}</CardTitle><Icon className={`h-4 w-4 ${color} opacity-70`} /></CardHeader><CardContent className="p-4 pt-0"><div className="text-2xl font-black tabular-nums tracking-tight text-zinc-900">{value}</div></CardContent></Card>);

export default SelfPacedDashboard;
