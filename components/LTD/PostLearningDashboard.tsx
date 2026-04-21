"use client";

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Loader2, 
  Users, 
  Star, 
  MessageSquare, 
  ThumbsUp, 
  TrendingUp,
  Award,
  Zap,
  Lightbulb,
  ArrowRight,
  Filter,
  CheckCircle2,
  Download
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface PostLearningRecord {
  id: string;
  module_title: string;
  session_rating: number;
  facilitator_rating: number;
  feedback_likes: string;
  feedback_suggestions: string;
  year: number;
  cohort: string;
}

const RATING_COLORS = {
  5: '#10b981',
  4: '#3b82f6',
  3: '#f59e0b',
  2: '#f97316',
  1: '#ef4444'
};

const PostLearningDashboard: React.FC = () => {
  const [records, setRecords] = useState<PostLearningRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [selectedModule, setSelectedModule] = useState<string>("All Modules");
  
  // Year & Cohort Selection
  const [availableSessions, setAvailableSessions] = useState<{year: number, cohort: string}[]>([]);
  const [selectedSession, setSelectedSession] = useState<string>("All Sessions");

  const supabase = createClient();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('post_learning_survey')
        .select('*');
      
      if (error) throw error;
      const allRecords = data || [];
      setRecords(allRecords);

      // Extract unique year + cohort combinations
      const sessions = allRecords.reduce((acc: {year: number, cohort: string}[], curr) => {
        if (curr.year && curr.cohort) {
          const exists = acc.find(s => s.year === curr.year && s.cohort === curr.cohort);
          if (!exists) acc.push({ year: curr.year, cohort: curr.cohort });
        }
        return acc;
      }, []);
      
      // Sort by year desc, then cohort
      sessions.sort((a, b) => {
        if (b.year !== a.year) return b.year - a.year;
        return a.cohort.localeCompare(b.cohort);
      });

      setAvailableSessions(sessions);
      
      if (sessions.length > 0 && selectedSession === "All Sessions") {
        // Default to the most recent session
        setSelectedSession(`${sessions[0].year}|${sessions[0].cohort}`);
      }

    } catch (err) {
      console.error('Error fetching survey data:', err);
    } finally {
      setLoading(false);
    }
  }, [supabase, selectedSession]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredRecords = useMemo(() => {
    let result = records;

    if (selectedSession !== "All Sessions") {
      const [y, c] = selectedSession.split('|');
      result = result.filter(r => r.year === parseInt(y) && r.cohort === c);
    }

    return result;
  }, [records, selectedSession]);

  const metrics = useMemo(() => {
    if (filteredRecords.length === 0) return null;

    const totalResponses = filteredRecords.length;
    const avgSession = filteredRecords.reduce((acc, curr) => acc + (curr.session_rating || 0), 0) / totalResponses;
    const avgFacilitator = filteredRecords.reduce((acc, curr) => acc + (curr.facilitator_rating || 0), 0) / totalResponses;

    const sessionDist = [5, 4, 3, 2, 1].map(r => ({
      rating: r,
      count: filteredRecords.filter(d => d.session_rating === r).length
    }));

    const moduleStats: Record<string, { total: number, count: number }> = {};
    filteredRecords.forEach(d => {
      if (!moduleStats[d.module_title]) moduleStats[d.module_title] = { total: 0, count: 0 };
      moduleStats[d.module_title].total += d.session_rating || 0;
      moduleStats[d.module_title].count += 1;
    });

    const moduleAverages = Object.entries(moduleStats).map(([title, stats]) => ({
      module: title,
      average: Number((stats.total / stats.count).toFixed(2))
    })).sort((a, b) => b.average - a.average);

    const topModules = moduleAverages.filter(m => m.average >= 4.9);
    const improvementModules = moduleAverages.filter(m => m.average < 4.7);
    const uniqueModules = Array.from(new Set(filteredRecords.map(d => d.module_title))).sort();

    return {
      totalResponses,
      avgSession,
      avgFacilitator,
      sessionDist,
      moduleAverages,
      topModules,
      improvementModules,
      uniqueModules
    };
  }, [filteredRecords]);

  const handleExportPDF = useCallback(async () => {
    if (!metrics) return;
    setIsExporting(true);
    const toastId = toast.loading("Generating vector PDF report...");

    const payload = {
      title: "Post-Learning Survey Dashboard",
      description: `Analysis of learner feedback and facilitator performance for ${selectedSession === 'All Sessions' ? 'All Sessions' : selectedSession.replace('|', ' ')}.`,
      date: new Date().toLocaleDateString(),
      kpis: [
        { title: "Total Responses", value: metrics.totalResponses, description: "Total surveys collected." },
        { title: "Avg Session Rating", value: metrics.avgSession.toFixed(2), description: "Out of 5.0." },
        { title: "Avg Facilitator", value: metrics.avgFacilitator.toFixed(2), description: "Out of 5.0." },
        { title: "Satisfaction Rate", value: `${(((metrics.sessionDist.find(r => r.rating === 5)?.count || 0) + (metrics.sessionDist.find(r => r.rating === 4)?.count || 0)) / (metrics.totalResponses || 1) * 100).toFixed(0)}%`, description: "4 and 5 star ratings." }
      ],
      charts: [
        {
          title: "Module Performance Comparison",
          data: metrics.moduleAverages.map(m => ({
            label: m.module,
            value: m.average,
            max: 5,
            color: m.average >= 4.8 ? "#10b981" : m.average >= 4.5 ? "#f59e0b" : "#ef4444"
          }))
        }
      ],
      tables: [
        {
          title: "Recent Learner Feedback",
          headers: ["Module Title", "Key Strengths", "Suggestions"],
          rows: filteredRecords.slice(0, 15).map(r => [
            r.module_title,
            r.feedback_likes?.substring(0, 50) + "...",
            r.feedback_suggestions?.substring(0, 50) + "..."
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
      a.download = `Post_Learning_Analysis_${new Date().toISOString().split('T')[0]}.pdf`;
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
  }, [metrics, filteredRecords, selectedSession]);

  const filteredFeedback = useMemo(() => {
    const dataToFilter = selectedModule === "All Modules" 
      ? filteredRecords 
      : filteredRecords.filter(d => d.module_title === selectedModule);
    return [...dataToFilter].reverse();
  }, [filteredRecords, selectedModule]);

  const getBarColor = (avg: number) => {
    if (avg >= 4.8) return '#10b981'; // Green
    if (avg >= 4.5) return '#f59e0b'; // Yellow/Orange
    return '#ef4444'; // Red
  };

  if (loading) {
    return (
      <div className="flex h-[450px] items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <Card className="border-dashed bg-zinc-50/50 py-32 text-center rounded-3xl">
        <CardContent>
          <Zap className="mx-auto h-16 w-16 text-zinc-300 mb-6" />
          <h3 className="text-2xl font-black uppercase tracking-tight text-zinc-400">No Survey Data Found</h3>
          <p className="text-sm font-bold text-zinc-400 uppercase mt-3">Upload the post-learning survey results to begin analysis</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-10 animate-in fade-in duration-700 pb-12 px-4">
      {/* Selection & Export Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4 bg-white p-2 rounded-2xl border shadow-sm">
          <div className="flex items-center gap-2 text-xs font-black uppercase text-zinc-400 px-3">
            <TrendingUp className="h-4 w-4 text-[#0046ab]" /> Session:
          </div>
          <Select value={selectedSession} onValueChange={setSelectedSession}>
            <SelectTrigger className="w-[280px] text-xs font-black uppercase h-10 border-none bg-zinc-50 shadow-none focus:ring-0">
              <SelectValue placeholder="All Sessions" />
            </SelectTrigger>
            <SelectContent className="border-zinc-200 shadow-xl">
              <SelectItem value="All Sessions" className="text-xs font-black uppercase py-2.5">All Sessions</SelectItem>
              {availableSessions.map((s) => (
                <SelectItem key={`${s.year}|${s.cohort}`} value={`${s.year}|${s.cohort}`} className="text-xs font-black uppercase py-2.5">
                  {s.cohort} ({s.year})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button 
          onClick={handleExportPDF}
          variant="outline"
          disabled={isExporting}
          className="h-11 px-6 rounded-xl border-zinc-200 text-zinc-600 font-bold text-sm uppercase flex items-center gap-2 hover:bg-zinc-50 transition-all shadow-sm"
        >
          {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4 text-[#0046ab]" />}
          Export PDF
        </Button>
      </div>

      <div id="pdf-content-postlearning" className="space-y-10">
        {/* 1. OVERVIEW METRICS */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
          <Card className="border-t-4 border-t-emerald-600 shadow-sm rounded-2xl overflow-hidden">
            <CardHeader className="pb-2 p-6">
              <CardDescription className="text-xs font-black uppercase tracking-widest text-emerald-600">Total Responses</CardDescription>
            </CardHeader>
            <CardContent className="px-6 pb-6">
              <div className="flex items-center gap-4">
                <Users className="h-6 w-6 text-emerald-600" />
                <div className="text-4xl font-black text-zinc-900">{metrics?.totalResponses}</div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-t-4 border-t-blue-600 shadow-sm rounded-2xl overflow-hidden">
            <CardHeader className="pb-2 p-6">
              <CardDescription className="text-xs font-black uppercase tracking-widest text-blue-600">Avg Session Rating</CardDescription>
            </CardHeader>
            <CardContent className="px-6 pb-6">
              <div className="flex items-center gap-4">
                <Star className="h-6 w-6 text-blue-600" />
                <div className="text-4xl font-black text-zinc-900">{metrics?.avgSession.toFixed(2)}</div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-t-4 border-t-violet-600 shadow-sm rounded-2xl overflow-hidden">
            <CardHeader className="pb-2 p-6">
              <CardDescription className="text-xs font-black uppercase tracking-widest text-violet-600">Avg Facilitator Rating</CardDescription>
            </CardHeader>
            <CardContent className="px-6 pb-6">
              <div className="flex items-center gap-4">
                <Award className="h-6 w-6 text-violet-600" />
                <div className="text-4xl font-black text-zinc-900">{metrics?.avgFacilitator.toFixed(2)}</div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-t-4 border-t-amber-500 shadow-sm rounded-2xl overflow-hidden">
            <CardHeader className="pb-2 p-6">
              <CardDescription className="text-xs font-black uppercase tracking-widest text-amber-500">Satisfaction Rate</CardDescription>
            </CardHeader>
            <CardContent className="px-6 pb-6">
              <div className="flex items-center gap-4">
                <ThumbsUp className="h-6 w-6 text-amber-500" />
                <div className="text-4xl font-black text-zinc-900">
                  {(((metrics?.sessionDist.find(r => r.rating === 5)?.count || 0) + (metrics?.sessionDist.find(r => r.rating === 4)?.count || 0)) / (metrics?.totalResponses || 1) * 100).toFixed(0)}%
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 2. MAIN CHARTS SECTION */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Module Performance Bar Chart */}
          <Card className="shadow-sm border-zinc-100 rounded-3xl overflow-hidden">
            <CardHeader className="p-8 pb-4">
              <CardTitle className="text-xl font-black uppercase tracking-tight text-zinc-800">Module Performance Comparison</CardTitle>
              <CardDescription className="text-xs font-bold uppercase text-zinc-400">Average effectiveness rating per module (Scale 0-5)</CardDescription>
            </CardHeader>
            <CardContent className="p-8 pt-0">
              <div className="h-[400px] mt-6">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={metrics?.moduleAverages} layout="vertical" margin={{ left: 60, right: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                    <XAxis type="number" domain={[0, 5]} axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: 600, fill: '#94a3b8' }} />
                    <YAxis 
                      dataKey="module" 
                      type="category" 
                      width={140} 
                      tick={{ fontSize: 11, fontWeight: 800, fill: '#475569' }} 
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip 
                      cursor={{ fill: '#f8fafc' }}
                      contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', fontSize: '13px', fontWeight: 'bold' }}
                    />
                    <Bar dataKey="average" radius={[0, 6, 6, 0]} barSize={24}>
                      {metrics?.moduleAverages.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={getBarColor(entry.average)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap justify-center gap-8 mt-8 border-t pt-6">
                <div className="flex items-center gap-3"><div className="w-3.5 h-3.5 rounded-full bg-[#10b981]" /><span className="text-[11px] font-black text-zinc-500 uppercase">Excellent (≥ 4.8)</span></div>
                <div className="flex items-center gap-3"><div className="w-3.5 h-3.5 rounded-full bg-[#f59e0b]" /><span className="text-[11px] font-black text-zinc-500 uppercase">Good (4.5-4.79)</span></div>
                <div className="flex items-center gap-3"><div className="w-3.5 h-3.5 rounded-full bg-[#ef4444]" /><span className="text-[11px] font-black text-zinc-500 uppercase">Needs Focus (&lt; 4.5)</span></div>
              </div>
            </CardContent>
          </Card>

          {/* Rating Distribution Pie */}
          <Card className="shadow-sm border-zinc-100 rounded-3xl overflow-hidden">
            <CardHeader className="p-8 pb-4">
              <CardTitle className="text-xl font-black uppercase tracking-tight text-zinc-800">Session Effectiveness Distribution</CardTitle>
              <CardDescription className="text-xs font-bold uppercase text-zinc-400">Breakdown of star ratings across all modules</CardDescription>
            </CardHeader>
            <CardContent className="p-8 pt-0">
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={metrics?.sessionDist}
                      cx="50%"
                      cy="50%"
                      innerRadius={90}
                      outerRadius={130}
                      paddingAngle={8}
                      dataKey="count"
                      nameKey="rating"
                    >
                      {metrics?.sessionDist.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={RATING_COLORS[entry.rating as keyof typeof RATING_COLORS]} stroke="none" />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', fontSize: '13px' }}
                      formatter={(value, name) => [`${value} Responses`, `${name} Star Rating`]}
                    />
                    <Legend verticalAlign="bottom" height={40} iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', paddingTop: '20px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 3. PERFORMANCE BREAKDOWN SECTION */}
        <Card className="shadow-sm border-zinc-100 rounded-3xl overflow-hidden">
          <CardHeader className="p-8">
            <CardTitle className="text-xl font-black uppercase flex items-center gap-3 text-zinc-800"><Award className="h-6 w-6 text-emerald-600" /> Module Performance Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="px-8 pb-10 space-y-10">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
              <div>
                <p className="text-xs font-black uppercase text-emerald-600 mb-6 tracking-widest flex items-center gap-3">
                  Top Performing (Avg ≥ 4.9) <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-50 border-none text-[10px] px-2 h-5 font-black uppercase">Excellent</Badge>
                </p>
                <div className="space-y-6">
                  {metrics?.topModules.length ? metrics.topModules.map(m => (
                    <div key={m.module} className="space-y-3">
                      <div className="flex items-center justify-between text-xs font-black text-zinc-700 uppercase tracking-tight">
                        <span className="truncate max-w-[280px]">{m.module}</span>
                        <span className="text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-md">{m.average}</span>
                      </div>
                      <div className="h-3 w-full bg-zinc-100 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full transition-all duration-1000" style={{ width: `${(m.average / 5) * 100}%` }} />
                      </div>
                    </div>
                  )) : <p className="text-base text-muted-foreground italic font-medium leading-relaxed">No modules achieved the top performance threshold.</p>}
                </div>
              </div>

              <div>
                <p className="text-xs font-black uppercase text-amber-600 mb-6 tracking-widest flex items-center gap-3">
                  Improvement Opportunities (Avg &lt; 4.7) <Badge className="bg-amber-50 text-amber-700 hover:bg-amber-50 border-none text-[10px] px-2 h-5 font-black uppercase">Priority</Badge>
                </p>
                <div className="space-y-6">
                  {metrics?.improvementModules.length ? metrics.improvementModules.map(m => (
                    <div key={m.module} className="space-y-3">
                      <div className="flex items-center justify-between text-xs font-black text-zinc-700 uppercase tracking-tight">
                        <span className="truncate max-w-[280px]">{m.module}</span>
                        <span className="text-amber-600 bg-amber-50 px-2.5 py-1 rounded-md">{m.average}</span>
                      </div>
                      <div className="h-3 w-full bg-zinc-100 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full transition-all duration-1000" style={{ width: `${(m.average / 5) * 100}%` }} />
                      </div>
                    </div>
                  )) : <p className="text-base text-muted-foreground italic font-medium text-center py-8 bg-zinc-50 rounded-2xl border border-dashed leading-relaxed">No modules currently identified for critical improvement.</p>}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 4. FILTERED FEEDBACK TABLE SECTION */}
        <Card className="shadow-sm border-zinc-100 rounded-3xl overflow-hidden">
          <CardHeader className="p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6 border-b bg-zinc-50/30">
            <div>
              <CardTitle className="text-xl font-black uppercase text-zinc-800 tracking-tight">Recent Feedback Preview</CardTitle>
              <CardDescription className="text-xs font-bold uppercase text-zinc-400">Direct comments from learners for deep context analysis</CardDescription>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-xs font-black uppercase text-zinc-400">
                <Filter className="h-4 w-4" /> Filter:
              </div>
              <Select value={selectedModule} onValueChange={setSelectedModule}>
                <SelectTrigger className="w-full sm:w-[300px] text-xs font-black uppercase h-11 border-zinc-200 bg-white shadow-none focus:ring-0 transition-all hover:border-[#0046ab]">
                  <SelectValue placeholder="All Modules" />
                </SelectTrigger>
                <SelectContent className="border-zinc-200 shadow-xl">
                  <SelectItem value="All Modules" className="text-xs font-black uppercase py-2.5">All Modules</SelectItem>
                  {metrics?.uniqueModules.map((module) => (
                    <SelectItem key={module} value={module} className="text-xs font-black uppercase py-2.5">
                      {module}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-auto max-h-[600px]">
              <Table>
                <TableHeader className="bg-white sticky top-0 z-10 border-b shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
                  <TableRow>
                    <TableHead className="w-[240px] text-xs font-black uppercase tracking-widest text-zinc-500 py-6 px-8">Module Title</TableHead>
                    <TableHead className="text-xs font-black uppercase tracking-widest text-zinc-500 py-6 px-8">Key Strengths</TableHead>
                    <TableHead className="text-xs font-black uppercase tracking-widest text-zinc-500 py-6 px-8">Suggestions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredFeedback.length > 0 ? (
                    filteredFeedback.map((record) => (
                      <TableRow key={record.id} className="hover:bg-[#0046ab]/[0.02] transition-colors border-b last:border-0 group">
                        <TableCell className="font-black text-xs text-zinc-800 align-top py-6 px-8 uppercase tracking-tight group-hover:text-[#0046ab] transition-colors leading-relaxed">
                          {record.module_title}
                        </TableCell>
                        <TableCell className="text-base text-zinc-500 leading-relaxed max-w-md py-6 px-8 font-medium">
                          <div className="line-clamp-4 text-ellipsis">
                            {record.feedback_likes || <span className="text-zinc-300 italic font-normal">No feedback captured</span>}
                          </div>
                        </TableCell>
                        <TableCell className="text-base text-zinc-500 leading-relaxed max-w-md py-6 px-8 font-medium">
                          <div className="line-clamp-4 text-ellipsis">
                            {record.feedback_suggestions || <span className="text-zinc-300 italic font-normal">No suggestions captured</span>}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={3} className="h-60 text-center bg-zinc-50/20">
                        <div className="flex flex-col items-center justify-center text-muted-foreground gap-4">
                          <div className="p-4 bg-white rounded-full border shadow-sm">
                            <Filter className="h-6 w-6 opacity-20" />
                          </div>
                          <p className="text-xs font-black uppercase tracking-widest opacity-40">No records found for selected module</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PostLearningDashboard;
