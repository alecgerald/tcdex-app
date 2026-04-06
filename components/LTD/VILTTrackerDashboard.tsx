"use client";

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Loader2, 
  Users, 
  CheckCircle2, 
  TrendingUp,
  Search,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  Trash2,
  FileSpreadsheet,
  Download
} from 'lucide-react';
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { cn } from "@/lib/utils";
import * as XLSX from 'xlsx';

interface VILTRecord {
  id: string;
  email: string;
  name: string;
  department: string;
  year: string;
  cohort: string;
  modules: Record<string, boolean>;
  overall_status: string;
  updated_at: string;
}

interface Session {
  year: string;
  cohort: string;
}

const MODULE_KEYS = ["M1", "M2A", "M2B", "M3E", "M3F-B1", "M4"];
const ITEMS_PER_PAGE = 15;

const VILTTrackerDashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [records, setRecords] = useState<VILTRecord[]>([]);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  
  const supabase = createClient();

  // 1. Fetch all distinct sessions (year + cohort)
  const fetchSessions = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('vilt_tracker')
        .select('year, cohort');
      
      if (error) throw error;

      // Deduplicate sessions
      const uniqueSessions: Session[] = [];
      const seen = new Set();
      
      (data || []).forEach(item => {
        const key = `${item.year}-${item.cohort}`;
        if (!seen.has(key)) {
          seen.add(key);
          uniqueSessions.push({ year: item.year, cohort: item.cohort });
        }
      });

      // Sort: Year DESC, Cohort ASC
      uniqueSessions.sort((a, b) => {
        if (a.year !== b.year) return b.year.localeCompare(a.year);
        return a.cohort.localeCompare(b.cohort);
      });

      setSessions(uniqueSessions);
      if (uniqueSessions.length > 0 && !selectedSession) {
        setSelectedSession(uniqueSessions[0]);
      } else if (uniqueSessions.length === 0) {
        setSelectedSession(null);
        setRecords([]);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load sessions.");
    }
  }, [supabase, selectedSession]);

  // 2. Fetch records for selected session
  const fetchRecords = useCallback(async () => {
    if (!selectedSession) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('vilt_tracker')
        .select('*')
        .eq('year', selectedSession.year)
        .eq('cohort', selectedSession.cohort)
        .order('name');

      if (error) throw error;
      setRecords(data || []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load records.");
    } finally {
      setLoading(false);
    }
  }, [supabase, selectedSession]);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);
  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  // Reset pagination when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const handleModuleToggle = async (id: string, moduleKey: string, currentValue: boolean) => {
    const record = records.find(r => r.id === id);
    if (!record) return;

    const newModules = { ...record.modules, [moduleKey]: !currentValue };
    
    // Recalculate Overall Status: Completed if all 6 modules are true
    const allCompleted = MODULE_KEYS.every(key => newModules[key] === true);
    const newStatus = allCompleted ? 'Completed' : 'Incomplete';

    // Optimistic Update
    const originalRecords = [...records];
    setRecords(prev => prev.map(r => 
      r.id === id ? { ...r, modules: newModules, overall_status: newStatus } : r
    ));

    try {
      const { error } = await supabase
        .from('vilt_tracker')
        .update({ 
          modules: newModules,
          overall_status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;
      toast.success(`Updated ${moduleKey} for ${record.name}`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to sync update.");
      setRecords(originalRecords); // Rollback
    }
  };

  const handleDeleteSession = async (year: string, cohort: string) => {
    const confirmDelete = window.confirm(`Are you sure you want to delete the entire session: ${cohort} (${year})? This action cannot be undone.`);
    
    if (!confirmDelete) return;

    try {
      const { error } = await supabase
        .from('vilt_tracker')
        .delete()
        .eq('year', year)
        .eq('cohort', cohort);

      if (error) throw error;

      toast.success(`Successfully deleted session: ${cohort} (${year})`);
      
      // Refresh sessions
      if (selectedSession?.year === year && selectedSession?.cohort === cohort) {
        setSelectedSession(null);
        setRecords([]);
      }
      fetchSessions();
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete session.");
    }
  };

  const filteredRecords = useMemo(() => {
    return records.filter(r => 
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.department.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [records, searchQuery]);

  const totalPages = Math.ceil(filteredRecords.length / ITEMS_PER_PAGE);

  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredRecords.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredRecords, currentPage]);

  const exportToExcel = () => {
    if (filteredRecords.length === 0) {
      toast.error("No data available to export.");
      return;
    }

    try {
      const exportData = filteredRecords.map(r => {
        const row: any = {
          'Participant Name': r.name,
          'Email': r.email,
          'Department': r.department,
          'Year': r.year,
          'Cohort': r.cohort,
        };

        // Add module columns
        MODULE_KEYS.forEach(key => {
          row[key] = r.modules[key] ? "1" : "0";
        });

        row['Overall Status'] = r.overall_status;
        return row;
      });

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "VILT Attendance");

      // Set column widths
      const wscols = [
        { wch: 25 }, // Name
        { wch: 30 }, // Email
        { wch: 20 }, // Dept
        { wch: 10 }, // Year
        { wch: 15 }, // Cohort
        ...MODULE_KEYS.map(() => ({ wch: 8 })), // Modules
        { wch: 15 }  // Status
      ];
      worksheet['!cols'] = wscols;

      const fileName = `VILT_Attendance_${selectedSession?.cohort.replace(/\s+/g, '_')}_${selectedSession?.year}.xlsx`;
      XLSX.writeFile(workbook, fileName);
      toast.success("Dashboard data exported successfully.");
    } catch (err) {
      console.error("Export error:", err);
      toast.error("Failed to export data to Excel.");
    }
  };

  // Attendance Metrics for selected session
  const summary = useMemo(() => {
    const total = records.length;
    const completed = records.filter(r => r.overall_status === 'Completed').length;
    const rate = total > 0 ? (completed / total) * 100 : 0;
    
    return {
      total,
      completed,
      rate: rate.toFixed(1)
    };
  }, [records]);

  if (loading && records.length === 0 && sessions.length > 0) {
    return (
      <div className="flex h-[400px] items-center justify-center w-full">
        <Loader2 className="h-10 w-10 animate-spin text-[#0046ab]" />
      </div>
    );
  }

  return (
    <div className="w-full space-y-10 pb-12">
      {/* Session Selector */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <LayoutGrid className="h-5 w-5 text-[#0046ab]" />
            <h2 className="text-sm font-black uppercase tracking-widest text-zinc-500">Select Session</h2>
          </div>
          <Button 
            onClick={exportToExcel}
            variant="outline"
            className="h-10 px-6 rounded-lg border-zinc-200 text-zinc-600 font-bold text-sm uppercase flex items-center gap-2 hover:bg-zinc-50 transition-all"
            disabled={filteredRecords.length === 0}
          >
            <Download className="h-5 w-5 text-[#0046ab]" />
            Export to Excel
          </Button>
        </div>
        
        <div className="flex flex-nowrap overflow-x-auto gap-4 pb-4 -mx-1 px-1 scrollbar-hide">
          {sessions.map((session, idx) => {
            const isActive = selectedSession?.year === session.year && selectedSession?.cohort === session.cohort;
            return (
              <button
                key={`${session.year}-${session.cohort}`}
                onClick={() => {
                  setSelectedSession(session);
                  setCurrentPage(1);
                }}
                className={cn(
                  "flex-shrink-0 min-w-[160px] p-6 rounded-2xl border transition-all text-left group relative",
                  isActive 
                    ? "bg-[#0046ab] border-[#0046ab] shadow-lg shadow-blue-100" 
                    : "bg-white border-zinc-100 hover:border-[#0046ab]/30 hover:bg-blue-50/30"
                )}
              >
                <div className={cn(
                  "text-[11px] font-black uppercase tracking-wider mb-2",
                  isActive ? "text-blue-100" : "text-zinc-400 group-hover:text-[#0046ab]"
                )}>
                  {session.year}
                </div>
                <div className={cn(
                  "text-base font-black uppercase pr-8",
                  isActive ? "text-white" : "text-zinc-800"
                )}>
                  {session.cohort}
                </div>
                
                {/* Delete Button */}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteSession(session.year, session.cohort);
                        }}
                        className={cn(
                          "absolute top-4 right-4 p-2 rounded-lg transition-colors cursor-pointer",
                          isActive 
                            ? "text-blue-200 hover:text-white hover:bg-white/10" 
                            : "text-zinc-300 hover:text-rose-500 hover:bg-rose-50"
                        )}
                      >
                        <Trash2 className="h-4 w-4" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="text-[10px] font-black uppercase">
                      Delete Session
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </button>
            );
          })}
        </div>
      </div>

      {sessions.length === 0 ? (
        <Card className="shadow-sm border-zinc-100 rounded-3xl overflow-hidden p-16 text-center">
          <div className="flex flex-col items-center justify-center gap-6">
            <div className="bg-zinc-50 p-8 rounded-full">
              <Users className="h-12 w-12 text-zinc-300" />
            </div>
            <div className="space-y-2">
              <h3 className="text-base font-black uppercase tracking-widest text-zinc-800">No Sessions Found</h3>
              <p className="text-sm text-zinc-400 font-medium">Please import data to start tracking attendance.</p>
            </div>
          </div>
        </Card>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="shadow-sm border-zinc-100 rounded-2xl overflow-hidden group">
              <CardHeader className="flex flex-row items-center justify-between pb-3 p-6">
                <CardTitle className="text-[11px] font-black uppercase text-zinc-500 tracking-wider">Attendance Rate</CardTitle>
                <TrendingUp className="h-5 w-5 text-emerald-600" />
              </CardHeader>
              <CardContent className="p-6 pt-0">
                <div className="text-4xl font-black text-zinc-900">{summary.rate}%</div>
                <p className="text-[11px] font-bold text-zinc-400 uppercase mt-2">Status: Completed</p>
              </CardContent>
            </Card>

            <Card className="shadow-sm border-zinc-100 rounded-2xl overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between pb-3 p-6">
                <CardTitle className="text-[11px] font-black uppercase text-zinc-500 tracking-wider">Completed</CardTitle>
                <CheckCircle2 className="h-5 w-5 text-blue-600" />
              </CardHeader>
              <CardContent className="p-6 pt-0">
                <div className="text-4xl font-black text-zinc-900">{summary.completed}</div>
                <p className="text-[11px] font-bold text-zinc-400 uppercase mt-2">Participants</p>
              </CardContent>
            </Card>

            <Card className="shadow-sm border-zinc-100 rounded-2xl overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between pb-3 p-6">
                <CardTitle className="text-[11px] font-black uppercase text-zinc-500 tracking-wider">Total Enrolled</CardTitle>
                <Users className="h-5 w-5 text-zinc-400" />
              </CardHeader>
              <CardContent className="p-6 pt-0">
                <div className="text-4xl font-black text-zinc-900">{summary.total}</div>
                <p className="text-[11px] font-bold text-zinc-400 uppercase mt-2">Cohort Size</p>
              </CardContent>
            </Card>
          </div>

          {/* Search & Export Header */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-white p-8 rounded-2xl border shadow-sm">
            <div className="flex flex-col gap-2">
              <h3 className="text-xl font-black text-zinc-900 uppercase tracking-tight">
                {selectedSession?.cohort} <span className="text-[#0046ab]">{selectedSession?.year}</span>
              </h3>
              <p className="text-sm font-bold text-zinc-400 uppercase">Managing attendance tracking and module completion</p>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto">
              <div className="relative w-full sm:w-[320px]">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400" />
                <Input 
                  placeholder="Search participant..." 
                  className="pl-12 h-12 text-base border-zinc-200 rounded-xl w-full focus-visible:ring-[#0046ab]"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              
              <Button 
                onClick={exportToExcel}
                variant="outline"
                className="h-12 px-6 rounded-xl border-zinc-200 text-zinc-600 font-bold text-sm uppercase flex items-center gap-2 hover:bg-zinc-50 w-full sm:w-auto transition-all"
              >
                <Download className="h-5 w-5 text-[#0046ab]" />
                Export to Excel
              </Button>
            </div>
          </div>

          {/* Main Table */}
          <Card className="shadow-sm border-zinc-100 rounded-3xl overflow-hidden">
            <CardContent className="p-0">
              <TooltipProvider>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-zinc-50/50">
                      <TableRow>
                        <TableHead className="pl-8 text-sm font-black uppercase tracking-wider h-16">Participant</TableHead>
                        <TableHead className="text-sm font-black uppercase tracking-wider h-16">Department</TableHead>
                        {MODULE_KEYS.map(key => (
                          <TableHead key={key} className="text-center text-sm font-black uppercase tracking-wider h-16">
                            {key}
                          </TableHead>
                        ))}
                        <TableHead className="text-right pr-8 text-sm font-black uppercase tracking-wider h-16">Overall Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedRecords.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={MODULE_KEYS.length + 3} className="h-80 text-center">
                            <div className="flex flex-col items-center justify-center gap-4 opacity-30">
                              <Users className="h-12 w-12" />
                              <p className="text-base font-black uppercase tracking-widest">No participants found</p>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        paginatedRecords.map((r) => (
                          <TableRow key={r.id} className="hover:bg-zinc-50/50 transition-colors border-zinc-100 group">
                            <TableCell className="pl-8 py-6">
                              <div className="flex flex-col">
                                <span className="text-base font-medium text-zinc-800">{r.name}</span>
                                <span className="text-xs text-[#0046ab] font-black uppercase mt-1">{r.email}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="bg-white border text-xs font-black uppercase px-3 py-1.5 rounded-md text-zinc-500 whitespace-nowrap">
                                {r.department}
                              </Badge>
                            </TableCell>
                            {MODULE_KEYS.map(key => {
                              const attended = r.modules[key] || false;
                              return (
                                <TableCell key={key} className="text-center">
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div className="flex justify-center">
                                        <Switch 
                                          checked={attended} 
                                          onCheckedChange={() => handleModuleToggle(r.id, key, attended)}
                                          className="data-[state=checked]:bg-emerald-500 scale-125"
                                        />
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent className="text-[11px] font-black uppercase px-2.5 py-1.5">
                                      {attended ? "Attended" : "Absent"}
                                    </TooltipContent>
                                  </Tooltip>
                                </TableCell>
                              );
                            })}
                            <TableCell className="text-right pr-8">
                              <Badge className={cn(
                                "text-[11px] font-black uppercase px-3 py-1.5 rounded-md border",
                                r.overall_status === 'Completed' 
                                  ? "bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-50" 
                                  : r.overall_status === 'Incomplete'
                                  ? "bg-rose-50 text-rose-500 border-rose-100 hover:bg-rose-50"
                                  : "bg-zinc-50 text-zinc-500 border-zinc-100 hover:bg-zinc-50"
                              )}>
                                {r.overall_status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </TooltipProvider>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-8 py-6 bg-zinc-50/50 border-t border-zinc-100">
                  <div className="text-xs font-black uppercase text-zinc-400 tracking-wider">
                    Page {currentPage} of {totalPages}
                  </div>
                  <div className="flex items-center gap-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="h-10 w-10 p-0 rounded-lg border-zinc-200"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="h-10 w-10 p-0 rounded-lg border-zinc-200"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default VILTTrackerDashboard;
