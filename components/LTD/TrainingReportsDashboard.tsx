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
  Award
} from 'lucide-react';

interface TrainingReport {
  employee_id: string;
  employee_name: string;
  course_name: string;
  status: string;
  hours: number;
  delivery_unit: string;
}

const TrainingReportsDashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<TrainingReport[]>([]);
  const [selectedYear, setSelectedYear] = useState<string>("all");
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  
  const supabase = createClient();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('training_reports')
        .select('employee_id, employee_name, course_name, status, hours, delivery_unit');

      if (selectedYear !== "all") {
        query = query.ilike('course_name', `%${selectedYear}%`);
      }

      const { data, error } = await query;
      if (error) throw error;

      setReports(data || []);
    } catch (error) {
      console.error('Error fetching Training Reports data:', error);
    } finally {
      setLoading(false);
    }
  }, [supabase, selectedYear]);

  useEffect(() => {
    fetchData();
  }, [fetchData, refreshTrigger]);

  const metrics = useMemo(() => {
    if (reports.length === 0) return {
      totalParticipants: 0,
      totalCompletions: 0,
      avgPerUser: 0,
      participationRate: 0
    };

    // 1. Total Distinct Participants (by employee_id)
    const distinctEmployees = new Set(reports.map(r => r.employee_id));
    const totalParticipants = distinctEmployees.size;

    // 2. Total Completions (Status ILIKE '%completed%')
    const completions = reports.filter(r => 
      r.status.toLowerCase().includes('completed')
    );
    const totalCompletions = completions.length;

    // 3. Distinct participants with at least one completion
    const employeesWithCompletions = new Set(completions.map(r => r.employee_id));
    
    // 4. Avg per User (completions / distinct employees with completions)
    const avgPerUser = employeesWithCompletions.size > 0 
      ? totalCompletions / employeesWithCompletions.size 
      : 0;

    // 5. Participation Rate (distinct employees with completions / total distinct employees)
    const participationRate = totalParticipants > 0 
      ? (employeesWithCompletions.size / totalParticipants) * 100 
      : 0;

    return {
      totalParticipants,
      totalCompletions,
      avgPerUser: Number(avgPerUser.toFixed(2)),
      participationRate: Number(participationRate.toFixed(1))
    };
  }, [reports]);

  const departmentChartData = useMemo(() => {
    if (reports.length === 0) return [];

    // Grouping by delivery_unit to count distinct employees per department
    const deptMap: Record<string, Set<string>> = {};
    const totalDistinctEmployees = new Set(reports.map(r => r.employee_id)).size;

    reports.forEach(r => {
      const dept = r.delivery_unit || 'Other';
      if (!deptMap[dept]) {
        deptMap[dept] = new Set();
      }
      deptMap[dept].add(r.employee_id);
    });

    return Object.entries(deptMap)
      .map(([name, employeeSet]) => {
        const count = employeeSet.size;
        const percentage = (count / totalDistinctEmployees) * 100;
        return {
          name,
          count,
          percentage: Number(percentage.toFixed(1))
        };
      })
      .sort((a, b) => b.count - a.count);
  }, [reports]);

  if (loading) {
    return (
      <div className="flex h-[400px] items-center justify-center w-full">
        <Loader2 className="h-8 w-8 animate-spin text-[#0046ab]" />
      </div>
    );
  }

  return (
    <div className="w-full space-y-8 pb-12">
      {/* Header & Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 bg-white dark:bg-zinc-900 p-6 rounded-2xl border shadow-sm">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-[#0046ab]/10 rounded-xl">
            <FileText className="h-6 w-6 text-[#0046ab]" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-[#0046ab]">VILT Training Performance</h2>
            <p className="text-xs text-muted-foreground uppercase font-black tracking-widest">Independent Reporting Dashboard</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-xs font-black text-muted-foreground uppercase tracking-wider">
            <Calendar className="h-4 w-4" /> Course Year:
          </div>
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-[140px] h-10 text-sm font-bold border-zinc-200">
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="2023">2023</SelectItem>
              <SelectItem value="2024">2024</SelectItem>
              <SelectItem value="2025">2025</SelectItem>
              <SelectItem value="2026">2026</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {reports.length === 0 ? (
        <Card className="border-dashed bg-muted/30 py-24 text-center rounded-3xl">
          <CardContent>
            <AlertCircle className="mx-auto h-16 w-16 text-muted-foreground/40 mb-6" />
            <h3 className="text-2xl font-semibold">No Training Data Found</h3>
            <p className="text-muted-foreground mt-2">Upload VILT reports to view performance metrics for {selectedYear === 'all' ? 'any year' : selectedYear}.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Metrics Row */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            <Card className="border-t-4 border-t-[#0046ab] shadow-sm rounded-2xl overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between pb-2 p-6 space-y-0">
                <CardTitle className="text-xs font-black uppercase text-muted-foreground">Total Participants</CardTitle>
                <Users className="h-4 w-4 text-[#0046ab]" />
              </CardHeader>
              <CardContent className="px-6 pb-6 pt-0">
                <div className="text-3xl font-black">{metrics.totalParticipants}</div>
                <p className="text-[10px] text-muted-foreground font-medium mt-2">Unique employees in report</p>
              </CardContent>
            </Card>

            <Card className="border-t-4 border-t-emerald-500 shadow-sm rounded-2xl overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between pb-2 p-6 space-y-0">
                <CardTitle className="text-xs font-black uppercase text-muted-foreground">Completions</CardTitle>
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              </CardHeader>
              <CardContent className="px-6 pb-6 pt-0">
                <div className="text-3xl font-black text-emerald-600">{metrics.totalCompletions}</div>
                <p className="text-[10px] text-muted-foreground font-medium mt-2">Total course finishes</p>
              </CardContent>
            </Card>

            <Card className="border-t-4 border-t-purple-500 shadow-sm rounded-2xl overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between pb-2 p-6 space-y-0">
                <CardTitle className="text-xs font-black uppercase text-muted-foreground">Avg per User</CardTitle>
                <Award className="h-4 w-4 text-purple-500" />
              </CardHeader>
              <CardContent className="px-6 pb-6 pt-0">
                <div className="text-3xl font-black text-purple-600">{metrics.avgPerUser}</div>
                <p className="text-[10px] text-muted-foreground font-medium mt-2">Courses per active finisher</p>
              </CardContent>
            </Card>

            <Card className="border-t-4 border-t-orange-500 shadow-sm rounded-2xl overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between pb-2 p-6 space-y-0">
                <CardTitle className="text-xs font-black uppercase text-muted-foreground">Participation Rate</CardTitle>
                <TrendingUp className="h-4 w-4 text-orange-500" />
              </CardHeader>
              <CardContent className="px-6 pb-6 pt-0">
                <div className="text-3xl font-black text-orange-600">{metrics.participationRate}%</div>
                <p className="text-[10px] text-muted-foreground font-medium mt-2">Users with &ge;1 completion</p>
              </CardContent>
            </Card>
          </div>

          {/* Chart Row */}
          <Card className="shadow-sm rounded-3xl overflow-hidden">
            <CardHeader className="p-8 pb-2">
              <CardTitle className="text-xl font-black uppercase flex items-center gap-3">
                <BarChart3 className="h-6 w-6 text-[#0046ab]" /> Department Distribution (%)
              </CardTitle>
              <CardDescription className="text-xs font-medium mt-1">Percentage of total participants represented per delivery unit.</CardDescription>
            </CardHeader>
            <CardContent className="p-8 pt-0">
              <div className="h-[450px] w-full mt-8">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={departmentChartData} margin={{ bottom: 100, top: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 11, fontWeight: 600, fill: '#64748b' }} 
                      angle={-45} 
                      textAnchor="end" 
                      interval={0}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 11, fontWeight: 600, fill: '#64748b' }} 
                      unit="%" 
                      domain={[0, 100]}
                    />
                    <Tooltip 
                      cursor={{ fill: '#f8fafc' }} 
                      contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 12px 24px rgba(0,0,0,0.1)', fontSize: '12px', fontWeight: 'bold' }}
                      formatter={(value: any, name: any, props: any) => {
                        const percent = value !== undefined && value !== null ? `${value}%` : 'N/A';
                        return [percent, `Distribution (Total: ${props.payload.count} participants)`];
                      }}
                    />
                    <Bar dataKey="percentage" fill="#0046ab" radius={[8, 8, 0, 0]} barSize={50}>
                      {departmentChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.percentage > 30 ? '#0046ab' : entry.percentage > 10 ? '#3b82f6' : '#94a3b8'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default TrainingReportsDashboard;
