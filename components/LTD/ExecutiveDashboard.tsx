"use client";

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { createClient } from '@/utils/supabase/client';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, Cell
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Loader2, 
  TrendingUp, 
  Users, 
  Target, 
  Info, 
  ArrowUpRight, 
  ArrowDownRight,
  Minus,
  Building2
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface ExecutiveDashboardProps {
  refreshTrigger?: number | string;
}

interface Participant {
  id: string;
  name: string;
  email: string;
  department: string;
}

interface CompetencyScore {
  competency: string;
  average_score: number;
  assessment_type: 'pre' | 'post';
}

interface ChartData {
  competency: string;
  pre: number;
  post: number;
  delta: number;
}

type ViewMode = 'pre' | 'post' | 'compare';

const ExecutiveDashboard: React.FC<ExecutiveDashboardProps> = ({ refreshTrigger }) => {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [selectedParticipant, setSelectedParticipant] = useState<Participant | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('pre');
  const [scores, setScores] = useState<CompetencyScore[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  
  const supabase = createClient();
  const competencies = ['Challenge', 'Relationship', 'Self', 'HR', 'Strategic'];

  // 1. Fetch Participants on Mount and Refresh
  useEffect(() => {
    const fetchParticipants = async () => {
      const { data, error } = await supabase
        .from('participants')
        .select('id, name, email, department')
        .order('name');

      if (!error && data) {
        setParticipants(data);
        // If data was reset (no participants), clear selection
        if (data.length === 0) {
          setSelectedParticipant(null);
          setScores([]);
        } else if (selectedParticipant && !data.some(p => p.id === selectedParticipant.id)) {
          // If the selected participant is no longer in the list after a partial refresh
          setSelectedParticipant(null);
          setScores([]);
        }
      }
      setLoading(false);
    };
    fetchParticipants();
  }, [supabase, refreshTrigger]);

  // 2. Data Fetching Function
  const fetchParticipantData = useCallback(async (participantId: string) => {
    setIsRefreshing(true);
    try {
      const { data, error } = await supabase
        .from('competency_scores')
        .select('competency, average_score, assessment_type')
        .eq('participant_id', participantId);

      if (error) throw error;
      setScores(data || []);
    } catch (err) {
      console.error('Error fetching participant scores:', err);
    } finally {
      setIsRefreshing(false);
    }
  }, [supabase]);

  useEffect(() => {
    if (selectedParticipant) {
      fetchParticipantData(selectedParticipant.id);
    }
  }, [selectedParticipant, refreshTrigger, fetchParticipantData]);

  // 3. Process Data for UI
  const processedData = useMemo(() => {
    const data: ChartData[] = competencies.map(c => {
      const pre = scores.find(s => s.competency === c && s.assessment_type === 'pre')?.average_score || 0;
      const post = scores.find(s => s.competency === c && s.assessment_type === 'post')?.average_score || 0;
      return {
        competency: c,
        pre: Number(pre.toFixed(2)),
        post: Number(post.toFixed(2)),
        delta: Number((post - pre).toFixed(2))
      };
    });

    const currentScores = data.map(d => (viewMode === 'post' ? d.post : d.pre)).filter(s => s > 0);
    const readinessScore = currentScores.length > 0 
      ? currentScores.reduce((a, b) => a + b, 0) / currentScores.length 
      : 0;

    const postScores = data.map(d => d.post).filter(s => s > 0);
    const postReadinessScore = postScores.length > 0 
      ? postScores.reduce((a, b) => a + b, 0) / postScores.length 
      : 0;

    // Strengths/Weaknesses based on viewMode
    const sorted = [...data]
      .filter(d => (viewMode === 'post' ? d.post > 0 : d.pre > 0))
      .sort((a, b) => (viewMode === 'post' ? b.post - a.post : b.pre - a.pre));
    
    return {
      chartData: data,
      readinessScore,
      postReadinessScore,
      topStrengths: sorted.slice(0, 2),
      developmentAreas: sorted.slice(-2).reverse()
    };
  }, [scores, viewMode, competencies]);

  if (loading) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#0046ab]" />
      </div>
    );
  }

  const hasDataForMode = (mode: ViewMode) => {
    if (mode === 'pre') return processedData.chartData.some(d => d.pre > 0);
    if (mode === 'post') return processedData.chartData.some(d => d.post > 0);
    if (mode === 'compare') return processedData.chartData.some(d => d.pre > 0) && processedData.chartData.some(d => d.post > 0);
    return false;
  };

  return (
    <div className="relative space-y-6">
      {/* Header Controls */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between bg-white dark:bg-zinc-900 p-4 rounded-xl border shadow-sm">
        <div className="flex flex-1 flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="w-full sm:w-[300px]">
            <label className="text-[10px] font-bold uppercase text-muted-foreground mb-1 block">Participant</label>
            <Select 
              onValueChange={(id) => setSelectedParticipant(participants.find(p => p.id === id) || null)} 
              value={selectedParticipant?.id}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a Participant" />
              </SelectTrigger>
              <SelectContent>
                {participants.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedParticipant && (
            <div className="w-full sm:w-auto">
              <label className="text-[10px] font-bold uppercase text-muted-foreground mb-1 block">View Mode</label>
              <Tabs value={viewMode} onValueChange={(val) => setViewMode(val as ViewMode)}>
                <TabsList className="grid grid-cols-3 w-[240px]">
                  <TabsTrigger value="pre">Pre</TabsTrigger>
                  <TabsTrigger value="post">Post</TabsTrigger>
                  <TabsTrigger value="compare">Compare</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          )}
        </div>

        {selectedParticipant && (
          <div className="flex items-center gap-3 border-l pl-4">
            <div className="h-10 w-10 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-[#0046ab]">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase text-muted-foreground">Department</p>
              <p className="text-sm font-semibold">{selectedParticipant.department}</p>
            </div>
          </div>
        )}
      </div>

      {!selectedParticipant ? (
        <Card className="border-dashed bg-muted/30 py-20">
          <CardContent className="flex flex-col items-center justify-center text-center">
            <Users className="mb-4 h-12 w-12 text-muted-foreground/40" />
            <h3 className="text-xl font-semibold">Select a participant to view their dashboard</h3>
            <p className="text-muted-foreground max-w-sm mt-2">Individual leadership metrics, competency growth, and readiness scores will appear here.</p>
          </CardContent>
        </Card>
      ) : isRefreshing ? (
        <div className="flex h-[400px] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#0046ab]" />
        </div>
      ) : !hasDataForMode(viewMode) ? (
        <Card className="border-dashed bg-muted/30 py-20">
          <CardContent className="flex flex-col items-center justify-center text-center">
            <Info className="mb-4 h-12 w-12 text-muted-foreground/40" />
            <h3 className="text-xl font-semibold">No {viewMode === 'compare' ? 'Comparison' : viewMode} Data Available</h3>
            <p className="text-muted-foreground max-w-sm mt-2">
              {viewMode === 'post' || viewMode === 'compare' 
                ? "Post-assessment data has not been uploaded for this participant yet." 
                : "No pre-assessment data found for this participant."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6 animate-in fade-in duration-500">
          {/* Metrics Summary */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Card className="border-t-4 border-t-[#0046ab]">
              <CardHeader className="pb-2">
                <CardDescription className="text-[10px] font-bold uppercase tracking-wider">
                  {viewMode === 'compare' ? 'Readiness Score (Pre vs Post)' : `${viewMode.toUpperCase()} Readiness Score`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline gap-3">
                  <div className="text-5xl font-black text-[#0046ab]">
                    {viewMode === 'post' ? processedData.postReadinessScore.toFixed(2) : processedData.readinessScore.toFixed(2)}
                  </div>
                  {viewMode === 'compare' && (
                    <>
                      <div className="text-2xl text-muted-foreground">→</div>
                      <div className="text-5xl font-black text-green-600">
                        {processedData.postReadinessScore.toFixed(2)}
                      </div>
                    </>
                  )}
                </div>
                {viewMode === 'compare' && (
                  <p className="text-xs font-medium mt-2 flex items-center gap-1 text-green-600">
                    <TrendingUp className="h-3 w-3" />
                    Growth: {Number((processedData.postReadinessScore - processedData.readinessScore).toFixed(2))}
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold flex items-center gap-2 text-green-600 uppercase tracking-tighter">
                  <TrendingUp className="h-4 w-4" /> Top Strengths
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-2">
                  {processedData.topStrengths.map(s => (
                    <div key={s.competency} className="flex items-center justify-between">
                      <span className="text-sm font-medium">{s.competency}</span>
                      <Badge variant="secondary" className="font-mono">{viewMode === 'post' ? s.post : s.pre}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold flex items-center gap-2 text-destructive uppercase tracking-tighter">
                  <Target className="h-4 w-4" /> Development Areas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-2">
                  {processedData.developmentAreas.map(s => (
                    <div key={s.competency} className="flex items-center justify-between">
                      <span className="text-sm font-medium">{s.competency}</span>
                      <Badge variant="secondary" className="font-mono">{viewMode === 'post' ? s.post : s.pre}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Competency {viewMode === 'compare' ? 'Growth' : 'Profile'}</CardTitle>
              <CardDescription>
                {viewMode === 'compare' ? 'Side-by-side comparison of pre and post assessment scores.' : `Average scores across leadership competencies.`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={processedData.chartData} margin={{ top: 20, right: 30, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                    <XAxis dataKey="competency" tick={{ fontSize: 12, fontWeight: 500 }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 5]} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                    <Tooltip 
                      cursor={{ fill: '#f3f4f6' }}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                    />
                    <Legend verticalAlign="top" align="right" height={36} />
                    
                    {(viewMode === 'pre' || viewMode === 'compare') && (
                      <Bar name="Pre-Assessment" dataKey="pre" fill="#0046ab" radius={[4, 4, 0, 0]} barSize={viewMode === 'compare' ? 30 : 50} />
                    )}
                    {(viewMode === 'post' || viewMode === 'compare') && (
                      <Bar name="Post-Assessment" dataKey="post" fill="#22c55e" radius={[4, 4, 0, 0]} barSize={viewMode === 'compare' ? 30 : 50} />
                    )}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Comparison Delta Table */}
          {viewMode === 'compare' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Competency Delta Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-5 gap-4">
                  {processedData.chartData.map(d => (
                    <div key={d.competency} className="p-4 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border flex flex-col items-center gap-2">
                      <span className="text-xs font-bold uppercase text-muted-foreground">{d.competency}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold">{d.delta > 0 ? `+${d.delta}` : d.delta}</span>
                        {d.delta > 0 ? (
                          <ArrowUpRight className="h-4 w-4 text-green-600" />
                        ) : d.delta < 0 ? (
                          <ArrowDownRight className="h-4 w-4 text-destructive" />
                        ) : (
                          <Minus className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {d.pre} → {d.post}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};

export default ExecutiveDashboard;