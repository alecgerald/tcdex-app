"use client";

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  ResponsiveContainer, 
  Legend, 
  LabelList,
  Cell
} from 'recharts';
import { 
  Loader2, 
  Presentation, 
  Trash2, 
  LayoutDashboard, 
  Search,
  Users,
  CheckCircle2,
  CalendarDays,
  TrendingUp,
  History,
  Check,
  Filter,
  X,
  Zap,
  Download
} from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { toast } from 'sonner';

interface LeadXSession {
  id: string;
  topic: string;
  scheduled_time: string;
  registrants_count: number;
  attendees_count: number;
  session_type: string;
}

// Create client outside component for maximum stability
const supabase = createClient();

const LeadXReportsDashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<LeadXSession[]>([]);
  const [allRegistrants, setAllRegistrants] = useState<any[]>([]);
  const [masterDepartments, setMasterDepartments] = useState<string[]>([]);
  const [sessionToDelete, setSessionToDelete] = useState<LeadXSession | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  
  // Selection & Filter State
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sessionSearch, setSessionSearch] = useState('');
  const [selectedYear, setSelectedYear] = useState('All');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch departments (wrap in nested try to prevent blocking)
      try {
        const { data: depts } = await supabase.from('departments').select('name').limit(100);
        setMasterDepartments(depts?.map(d => d.name) || []);
      } catch (e) {
        console.error('Dept fetch failed', e);
      }

      // 2. Fetch sessions
      const { data: sData, error: sessionError } = await supabase
        .from('leadx_sessions')
        .select('*')
        .order('scheduled_time', { ascending: false });

      if (sessionError) throw sessionError;

      if (!sData || sData.length === 0) {
        setSessions([]);
        setAllRegistrants([]);
        setLoading(false);
        return;
      }

      // 3. Fetch all registrants
      const { data: allReg, error: regError } = await supabase
        .from('leadx_registrants')
        .select('session_id, department, attended, approval_status');
      
      if (regError) console.error('Reg fetch error:', regError);
      
      const registrants = allReg || [];
      setAllRegistrants(registrants);

      // 4. Process session counts
      const processedSessions = sData.map((s) => {
        const sessionRegs = registrants.filter(r => 
          r.session_id === s.id && r.approval_status !== 'Attended without registration'
        );
        const attendees = sessionRegs.filter(r => r.attended);
        
        return { 
          ...s, 
          registrants_count: sessionRegs.length, 
          attendees_count: attendees.length 
        };
      });
      setSessions(processedSessions);

    } catch (err) {
      console.error('Dashboard error:', err);
      toast.error("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const availableYears = useMemo(() => {
    const years = new Set(sessions.map(s => new Date(s.scheduled_time).getFullYear().toString()));
    return ['All', ...Array.from(years).sort().reverse()];
  }, [sessions]);

  const filteredSessions = useMemo(() => {
    let result = sessions;
    if (selectedYear !== 'All') {
      result = result.filter(s => new Date(s.scheduled_time).getFullYear().toString() === selectedYear);
    }
    if (sessionSearch) {
      result = result.filter(s => s.topic.toLowerCase().includes(sessionSearch.toLowerCase()));
    }
    return result;
  }, [sessions, selectedYear, sessionSearch]);

  const selectedSession = useMemo(() => 
    sessions.find(s => s.id === selectedSessionId) || null
  , [sessions, selectedSessionId]);

  const kpiData = useMemo(() => {
    if (!selectedSessionId) return null;
    const session = sessions.find(s => s.id === selectedSessionId);
    if (!session) return null;

    return {
      registered: session.registrants_count,
      attended: session.attendees_count,
      rate: session.registrants_count > 0 ? (session.attendees_count / session.registrants_count) * 100 : 0
    };
  }, [selectedSessionId, sessions]);

  const deptAttendanceData = useMemo(() => {
    if (!selectedSessionId || allRegistrants.length === 0) return [];
    const deptMap: Record<string, { registrants: number, attendees: number }> = {};
    masterDepartments.forEach(dept => { deptMap[dept] = { registrants: 0, attendees: 0 }; });
    const sessionRegistrants = allRegistrants.filter(r => r.session_id === selectedSessionId);
    sessionRegistrants.forEach(r => {
      const dept = r.department || 'Other';
      if (!deptMap[dept]) deptMap[dept] = { registrants: 0, attendees: 0 };
      deptMap[dept].registrants++;
      if (r.attended) deptMap[dept].attendees++;
    });
    return Object.entries(deptMap)
      .map(([department, stats]) => ({
        department,
        registrants: stats.registrants,
        attendees: stats.attendees,
        attendance_rate: stats.registrants > 0 ? (stats.attendees / stats.registrants) * 100 : 0
      }))
      .filter(d => d.registrants > 0)
      .sort((a, b) => b.registrants - a.registrants);
  }, [selectedSessionId, allRegistrants, masterDepartments]);

  const leadxChartData = useMemo(() => {
    if (selectedSession && (selectedSession.session_type === 'leadx' || selectedSession.topic.toLowerCase().includes('leadx'))) {
      return [{ name: 'Selected Session', reg: selectedSession.registrants_count, att: selectedSession.attendees_count }];
    }
    return [];
  }, [selectedSession]);

  const buildxChartData = useMemo(() => {
    if (selectedSession && (selectedSession.session_type === 'buildx' || selectedSession.topic.toLowerCase().includes('buildx'))) {
      return [{ name: 'Selected Session', reg: selectedSession.registrants_count, att: selectedSession.attendees_count }];
    }
    return [];
  }, [selectedSession]);

  const handleExportPDF = useCallback(async () => {
    setIsExporting(true);
    const toastId = toast.loading("Generating vector PDF report...");
    const currentSession = sessions.find(s => s.id === selectedSessionId);
    const sessionName = currentSession ? currentSession.topic : 'Dashboard';
    const payload = {
      title: `LeadX & BuildX Performance - ${sessionName}`,
      description: "Session-level engagement and department-wise attendance metrics.",
      date: new Date().toLocaleDateString(),
      kpis: kpiData ? [
        { title: "Registered", value: kpiData.registered, description: "Participants enrolled." },
        { title: "Attended", value: kpiData.attended, description: "Verified attendance." },
        { title: "Attendance Rate", value: `${kpiData.rate.toFixed(1)}%`, description: "Engagement efficiency." }
      ] : [],
      charts: [{
          title: "Engagement Overview",
          data: [
            { label: "Registered", value: kpiData?.registered || 0, max: kpiData?.registered || 1, color: "#0046ab" },
            { label: "Attended", value: kpiData?.attended || 0, max: kpiData?.registered || 1, color: "#10b981" }
          ]
      }],
      tables: [{
          title: "Department Breakdown",
          headers: ["Department", "Registered", "Attended", "Rate"],
          rows: deptAttendanceData.slice(0, 15).map(d => [d.department, d.registrants, d.attendees, `${d.attendance_rate.toFixed(1)}%`])
      }]
    };
    try {
      const res = await fetch('/api/pdf', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error('Failed to generate PDF');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `LeadX_Performance_${sessionName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
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
  }, [selectedSessionId, sessions, kpiData, deptAttendanceData]);

  const deleteSession = async () => {
    if (!sessionToDelete) return;
    setIsDeleting(true);
    try {
      await supabase.from('leadx_registrants').delete().eq('session_id', sessionToDelete.id);
      const { error } = await supabase.from('leadx_sessions').delete().eq('id', sessionToDelete.id);
      if (error) throw error;
      toast.success("Session deleted successfully.");
      const deletedId = sessionToDelete.id;
      setSessionToDelete(null);
      if (selectedSessionId === deletedId) setSelectedSessionId(null);
      fetchData();
    } catch (err: any) {
      console.error(err);
      toast.error("Error deleting session: " + err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredDeptTable = useMemo(() => {
    return deptAttendanceData.filter(d => d.department.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [deptAttendanceData, searchTerm]);

  if (loading) return <div className="flex h-[400px] items-center justify-center w-full"><Loader2 className="animate-spin text-[#0046ab] h-8 w-8" /></div>;

  return (
    <div className="w-full space-y-8 p-0 px-4 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-0">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
            <LayoutDashboard className="text-[#0046ab] h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-[#0046ab] tracking-tight">LeadX & BuildX Performance</h1>
            <p className="text-sm text-muted-foreground font-medium">Session-level engagement and department-wise attendance metrics.</p>
          </div>
        </div>
        <Button onClick={handleExportPDF} variant="outline" disabled={isExporting} className="h-11 px-6 rounded-xl border-zinc-200 text-zinc-600 font-bold text-sm uppercase flex items-center gap-2 hover:bg-zinc-50 transition-all shadow-sm self-start md:self-center">
          {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4 text-[#0046ab]" />}
          Export PDF
        </Button>
      </div>

      <div id="pdf-content-leadx" className="space-y-8">
        <Card className="shadow-sm border-zinc-200">
          <CardHeader className="bg-zinc-50/50 border-b p-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-[#0046ab]" />
                <CardTitle className="text-base font-bold uppercase tracking-wider text-zinc-700">Select Workshop Session</CardTitle>
              </div>
              <div className="flex flex-col sm:flex-row flex-wrap items-center gap-3 w-full lg:w-auto">
                <div className="relative w-full sm:w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
                  <Input placeholder="Topic search..." className="pl-9 h-9 text-[11px] font-bold uppercase border-zinc-200 focus-visible:ring-[#0046ab]" value={sessionSearch} onChange={(e) => setSessionSearch(e.target.value)} />
                </div>
                <div className="flex items-center gap-2 bg-white border border-zinc-200 rounded-lg px-2 py-1">
                  <div className="flex items-center gap-1.5"><span className="text-[9px] font-black text-zinc-400 uppercase">From</span><input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="text-[10px] font-bold uppercase outline-none focus:text-[#0046ab] bg-transparent" /></div>
                  <div className="w-px h-4 bg-zinc-100" /><div className="flex items-center gap-1.5"><span className="text-[9px] font-black text-zinc-400 uppercase">To</span><input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="text-[10px] font-bold uppercase outline-none focus:text-[#0046ab] bg-transparent" /></div>
                  {(fromDate || toDate) && <Button variant="ghost" size="icon" onClick={() => { setFromDate(''); setToDate(''); }} className="h-5 w-5 rounded-full hover:bg-zinc-100 text-zinc-400"><X className="h-3 w-3" /></Button>}
                </div>
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger className="w-full sm:w-[100px] h-9 text-[11px] font-black uppercase border-zinc-200 focus:ring-0 bg-white"><SelectValue placeholder="Year" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All" className="text-[11px] font-black uppercase">All Years</SelectItem>
                    {availableYears.map(year => <SelectItem key={year} value={year} className="text-[11px] font-black uppercase">{year}</SelectItem>)}
                  </SelectContent>
                </Select>
                {selectedSessionId && <Button variant="ghost" size="sm" onClick={() => setSelectedSessionId(null)} className="text-[10px] font-black uppercase text-zinc-400 h-7 shrink-0">Clear Selection</Button>}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[250px]">
              <div className="p-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-1.5">
                {filteredSessions.length > 0 ? filteredSessions.map(s => (
                  <div key={s.id} onClick={() => setSelectedSessionId(s.id)} className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all border ${selectedSessionId === s.id ? 'bg-[#0046ab]/10 border-[#0046ab] shadow-sm' : 'hover:bg-zinc-50 border-zinc-100 bg-white'}`}>
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${s.session_type === 'leadx' || s.topic.toLowerCase().includes('leadx') ? 'bg-[#0046ab]' : 'bg-amber-500'}`} />
                      <div className="overflow-hidden">
                        <p className={`text-xs font-black truncate ${selectedSessionId === s.id ? 'text-[#0046ab]' : 'text-zinc-700'}`}>{s.topic}</p>
                        <p className="text-[10px] font-bold text-zinc-400 uppercase">{new Date(s.scheduled_time).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {selectedSessionId === s.id && <Check className="h-3 w-3 text-[#0046ab]" />}
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-zinc-200 hover:text-rose-600 hover:bg-rose-50 rounded-full transition-colors" onClick={(e) => { e.stopPropagation(); setSessionToDelete(s); }}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  </div>
                )) : <div className="col-span-full h-[200px] flex flex-col items-center justify-center text-center p-8"><div className="p-4 bg-zinc-50 rounded-full mb-4"><Search className="h-6 w-6 text-zinc-200" /></div><p className="text-sm font-black text-zinc-400 uppercase tracking-widest">No matching sessions</p></div>}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <KPICard title="Registered" value={kpiData ? kpiData.registered : "—"} icon={<Users className="h-4 w-4" />} color="text-[#0046ab]" description={kpiData ? "Participants enrolled" : "Select a session to view"} />
          <KPICard title="Attended" value={kpiData ? kpiData.attended : "—"} icon={<CheckCircle2 className="h-4 w-4" />} color="text-emerald-600" description={kpiData ? "Verified attendance" : "Select a session to view"} />
          <KPICard title="Attendance Rate" value={kpiData ? `${kpiData.rate.toFixed(1)}%` : "—"} icon={<TrendingUp className="h-4 w-4" />} color="text-indigo-600" isRate description={kpiData ? "Engagement efficiency" : "Select a session to view"} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartCard title="LeadX Engagement" data={leadxChartData} color1="#0046ab" color2="#10b981" placeholder="Select a LeadX session to view engagement data." />
          <ChartCard title="BuildX Engagement" data={buildxChartData} color1="#3b82f6" color2="#f59e0b" placeholder="Select a BuildX session to view engagement data." />
        </div>

        <div className="pb-12">
          <Card className="shadow-sm overflow-hidden border-zinc-100">
            <CardHeader className="border-b bg-zinc-50/50 p-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div><CardTitle className="text-sm font-bold uppercase text-zinc-700 tracking-wider">Department Breakdown</CardTitle><CardDescription className="text-xs font-medium">{selectedSession ? `Data for ${selectedSession.topic}` : 'Global Aggregate Performance'}</CardDescription></div>
                <div className="relative w-full md:w-[300px]"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" /><Input placeholder="Search department..." className="pl-9 h-9 border-zinc-200" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div>
              </div>
            </CardHeader>
            <Table>
              <TableHeader className="bg-zinc-50"><TableRow><TableHead className="font-bold py-4 text-sm text-zinc-800">Department</TableHead><TableHead className="text-right font-bold text-sm text-zinc-800">Registered</TableHead><TableHead className="text-right font-bold text-sm text-zinc-800">Attended</TableHead><TableHead className="w-[30%] font-bold text-sm text-zinc-800">Attendance Rate</TableHead></TableRow></TableHeader>
              <TableBody>
                {filteredDeptTable.length === 0 ? <TableRow><TableCell colSpan={4} className="text-center py-10 text-zinc-400 italic text-sm">No data available.</TableCell></TableRow> : filteredDeptTable.map(d => (
                  <TableRow key={d.department} className="hover:bg-zinc-50/50 transition-colors border-b">
                    <TableCell className="text-sm font-bold text-zinc-700 py-4">{d.department}</TableCell><TableCell className="text-right font-medium text-zinc-600">{d.registrants}</TableCell><TableCell className="text-right font-bold text-zinc-900">{d.attendees}</TableCell>
                    <TableCell className="py-4"><div className="space-y-1.5"><div className="flex justify-between items-center px-0.5"><span className="text-[10px] font-black text-zinc-500">{d.attendance_rate.toFixed(1)}%</span></div><div className="h-2 w-full bg-zinc-100 rounded-full overflow-hidden border border-zinc-200/50"><div className={`h-full transition-all duration-500 rounded-full ${d.attendance_rate >= 80 ? 'bg-emerald-500' : d.attendance_rate >= 60 ? 'bg-blue-500' : 'bg-amber-500'}`} style={{ width: `${d.attendance_rate}%` }} /></div></div></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </div>
      </div>

      <Dialog open={!!sessionToDelete} onOpenChange={() => setSessionToDelete(null)}>
        <DialogContent><DialogHeader><DialogTitle className="flex items-center gap-2 text-rose-600"><Trash2 className="h-5 w-5" /> Confirm Deletion</DialogTitle><DialogDescription className="pt-2 text-sm text-zinc-600">Are you sure you want to delete <span className="font-bold text-zinc-900">"{sessionToDelete?.topic}"</span>?</DialogDescription></DialogHeader><DialogFooter className="pt-4"><Button variant="outline" onClick={() => setSessionToDelete(null)}>Cancel</Button><Button variant="destructive" onClick={deleteSession} disabled={isDeleting}>{isDeleting ? 'Deleting...' : 'Delete'}</Button></DialogFooter></DialogContent>
      </Dialog>
    </div>
  );
};

const KPICard = ({ title, value, icon, color, isRate, description }: any) => (
  <Card className="border-zinc-100 shadow-sm hover:shadow-md transition-all">
    <CardContent className="p-5">
      <div className="flex items-center justify-between mb-2"><span className="text-sm font-bold uppercase tracking-wider text-zinc-500">{title}</span><div className={`p-1.5 rounded-lg bg-zinc-50 ${color}`}>{icon}</div></div>
      <div className={`text-3xl font-black tracking-tight ${value === '—' ? 'text-zinc-300' : 'text-zinc-900'}`}>{value}</div>
      <p className="text-[10px] text-zinc-400 font-medium mt-1 uppercase">{description}</p>
      {isRate && value !== '—' && <div className="w-full h-1 bg-zinc-100 mt-2 rounded-full overflow-hidden"><div className={`h-full transition-all duration-500 ${parseFloat(value) >= 80 ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: value }} /></div>}
    </CardContent>
  </Card>
);

