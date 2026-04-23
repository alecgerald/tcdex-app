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
  Building2,
  LayoutDashboard,
  User,
  Check,
  ChevronsUpDown,
  Download
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { 
  Command, 
  CommandEmpty, 
  CommandGroup, 
  CommandInput, 
  CommandItem, 
  CommandList 
} from '@/components/ui/command';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

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

interface CohortMetrics {
  readinessScore: number;
  competencyAverages: { competency: string; average: number }[];
  distributionData: any[];
  departmentAverages: any[];
  topStrengths: { competency: string; average: number }[];
  developmentAreas: { competency: string; average: number }[];
  totalParticipants: number;
}

type ViewMode = 'pre' | 'post' | 'compare';
type DashboardType = 'individual' | 'cohort';

const competencyMap: Record<string, string> = {
  'Self': 'Self-Leadership',
  'Challenge': 'Challenge Orientation',
  'Relationship': 'Relationship-Building',
  'HR': 'HR Partnership',
  'Strategic': 'Strategic & Inclusive',
  'Self-Leadership': 'Self-Leadership',
  'Challenge Orientation': 'Challenge Orientation',
  'Relationship-Building': 'Relationship-Building',
  'HR Partnership': 'HR Partnership',
  'Strategic & Inclusive': 'Strategic & Inclusive'
};

const supabase = createClient();
const competencies = ['Challenge Orientation', 'Relationship-Building', 'Self-Leadership', 'HR Partnership', 'Strategic & Inclusive'];

