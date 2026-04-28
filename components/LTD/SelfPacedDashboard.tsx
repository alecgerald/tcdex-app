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

const SelfPacedDashboard: React.FC = () => {
  // Force re-scan
  const [loading, setLoading] = useState(true);
  const [rawRecords, setRawRecords] = useState<LMSCompletion[]>([]);
  const [selectedYear, setSelectedYear] = useState<string>("all");
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  
  // Main Metrics & Data Processing
  const processed = useMemo(() => {
    const requiredCodes = REQUIRED_COURSE_CODES.map(c => c.toUpperCase());
    const requiredSet = new Set(requiredCodes);

    // 1. Filter by Year FIRST (before deduplication)
    const yearFiltered = rawRecords.filter(item => {
      if (selectedYear === "all") return true;
      if (!item.completed_at) return false;
      try {
        const date = new Date(item.completed_at);
        return !isNaN(date.getTime()) && date.getFullYear().toString() === selectedYear;
      } catch (e) {
        return false;
      }
    });

    // 2. Deduplicate within the selected timeframe
    const uniqueMap = new Map();
    // We iterate forward; later entries (newer uploads) will overwrite older ones
    for (const r of yearFiltered) {
      const code = extractCourseCode(r.course_name);
      const key = `${r.email.toLowerCase()}-${code}`;
      uniqueMap.set(key, r);
    }
    const filtered = Array.from(uniqueMap.values());

    const completedRecords = filtered.filter(c => 
      c.status?.toLowerCase().includes('completed') || c.status?.toLowerCase() === 'complete'
    );

    const distinctEmailsInYear = new Set(filtered.map(c => c.email.toLowerCase()));
    const totalLearners = distinctEmailsInYear.size;

    const emailsWithCompletions = new Set(completedRecords.map(c => c.email.toLowerCase()));
    const totalParticipantsWithCompletions = emailsWithCompletions.size;

    // 1. Program Metrics
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

    // 2. Histogram Data
    const completionCountsMap: Record<string, number> = {};
    completedRecords.forEach(c => {
      const email = c.email.toLowerCase();
      completionCountsMap[email] = (completionCountsMap[email] || 0) + 1;
    });

    const bins = { "0-5": 0, "6-10": 0, "11-15": 0, "16-20": 0, "21-25": 0, "26+": 0 };
    Object.values(completionCountsMap).forEach(count => {
      if (count <= 5) bins["0-5"]++;
      else if (count <= 10) bins["6-10"]++;
      else if (count <= 15) bins["11-15"]++;
      else if (count <= 20) bins["16-20"]++;
      else if (count <= 25) bins["21-25"]++;
      else bins["26+"]++;
    });

    // 3. Course-wise Stats Table
    const courseStatsMap: Record<string, { count: number, name: string }> = {};
    requiredCodes.forEach(code => {
      const recordWithTitle = rawRecords.find(r => extractCourseCode(r.course_name) === code);
      courseStatsMap[code] = { 
        count: 0, 
        name: recordWithTitle?.course_name.split(' (')[0] || `Module ${code}` 
      };
    });

    completedRecords.forEach(c => {
      const code = extractCourseCode(c.course_name);
      if (courseStatsMap[code]) {
        courseStatsMap[code].count++;
      }
    });

    const allCoursesStats = Object.entries(courseStatsMap).map(([code, data]) => ({
      code,
      name: data.name,
      completions: data.count,
      rate: totalLearners > 0 ? (data.count / totalLearners) * 100 : 0
    })).sort((a, b) => b.completions - a.completions);

    return {
      metrics: {
        totalLearners,
        totalCompletions: completedRecords.length,
        avgPerUser: avgPerUser.toFixed(1),
        overallCompletionRate: overallCompletionRate.toFixed(1),
        programCompRate: programCompRate.toFixed(1),
        dropOffRate: dropOffRate.toFixed(1),
        participationRate: totalLearners > 0 ? (totalParticipantsWithCompletions / totalLearners * 100).toFixed(1) : "0"
      },
      histogramData: Object.entries(bins).map(([range, count]) => ({ range, count })),
      allCoursesStats,
      currentViewRecords: filtered // Export for Individual Progress Tracker
    };
  }, [rawRecords, selectedYear]);

  const handleExportPDF = useCallback(async () => {
    setIsExporting(true);
    const toastId = toast.loading("Generating vector PDF report...");

    const payload = {
      title: "Self-Paced LMS Dashboard",
      description: "Leadership Development Track Performance and Completion Depth.",
      date: new Date().toLocaleDateString(),
      kpis: [
        { title: "Total Learners", value: processed.metrics.totalLearners, description: "Distinct participants." },
        { title: "Avg per User", value: processed.metrics.avgPerUser, description: "Courses per active finisher." },
        { title: "Total Rate", value: `${processed.metrics.overallCompletionRate}%`, description: "Overall progress vs target." },
        { title: "Participation", value: `${processed.metrics.participationRate}%`, description: "Users with ≥1 completion." },
        { title: "Program Comp.", value: `${processed.metrics.programCompRate}%`, description: "Finished all 27 courses." }
      ],
      charts: [
        {
          title: "Engagement Depth (Completions)",
          data: processed.histogramData.map(d => ({
            label: d.range,
            value: d.count,
            max: Math.max(...processed.histogramData.map(x => x.count), 1),
            color: d.count > 10 ? "#10b981" : d.count > 5 ? "#f59e0b" : "#ef4444"
          }))
        }
      ],
      tables: [
        {
          title: "Required Course Metrics",
          headers: ["Module Code", "Course Name", "Completions", "Rate"],
          rows: processed.allCoursesStats.slice(0, 15).map(c => [
            c.code,
            c.name,
            c.completions,
            `${c.rate.toFixed(1)}%`
          ])
        }
      ]
    };

    try {
      const res = await fetch('/api/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error('Failed to generate PDF');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Self_Paced_Dashboard_${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success("PDF report downloaded!", { id: toastId });
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate vector PDF.", { id: toastId });
    } finally {
      setIsExporting(false);
    }
  }, [processed]);

  const [courseTableSearch, setCourseTableSearch] = useState("");
  
  // Participant Selection State
  const [selectedEmail, setSelectedEmail] = useState<string | null>(null);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  
  const supabase = createClient();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: lmsData, error } = await supabase
        .from('lms_completions')
        .select('id, email, name, course_name, status, completed_at')
        .order('completed_at', { ascending: false });

      if (error) throw error;
      setRawRecords(lmsData || []);
    } catch (error) {
      console.error('Error fetching LMS data:', error);
      toast.error("Failed to sync rawRecords.");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData, refreshTrigger]);

  // Derived Participants List
  const participants = useMemo(() => {
    const map = new Map<string, string | null>();
    rawRecords.forEach(r => {
      const email = r.email.toLowerCase();
      if (!map.has(email)) map.set(email, r.name);
    });
    return Array.from(map.entries())
      .map(([email, name]) => ({ email, name }))
      .sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email));
  }, [rawRecords]);

  // Available Years for filter
  const availableYears = useMemo(() => {
    const years = new Set<string>();
    rawRecords.forEach(r => {
      if (r.completed_at) {
        const year = new Date(r.completed_at).getFullYear().toString();
        years.add(year);
      }
    });
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [rawRecords]);

  const selectedParticipant = useMemo(() => 
    participants.find(p => p.email === selectedEmail),
  [participants, selectedEmail]);

  const handleStatusChange = async (courseCode: string, newStatus: string) => {
    if (!selectedEmail) return;
    
    const existing = rawRecords.find(r => 
      r.email.toLowerCase() === selectedEmail.toLowerCase() && 
      extractCourseCode(r.course_name) === courseCode.toUpperCase()
    );

    const completedAt = newStatus === "Completed" ? new Date().toISOString() : null;

    // Optimistic Update
    if (existing) {
      setRawRecords(prev => prev.map(r => 
        (r.email.toLowerCase() === selectedEmail.toLowerCase() && extractCourseCode(r.course_name) === courseCode.toUpperCase())
          ? { ...r, status: newStatus, completed_at: completedAt } 
          : r
      ));
    } else {
      const pName = selectedParticipant?.name || selectedEmail.split('@')[0];
      const knownTitle = rawRecords.find(r => extractCourseCode(r.course_name) === courseCode.toUpperCase())?.course_name || `${courseCode} Module (${courseCode})`;
      const tempId = `temp-${Date.now()}`;
      setRawRecords(prev => [{
        id: tempId,
        email: selectedEmail.toLowerCase(),
        name: pName,
        course_name: knownTitle,
        status: newStatus,
        completed_at: completedAt
      }, ...prev]);
    }

    try {
      if (existing) {
        // Update ALL potential duplicates in the database by email and course code pattern
        const { error } = await supabase
          .from('lms_completions')
          .update({ status: newStatus, completed_at: completedAt })
          .eq('email', selectedEmail.toLowerCase())
          .ilike('course_name', `%${courseCode.toUpperCase()}%`);
          
        if (error) throw error;
      } else {
        const pName = selectedParticipant?.name || selectedEmail.split('@')[0];
        const knownTitle = rawRecords.find(r => extractCourseCode(r.course_name) === courseCode.toUpperCase())?.course_name || `${courseCode} Module (${courseCode})`;
        const { error } = await supabase.from('lms_completions').insert([{
          email: selectedEmail.toLowerCase(),
          name: pName,
          course_name: knownTitle,
          status: newStatus,
          completed_at: completedAt
        }]);
        
        if (error) throw error;
      }
      toast.success(`${courseCode} updated.`);
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to sync change.");
      fetchData();
    }
  };

  // Selected Participant Progress Table
  const participantTrackData = useMemo(() => {
    if (!selectedEmail) return [];
    return REQUIRED_COURSE_CODES.map(code => {
      const record = rawRecords.find(r => 
        r.email.toLowerCase() === selectedEmail.toLowerCase() && 
        extractCourseCode(r.course_name) === code.toUpperCase()
      );
      return {
        code,
        title: record?.course_name.split(' (')[0] || `Required Module ${code}`,
        status: record?.status || "Not started",
        completed_at: record?.completed_at
      };
    });
  }, [selectedEmail, rawRecords]);

  const filteredCourseStats = useMemo(() => {
    return processed.allCoursesStats.filter(c => 
      c.name.toLowerCase().includes(courseTableSearch.toLowerCase()) || 
      c.code.toLowerCase().includes(courseTableSearch.toLowerCase())
    );
  }, [processed.allCoursesStats, courseTableSearch]);

  const handleExport = () => {
    try {
      const toastId = toast.loading("Preparing full participant-course matrix...");
      
      // 1. Identify all unique participants and courses from the entire dataset
      const emails = new Set<string>();
      const courses = new Set<string>();
      const participantInfo = new Map<string, { firstName: string, lastName: string }>();
      
      // Map for quick status lookup: email -> course_name -> record
      const lookup = new Map<string, Map<string, LMSCompletion>>();

      rawRecords.forEach(r => {
        const email = r.email.toLowerCase();
        emails.add(email);
        courses.add(r.course_name);
        
        if (!lookup.has(email)) lookup.set(email, new Map());
        const emailMap = lookup.get(email)!;
        
        // Determine if this is a "completion" record according to the new mapping rules
        const rawStatus = r.status || "";
        const lowerStatus = rawStatus.toLowerCase();
        const isCompleted = lowerStatus.includes('completed');
        
        // Store/Update record: Prefer completed rawRecords or the latest status
        const existing = emailMap.get(r.course_name);
        if (!existing || (!existing.status?.toLowerCase().includes('completed') && isCompleted)) {
          emailMap.set(r.course_name, r);
        }

        // Try to capture name if not already set for this participant
        if (r.name && !participantInfo.has(email)) {
          const nameClean = r.name.trim();
          let firstName = "";
          let lastName = "";
          
          if (nameClean.includes(',')) {
            // Handle "Last, First" format
            const parts = nameClean.split(',').map(p => p.trim());
            lastName = parts[0];
            firstName = parts[1];
          } else {
            // Handle "First Last" format
            const parts = nameClean.split(' ');
            firstName = parts[0];
            lastName = parts.slice(1).join(' ');
          }
          participantInfo.set(email, { firstName, lastName });
        }
      });

      const sortedEmails = Array.from(emails).sort();
      const sortedCourses = Array.from(courses).sort();

      const exportData: any[] = [];

      // 2. Build the matrix: For every participant, every course
      sortedEmails.forEach(email => {
        const info = participantInfo.get(email) || { firstName: "", lastName: "" };
        const emailMap = lookup.get(email);

        sortedCourses.forEach(courseName => {
          const record = emailMap?.get(courseName);
          let status = "Not started";
          let enrolledOn = "";

          if (record) {
            const rawStatus = record.status || "Not started";
            const lowerStatus = rawStatus.toLowerCase();
            
            if (lowerStatus.includes('completed')) {
              status = "Completed";
            } else if (rawStatus === '0%' || lowerStatus.includes('in progress')) {
              status = "In progress";
            } else {
              status = rawStatus;
            }
            
            enrolledOn = record.completed_at ? new Date(record.completed_at).toLocaleDateString() : "";
          }

          exportData.push({
            "First name": info.firstName,
            "Last name": info.lastName,
            "Email": email,
            "Course": courseName,
            "Enrolled on": enrolledOn,
            "Status": status
          });
        });
      });

      // 3. Generate Excel
      const ws = XLSX.utils.json_to_sheet(exportData);
      
      // Auto-width columns
      const wscols = [
        { wch: 15 }, // First name
        { wch: 15 }, // Last name
        { wch: 25 }, // Email
        { wch: 50 }, // Course
        { wch: 15 }, // Enrolled on
        { wch: 15 }  // Status
      ];
      ws['!cols'] = wscols;

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "LMS Matrix");

      const fileName = `LMS_Complete_Matrix_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, fileName);
      
      toast.dismiss(toastId);
      toast.success("Complete matrix exported successfully.");
    } catch (error) {
      console.error("Export failed:", error);
      toast.error("Failed to export complete matrix.");
    }
  };

  if (loading && refreshTrigger === 0) return <div className="flex h-[600px] items-center justify-center w-full"><Loader2 className="h-10 w-10 animate-spin text-[#0046ab]" /></div>;

  return (
    <div className="w-full space-y-8 pb-20 px-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-6 rounded-2xl border shadow-sm">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-50 rounded-xl"><MousePointer2 className="h-6 w-6 text-[#0046ab]" /></div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-[#0046ab]">Self-Paced Dashboard</h1>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest">Leadership Development Track Performance</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button 
            onClick={handleExportPDF}
            variant="outline"
            disabled={isExporting}
            className="h-12 px-4 rounded-xl border-zinc-200 font-black text-xs uppercase tracking-wider hover:bg-zinc-50 transition-all flex items-center gap-2"
          >
            {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4 text-[#0046ab]" />}
            Export PDF
          </Button>
          <Button 
            onClick={handleExport}
            variant="outline" 
            className="h-12 px-4 rounded-xl border-zinc-200 font-black text-xs uppercase tracking-wider hover:bg-zinc-50 transition-all flex items-center gap-2"
          >
            <Download className="h-4 w-4 text-[#0046ab]" />
            Export to Excel
          </Button>
          
          <div className="flex items-center gap-3 bg-zinc-50 p-2 rounded-xl border h-12">
            <CalendarIcon className="h-3.5 w-3.5 text-zinc-400 ml-2" />
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-[120px] h-8 text-xs font-black border-none bg-transparent focus:ring-0"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs font-black uppercase">All Time</SelectItem>
                {availableYears.map(year => (
                  <SelectItem key={year} value={year} className="text-xs font-black uppercase">{year}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div id="pdf-content-selfpaced" className="space-y-8">
        {/* KPI Cards Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 w-full">
          <MetricCard title="Total Learners" value={processed.metrics.totalLearners} icon={Users} color="text-blue-600" />
          <MetricCard title="Avg per User" value={processed.metrics.avgPerUser} icon={Award} color="text-indigo-600" />
          <MetricCard title="Total Rate" value={`${processed.metrics.overallCompletionRate}%`} icon={Trophy} color="text-emerald-600" hasTooltip tooltipText="Calculated as: (Total Completions) / (27 modules * Total Learners)" />
          <MetricCard title="Participation" value={`${processed.metrics.participationRate}%`} icon={Activity} color="text-amber-600" />
          <MetricCard title="Program Comp." value={`${processed.metrics.programCompRate}%`} icon={Layers} color="text-purple-600" hasTooltip tooltipText="Learners who finished all 27 required courses." />
          <MetricCard title="Drop-off Rate" value={`${processed.metrics.dropOffRate}%`} icon={LogOut} color="text-rose-600" hasTooltip tooltipText="Learners who started but haven't finished all 27 courses." />
        </div>

        {/* Distribution & Course Table */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Histogram */}
          <Card className="shadow-sm border-zinc-100 rounded-3xl overflow-hidden">
            <CardHeader className="bg-zinc-50/50 border-b p-6 pb-4">
              <CardTitle className="text-xs font-black uppercase text-[#0046ab] tracking-wider">Engagement Depth</CardTitle>
              <CardDescription className="text-[10px] font-medium uppercase text-zinc-400">Number of participants by courses completed</CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={processed.histogramData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="range" tick={{ fontSize: 10, fontWeight: '900' }} axisLine={false} tickLine={false} dy={10} />
                    <YAxis tick={{ fontSize: 10, fontWeight: '900' }} axisLine={false} tickLine={false} />
                    <RechartsTooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]} barSize={40}>
                      <LabelList dataKey="count" position="top" style={{ fontSize: 10, fontWeight: 'bold', fill: '#64748b' }} offset={10} />
                      {processed.histogramData.map((entry, index) => (
                        <Cell key={index} fill={entry.count > 10 ? '#10b981' : entry.count > 5 ? '#f59e0b' : '#ef4444'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Global Module Table */}
          <Card className="shadow-sm border-zinc-100 rounded-3xl overflow-hidden flex flex-col">
            <CardHeader className="bg-zinc-50/50 border-b p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-xs font-black uppercase text-zinc-600 tracking-wider">Required Course Metrics</CardTitle>
                  <CardDescription className="text-[10px] font-medium uppercase text-zinc-400">Performance across all 27 required modules</CardDescription>
                </div>
                <div className="relative w-full sm:w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
                  <Input 
                    placeholder="Filter courses..." 
                    className="pl-9 h-8 text-xs border-zinc-200"
                    value={courseTableSearch}
                    onChange={(e) => setCourseTableSearch(e.target.value)}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0 flex-1">
              <ScrollArea className="h-[300px]">
                <Table>
                  <TableHeader className="bg-white sticky top-0 z-10">
                    <TableRow>
                      <TableHead className="pl-6 text-[10px] font-black uppercase">Module</TableHead>
                      <TableHead className="text-right text-[10px] font-black uppercase">Completed</TableHead>
                      <TableHead className="text-right pr-6 text-[10px] font-black uppercase">Rate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCourseStats.map((c) => (
                      <TableRow key={c.code} className="hover:bg-zinc-50/50 transition-colors">
                        <TableCell className="pl-6 py-3">
                          <p className="text-xs font-bold text-zinc-800">{c.name}</p>
                          <p className="text-[9px] font-black text-[#0046ab] uppercase">{c.code}</p>
                        </TableCell>
                        <TableCell className="text-right font-black text-zinc-700 text-xs">{c.completions}</TableCell>
                        <TableCell className="text-right pr-6">
                          <Badge variant="secondary" className="text-[10px] font-black py-0 px-1.5 h-5">{c.rate.toFixed(1)}%</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Participant Progress Tracker */}
        <Card className="shadow-sm border-zinc-100 rounded-3xl overflow-hidden">
          <CardHeader className="bg-zinc-50/50 border-b p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[#0046ab] rounded-lg"><User className="h-4 w-4 text-white" /></div>
                <div>
                  <CardTitle className="text-xs font-black uppercase tracking-wider">Individual Progress Tracker</CardTitle>
                  <CardDescription className="text-[10px] font-medium text-zinc-400 uppercase">View and update learner status per required module</CardDescription>
                </div>
              </div>
              
              <Popover open={isPickerOpen} onOpenChange={setIsPickerOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full sm:w-[320px] justify-between h-10 text-xs font-bold">
                    {selectedEmail ? (selectedParticipant?.name || selectedEmail) : "Find participant..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[320px] p-0">
                  <Command>
                    <CommandInput placeholder="Search name or email..." className="h-9" />
                    <CommandList>
                      <CommandEmpty>No one found.</CommandEmpty>
                      <CommandGroup>
                        {participants.map((p) => (
                          <CommandItem
                            key={p.email}
                            value={p.email}
                            onSelect={(val) => { setSelectedEmail(val); setIsPickerOpen(false); }}
                            className="text-xs py-2"
                          >
                            <Check className={cn("mr-2 h-4 w-4 text-[#0046ab]", selectedEmail === p.email ? "opacity-100" : "opacity-0")} />
                            <div className="flex flex-col">
                              <span className="font-black text-zinc-800">{p.name || 'Anonymous'}</span>
                              <span className="text-[10px] text-zinc-400">{p.email}</span>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {!selectedEmail ? (
              <div className="py-20 text-center flex flex-col items-center gap-3">
                <Search className="h-10 w-10 text-zinc-100" />
                <p className="text-sm font-black text-zinc-300 uppercase tracking-widest">Select a participant to manage track progress</p>
              </div>
            ) : (
              <ScrollArea className="h-[500px]">
                <Table>
                  <TableHeader className="bg-white sticky top-0 z-10">
                    <TableRow>
                      <TableHead className="pl-6 text-[10px] font-black uppercase">Required Module</TableHead>
                      <TableHead className="text-[10px] font-black uppercase w-[220px]">Current Status</TableHead>
                      <TableHead className="text-right pr-6 text-[10px] font-black uppercase">Completed Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {participantTrackData.map((course) => (
                      <TableRow key={course.code} className="hover:bg-zinc-50/50 transition-colors">
                        <TableCell className="pl-6 py-4">
                          <p className="text-xs font-bold text-zinc-800">{course.title}</p>
                          <p className="text-[10px] font-black text-[#0046ab] uppercase tracking-tighter">{course.code}</p>
                        </TableCell>
                        <TableCell>
                          <Select value={course.status} onValueChange={(val) => handleStatusChange(course.code, val)}>
                            <SelectTrigger className={cn("h-9 text-xs font-black", 
                              course.status === "Completed" ? "text-emerald-600 border-emerald-100 bg-emerald-50/30" : 
                              course.status === "0%" || course.status === "In progress" ? "text-amber-600 border-amber-100 bg-amber-50/30" : 
                              "text-rose-500 border-rose-100 bg-rose-50/30"
                            )}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Completed" className="text-emerald-600 font-bold">Completed</SelectItem>
                              <SelectItem value="0%" className="text-amber-600 font-bold">In progress</SelectItem>
                              <SelectItem value="Not started" className="text-rose-500 font-bold">Not started</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-right pr-6">
                          <p className="text-[10px] font-black text-zinc-400 uppercase">
                            {course.completed_at ? new Date(course.completed_at).toLocaleDateString() : '—'}
                          </p>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

const MetricCard = ({ title, value, icon: Icon, color, hasTooltip, tooltipText }: any) => (
  <Card className="shadow-sm border-zinc-100 hover:shadow-md transition-all rounded-2xl overflow-hidden group">
    <CardHeader className="flex flex-row items-center justify-between pb-2 p-4">
      <div className="flex items-center gap-1.5">
        <CardTitle className="text-[10px] font-black uppercase text-zinc-400 tracking-wider">{title}</CardTitle>
        {hasTooltip && (
          <TooltipProvider><Tooltip>
            <TooltipTrigger><Info className="h-3 w-3 text-zinc-300 cursor-help" /></TooltipTrigger>
            <TooltipContent className="max-w-[200px] text-[10px]">{tooltipText}</TooltipContent>
          </Tooltip></TooltipProvider>
        )}
      </div>
      <Icon className={`h-4 w-4 ${color} opacity-70`} />
    </CardHeader>
    <CardContent className="p-4 pt-0">
      <div className="text-2xl font-black tabular-nums tracking-tight text-zinc-900">{value}</div>
    </CardContent>
  </Card>
);

export default SelfPacedDashboard;
