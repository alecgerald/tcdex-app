"use client";

import React, { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, TrendingUp, TrendingDown, Users, Target } from 'lucide-react';

interface ExecutiveDashboardProps {
  refreshTrigger?: number | string;
}

interface DashboardMetrics {
  competencyAverages: Array<{ competency: string; average: number }>;
  readinessScore: number;
  topStrengths: Array<{ competency: string; average: number }>;
  bottomWeaknesses: Array<{ competency: string; average: number }>;
  departmentAverages: Array<Record<string, any>>;
  distributionData: Array<Record<string, any>>;
  coverage: number;
  totalParticipants: number;
}

const ExecutiveDashboard: React.FC<ExecutiveDashboardProps> = ({ refreshTrigger }) => {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [selectedCompetency, setSelectedCompetency] = useState<string>('Challenge');
  const supabase = createClient();

  const competencies = ['Challenge', 'Relationship', 'Self', 'HR', 'Strategic'];

  useEffect(() => {
    fetchMetrics();
  }, []);

  useEffect(() => {
    if (refreshTrigger) {
      setIsRefreshing(true);
      fetchMetrics();
    }
  }, [refreshTrigger]);

  const fetchMetrics = async () => {
    try {
      const { data: indicators, error: indError } = await supabase
        .from('indicator_responses')
        .select(`
          rating,
          competency,
          participant_id,
          participants ( department )
        `)
        .eq('assessment_type', 'pre');

      if (indError) throw indError;

      if (!indicators || indicators.length === 0) {
        setMetrics(null);
        setLoading(false);
        setIsRefreshing(false);
        return;
      }

      const compSums: Record<string, { sum: number; count: number; dist: Record<number, number> }> = {}; 
      const deptTotals: Record<string, Record<string, { sum: number; count: number }>> = {}; 
      const participantsSeen = new Set<string>();

      indicators.forEach((ind: any) => {
        const { rating, competency, participant_id, participants } = ind;
        const dept = participants?.department || 'Unknown';
        participantsSeen.add(participant_id);

        if (!compSums[competency]) {
          compSums[competency] = { sum: 0, count: 0, dist: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } };
        }
        compSums[competency].sum += rating;
        compSums[competency].count += 1;
        if (rating >= 1 && rating <= 5) {
          compSums[competency].dist[rating] += 1;
        }

        if (!deptTotals[dept]) deptTotals[dept] = {};
        if (!deptTotals[dept][competency]) deptTotals[dept][competency] = { sum: 0, count: 0 };
        deptTotals[dept][competency].sum += rating;
        deptTotals[dept][competency].count += 1;
      });

      const competencyAverages = competencies.map(name => ({
        competency: name,
        average: compSums[name]?.count > 0 ? compSums[name].sum / compSums[name].count : 0
      }));

      const readinessScore = competencyAverages.reduce((acc, curr) => acc + curr.average, 0) / competencies.length;

      const distributionData = competencies.map(name => {
        const stats = compSums[name];
        const total = stats?.count || 0;
        return {
          competency: name,
          '1': total > 0 ? (stats.dist[1] / total) * 100 : 0,
          '2': total > 0 ? (stats.dist[2] / total) * 100 : 0,
          '3': total > 0 ? (stats.dist[3] / total) * 100 : 0,
          '4': total > 0 ? (stats.dist[4] / total) * 100 : 0,
          '5': total > 0 ? (stats.dist[5] / total) * 100 : 0
        };
      });

      const sorted = [...competencyAverages].sort((a, b) => b.average - a.average);
      const topStrengths = sorted.slice(0, 2);
      const bottomWeaknesses = sorted.slice(-2).reverse();

      const departmentAverages = Object.keys(deptTotals).map(deptName => {
        const row: Record<string, any> = { department: deptName };
        competencies.forEach(c => {
          const stats = deptTotals[deptName][c];
          row[c] = stats ? stats.sum / stats.count : 0;
        });
        return row;
      });

      const ratedCount = indicators.filter((i: any) => i.rating > 1).length;
      const coverage = (ratedCount / indicators.length) * 100;

      setMetrics({
        competencyAverages,
        readinessScore,
        topStrengths,
        bottomWeaknesses,
        departmentAverages,
        distributionData,
        coverage,
        totalParticipants: participantsSeen.size
      });

    } catch (err) {
      console.error('Error computing metrics:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <h3 className="text-lg font-medium text-muted-foreground">Loading Leadership Insights...</h3>
        </div>
      </div>
    );
  }

  if (!metrics || metrics.readinessScore === 0) {
    return (
      <Card className="my-6 border-dashed bg-muted/30">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-4 rounded-full bg-muted p-4">
            <Target className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-semibold text-muted-foreground">No data yet</h2>
          <p className="max-w-sm text-muted-foreground">
            Upload the pre-assessment Excel file in the <strong>Import Excel</strong> section to populate this dashboard.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="relative space-y-6">
      {isRefreshing && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-background/60 backdrop-blur-[1px]">
          <div className="flex items-center gap-2 rounded-full bg-primary px-6 py-3 font-bold text-primary-foreground shadow-lg">
            <Loader2 className="h-4 w-4 animate-spin" />
            Updating Dashboard...
          </div>
        </div>
      )}

      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-primary">Executive Leadership Dashboard</h2>
          <p className="text-muted-foreground">Pre-Program Phase Assessment Insights</p>
        </div>
        <div className="flex gap-4 text-right text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span>Sample Size: <strong>{metrics.totalParticipants}</strong> managers</span>
          </div>
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            <span>Observation Coverage: <strong>{metrics.coverage.toFixed(1)}%</strong></span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        
        {/* 1. Readiness Score Card */}
        <Card className="flex flex-col items-center justify-center border-t-4 border-t-primary bg-muted/30 py-8 shadow-sm">
          <CardHeader className="p-0 pb-2">
            <CardDescription className="text-xs font-bold uppercase tracking-wider">Readiness Score</CardDescription>
          </CardHeader>
          <CardContent className="p-0 text-center">
            <div className="text-7xl font-extrabold text-primary">{metrics.readinessScore.toFixed(2)}</div>
            <p className="mt-4 text-sm text-muted-foreground">Cohort average across all 5 leadership competencies.</p>
          </CardContent>
        </Card>

        {/* 2. Competency Averages Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Competency Averages</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={metrics.competencyAverages} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="competency" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 5]} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                    formatter={(val: number) => [val.toFixed(2), 'Average']} 
                  />
                  <Bar dataKey="average" fill="#0046ab" radius={[4, 4, 0, 0]} barSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* 3. Strengths Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg text-green-600">
              <TrendingUp className="h-5 w-5" />
              Top Strengths
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart layout="vertical" data={metrics.topStrengths} margin={{ left: 20, right: 30, top: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                  <XAxis type="number" domain={[0, 5]} hide />
                  <YAxis dataKey="competency" type="category" width={100} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(val: number) => val.toFixed(2)} cursor={{ fill: '#f3f4f6' }} />
                  <Bar dataKey="average" fill="#16a34a" radius={[0, 4, 4, 0]} barSize={25} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* 4. Development Areas Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg text-destructive">
              <TrendingDown className="h-5 w-5" />
              Development Areas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart layout="vertical" data={metrics.bottomWeaknesses} margin={{ left: 20, right: 30, top: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                  <XAxis type="number" domain={[0, 5]} hide />
                  <YAxis dataKey="competency" type="category" width={100} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(val: number) => val.toFixed(2)} cursor={{ fill: '#f3f4f6' }} />
                  <Bar dataKey="average" fill="#dc2626" radius={[0, 4, 4, 0]} barSize={25} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* 5. Competency Distribution (Stacked Bar) */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Competency Maturity Distribution (%)</CardTitle>
            <CardDescription>Breakdown of ratings per competency</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[350px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={metrics.distributionData} margin={{ top: 20, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="competency" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis unit="%" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                    formatter={(val: number) => `${val.toFixed(1)}%`} 
                  />
                  <Legend iconType="circle" />
                  <Bar dataKey="1" stackId="a" fill="#ef4444" name="Not Observed" />
                  <Bar dataKey="2" stackId="a" fill="#f97316" name="Rarely" />
                  <Bar dataKey="3" stackId="a" fill="#eab308" name="Sometimes" />
                  <Bar dataKey="4" stackId="a" fill="#22c55e" name="Often" />
                  <Bar dataKey="5" stackId="a" fill="#3b82f6" name="Consistently" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* 6. Department Profile Bar Chart (with dropdown) */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <CardTitle className="text-lg">Department Leadership Profile</CardTitle>
                <CardDescription>Comparison across departments for selected competency</CardDescription>
              </div>
              <Select value={selectedCompetency} onValueChange={setSelectedCompetency}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Competency" />
                </SelectTrigger>
                <SelectContent>
                  {competencies.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[400px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={metrics.departmentAverages} margin={{ bottom: 70, top: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis 
                    dataKey="department" 
                    angle={-45} 
                    textAnchor="end" 
                    interval={0} 
                    tick={{ fontSize: 10 }} 
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis domain={[0, 5]} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                    formatter={(val: number) => [val.toFixed(2), selectedCompetency]} 
                  />
                  <Bar dataKey={selectedCompetency} fill="#0046ab" radius={[4, 4, 0, 0]} barSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
};

export default ExecutiveDashboard;