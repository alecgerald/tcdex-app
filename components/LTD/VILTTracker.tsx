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
  Loader2, 
  Users, 
  Calendar as CalendarIcon,
  CheckCircle,
  XCircle,
  TrendingUp,
  Search,
  Filter,
  Check,
  AlertCircle
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { cn } from "@/lib/utils";

interface Participant {
  id: string;
  name: string;
  department: string;
}

interface VILTRecord {
  id?: string;
  participant_id: string;
  year: string;
  cohort: string;
  status: string;
}

const YEARS = ["2024", "2025", "2026"];
const COHORTS = ["Q1 Cohort 1", "Q1 Cohort 2", "Q2 Cohort 1", "Q2 Cohort 2", "Q3 Cohort 1", "Q3 Cohort 2", "Q4 Cohort 1", "Q4 Cohort 2"];

const VILTTracker: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [attendance, setAttendance] = useState<Record<string, VILTRecord>>({}); // Key: participant_id
  const [selectedYear, setSelectedYear] = useState<string>("2026");
  const [selectedCohort, setSelectedCohort] = useState<string>("Q1 Cohort 1");
  const [searchQuery, setSearchQuery] = useState("");
  
  const supabase = createClient();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch all participants
      const { data: pData, error: pError } = await supabase
        .from('participants')
        .select('id, name, department')
        .order('name');

      if (pError) throw pError;
      setParticipants(pData || []);

      // 2. Fetch attendance for selected year/cohort
      const { data: aData, error: aError } = await supabase
        .from('vilt_tracker')
        .select('*')
        .eq('year', selectedYear)
        .eq('cohort', selectedCohort);

      if (aError) throw aError;

      const attendanceMap: Record<string, VILTRecord> = {};
      (aData || []).forEach(record => {
        attendanceMap[record.participant_id] = record;
      });
      setAttendance(attendanceMap);
    } catch (error) {
      console.error('Error fetching VILT data:', error);
      toast.error("Failed to load tracker data.");
    } finally {
      setLoading(false);
    }
  }, [supabase, selectedYear, selectedCohort]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleStatusChange = async (participantId: string, newStatus: string) => {
    const existing = attendance[participantId];
    
    // Optimistic Update
    const updatedAttendance = { ...attendance };
    if (existing) {
      updatedAttendance[participantId] = { ...existing, status: newStatus };
    } else {
      updatedAttendance[participantId] = { participant_id: participantId, year: selectedYear, cohort: selectedCohort, status: newStatus };
    }
    setAttendance(updatedAttendance);

    try {
      if (existing?.id) {
        // Update existing record
        const { error } = await supabase
          .from('vilt_tracker')
          .update({ status: newStatus, updated_at: new Date().toISOString() })
          .eq('id', existing.id);
        
        if (error) throw error;
      } else {
        // Insert new record
        const { data, error } = await supabase
          .from('vilt_tracker')
          .insert([{ 
            participant_id: participantId, 
            year: selectedYear, 
            cohort: selectedCohort, 
            status: newStatus 
          }])
          .select();

        if (error) throw error;
        
        // Update state with the newly created ID
        if (data && data[0]) {
          setAttendance(prev => ({
            ...prev,
            [participantId]: data[0]
          }));
        }
      }
      toast.success(`Status updated for participant.`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to update status.");
      fetchData(); // Rollback
    }
  };

  const filteredParticipants = useMemo(() => {
    return participants.filter(p => 
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.department.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [participants, searchQuery]);

  const stats = useMemo(() => {
    const totalSelected = filteredParticipants.length;
    const completed = filteredParticipants.filter(p => attendance[p.id]?.status === 'Complete').length;
    const rate = totalSelected > 0 ? (completed / totalSelected) * 100 : 0;
    
    return {
      total: totalSelected,
      completed,
      rate: rate.toFixed(1)
    };
  }, [filteredParticipants, attendance]);

  if (loading && participants.length === 0) {
    return (
      <div className="flex h-[400px] items-center justify-center w-full">
        <Loader2 className="h-10 w-10 animate-spin text-[#0046ab]" />
      </div>
    );
  }

  return (
    <div className="w-full space-y-8">
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-white p-6 rounded-2xl border shadow-sm">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-50 rounded-xl"><Users className="h-6 w-6 text-[#0046ab]" /></div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-[#0046ab]">VILT Tracker</h1>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest">Virtual Instructor-Led Training Attendance</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 bg-zinc-50 p-2 rounded-xl border">
          <div className="flex items-center gap-2 border-r pr-3">
            <CalendarIcon className="h-4 w-4 text-zinc-400" />
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-[100px] h-8 text-xs font-black border-none bg-transparent focus:ring-0">
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent>
                {YEARS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-zinc-400" />
            <Select value={selectedCohort} onValueChange={setSelectedCohort}>
              <SelectTrigger className="w-[160px] h-8 text-xs font-black border-none bg-transparent focus:ring-0">
                <SelectValue placeholder="Cohort" />
              </SelectTrigger>
              <SelectContent>
                {COHORTS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="shadow-sm border-zinc-100 rounded-2xl overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-2 p-4">
            <CardTitle className="text-[10px] font-black uppercase text-zinc-400 tracking-wider">Attendance Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-3xl font-black tabular-nums text-zinc-900">{stats.rate}%</div>
            <p className="text-[10px] text-zinc-400 font-medium uppercase mt-1">Cohort Attendance Success</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-zinc-100 rounded-2xl overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-2 p-4">
            <CardTitle className="text-[10px] font-black uppercase text-zinc-400 tracking-wider">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-3xl font-black tabular-nums text-zinc-900">{stats.completed}</div>
            <p className="text-[10px] text-zinc-400 font-medium uppercase mt-1">Participants Marked Complete</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-zinc-100 rounded-2xl overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-2 p-4">
            <CardTitle className="text-[10px] font-black uppercase text-zinc-400 tracking-wider">Total Learners</CardTitle>
            <Users className="h-4 w-4 text-zinc-400" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-3xl font-black tabular-nums text-zinc-900">{stats.total}</div>
            <p className="text-[10px] text-zinc-400 font-medium uppercase mt-1">Enrolled in Cohort</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Table */}
      <Card className="shadow-sm border-zinc-100 rounded-3xl overflow-hidden">
        <CardHeader className="bg-zinc-50/50 border-b p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-xs font-black uppercase text-zinc-600 tracking-wider">Cohort Participants</CardTitle>
              <CardDescription className="text-[10px] font-medium uppercase text-zinc-400">Attendance tracking for {selectedYear} - {selectedCohort}</CardDescription>
            </div>
            <div className="relative w-full sm:w-[300px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
              <Input 
                placeholder="Search name or department..." 
                className="pl-10 h-10 text-xs border-zinc-200 rounded-xl"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-white sticky top-0 z-10">
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-6 text-[10px] font-black uppercase tracking-wider h-12">Participant</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-wider h-12">Department</TableHead>
                <TableHead className="text-right pr-6 text-[10px] font-black uppercase tracking-wider h-12 w-[200px]">Attendance Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredParticipants.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="h-60 text-center">
                    <div className="flex flex-col items-center justify-center gap-2 opacity-30">
                      <Users className="h-8 w-8" />
                      <p className="text-sm font-black uppercase tracking-widest">No participants found</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredParticipants.map((p) => {
                  const record = attendance[p.id];
                  const status = record?.status || 'Absent';
                  
                  return (
                    <TableRow key={p.id} className="hover:bg-zinc-50/50 transition-colors border-zinc-100 group">
                      <TableCell className="pl-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-zinc-800">{p.name}</span>
                          <span className="text-[9px] text-[#0046ab] font-black uppercase">Enrolled</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="bg-white border text-[10px] font-black uppercase px-2 py-0.5 rounded-md text-zinc-500">
                          {p.department}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        <Select 
                          value={status} 
                          onValueChange={(val) => handleStatusChange(p.id, val)}
                        >
                          <SelectTrigger className={cn(
                            "h-9 w-[140px] ml-auto text-xs font-black rounded-lg transition-all",
                            status === "Complete" 
                              ? "bg-emerald-50 border-emerald-100 text-emerald-600" 
                              : "bg-rose-50 border-rose-100 text-rose-500"
                          )}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Complete" className="text-emerald-600 font-bold">Complete</SelectItem>
                            <SelectItem value="Absent" className="text-rose-500 font-bold">Absent</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default VILTTracker;
