"use client";

import React, { useEffect, useState, useMemo } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, Legend
} from 'recharts';
import { 
  Loader2, 
  Calendar,
  CheckCircle2,
  TrendingUp,
  Presentation,
  UserPlus,
  ArrowUpDown,
  HelpCircle
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface LeadXSession {
  id: string;
  topic: string;
  scheduled_time: string;
  duration: number;
  actual_duration: number;
  registrants_count: number;
  attendees_count: number;
  walk_ins_count: number;
}

const formatNumber = (num: number) => new Intl.NumberFormat().format(num);
const formatPercent = (rate: number) => `${rate.toFixed(1)}%`;

const LeadXReportsDashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<LeadXSession[]>([]);
  const [sortConfig, setSortConfig] = useState<{ key: keyof LeadXSession | 'rate', direction: 'asc' | 'desc' } | null>(null);
  const supabase = createClient();

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const { data: sessionData, error: sessionError } = await supabase
        .from('leadx_sessions')
        .select(`
          id,
          topic,
          scheduled_time,
          duration,
          actual_duration
        `)
        .order('scheduled_time', { ascending: false });

      if (sessionError) throw sessionError;

      const processedSessions = await Promise.all(sessionData.map(async (session) => {
        // 1. Registered Count: Exclude walk-ins
        const { count: regCount } = await supabase
          .from('leadx_registrants')
          .select('*', { count: 'exact', head: true })
          .eq('session_id', session.id)
          .neq('approval_status', 'Attended without registration');

        // 2. Walk-in Count: Specifically those who attended without registration
        const { count: walkInCount } = await supabase
          .from('leadx_registrants')
          .select('*', { count: 'exact', head: true })
          .eq('session_id', session.id)
          .eq('approval_status', 'Attended without registration');

        // 3. Attendee Count: All who attended (Keep at 79)
        const { count: attCount } = await supabase
          .from('leadx_registrants')
          .select('*', { count: 'exact', head: true })
          .eq('session_id', session.id)
          .eq('attended', true);

        return {
          ...session,
          registrants_count: regCount || 0,
          attendees_count: attCount || 0,
          walk_ins_count: walkInCount || 0
        };
      }));

      setSessions(processedSessions);
    } catch (error) {
      console.error('Error fetching LeadX data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const metrics = useMemo(() => {
    const totalSessions = sessions.length;
    const totalRegistrants = sessions.reduce((acc, curr) => acc + curr.registrants_count, 0);
    const totalAttendees = sessions.reduce((acc, curr) => acc + curr.attendees_count, 0);
    const totalWalkIns = sessions.reduce((acc, curr) => acc + curr.walk_ins_count, 0);
    const attendanceRate = totalRegistrants > 0 ? (totalAttendees / totalRegistrants) * 100 : 0;

    return {
      totalSessions,
      totalRegistrants,
      totalAttendees,
      totalWalkIns,
      attendanceRate: Number(attendanceRate.toFixed(1))
    };
  }, [sessions]);

  const sortedSessions = useMemo(() => {
    let items = [...sessions];
    if (sortConfig !== null) {
      items.sort((a, b) => {
        let aValue: any;
        let bValue: any;

        if (sortConfig.key === 'rate') {
          aValue = a.registrants_count > 0 ? a.attendees_count / a.registrants_count : 0;
          bValue = b.registrants_count > 0 ? b.attendees_count / b.registrants_count : 0;
        } else {
          aValue = a[sortConfig.key];
          bValue = b[sortConfig.key];
        }

        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return items;
  }, [sessions, sortConfig]);

  const requestSort = (key: keyof LeadXSession | 'rate') => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const chartData = useMemo(() => {
    return [...sessions].reverse().map(s => ({
      topic: s.topic.length > 20 ? s.topic.substring(0, 20) + '...' : s.topic,
      fullTopic: s.topic,
      registrants: s.registrants_count,
      attendees: s.attendees_count,
      rate: s.registrants_count > 0 ? Number(((s.attendees_count / s.registrants_count) * 100).toFixed(1)) : 0
    }));
  }, [sessions]);

  if (loading) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#0046ab]" />
      </div>
    );
  }

  const getAttendanceColor = (rate: number) => {
    if (rate >= 75) return 'text-emerald-600';
    if (rate >= 50) return 'text-amber-500';
    return 'text-red-500';
  };

  const getAttendanceBorderColor = (rate: number) => {
    if (rate >= 75) return 'border-t-emerald-500';
    if (rate >= 50) return 'border-t-amber-500';
    return 'border-t-red-500';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-zinc-900 p-4 rounded-xl border shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#0046ab]/10 rounded-lg">
            <Presentation className="h-5 w-5 text-[#0046ab]" />
          </div>
          <div>
            <h2 className="text-lg font-bold tracking-tight text-[#0046ab]">LeadX & BuildX Reports</h2>
            <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">Independent Session Engagement Analytics</p>
          </div>
        </div>
      </div>

      {sessions.length === 0 ? (
        <Card className="border-dashed bg-muted/30 py-20 text-center">
          <CardContent>
            <Calendar className="mx-auto h-12 w-12 text-muted-foreground/40 mb-4" />
            <h3 className="text-xl font-semibold">No LeadX Session Data</h3>
            <p className="text-muted-foreground">Upload registration and attendance reports to view metrics.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
            <MetricCard title="Sessions" value={formatNumber(metrics.totalSessions)} icon={Presentation} color="border-t-[#0046ab]" />
            <MetricCard title="Registrants" value={formatNumber(metrics.totalRegistrants)} icon={UserPlus} color="border-t-blue-400" />
            <MetricCard 
              title="Unregistered" 
              value={formatNumber(metrics.totalWalkIns)} 
              icon={HelpCircle} 
              color="border-t-zinc-400" 
              tooltip="People who attended without prior registration (Walk-ins)."
            />
            <MetricCard title="Attendees" value={formatNumber(metrics.totalAttendees)} icon={CheckCircle2} color="border-t-emerald-500" />
            <MetricCard 
              title="Attendance Rate" 
              value={formatPercent(metrics.attendanceRate)} 
              icon={TrendingUp} 
              color={getAttendanceBorderColor(metrics.attendanceRate)}
              valueClassName={getAttendanceColor(metrics.attendanceRate)}
            />
          </div>

          {/* Chart & Table */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-sm font-bold uppercase tracking-wider">Session Engagement (Registrants vs Attendees)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[400px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ left: -10, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis 
                        dataKey="topic" 
                        tick={{ fontSize: 9 }} 
                        interval={0} 
                        angle={-25} 
                        textAnchor="end"
                        height={60}
                      />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip 
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: '11px' }}
                        formatter={(value: number) => formatNumber(value)}
                      />
                      <Legend verticalAlign="top" height={36}/>
                      <Bar dataKey="registrants" name="Registrants" fill="#8884d8" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="attendees" name="Attendees" fill="#82ca9d" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="lg:col-span-1">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-bold uppercase tracking-wider">Session Details</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[400px]">
                  <Table>
                    <TableHeader className="sticky top-0 bg-white dark:bg-zinc-900 z-10 shadow-sm">
                      <TableRow>
                        <TableHead className="text-[10px] font-bold uppercase cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => requestSort('topic')}>
                          <div className="flex items-center gap-1">
                            Topic <ArrowUpDown className="h-3 w-3" />
                          </div>
                        </TableHead>
                        <TableHead className="text-[10px] font-bold uppercase text-right cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => requestSort('rate')}>
                          <div className="flex items-center justify-end gap-1">
                            Engagement <ArrowUpDown className="h-3 w-3" />
                          </div>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedSessions.map((s) => {
                        const rate = s.registrants_count > 0 ? (s.attendees_count / s.registrants_count) * 100 : 0;
                        const isLowAttendance = rate < 50;
                        return (
                          <TableRow key={s.id} className={isLowAttendance ? "bg-red-50/30 dark:bg-red-950/10" : ""}>
                            <TableCell className="text-[11px] font-medium leading-tight py-3">
                              <div className="font-bold text-zinc-900 dark:text-zinc-100">{s.topic}</div>
                              <div className="text-[9px] text-muted-foreground font-normal mt-1 flex items-center gap-2">
                                {new Date(s.scheduled_time).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                {s.walk_ins_count > 0 && (
                                  <span className="bg-zinc-100 text-zinc-600 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase">
                                    {s.walk_ins_count} Walk-ins
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right py-3">
                              <div className="text-[11px] font-black">{s.attendees_count} <span className="text-muted-foreground font-normal">/ {s.registrants_count}</span></div>
                              <div className="mt-1.5 space-y-1">
                                <div className="flex items-center justify-end gap-2">
                                  <span className={`text-[10px] font-black ${getAttendanceColor(rate)}`}>
                                    {rate.toFixed(1)}%
                                  </span>
                                </div>
                                <div className="h-1.5 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                                  <div 
                                    className={`h-full rounded-full ${rate >= 75 ? 'bg-emerald-500' : rate >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                                    style={{ width: `${Math.min(rate, 100)}%` }}
                                  />
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
};

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: any;
  color: string;
  valueClassName?: string;
  tooltip?: string;
}

const MetricCard = ({ title, value, icon: Icon, color, valueClassName, tooltip }: MetricCardProps) => (
  <Card className={`border-t-4 ${color} shadow-sm h-full`}>
    <CardHeader className="flex flex-row items-center justify-between pb-1 space-y-0">
      <div className="flex items-center gap-1.5">
        <CardTitle className="text-[10px] font-black uppercase text-muted-foreground tracking-wider">{title}</CardTitle>
        {tooltip && (
          <Popover>
            <PopoverTrigger asChild>
              <button className="text-muted-foreground hover:text-zinc-900 outline-none">
                <HelpCircle className="h-3 w-3" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-2 text-[10px] leading-relaxed shadow-lg">
              {tooltip}
            </PopoverContent>
          </Popover>
        )}
      </div>
      {!tooltip && <Icon className="h-3.5 w-3.5 text-muted-foreground" />}
    </CardHeader>
    <CardContent>
      <div className={`text-2xl font-black ${valueClassName || ''}`}>{value}</div>
    </CardContent>
  </Card>
);

export default LeadXReportsDashboard;
