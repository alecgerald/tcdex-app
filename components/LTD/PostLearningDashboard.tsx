"use client";

import React, { useEffect, useState, useMemo } from 'react';
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
  CheckCircle2
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

interface PostLearningRecord {
  id: string;
  module_title: string;
  session_rating: number;
  facilitator_rating: number;
  feedback_likes: string;
  feedback_suggestions: string;
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
  const [selectedModule, setSelectedModule] = useState<string>("All Modules");
  const supabase = createClient();

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('post_learning_survey')
        .select('*');
      
      if (error) throw error;
      setRecords(data || []);
    } catch (err) {
      console.error('Error fetching survey data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const metrics = useMemo(() => {
    if (records.length === 0) return null;

    const totalResponses = records.length;
    const avgSession = records.reduce((acc, curr) => acc + (curr.session_rating || 0), 0) / totalResponses;
    const avgFacilitator = records.reduce((acc, curr) => acc + (curr.facilitator_rating || 0), 0) / totalResponses;

    const sessionDist = [5, 4, 3, 2, 1].map(r => ({
      rating: r,
      count: records.filter(d => d.session_rating === r).length
    }));

    const moduleStats: Record<string, { total: number, count: number }> = {};
    records.forEach(d => {
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
    const uniqueModules = Array.from(new Set(records.map(d => d.module_title))).sort();

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
  }, [records]);

  const filteredFeedback = useMemo(() => {
    const dataToFilter = selectedModule === "All Modules" 
      ? records 
      : records.filter(d => d.module_title === selectedModule);
    return [...dataToFilter].reverse();
  }, [records, selectedModule]);

  const getBarColor = (avg: number) => {
    if (avg >= 4.8) return '#10b981'; // Green
    if (avg >= 4.5) return '#f59e0b'; // Yellow/Orange
    return '#ef4444'; // Red
  };

  if (loading) {
    return (
      <div className="flex h-[450px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <Card className="border-dashed bg-zinc-50/50 py-24 text-center">
        <CardContent>
          <Zap className="mx-auto h-12 w-12 text-zinc-300 mb-4" />
          <h3 className="text-xl font-black uppercase tracking-tight text-zinc-400">No Survey Data Found</h3>
          <p className="text-xs font-medium text-zinc-400 uppercase mt-2">Upload the post-learning survey results to begin analysis</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      {/* 1. OVERVIEW METRICS */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card className="border-t-4 border-t-emerald-600 shadow-sm">
          <CardHeader className="pb-1 p-4">
            <CardDescription className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Total Responses</CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-emerald-600" />
              <div className="text-4xl font-black text-zinc-900">{metrics?.totalResponses}</div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-t-4 border-t-blue-600 shadow-sm">
          <CardHeader className="pb-1 p-4">
            <CardDescription className="text-[10px] font-black uppercase tracking-widest text-blue-600">Avg Session Rating</CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="flex items-center gap-3">
              <Star className="h-5 w-5 text-blue-600" />
              <div className="text-4xl font-black text-zinc-900">{metrics?.avgSession.toFixed(2)}</div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-t-4 border-t-violet-600 shadow-sm">
          <CardHeader className="pb-1 p-4">
            <CardDescription className="text-[10px] font-black uppercase tracking-widest text-violet-600">Avg Facilitator Rating</CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="flex items-center gap-3">
              <Award className="h-5 w-5 text-violet-600" />
              <div className="text-4xl font-black text-zinc-900">{metrics?.avgFacilitator.toFixed(2)}</div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-t-4 border-t-amber-500 shadow-sm">
          <CardHeader className="pb-1 p-4">
            <CardDescription className="text-[10px] font-black uppercase tracking-widest text-amber-500">Satisfaction Rate</CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="flex items-center gap-3">
              <ThumbsUp className="h-5 w-5 text-amber-500" />
              <div className="text-4xl font-black text-zinc-900">
                {(((metrics?.sessionDist.find(r => r.rating === 5)?.count || 0) + (metrics?.sessionDist.find(r => r.rating === 4)?.count || 0)) / (metrics?.totalResponses || 1) * 100).toFixed(0)}%
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 2. MAIN CHARTS SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Module Performance Bar Chart */}
        <Card className="shadow-sm border-zinc-100">
          <CardHeader className="p-6 pb-2">
            <CardTitle className="text-sm font-black uppercase tracking-tight text-zinc-800">Module Performance Comparison</CardTitle>
            <CardDescription className="text-[10px] font-bold uppercase text-zinc-400">Average effectiveness rating per module (Scale 0-5)</CardDescription>
          </CardHeader>
          <CardContent className="p-6 pt-0">
            <div className="h-[320px] mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={metrics?.moduleAverages} layout="vertical" margin={{ left: 40, right: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" domain={[0, 5]} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <YAxis 
                    dataKey="module" 
                    type="category" 
                    width={120} 
                    tick={{ fontSize: 9, fontWeight: 800, fill: '#475569' }} 
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip 
                    cursor={{ fill: '#f8fafc' }}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontSize: '11px', fontWeight: 'bold' }}
                  />
                  <Bar dataKey="average" radius={[0, 4, 4, 0]} barSize={18}>
                    {metrics?.moduleAverages.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={getBarColor(entry.average)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-6 mt-4 border-t pt-4">
              <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-[#10b981]" /><span className="text-[9px] font-black text-zinc-500 uppercase">Excellent (≥ 4.8)</span></div>
              <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-[#f59e0b]" /><span className="text-[9px] font-black text-zinc-500 uppercase">Good (4.5-4.79)</span></div>
              <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-[#ef4444]" /><span className="text-[9px] font-black text-zinc-500 uppercase">Needs Focus (&lt; 4.5)</span></div>
            </div>
          </CardContent>
        </Card>

        {/* Rating Distribution Pie */}
        <Card className="shadow-sm border-zinc-100">
          <CardHeader className="p-6 pb-2">
            <CardTitle className="text-sm font-black uppercase tracking-tight text-zinc-800">Session Effectiveness Distribution</CardTitle>
            <CardDescription className="text-[10px] font-bold uppercase text-zinc-400">Breakdown of star ratings across all modules</CardDescription>
          </CardHeader>
          <CardContent className="p-6 pt-0">
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={metrics?.sessionDist}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={100}
                    paddingAngle={8}
                    dataKey="count"
                    nameKey="rating"
                  >
                    {metrics?.sessionDist.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={RATING_COLORS[entry.rating as keyof typeof RATING_COLORS]} stroke="none" />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                    formatter={(value, name) => [`${value} Responses`, `${name} Star Rating`]}
                  />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 3. QUALITATIVE INSIGHTS SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Executive Summary */}
        <Card className="bg-zinc-50/50 border-zinc-200 shadow-none">
          <CardHeader className="p-6">
            <CardTitle className="text-sm font-black uppercase flex items-center gap-2 text-zinc-800"><Lightbulb className="h-4 w-4 text-amber-500" /> Executive Summary</CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-8">
            <p className="text-xs text-zinc-600 leading-relaxed font-medium italic">
              “The i-ELEVATE Essentials Program demonstrates excellent overall effectiveness, with both session and facilitator ratings averaging above 4.7/5. Participants value engaging facilitation and practical content, indicating strong alignment with real-world application. While performance is consistently high, select modules such as Recruitment & Hiring present opportunities for enhancement through increased interactivity and applied learning strategies. Overall, the program is high-impact, well-received, and scalable, with clear opportunities for continuous improvement.”
            </p>
          </CardContent>
        </Card>

        {/* Strategic Insights */}
        <Card className="bg-[#0046ab]/5 border-[#0046ab]/10 shadow-none">
          <CardHeader className="p-6">
            <CardTitle className="text-sm font-black uppercase flex items-center gap-2 text-[#0046ab]"><TrendingUp className="h-4 w-4" /> Strategic Insights for Leadership</CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-8 space-y-4">
            <div className="flex items-start gap-3">
              <div className="mt-1 bg-[#0046ab]/10 p-1 rounded-md"><CheckCircle2 className="h-3 w-3 text-[#0046ab]" /></div>
              <p className="text-xs text-zinc-700 font-bold leading-tight"><strong>Program Effectiveness:</strong> Overall rating close to 4.8/5 indicates high ROI on learning investment.</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="mt-1 bg-[#0046ab]/10 p-1 rounded-md"><CheckCircle2 className="h-3 w-3 text-[#0046ab]" /></div>
              <p className="text-xs text-zinc-700 font-bold leading-tight"><strong>Learning Impact:</strong> Strong facilitator scores suggest effective knowledge transfer and engagement.</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="mt-1 bg-[#0046ab]/10 p-1 rounded-md"><CheckCircle2 className="h-3 w-3 text-[#0046ab]" /></div>
              <p className="text-xs text-zinc-700 font-bold leading-tight"><strong>Continuous Improvement Opportunity:</strong> Focus on enhancing mid-tier modules; shift toward experiential learning (case-based, discussion-heavy formats).</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 4. PERFORMANCE BREAKDOWN SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Module Performance Lists */}
        <Card className="shadow-sm border-zinc-100">
          <CardHeader className="p-6">
            <CardTitle className="text-sm font-black uppercase flex items-center gap-2 text-zinc-800"><Award className="h-5 w-5 text-emerald-600" /> Module Performance Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-8 space-y-8">
            <div>
              <p className="text-[10px] font-black uppercase text-emerald-600 mb-4 tracking-widest flex items-center gap-2">
                Top Performing (Avg ≥ 4.9) <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-50 border-none text-[9px] px-1.5 h-4">Excellent</Badge>
              </p>
              <div className="space-y-5">
                {metrics?.topModules.length ? metrics.topModules.map(m => (
                  <div key={m.module} className="space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-black text-zinc-700 uppercase tracking-tight">
                      <span className="truncate max-w-[240px]">{m.module}</span>
                      <span className="text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">{m.average}</span>
                    </div>
                    <div className="h-2 w-full bg-zinc-100 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full transition-all duration-1000" style={{ width: `${(m.average / 5) * 100}%` }} />
                    </div>
                  </div>
                )) : <p className="text-xs text-muted-foreground italic font-medium">No modules achieved the top performance threshold.</p>}
              </div>
            </div>

            <div className="pt-2">
              <p className="text-[10px] font-black uppercase text-amber-600 mb-4 tracking-widest flex items-center gap-2">
                Improvement Opportunities (Avg &lt; 4.7) <Badge className="bg-amber-50 text-amber-700 hover:bg-amber-50 border-none text-[9px] px-1.5 h-4">Priority</Badge>
              </p>
              <div className="space-y-5">
                {metrics?.improvementModules.length ? metrics.improvementModules.map(m => (
                  <div key={m.module} className="space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-black text-zinc-700 uppercase tracking-tight">
                      <span className="truncate max-w-[240px]">{m.module}</span>
                      <span className="text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md">{m.average}</span>
                    </div>
                    <div className="h-2 w-full bg-zinc-100 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-500 rounded-full transition-all duration-1000" style={{ width: `${(m.average / 5) * 100}%` }} />
                    </div>
                  </div>
                )) : <p className="text-xs text-muted-foreground italic font-medium text-center py-4 bg-zinc-50 rounded-xl border border-dashed">No modules currently identified for critical improvement.</p>}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Thematic Feedback Analysis */}
        <Card className="shadow-sm border-zinc-100">
          <CardHeader className="p-6">
            <CardTitle className="text-sm font-black uppercase flex items-center gap-2 text-zinc-800"><MessageSquare className="h-5 w-5 text-blue-600" /> Thematic Feedback Analysis</CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-8 space-y-8">
            <div>
              <p className="text-[10px] font-black uppercase text-blue-600 mb-4 tracking-widest flex items-center gap-2">What Participants Liked Most</p>
              <ul className="space-y-4">
                <li className="flex items-start gap-3 group">
                  <div className="mt-1 h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0 ring-4 ring-blue-50" />
                  <span className="text-[11px] text-zinc-600 font-bold leading-relaxed">Engaging and knowledgeable facilitators who create a safe, high-energy learning environment.</span>
                </li>
                <li className="flex items-start gap-3 group">
                  <div className="mt-1 h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0 ring-4 ring-blue-50" />
                  <span className="text-[11px] text-zinc-600 font-bold leading-relaxed">Practical and applicable content that can be immediately leveraged in day-to-day operations.</span>
                </li>
                <li className="flex items-start gap-3 group">
                  <div className="mt-1 h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0 ring-4 ring-blue-50" />
                  <span className="text-[11px] text-zinc-600 font-bold leading-relaxed">Interactive discussions and real-life examples shared among cross-functional cohorts.</span>
                </li>
              </ul>
            </div>

            <div>
              <p className="text-[10px] font-black uppercase text-violet-600 mb-4 tracking-widest flex items-center gap-2">Areas for Improvement</p>
              <ul className="space-y-4">
                <li className="flex items-start gap-3 group">
                  <div className="mt-1 h-1.5 w-1.5 rounded-full bg-violet-500 shrink-0 ring-4 ring-violet-50" />
                  <span className="text-[11px] text-zinc-600 font-bold leading-relaxed">More time allocated for breakout discussions and specialized Q&A sessions.</span>
                </li>
                <li className="flex items-start gap-3 group">
                  <div className="mt-1 h-1.5 w-1.5 rounded-full bg-violet-500 shrink-0 ring-4 ring-violet-50" />
                  <span className="text-[11px] text-zinc-600 font-bold leading-relaxed">Integration of more complex case studies and real-world failure analysis scenarios.</span>
                </li>
                <li className="flex items-start gap-3 group">
                  <div className="mt-1 h-1.5 w-1.5 rounded-full bg-violet-500 shrink-0 ring-4 ring-violet-50" />
                  <span className="text-[11px] text-zinc-600 font-bold leading-relaxed">Slight pacing adjustments for technical modules perceived as information-dense.</span>
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 5. FILTERED FEEDBACK TABLE SECTION */}
      <Card className="shadow-sm border-zinc-100 overflow-hidden">
        <CardHeader className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b bg-zinc-50/30">
          <div>
            <CardTitle className="text-sm font-black uppercase text-zinc-800 tracking-tight">Recent Feedback Preview</CardTitle>
            <CardDescription className="text-[10px] font-bold uppercase text-zinc-400">Direct comments from learners for deep context analysis</CardDescription>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-[10px] font-black uppercase text-zinc-400">
              <Filter className="h-3 w-3" /> Filter:
            </div>
            <Select value={selectedModule} onValueChange={setSelectedModule}>
              <SelectTrigger className="w-full sm:w-[260px] text-[10px] font-black uppercase h-9 border-zinc-200 bg-white shadow-none focus:ring-0 transition-all hover:border-[#0046ab]">
                <SelectValue placeholder="All Modules" />
              </SelectTrigger>
              <SelectContent className="border-zinc-200 shadow-xl">
                <SelectItem value="All Modules" className="text-[10px] font-black uppercase py-2">All Modules</SelectItem>
                {metrics?.uniqueModules.map((module) => (
                  <SelectItem key={module} value={module} className="text-[10px] font-black uppercase py-2">
                    {module}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-auto max-h-[500px]">
            <Table>
              <TableHeader className="bg-white sticky top-0 z-10 border-b shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
                <TableRow>
                  <TableHead className="w-[200px] text-[10px] font-black uppercase tracking-widest text-zinc-500 py-4 px-6">Module Title</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-500 py-4 px-6">Key Strengths</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-500 py-4 px-6">Suggestions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredFeedback.length > 0 ? (
                  filteredFeedback.map((record) => (
                    <TableRow key={record.id} className="hover:bg-[#0046ab]/[0.02] transition-colors border-b last:border-0 group">
                      <TableCell className="font-black text-[10px] text-zinc-800 align-top py-4 px-6 uppercase tracking-tight group-hover:text-[#0046ab] transition-colors">
                        {record.module_title}
                      </TableCell>
                      <TableCell className="text-[11px] text-zinc-500 leading-relaxed max-w-md py-4 px-6 font-medium">
                        <div className="line-clamp-3 text-ellipsis">
                          {record.feedback_likes || <span className="text-zinc-300 italic font-normal">No feedback captured</span>}
                        </div>
                      </TableCell>
                      <TableCell className="text-[11px] text-zinc-500 leading-relaxed max-w-md py-4 px-6 font-medium">
                        <div className="line-clamp-3 text-ellipsis">
                          {record.feedback_suggestions || <span className="text-zinc-300 italic font-normal">No suggestions captured</span>}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={3} className="h-48 text-center bg-zinc-50/20">
                      <div className="flex flex-col items-center justify-center text-muted-foreground gap-3">
                        <div className="p-3 bg-white rounded-full border shadow-sm">
                          <Filter className="h-5 w-5 opacity-20" />
                        </div>
                        <p className="text-[10px] font-black uppercase tracking-widest opacity-40">No records found for selected module</p>
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
  );
};

export default PostLearningDashboard;