const ChartCard = ({ title, data, color1, color2, placeholder }: any) => (
  <Card className="shadow-sm border-zinc-100">
    <CardHeader className="bg-zinc-50/50 border-b p-6"><CardTitle className="text-sm font-bold uppercase text-zinc-700 tracking-wider">{title}</CardTitle></CardHeader>
    <CardContent className="p-6">
      <div className="h-[300px] w-full">
        {data.length === 0 ? <div className="flex flex-col h-full items-center justify-center text-center p-6 bg-zinc-50/30 rounded-2xl border-2 border-dashed border-zinc-100"><Zap className="h-8 w-8 text-zinc-200 mb-3" /><p className="text-[10px] font-black uppercase text-zinc-400 tracking-widest leading-relaxed max-w-[180px]">{placeholder}</p></div> : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 20, right: 10, left: -20, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 9, fontWeight: 900, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fontWeight: 'bold', fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <RechartsTooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
              <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ paddingBottom: '20px', fontSize: '10px', fontWeight: '900', textTransform: 'uppercase' }} />
              <Bar dataKey="reg" name="Registrants" fill={color1} radius={[6, 6, 0, 0]} barSize={40}><LabelList dataKey="reg" position="top" style={{ fontSize: 10, fontWeight: 'black', fill: color1 }} /></Bar>
              <Bar dataKey="att" name="Attendees" fill={color2} radius={[6, 6, 0, 0]} barSize={40}><LabelList dataKey="att" position="top" style={{ fontSize: 10, fontWeight: 'black', fill: color2 }} /></Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </CardContent>
  </Card>
);

export default LeadXReportsDashboard;
