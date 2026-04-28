"use client";

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Loader2, 
  Users, 
  Calendar,
  AlertCircle,
  FileText,
  BarChart3,
  CheckCircle2,
  TrendingUp,
  Award,
  Download
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface TrainingReport {
  employee_id: string;
  employee_name: string;
  course_name: string;
  status: string;
  hours: number;
  delivery_unit: string;
}

const supabase = createClient();

const TrainingReportsDashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<TrainingReport[]>([]);
  const [selectedYear, setSelectedYear] = useState<string>("all");
  const [isExporting, setIsExporting] = useState(false);
  
  const metrics = useMemo(() => {
    if (reports.length === 0) return { totalParticipants: 0, totalCompletions: 0, avgPerUser: 0, participationRate: 0 };
    
    // Deduplicate reports by employee_id and course_name
    // We use a Map and iterate forward; later entries (newer uploads) will overwrite older ones
    const uniqueMap = new Map();
    
    for (const r of reports) {
      const key = `${r.employee_id}-${r.course_name}`;
      uniqueMap.set(key, r);
    }

    const uniqueReports = Array.from(uniqueMap.values());

    const distinctEmployees = new Set(uniqueReports.map(r => r.employee_id));
    const totalParticipants = distinctEmployees.size;
    const completions = uniqueReports.filter(r => r.status.toLowerCase().includes('completed'));
    const totalCompletions = completions.length;
    const employeesWithCompletions = new Set(completions.map(r => r.employee_id));
    const avgPerUser = employeesWithCompletions.size > 0 ? totalCompletions / employeesWithCompletions.size : 0;
    const participationRate = totalParticipants > 0 ? (employeesWithCompletions.size / totalParticipants) * 100 : 0;
    return { totalParticipants, totalCompletions, avgPerUser: Number(avgPerUser.toFixed(2)), participationRate: Number(participationRate.toFixed(1)) };
  }, [reports]);

  const departmentChartData = useMemo(() => {
    if (reports.length === 0) return [];
    const deptMap: Record<string, Set<string>> = {};
    const totalDistinctEmployees = new Set(reports.map(r => r.employee_id)).size;
    reports.forEach(r => {
      const dept = r.delivery_unit || 'Other';
      if (!deptMap[dept]) deptMap[dept] = new Set();
      deptMap[dept].add(r.employee_id);
    });
    return Object.entries(deptMap).map(([name, employeeSet]) => ({ name, count: employeeSet.size, percentage: Number((employeeSet.size / totalDistinctEmployees * 100).toFixed(1)) })).sort((a, b) => b.count - a.count);
  }, [reports]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase.from('training_reports').select('employee_id, employee_name, course_name, status, hours, delivery_unit');
      if (selectedYear !== "all") query = query.ilike('course_name', `%${selectedYear}%`);
      const { data, error } = await query;
      if (error) throw error;
      setReports(data || []);
    } catch (error) {
      console.error('Error fetching Training Reports data:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedYear]);

  const handleExportPDF = useCallback(async () => {
    if (reports.length === 0) {
      toast.error("No data available to export.");
      return;
    }
    setIsExporting(true);
    const toastId = toast.loading("Generating vector PDF report...");

    const payload = {
      title: "Training Reports Dashboard Report",
      description: `Analysis of virtual instructor-led training performance${selectedYear !== 'all' ? ` for year ${selectedYear}` : ''}.`,
      date: new Date().toLocaleDateString(),
      kpis: [
        { title: "Total Participants", value: metrics.totalParticipants, description: "Unique learners identified." },
        { title: "Total Completions", value: metrics.totalCompletions, description: "Total courses completed." },
        { title: "Avg per User", value: metrics.avgPerUser, description: "Average completions per active user." },
        { title: "Participation Rate", value: `${metrics.participationRate}%`, description: "Ratio of users with completions." }
      ],
      charts: [
        {
          title: "Department Distribution (%)",
          data: departmentChartData.slice(0, 10).map(d => ({
            label: d.name,
            value: d.percentage,
            max: 100,
            color: "#0046ab"
          }))
        }
      ],
      tables: [
        {
          title: "Department Breakdown",
          headers: ["Department", "Learner Count", "Percentage"],
          rows: departmentChartData.map(d => [
            d.name,
            d.count.toString(),
            `${d.percentage}%`
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
      a.download = `Training_Reports_Dashboard_${new Date().toISOString().split('T')[0]}.pdf`;
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
  }, [reports, metrics, departmentChartData, selectedYear]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) return <div className="flex h-[400px] items-center justify-center w-full"><Loader2 className="h-8 w-8 animate-spin text-[#0046ab]" /></div>;

  return (
    <div className="w-full space-y-8 pb-12">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-white dark:bg-zinc-900 p-6 rounded-2xl border shadow-sm">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-[#0046ab]/10 rounded-xl">
            <FileText className="h-6 w-6 text-[#0046ab]" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-[#0046ab]">Training Reports Dashboard</h2>
            <p className="text-xs text-muted-foreground uppercase font-black tracking-widest">Independent Reporting Dashboard</p>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="flex items-center gap-3 bg-zinc-50 p-2 rounded-xl border">
            <div className="flex items-center gap-2 text-xs font-black text-muted-foreground uppercase tracking-wider pl-2">
              <Calendar className="h-3.5 w-3.5" /> 
              <span>Year:</span>
            </div>
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-[120px] h-8 text-xs font-black border-none bg-transparent focus:ring-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs font-black uppercase">All Time</SelectItem>
                <SelectItem value="2023" className="text-xs font-black uppercase">2023</SelectItem>
                <SelectItem value="2024" className="text-xs font-black uppercase">2024</SelectItem>
                <SelectItem value="2025" className="text-xs font-black uppercase">2025</SelectItem>
                <SelectItem value="2026" className="text-xs font-black uppercase">2026</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <Button 
            onClick={handleExportPDF}
            variant="outline"
            disabled={isExporting}
            className="h-12 px-6 rounded-xl border-zinc-200 text-zinc-600 font-bold text-sm uppercase flex items-center gap-2 hover:bg-zinc-50 transition-all shadow-sm w-full sm:w-auto"
          >
            {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4 text-[#0046ab]" />}
            Export PDF
          </Button>
        </div>
      </div>
      {reports.length === 0 ? (<Card className="border-dashed bg-muted/30 py-24 text-center rounded-3xl"><CardContent><AlertCircle className="mx-auto h-16 w-16 text-muted-foreground/40 mb-6" /><h3 className="text-2xl font-semibold">No Training Data Found</h3></CardContent></Card>) : (
        <div className="space-y-8">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            <Card className="border-t-4 border-t-[#0046ab]"><CardHeader className="pb-2 p-6"><CardTitle className="text-xs font-black uppercase text-muted-foreground">Total Participants</CardTitle></CardHeader><CardContent className="px-6 pb-6 pt-0"><div className="text-3xl font-black">{metrics.totalParticipants}</div></CardContent></Card>
            <Card className="border-t-4 border-t-emerald-500"><CardHeader className="pb-2 p-6"><CardTitle className="text-xs font-black uppercase text-muted-foreground">Completions</CardTitle></CardHeader><CardContent className="px-6 pb-6 pt-0"><div className="text-3xl font-black text-emerald-600">{metrics.totalCompletions}</div></CardContent></Card>
            <Card className="border-t-4 border-t-purple-500"><CardHeader className="pb-2 p-6"><CardTitle className="text-xs font-black uppercase text-muted-foreground">Avg per User</CardTitle></CardHeader><CardContent className="px-6 pb-6 pt-0"><div className="text-3xl font-black text-purple-600">{metrics.avgPerUser}</div></CardContent></Card>
            <Card className="border-t-4 border-t-orange-500"><CardHeader className="pb-2 p-6"><CardTitle className="text-xs font-black uppercase text-muted-foreground">Participation Rate</CardTitle></CardHeader><CardContent className="px-6 pb-6 pt-0"><div className="text-3xl font-black text-orange-600">{metrics.participationRate}%</div></CardContent></Card>
          </div>
          <Card className="shadow-sm rounded-3xl overflow-hidden"><CardHeader className="p-8 pb-2"><CardTitle className="text-xl font-black uppercase flex items-center gap-3"><BarChart3 className="h-6 w-6 text-[#0046ab]" /> Department Distribution (%)</CardTitle></CardHeader><CardContent className="p-8 pt-0"><div className="h-[450px] w-full mt-8"><ResponsiveContainer width="100%" height="100%"><BarChart data={departmentChartData} margin={{ bottom: 100, top: 20 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" /><XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 600, fill: '#64748b' }} angle={-45} textAnchor="end" interval={0} /><YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 600, fill: '#64748b' }} unit="%" domain={[0, 100]} /><Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 12px 24px rgba(0,0,0,0.1)', fontSize: '12px', fontWeight: 'bold' }} /><Bar dataKey="percentage" fill="#0046ab" radius={[8, 8, 0, 0]} barSize={50}>{departmentChartData.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.percentage > 30 ? '#0046ab' : entry.percentage > 10 ? '#3b82f6' : '#94a3b8'} />))}</Bar></BarChart></ResponsiveContainer></div></CardContent></Card>
        </div>
      )}
    </div>
  );
};

export default TrainingReportsDashboard;