const ExecutiveDashboard: React.FC<ExecutiveDashboardProps> = ({ refreshTrigger }) => {
  const [dashboardType, setDashboardType] = useState<DashboardType>('individual');
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [selectedParticipant, setSelectedParticipant] = useState<Participant | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('pre');
  const [individualScores, setIndividualScores] = useState<CompetencyScore[]>([]);
  const [cohortMetrics, setCohortMetrics] = useState<CohortMetrics | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [selectedCohortCompetency, setSelectedCohortCompetency] = useState<string>('Challenge Orientation');
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchBaseData = useCallback(async () => {
    setLoading(true);
    try {
      // A. Fetch Participants
      const { data: pData, error: pError } = await supabase
        .from('participants')
        .select('id, name, email, department')
        .order('name');
      
      if (pError) throw pError;
      setParticipants(pData || []);

      // B. Fetch Cohort Metrics
      const { data: indicators, error: iError } = await supabase
        .from('indicator_responses')
        .select(`rating, competency, participant_id, participants ( department )`)
        .eq('assessment_type', 'pre');

      if (iError) throw iError;

      if (indicators && indicators.length > 0) {
        const compSums: Record<string, { sum: number; count: number; dist: Record<number, number> }> = {}; 
        const deptTotals: Record<string, Record<string, { sum: number; count: number }>> = {}; 
        const participantsSeen = new Set<string>();

        indicators.forEach((ind: any) => {
          const { rating, competency: rawComp, participant_id, participants: p } = ind;
          const competency = competencyMap[rawComp] || rawComp;
          const dept = p?.department || 'Unknown';
          participantsSeen.add(participant_id);

          if (!compSums[competency]) {
            compSums[competency] = { sum: 0, count: 0, dist: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } };
          }
          compSums[competency].sum += rating;
          compSums[competency].count += 1;
          if (rating >= 1 && rating <= 5) compSums[competency].dist[rating] += 1;

          if (!deptTotals[dept]) deptTotals[dept] = {};
          if (!deptTotals[dept][competency]) deptTotals[dept][competency] = { sum: 0, count: 0 };
          deptTotals[dept][competency].sum += rating;
          deptTotals[dept][competency].count += 1;
        });

        const competencyAverages = competencies.map(name => ({
          competency: name,
          average: compSums[name]?.count > 0 ? Number((compSums[name].sum / compSums[name].count).toFixed(2)) : 0
        }));

        const readinessScore = competencyAverages.reduce((acc, curr) => acc + curr.average, 0) / competencies.length;

        const distributionData = competencies.map(name => {
          const stats = compSums[name];
          const total = stats?.count || 0;
          return {
            competency: name,
            '1': total > 0 ? Number(((stats.dist[1] / total) * 100).toFixed(1)) : 0,
            '2': total > 0 ? Number(((stats.dist[2] / total) * 100).toFixed(1)) : 0,
            '3': total > 0 ? Number(((stats.dist[3] / total) * 100).toFixed(1)) : 0,
            '4': total > 0 ? Number(((stats.dist[4] / total) * 100).toFixed(1)) : 0,
            '5': total > 0 ? Number(((stats.dist[5] / total) * 100).toFixed(1)) : 0
          };
        });

        const departmentAverages = Object.keys(deptTotals).map(deptName => {
          const row: Record<string, any> = { department: deptName };
          competencies.forEach(c => {
            const stats = deptTotals[deptName][c];
            row[c] = stats ? Number((stats.sum / stats.count).toFixed(2)) : 0;
          });
          return row;
        });

        const sorted = [...competencyAverages].sort((a, b) => b.average - a.average);

        setCohortMetrics({
          readinessScore, competencyAverages, distributionData, departmentAverages,
          topStrengths: sorted.slice(0, 2), developmentAreas: sorted.slice(-2).reverse(), totalParticipants: participantsSeen.size
        });
      }
    } catch (err) {
      console.error('Error fetching base dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBaseData();
  }, [fetchBaseData, refreshTrigger]);

  const fetchIndividualData = useCallback(async (participantId: string) => {
    setIsRefreshing(true);
    try {
      const { data, error } = await supabase
        .from('competency_scores')
        .select('competency, average_score, assessment_type')
        .eq('participant_id', participantId);
      if (error) throw error;
      setIndividualScores((data || []).map(s => ({ ...s, competency: competencyMap[s.competency] || s.competency })));
    } catch (err) {
      console.error('Error fetching individual scores:', err);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (selectedParticipant) fetchIndividualData(selectedParticipant.id);
  }, [selectedParticipant, fetchIndividualData]);

  const processedIndividual = useMemo(() => {
    const data: ChartData[] = competencies.map(c => {
      const pre = individualScores.find(s => s.competency === c && s.assessment_type === 'pre')?.average_score || 0;
      const post = individualScores.find(s => s.competency === c && s.assessment_type === 'post')?.average_score || 0;
      return { competency: c, pre: Number(pre.toFixed(2)), post: Number(post.toFixed(2)), delta: Number((post - pre).toFixed(2)) };
    });
    const currentScores = data.map(d => (viewMode === 'post' ? d.post : d.pre)).filter(s => s > 0);
    const readinessScore = currentScores.length > 0 ? currentScores.reduce((a, b) => a + b, 0) / currentScores.length : 0;
    const postScores = data.map(d => d.post).filter(s => s > 0);
    const postReadinessScore = postScores.length > 0 ? postScores.reduce((a, b) => a + b, 0) / postScores.length : 0;
    const sorted = [...data].filter(d => (viewMode === 'post' ? d.post > 0 : d.pre > 0)).sort((a, b) => (viewMode === 'post' ? b.post - a.post : b.pre - a.pre));
    return { chartData: data, readinessScore, postReadinessScore, topStrengths: sorted.slice(0, 2), developmentAreas: sorted.slice(-2).reverse() };
  }, [individualScores, viewMode]);

  const handleExportPDF = useCallback(async () => {
    setIsExporting(true);
    const toastId = toast.loading("Generating vector PDF report...");
    const payload = {
      title: dashboardType === 'cohort' ? 'Leadership Cohort Dashboard' : `Leadership Individual: ${selectedParticipant?.name || 'Dashboard'}`,
      description: dashboardType === 'cohort' ? "Aggregated leadership readiness performance." : `Detailed competency profile for ${selectedParticipant?.name}.`,
      date: new Date().toLocaleDateString(),
      kpis: dashboardType === 'cohort' && cohortMetrics ? [
        { title: "Cohort Readiness Score", value: cohortMetrics.readinessScore.toFixed(2), description: `Baseline average across ${cohortMetrics.totalParticipants} participants.` },
        { title: "Top Strength", value: cohortMetrics.topStrengths[0]?.competency || "N/A", description: `Avg Score: ${cohortMetrics.topStrengths[0]?.average || 0}` },
        { title: "Key Dev Area", value: cohortMetrics.developmentAreas[0]?.competency || "N/A", description: `Avg Score: ${cohortMetrics.developmentAreas[0]?.average || 0}` }
      ] : [
        { title: "Readiness Score", value: processedIndividual.readinessScore.toFixed(2), description: "Pre-assessment baseline score." },
        { title: "Top Strength", value: processedIndividual.topStrengths[0]?.competency || "N/A", description: "Highest rated competency." },
        { title: "Key Dev Area", value: processedIndividual.developmentAreas[0]?.competency || "N/A", description: "Primary area for growth." }
      ],
      charts: dashboardType === 'cohort' && cohortMetrics ? [{
          title: "Cohort Competency Averages",
          data: cohortMetrics.competencyAverages.map(d => ({ label: d.competency, value: d.average, max: 5, color: "#0046ab" }))
      }] : [{
          title: `Competency Profile (${viewMode.toUpperCase()})`,
          data: processedIndividual.chartData.map(d => ({ label: d.competency, value: viewMode === 'post' ? d.post : d.pre, max: 5, color: viewMode === 'post' ? "#22c55e" : "#0046ab" }))
      }],
      tables: dashboardType === 'cohort' && cohortMetrics ? [{
          title: "Department Breakdown",
          headers: ["Department", ...competencies],
          rows: cohortMetrics.departmentAverages.map(d => [d.department, ...competencies.map(c => d[c])])
      }] : []
    };
    try {
      const res = await fetch('/api/pdf', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error('Failed to generate PDF');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${payload.title.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a); a.click(); a.remove(); window.URL.revokeObjectURL(url);
      toast.success("PDF report downloaded!", { id: toastId });
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate vector PDF.", { id: toastId });
    } finally {
      setIsExporting(false);
    }
  }, [dashboardType, selectedParticipant, cohortMetrics, processedIndividual, viewMode]);

  const filteredParticipants = useMemo(() => searchQuery ? participants.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase())) : participants, [participants, searchQuery]);

  if (loading) return <div className="flex h-[400px] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-[#0046ab]" /></div>;

  const hasIndividualData = (mode: ViewMode) => {
    if (mode === 'pre') return processedIndividual.chartData.some(d => d.pre > 0);
    if (mode === 'post') return processedIndividual.chartData.some(d => d.post > 0);
    if (mode === 'compare') return processedIndividual.chartData.some(d => d.pre > 0) && processedIndividual.chartData.some(d => d.post > 0);
    return false;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row items-center justify-center gap-4 bg-white dark:bg-zinc-900 p-2 rounded-xl border shadow-sm w-fit mx-auto">
        <Tabs value={dashboardType} onValueChange={(v) => setDashboardType(v as DashboardType)}><TabsList className="grid grid-cols-2 w-[300px]"><TabsTrigger value="individual" className="flex items-center gap-2"><User className="h-4 w-4" /> Individual</TabsTrigger><TabsTrigger value="cohort" className="flex items-center gap-2"><Users className="h-4 w-4" /> Cohort</TabsTrigger></TabsList></Tabs>
        <Button variant="outline" onClick={handleExportPDF} disabled={isExporting} className="flex items-center gap-2 h-10 px-4 text-xs font-bold uppercase tracking-wider">{isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4 text-[#0046ab]" />} Export PDF</Button>
      </div>

      {dashboardType === 'individual' && (
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between bg-white dark:bg-zinc-900 p-4 rounded-xl border shadow-sm">
          <div className="flex flex-1 flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="w-full sm:w-[300px]"><label className="text-[10px] font-bold uppercase text-muted-foreground mb-1 block">Participant</label>
              <Popover open={open} onOpenChange={setOpen}><PopoverTrigger asChild><Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between font-normal">{selectedParticipant ? selectedParticipant.name : "Select participant..."}<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" /></Button></PopoverTrigger>
                <PopoverContent className="w-[300px] p-0"><Command shouldFilter={false}><CommandInput placeholder="Search participant..." value={searchQuery} onValueChange={setSearchQuery} /><CommandList><CommandEmpty>No participant found.</CommandEmpty><CommandGroup>{filteredParticipants.map((participant) => (<CommandItem key={participant.id} value={participant.id} onSelect={() => { setSelectedParticipant(participant); setOpen(false); setSearchQuery(""); }}><Check className={cn("mr-2 h-4 w-4", selectedParticipant?.id === participant.id ? "opacity-100" : "opacity-0")} />{participant.name}</CommandItem>))}</CommandGroup></CommandList></Command></PopoverContent></Popover></div>
            {selectedParticipant && (<div className="w-full sm:w-auto"><label className="text-[10px] font-bold uppercase text-muted-foreground mb-1 block">Phase</label><Tabs value={viewMode} onValueChange={(val) => setViewMode(val as ViewMode)}><TabsList className="grid grid-cols-3 w-[240px]"><TabsTrigger value="pre">Pre</TabsTrigger><TabsTrigger value="post">Post</TabsTrigger><TabsTrigger value="compare">Compare</TabsTrigger></TabsList></Tabs></div>)}
          </div>
          {selectedParticipant && (<div className="flex items-center gap-3 border-l pl-4"><Building2 className="h-5 w-5 text-[#0046ab]" /><div><p className="text-[10px] font-bold uppercase text-muted-foreground">Department</p><p className="text-sm font-semibold">{selectedParticipant.department}</p></div></div>)}
        </div>
      )}

      {dashboardType === 'cohort' && (
        <div id="pdf-content-executive" className="space-y-6 animate-in fade-in duration-500">
          {!cohortMetrics ? (<Card className="border-dashed bg-muted/30 py-20 text-center"><CardContent><Info className="mx-auto h-12 w-12 text-muted-foreground/40 mb-4" /><h3 className="text-xl font-semibold">No Cohort Data Available</h3><p className="text-muted-foreground">Upload pre-assessment data to see aggregate insights.</p></CardContent></Card>) : (
            <>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <Card className="border-t-4 border-t-[#0046ab]"><CardHeader className="pb-2"><CardDescription className="text-[10px] font-bold uppercase tracking-wider text-[#0046ab]">Cohort Readiness Score</CardDescription></CardHeader><CardContent><div className="text-6xl font-black text-[#0046ab]">{cohortMetrics.readinessScore.toFixed(2)}</div><p className="text-xs text-muted-foreground mt-2">Baseline average across {cohortMetrics.totalParticipants} participants.</p></CardContent></Card>
                <Card><CardHeader className="pb-2 text-green-600"><CardTitle className="text-sm font-bold uppercase flex items-center gap-2"><TrendingUp className="h-4 w-4" /> Top Strengths</CardTitle></CardHeader><CardContent className="space-y-2">{cohortMetrics.topStrengths.map(s => (<div key={s.competency} className="flex justify-between items-center text-sm font-medium"><span>{s.competency}</span><Badge variant="secondary">{s.average}</Badge></div>))}</CardContent></Card>
                <Card><CardHeader className="pb-2 text-destructive"><CardTitle className="text-sm font-bold uppercase flex items-center gap-2"><Target className="h-4 w-4" /> Dev Areas</CardTitle></CardHeader><CardContent className="space-y-2">{cohortMetrics.developmentAreas.map(s => (<div key={s.competency} className="flex justify-between items-center text-sm font-medium"><span>{s.competency}</span><Badge variant="secondary">{s.average}</Badge></div>))}</CardContent></Card>
              </div>
              <Card><CardHeader><CardTitle>Cohort Competency Averages</CardTitle><CardDescription>Baseline performance across all departments.</CardDescription></CardHeader><CardContent><div className="h-[350px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={cohortMetrics.competencyAverages}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" /><XAxis dataKey="competency" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} /><YAxis domain={[0, 5]} axisLine={false} tickLine={false} tick={{ fontSize: 12 }} /><Tooltip cursor={{ fill: '#f3f4f6' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} /><Bar dataKey="average" fill="#0046ab" radius={[4, 4, 0, 0]} barSize={50} /></BarChart></ResponsiveContainer></div></CardContent></Card>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card><CardHeader><CardTitle>Maturity Distribution (%)</CardTitle><CardDescription>Breakdown of rating frequency per competency.</CardDescription></CardHeader><CardContent><div className="h-[350px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={cohortMetrics.distributionData}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="competency" tick={{ fontSize: 11 }} /><YAxis unit="%" /><Tooltip formatter={(v) => `${v}%`} /><Legend /><Bar dataKey="1" stackId="a" fill="#ef4444" name="Not Obs." /><Bar dataKey="2" stackId="a" fill="#f97316" name="Rarely" /><Bar dataKey="3" stackId="a" fill="#eab308" name="Sometimes" /><Bar dataKey="4" stackId="a" fill="#22c55e" name="Often" /><Bar dataKey="5" stackId="a" fill="#3b82f6" name="Consistently" /></BarChart></ResponsiveContainer></div></CardContent></Card>
                <Card><CardHeader><div className="flex justify-between items-center"><div><CardTitle>Department Profile</CardTitle><CardDescription>Comparison across delivery units.</CardDescription></div><Select value={selectedCohortCompetency} onValueChange={setSelectedCohortCompetency}><SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger><SelectContent>{competencies.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div></CardHeader><CardContent><div className="h-[350px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={cohortMetrics.departmentAverages} margin={{ bottom: 40 }}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="department" angle={-45} textAnchor="end" interval={0} tick={{ fontSize: 10 }} /><YAxis domain={[0, 5]} /><Tooltip /><Bar dataKey={selectedCohortCompetency} fill="#0046ab" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div></CardContent></Card>
              </div>
            </>
          )}
        </div>
      )}

      {dashboardType === 'individual' && (
        <div id="pdf-content-executive" className="animate-in fade-in duration-500">
          {!selectedParticipant ? (<Card className="border-dashed bg-muted/30 py-20 text-center"><CardContent><User className="mx-auto h-12 w-12 text-muted-foreground/40 mb-4" /><h3 className="text-xl font-semibold">Select a participant to view their individual dashboard</h3><p className="text-muted-foreground">Detailed competency growth and comparison data will appear here.</p></CardContent></Card>) : isRefreshing ? (<div className="flex h-[400px] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-[#0046ab]" /></div>) : !hasIndividualData(viewMode) ? (<Card className="border-dashed bg-muted/30 py-20 text-center"><CardContent><Info className="mx-auto h-12 w-12 text-muted-foreground/40 mb-4" /><h3 className="text-xl font-semibold">No {viewMode.toUpperCase()} Data Found</h3><p className="text-muted-foreground">Upload the relevant assessment file for this participant.</p></CardContent></Card>) : (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <Card className="border-t-4 border-t-[#0046ab]"><CardHeader className="pb-2"><CardDescription className="text-[10px] font-bold uppercase tracking-wider text-[#0046ab]">{viewMode === 'compare' ? 'Growth Readiness Score' : `${viewMode.toUpperCase()} Readiness Score`}</CardDescription></CardHeader><CardContent><div className="flex items-baseline gap-3">{(viewMode === 'pre' || viewMode === 'compare') && (<div className="text-5xl font-black text-[#0046ab]">{processedIndividual.readinessScore.toFixed(2)}</div>)}{viewMode === 'compare' && <div className="text-2xl text-muted-foreground">→</div>}{(viewMode === 'post' || viewMode === 'compare') && (<div className="text-5xl font-black text-green-600">{processedIndividual.postReadinessScore.toFixed(2)}</div>)}</div>{viewMode === 'compare' && (<p className="text-xs font-bold text-green-600 mt-2">Improvement: +{(processedIndividual.postReadinessScore - processedIndividual.readinessScore).toFixed(2)}</p>)}</CardContent></Card>
                <Card><CardHeader className="pb-2 text-green-600"><CardTitle className="text-sm font-bold uppercase flex items-center gap-2"><TrendingUp className="h-4 w-4" /> Top Strengths</CardTitle></CardHeader><CardContent className="space-y-2">{processedIndividual.topStrengths.map(s => (<div key={s.competency} className="flex justify-between items-center text-sm font-medium"><span>{s.competency}</span><Badge variant="secondary">{viewMode === 'post' ? s.post : s.pre}</Badge></div>))}</CardContent></Card>
                <Card><CardHeader className="pb-2 text-destructive"><CardTitle className="text-sm font-bold uppercase flex items-center gap-2"><Target className="h-4 w-4" /> Dev Areas</CardTitle></CardHeader><CardContent className="space-y-2">{processedIndividual.developmentAreas.map(s => (<div key={s.competency} className="flex justify-between items-center text-sm font-medium"><span>{s.competency}</span><Badge variant="secondary">{viewMode === 'post' ? s.post : s.pre}</Badge></div>))}</CardContent></Card>
              </div>
              <Card><CardHeader><CardTitle>Competency {viewMode === 'compare' ? 'Growth' : 'Profile'}</CardTitle><CardDescription>Individual assessment scores for {selectedParticipant.name}.</CardDescription></CardHeader><CardContent><div className="h-[400px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={processedIndividual.chartData}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" /><XAxis dataKey="competency" axisLine={false} tickLine={false} /><YAxis domain={[0, 5]} axisLine={false} tickLine={false} /><Tooltip cursor={{ fill: '#f3f4f6' }} /><Legend verticalAlign="top" align="right" height={36} />{(viewMode === 'pre' || viewMode === 'compare') && (<Bar name="Pre" dataKey="pre" fill="#0046ab" radius={[4, 4, 0, 0]} barSize={viewMode === 'compare' ? 30 : 50} />)}{(viewMode === 'post' || viewMode === 'compare') && (<Bar name="Post" dataKey="post" fill="#22c55e" radius={[4, 4, 0, 0]} barSize={viewMode === 'compare' ? 30 : 50} />)}</BarChart></ResponsiveContainer></div></CardContent></Card>
              {viewMode === 'compare' && (<Card><CardHeader><CardTitle>Growth Analysis</CardTitle></CardHeader><CardContent><div className="grid grid-cols-5 gap-4">{processedIndividual.chartData.map(d => (<div key={d.competency} className="p-4 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border flex flex-col items-center gap-2"><span className="text-[10px] font-bold uppercase text-muted-foreground">{d.competency}</span><div className="flex items-center gap-2"><span className="text-lg font-bold">{d.delta > 0 ? `+${d.delta}` : d.delta}</span>{d.delta > 0 ? <ArrowUpRight className="h-4 w-4 text-green-600" /> : d.delta < 0 ? <ArrowDownRight className="h-4 w-4 text-destructive" /> : <Minus className="h-4 w-4 text-muted-foreground" />}</div></div>))}</div></CardContent></Card>)}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ExecutiveDashboard;
