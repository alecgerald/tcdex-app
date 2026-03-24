"use client";

import React, { useEffect, useState, useMemo } from 'react';
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
  Check
} from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface LeadXSession {
  id: string;
  topic: string;
  scheduled_time: string;
  registrants_count: number;
  attendees_count: number;
  session_type: string;
}

interface DepartmentAttendance {
  department: string;
  registrants: number;
  attendees: number;
  attendance_rate: number;
}

const LeadXReportsDashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<LeadXSession[]>([]);
  const [allRegistrants, setAllRegistrants] = useState<any[]>([]);
  const [masterDepartments, setMasterDepartments] = useState<string[]>([]);
  const [sessionToDelete, setSessionToDelete] = useState<LeadXSession | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Selection State
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const supabase = createClient();

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Master Departments
      const { data: depts } = await supabase.from('departments').select('name');
      setMasterDepartments(depts?.map(d => d.name) || []);

      // 2. Fetch Sessions
      const { data: sData } = await supabase
        .from('leadx_sessions')
        .select('*')
        .order('scheduled_time', { ascending: false });

      if (!sData) return;

      // 3. Fetch All Registrants
      const { data: allReg } = await supabase
        .from('leadx_registrants')
        .select('session_id, department, attended, approval_status');
      
      setAllRegistrants(allReg || []);

      // 4. Process Sessions with Counts
      const processedSessions = sData.map((s) => {
        const sessionRegs = allReg?.filter(r => 
          r.session_id === s.id && r.approval_status !== 'Attended without registration'
        ) || [];
        const attendees = sessionRegs.filter(r => r.attended);
        
        return { 
          ...s, 
          registrants_count: sessionRegs.length, 
          attendees_count: attendees.length 
        };
      });
      setSessions(processedSessions);

    } catch (err) {
      console.error(err);
      toast.error("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

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
      
      if (selectedSessionId === deletedId) {
        setSelectedSessionId(null);
      }
      fetchData();
    } catch (err: any) {
      console.error(err);
      toast.error("Error deleting session: " + err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // Selected Session Reference
  const selectedSession = useMemo(() => 
    sessions.find(s => s.id === selectedSessionId),
  [sessions, selectedSessionId]);

  // KPI Data Calculation
  const kpiData = useMemo(() => {
    if (selectedSession) {
      return {
        registered: selectedSession.registrants_count,
        attended: selectedSession.attendees_count,
        rate: selectedSession.registrants_count > 0 ? (selectedSession.attendees_count / selectedSession.registrants_count) * 100 : 0,
        label: selectedSession.topic
      };
    }
    return null; // Show placeholder if no selection
  }, [selectedSession]);

  // Process Department Table Data (Shows aggregate if no selection, otherwise session-specific)
  const deptAttendanceData = useMemo(() => {
    const deptGroups: Record<string, { reg: number, att: number }> = {};
    masterDepartments.forEach(name => {
      deptGroups[name] = { reg: 0, att: 0 };
    });

    allRegistrants.forEach(r => {
      if (!selectedSessionId || r.session_id === selectedSessionId) {
        const d = r.department || 'Unknown';
        if (!deptGroups[d]) deptGroups[d] = { reg: 0, att: 0 };
        if (r.approval_status !== 'Attended without registration') {
          deptGroups[d].reg++;
        }
        if (r.attended) {
          deptGroups[d].att++;
        }
      }
    });

    return Object.entries(deptGroups).map(([d, c]) => ({
      department: d,
      registrants: c.reg,
      attendees: c.att,
      attendance_rate: c.reg > 0 ? (c.att / c.reg) * 100 : 0
    })).sort((a, b) => b.attendance_rate - a.attendance_rate || b.registrants - a.registrants);
  }, [allRegistrants, masterDepartments, selectedSessionId]);

  const filteredDeptTable = useMemo(() => {
    return deptAttendanceData.filter(d => 
      d.department.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [deptAttendanceData, searchTerm]);

  // Chart Data
  const leadxChartData = useMemo(() => 
    sessions.filter(s => s.session_type === 'leadx')
      .map(s => ({ id: s.id, name: s.topic, reg: s.registrants_count, att: s.attendees_count }))
      .reverse(), 
  [sessions]);

  const buildxChartData = useMemo(() => 
    sessions.filter(s => s.session_type === 'buildx')
      .map(s => ({ id: s.id, name: s.topic, reg: s.registrants_count, att: s.attendees_count }))
      .reverse(), 
  [sessions]);

  if (loading) return <div className="flex h-[400px] items-center justify-center w-full"><Loader2 className="animate-spin text-[#0046ab] h-8 w-8" /></div>;

  return (
    <div className="w-full space-y-8 p-0 px-4">
      {/* Header Section */}
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
      </div>

      {/* NEW: Combined Session Manager Card */}
      <Card className="shadow-sm border-zinc-200">
        <CardHeader className="bg-zinc-50/50 border-b p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-[#0046ab]" />
              <CardTitle className="text-sm font-black uppercase tracking-wider text-zinc-600">Select Workshop Session</CardTitle>
            </div>
            {selectedSessionId && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setSelectedSessionId(null)}
                className="text-[10px] font-black uppercase text-zinc-400 h-7"
              >
                Clear Selection
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[200px]">
            <div className="p-2 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-1">
              {sessions.map(s => (
                <div 
                  key={s.id}
                  onClick={() => setSelectedSessionId(s.id)}
                  className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all border ${
                    selectedSessionId === s.id 
                      ? 'bg-[#0046ab]/10 border-[#0046ab] shadow-sm' 
                      : 'hover:bg-zinc-50 border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${s.session_type === 'leadx' ? 'bg-[#0046ab]' : 'bg-amber-500'}`} />
                    <div className="overflow-hidden">
                      <p className={`text-xs font-black truncate ${selectedSessionId === s.id ? 'text-[#0046ab]' : 'text-zinc-700'}`}>
                        {s.topic}
                      </p>
                      <p className="text-[10px] font-bold text-zinc-400 uppercase">
                        {new Date(s.scheduled_time).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedSessionId === s.id && <Check className="h-3 w-3 text-[#0046ab]" />}
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-6 w-6 text-zinc-300 hover:text-rose-600 hover:bg-rose-50 rounded-full"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSessionToDelete(s);
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* KPI Cards (Dynamic) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KPICard 
          title="Registered" 
          value={kpiData ? kpiData.registered : "—"} 
          icon={<Users className="h-4 w-4" />} 
          color="text-[#0046ab]" 
          description={kpiData ? "Participants enrolled" : "Select a session to view"}
        />
        <KPICard 
          title="Attended" 
          value={kpiData ? kpiData.attended : "—"} 
          icon={<CheckCircle2 className="h-4 w-4" />} 
          color="text-emerald-600" 
          description={kpiData ? "Verified attendance" : "Select a session to view"}
        />
        <KPICard 
          title="Attendance Rate" 
          value={kpiData ? `${kpiData.rate.toFixed(1)}%` : "—"} 
          icon={<TrendingUp className="h-4 w-4" />} 
          color="text-indigo-600" 
          isRate 
          description={kpiData ? "Engagement efficiency" : "Select a session to view"}
        />
      </div>

      {/* Side-by-Side Charts (With Highlighting) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard 
          title="LeadX Engagement Overview" 
          data={leadxChartData} 
          color1="#0046ab" 
          color2="#10b981" 
          selectedId={selectedSessionId}
        />
        <ChartCard 
          title="BuildX Engagement Overview" 
          data={buildxChartData} 
          color1="#3b82f6" 
          color2="#f59e0b" 
          selectedId={selectedSessionId}
        />
      </div>

      {/* Department Breakdown Table */}
      <div className="pb-12">
        <Card className="shadow-sm overflow-hidden border-zinc-100">
          <CardHeader className="border-b bg-zinc-50/50 p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-xs font-black uppercase text-zinc-500 tracking-wider">Department Breakdown</CardTitle>
                <CardDescription className="text-xs font-medium">
                  {selectedSession ? `Data for ${selectedSession.topic}` : 'Global Aggregate Performance'} — Sorted by attendance rate
                </CardDescription>
              </div>
              <div className="relative w-full md:w-[300px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                <Input 
                  placeholder="Search department..." 
                  className="pl-9 h-9 border-zinc-200 focus-visible:ring-[#0046ab]"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </CardHeader>
          <Table>
            <TableHeader className="bg-zinc-50">
              <TableRow>
                <TableHead className="font-bold py-4">Department</TableHead>
                <TableHead className="text-right font-bold">Registered</TableHead>
                <TableHead className="text-right font-bold">Attended</TableHead>
                <TableHead className="w-[30%] font-bold">Attendance Rate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDeptTable.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-10 text-zinc-400 text-sm italic">
                    No data available for this selection.
                  </TableCell>
                </TableRow>
              ) : (
                filteredDeptTable.map(d => (
                  <TableRow key={d.department} className="hover:bg-zinc-50/50 transition-colors border-b">
                    <TableCell className="text-sm font-bold text-zinc-700 py-4">{d.department}</TableCell>
                    <TableCell className="text-right font-medium text-zinc-600">{d.registrants}</TableCell>
                    <TableCell className="text-right font-bold text-zinc-900">{d.attendees}</TableCell>
                    <TableCell className="py-4">
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center px-0.5">
                          <span className="text-[10px] font-black text-zinc-500">{d.attendance_rate.toFixed(1)}%</span>
                        </div>
                        <div className="h-2 w-full bg-zinc-100 rounded-full overflow-hidden border border-zinc-200/50">
                          <div 
                            className={`h-full transition-all duration-500 rounded-full ${
                              d.attendance_rate >= 80 ? 'bg-emerald-500' : 
                              d.attendance_rate >= 60 ? 'bg-blue-500' : 
                              d.attendance_rate > 0 ? 'bg-amber-500' : 'bg-transparent'
                            }`}
                            style={{ width: `${d.attendance_rate}%` }}
                          />
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </div>

      {/* Delete Confirmation */}
      <Dialog open={!!sessionToDelete} onOpenChange={() => setSessionToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-600">
              <Trash2 className="h-5 w-5" /> Confirm Deletion
            </DialogTitle>
            <DialogDescription className="pt-2 text-sm text-zinc-600 leading-relaxed">
              Are you sure you want to delete <span className="font-bold text-zinc-900">"{sessionToDelete?.topic}"</span>? 
              This will remove all associated registration records.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="pt-4">
            <Button variant="outline" onClick={() => setSessionToDelete(null)} className="font-bold">Cancel</Button>
            <Button 
              variant="destructive" 
              onClick={deleteSession} 
              disabled={isDeleting}
              className="font-bold"
            >
              {isDeleting ? 'Deleting...' : 'Delete Permanently'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Sub-components
const KPICard = ({ title, value, icon, color, isRate, description }: any) => (
  <Card className="border-zinc-100 shadow-sm hover:shadow-md transition-all">
    <CardContent className="p-5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400">{title}</span>
        <div className={`p-1.5 rounded-lg bg-zinc-50 ${color}`}>{icon}</div>
      </div>
      <div className={`text-2xl font-black tracking-tight ${value === '—' ? 'text-zinc-300' : 'text-zinc-900'}`}>{value}</div>
      <p className="text-[10px] text-zinc-400 font-medium mt-1 uppercase tracking-tight">{description}</p>
      {isRate && value !== '—' && (
        <div className="w-full h-1 bg-zinc-100 mt-2 rounded-full overflow-hidden">
          <div 
            className={`h-full transition-all duration-500 ${parseFloat(value) >= 80 ? 'bg-emerald-500' : 'bg-amber-500'}`}
            style={{ width: value }}
          />
        </div>
      )}
    </CardContent>
  </Card>
);

const ChartCard = ({ title, data, color1, color2, selectedId }: any) => {
  // Define highlight colors
  const highlightColor1 = "#000"; // Darker for registrants
  const highlightColor2 = "#059669"; // Different emerald for attendees

  return (
    <Card className="shadow-sm border-zinc-100">
      <CardHeader className="bg-zinc-50/50 border-b p-6">
        <CardTitle className="text-xs font-black uppercase text-zinc-500 tracking-wider">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <div className="h-[400px] w-full">
          {data.length === 0 ? (
            <div className="flex h-full items-center justify-center text-zinc-300 font-bold uppercase text-xs tracking-widest">
              No session data
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart 
                data={data} 
                margin={{ top: 20, right: 10, left: -20, bottom: 80 }}
                barGap={8}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  interval={0}
                  tick={<RotatedAxisTick />}
                  stroke="#e2e8f0"
                />
                <YAxis 
                  tick={{ fontSize: 10, fontWeight: 'bold', fill: '#94a3b8' }} 
                  stroke="#e2e8f0"
                />
                <RechartsTooltip 
                  cursor={{ fill: '#f8fafc' }}
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-white p-3 border rounded-xl shadow-xl border-zinc-100">
                          <p className="text-xs font-black text-zinc-900 mb-2 border-b pb-1">{label}</p>
                          {payload.map((p: any) => (
                            <div key={p.name} className="flex items-center gap-2 text-[10px] font-bold">
                              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
                              <span className="text-zinc-500">{p.name}:</span>
                              <span className="text-zinc-900">{p.value}</span>
                            </div>
                          ))}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend 
                  verticalAlign="top" 
                  align="right" 
                  iconType="circle"
                  wrapperStyle={{ paddingTop: '0', paddingBottom: '20px', fontSize: '10px', fontWeight: '900', textTransform: 'uppercase' }}
                />
                <Bar 
                  dataKey="reg" 
                  name="Registrants" 
                  fill={color1} 
                  radius={[4, 4, 0, 0]} 
                  barSize={32}
                >
                  {data.map((entry: any, index: number) => (
                    <Cell 
                      key={`cell-reg-${index}`} 
                      fill={entry.id === selectedId ? highlightColor1 : color1} 
                      stroke={entry.id === selectedId ? "#000" : "none"}
                      strokeWidth={2}
                    />
                  ))}
                  <LabelList dataKey="reg" position="top" style={{ fontSize: 9, fill: color1, fontWeight: '900' }} />
                </Bar>
                <Bar 
                  dataKey="att" 
                  name="Attendees" 
                  fill={color2} 
                  radius={[4, 4, 0, 0]} 
                  barSize={32}
                >
                  {data.map((entry: any, index: number) => (
                    <Cell 
                      key={`cell-att-${index}`} 
                      fill={entry.id === selectedId ? highlightColor2 : color2}
                      stroke={entry.id === selectedId ? highlightColor2 : "none"}
                      strokeWidth={2}
                    />
                  ))}
                  <LabelList dataKey="att" position="top" style={{ fontSize: 9, fill: color2, fontWeight: '900' }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

const RotatedAxisTick = (props: any) => {
  const { x, y, payload } = props;
  
  return (
    <g transform={`translate(${x},${y})`}>
      <text 
        x={0} 
        y={0} 
        dy={16} 
        textAnchor="end" 
        fill="#64748b" 
        fontSize={9} 
        fontWeight="900"
        transform="rotate(-35)"
      >
        {payload.value.length > 20 ? payload.value.substring(0, 17) + '...' : payload.value}
      </text>
    </g>
  );
};

export default LeadXReportsDashboard;
