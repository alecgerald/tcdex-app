"use client";

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
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell
} from 'recharts';
import { 
  Loader2, 
  Users, 
  Calendar,
  AlertCircle,
  MousePointer2,
  CheckCircle,
  Award,
  TrendingUp,
  CircleDot
} from 'lucide-react';

interface LMSCompletion {
  participant_id: string;
  course_name: string;
  status: string;
  completed_at: string | null;
}

const SelfPacedDashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [lmsCompletions, setLmsCompletions] = useState<LMSCompletion[]>([]);
  const [selectedYear, setSelectedYear] = useState<string>("all");
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  
  const supabase = createClient();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      let lmsQuery = supabase
        .from('lms_completions')
        .select('participant_id, course_name, status, completed_at');

      if (selectedYear !== "all") {
        lmsQuery = lmsQuery.or(`course_name.ilike.%${selectedYear}%,completed_at.ilike.%${selectedYear}%`);
      }

      const { data: lmsData, error: lmsError } = await lmsQuery;
      if (lmsError) throw lmsError;

      setLmsCompletions(lmsData || []);
    } catch (error) {
      console.error('Error fetching Self-Paced LMS data:', error);
    } finally {
      setLoading(false);
    }
  }, [supabase, selectedYear]);

  useEffect(() => {
    fetchData();
  }, [fetchData, refreshTrigger]);

  const metrics = useMemo(() => {
    const distinctParticipants = new Set(lmsCompletions.map(c => c.participant_id));
    const totalLearners = distinctParticipants.size;

    const completedRecords = lmsCompletions.filter(c => 
      c.status?.toLowerCase().includes('completed') || c.status?.toLowerCase() === 'complete'
    );
    const totalCompletions = completedRecords.length;

    const participantsWithCompletions = new Set(completedRecords.map(c => c.participant_id));
    
    const avgPerUser = participantsWithCompletions.size > 0 
      ? totalCompletions / participantsWithCompletions.size 
      : 0;

    const participationRate = totalLearners > 0 
      ? (participantsWithCompletions.size / totalLearners) * 100 
      : 0;

    return {
      totalLearners,
      totalCompletions,
      avgPerUser: Number(avgPerUser.toFixed(2)),
      participationRate: Number(participationRate.toFixed(1))
    };
  }, [lmsCompletions]);

  const chartData = useMemo(() => {
    const counts = lmsCompletions.reduce((acc, curr) => {
      acc[curr.course_name] = (acc[curr.course_name] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // Top 10 courses
  }, [lmsCompletions]);

  if (loading) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header & Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-zinc-900 p-4 rounded-xl border shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
            <MousePointer2 className="h-5 w-5 text-purple-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold tracking-tight">Self-Paced (LMS) Dashboard</h2>
            <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">Independent Digital Learning Metrics</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-[10px] font-black text-muted-foreground uppercase tracking-wider">
            <Calendar className="h-3.5 w-3.5" /> Filter Year:
          </div>
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-[120px] h-9 text-xs font-bold border-zinc-200">
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

      {lmsCompletions.length === 0 ? (
        <Card className="border-dashed bg-muted/30 py-20 text-center">
          <CardContent>
            <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground/40 mb-4" />
            <h3 className="text-xl font-semibold">No LMS Data Found</h3>
            <p className="text-muted-foreground">Upload LMS reports to see metrics for {selectedYear === 'all' ? 'any year' : selectedYear}.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <MetricCard title="Total Learners" value={metrics.totalLearners} icon={Users} sub="Unique active users" color="border-t-purple-600" />
            <MetricCard title="Total Completions" value={metrics.totalCompletions} icon={CheckCircle} sub="Successful finishes" color="border-t-emerald-600" />
            <MetricCard title="Avg per User" value={metrics.avgPerUser} icon={Award} sub="Modules per active finisher" color="border-t-blue-600" />
            <MetricCard title="Participation Rate" value={`${metrics.participationRate}%`} icon={TrendingUp} sub="Users with &ge;1 completion" color="border-t-orange-600" />
          </div>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-sm font-black uppercase flex items-center gap-2">
                <CircleDot className="h-4 w-4 text-purple-600" /> Top Enrolled Modules
              </CardTitle>
              <CardDescription className="text-xs">Active participation across top 10 courses.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[400px] w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} layout="vertical" margin={{ left: 40, right: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                    <XAxis type="number" hide />
                    <YAxis 
                      dataKey="name" 
                      type="category" 
                      width={150} 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 10, fill: '#64748b' }} 
                    />
                    <Tooltip 
                      cursor={{ fill: '#f8fafc' }} 
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 8px 16px rgba(0,0,0,0.1)', fontSize: '11px' }}
                    />
                    <Bar dataKey="count" fill="#7c3aed" radius={[0, 4, 4, 0]} barSize={20}>
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#7c3aed' : '#a78bfa'} />
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

const MetricCard = ({ title, value, icon: Icon, sub, color }: any) => (
  <Card className={`border-t-4 ${color} shadow-sm overflow-hidden`}>
    <CardHeader className="flex flex-row items-center justify-between pb-1 space-y-0">
      <CardTitle className="text-[10px] font-black uppercase text-muted-foreground tracking-wider">{title}</CardTitle>
      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-black tabular-nums">{value}</div>
      <p className="text-[9px] text-muted-foreground font-medium mt-1">{sub}</p>
    </CardContent>
  </Card>
);

export default SelfPacedDashboard;
